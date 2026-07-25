export const CHALLENGE_MAX_PARTICIPANTS = 50;
export const CHALLENGE_ROOM_TTL_DAYS = 30;
export const CHALLENGE_QUESTION_COUNT = 10;

const ROOM_TTL_MS = CHALLENGE_ROOM_TTL_DAYS * 24 * 60 * 60 * 1000;
const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TOKEN_PATTERN = /^[a-f0-9]{48}$/i;

export async function handleChallengeApi(request, env, path) {
  if (request.method === 'OPTIONS') return jsonResponse({});
  if (!env.REMOTE_DB && !env.REMOTE_KV) {
    return jsonResponse({ error: 'challenge-storage-not-configured' }, 500);
  }

  try {
    if (path === '/api/challenge/rooms' && request.method === 'POST') {
      return await createRoom(request, env);
    }

    if (path === '/api/challenge/library' && request.method === 'GET') {
      return await getQuestionLibrary(env);
    }

    const roomMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})$/);
    if (roomMatch && request.method === 'GET') {
      return await getPublicRoom(env, roomMatch[1]);
    }

    const manageMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/manage$/);
    if (manageMatch && request.method === 'GET') {
      return await getManageRoom(request, env, manageMatch[1]);
    }

    const rankingMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/ranking$/);
    if (rankingMatch && request.method === 'GET') {
      return await getRanking(env, rankingMatch[1]);
    }
    if (rankingMatch && request.method === 'POST') {
      return await registerRankingScore(request, env, rankingMatch[1]);
    }

    const retryMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/retry$/);
    if (retryMatch && request.method === 'POST') {
      return await retryChallenge(request, env, retryMatch[1]);
    }

    const joinMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/join$/);
    if (joinMatch && request.method === 'POST') {
      return await joinRoom(request, env, joinMatch[1]);
    }

    const answerMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/answer$/);
    if (answerMatch && request.method === 'POST') {
      return await submitAnswer(request, env, answerMatch[1]);
    }

    const submitMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/submit$/);
    if (submitMatch && request.method === 'POST') {
      return await submitAnswers(request, env, submitMatch[1]);
    }

    const resultMatch = path.match(/^\/api\/challenge\/rooms\/([A-Z2-9]{8})\/result$/);
    if (resultMatch && request.method === 'GET') {
      return await getResult(request, env, resultMatch[1]);
    }

    return jsonResponse({ error: 'not-found' }, 404);
  } catch (error) {
    return jsonResponse(
      { error: error && error.message ? error.message : 'challenge-api-error' },
      Number(error && error.status) || 500,
    );
  }
}

async function createRoom(request, env) {
  const body = await readJson(request);
  const creatorName = sanitizeName(body.creatorName, '出題者');
  const cards = sanitizeCards(body.cards);
  const answerKey = sanitizeAnswers(body.answers);
  if (cards.length !== CHALLENGE_QUESTION_COUNT || answerKey.length !== CHALLENGE_QUESTION_COUNT) {
    throw apiError('ten-questions-required', 400);
  }

  const now = Date.now();
  const room = {
    creatorName,
    cards,
    answerKey,
    manageToken: createToken(),
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createRoomCode();
    if (await insertRoom(env, code, room)) {
      return jsonResponse({
        code,
        manageToken: room.manageToken,
        room: publicRoom(code, room, 0, 0),
      }, 201);
    }
  }
  throw apiError('room-code-exhausted', 503);
}

async function getPublicRoom(env, code) {
  const record = await readRoom(env, code);
  if (!record) return jsonResponse({ error: 'room-not-found' }, 404);
  const counts = await participantCounts(env, code, record);
  return jsonResponse({ room: publicRoom(code, record, counts.total, counts.completed) });
}

async function getManageRoom(request, env, code) {
  const record = await readRoom(env, code);
  if (!record) return jsonResponse({ error: 'room-not-found' }, 404);
  const manageToken = headerToken(request, 'x-challenge-manage-token');
  if (!manageToken || !(await tokenMatches(manageToken, record.manageTokenHash || record.manageToken))) {
    return jsonResponse({ error: 'manage-forbidden' }, 403);
  }
  const counts = await participantCounts(env, code, record);
  const participants = await managedParticipants(env, code, record);
  return jsonResponse({
    room: publicRoom(code, record, counts.total, counts.completed),
    participants,
  });
}

async function getRanking(env, code) {
  const record = await readRoom(env, code);
  if (!record) return jsonResponse({ error: 'room-not-found' }, 404);
  const counts = await participantCounts(env, code, record);
  const participants = await rankedParticipants(env, code, record);
  return jsonResponse({
    room: {
      code,
      creatorName: record.creatorName,
      completedParticipants: counts.completed,
      maxParticipants: CHALLENGE_MAX_PARTICIPANTS,
      expiresAt: record.expiresAt,
    },
    participants,
  });
}

async function getQuestionLibrary(env) {
  const questions = await popularQuestions(env);
  return jsonResponse({ questions });
}

async function joinRoom(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);

  const existingToken = headerToken(request, 'x-challenge-participant-token');
  if (existingToken) {
    const participant = await readParticipant(env, code, existingToken, room);
    if (participant) {
      return jsonResponse({
        participantToken: existingToken,
        participant: publicParticipant(participant),
      });
    }
  }

  const body = await readJson(request);
  const name = sanitizeName(body.name, '');
  if (!name) return jsonResponse({ error: 'name-required' }, 400);
  const participantToken = createToken();
  const participant = {
    id: createToken().slice(0, 24),
    token: participantToken,
    name,
    answers: null,
    score: null,
    createdAt: Date.now(),
    completedAt: null,
    rankingConsentAt: null,
  };
  const inserted = await insertParticipant(env, code, participant, room);
  if (!inserted) return jsonResponse({ error: 'room-full', maxParticipants: CHALLENGE_MAX_PARTICIPANTS }, 409);
  return jsonResponse({
    participantToken,
    participant: publicParticipant(participant),
  }, 201);
}

async function registerRankingScore(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
  const token = headerToken(request, 'x-challenge-participant-token');
  if (!token) return jsonResponse({ error: 'participant-forbidden' }, 403);
  const participant = await readParticipant(env, code, token, room);
  if (!participant) return jsonResponse({ error: 'participant-forbidden' }, 403);
  if (participant.completedAt == null || !Number.isInteger(participant.score)) {
    return jsonResponse({ error: 'answers-not-submitted' }, 409);
  }

  const registeredAt = participant.rankingConsentAt || Date.now();
  const saved = participant.rankingConsentAt != null
    || await saveRankingRegistration(env, code, token, registeredAt, room);
  if (!saved) return jsonResponse({ error: 'ranking-registration-failed' }, 409);
  return jsonResponse({
    participant: publicParticipant({ ...participant, rankingConsentAt: registeredAt }),
    rank: await participantRank(env, code, participant.score, room),
  });
}

async function retryChallenge(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
  const token = headerToken(request, 'x-challenge-participant-token');
  if (!token) return jsonResponse({ error: 'participant-forbidden' }, 403);
  const participant = await readParticipant(env, code, token, room);
  if (!participant) return jsonResponse({ error: 'participant-forbidden' }, 403);
  if (participant.completedAt == null) {
    return jsonResponse({ error: 'answers-not-submitted' }, 409);
  }

  const saved = await resetParticipantAttempt(env, code, token, room);
  if (!saved) return jsonResponse({ error: 'retry-failed' }, 409);
  return jsonResponse({
    participant: publicParticipant({
      ...participant,
      answers: null,
      score: null,
      completedAt: null,
      rankingConsentAt: null,
    }),
  });
}

async function submitAnswer(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
  const token = headerToken(request, 'x-challenge-participant-token');
  if (!token) return jsonResponse({ error: 'participant-forbidden' }, 403);
  const participant = await readParticipant(env, code, token, room);
  if (!participant) return jsonResponse({ error: 'participant-forbidden' }, 403);

  const body = await readJson(request);
  const questionIndex = Number(body.questionIndex);
  const choice = Number(body.choice);
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= CHALLENGE_QUESTION_COUNT) {
    return jsonResponse({ error: 'invalid-question-index' }, 400);
  }
  if (!Number.isInteger(choice) || choice < 0 || choice >= 5) {
    return jsonResponse({ error: 'invalid-answer' }, 400);
  }

  const previousAnswers = Array.isArray(participant.answers) ? participant.answers.slice() : [];
  if (questionIndex < previousAnswers.length) {
    if (previousAnswers[questionIndex] !== choice) {
      return jsonResponse({ error: 'answer-already-submitted' }, 409);
    }
    return jsonResponse(answerProgress(room, participant, questionIndex));
  }
  if (participant.completedAt != null) {
    return jsonResponse({ error: 'answers-already-submitted' }, 409);
  }
  if (questionIndex !== previousAnswers.length) {
    return jsonResponse({ error: 'answer-out-of-order' }, 409);
  }

  const answers = [...previousAnswers, choice];
  const score = answers.reduce((total, answer, index) => (
    total + (answer === room.answerKey[index] ? 1 : 0)
  ), 0);
  const completedAt = answers.length === CHALLENGE_QUESTION_COUNT ? Date.now() : null;
  const saved = await saveParticipantProgress(
    env,
    code,
    token,
    previousAnswers,
    answers,
    score,
    completedAt,
    room,
  );
  if (!saved) {
    const currentRoom = await readRoom(env, code);
    const current = currentRoom
      ? await readParticipant(env, code, token, currentRoom)
      : null;
    if (current && Array.isArray(current.answers) && current.answers[questionIndex] === choice) {
      return jsonResponse(answerProgress(room, current, questionIndex));
    }
    return jsonResponse({ error: 'answer-already-submitted' }, 409);
  }

  const updatedParticipant = { ...participant, answers, score, completedAt };
  if (completedAt != null) {
    await recordQuestionPlays(env, room.cards, completedAt).catch(() => {});
  }
  return jsonResponse(answerProgress(room, updatedParticipant, questionIndex));
}

function answerProgress(room, participant, questionIndex) {
  const answers = Array.isArray(participant.answers) ? participant.answers : [];
  const completed = participant.completedAt != null && answers.length === CHALLENGE_QUESTION_COUNT;
  return {
    questionIndex,
    match: answers[questionIndex] === room.answerKey[questionIndex],
    completed,
    score: Number.isInteger(participant.score) ? participant.score : null,
    nextQuestionIndex: completed ? null : answers.length,
  };
}

async function submitAnswers(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
  const token = headerToken(request, 'x-challenge-participant-token');
  if (!token) return jsonResponse({ error: 'participant-forbidden' }, 403);
  const participant = await readParticipant(env, code, token, room);
  if (!participant) return jsonResponse({ error: 'participant-forbidden' }, 403);
  if (participant.completedAt != null) {
    return jsonResponse({ error: 'answers-already-submitted' }, 409);
  }
  if (Array.isArray(participant.answers) && participant.answers.length > 0) {
    return jsonResponse({ error: 'answers-already-started' }, 409);
  }

  const body = await readJson(request);
  const answers = sanitizeAnswers(body.answers);
  if (answers.length !== CHALLENGE_QUESTION_COUNT) {
    return jsonResponse({ error: 'ten-answers-required' }, 400);
  }
  const score = answers.reduce((total, answer, index) => (
    total + (answer === room.answerKey[index] ? 1 : 0)
  ), 0);
  const completedAt = Date.now();
  const saved = await saveParticipantAnswers(env, code, token, participant, answers, score, completedAt, room);
  if (!saved) return jsonResponse({ error: 'answers-already-submitted' }, 409);
  await recordQuestionPlays(env, room.cards, completedAt).catch(() => {});
  return jsonResponse({ score });
}

async function getResult(request, env, code) {
  const room = await readRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
  const token = headerToken(request, 'x-challenge-participant-token');
  if (!token) return jsonResponse({ error: 'participant-forbidden' }, 403);
  const participant = await readParticipant(env, code, token, room);
  if (!participant) return jsonResponse({ error: 'participant-forbidden' }, 403);
  if (participant.completedAt == null
    || !Array.isArray(participant.answers)
    || participant.answers.length !== CHALLENGE_QUESTION_COUNT
    || !Number.isInteger(participant.score)) {
    return jsonResponse({ error: 'answers-not-submitted' }, 409);
  }

  const rank = participant.rankingConsentAt != null
    ? await participantRank(env, code, participant.score, room)
    : null;
  const counts = await participantCounts(env, code, room);
  return jsonResponse({
    code,
    creatorName: room.creatorName,
    participant: publicParticipant(participant),
    score: participant.score,
    rank,
    completedParticipants: counts.completed,
    maxParticipants: CHALLENGE_MAX_PARTICIPANTS,
    answers: room.cards.map((card, index) => ({
      card,
      selected: participant.answers[index],
      correct: room.answerKey[index],
      match: participant.answers[index] === room.answerKey[index],
    })),
  });
}

function sanitizeCards(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, CHALLENGE_QUESTION_COUNT).map((card) => {
    const choices = Array.isArray(card && card.choices)
      ? card.choices.slice(0, 5).map((choice) => String(choice || '').trim().slice(0, 40))
      : [];
    const title = String(card && card.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title || choices.length !== 5 || choices.some((choice) => !choice)) {
      throw apiError('invalid-card', 400);
    }
    return {
      id: String(card && card.id || '').slice(0, 24),
      category: String(card && card.category || '').slice(0, 40),
      title,
      choices,
    };
  });
}

function sanitizeAnswers(value) {
  if (!Array.isArray(value)) return [];
  const answers = value.slice(0, CHALLENGE_QUESTION_COUNT).map(Number);
  return answers.length === CHALLENGE_QUESTION_COUNT
    && answers.every((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 4)
    ? answers
    : [];
}

function sanitizeName(value, fallback) {
  const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return text || fallback;
}

function publicRoom(code, room, total, completed) {
  return {
    code,
    creatorName: room.creatorName,
    cards: room.cards,
    participantCount: total,
    completedParticipants: completed,
    maxParticipants: CHALLENGE_MAX_PARTICIPANTS,
    full: total >= CHALLENGE_MAX_PARTICIPANTS,
    expiresAt: room.expiresAt,
  };
}

function publicParticipant(participant) {
  const submitted = participant.completedAt != null;
  return {
    name: participant.name,
    submitted,
    answerCount: Array.isArray(participant.answers) ? participant.answers.length : 0,
    score: submitted && Number.isInteger(participant.score) ? participant.score : null,
    rankingParticipating: participant.rankingConsentAt != null,
  };
}

async function ensureD1(env) {
  return Boolean(env.REMOTE_DB);
}

async function insertRoom(env, code, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      INSERT OR IGNORE INTO challenge_rooms
        (code, creator_name, cards_json, answer_key_json, manage_token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      code,
      room.creatorName,
      JSON.stringify(room.cards),
      JSON.stringify(room.answerKey),
      await hashToken(room.manageToken),
      room.createdAt,
      room.expiresAt,
    ).run();
    return Number(result?.meta?.changes || 0) === 1;
  }
  const key = `challenge:${code}`;
  if (await env.REMOTE_KV.get(key)) return false;
  await env.REMOTE_KV.put(key, JSON.stringify({ ...room, participants: [] }), {
    expirationTtl: CHALLENGE_ROOM_TTL_DAYS * 24 * 60 * 60,
  });
  return true;
}

async function readRoom(env, code) {
  const now = Date.now();
  if (await ensureD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT creator_name, cards_json, answer_key_json, manage_token_hash, created_at, expires_at
      FROM challenge_rooms WHERE code = ?
    `).bind(code).first();
    if (!row || Number(row.expires_at) <= now) return null;
    return {
      creatorName: row.creator_name,
      cards: JSON.parse(row.cards_json),
      answerKey: JSON.parse(row.answer_key_json),
      manageTokenHash: row.manage_token_hash,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
    };
  }
  const room = await env.REMOTE_KV.get(`challenge:${code}`, { type: 'json' });
  return room && Number(room.expiresAt) > now ? room : null;
}

async function insertParticipant(env, code, participant, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      INSERT INTO challenge_participants
        (room_code, participant_id, participant_token_hash, name, created_at, ranking_consent_at)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE (
        SELECT COUNT(*) FROM challenge_participants WHERE room_code = ?
      ) < ?
    `).bind(
      code,
      participant.id,
      await hashToken(participant.token),
      participant.name,
      participant.createdAt,
      participant.rankingConsentAt,
      code,
      CHALLENGE_MAX_PARTICIPANTS,
    ).run();
    return Number(result?.meta?.changes || 0) === 1;
  }
  const next = { ...room, participants: Array.isArray(room.participants) ? room.participants.slice() : [] };
  if (next.participants.length >= CHALLENGE_MAX_PARTICIPANTS) return false;
  next.participants.push(participant);
  await putKvRoom(env, code, next);
  return true;
}

async function readParticipant(env, code, token, room) {
  if (!TOKEN_PATTERN.test(token)) return null;
  if (await ensureD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT participant_id, name, answers_json, score, created_at, completed_at, ranking_consent_at
      FROM challenge_participants
      WHERE room_code = ? AND participant_token_hash = ?
    `).bind(code, await hashToken(token)).first();
    if (!row) return null;
    return {
      id: row.participant_id,
      name: row.name,
      answers: row.answers_json ? JSON.parse(row.answers_json) : null,
      score: row.score == null ? null : Number(row.score),
      createdAt: Number(row.created_at),
      completedAt: row.completed_at == null ? null : Number(row.completed_at),
      rankingConsentAt: row.ranking_consent_at == null ? null : Number(row.ranking_consent_at),
    };
  }
  return (room.participants || []).find((participant) => participant.token === token) || null;
}

async function saveParticipantAnswers(env, code, token, participant, answers, score, completedAt, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      UPDATE challenge_participants
      SET answers_json = ?, score = ?, completed_at = ?
      WHERE room_code = ? AND participant_token_hash = ?
        AND completed_at IS NULL AND answers_json IS NULL
    `).bind(JSON.stringify(answers), score, completedAt, code, await hashToken(token)).run();
    return Number(result?.meta?.changes || 0) === 1;
  }
  const next = { ...room, participants: (room.participants || []).map((item) => (
    item.token === token ? { ...item, answers, score, completedAt } : item
  )) };
  await putKvRoom(env, code, next);
  return true;
}

async function saveParticipantProgress(
  env,
  code,
  token,
  previousAnswers,
  answers,
  score,
  completedAt,
  room,
) {
  if (await ensureD1(env)) {
    const previousJson = previousAnswers.length > 0 ? JSON.stringify(previousAnswers) : null;
    const result = await env.REMOTE_DB.prepare(`
      UPDATE challenge_participants
      SET answers_json = ?, score = ?, completed_at = ?
      WHERE room_code = ? AND participant_token_hash = ? AND completed_at IS NULL
        AND ((answers_json IS NULL AND ? IS NULL) OR answers_json = ?)
    `).bind(
      JSON.stringify(answers),
      score,
      completedAt,
      code,
      await hashToken(token),
      previousJson,
      previousJson,
    ).run();
    return Number(result?.meta?.changes || 0) === 1;
  }

  const participants = Array.isArray(room.participants) ? room.participants : [];
  const index = participants.findIndex((item) => item.token === token);
  if (index < 0) return false;
  const current = participants[index];
  const currentAnswers = Array.isArray(current.answers) ? current.answers : [];
  if (current.completedAt != null || JSON.stringify(currentAnswers) !== JSON.stringify(previousAnswers)) {
    return false;
  }
  const nextParticipants = participants.slice();
  nextParticipants[index] = { ...current, answers, score, completedAt };
  await putKvRoom(env, code, { ...room, participants: nextParticipants });
  return true;
}

async function saveRankingRegistration(env, code, token, registeredAt, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      UPDATE challenge_participants
      SET ranking_consent_at = COALESCE(ranking_consent_at, ?)
      WHERE room_code = ? AND participant_token_hash = ? AND completed_at IS NOT NULL
    `).bind(registeredAt, code, await hashToken(token)).run();
    return Number(result?.meta?.changes || 0) === 1;
  }

  const participants = Array.isArray(room.participants) ? room.participants : [];
  const index = participants.findIndex((item) => item.token === token && item.completedAt != null);
  if (index < 0) return false;
  const nextParticipants = participants.slice();
  nextParticipants[index] = { ...participants[index], rankingConsentAt: registeredAt };
  await putKvRoom(env, code, { ...room, participants: nextParticipants });
  return true;
}

async function resetParticipantAttempt(env, code, token, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      UPDATE challenge_participants
      SET answers_json = NULL, score = NULL, completed_at = NULL, ranking_consent_at = NULL
      WHERE room_code = ? AND participant_token_hash = ? AND completed_at IS NOT NULL
    `).bind(code, await hashToken(token)).run();
    return Number(result?.meta?.changes || 0) === 1;
  }

  const participants = Array.isArray(room.participants) ? room.participants : [];
  const index = participants.findIndex((item) => item.token === token && item.completedAt != null);
  if (index < 0) return false;
  const nextParticipants = participants.slice();
  nextParticipants[index] = {
    ...participants[index],
    answers: null,
    score: null,
    completedAt: null,
    rankingConsentAt: null,
  };
  await putKvRoom(env, code, { ...room, participants: nextParticipants });
  return true;
}

async function participantCounts(env, code, room) {
  if (await ensureD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed
      FROM challenge_participants WHERE room_code = ?
    `).bind(code).first();
    return { total: Number(row?.total || 0), completed: Number(row?.completed || 0) };
  }
  const participants = room.participants || [];
  return {
    total: participants.length,
    completed: participants.filter((participant) => participant.completedAt != null).length,
  };
}

async function participantRank(env, code, score, room) {
  if (await ensureD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT COUNT(*) AS higher
      FROM challenge_participants
      WHERE room_code = ? AND completed_at IS NOT NULL
        AND ranking_consent_at IS NOT NULL AND score > ?
    `).bind(code, score).first();
    return Number(row?.higher || 0) + 1;
  }
  return (room.participants || []).filter((participant) => (
    participant.completedAt != null
    && participant.rankingConsentAt != null
    && Number(participant.score) > score
  )).length + 1;
}

async function rankedParticipants(env, code, room) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      SELECT name, score, completed_at
      FROM challenge_participants
      WHERE room_code = ? AND completed_at IS NOT NULL AND ranking_consent_at IS NOT NULL
      ORDER BY score DESC, completed_at ASC
      LIMIT ?
    `).bind(code, CHALLENGE_MAX_PARTICIPANTS).all();
    return addRanks((result?.results || []).map((row) => ({
      name: row.name,
      score: Number(row.score),
      completedAt: Number(row.completed_at),
    })));
  }
  return addRanks((room.participants || [])
    .filter((participant) => participant.completedAt != null && participant.rankingConsentAt != null)
    .sort((left, right) => Number(right.score) - Number(left.score)
      || Number(left.completedAt) - Number(right.completedAt))
    .map((participant) => ({
      name: participant.name,
      score: Number(participant.score),
      completedAt: Number(participant.completedAt),
    })));
}

async function managedParticipants(env, code, room) {
  let participants;
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      SELECT participant_id, name, answers_json, score, created_at, completed_at, ranking_consent_at
      FROM challenge_participants
      WHERE room_code = ?
      ORDER BY completed_at IS NULL, score DESC, completed_at ASC, created_at ASC
      LIMIT ?
    `).bind(code, CHALLENGE_MAX_PARTICIPANTS).all();
    participants = (result?.results || []).map((row) => ({
      id: row.participant_id,
      name: row.name,
      answers: row.answers_json ? JSON.parse(row.answers_json) : null,
      score: row.score == null ? null : Number(row.score),
      createdAt: Number(row.created_at),
      completedAt: row.completed_at == null ? null : Number(row.completed_at),
      rankingConsentAt: row.ranking_consent_at == null ? null : Number(row.ranking_consent_at),
    }));
  } else {
    participants = (room.participants || [])
      .slice()
      .sort((left, right) => {
        if (left.completedAt == null && right.completedAt != null) return 1;
        if (left.completedAt != null && right.completedAt == null) return -1;
        return Number(right.score || 0) - Number(left.score || 0)
          || Number(left.completedAt || left.createdAt) - Number(right.completedAt || right.createdAt);
      });
  }
  return participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    submitted: participant.completedAt != null,
    answerCount: Array.isArray(participant.answers) ? participant.answers.length : 0,
    score: participant.completedAt != null && Number.isInteger(participant.score)
      ? participant.score
      : null,
    rankingParticipating: participant.rankingConsentAt != null,
    completedAt: participant.completedAt,
    answers: Array.isArray(participant.answers)
      ? room.cards.map((card, index) => ({
        cardId: card.id,
        selected: participant.answers[index],
        correct: room.answerKey[index],
        match: participant.answers[index] === room.answerKey[index],
      }))
      : [],
  }));
}

function addRanks(participants) {
  let previousScore = null;
  let previousRank = 0;
  return participants.map((participant, index) => {
    const rank = participant.score === previousScore ? previousRank : index + 1;
    previousScore = participant.score;
    previousRank = rank;
    return { ...participant, rank };
  });
}

async function recordQuestionPlays(env, cards, playedAt) {
  if (await ensureD1(env)) {
    const statements = cards.map((card) => env.REMOTE_DB.prepare(`
      INSERT INTO challenge_question_stats
        (question_id, title, category, choices_json, play_count, last_played_at)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(question_id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        choices_json = excluded.choices_json,
        play_count = challenge_question_stats.play_count + 1,
        last_played_at = excluded.last_played_at
    `).bind(card.id, card.title, card.category, JSON.stringify(card.choices), playedAt));
    await env.REMOTE_DB.batch(statements);
    return;
  }
  const key = 'challenge:question-stats';
  const current = await env.REMOTE_KV.get(key, { type: 'json' }) || {};
  for (const card of cards) {
    const previous = current[card.id] || {};
    current[card.id] = {
      id: card.id,
      title: card.title,
      category: card.category,
      choices: card.choices,
      playCount: Number(previous.playCount || 0) + 1,
      lastPlayedAt: playedAt,
    };
  }
  await env.REMOTE_KV.put(key, JSON.stringify(current));
}

async function popularQuestions(env) {
  if (await ensureD1(env)) {
    const result = await env.REMOTE_DB.prepare(`
      SELECT question_id, title, category, choices_json, play_count, last_played_at
      FROM challenge_question_stats
      ORDER BY play_count DESC, last_played_at DESC
      LIMIT 50
    `).all();
    return (result?.results || []).map((row) => ({
      id: row.question_id,
      title: row.title,
      category: row.category,
      choices: JSON.parse(row.choices_json),
      playCount: Number(row.play_count),
      lastPlayedAt: Number(row.last_played_at),
    }));
  }
  const current = await env.REMOTE_KV.get('challenge:question-stats', { type: 'json' }) || {};
  return Object.values(current)
    .sort((left, right) => Number(right.playCount) - Number(left.playCount)
      || Number(right.lastPlayedAt) - Number(left.lastPlayedAt))
    .slice(0, 50);
}

async function putKvRoom(env, code, room) {
  await env.REMOTE_KV.put(`challenge:${code}`, JSON.stringify(room), {
    expirationTtl: CHALLENGE_ROOM_TTL_DAYS * 24 * 60 * 60,
  });
}

function createRoomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_CHARS[byte % ROOM_CODE_CHARS.length]).join('');
}

function createToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token) {
  if (!TOKEN_PATTERN.test(String(token || ''))) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function tokenMatches(rawToken, storedTokenOrHash) {
  if (!TOKEN_PATTERN.test(rawToken)) return false;
  if (TOKEN_PATTERN.test(storedTokenOrHash)) return rawToken === storedTokenOrHash;
  return (await hashToken(rawToken)) === storedTokenOrHash;
}

function headerToken(request, name) {
  const value = String(request.headers.get(name) || '').trim();
  return TOKEN_PATTERN.test(value) ? value : '';
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function apiError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}
