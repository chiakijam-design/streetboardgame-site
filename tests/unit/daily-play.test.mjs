import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleChallengeApi } from '../../src/challenge/api.js';
import { handleLiveApi } from '../../src/live/api.js';
import { LiveVoteShard } from '../../src/live/realtime.js';
import { playDayJst, flushRealtimePlayCounts } from '../../src/analytics/daily-play.js';
import { runPrivacyCleanup } from '../../src/privacy/cleanup.js';

const migration = readFileSync(new URL('../../migrations/0027_play_daily_counts.sql', import.meta.url), 'utf8');
function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0003_live_games', '0010_challenge_rooms', '0011_challenge_ranking_library', '0018_challenge_board_comments']) {
    db.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  db.exec(migration);
  return db;
}
function adapter(db) {
  return { prepare(sql) {
    const statement = db.prepare(sql);
    return { values: [], bind(...values) { this.values = values; return this; },
      async run() {
        // D1 includes trigger writes in meta.changes (verified in workerd).
        const before = db.prepare('SELECT total_changes() AS n').get().n;
        statement.run(...this.values);
        return { meta: { changes: db.prepare('SELECT total_changes() AS n').get().n - before } };
      },
      async first() { return statement.get(...this.values) || null; },
      async all() { return { results: statement.all(...this.values) }; },
    };
  } };
}
function storageMock(seed = {}) {
  const values = new Map(Object.entries(seed));
  let alarm = null;
  return {
    async get(key) { return structuredClone(values.get(key)); },
    async put(key, value) {
      for (const [k, v] of typeof key === 'string' ? [[key, value]] : Object.entries(key)) values.set(k, structuredClone(v));
    },
    async delete(key) { values.delete(key); },
    async deleteAll() { values.clear(); alarm = null; },
    async list({ prefix }) { return new Map([...values].filter(([key]) => key.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); },
    async transaction(fn) { return fn(this); },
    async getAlarm() { return alarm; },
    async setAlarm(time) { alarm = time; },
    values,
  };
}
function count(db, mode, metric) {
  return db.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM play_daily_counts WHERE mode = ? AND metric = ?').get(mode, metric).n;
}
function liveRoom(db, createdAt = Date.now()) {
  db.prepare('INSERT INTO live_games VALUES (?, ?, ?, ?, ?)').run('123456',
    JSON.stringify({ phase: 'lobby', questions: [{ id: 'q1' }, { id: 'q2' }] }), createdAt, createdAt, createdAt + 1000);
}

test('daily counts use JST, contain only day/mode/metric/count, and migration is idempotent', () => {
  const db = database();
  db.exec(migration);
  assert.equal(playDayJst(Date.parse('2026-09-30T15:00:00Z')), '2026-10-01');
  assert.equal(playDayJst(Date.parse('2026-09-30T14:59:59Z')), '2026-09-30');
  assert.deepEqual(db.prepare('PRAGMA table_info(play_daily_counts)').all().map((x) => x.name), ['day', 'mode', 'metric', 'count']);
  liveRoom(db, Date.parse('2026-09-30T15:00:00Z'));
  assert.equal(db.prepare('SELECT day FROM play_daily_counts').get().day, '2026-10-01');
  db.close();
});

test('normal API counts first answer, completion and retry without counting joins/result reloads as plays', async () => {
  const db = database();
  const env = { REMOTE_DB: adapter(db) };
  const post = async (path, body, headers = {}) => {
    const response = await handleChallengeApi(new Request(`https://example.com${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }), env, path);
    assert.ok(response.status < 300, await response.clone().text());
    return response.json();
  };
  const cards = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, title: 'question', choices: ['A', 'B', 'C', 'D', 'E'] }));
  const room = await post('/api/challenge/rooms', { creatorName: 'private-name', cards, answers: Array(10).fill(0) });
  const path = `/api/challenge/rooms/${room.code}`;
  const participant = await post(`${path}/join`, { name: 'private-person' });
  const headers = { 'x-challenge-participant-token': participant.participantToken };
  assert.equal(count(db, 'challenge', 'participants_joined'), 1);
  assert.equal(count(db, 'challenge', 'plays_started'), 0);
  await post(`${path}/join`, {}, headers);
  for (let i = 0; i < 10; i++) await post(`${path}/answer`, { questionIndex: i, choice: 0 }, headers);
  await post(`${path}/answer`, { questionIndex: 9, choice: 0 }, headers);
  assert.equal(count(db, 'challenge', 'plays_started'), 1);
  assert.equal(count(db, 'challenge', 'plays_completed'), 1);
  await post(`${path}/retry`, {}, headers);
  await post(`${path}/submit`, { answers: Array(10).fill(0) }, headers);
  assert.equal(count(db, 'challenge', 'plays_started'), 2);
  assert.equal(count(db, 'challenge', 'plays_completed'), 2);
  assert.equal(count(db, 'challenge', 'retries'), 1);
  const totals = db.prepare('SELECT * FROM play_daily_counts').all();
  assert.doesNotMatch(JSON.stringify(totals), /private-name|private-person|participantToken|answers|room_code/);
  db.exec('DELETE FROM challenge_rooms');
  assert.deepEqual(db.prepare('SELECT * FROM play_daily_counts').all(), totals);
  db.close();
});

test('polling LIVE counts first vote and all-question completion; duplicate upserts do not add', () => {
  const db = database();
  const now = Date.now();
  liveRoom(db);
  const vote = db.prepare(`INSERT INTO live_votes VALUES ('123456', ?, 'p1', 0, ?)
    ON CONFLICT(code, question_id, participant_id) DO UPDATE SET updated_at = excluded.updated_at`);
  vote.run('q1', now);
  vote.run('q1', now);
  assert.equal(count(db, 'live', 'plays_started'), 1);
  assert.equal(count(db, 'live', 'plays_completed'), 0);
  vote.run('q2', now);
  vote.run('q2', now);
  assert.equal(count(db, 'live', 'votes_recorded'), 2);
  assert.equal(count(db, 'live', 'plays_completed'), 1);
  const update = db.prepare('UPDATE live_games SET payload = ?, updated_at = ?');
  update.run(JSON.stringify({ phase: 'voting' }), now);
  update.run(JSON.stringify({ phase: 'complete' }), now);
  update.run(JSON.stringify({ phase: 'complete' }), now);
  assert.equal(count(db, 'live', 'rooms_started'), 1);
  assert.equal(count(db, 'live', 'rooms_completed'), 1);
  db.close();
});

test('realtime vote path saves anonymous totals and retries/restarts are idempotent', async () => {
  const db = database();
  const storage = storageMock({ roomState: { questionCount: 2 }, cleanupAt: Date.now() + 10000 });
  const shard = new LiveVoteShard({ storage, getWebSockets: () => [] }, { REMOTE_DB: adapter(db) });
  const vote = (questionId, participantId = 'private-participant') => shard.saveVote({
    code: 'private-room', shardIndex: 0, participantId, questionId, optionIndex: 1, optionCount: 5,
  });
  await vote('q1');
  await assert.rejects(vote('q1'), /already-voted/);
  await vote('q2');
  await flushRealtimePlayCounts(storage, adapter(db), Date.now(), true);
  assert.equal(count(db, 'live', 'plays_started'), 1);
  assert.equal(count(db, 'live', 'plays_completed'), 1);
  assert.equal(count(db, 'live', 'votes_recorded'), 2);
  const dayKey = [...storage.values.keys()].find((x) => x.startsWith('play:day:'));
  const day = await storage.get(dayKey);
  await storage.put(dayKey, { ...day, deliveredVotes: 0 }); // crash after D1 committed, before local ack
  await flushRealtimePlayCounts(storage, adapter(db), Date.now(), true);
  assert.equal(count(db, 'live', 'votes_recorded'), 2);
  const cursor = db.prepare('SELECT * FROM play_daily_live_streams').get();
  assert.doesNotMatch(JSON.stringify(cursor), /private-room|private-participant|optionIndex|name|token/);
  // Out-of-order older snapshots cannot decrease/re-add totals.
  await storage.put(dayKey, { ...day, votes: 1, completed: 0, deliveredVotes: 0 });
  await flushRealtimePlayCounts(storage, adapter(db), Date.now(), true);
  assert.equal(count(db, 'live', 'plays_completed'), 1);
  db.close();
});

test('LIVE joins remain successful when D1 includes trigger writes in meta.changes', async () => {
  const db = database();
  const now = Date.now();
  db.prepare('INSERT INTO live_games VALUES (?, ?, ?, ?, ?)').run('123456', JSON.stringify({
    version: 4, title: 'test', subjectName: 'subject', phase: 'lobby',
    createdAt: now, updatedAt: now, expiresAt: now + 60000,
    currentQuestionIndex: 0, questions: [{ id: 'q1', type: 'guess-person', text: 'question',
      options: ['A', 'B', 'C', 'D', 'E'], lockedIndex: null }], results: [],
  }), now, now, now + 60000);
  const response = await handleLiveApi(new Request('https://example.com/api/live/games/123456/join', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'private-name' }),
  }), { REMOTE_DB: adapter(db) }, '/api/live/games/123456/join');
  const errorDetails = db.prepare("SELECT name FROM sqlite_master WHERE name = 'live_ops_events'").get()
    ? db.prepare('SELECT message FROM live_ops_events').all() : [];
  assert.equal(response.status, 201, JSON.stringify(errorDetails) + await response.clone().text());
  assert.equal(count(db, 'live', 'participants_joined'), 1);
  assert.equal(count(db, 'live', 'plays_started'), 0);
  db.close();
});

test('a vote arriving during D1 delivery is retained and flushed on the next alarm', async () => {
  const db = database();
  const storage = storageMock({ roomState: { questionCount: 2 }, cleanupAt: Date.now() + 10000 });
  const shard = new LiveVoteShard({ storage, getWebSockets: () => [] }, { REMOTE_DB: adapter(db) });
  const args = { code: 'room', shardIndex: 0, participantId: 'person', optionIndex: 0, optionCount: 5 };
  await shard.saveVote({ ...args, questionId: 'q1' });
  const base = adapter(db);
  const interleaved = { prepare(sql) {
    const statement = base.prepare(sql);
    const run = statement.run.bind(statement);
    statement.run = async () => { const result = await run(); await shard.saveVote({ ...args, questionId: 'q2' }); return result; };
    return statement;
  } };
  assert.ok(await flushRealtimePlayCounts(storage, interleaved, Date.now(), true));
  await flushRealtimePlayCounts(storage, base, Date.now(), true);
  assert.equal(count(db, 'live', 'votes_recorded'), 2);
  assert.equal(count(db, 'live', 'plays_completed'), 1);
  db.close();
});

test('D1 failure at LIVE expiry deletes personal storage but keeps anonymous totals for retry', async () => {
  const db = database();
  const storage = storageMock({ roomState: { questionCount: 1, participantName: 'private' }, cleanupAt: Date.now() + 1000 });
  const context = { storage, getWebSockets: () => [] };
  const shard = new LiveVoteShard(context, { REMOTE_DB: adapter(db) });
  await shard.saveVote({ code: 'private-room', shardIndex: 0, participantId: 'private-person', questionId: 'q1', optionIndex: 0, optionCount: 5 });
  await storage.put('cleanupAt', Date.now() - 1);
  shard.env = { REMOTE_DB: { prepare() { throw new Error('temporary-outage'); } } };
  await assert.rejects(shard.alarm(), /temporary-outage/);
  assert.doesNotMatch(JSON.stringify([...storage.values]), /private-person|private-room|participantName|optionIndex|roomState/);
  shard.env = { REMOTE_DB: adapter(db) };
  await shard.alarm();
  assert.equal(count(db, 'live', 'plays_completed'), 1);
  assert.equal(storage.values.size, 0);
  db.close();
});

test('expired source rows and random retry cursors can be deleted without deleting daily totals', async () => {
  const db = database();
  const now = Date.now();
  liveRoom(db, now - 10000);
  db.prepare(`INSERT INTO play_daily_live_streams VALUES ('random-shard', ?, 2, 1, 3, ?)`).run(playDayJst(now), now - 1);
  const before = db.prepare('SELECT * FROM play_daily_counts ORDER BY metric').all();
  await runPrivacyCleanup({ REMOTE_DB: adapter(db) }, now);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM play_daily_live_streams').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM live_games').get().n, 0);
  assert.deepEqual(db.prepare('SELECT * FROM play_daily_counts ORDER BY metric').all(), before);
  db.close();
});

test('trigger counts roll back together with source writes', () => {
  const db = database();
  db.exec('BEGIN');
  liveRoom(db);
  assert.equal(count(db, 'live', 'rooms_created'), 1);
  db.exec('ROLLBACK');
  assert.equal(count(db, 'live', 'rooms_created'), 0);
  db.close();
});

test('a retry beyond cursor retention is flagged instead of silently double-counting', async () => {
  const db = database();
  const now = Date.now();
  const day = playDayJst(now);
  const storage = storageMock({
    cleanupAt: now - 8 * 86400000, 'play:stream': 'random',
    [`play:day:${day}`]: { started: 1, completed: 1, votes: 10, deliveredVotes: 0 },
  });
  await assert.rejects(flushRealtimePlayCounts(storage, adapter(db), now, true), /retry-window-expired/);
  assert.equal(count(db, 'live', 'votes_recorded'), 0);
  assert.equal((await storage.get(`play:day:${day}`)).votes, 10);
  db.close();
});
