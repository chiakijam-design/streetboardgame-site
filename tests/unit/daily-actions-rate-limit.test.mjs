import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleChallengeApi } from '../../src/challenge/api.js';
import { enforceChallengeRateLimit } from '../../src/challenge/rate-limit.js';
import { sendChallengeDailyAction } from '../../src/analytics/client-daily-actions.js';

function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0003_live_games', '0010_challenge_rooms', '0011_challenge_ranking_library', '0018_challenge_board_comments', '0025_live_chat', '0027_play_daily_counts', '0028_play_daily_actions']) {
    db.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  return db;
}
function adapter(db) {
  return { prepare(sql) {
    const stmt = db.prepare(sql);
    return { values: [], bind(...values) { this.values = values; return this; },
      async first() { return stmt.get(...this.values) || null; },
      async all() { return { results: stmt.all(...this.values) }; },
      async run() { const before = db.prepare('SELECT total_changes() n').get().n; stmt.run(...this.values);
        return { meta: { changes: db.prepare('SELECT total_changes() n').get().n - before } }; },
    };
  } };
}
test('normal creation limit is atomic, scope-separated, expires, and stores no raw identity', async () => {
  const db = database(); const env = { REMOTE_DB: adapter(db) }; const now = 1_800_000_000_000;
  await Promise.all(Array.from({ length: 60 }, () => enforceChallengeRateLimit(env, '192.0.2.1', 'create', 60, now)));
  await assert.rejects(enforceChallengeRateLimit(env, '192.0.2.1', 'create', 60, now), error => error.status === 429 && error.retryAfter === 60);
  await enforceChallengeRateLimit(env, '192.0.2.2', 'create', 60, now);
  await enforceChallengeRateLimit(env, '192.0.2.1', 'actions', 12, now);
  await enforceChallengeRateLimit(env, '192.0.2.1', 'create', 60, now + 60_000);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM live_rate_limits').get().n, 4);
  assert.ok(db.prepare('SELECT rate_key FROM live_rate_limits').all().every(row => !row.rate_key.includes('192.0.2.')));
  db.close();
});
test('only normal POST creation is limited, returns Retry-After, never blocks GET or other IP', async () => {
  const db = database(); const env = { REMOTE_DB: adapter(db) };
  const call = (method, path = '/api/challenge/rooms', ip = '192.0.2.4') => handleChallengeApi(new Request(`https://example.com${path}`, { method,
    headers: { 'CF-Connecting-IP': ip }, ...(method === 'POST' ? { body: '{}' } : {}), }), env, path);
  for (let n = 0; n < 60; n++) assert.equal((await call('POST')).status, 400);
  const limited = await call('POST'); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await call('GET')).status, 404);
  assert.equal((await call('POST', undefined, '192.0.2.5')).status, 400);
  db.close();
});
test('concurrent limiter initialization does not share a failed request IO promise', async () => {
  const db = database();
  const base = adapter(db);
  let rejectFirst;
  let setupCalls = 0;
  const binding = { prepare(sql) {
    if (sql.startsWith('CREATE TABLE')) {
      return { run() {
        setupCalls += 1;
        if (setupCalls === 1) return new Promise((_, reject) => { rejectFirst = reject; });
        return base.prepare(sql).run();
      } };
    }
    return base.prepare(sql);
  } };
  const env = { REMOTE_DB: binding };
  const first = enforceChallengeRateLimit(env, '192.0.2.11');
  const firstFailure = assert.rejects(first, /first-request-failed/);
  const second = enforceChallengeRateLimit(env, '192.0.2.12');
  // Attach a rejection handler immediately so an expected old-code failure is safe.
  const secondResult = second.then(() => 'ok', error => error.message);
  rejectFirst(new Error('first-request-failed'));
  await firstFailure;
  assert.equal(await secondResult, 'ok');
  assert.equal(setupCalls, 2);
  db.close();
});
test('detail endpoint authenticates completed players, validates actions/origin and only persists aggregate columns', async () => {
  const db = database(); const env = { REMOTE_DB: adapter(db) };
  const post = async (path, body, headers = {}) => handleChallengeApi(new Request(`https://example.com${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), }), env, path);
  const created = await (await post('/api/challenge/rooms', { creatorName: 'Host',
    cards: Array.from({ length: 10 }, (_, i) => ({ id: `Q${i}`, title: 'Question', choices: ['A','B','C','D','E'] })), answers: Array(10).fill(0), })).json();
  const base = `/api/challenge/rooms/${created.code}`;
  const joined = await (await post(base + '/join', { name: 'Player' })).json();
  const headers = { 'x-challenge-participant-token': joined.participantToken };
  assert.equal((await post(base + '/actions', { metric: 'answer_report_viewed' })).status, 403);
  assert.equal((await post(base + '/actions', { metric: 'answer_report_viewed' }, headers)).status, 409);
  assert.equal((await post(base + '/submit', { answers: Array(10).fill(0) }, headers)).status, 200);
  assert.equal((await post(base + '/actions', { metric: 'invented' }, headers)).status, 400);
  assert.equal((await post(base + '/actions', { metric: 'answer_report_viewed', extra: 'x'.repeat(200) }, headers)).status, 400);
  assert.equal((await post(base + '/actions', { metric: 'answer_report_viewed' }, { ...headers, origin: 'https://bad.example' })).status, 403);
  assert.equal((await post(base + '/actions', { metric: 'answer_report_viewed' }, headers)).status, 200);
  assert.equal(db.prepare('SELECT count FROM play_daily_actions WHERE metric = ?').get('answer_report_viewed').count, 1);
  assert.deepEqual(db.prepare('PRAGMA table_info(play_daily_actions)').all().map(x=>x.name), ['day','mode','metric','count']);
  db.close();
});
test('LIVE publish/chat counters are transactional, do not count polls, re-review, paid support or historical rows', () => {
  const db = database(); const now = Date.parse('2026-10-01T16:00:00Z');
  const put = phase => db.prepare(`INSERT INTO live_games VALUES ('123456', ?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`).run(JSON.stringify({ phase }), now, now, now + 1000);
  put('lobby'); put('voting'); put('reveal'); put('reveal'); put('review-question'); put('review-answer'); put('review-answer');
  assert.equal(db.prepare("SELECT count FROM play_daily_actions WHERE metric='answers_published'").get().count, 2);
  const insertChat = (id,type) => db.prepare(`INSERT OR IGNORE INTO live_chat_messages (message_id,code,participant_id,participant_name,message_text,message_type,created_at,updated_at) VALUES (?, '123456', 'p', 'name', 'message', ?, ?, ?)`).run(id,type,now,now);
  insertChat('1','chat'); insertChat('1','chat'); insertChat('2','support');
  assert.equal(db.prepare("SELECT count FROM play_daily_actions WHERE metric='chat_messages_sent'").get().count, 1);
  db.exec('BEGIN'); insertChat('3','chat'); db.exec('ROLLBACK');
  assert.equal(db.prepare("SELECT count FROM play_daily_actions WHERE metric='chat_messages_sent'").get().count, 1);
  assert.equal(db.prepare('SELECT day FROM play_daily_actions LIMIT 1').get().day, '2026-10-02');
  db.exec(readFileSync(new URL('../../migrations/0028_play_daily_actions.sql', import.meta.url), 'utf8'));
  assert.equal(db.prepare("SELECT count FROM play_daily_actions WHERE metric='chat_messages_sent'").get().count, 1);
  db.close();
});
test('browser action delivery deduplicates within an attempt and allows retry attempts', async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response('{}'); };
  try {
    sendChallengeDailyAction('23456789', 'a'.repeat(48), 0, 'role_swap_started');
    sendChallengeDailyAction('23456789', 'a'.repeat(48), 0, 'role_swap_started');
    sendChallengeDailyAction('23456789', 'a'.repeat(48), 1, 'role_swap_started');
    assert.equal(calls.length, 2); assert.equal(calls[0].options.keepalive, true);
    assert.deepEqual(JSON.parse(calls[0].options.body), { metric: 'role_swap_started' });
  } finally { globalThis.fetch = original; }
});
