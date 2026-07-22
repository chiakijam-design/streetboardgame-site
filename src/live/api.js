import { calculateLiveResult, validateLiveDraft } from './model.js';
import {
  LIVE_FALLBACK_VIEWER_LIMIT,
  LIVE_RESERVATION_BUFFER_HOURS,
  LIVE_VIEWER_LIMIT,
} from './config.js';
import {
  broadcastLiveRealtimeState,
  connectLiveRealtime,
  hasLiveRealtime,
  initializeLiveRealtime,
  liveViewerLimit,
  loadLiveRealtimeParticipantVotes,
  loadLiveRealtimeQuestionSnapshot,
  loadLiveRealtimeStats,
  releaseLiveRealtimeParticipant,
  reserveLiveRealtimeParticipant,
  storeLiveRealtimeVote,
} from './realtime.js';

const LIVE_ACTIVE_TTL_SECONDS = 60 * 60 * 24;
const LIVE_SAVED_TTL_SECONDS = 60 * 60 * 24 * 30;
const LIVE_RESERVATION_BUFFER_MS = LIVE_RESERVATION_BUFFER_HOURS * 60 * 60 * 1000;
const LIVE_CODE_PATTERN = /^[0-9]{6}$/;
let liveD1ReadyPromise = null;
let liveRateLimitReadyPromise = null;

export async function handleLiveApi(request, env, path) {
  if (request.method === 'OPTIONS') return liveJson({});
  try {
    if (path === '/api/live/youtube-candidates' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'youtube', 15);
      return await createYouTubeCandidatesResponse(request);
    }
    if (!env.REMOTE_DB && !env.LIVE_KV && !env.REMOTE_KV) {
      return liveJson({ error: 'live-storage-not-configured' }, 500);
    }
    if (path === '/api/live/reservations/availability' && request.method === 'GET') {
      await enforceLiveRateLimit(request, env, 'availability', 120);
      return await getLiveReservationAvailability(request, env);
    }
    if (path === '/api/live/games' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'create', 10);
      return await createLiveGame(request, env);
    }

    const route = path.match(/^\/api\/live\/games\/([0-9]{6})(?:\/(join|start|answer|subject-answer|advance|vote|close|reveal|next|socket))?$/);
    if (!route) return liveJson({ error: 'not-found' }, 404);
    const [, code, action = ''] = route;
    if (request.method === 'GET' && !action) return await getLiveGameResponse(request, env, code);
    if (request.method === 'GET' && action === 'socket') return await connectLiveGameSocket(request, env, code);
    if (request.method !== 'POST') return liveJson({ error: 'method-not-allowed' }, 405);
    if (action === 'join') {
      if (!hasLiveRealtime(env)) await enforceLiveRateLimit(request, env, 'join', 100);
      return await joinLiveGame(request, env, code);
    }
    if (action === 'vote') {
      if (!hasLiveRealtime(env)) await enforceLiveRateLimit(request, env, 'vote', 600);
      return await voteLiveGame(request, env, code);
    }
    if (action === 'subject-answer') {
      await enforceLiveRateLimit(request, env, 'subject', 300);
      return await answerLiveGameAsSubject(request, env, code);
    }
    if (['start', 'answer', 'advance', 'close', 'reveal', 'next'].includes(action)) {
      await enforceLiveRateLimit(request, env, 'host', 300);
      return await updateLiveGameAsHost(request, env, code, action);
    }
    return liveJson({ error: 'not-found' }, 404);
  } catch (error) {
    return liveJson({ error: error && error.message ? error.message : 'live-api-error' }, Number(error && error.status) || 500);
  }
}

async function createLiveGame(request, env) {
  const body = await readLiveJson(request);
  if (body?.draft?.creationMode !== 'youtube') throw liveError('youtube-creation-required', 400);
  const now = Date.now();
  const validation = validateLiveDraft(body && body.draft, { now });
  if (!validation.valid) throw liveError(validation.errors[0] || 'invalid-game', 400);
  await cleanupExpiredLiveData(env);
  let code = createLiveCode();
  for (let attempt = 0; attempt < 8 && await getStoredLiveGame(env, code); attempt += 1) code = createLiveCode();
  const reservation = await reserveLiveSlot(env, code, validation.draft.scheduledAt, now);
  const game = {
    version: 4,
    title: validation.draft.title,
    subjectName: validation.draft.subjectName,
    channelName: validation.draft.channelName || validation.draft.subjectName,
    creatorImageDataUrl: validation.draft.creatorImageDataUrl,
    scheduledAt: reservation.scheduledAt,
    reservationEndsAt: reservation.blockedUntil,
    questions: validation.draft.questions,
    hostToken: createLiveToken(24),
    subjectToken: createLiveToken(24),
    phase: 'lobby',
    currentQuestionIndex: 0,
    participants: [],
    votes: {},
    results: [],
    showVoteCount: validation.draft.showLiveVoteCounts,
    participantCount: 0,
    participantLimit: liveViewerLimit(env),
    realtime: hasLiveRealtime(env),
    createdAt: now,
    updatedAt: now,
    expiresAt: reservation.blockedUntil,
  };
  try {
    await putStoredLiveGame(env, code, game);
    if (hasLiveRealtime(env)) {
      await initializeLiveRealtime(env, code);
      await broadcastCurrentRealtimeState(env, code, game);
    }
  } catch (error) {
    await releaseLiveReservation(env, code);
    throw error;
  }
  return liveJson({ code, hostToken: game.hostToken, game: publicLiveGame(game, { host: true }) }, 201);
}

async function getLiveReservationAvailability(request, env) {
  const scheduledAt = Number(new URL(request.url).searchParams.get('scheduledAt'));
  if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) throw liveError('invalid-scheduled-at', 400);
  await cleanupExpiredLiveData(env);
  const available = await isLiveSlotAvailable(env, scheduledAt);
  return liveJson({
    available,
    scheduledAt,
    viewerLimit: liveViewerLimit(env),
    bufferHours: LIVE_RESERVATION_BUFFER_HOURS,
  });
}

async function getLiveGameResponse(request, env, code) {
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  const subjectToken = normalizeToken(request.headers.get('x-live-subject-token'));
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, realtime
    ? { baseOnly: true }
    : { polling: true, participantToken });
  const host = Boolean(hostToken && hostToken === game.hostToken);
  const subject = Boolean(subjectToken && subjectToken === game.subjectToken);
  if (realtime) await enrichRealtimeGame(env, code, game, { host, participantToken });
  return liveJson({
    code,
    game: publicLiveGame(game, {
      host,
      subject,
      participantToken,
    }),
  });
}

async function connectLiveGameSocket(request, env, code) {
  if (!hasLiveRealtime(env)) throw liveError('live-realtime-unavailable', 503);
  const protocols = String(request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((item) => item.trim());
  const participantToken = protocols.find((item) => /^[a-f0-9]{20,96}$/i.test(item)) || '';
  const participant = await loadLiveParticipant(env, code, participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  return connectLiveRealtime(request, env, code, participant);
}

async function joinLiveGame(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime && Boolean(env.REMOTE_DB) });
  if (game.phase === 'complete') throw liveError('game-finished', 409);
  const body = await readLiveJson(request);
  const name = String(body && body.name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw liveError('name-required', 400);
  const viewerLimit = liveViewerLimit(env);
  if (!realtime && game.participants.length >= viewerLimit) throw liveError('participant-limit-reached', 409);
  let participant;
  let reservation;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = { id: createLiveToken(10), token: createLiveToken(24), name, joinedAt: Date.now() };
    try {
      reservation = realtime ? await reserveLiveRealtimeParticipant(env, code, candidate.token) : null;
      participant = candidate;
      break;
    } catch (error) {
      if (error.message !== 'participant-limit-reached' || attempt === 15) throw error;
    }
  }
  if (!participant) throw liveError('participant-limit-reached', 409);
  const usesD1 = await ensureLiveD1(env);
  if (usesD1) {
    try {
      const inserted = realtime
        ? await env.REMOTE_DB.prepare(`
            INSERT INTO live_participants (code, participant_id, participant_token, name, joined_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(code, participant.id, participant.token, participant.name, participant.joinedAt).run()
        : await env.REMOTE_DB.prepare(`
            INSERT INTO live_participants (code, participant_id, participant_token, name, joined_at)
            SELECT ?, ?, ?, ?, ?
            WHERE (SELECT COUNT(*) FROM live_participants WHERE code = ?) < ?
          `).bind(code, participant.id, participant.token, participant.name, participant.joinedAt, code, viewerLimit).run();
      if (Number(inserted?.meta?.changes || 0) !== 1) throw liveError('participant-limit-reached', 409);
    } catch (error) {
      if (realtime) await releaseLiveRealtimeParticipant(env, code, participant.token);
      throw error;
    }
  } else {
    game.participants.push(participant);
  }
  if (!realtime || !usesD1) {
    touchLiveGame(game);
    await putStoredLiveGame(env, code, game);
  }
  const participantCount = realtime ? reservation.participantCount : game.participants.length;
  game.participants = realtime ? [participant] : game.participants;
  game.participantCount = participantCount;
  game.participantLimit = viewerLimit;
  game.realtime = realtime;
  return liveJson({
    code,
    participantId: participant.id,
    participantToken: participant.token,
    game: publicLiveGame(game, { participantToken: participant.token }),
  }, 201);
}

async function voteLiveGame(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  if (game.phase !== 'voting') throw liveError('voting-closed', 409);
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  const participant = realtime
    ? await loadLiveParticipant(env, code, participantToken)
    : game.participants.find((item) => item.token === participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  const body = await readLiveJson(request);
  const question = game.questions[game.currentQuestionIndex];
  const optionIndex = Number(body && body.optionIndex);
  if (!question || body.questionId !== question.id) throw liveError('question-changed', 409);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw liveError('invalid-option', 400);
  }
  if (!realtime && Object.prototype.hasOwnProperty.call(game.votes[question.id] || {}, participant.id)) {
    throw liveError('already-voted', 409);
  }
  if (realtime) {
    await storeLiveRealtimeVote(env, code, participant, question, optionIndex);
    const stats = await loadLiveRealtimeStats(env, code, question);
    game.participants = [participant];
    game.participantCount = Number(stats?.participantCount) || 0;
    game.participantLimit = liveViewerLimit(env);
    game.realtime = true;
    game.currentVoteCounts = stats?.voteCounts || question.options.map(() => 0);
    game.votes = { [question.id]: { [participant.id]: optionIndex } };
    return liveJson({ code, accepted: true, game: publicLiveGame(game, { participantToken }) });
  }
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_votes (code, question_id, participant_id, option_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code, question_id, participant_id) DO UPDATE SET
        option_index = excluded.option_index,
        updated_at = excluded.updated_at
    `).bind(code, question.id, participant.id, optionIndex, Date.now()).run();
  } else {
    game.votes[question.id] = { ...(game.votes[question.id] || {}), [participant.id]: optionIndex };
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  const updatedGame = await requireLiveGame(env, code);
  return liveJson({ code, accepted: true, game: publicLiveGame(updatedGame, { participantToken }) });
}

async function answerLiveGameAsSubject(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  if (Number(game.version) < 4 || !game.subjectToken) throw liveError('subject-not-supported', 409);
  const subjectToken = normalizeToken(request.headers.get('x-live-subject-token'));
  if (!subjectToken || subjectToken !== game.subjectToken) throw liveError('subject-forbidden', 403);
  if (game.phase !== 'voting') throw liveError('answer-not-open', 409);
  const question = game.questions[game.currentQuestionIndex];
  const body = await readLiveJson(request);
  const optionIndex = Number(body && body.optionIndex);
  if (!question || body.questionId !== question.id) throw liveError('question-changed', 409);
  if (Number.isInteger(question.lockedIndex)) throw liveError('already-answered', 409);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw liveError('invalid-option', 400);
  }
  question.lockedIndex = optionIndex;
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  if (realtime) await broadcastCurrentRealtimeState(env, code, game);
  return liveJson({ code, accepted: true, game: publicLiveGame(game, { subject: true }) });
}

async function updateLiveGameAsHost(request, env, code, action) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  if (!hostToken || hostToken !== game.hostToken) throw liveError('host-forbidden', 403);
  const shouldAcquireActiveSlot = action === 'start' && Number(game.version) >= 4;
  if (shouldAcquireActiveSlot && game.phase !== 'lobby') throw liveError('game-already-started', 409);
  if (shouldAcquireActiveSlot) await acquireLiveActiveSlot(env, code, game);
  try {
    if (realtime && action === 'advance' && game.phase === 'voting') {
      const question = game.questions[game.currentQuestionIndex];
      const snapshot = question ? await loadLiveRealtimeQuestionSnapshot(env, code, question) : null;
      if (question && snapshot) {
        game.votes[question.id] = snapshot.votes || {};
        game.currentVoteCounts = snapshot.voteCounts || question.options.map(() => 0);
      }
    }
    if (Number(game.version) >= 4) {
      await updateSeparatedLiveGame(request, game, action);
    } else if (Number(game.version) >= 3) {
      await updateCurrentLiveGame(request, game, action);
    } else {
      await updateLegacyLiveGame(request, game, action);
    }
    touchLiveGame(game);
    await putStoredLiveGame(env, code, game);
    if (realtime) await broadcastCurrentRealtimeState(env, code, game);
  } catch (error) {
    if (shouldAcquireActiveSlot) await releaseLiveActiveSlot(env, code);
    throw error;
  }
  if (game.phase === 'complete') await releaseLiveActiveSlot(env, code);
  if (realtime) await enrichRealtimeGame(env, code, game, { host: true });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function updateSeparatedLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.currentQuestionIndex = 0;
    game.phase = 'voting';
  } else if (action === 'advance') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    if (!question || !Number.isInteger(question.lockedIndex)) throw liveError('answer-required', 409);
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.currentQuestionIndex = 0;
      game.phase = 'review-question';
    } else {
      game.currentQuestionIndex += 1;
    }
  } else if (action === 'reveal') {
    if (game.phase !== 'review-question') throw liveError('review-not-open', 409);
    game.phase = 'review-answer';
  } else if (action === 'next') {
    if (game.phase !== 'review-answer') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = 'review-question';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

async function updateCurrentLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.currentQuestionIndex = 0;
    game.phase = 'voting';
  } else if (action === 'advance') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    const body = await readLiveJson(request);
    const optionIndex = Number(body && body.optionIndex);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw liveError('invalid-option', 400);
    }
    question.lockedIndex = optionIndex;
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.currentQuestionIndex = 0;
      game.phase = 'review-question';
    } else {
      game.currentQuestionIndex += 1;
    }
  } else if (action === 'reveal') {
    if (game.phase !== 'review-question') throw liveError('review-not-open', 409);
    game.phase = 'review-answer';
  } else if (action === 'next') {
    if (game.phase !== 'review-answer') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = 'review-question';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

async function updateLegacyLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.phase = game.questions[game.currentQuestionIndex]?.lockedIndex === null ? 'answering' : 'voting';
  } else if (action === 'answer') {
    if (game.phase !== 'answering') throw liveError('answer-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    const body = await readLiveJson(request);
    const optionIndex = Number(body && body.optionIndex);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw liveError('invalid-option', 400);
    }
    question.lockedIndex = optionIndex;
    game.phase = 'voting';
  } else if (action === 'close') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    if (question.type !== 'poll' && !Number.isInteger(question.lockedIndex)) throw liveError('answer-required', 409);
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    game.phase = 'reveal';
  } else if (action === 'next') {
    if (game.phase !== 'reveal') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = game.questions[game.currentQuestionIndex]?.lockedIndex === null ? 'answering' : 'voting';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

export function publicLiveGame(game, access = {}) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const currentVotes = question ? game.votes[question.id] || {} : {};
  const participants = Array.isArray(game.participants) ? game.participants : [];
  const flowVersion = Number(game.version) || 1;
  const participant = access.participantToken
    ? participants.find((item) => item.token === access.participantToken)
    : null;
  const storedRevealResult = question && ['reveal', 'review-answer', 'complete'].includes(game.phase)
    ? game.results.find((item) => item.questionId === question.id) || null
    : null;
  const revealResult = storedRevealResult
    ? participantLiveResult(storedRevealResult, participant, game.votes)
    : null;
  const completedResults = game.phase === 'complete'
    ? game.results.map((result) => participantLiveResult(result, participant, game.votes))
    : [];
  const subjectAnswered = Number.isInteger(question?.lockedIndex);
  const canSeeVoteCount = flowVersion < 4 || access.host || (access.subject ? subjectAnswered : game.showVoteCount);
  const summarizedVoteCounts = question && Array.isArray(game.currentVoteCounts)
    && game.currentVoteCounts.length === question.options.length
    ? game.currentVoteCounts.map((count) => Math.max(0, Number(count) || 0))
    : null;
  const voteCounts = question
    ? summarizedVoteCounts || question.options.map((_, optionIndex) => Object.values(currentVotes).filter((value) => Number(value) === optionIndex).length)
    : [];
  const voteCount = voteCounts.reduce((total, count) => total + count, 0);
  const publicQuestion = question ? {
    id: question.id,
    type: question.type,
    text: question.text,
    options: question.options,
    subjectAnswered,
    result: revealResult,
    ...(canSeeVoteCount ? { voteCount } : {}),
    ...(flowVersion >= 4 && canSeeVoteCount ? { voteCounts } : {}),
    ...(access.subject ? { myAnswerIndex: Number.isInteger(question.lockedIndex) ? question.lockedIndex : null } : {}),
  } : null;
  return {
    title: game.title,
    subjectName: game.subjectName,
    flowVersion,
    phase: game.phase,
    currentQuestionIndex: game.currentQuestionIndex,
    questionCount: game.questions.length,
    participantCount: Number.isInteger(game.participantCount) ? game.participantCount : participants.length,
    participantLimit: Number(game.participantLimit) || (game.realtime ? LIVE_VIEWER_LIMIT : LIVE_FALLBACK_VIEWER_LIMIT),
    participants: access.host ? participants.map(({ id, name }) => ({ id, name })) : [],
    question: publicQuestion,
    myVoteIndex: participant && Object.prototype.hasOwnProperty.call(currentVotes, participant.id)
      ? Number(currentVotes[participant.id])
      : null,
    results: completedResults,
    showVoteCount: Boolean(game.showVoteCount),
    realtime: Boolean(game.realtime),
    scheduledAt: Number(game.scheduledAt) || undefined,
    channelName: game.channelName || game.subjectName,
    participantName: participant?.name,
    host: Boolean(access.host),
    subject: Boolean(access.subject),
    questions: access.host ? game.questions.map(({ id, type, text, options }) => ({ id, type, text, options })) : undefined,
    ...(access.host && flowVersion >= 4 ? { subjectToken: game.subjectToken } : {}),
    ...((participant && game.phase === 'complete') && game.creatorImageDataUrl
      ? { creatorImageDataUrl: game.creatorImageDataUrl }
      : {}),
    expiresAt: access.host ? game.expiresAt : undefined,
  };
}

function participantLiveResult(result, participant, votes) {
  if (!participant || !result) return result;
  const questionVotes = votes && votes[result.questionId] || {};
  const hasVote = Object.prototype.hasOwnProperty.call(questionVotes, participant.id);
  const myVoteIndex = hasVote ? Number(questionVotes[participant.id]) : null;
  if (result.type === 'guess-person') {
    return { ...result, myVoteIndex, myIsCorrect: hasVote ? myVoteIndex === result.subjectAnswerIndex : null };
  }
  if (result.type === 'guess-majority') {
    return { ...result, myVoteIndex, myVoteWasPopular: hasVote ? result.popularIndices.includes(myVoteIndex) : null };
  }
  return { ...result, myVoteIndex };
}

async function createYouTubeCandidatesResponse(request) {
  const body = await readLiveJson(request);
  const input = normalizeYouTubeInput(body && body.channelUrl);
  if (!input) throw liveError('invalid-youtube-url', 400);
  const questionType = body && body.questionType;
  if (!['guess-person', 'guess-majority'].includes(questionType)) throw liveError('invalid-youtube-question-type', 400);
  const seed = Number(body && body.seed) || 0;
  let profile;
  try {
    profile = await fetchYouTubeChannelProfile(input);
  } catch (error) {
    if (input.kind === 'video') throw liveError('youtube-video-channel-not-found', 422);
    const fallbackName = decodeURIComponent(new URL(input.url).pathname.split('/').filter(Boolean).pop() || 'YouTubeチャンネル');
    profile = {
      channelName: fallbackName.replace(/^@/, '') || 'YouTubeチャンネル',
      channelUrl: input.url,
      description: '',
      videoTitles: [],
      videoSummaries: [],
      source: 'url-fallback',
      inputKind: input.kind,
    };
  }
  return liveJson({
    channelUrl: profile.channelUrl || input.url,
    profile,
    questionType,
    questions: generateYouTubeQuestions(profile, seed, questionType),
  });
}

export function normalizeYouTubeChannelUrl(value) {
  const input = normalizeYouTubeInput(value);
  return input && input.kind === 'channel' ? input.url : '';
}

export function normalizeYouTubeInputUrl(value) {
  return normalizeYouTubeInput(value)?.url || '';
}

function normalizeYouTubeInput(value) {
  let url;
  try {
    const input = String(value || '').trim();
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch (error) {
    return null;
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId = '';
  if (hostname === 'youtu.be') videoId = parts[0] || '';
  if (hostname !== 'youtu.be' && url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
  if (hostname !== 'youtu.be' && ['shorts', 'live', 'embed'].includes(parts[0])) videoId = parts[1] || '';
  if (videoId) {
    if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) return null;
    return { kind: 'video', videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }
  if (!parts.length) return null;
  const first = parts[0];
  const reserved = ['watch', 'shorts', 'live', 'embed', 'playlist', 'results', 'feed', 'redirect'];
  const valid = first.startsWith('@')
    || (['channel', 'c', 'user'].includes(first) && Boolean(parts[1]))
    || (!reserved.includes(first.toLowerCase()) && parts.length === 1);
  if (!valid) return null;
  const normalizedPath = first.startsWith('@') || parts.length === 1 ? `/${first}` : `/${first}/${parts[1]}`;
  return { kind: 'channel', url: `https://www.youtube.com${normalizedPath}` };
}

export async function fetchYouTubeChannelProfile(inputValue) {
  const input = typeof inputValue === 'string' ? normalizeYouTubeInput(inputValue) : inputValue;
  if (!input) throw new Error('invalid-youtube-url');
  let channelUrl = input.url;
  let sourceVideo = null;
  if (input.kind === 'video') {
    sourceVideo = await fetchYouTubeVideoSource(input);
    channelUrl = sourceVideo.channelUrl;
    if (!channelUrl) throw new Error('youtube-video-channel-not-found');
  }

  let channelHtml = '';
  try {
    channelHtml = await fetchYouTubeText(`${channelUrl}/videos`);
  } catch (error) {
    if (!sourceVideo) throw error;
  }
  const channelId = extractYouTubeChannelId(channelHtml)
    || sourceVideo?.channelId
    || (/\/channel\/(UC[A-Za-z0-9_-]+)/.exec(channelUrl)?.[1] || '');
  let feedVideos = [];
  if (channelId) {
    try {
      const feedXml = await fetchYouTubeText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
      feedVideos = extractYouTubeFeedVideos(feedXml);
    } catch (error) {
      feedVideos = [];
    }
  }
  const pageVideos = extractYouTubeVideoEntries(channelHtml);
  const videoSummaries = mergeYouTubeVideos(sourceVideo ? [sourceVideo] : [], feedVideos, pageVideos).slice(0, 20);
  const pageChannelName = extractMeta(channelHtml, 'og:title') || extractHtmlTitle(channelHtml);
  const pageDescription = extractMeta(channelHtml, 'og:description') || extractNamedMeta(channelHtml, 'description');
  const channelName = cleanChannelName(pageChannelName || sourceVideo?.channelName || 'YouTubeチャンネル');
  const description = decodeHtml(pageDescription || '').slice(0, 1000);
  return {
    channelName,
    channelUrl,
    channelId,
    description,
    videoTitles: videoSummaries.map(({ title }) => title),
    videoSummaries,
    videoDescriptionCount: videoSummaries.filter(({ description: videoDescription }) => Boolean(videoDescription)).length,
    sourceVideo: sourceVideo ? {
      title: sourceVideo.title,
      description: sourceVideo.description,
      keywords: sourceVideo.keywords,
    } : null,
    source: input.kind === 'video' ? 'youtube-video-and-channel' : 'youtube-public-page',
    inputKind: input.kind,
  };
}

async function fetchYouTubeVideoSource(input) {
  let html = '';
  try {
    html = await fetchYouTubeText(input.url);
  } catch (error) {
    html = '';
  }
  const source = extractYouTubeVideoSource(html);
  if (source.channelUrl) return { ...source, videoId: input.videoId };
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(input.url)}&format=json`;
  const oembed = JSON.parse(await fetchYouTubeText(oembedUrl));
  const channelUrl = normalizeYouTubeChannelUrl(oembed.author_url || '');
  if (!channelUrl) throw new Error('youtube-video-channel-not-found');
  return {
    videoId: input.videoId,
    title: cleanYouTubeText(source.title || oembed.title || ''),
    description: cleanYouTubeText(source.description || ''),
    keywords: source.keywords || [],
    channelName: cleanChannelName(source.channelName || oembed.author_name || ''),
    channelUrl,
    channelId: source.channelId || '',
  };
}

async function fetchYouTubeText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; WatachanLive/1.0; +https://www.streetboardgame.com/)',
        'accept-language': 'ja,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error('youtube-fetch-failed');
  return response.text();
}

export function generateYouTubeQuestions(profile, seed = 0, questionType = 'guess-person') {
  const name = String(profile && profile.channelName || 'このチャンネル').trim() || 'このチャンネル';
  const videos = Array.isArray(profile && profile.videoTitles)
    ? [...new Set(profile.videoTitles.map(shortYouTubeLabel).filter(Boolean))].slice(0, 20)
    : [];
  const topics = extractYouTubeTopics(profile);
  const videoOptions = (offset) => videos.length >= 2
    ? Array.from({ length: Math.min(5, videos.length) }, (_, index) => videos[(offset + index) % videos.length])
    : ['トーク企画', 'チャレンジ企画', 'コラボ企画', '生配信', '密着・日常企画'];
  const videoAt = (index) => videos[index % Math.max(videos.length, 1)] || 'このチャンネルの動画';
  const topicAt = (index) => topics[index % Math.max(topics.length, 1)] || name;
  const tailoredPersonTemplates = videos.length >= 2 || topics.length >= 2 ? [
    ['本人が撮影の裏話を一番語りたい動画は？', videoOptions(0)],
    ['本人が予想以上の反響に驚いた動画は？', videoOptions(3)],
    ['本人が同じメンバーでもう一度撮りたい動画は？', videoOptions(6)],
    ['本人が公開前に一番緊張した動画は？', videoOptions(9)],
    ['本人が今の自分らしさを一番感じる動画は？', videoOptions(12)],
    [`「${videoAt(0)}」で、本人が実は一番こだわった部分は？`, ['企画の内容', '撮影場所・道具', '話す順番', '編集・見せ方', '出演者とのやり取り']],
    [`「${videoAt(1)}」を公開した直後、本人の気持ちに一番近かったのは？`, ['手応えがあった', '反応が心配だった', 'すぐ続編を考えた', '撮り直したかった', 'やり切って安心した']],
    [`「${videoAt(2)}」で、本人が視聴者に一番気づいてほしいことは？`, ['細かい演出', '出演者の反応', '準備の大変さ', '本人の本音', '動画に込めたメッセージ']],
    [`本人が「${topicAt(0)}」を次に扱うなら、一番やりたい形は？`, ['続編を作る', '生配信で深掘りする', '別の人とコラボする', '視聴者参加型にする', '舞台裏を見せる']],
    [`本人が「${topicAt(1)}」について、まだ話せていないことは？`, ['始めたきっかけ', '失敗したこと', '一番のこだわり', '周りの反応', 'これからの目標']],
    ['チャンネル内で本人だけが知っているハプニングが一番多かった動画は？', videoOptions(15)],
    [`入力された「${videoAt(0)}」を本人が友達に見せるなら、最初に伝えたいことは？`, ['一番笑ってほしい場面', '撮影の裏話', '出演者との関係', '企画の狙い', '最後まで見てほしい理由']],
  ] : [];
  const personTemplates = [
    ['本人が初めて見る人に一番おすすめしたい動画は？', videoOptions(0)],
    ['本人が今もう一度見てほしい動画は？', videoOptions(3)],
    ['本人が撮影で一番大切にしていることは？', ['面白さ', '分かりやすさ', '自分らしさ', '視聴者との距離']],
    ['本人が次に一番挑戦したい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['本人が動画作りで一番好きな時間は？', ['企画を考える時', '撮影中', '編集している時', '公開後の反応を見る時']],
    ['本人が撮影前に一番気にすることは？', ['話す内容', '見た目', '撮影場所', '体調']],
    ['本人がチャンネルの強みだと思うものは？', ['企画力', 'トーク', '編集', 'キャラクター']],
    ['本人が一番うれしい視聴者の反応は？', ['笑った', '参考になった', '元気が出た', 'また見たい']],
    ['本人が一緒に動画を作りたい相手は？', ['同ジャンルの人', '違うジャンルの人', '視聴者', '昔からの友達']],
    ['本人が動画で一番見せたい一面は？', ['面白いところ', '真剣なところ', '自然体', '意外な特技']],
    ['本人が一番落ち着く撮影スタイルは？', ['一人撮影', '少人数', '大人数', '屋外ロケ']],
    ['本人がチャンネルで今後増やしたいものは？', ['短い動画', '長い動画', '生配信', 'シリーズ企画']],
    ['本人が企画を決める時に一番頼るものは？', ['自分の直感', 'コメント', '流行', '仲間の意見']],
    ['本人が動画を公開する時の気持ちに近いものは？', ['楽しみ', '緊張', '達成感', 'すぐ次を作りたい']],
    [`本人が「${name}」を一言で表すなら？`, ['挑戦', '笑い', 'つながり', '自分らしさ']],
    ['本人が動画を一本だけ残すならどれを選ぶ？', videoOptions(6)],
    ['本人が一番自分らしく話せたと思う動画は？', videoOptions(9)],
    ['本人が朝起きて最初に確認するものは？', ['コメント', '再生数', '今日の予定', 'SNS']],
    ['本人が編集で一番こだわる部分は？', ['テンポ', '音楽・効果音', 'テロップ', '映像の色']],
    ['本人が撮影で予想外に苦労しやすいことは？', ['準備', '話の流れ', '機材', '時間管理']],
    ['本人が一番伸ばしたいスキルは？', ['トーク', '企画', '撮影', '編集']],
    ['本人が動画のアイデアを思いつきやすい場所は？', ['自宅', '移動中', '人と話している時', 'コメントを見ている時']],
    ['本人が撮影後に最初にすることは？', ['映像を確認する', '休憩する', '編集を始める', 'SNSを更新する']],
    ['本人が一番大切にしたいチャンネルの雰囲気は？', ['楽しい', '落ち着く', '学べる', '驚きがある']],
    ['本人が視聴者と一緒に実現したいことは？', ['記念企画', 'イベント', '商品作り', '社会貢献']],
    ['本人が過去の自分に一つ助言するなら？', ['もっと投稿する', '失敗を恐れない', '得意を伸ばす', '休む時間を作る']],
    ['本人が撮影日に一番欠かせないものは？', ['飲み物', '台本・メモ', 'お気に入りの機材', '応援してくれる仲間']],
    ['本人が一番達成感を感じる瞬間は？', ['撮影が終わった時', '編集が完成した時', '公開した時', '反響が届いた時']],
    ['本人が次の節目でやりたいことは？', ['特別動画', '生配信', 'コラボ', '視聴者参加企画']],
    [`本人が「${name}」を続ける一番の原動力は？`, ['作る楽しさ', '視聴者の反応', '仲間との活動', '目標の実現']],
  ];
  const tailoredMajorityTemplates = videos.length >= 2 || topics.length >= 2 ? [
    ['視聴者が一番「撮影の裏側を知りたい」と思う動画は？', videoOptions(0)],
    ['視聴者が身内に一番すすめたい動画は？', videoOptions(3)],
    ['視聴者が続編を本気で待っている動画は？', videoOptions(6)],
    ['視聴者が本人らしさを一番感じる動画は？', videoOptions(9)],
    ['視聴者が今見返すと新しい発見がありそうだと思う動画は？', videoOptions(12)],
    [`「${videoAt(0)}」の続編で、視聴者が一番見たいものは？`, ['同じ企画の再挑戦', '撮影の舞台裏', '別メンバー版', '視聴者参加版', '本人による振り返り']],
    [`「${videoAt(1)}」で、視聴者が一番印象に残ったと思う要素は？`, ['本人のリアクション', '出演者との掛け合い', '予想外の展開', '企画そのもの', '最後のまとめ']],
    [`「${videoAt(2)}」について、視聴者が本人に一番聞きたいことは？`, ['撮影前の予想', '一番大変だった場面', '動画に入らなかった話', '出演者との関係', '公開後の本音']],
    [`視聴者が「${topicAt(0)}」で次に見たい企画は？`, ['もっと深掘りする', '別の場所で挑戦する', 'ゲストを呼ぶ', '生配信でやる', '視聴者も参加する']],
    [`視聴者が「${topicAt(1)}」について一番知りたいことは？`, ['始めたきっかけ', '本人のこだわり', '失敗や裏話', '仲間との関係', '今後の予定']],
    ['古参視聴者と最近の視聴者で答えが一番分かれそうな動画は？', videoOptions(15)],
    [`入力された「${videoAt(0)}」を初見の人に見せた時、一番反応されそうなのは？`, ['本人のキャラクター', '企画の発想', '出演者との空気感', '編集のテンポ', '予想外の結末']],
  ] : [];
  const majorityTemplates = [
    ['視聴者が初めての人に一番すすめたい動画は？', videoOptions(1)],
    ['視聴者が続編を一番見たい動画は？', videoOptions(4)],
    ['視聴者が次に一番見たい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['視聴者がチャンネルの一番好きなところは？', ['企画', 'トーク', '編集', '人柄']],
    ['視聴者が動画を見ることが多い時間は？', ['朝', '昼', '夕方', '夜']],
    ['視聴者が一番参加したい企画は？', ['質問コーナー', '投票企画', 'ライブ配信', 'オフラインイベント']],
    ['視聴者がもっと知りたいことは？', ['日常', '制作の裏側', '好きなもの', '今後の目標']],
    ['視聴者が一番うれしい更新は？', ['毎日短く更新', '週1で大作', '不定期ライブ', 'シリーズを継続']],
    ['視聴者がコラボで見たい相手は？', ['同ジャンル', '別ジャンル', '友達', '視聴者']],
    ['視聴者が一番印象に残る要素は？', ['タイトル', 'サムネイル', '最初の1分', 'ラスト']],
    ['視聴者が友達に紹介する時の一言は？', ['笑える', '役に立つ', '親しみやすい', '企画がすごい']],
    ['視聴者が見返したくなる動画は？', ['トーク', 'チャレンジ', 'コラボ', '密着・日常']],
    ['視聴者が一番応援したくなる瞬間は？', ['新しい挑戦', '失敗からの再挑戦', '目標達成', '視聴者への感謝']],
    ['視聴者がグッズにするなら一番ほしいものは？', ['ステッカー', 'Tシャツ', 'アクリルグッズ', '実用品']],
    [`視聴者が「${name}」に今後一番期待することは？`, ['もっと大きな企画', '今の雰囲気を続ける', '更新回数を増やす', '視聴者参加を増やす']],
    ['視聴者が一番人に見せたくなる動画は？', videoOptions(7)],
    ['視聴者がチャンネルを知るきっかけになりそうな動画は？', videoOptions(10)],
    ['視聴者が通知を見てすぐ再生したくなる企画は？', ['新シリーズ', '大型チャレンジ', '人気企画の続編', 'コラボ']],
    ['視聴者が動画で一番聞きたい話は？', ['最近の出来事', '失敗談', '将来の目標', '制作の裏話']],
    ['視聴者が一番まねしてみたいものは？', ['企画', '習慣', '話し方', '使っている道具']],
    ['視聴者が動画を最後まで見る決め手は？', ['展開が気になる', '話が面白い', '役に立つ', '雰囲気が好き']],
    ['視聴者が一番親近感を持つ瞬間は？', ['失敗した時', '日常を見せた時', '本音を話した時', 'コメントに反応した時']],
    ['視聴者が生配信で一番やってほしいことは？', ['質問回答', 'ゲーム・挑戦', '雑談', '一緒に企画を決める']],
    ['視聴者が動画の長さとして一番見やすいのは？', ['1分未満', '5分前後', '10〜20分', '30分以上']],
    ['視聴者が一番保存したくなる動画は？', ['役立つ解説', 'お気に入り企画', '感動する話', '何度も笑える動画']],
    ['視聴者が新しく見てみたい撮影場所は？', ['自宅・スタジオ', '街中', '自然の中', '海外']],
    ['視聴者が一番好きな投稿ペースは？', ['毎日', '週2〜3回', '週1回', '質重視で不定期']],
    ['視聴者がメンバーになったら一番ほしい特典は？', ['限定動画', '限定配信', '制作の裏側', '先行公開']],
    ['視聴者がチャンネルの次の目標にしてほしいことは？', ['登録者の節目', '大型企画', 'イベント開催', '新しい分野への挑戦']],
    [`視聴者が「${name}」を見続ける一番の理由は？`, ['動画が面白い', '本人が好き', '役に立つ', '一緒に成長を感じる']],
  ];
  const rotate = (items) => {
    const offset = Math.abs(Number(seed) || 0) % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };
  const templates = questionType === 'guess-majority'
    ? [...tailoredMajorityTemplates, ...majorityTemplates].slice(0, 30)
    : [...tailoredPersonTemplates, ...personTemplates].slice(0, 30);
  const idPrefix = questionType === 'guess-majority' ? 'yt-majority' : 'yt-person';
  return rotate(templates).map(([text, options], index) => ({
    id: `${idPrefix}-${seed}-${index}`,
    type: questionType === 'guess-majority' ? 'guess-majority' : 'guess-person',
    text,
    options: normalizeYouTubeOptions(options),
    lockedIndex: null,
    selected: index < 5,
    recommended: index < 5,
  }));
}

export function extractYouTubeTopics(profile) {
  const found = [];
  const add = (value) => {
    const topic = cleanYouTubeText(value)
      .replace(/^#+/, '')
      .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
      .trim();
    const generic = /^(動画|チャンネル|youtube|youtuber|shorts?|ライブ|配信|公式|最新|今回|こちら|お知らせ)$/i;
    if (topic.length >= 2 && topic.length <= 28 && !generic.test(topic) && !found.includes(topic)) found.push(topic);
  };
  const summaries = Array.isArray(profile?.videoSummaries) ? profile.videoSummaries : [];
  const keywordValues = [
    ...(Array.isArray(profile?.sourceVideo?.keywords) ? profile.sourceVideo.keywords : []),
    ...summaries.flatMap((video) => Array.isArray(video.keywords) ? video.keywords : []),
  ];
  keywordValues.forEach(add);
  const texts = [
    profile?.description,
    profile?.sourceVideo?.description,
    ...(Array.isArray(profile?.videoTitles) ? profile.videoTitles : []),
    ...summaries.flatMap((video) => [video.title, video.description]),
  ].filter(Boolean);
  for (const text of texts) {
    for (const match of String(text).matchAll(/#([\p{L}\p{N}_ー]{2,28})/gu)) add(match[1]);
    for (const match of String(text).matchAll(/[【「『]([^】」』]{2,28})[】」』]/gu)) add(match[1]);
    String(text).replace(/https?:\/\/\S+/g, ' ').split(/[\s|｜/／:：!?！？。、,，()（）\[\]【】「」『』]+/u).forEach(add);
    if (found.length >= 16) break;
  }
  return found.slice(0, 16);
}

function shortYouTubeLabel(value) {
  const text = cleanYouTubeText(value);
  const characters = [...text];
  return characters.length > 48 ? `${characters.slice(0, 47).join('')}…` : text;
}

function normalizeYouTubeOptions(options) {
  const normalized = [...new Set((options || []).map((option) => String(option || '').trim()).filter(Boolean))];
  for (const fallback of ['その他', 'どれも同じくらい', 'まだわからない', '特に決めていない', '別の答え']) {
    if (normalized.length >= 5) break;
    if (!normalized.includes(fallback)) normalized.push(fallback);
  }
  return normalized.slice(0, 5);
}

function extractMeta(html, property) {
  return extractTagContent(html, `property=["']${escapeRegExp(property)}["']`);
}

function extractNamedMeta(html, name) {
  return extractTagContent(html, `name=["']${escapeRegExp(name)}["']`);
}

function extractTagContent(html, marker) {
  const first = new RegExp(`<meta[^>]*${marker}[^>]*content=["']([^"']*)["'][^>]*>`, 'i').exec(html);
  if (first) return decodeHtml(first[1]);
  const second = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${marker}[^>]*>`, 'i').exec(html);
  return second ? decodeHtml(second[1]) : '';
}

function extractHtmlTitle(html) {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? decodeHtml(match[1]).replace(/\s*-\s*YouTube\s*$/i, '') : '';
}

export function extractYouTubeVideoSource(html) {
  const channelId = extractYouTubeChannelId(html);
  const ownerProfileUrl = decodeYouTubeJsonValue(firstMatch(html, [
    /"ownerProfileUrl":"((?:\\.|[^"\\])*)"/,
    /"vanityChannelUrl":"((?:\\.|[^"\\])*)"/,
  ]));
  const normalizedOwnerUrl = normalizeYouTubeChannelUrl(ownerProfileUrl.replace(/^http:/i, 'https:'));
  const channelUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : normalizedOwnerUrl;
  const channelName = decodeYouTubeJsonValue(firstMatch(html, [
    /"ownerChannelName":"((?:\\.|[^"\\])*)"/,
    /"videoDetails":\{[\s\S]{0,12000}?"author":"((?:\\.|[^"\\])*)"/,
  ]));
  const keywordsMatch = /"videoDetails":\{[\s\S]{0,16000}?"keywords":(\[(?:"(?:\\.|[^"\\])*",?)*\])/.exec(html);
  let keywords = [];
  try { keywords = keywordsMatch ? JSON.parse(keywordsMatch[1]).map(cleanYouTubeText).filter(Boolean).slice(0, 20) : []; } catch (error) { keywords = []; }
  return {
    title: cleanYouTubeText(extractMeta(html, 'og:title') || extractHtmlTitle(html)),
    description: cleanYouTubeText(extractMeta(html, 'og:description') || extractNamedMeta(html, 'description')).slice(0, 1200),
    keywords,
    channelName: cleanChannelName(channelName),
    channelUrl,
    channelId,
  };
}

function extractYouTubeChannelId(html) {
  return firstMatch(html, [
    /"videoDetails":\{[\s\S]{0,12000}?"channelId":"(UC[A-Za-z0-9_-]+)"/,
    /"externalChannelId":"(UC[A-Za-z0-9_-]+)"/,
    /"externalId":"(UC[A-Za-z0-9_-]+)"/,
    /"channelId":"(UC[A-Za-z0-9_-]+)"/,
    /"browseId":"(UC[A-Za-z0-9_-]+)"/,
    /itemprop=["']channelId["'][^>]*content=["'](UC[A-Za-z0-9_-]+)["']/i,
  ]);
}

export function extractYouTubeFeedVideos(xml) {
  const videos = [];
  for (const entry of String(xml || '').matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const block = entry[1];
    const videoId = cleanYouTubeText(firstMatch(block, [/<yt:videoId>([^<]+)<\/yt:videoId>/i]));
    const title = cleanYouTubeText(firstMatch(block, [/<media:title>([\s\S]*?)<\/media:title>/i, /<title>([\s\S]*?)<\/title>/i]));
    const description = cleanYouTubeText(firstMatch(block, [/<media:description>([\s\S]*?)<\/media:description>/i])).slice(0, 1200);
    if (title) videos.push({ videoId, title, description, keywords: [] });
  }
  return videos;
}

function extractYouTubeVideoEntries(html) {
  const found = [];
  const rendererPatterns = [
    /"videoRenderer":\{"videoId":"([^"]+)"[\s\S]{0,2600}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g,
    /"gridVideoRenderer":\{"videoId":"([^"]+)"[\s\S]{0,2600}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g,
  ];
  for (const pattern of rendererPatterns) {
    for (const match of html.matchAll(pattern)) addYouTubeVideo(found, match[1], match[2]);
  }
  if (!found.length) {
    const fallbackPattern = /"videoId":"([A-Za-z0-9_-]{6,15})"[\s\S]{0,2600}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g;
    for (const match of html.matchAll(fallbackPattern)) addYouTubeVideo(found, match[1], match[2]);
  }
  return found;
}

function addYouTubeVideo(found, videoId, encodedTitle) {
  const title = cleanYouTubeText(decodeYouTubeJsonValue(encodedTitle));
  const looksLikeNavigation = /^(ショート|ホーム|動画|ライブ|再生リスト|コミュニティ|キーボード ショートカット)$/i.test(title)
    || /のYouTube$/i.test(title);
  if (!looksLikeNavigation && title.length >= 4 && title.length <= 100 && !found.some((video) => video.title === title)) {
    found.push({ videoId, title, description: '', keywords: [] });
  }
}

function mergeYouTubeVideos(...collections) {
  const merged = [];
  for (const video of collections.flat()) {
    const title = cleanYouTubeText(video && video.title);
    if (!title) continue;
    const existing = merged.find((item) => (video.videoId && item.videoId === video.videoId) || item.title === title);
    if (existing) {
      if (!existing.description && video.description) existing.description = cleanYouTubeText(video.description).slice(0, 1200);
      existing.keywords = [...new Set([...(existing.keywords || []), ...(video.keywords || [])])].slice(0, 20);
      continue;
    }
    merged.push({
      videoId: cleanYouTubeText(video.videoId || ''),
      title,
      description: cleanYouTubeText(video.description || '').slice(0, 1200),
      keywords: Array.isArray(video.keywords) ? video.keywords.map(cleanYouTubeText).filter(Boolean).slice(0, 20) : [],
    });
  }
  return merged;
}

function firstMatch(value, patterns) {
  const input = String(value || '');
  for (const pattern of patterns) {
    const match = pattern.exec(input);
    if (match) return match[1] || '';
  }
  return '';
}

function decodeYouTubeJsonValue(value) {
  if (!value) return '';
  try { return JSON.parse(`"${value}"`); } catch (error) { return String(value).replace(/\\\//g, '/'); }
}

function cleanYouTubeText(value) {
  return decodeHtml(String(value || '').replace(/^<!\[CDATA\[|\]\]>$/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanChannelName(value) {
  return decodeHtml(value).replace(/\s*-\s*YouTube\s*$/i, '').trim().slice(0, 80) || 'YouTubeチャンネル';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireLiveGame(env, code, options = {}) {
  if (!LIVE_CODE_PATTERN.test(code)) throw liveError('room-not-found', 404);
  const game = await getStoredLiveGame(env, code, options);
  if (!game) throw liveError('room-not-found', 404);
  return game;
}

async function ensureLiveD1(env) {
  if (!env.REMOTE_DB) return false;
  if (!liveD1ReadyPromise) {
    liveD1ReadyPromise = Promise.all([
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_games (
          code TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_participants (
          code TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          participant_token TEXT NOT NULL,
          name TEXT NOT NULL,
          joined_at INTEGER NOT NULL,
          PRIMARY KEY (code, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_votes (
          code TEXT NOT NULL,
          question_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          option_index INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (code, question_id, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_rate_limits (
          rate_key TEXT PRIMARY KEY,
          window_start INTEGER NOT NULL,
          request_count INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_reservations (
          code TEXT PRIMARY KEY,
          scheduled_at INTEGER NOT NULL,
          blocked_from INTEGER NOT NULL,
          blocked_until INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_active_sessions (
          lock_key TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          started_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
    ]).then(() => env.REMOTE_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_live_participants_token
      ON live_participants (code, participant_token)
    `).run()).catch((error) => {
      liveD1ReadyPromise = null;
      throw error;
    });
  }
  await liveD1ReadyPromise;
  return true;
}

async function getStoredLiveGame(env, code, options = {}) {
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare('SELECT payload, expires_at FROM live_games WHERE code = ?').bind(code).first();
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) {
      await env.REMOTE_DB.prepare('DELETE FROM live_games WHERE code = ?').bind(code).run();
      return null;
    }
    const game = JSON.parse(row.payload);
    if (options.baseOnly) return { ...game, participants: [], votes: {} };
    if (options.polling) return loadD1PollingSnapshot(env, code, game, options.participantToken);
    const [participantsResult, votesResult] = await Promise.all([
      env.REMOTE_DB.prepare(`
        SELECT participant_id, participant_token, name, joined_at
        FROM live_participants WHERE code = ? ORDER BY joined_at ASC
      `).bind(code).all(),
      env.REMOTE_DB.prepare(`
        SELECT question_id, participant_id, option_index
        FROM live_votes WHERE code = ?
      `).bind(code).all(),
    ]);
    game.participants = (participantsResult.results || []).map((item) => ({
      id: item.participant_id,
      token: item.participant_token,
      name: item.name,
      joinedAt: Number(item.joined_at),
    }));
    game.votes = {};
    for (const item of votesResult.results || []) {
      game.votes[item.question_id] = {
        ...(game.votes[item.question_id] || {}),
        [item.participant_id]: Number(item.option_index),
      };
    }
    return game;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const game = kv ? await kv.get(`live:${code}`, { type: 'json' }) : null;
  if (options.baseOnly && game) return { ...game, participants: [], votes: {} };
  return options.polling ? createPollingSnapshot(game, options.participantToken) : game;
}

async function loadD1PollingSnapshot(env, code, game, participantToken) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const participantVoteQuery = game.phase === 'complete' && participantToken
    ? env.REMOTE_DB.prepare(`
        SELECT v.question_id, v.option_index, p.participant_id
        FROM live_votes v
        INNER JOIN live_participants p
          ON p.code = v.code AND p.participant_id = v.participant_id
        WHERE v.code = ? AND p.participant_token = ?
      `).bind(code, participantToken).all()
    : Promise.resolve({ results: [] });
  const currentSummaryQuery = game.phase !== 'complete' && question
    ? env.REMOTE_DB.prepare(`
        SELECT v.option_index, COUNT(*) AS vote_count,
          MAX(CASE WHEN p.participant_token = ? THEN v.option_index ELSE NULL END) AS my_vote_index
        FROM live_votes v
        LEFT JOIN live_participants p
          ON p.code = v.code AND p.participant_id = v.participant_id
        WHERE v.code = ? AND v.question_id = ?
        GROUP BY v.option_index
        ORDER BY v.option_index
      `).bind(participantToken || '', code, question.id).all()
    : Promise.resolve({ results: [] });
  const [participantsResult, currentSummaryResult, participantVotesResult] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT participant_id, participant_token, name, joined_at
      FROM live_participants WHERE code = ? ORDER BY joined_at ASC
    `).bind(code).all(),
    currentSummaryQuery,
    participantVoteQuery,
  ]);
  game.participants = (participantsResult.results || []).map((item) => ({
    id: item.participant_id,
    token: item.participant_token,
    name: item.name,
    joinedAt: Number(item.joined_at),
  }));
  game.votes = {};
  if (game.phase === 'complete') {
    for (const item of participantVotesResult.results || []) {
      game.votes[item.question_id] = {
        ...(game.votes[item.question_id] || {}),
        [item.participant_id]: Number(item.option_index),
      };
    }
    game.currentVoteCounts = resultVoteCounts(game, question);
    return game;
  }
  game.currentVoteCounts = question ? question.options.map(() => 0) : [];
  let myVoteIndex = null;
  for (const item of currentSummaryResult.results || []) {
    const optionIndex = Number(item.option_index);
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < game.currentVoteCounts.length) {
      game.currentVoteCounts[optionIndex] = Math.max(0, Number(item.vote_count) || 0);
    }
    if (item.my_vote_index !== null && item.my_vote_index !== undefined) myVoteIndex = Number(item.my_vote_index);
  }
  const participant = participantToken ? game.participants.find((item) => item.token === participantToken) : null;
  if (question && participant && Number.isInteger(myVoteIndex)) {
    game.votes[question.id] = { [participant.id]: myVoteIndex };
  }
  return game;
}

function createPollingSnapshot(game, participantToken) {
  if (!game) return game;
  const question = game.questions[game.currentQuestionIndex] || null;
  const allVotes = game.votes || {};
  const participant = participantToken ? game.participants.find((item) => item.token === participantToken) : null;
  const snapshotVotes = {};
  if (game.phase === 'complete' && participant) {
    for (const [questionId, votes] of Object.entries(allVotes)) {
      if (Object.prototype.hasOwnProperty.call(votes, participant.id)) snapshotVotes[questionId] = { [participant.id]: votes[participant.id] };
    }
  } else if (question && participant && Object.prototype.hasOwnProperty.call(allVotes[question.id] || {}, participant.id)) {
    snapshotVotes[question.id] = { [participant.id]: allVotes[question.id][participant.id] };
  }
  return {
    ...game,
    votes: snapshotVotes,
    currentVoteCounts: game.phase === 'complete'
      ? resultVoteCounts(game, question)
      : question?.options.map((_, optionIndex) => Object.values(allVotes[question.id] || {}).filter((value) => Number(value) === optionIndex).length) || [],
  };
}

function resultVoteCounts(game, question) {
  if (!question) return [];
  const result = (game.results || []).find((item) => item.questionId === question.id);
  return question.options.map((_, optionIndex) => Math.max(0, Number(result?.options?.[optionIndex]?.count) || 0));
}

async function loadLiveParticipant(env, code, participantToken) {
  if (!participantToken) return null;
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT participant_id, participant_token, name, joined_at
      FROM live_participants
      WHERE code = ? AND participant_token = ?
      LIMIT 1
    `).bind(code, participantToken).first();
    return row ? {
      id: row.participant_id,
      token: row.participant_token,
      name: row.name,
      joinedAt: Number(row.joined_at),
    } : null;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const game = kv ? await kv.get(`live:${code}`, { type: 'json' }) : null;
  return game?.participants?.find((item) => item.token === participantToken) || null;
}

async function enrichRealtimeGame(env, code, game, access = {}) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const participantPromise = access.participantToken
    ? loadLiveParticipant(env, code, access.participantToken)
    : Promise.resolve(null);
  const hostParticipantsPromise = access.host && env.REMOTE_DB
    ? env.REMOTE_DB.prepare(`
        SELECT participant_id, participant_token, name, joined_at
        FROM live_participants
        WHERE code = ?
        ORDER BY joined_at ASC
        LIMIT 100
      `).bind(code).all()
    : Promise.resolve({ results: [] });
  const [stats, participant, hostParticipants] = await Promise.all([
    loadLiveRealtimeStats(env, code, question),
    participantPromise,
    hostParticipantsPromise,
  ]);
  game.participantCount = Number(stats?.participantCount) || 0;
  game.participantLimit = liveViewerLimit(env);
  game.realtime = true;
  game.currentVoteCounts = question
    ? (stats?.voteCounts || question.options.map(() => 0))
    : [];
  game.participants = (hostParticipants.results || []).map((item) => ({
    id: item.participant_id,
    token: item.participant_token,
    name: item.name,
    joinedAt: Number(item.joined_at),
  }));
  if (participant && !game.participants.some((item) => item.id === participant.id)) game.participants.push(participant);
  game.votes = {};
  if (participant) {
    const answers = await loadLiveRealtimeParticipantVotes(env, code, participant.token, participant.id);
    for (const [questionId, optionIndex] of Object.entries(answers)) {
      game.votes[questionId] = { [participant.id]: Number(optionIndex) };
    }
  }
  return game;
}

async function broadcastCurrentRealtimeState(env, code, game) {
  if (!hasLiveRealtime(env)) return;
  const question = game.questions[game.currentQuestionIndex] || null;
  const stats = await loadLiveRealtimeStats(env, code, question);
  game.participantCount = Number(stats?.participantCount) || Number(game.participantCount) || 0;
  game.participantLimit = liveViewerLimit(env);
  game.realtime = true;
  game.currentVoteCounts = question
    ? (stats?.voteCounts || game.currentVoteCounts || question.options.map(() => 0))
    : [];
  const publicState = publicLiveGame(game, {});
  publicState.participants = [];
  publicState.realtimeExpiresAt = Number(game.expiresAt) || Date.now() + LIVE_ACTIVE_TTL_SECONDS * 1000;
  await broadcastLiveRealtimeState(env, code, publicState);
}

async function putStoredLiveGame(env, code, game) {
  if (await ensureLiveD1(env)) {
    const { participants, votes, ...storedGame } = game;
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_games (code, payload, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at, expires_at = excluded.expires_at
    `).bind(code, JSON.stringify(storedGame), game.createdAt, game.updatedAt, game.expiresAt).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  if (!kv) throw liveError('live-storage-not-configured', 500);
  const fallbackTtl = game.phase === 'lobby' ? LIVE_SAVED_TTL_SECONDS : LIVE_ACTIVE_TTL_SECONDS;
  const ttlSeconds = Math.max(60, Math.ceil((Number(game.expiresAt) - Date.now()) / 1000) || fallbackTtl);
  await kv.put(`live:${code}`, JSON.stringify(game), { expirationTtl: ttlSeconds });
}

async function cleanupExpiredLiveData(env) {
  const now = Date.now();
  if (!await ensureLiveD1(env)) {
    const kv = env.LIVE_KV || env.REMOTE_KV;
    if (!kv) return;
    const reservations = await getKvLiveReservations(kv);
    await kv.put('live:reservations', JSON.stringify(reservations.filter((item) => Number(item.expiresAt) >= now)));
    return;
  }
  await env.REMOTE_DB.prepare('DELETE FROM live_votes WHERE code IN (SELECT code FROM live_games WHERE expires_at < ?)').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_participants WHERE code IN (SELECT code FROM live_games WHERE expires_at < ?)').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_games WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_rate_limits WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_reservations WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_active_sessions WHERE expires_at < ?').bind(now).run();
}

async function isLiveSlotAvailable(env, scheduledAt) {
  const blockedFrom = scheduledAt - LIVE_RESERVATION_BUFFER_MS;
  const blockedUntil = scheduledAt + LIVE_RESERVATION_BUFFER_MS;
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT code FROM live_reservations
      WHERE scheduled_at > ? AND scheduled_at < ? AND expires_at >= ?
      LIMIT 1
    `).bind(blockedFrom, blockedUntil, Date.now()).first();
    return !row;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  return !reservations.some((item) => Math.abs(Number(item.scheduledAt) - scheduledAt) < LIVE_RESERVATION_BUFFER_MS);
}

async function reserveLiveSlot(env, code, scheduledAt, now) {
  const blockedFrom = scheduledAt - LIVE_RESERVATION_BUFFER_MS;
  const blockedUntil = scheduledAt + LIVE_RESERVATION_BUFFER_MS;
  if (await ensureLiveD1(env)) {
    const inserted = await env.REMOTE_DB.prepare(`
      INSERT INTO live_reservations (code, scheduled_at, blocked_from, blocked_until, created_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM live_reservations
        WHERE scheduled_at > ? AND scheduled_at < ? AND expires_at >= ?
      )
    `).bind(code, scheduledAt, blockedFrom, blockedUntil, now, blockedUntil, blockedFrom, blockedUntil, now).run();
    if (Number(inserted?.meta?.changes || 0) !== 1) throw liveError('live-slot-unavailable', 409);
    return { scheduledAt, blockedFrom, blockedUntil };
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  if (reservations.some((item) => Math.abs(Number(item.scheduledAt) - scheduledAt) < LIVE_RESERVATION_BUFFER_MS)) {
    throw liveError('live-slot-unavailable', 409);
  }
  reservations.push({ code, scheduledAt, blockedFrom, blockedUntil, createdAt: now, expiresAt: blockedUntil });
  await kv.put('live:reservations', JSON.stringify(reservations));
  return { scheduledAt, blockedFrom, blockedUntil };
}

async function releaseLiveReservation(env, code) {
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare('DELETE FROM live_reservations WHERE code = ?').bind(code).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  await kv.put('live:reservations', JSON.stringify(reservations.filter((item) => item.code !== code)));
}

async function acquireLiveActiveSlot(env, code, game) {
  const now = Date.now();
  const expiresAt = Math.min(
    Number(game.reservationEndsAt) || now + LIVE_ACTIVE_TTL_SECONDS * 1000,
    now + LIVE_ACTIVE_TTL_SECONDS * 1000,
  );
  if (await ensureLiveD1(env)) {
    const locked = await env.REMOTE_DB.prepare(`
      INSERT INTO live_active_sessions (lock_key, code, started_at, expires_at)
      VALUES ('global', ?, ?, ?)
      ON CONFLICT(lock_key) DO UPDATE SET
        code = excluded.code,
        started_at = excluded.started_at,
        expires_at = excluded.expires_at
      WHERE live_active_sessions.expires_at < excluded.started_at
         OR live_active_sessions.code = excluded.code
    `).bind(code, now, expiresAt).run();
    if (Number(locked?.meta?.changes || 0) !== 1) throw liveError('another-live-active', 409);
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const active = await kv.get('live:active', { type: 'json' });
  if (active && active.code !== code && Number(active.expiresAt) >= now) throw liveError('another-live-active', 409);
  await kv.put('live:active', JSON.stringify({ code, startedAt: now, expiresAt }), {
    expirationTtl: Math.max(60, Math.ceil((expiresAt - now) / 1000)),
  });
}

async function releaseLiveActiveSlot(env, code) {
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare('DELETE FROM live_active_sessions WHERE lock_key = ? AND code = ?').bind('global', code).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const active = await kv.get('live:active', { type: 'json' });
  if (active?.code === code) await kv.delete('live:active');
}

async function getKvLiveReservations(kv) {
  if (!kv) return [];
  const value = await kv.get('live:reservations', { type: 'json' });
  return Array.isArray(value) ? value : [];
}

async function enforceLiveRateLimit(request, env, scope, limit) {
  if (!env.REMOTE_DB) return;
  if (!liveRateLimitReadyPromise) {
    liveRateLimitReadyPromise = env.REMOTE_DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_rate_limits (
        rate_key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run().catch((error) => {
      liveRateLimitReadyPromise = null;
      throw error;
    });
  }
  await liveRateLimitReadyPromise;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `live:${scope}:${ipHash}`;
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      window_start = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.window_start ELSE excluded.window_start END,
      request_count = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.request_count + 1 ELSE 1 END,
      expires_at = excluded.expires_at
  `).bind(key, windowStart, windowStart + windowMs * 2).run();
  const row = await env.REMOTE_DB.prepare('SELECT request_count FROM live_rate_limits WHERE rate_key = ?').bind(key).first();
  if (Number(row && row.request_count || 0) > limit) throw liveError('rate-limit-exceeded', 429);
}

function touchLiveGame(game) {
  game.updatedAt = Date.now();
  const ttlSeconds = game.phase === 'lobby' ? LIVE_SAVED_TTL_SECONDS : LIVE_ACTIVE_TTL_SECONDS;
  game.expiresAt = Math.min(
    game.updatedAt + ttlSeconds * 1000,
    Number(game.reservationEndsAt) || Number.POSITIVE_INFINITY,
  );
}

function createLiveCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join('');
}

function createLiveToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeToken(value) {
  const token = String(value || '').trim();
  return /^[a-f0-9]{20,96}$/i.test(token) ? token : '';
}

async function readLiveJson(request) {
  try { return await request.json(); } catch (error) { return {}; }
}

function liveError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function liveJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' },
  });
}
