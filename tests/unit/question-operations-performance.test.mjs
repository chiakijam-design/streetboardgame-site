import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { findSimilarQuestions, findSimilarQuestionsCooperative } from '../../src/questions/similarity.js';
import { pageWindow, submissionPageOptions } from '../../src/questions/operations-pagination.js';
import { handleQuestionApi } from '../../src/questions/api.js';
import { createLiveAdminSession, generateLiveAdminTotp } from '../../src/live/admin-auth.js';

const cards = Array.from({ length: 80 }, (_, i) => ({ id: `perf${i}`, title: ['朝にしたいことは？', 'ＡＢＣの好みは？', '音楽を聴くなら？', '長い題名に含まれる題名'][i % 4] + i % 7,
  choices: i % 9 === 0 ? [' ', '', 'Ａ', 'a', '？'] : ['散歩', '読書', '友達と話す', '音楽', `ひと休み${i % 3}`], status: i % 3 ? 'approved' : 'pending' }));

for (const threshold of [0, 0.58, 1]) test(`協調比較は既存の類似度・順序を完全維持する（閾値${threshold}）`, async () => {
  assert.deepEqual(await findSimilarQuestionsCooperative(cards, threshold, { yieldControl: async () => {} }), findSimilarQuestions(cards, threshold));
});

test('比較の途中にイベントループと進捗を更新できる', async () => {
  let timerRan = false;
  setTimeout(() => { timerRan = true; }, 0);
  const progress = [];
  await findSimilarQuestionsCooperative(cards, 0.58, { onProgress: (p) => progress.push(p) });
  assert.equal(timerRan, true);
  assert.ok(progress.length > 2);
  assert.equal(progress[0].completed, 0);
  assert.equal(progress.at(-1).completed, progress.at(-1).total);
  assert.ok(progress.every((p, i) => !i || p.completed >= progress[i - 1].completed));
});

test('次ページの比較だけでも採用済み参照を省かず、全比較と同じ結果を返す', async () => {
  const ids = new Set(cards.filter(q => q.status === 'pending').slice(0, 5).map(q => q.id));
  const expected = findSimilarQuestions(cards);
  const progress = [];
  const actual = await findSimilarQuestionsCooperative(cards, 0.58, { compareIds: ids, onProgress: p => progress.push(p), yieldControl: async () => {} });
  assert.equal(actual.size, ids.size);
  for (const id of ids) assert.deepEqual(actual.get(id), expected.get(id));
  assert.equal(progress.at(-1).total, ids.size * cards.filter(q => q.status === 'approved').length);
});

test('ログアウト等による取消後に比較結果を返さない', async () => {
  const controller = new AbortController();
  let yields = 0;
  await assert.rejects(findSimilarQuestionsCooperative(cards, 0.58, { signal: controller.signal, yieldControl: async () => { if (++yields === 2) controller.abort(); } }), { name: 'AbortError' });
});

test('空の比較と50件のページ境界・範囲外を安全に扱う', async () => {
  assert.deepEqual(await findSimilarQuestionsCooperative([]), new Map());
  const items = Array.from({ length: 123 }, (_, i) => i);
  assert.deepEqual(pageWindow(items, 2).items, items.slice(100));
  assert.equal(pageWindow(items, 20).page, 2);
  assert.equal(pageWindow(items, -1).page, 0);
  assert.equal(pageWindow([], 5).hasNext, false);
  assert.equal(submissionPageOptions(new URL('https://example.com/')), null);
  assert.deepEqual(submissionPageOptions(new URL('https://example.com/?submissionOffset=50')), { offset: 50, limit: 50 });
  for (const raw of ['-1', '1.5', 'NaN', '1 OR 1=1', '999999999']) assert.throws(() => submissionPageOptions(new URL(`https://example.com/?submissionOffset=${encodeURIComponent(raw)}`)), { status: 400 });
});

function d1(db) {
  return { prepare(sql) { const stmt = db.prepare(sql); let values = []; return { bind(...next) { values = next; return this; }, async all() { return { results: stmt.all(...values) }; }, async first() { return stmt.get(...values) || null; }, async run() { return { success: true, meta: { changes: stmt.run(...values).changes } }; } }; }, async batch(stmts) { return Promise.all(stmts.map(s => s.run())); } };
}

test('認証した審査待ちだけを安定した50件ページで読み、既存状態も公開結果も変えない', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
    db.exec(await readFile(new URL('../../migrations/0013_question_safety_reports.sql', import.meta.url), 'utf8'));
    const env = { REMOTE_DB: d1(db), LIVE_ADMIN_TOKEN: 'isolated-test-token-not-a-real-credential-32', LIVE_ADMIN_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', LIVE_ADMIN_SESSION_SECRET: 'isolated-session-secret-not-real-32-characters' };
    await handleQuestionApi(new Request('https://example.com/api/questions/catalog'), env, '/api/questions/catalog');
    const insert = db.prepare('INSERT INTO question_submissions VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    for (let i = 1; i <= 1032; i++) insert.run(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 'challenge', `isolated${i}`, `隔離お題${i}は？`, '["朝","昼","夕方","夜","いつでも"]', i === 1032 ? 'rejected' : 'pending', 1000, null, '未審査', null, 'synthetic-hash');
    const before = JSON.stringify(db.prepare('SELECT * FROM question_submissions ORDER BY submission_id').all());
    const session = await createLiveAdminSession(new Request('https://example.com/api/live/admin/session', { method: 'POST', headers: { 'x-live-admin-token': env.LIVE_ADMIN_TOKEN, 'x-live-admin-otp': await generateLiveAdminTotp(env.LIVE_ADMIN_TOTP_SECRET) } }), env);
    const get = (query = '', authenticated = true) => handleQuestionApi(new Request('https://example.com/api/questions/admin/overview' + query, { headers: authenticated ? { cookie: session.cookie.split(';')[0] } : {} }), env, '/api/questions/admin/overview');
    assert.equal((await get('?submissionOffset=0', false)).status, 401);
    const first = await (await get('?submissionOffset=0&submissionLimit=999999')).json();
    const second = await (await get('?submissionOffset=50')).json();
    const last = await (await get('?submissionOffset=1000')).json();
    assert.deepEqual(first.submissionPagination, { offset: 0, limit: 50, total: 1031 });
    assert.deepEqual([first.submissions.length, second.submissions.length, last.submissions.length], [50, 50, 31]);
    const combined = [...first.submissions, ...second.submissions];
    for (let offset = 100; offset <= 1000; offset += 50) combined.push(...(await (await get(`?submissionOffset=${offset}`)).json()).submissions);
    assert.equal(combined.length, 1031);
    assert.equal(new Set(combined.map(q => q.id)).size, 1031);
    assert.ok(combined.every(q => q.status === 'pending'));
    assert.ok(first.submissions[0].id.endsWith('000000001031'));
    assert.equal((await get('?submissionOffset=-1')).status, 400);
    assert.deepEqual((await (await get('?submissionOffset=1100')).json()).submissions, []);
    const legacy = await (await get()).json();
    assert.equal(legacy.submissions.length, 500);
    assert.equal('submissionPagination' in legacy, false);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM question_submissions ORDER BY submission_id').all()), before);
    const publicResult = await (await handleQuestionApi(new Request('https://example.com/api/questions/catalog'), env, '/api/questions/catalog')).json();
    assert.equal(publicResult.questions.length, 0);
  } finally { db.close(); }
});
