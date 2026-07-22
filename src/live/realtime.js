import {
  LIVE_FALLBACK_VIEWER_LIMIT,
  LIVE_REALTIME_SHARD_CAPACITY,
  LIVE_REALTIME_SHARD_COUNT,
  LIVE_VIEWER_LIMIT,
} from './config.js';

const INTERNAL_ORIGIN = 'https://live.internal';
const LIVE_PROTOCOL = 'live-v1';

export function hasLiveRealtime(env) {
  return Boolean(env?.LIVE_ROOM_COORDINATOR && env?.LIVE_VOTE_SHARD);
}

export function liveViewerLimit(env) {
  if (!hasLiveRealtime(env)) return LIVE_FALLBACK_VIEWER_LIMIT;
  const configuredLimit = Number(env?.LIVE_OPERATIONAL_VIEWER_LIMIT);
  if (!Number.isFinite(configuredLimit)) return LIVE_FALLBACK_VIEWER_LIMIT;
  return Math.min(LIVE_VIEWER_LIMIT, Math.max(1, Math.floor(configuredLimit)));
}

export function liveShardIndexForToken(token) {
  const normalized = String(token || '').replace(/[^a-f0-9]/gi, '').slice(0, 8);
  const value = Number.parseInt(normalized || '0', 16);
  return Number.isFinite(value) ? value % LIVE_REALTIME_SHARD_COUNT : 0;
}

export async function initializeLiveRealtime(env, code) {
  if (!hasLiveRealtime(env)) return false;
  await coordinatorStub(env, code).fetch(`${INTERNAL_ORIGIN}/initialize`, internalJson({ code }));
  return true;
}

export async function reserveLiveRealtimeParticipant(env, code, participantToken) {
  if (!hasLiveRealtime(env)) return null;
  const shardIndex = liveShardIndexForToken(participantToken);
  const response = await coordinatorStub(env, code).fetch(`${INTERNAL_ORIGIN}/reserve`, internalJson({
    code,
    shardIndex,
    viewerLimit: liveViewerLimit(env),
  }));
  const data = await response.json();
  if (!response.ok) throw realtimeError(data.error || 'participant-limit-reached', response.status);
  return { shardIndex, participantCount: Number(data.participantCount) || 0 };
}

export async function releaseLiveRealtimeParticipant(env, code, participantToken) {
  if (!hasLiveRealtime(env)) return;
  const shardIndex = liveShardIndexForToken(participantToken);
  await coordinatorStub(env, code).fetch(`${INTERNAL_ORIGIN}/release`, internalJson({ code, shardIndex }));
}

export async function connectLiveRealtime(request, env, code, participant) {
  if (!hasLiveRealtime(env)) throw realtimeError('live-realtime-unavailable', 503);
  const shardIndex = liveShardIndexForToken(participant.token);
  const headers = new Headers(request.headers);
  headers.set('x-live-internal-code', code);
  headers.set('x-live-internal-shard', String(shardIndex));
  headers.set('x-live-internal-participant-id', participant.id);
  headers.set('x-live-internal-participant-name', encodeURIComponent(participant.name));
  return voteShardStub(env, code, shardIndex).fetch(new Request(`${INTERNAL_ORIGIN}/connect`, {
    method: 'GET',
    headers,
  }));
}

export async function storeLiveRealtimeVote(env, code, participant, question, optionIndex) {
  if (!hasLiveRealtime(env)) return null;
  const shardIndex = liveShardIndexForToken(participant.token);
  const response = await voteShardStub(env, code, shardIndex).fetch(`${INTERNAL_ORIGIN}/vote`, internalJson({
    code,
    shardIndex,
    participantId: participant.id,
    questionId: question.id,
    optionIndex,
    optionCount: question.options.length,
  }));
  const data = await response.json();
  if (!response.ok) throw realtimeError(data.error || 'live-vote-error', response.status);
  return data;
}

export async function loadLiveRealtimeQuestionSnapshot(env, code, question) {
  if (!hasLiveRealtime(env)) return null;
  const response = await coordinatorStub(env, code).fetch(`${INTERNAL_ORIGIN}/question-snapshot`, internalJson({
    code,
    questionId: question.id,
    optionCount: question.options.length,
  }));
  if (!response.ok) throw realtimeError('live-realtime-snapshot-failed', 503);
  return response.json();
}

export async function loadLiveRealtimeParticipantVotes(env, code, participantToken, participantId) {
  if (!hasLiveRealtime(env)) return {};
  const shardIndex = liveShardIndexForToken(participantToken);
  const response = await voteShardStub(env, code, shardIndex).fetch(`${INTERNAL_ORIGIN}/participant-votes`, internalJson({
    participantId,
  }));
  if (!response.ok) return {};
  const data = await response.json();
  return data.votes && typeof data.votes === 'object' ? data.votes : {};
}

export async function loadLiveRealtimeStats(env, code, question) {
  if (!hasLiveRealtime(env)) return null;
  const url = new URL(`${INTERNAL_ORIGIN}/stats`);
  if (question) {
    url.searchParams.set('questionId', question.id);
    url.searchParams.set('optionCount', String(question.options.length));
  }
  const response = await coordinatorStub(env, code).fetch(url.toString(), internalJson({ code }, 'GET'));
  return response.ok ? response.json() : null;
}

export async function broadcastLiveRealtimeState(env, code, game) {
  if (!hasLiveRealtime(env)) return false;
  await coordinatorStub(env, code).fetch(`${INTERNAL_ORIGIN}/state`, internalJson({ code, game }));
  return true;
}

export function personalizeLiveRealtimeGame(game, answers = {}, participantName = '') {
  const personalized = structuredClone(game);
  const questionId = personalized?.question?.id;
  personalized.myVoteIndex = questionId && Number.isInteger(Number(answers[questionId]))
    ? Number(answers[questionId])
    : null;
  personalized.participantName = participantName || personalized.participantName;
  if (personalized.question?.result) {
    personalized.question.result = personalizeResult(personalized.question.result, answers);
  }
  if (Array.isArray(personalized.results)) {
    personalized.results = personalized.results.map((result) => personalizeResult(result, answers));
  }
  return personalized;
}

export class LiveRoomCoordinator {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/initialize' && request.method === 'POST') {
      const { code } = await request.json();
      await this.ctx.storage.put({ code, participantCount: 0 });
      return json({ initialized: true });
    }
    if (url.pathname === '/reserve' && request.method === 'POST') {
      const { code, shardIndex, viewerLimit } = await request.json();
      const operationalLimit = Math.min(
        LIVE_VIEWER_LIMIT,
        Math.max(1, Math.floor(Number(viewerLimit) || LIVE_FALLBACK_VIEWER_LIMIT)),
      );
      const result = await this.ctx.storage.transaction(async (storage) => {
        const participantCount = Number(await storage.get('participantCount')) || 0;
        const shardKey = `shard:${Number(shardIndex)}:count`;
        const shardCount = Number(await storage.get(shardKey)) || 0;
        if (participantCount >= operationalLimit || shardCount >= LIVE_REALTIME_SHARD_CAPACITY) return null;
        await storage.put({ code, participantCount: participantCount + 1, [shardKey]: shardCount + 1 });
        return participantCount + 1;
      });
      return result === null
        ? json({ error: 'participant-limit-reached' }, 409)
        : json({ participantCount: result });
    }
    if (url.pathname === '/release' && request.method === 'POST') {
      const { shardIndex } = await request.json();
      await this.ctx.storage.transaction(async (storage) => {
        const participantCount = Number(await storage.get('participantCount')) || 0;
        const shardKey = `shard:${Number(shardIndex)}:count`;
        const shardCount = Number(await storage.get(shardKey)) || 0;
        await storage.put({ participantCount: Math.max(0, participantCount - 1), [shardKey]: Math.max(0, shardCount - 1) });
      });
      return json({ released: true });
    }
    if (url.pathname === '/stats') {
      const participantCount = Number(await this.ctx.storage.get('participantCount')) || 0;
      const questionId = url.searchParams.get('questionId') || '';
      const optionCount = Math.max(0, Number(url.searchParams.get('optionCount')) || 0);
      const voteCounts = questionId
        ? normalizeCounts(await this.ctx.storage.get(`aggregate:${questionId}`), optionCount)
        : [];
      return json({ participantCount, voteCounts });
    }
    if (url.pathname === '/state' && request.method === 'POST') {
      const { code, game } = await request.json();
      const cleanupAt = Number(game?.realtimeExpiresAt) || Date.now() + 30 * 24 * 60 * 60 * 1000;
      await this.ctx.storage.put({ code, roomState: game, cleanupAt });
      await this.broadcastToShards(code, game);
      await scheduleDurableAlarm(this.ctx.storage, cleanupAt);
      return json({ broadcast: true });
    }
    if (url.pathname === '/counts' && request.method === 'POST') {
      const { code, shardIndex, questionId, counts } = await request.json();
      await this.ctx.storage.put({
        code,
        [`counts:${questionId}:${Number(shardIndex)}`]: normalizeCounts(counts, counts?.length || 0),
        pendingQuestionId: questionId,
      });
      await scheduleDurableAlarm(this.ctx.storage, Date.now() + 500);
      return json({ accepted: true });
    }
    if (url.pathname === '/question-snapshot' && request.method === 'POST') {
      const { code, questionId, optionCount } = await request.json();
      const snapshots = await Promise.all(Array.from({ length: LIVE_REALTIME_SHARD_COUNT }, async (_, shardIndex) => {
        const response = await voteShardStub(this.env, code, shardIndex).fetch(`${INTERNAL_ORIGIN}/snapshot`, internalJson({ questionId, optionCount }));
        return response.ok ? response.json() : { votes: {}, voteCounts: Array(optionCount).fill(0) };
      }));
      const votes = {};
      const voteCounts = Array(Number(optionCount) || 0).fill(0);
      for (const snapshot of snapshots) {
        Object.assign(votes, snapshot.votes || {});
        normalizeCounts(snapshot.voteCounts, voteCounts.length).forEach((count, index) => { voteCounts[index] += count; });
      }
      await this.ctx.storage.put(`aggregate:${questionId}`, voteCounts);
      return json({ votes, voteCounts });
    }
    return json({ error: 'not-found' }, 404);
  }

  async alarm() {
    const cleanupAt = Number(await this.ctx.storage.get('cleanupAt')) || 0;
    if (cleanupAt && cleanupAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      return;
    }
    const questionId = await this.ctx.storage.get('pendingQuestionId');
    const code = await this.ctx.storage.get('code');
    if (questionId && code) {
      const entries = await this.ctx.storage.list({ prefix: `counts:${questionId}:` });
      const roomState = await this.ctx.storage.get('roomState');
      const optionCount = roomState?.question?.id === questionId ? roomState.question.options.length : 5;
      const aggregate = Array(optionCount).fill(0);
      for (const counts of entries.values()) {
        normalizeCounts(counts, optionCount).forEach((count, index) => { aggregate[index] += count; });
      }
      await this.ctx.storage.put(`aggregate:${questionId}`, aggregate);
      await this.ctx.storage.delete('pendingQuestionId');
      if (roomState?.question?.id === questionId && Array.isArray(roomState.question.voteCounts)) {
        roomState.question.voteCounts = aggregate;
        roomState.question.voteCount = aggregate.reduce((total, count) => total + count, 0);
        await this.ctx.storage.put('roomState', roomState);
        await this.broadcastToShards(code, roomState);
      }
    }
    if (cleanupAt) await scheduleDurableAlarm(this.ctx.storage, cleanupAt);
  }

  async broadcastToShards(code, game) {
    await Promise.all(Array.from({ length: LIVE_REALTIME_SHARD_COUNT }, (_, shardIndex) => (
      voteShardStub(this.env, code, shardIndex).fetch(`${INTERNAL_ORIGIN}/broadcast`, internalJson({ code, shardIndex, game }))
    )));
  }
}

export class LiveVoteShard {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/connect') return this.connect(request);
    if (url.pathname === '/vote' && request.method === 'POST') {
      const body = await request.json();
      try {
        const result = await this.saveVote(body);
        return json(result);
      } catch (error) {
        return json({ error: error.message || 'live-vote-error' }, Number(error.status) || 500);
      }
    }
    if (url.pathname === '/snapshot' && request.method === 'POST') {
      const { questionId, optionCount } = await request.json();
      return json(await this.questionSnapshot(questionId, optionCount));
    }
    if (url.pathname === '/participant-votes' && request.method === 'POST') {
      const { participantId } = await request.json();
      return json({ votes: await this.ctx.storage.get(`participant:${participantId}:votes`) || {} });
    }
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const { code, shardIndex, game } = await request.json();
      const cleanupAt = Number(game?.realtimeExpiresAt) || Date.now() + 30 * 24 * 60 * 60 * 1000;
      await this.ctx.storage.put({ code, shardIndex: Number(shardIndex), roomState: game, cleanupAt });
      const message = JSON.stringify({ type: 'state', game: realtimeClientState(game) });
      for (const socket of this.ctx.getWebSockets()) {
        socket.send(message);
      }
      await scheduleDurableAlarm(this.ctx.storage, cleanupAt);
      return json({ broadcast: true });
    }
    return json({ error: 'not-found' }, 404);
  }

  async connect(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket-required' }, 426);
    const requestedProtocols = String(request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((item) => item.trim());
    if (!requestedProtocols.includes(LIVE_PROTOCOL)) return json({ error: 'websocket-protocol-required' }, 400);
    const participantId = request.headers.get('x-live-internal-participant-id') || '';
    const name = decodeURIComponent(request.headers.get('x-live-internal-participant-name') || '');
    if (!participantId) return json({ error: 'participant-forbidden' }, 403);
    const answers = await this.ctx.storage.get(`participant:${participantId}:votes`) || {};
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [participantId]);
    server.serializeAttachment({ participantId, name, answers });
    const game = await this.ctx.storage.get('roomState');
    server.send(JSON.stringify({
      type: 'ready',
      game: game ? realtimeClientState(game) : null,
      answers,
      participantName: name,
    }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': LIVE_PROTOCOL },
    });
  }

  async webSocketMessage(socket, message) {
    let body;
    try { body = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); } catch (error) { return; }
    if (body?.type !== 'vote') return;
    const attachment = socket.deserializeAttachment() || {};
    try {
      const roomState = await this.ctx.storage.get('roomState');
      if (roomState?.phase !== 'voting' || roomState?.question?.id !== body.questionId) throw realtimeError('question-changed', 409);
      const optionIndex = Number(body.optionIndex);
      if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= roomState.question.options.length) {
        throw realtimeError('invalid-option', 400);
      }
      await this.saveVote({
        code: await this.ctx.storage.get('code'),
        shardIndex: Number(await this.ctx.storage.get('shardIndex')) || 0,
        participantId: attachment.participantId,
        questionId: body.questionId,
        optionIndex,
        optionCount: roomState.question.options.length,
      });
      attachment.answers = { ...(attachment.answers || {}), [body.questionId]: optionIndex };
      socket.serializeAttachment(attachment);
      socket.send(JSON.stringify({ type: 'vote-accepted', questionId: body.questionId, optionIndex }));
    } catch (error) {
      socket.send(JSON.stringify({ type: 'vote-rejected', error: error.message || 'live-vote-error' }));
    }
  }

  async webSocketClose(socket, code, reason) {
    socket.close(code, reason);
  }

  async saveVote({ code, shardIndex, participantId, questionId, optionIndex, optionCount }) {
    if (!participantId || !questionId) throw realtimeError('invalid-vote', 400);
    const result = await this.ctx.storage.transaction(async (storage) => {
      const participantKey = `participant:${participantId}:votes`;
      const answers = await storage.get(participantKey) || {};
      if (Object.prototype.hasOwnProperty.call(answers, questionId)) throw realtimeError('already-voted', 409);
      const countKey = `question:${questionId}:counts`;
      const counts = normalizeCounts(await storage.get(countKey), optionCount);
      counts[optionIndex] += 1;
      await storage.put({
        code,
        shardIndex: Number(shardIndex),
        [participantKey]: { ...answers, [questionId]: optionIndex },
        [countKey]: counts,
        [`question:${questionId}:vote:${participantId}`]: optionIndex,
        pendingQuestionId: questionId,
      });
      return counts;
    });
    await scheduleDurableAlarm(this.ctx.storage, Date.now() + 500);
    return { accepted: true, voteCounts: result };
  }

  async questionSnapshot(questionId, optionCount) {
    const entries = await this.ctx.storage.list({ prefix: `question:${questionId}:vote:` });
    const votes = {};
    for (const [key, optionIndex] of entries) votes[key.split(':').pop()] = Number(optionIndex);
    const voteCounts = normalizeCounts(await this.ctx.storage.get(`question:${questionId}:counts`), optionCount);
    return { votes, voteCounts };
  }

  async alarm() {
    const cleanupAt = Number(await this.ctx.storage.get('cleanupAt')) || 0;
    if (cleanupAt && cleanupAt <= Date.now()) {
      for (const socket of this.ctx.getWebSockets()) socket.close(1001, 'expired');
      await this.ctx.storage.deleteAll();
      return;
    }
    const questionId = await this.ctx.storage.get('pendingQuestionId');
    const code = await this.ctx.storage.get('code');
    const shardIndex = Number(await this.ctx.storage.get('shardIndex')) || 0;
    if (questionId && code && hasLiveRealtime(this.env)) {
      const counts = await this.ctx.storage.get(`question:${questionId}:counts`) || [];
      await coordinatorStub(this.env, code).fetch(`${INTERNAL_ORIGIN}/counts`, internalJson({
        code,
        shardIndex,
        questionId,
        counts,
      }));
      await this.ctx.storage.delete('pendingQuestionId');
    }
    if (cleanupAt) await scheduleDurableAlarm(this.ctx.storage, cleanupAt);
  }
}

function personalizeResult(result, answers) {
  if (!result) return result;
  const hasVote = Object.prototype.hasOwnProperty.call(answers, result.questionId);
  const myVoteIndex = hasVote ? Number(answers[result.questionId]) : null;
  if (result.type === 'guess-person') {
    return { ...result, myVoteIndex, myIsCorrect: hasVote ? myVoteIndex === result.subjectAnswerIndex : null };
  }
  if (result.type === 'guess-majority') {
    return { ...result, myVoteIndex, myVoteWasPopular: hasVote ? result.popularIndices.includes(myVoteIndex) : null };
  }
  return { ...result, myVoteIndex };
}

function coordinatorStub(env, code) {
  const id = env.LIVE_ROOM_COORDINATOR.idFromName(`live:${code}`);
  return env.LIVE_ROOM_COORDINATOR.get(id);
}

function voteShardStub(env, code, shardIndex) {
  const id = env.LIVE_VOTE_SHARD.idFromName(`live:${code}:shard:${Number(shardIndex)}`);
  return env.LIVE_VOTE_SHARD.get(id);
}

function internalJson(body, method = 'POST') {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  };
}

function normalizeCounts(value, optionCount) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: Math.max(0, Number(optionCount) || 0) }, (_, index) => Math.max(0, Number(source[index]) || 0));
}

function realtimeClientState(game) {
  if (!game) return game;
  const state = { ...game };
  delete state.realtimeExpiresAt;
  return state;
}

async function scheduleDurableAlarm(storage, timestamp) {
  const current = await storage.getAlarm();
  if (current === null || Number(current) > Number(timestamp)) await storage.setAlarm(Number(timestamp));
}

function realtimeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' },
  });
}
