import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleChallengeApi } from '../../src/challenge/api.js';
import { SHARE_ACTIONS, SHARE_ACTION_SURFACES, recordShareAction } from '../../src/analytics/share-actions.js';
import { sendChallengeShareAction } from '../../src/analytics/client-share-actions.js';

const MIGRATION = readFileSync(new URL('../../migrations/0031_play_daily_share_actions.sql', import.meta.url), 'utf8');

function database({ shareTable = true } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const name of ['0003_live_games', '0010_challenge_rooms', '0011_challenge_ranking_library', '0018_challenge_board_comments', '0029_challenge_auto_board', '0025_live_chat', '0027_play_daily_counts', '0028_play_daily_actions']) {
    db.exec(readFileSync(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  if (shareTable) db.exec(MIGRATION);
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
async function setup(options) {
  const db = database(options);
  const env = { REMOTE_DB: adapter(db) };
  const post = async (path, body, headers = {}) => handleChallengeApi(new Request(`https://example.com${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.9', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env, path);
  const created = await (await post('/api/challenge/rooms', { creatorName: 'HostName',
    cards: Array.from({ length: 10 }, (_, i) => ({ id: `Q${i}`, title: 'Question', choices: ['A', 'B', 'C', 'D', 'E'] })), answers: Array(10).fill(0) })).json();
  const base = `/api/challenge/rooms/${created.code}`;
  const joined = await (await post(base + '/join', { name: 'PlayerName' })).json();
  const player = { 'x-challenge-participant-token': joined.participantToken };
  const host = { 'x-challenge-manage-token': created.manageToken };
  return { db, env, post, base, created, joined, player, host };
}
const rows = (db) => db.prepare('SELECT day, surface, action, count FROM play_daily_share_actions ORDER BY surface, action').all().map((row) => ({ ...row }));

test('allowed list matches every share button in resultShare.js and the migration CHECK', () => {
  const markup = readFileSync(new URL('../../src/platform/resultShare.js', import.meta.url), 'utf8');
  const rendered = [...markup.matchAll(/\$\{card\('([a-z-]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...rendered].sort(), [...SHARE_ACTIONS].sort());
  assert.deepEqual(SHARE_ACTION_SURFACES, ['result', 'invite']);
  const db = database();
  for (const surface of SHARE_ACTION_SURFACES) for (const action of SHARE_ACTIONS) {
    db.prepare("INSERT INTO play_daily_share_actions VALUES ('2026-11-12', ?, ?, 1)").run(surface, action);
  }
  assert.throws(() => db.prepare("INSERT INTO play_daily_share_actions VALUES ('2026-11-12', 'result', 'tiktok', 1)").run());
  assert.throws(() => db.prepare("INSERT INTO play_daily_share_actions VALUES ('2026-11-12', 'board', 'copy', 1)").run());
  assert.throws(() => db.prepare("INSERT INTO play_daily_share_actions VALUES ('20261112', 'result', 'copy', 1)").run());
  assert.doesNotMatch(MIGRATION, /\b(?:DROP|ALTER|DELETE|UPDATE|INSERT)\b/i);
  db.close();
});

test('only allowed button names are recorded; invalid names are 400 and auth is required', async () => {
  const { db, post, base, player, host } = await setup();
  // Result surface: participant token, after submitting answers.
  assert.equal((await post(base + '/share-actions', { surface: 'result', action: 'copy' })).status, 403);
  assert.equal((await post(base + '/share-actions', { surface: 'result', action: 'copy' }, player)).status, 409);
  assert.equal((await post(base + '/submit', { answers: Array(10).fill(0) }, player)).status, 200);
  assert.equal((await post(base + '/share-actions', { surface: 'result', action: 'tiktok' }, player)).status, 400);
  assert.equal((await post(base + '/share-actions', { surface: 'board', action: 'copy' }, player)).status, 400);
  assert.equal((await post(base + '/share-actions', { surface: 'result' }, player)).status, 400);
  assert.equal((await post(base + '/share-actions', 'not json', player)).status, 400);
  assert.equal((await post(base + '/share-actions', { surface: 'result', action: 'copy', extra: 'x'.repeat(200) }, player)).status, 400);
  assert.equal((await post(base + '/share-actions', { surface: 'result', action: 'copy' }, { ...player, origin: 'https://bad.example' })).status, 403);
  // A participant token cannot record invite presses; the manage token cannot record result presses.
  assert.equal((await post(base + '/share-actions', { surface: 'invite', action: 'copy' }, player)).status, 403);
  assert.equal((await post(base + '/share-actions', { surface: 'invite', action: 'copy' }, { 'x-challenge-manage-token': 'f'.repeat(48) })).status, 403);
  assert.equal(rows(db).length, 0);

  const ok = await post(base + '/share-actions', { surface: 'result', action: 'copy' }, player);
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { stored: true });
  await post(base + '/share-actions', { surface: 'result', action: 'copy' }, player);
  assert.equal((await post(base + '/share-actions', { surface: 'invite', action: 'instagram-link' }, host)).status, 200);
  const stored = rows(db);
  assert.deepEqual(stored.map(({ surface, action, count }) => [surface, action, count]), [['invite', 'instagram-link', 1], ['result', 'copy', 2]]);
  assert.match(stored[0].day, /^\d{4}-\d{2}-\d{2}$/);
  db.close();
});

test('a missing table (before migration 0031) returns 200 with stored:false', async () => {
  const { db, post, base, player, host } = await setup({ shareTable: false });
  await post(base + '/submit', { answers: Array(10).fill(0) }, player);
  for (const [body, headers] of [[{ surface: 'result', action: 'native' }, player], [{ surface: 'invite', action: 'save' }, host]]) {
    const response = await post(base + '/share-actions', body, headers);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { stored: false });
  }
  assert.equal(await recordShareAction({ REMOTE_DB: adapter(db) }, 'result', 'copy'), false);
  db.close();
});

test('no personal value is stored: only day, surface, action and count', async () => {
  const { db, post, base, created, joined, player, host } = await setup();
  await post(base + '/submit', { answers: Array(10).fill(0) }, player);
  await post(base + '/share-actions', { surface: 'result', action: 'whatsapp' }, player);
  await post(base + '/share-actions', { surface: 'invite', action: 'line' }, host);
  assert.deepEqual(db.prepare('PRAGMA table_info(play_daily_share_actions)').all().map((column) => column.name), ['day', 'surface', 'action', 'count']);
  const dump = JSON.stringify(rows(db));
  for (const secret of [created.code, created.manageToken, joined.participantToken, 'HostName', 'PlayerName', '192.0.2.9']) {
    assert.equal(dump.includes(secret), false, secret);
  }
  // The rate limiter keeps only hashed keys, never the raw tokens.
  const limiterKeys = JSON.stringify(db.prepare('SELECT rate_key FROM live_rate_limits').all());
  assert.equal(limiterKeys.includes(joined.participantToken) || limiterKeys.includes(created.manageToken), false);
  db.close();
});

test('browser delivery counts each button once per page view and sends no outcome', async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response('{}'); };
  try {
    const result = { code: '23456789', surface: 'result', participantToken: 'a'.repeat(48) };
    sendChallengeShareAction({ ...result, action: 'copy' });
    sendChallengeShareAction({ ...result, action: 'copy' });
    sendChallengeShareAction({ ...result, action: 'x' });
    sendChallengeShareAction({ ...result, action: 'copy', attempt: 1 });
    sendChallengeShareAction({ ...result, action: 'tiktok' });
    sendChallengeShareAction({ code: '23456789', surface: 'invite', action: 'copy', manageToken: 'b'.repeat(48) });
    sendChallengeShareAction({ code: '23456789', surface: 'invite', action: 'copy', manageToken: 'b'.repeat(48) });
    sendChallengeShareAction({ code: '23456789', surface: 'invite', action: 'save' });
    assert.equal(calls.length, 4);
    assert.equal(calls[0].url, '/api/challenge/rooms/23456789/share-actions');
    assert.equal(calls[0].options.keepalive, true);
    assert.deepEqual(JSON.parse(calls[0].options.body), { surface: 'result', action: 'copy' });
    assert.equal(calls[0].options.headers['x-challenge-participant-token'], 'a'.repeat(48));
    assert.equal(calls[3].options.headers['x-challenge-manage-token'], 'b'.repeat(48));
  } finally { globalThis.fetch = original; }
});
