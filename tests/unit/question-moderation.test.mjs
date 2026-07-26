import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createLiveAdminSession, generateLiveAdminTotp } from '../../src/live/admin-auth.js';
import { handleQuestionApi } from '../../src/questions/api.js';
import { applyManagedQuestionCards } from '../../src/questions/catalog.js';
import { scanQuestionSafety } from '../../src/questions/safety.js';
import {
  findSimilarQuestions,
  sortQuestionsForOperations,
} from '../../src/questions/similarity.js';

test('採用・保留・無効の順に並べ、保留と無効は採用との類似だけを検出する', () => {
  const questions = [{
    id: 'q3',
    status: 'disabled',
    title: 'あさ起きて最初にすることは？',
    choices: ['水を飲む', 'スマホを見る', '顔を洗う', '二度寝', '着替える'],
  }, {
    id: 'q2',
    status: 'approved',
    title: 'あさ起きて最初にすることは？',
    choices: ['水を飲む', 'スマホを見る', '顔を洗う', '二度寝', '着替える'],
  }, {
    id: 'q1',
    status: 'approved',
    title: 'あさ起きて最初にすることは？',
    choices: ['水を飲む', 'スマホを見る', '顔を洗う', 'もう一度寝る', '着替える'],
  }, {
    id: 'q4',
    status: 'held',
    title: 'あさ起きて最初にすることは？',
    choices: ['水を飲む', 'スマホを見る', '顔を洗う', '二度寝', '着替える'],
  }];

  assert.deepEqual(sortQuestionsForOperations(questions).map((item) => item.id), ['q1', 'q2', 'q4', 'q3']);
  const matches = findSimilarQuestions(questions);
  assert.equal(matches.get('q1')[0].id, 'q2');
  assert.ok(matches.get('q1')[0].score >= 0.58);
  assert.equal(matches.get('q1').some((item) => item.id === 'q3'), false);
  assert.equal(matches.get('q1').some((item) => item.id === 'q4'), false);
  assert.equal(matches.get('q4')[0].id, 'q2');
  assert.equal(matches.get('q4').some((item) => item.id === 'q1'), true);
  assert.equal(matches.get('q3')[0].id, 'q2');
  assert.equal(matches.get('q3').some((item) => item.id === 'q1'), true);
});

test('既存DBから旧シリーズ分類列と廃止お題を削除する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
  const insert = sqlite.prepare(`
    INSERT INTO question_catalog
      (question_id, source_kind, source_ref, title, category, choices_json, status,
       use_challenge, use_live, target_friend, target_family, created_at, updated_at)
    VALUES (?, 'static', ?, ?, ?, '["1","2","3","4","5"]', ?, ?, ?, ?, ?, 1, 1)
  `);
  insert.run('FQ001', 'FQ001', '採用問題', '友達向け', 'approved', 1, 0, 1, 0);
  insert.run('FAM001', 'FAM001', '無効問題', '家族向け', 'disabled', 1, 1, 0, 1);

  sqlite.exec(await readFile(new URL('../../migrations/0013_question_safety_reports.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0014_unify_question_catalog.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0015_remove_retired_games.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0016_restore_common_question_overrides.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0017_consolidate_legacy_question_ids.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0019_add_held_question_candidates.sql', import.meta.url), 'utf8'));
  const approved = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q001');
  const disabled = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('FAM001');
  const restoredDisabled = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q502');
  const restoredApproved = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q534');
  const columns = sqlite.prepare('PRAGMA table_info(question_catalog)').all().map((column) => column.name);
  assert.deepEqual(
    [approved.use_challenge, approved.use_live, approved.category],
    [1, 1, 'みんなのお題'],
  );
  assert.equal(disabled, undefined);
  assert.deepEqual(
    [restoredDisabled.status, restoredDisabled.use_challenge, restoredDisabled.use_live],
    ['disabled', 0, 0],
  );
  assert.deepEqual(
    [restoredApproved.status, restoredApproved.use_challenge, restoredApproved.use_live],
    ['approved', 1, 1],
  );
  assert.equal(columns.includes('target_friend'), false);
  assert.equal(columns.includes('target_family'), false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM question_catalog WHERE status = 'held'").get().count, 100);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM question_catalog WHERE source_kind = 'candidate'").get().count, 100);
  assert.deepEqual(
    sqlite.prepare(`
      SELECT substr(source_ref, 1, 1) AS source_group, COUNT(*) AS count
      FROM question_catalog
      WHERE source_kind = 'candidate'
      GROUP BY source_group
      ORDER BY source_group
    `).all().map((row) => [row.source_group, row.count]),
    [['A', 30], ['B', 25], ['C', 20], ['D', 15], ['E', 10]],
  );
});

test('本番に混在した旧IDと現行IDは新しい運営設定を優先して共通IDへ統合する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
  const insert = sqlite.prepare(`
    INSERT INTO question_catalog
      (question_id, source_kind, source_ref, title, category, choices_json, status,
       use_challenge, use_live, target_friend, target_family, created_at, updated_at)
    VALUES (?, 'static', ?, ?, 'みんなのお題', '["1","2","3","4","5"]', ?, ?, ?, 0, 0, 1, ?)
  `);
  insert.run('FQ013', 'FQ013', '古い設定', 'approved', 1, 1, 1);
  insert.run('Q013', 'Q013', '新しい設定', 'disabled', 0, 0, 2);
  insert.run('FAM025', 'FAM025', '家族で行くなら', 'approved', 1, 1, 3);
  insert.run('LOVE5', 'LOVE5', 'デート中のNG行動', 'disabled', 0, 0, 4);

  sqlite.exec(await readFile(new URL('../../migrations/0017_consolidate_legacy_question_ids.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0016_restore_common_question_overrides.sql', import.meta.url), 'utf8'));

  const consolidated = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q013');
  const family = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q525');
  const love = sqlite.prepare('SELECT * FROM question_catalog WHERE question_id = ?').get('Q405');
  assert.deepEqual(
    [consolidated.title, consolidated.status, consolidated.use_challenge, consolidated.use_live],
    ['新しい設定', 'disabled', 0, 0],
  );
  assert.equal(family.status, 'approved');
  assert.equal(love.status, 'disabled');
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM question_catalog WHERE question_id LIKE 'FQ%' OR question_id LIKE 'FAM%' OR question_id LIKE 'LOVE%'").get().count, 0);
});

test('個人情報らしい文字列と重点審査4分類を自動検知する', () => {
  const personal = scanQuestionSafety({
    title: '氏名：山田 太郎の連絡先は？',
    choices: ['前橋第一中学校', '@school_friend', '090-1234-5678', '群馬県前橋市本町1丁目2番3号', '非公開'],
  });
  assert.deepEqual(personal.personalInfoFlags.sort(), [
    'address',
    'phone-number',
    'real-name',
    'school-name',
    'sns-id',
  ]);

  const moderation = scanQuestionSafety({
    title: 'いじめや容姿差別につながる質問',
    choices: ['性的な内容', '仲間外れ', 'ブス', '人種差別', '安全な選択肢'],
  });
  assert.deepEqual(moderation.moderationFlags.sort(), [
    'appearance-attack',
    'bullying',
    'discrimination',
    'sexual-content',
  ]);
});

test('未チェックでは保存せず、明示同意したお題だけ審査・承認・掲載先変更できる', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
  sqlite.exec(await readFile(new URL('../../migrations/0013_question_safety_reports.sql', import.meta.url), 'utf8'));
  const env = {
    REMOTE_DB: d1(sqlite),
    LIVE_ADMIN_TOKEN: 'admin-token-which-is-longer-than-thirty-two-characters',
    LIVE_ADMIN_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    LIVE_ADMIN_SESSION_SECRET: 'session-secret-which-is-longer-than-thirty-two-characters',
  };
  const question = {
    sourceQuestionId: 'Q001',
    title: '自作した問題はどれ？',
    choices: ['その1', 'その2', 'その3', 'その4', 'その5'],
  };

  const withoutConsent = await handleQuestionApi(jsonRequest('/api/questions/submissions', {
    consent: false,
    sourceMode: 'challenge',
    questions: [question],
  }), env, '/api/questions/submissions');
  assert.equal(withoutConsent.status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM question_submissions').get().count, 0);

  const personalInfoResponse = await handleQuestionApi(jsonRequest('/api/questions/submissions', {
    consent: true,
    sourceMode: 'challenge',
    questions: [{
      sourceQuestionId: null,
      title: '連絡先はどれ？',
      choices: ['090-1234-5678', '@school_friend', 'その3', 'その4', 'その5'],
    }],
  }), env, '/api/questions/submissions');
  assert.equal(personalInfoResponse.status, 400);
  assert.deepEqual((await personalInfoResponse.json()).flags.sort(), ['phone-number', 'sns-id']);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM question_submissions').get().count, 0);

  const submittedResponse = await handleQuestionApi(jsonRequest('/api/questions/submissions', {
    consent: true,
    sourceMode: 'challenge',
    questions: [question],
  }), env, '/api/questions/submissions');
  assert.equal(submittedResponse.status, 201);
  const submitted = await submittedResponse.json();
  assert.equal(submitted.submitted, 1);

  const rejectedCandidateResponse = await handleQuestionApi(jsonRequest('/api/questions/submissions', {
    consent: true,
    sourceMode: 'live-challenge',
    questions: [{
      sourceQuestionId: null,
      title: 'クラスでいじめるなら誰？',
      choices: ['候補1', '候補2', '候補3', '候補4', '候補5'],
    }],
  }), env, '/api/questions/submissions');
  assert.equal(rejectedCandidateResponse.status, 201);
  const rejectedCandidate = await rejectedCandidateResponse.json();

  const forbidden = await handleQuestionApi(new Request('https://example.com/api/questions/admin/overview'), env, '/api/questions/admin/overview');
  assert.equal(forbidden.status, 401);

  const otp = await generateLiveAdminTotp(env.LIVE_ADMIN_TOTP_SECRET);
  const session = await createLiveAdminSession(new Request('https://example.com/api/live/admin/session', {
    method: 'POST',
    headers: {
      'x-live-admin-token': env.LIVE_ADMIN_TOKEN,
      'x-live-admin-otp': otp,
    },
  }), env);
  const adminHeaders = { 'x-live-admin-session': session.sessionToken };
  const overviewResponse = await handleQuestionApi(new Request('https://example.com/api/questions/admin/overview', {
    headers: adminHeaders,
  }), env, '/api/questions/admin/overview');
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json();
  assert.equal(overview.submissions.length, 2);
  assert.equal(overview.submissions[0].status, 'pending');
  assert.deepEqual(overview.submissions[0].safetyFlags, ['bullying']);

  const submissionId = submitted.submissionIds[0];
  const approvedResponse = await handleQuestionApi(jsonRequest(
    `/api/questions/admin/submissions/${submissionId}/review`,
    {
      decision: 'approved',
      ...question,
      category: '会話',
      useChallenge: true,
      useLive: true,
    },
    adminHeaders,
  ), env, `/api/questions/admin/submissions/${submissionId}/review`);
  assert.equal(approvedResponse.status, 200);
  const approved = await approvedResponse.json();
  assert.match(approved.catalogId, /^CUS[A-F0-9]{20}$/);

  const rejectedResponse = await handleQuestionApi(jsonRequest(
    `/api/questions/admin/submissions/${rejectedCandidate.submissionIds[0]}/review`,
    { decision: 'rejected', reviewNote: '既存のお題と重複' },
    adminHeaders,
  ), env, `/api/questions/admin/submissions/${rejectedCandidate.submissionIds[0]}/review`);
  assert.equal(rejectedResponse.status, 200);
  const rejected = await rejectedResponse.json();
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.catalogId, null);

  const publicResponse = await handleQuestionApi(new Request('https://example.com/api/questions/catalog'), env, '/api/questions/catalog');
  const publicData = await publicResponse.json();
  assert.equal(publicData.questions.length, 1);
  assert.deepEqual(publicData.questions[0].choices, question.choices);
  assert.equal(publicData.questions[0].useChallenge, true);
  assert.equal(publicData.questions[0].useLive, true);
  assert.equal('targetFriend' in publicData.questions[0], false);
  assert.equal('targetFamily' in publicData.questions[0], false);

  const updateResponse = await handleQuestionApi(jsonRequest(
    `/api/questions/admin/catalog/${approved.catalogId}`,
    {
      ...question,
      category: '会話',
      sourceKind: 'custom',
      sourceRef: approved.catalogId,
      status: 'approved',
    },
    adminHeaders,
    'PUT',
  ), env, `/api/questions/admin/catalog/${approved.catalogId}`);
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.question.useLive, true);
  assert.equal('targetFamily' in updated.question, false);

  const heldCandidateResponse = await handleQuestionApi(jsonRequest(
    '/api/questions/admin/catalog/HLD999',
    {
      title: '保留中の候補はどれ？',
      choices: ['候補1', '候補2', '候補3', '候補4', '候補5'],
      category: '会話',
      sourceKind: 'candidate',
      sourceRef: 'test-candidate',
      status: 'held',
    },
    adminHeaders,
    'PUT',
  ), env, '/api/questions/admin/catalog/HLD999');
  assert.equal(heldCandidateResponse.status, 200);
  const heldCandidate = await heldCandidateResponse.json();
  assert.equal(heldCandidate.question.status, 'held');
  assert.equal(heldCandidate.question.sourceKind, 'candidate');
  assert.equal(heldCandidate.question.useChallenge, false);
  assert.equal(heldCandidate.question.useLive, false);
  const publicWithHeld = await (await handleQuestionApi(
    new Request('https://example.com/api/questions/catalog'),
    env,
    '/api/questions/catalog',
  )).json();
  assert.equal(publicWithHeld.questions.some((item) => item.id === 'HLD999'), false);

  const disabledStaticResponse = await handleQuestionApi(jsonRequest(
    '/api/questions/admin/catalog/Q001',
    {
      ...question,
      sourceKind: 'static',
      sourceRef: 'Q001',
      status: 'disabled',
    },
    adminHeaders,
    'PUT',
  ), env, '/api/questions/admin/catalog/Q001');
  assert.equal(disabledStaticResponse.status, 200);

  const catalogWithDisabledResponse = await handleQuestionApi(
    new Request('https://example.com/api/questions/catalog'),
    env,
    '/api/questions/catalog',
  );
  const catalogWithDisabled = await catalogWithDisabledResponse.json();
  const disabledStatic = catalogWithDisabled.questions.find((item) => item.id === 'Q001');
  assert.equal(disabledStatic.status, 'disabled');
  const cardsAfterDisable = applyManagedQuestionCards([{
    id: 'Q001',
    title: question.title,
    category: 'みんなのお題',
    choices: question.choices,
  }], catalogWithDisabled.questions, 'challenge');
  assert.equal(cardsAfterDisable.some((item) => item.id === 'Q001'), false);
  assert.equal(cardsAfterDisable.some((item) => item.id === approved.catalogId), true);
  assert.equal(cardsAfterDisable.find((item) => item.id === approved.catalogId).reportable, true);
  assert.equal(cardsAfterDisable.find((item) => item.id === approved.catalogId).managedQuestionId, approved.catalogId);
  const liveCardsAfterDisable = applyManagedQuestionCards([{
    id: 'Q001',
    title: question.title,
    category: 'みんなのお題',
    choices: question.choices,
  }], catalogWithDisabled.questions, 'live');
  assert.deepEqual(
    liveCardsAfterDisable.map((item) => item.id),
    cardsAfterDisable.map((item) => item.id),
    '通常版とLIVE版は同じ採用済みお題を使う',
  );

  const reportResponse = await handleQuestionApi(jsonRequest(
    `/api/questions/catalog/${approved.catalogId}/report`,
    { reason: 'bullying', detail: '人を傷つける内容です' },
  ), env, `/api/questions/catalog/${approved.catalogId}/report`);
  assert.equal(reportResponse.status, 200);
  assert.equal((await reportResponse.json()).hidden, true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM question_reports').get().count, 1);
  const hiddenCatalog = sqlite.prepare(`
    SELECT status, use_challenge, use_live
    FROM question_catalog WHERE question_id = ?
  `).get(approved.catalogId);
  assert.equal(hiddenCatalog.status, 'disabled');
  assert.equal(hiddenCatalog.use_challenge, 0);
  assert.equal(hiddenCatalog.use_live, 0);

  const publicAfterReport = await (await handleQuestionApi(
    new Request('https://example.com/api/questions/catalog'),
    env,
    '/api/questions/catalog',
  )).json();
  assert.equal(publicAfterReport.questions.some((item) => item.id === approved.catalogId), false);

  const overviewAfterReport = await (await handleQuestionApi(new Request(
    'https://example.com/api/questions/admin/overview',
    { headers: adminHeaders },
  ), env, '/api/questions/admin/overview')).json();
  assert.equal(overviewAfterReport.catalog.find((item) => item.id === approved.catalogId).reportCount, 1);
});

function jsonRequest(path, body, headers = {}, method = 'POST') {
  return new Request(`https://example.com${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10', ...headers },
    body: JSON.stringify(body),
  });
}

function d1(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...next) {
          values = next;
          return this;
        },
        async run() {
          return { success: true, meta: { changes: statement.run(...values).changes } };
        },
        async all() {
          return { success: true, results: statement.all(...values) };
        },
        async first() {
          return statement.get(...values) || null;
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}
