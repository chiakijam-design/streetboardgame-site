import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createLiveAdminSession, generateLiveAdminTotp } from '../../src/live/admin-auth.js';
import { handleQuestionApi } from '../../src/questions/api.js';
import { applyManagedQuestionCards } from '../../src/questions/catalog.js';
import { scanQuestionSafety } from '../../src/questions/safety.js';

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
    sourceQuestionId: 'FQ001',
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
      targetFriend: true,
      targetFamily: false,
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
  assert.equal(publicData.questions[0].targetFriend, true);
  assert.equal(publicData.questions[0].targetFamily, false);

  const updateResponse = await handleQuestionApi(jsonRequest(
    `/api/questions/admin/catalog/${approved.catalogId}`,
    {
      ...question,
      category: '会話',
      sourceKind: 'custom',
      sourceRef: approved.catalogId,
      status: 'approved',
      useChallenge: true,
      useLive: false,
      targetFriend: true,
      targetFamily: true,
    },
    adminHeaders,
    'PUT',
  ), env, `/api/questions/admin/catalog/${approved.catalogId}`);
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json();
  assert.equal(updated.question.useLive, false);
  assert.equal(updated.question.targetFamily, true);

  const disabledStaticResponse = await handleQuestionApi(jsonRequest(
    '/api/questions/admin/catalog/FQ001',
    {
      ...question,
      sourceKind: 'static',
      sourceRef: 'FQ001',
      status: 'disabled',
      useChallenge: true,
      useLive: true,
      targetFriend: true,
      targetFamily: false,
    },
    adminHeaders,
    'PUT',
  ), env, '/api/questions/admin/catalog/FQ001');
  assert.equal(disabledStaticResponse.status, 200);

  const catalogWithDisabledResponse = await handleQuestionApi(
    new Request('https://example.com/api/questions/catalog'),
    env,
    '/api/questions/catalog',
  );
  const catalogWithDisabled = await catalogWithDisabledResponse.json();
  const disabledStatic = catalogWithDisabled.questions.find((item) => item.id === 'FQ001');
  assert.equal(disabledStatic.status, 'disabled');
  const cardsAfterDisable = applyManagedQuestionCards([{
    id: 'FQ001',
    title: question.title,
    category: '友達向け',
    choices: question.choices,
  }], catalogWithDisabled.questions, 'challenge');
  assert.equal(cardsAfterDisable.some((item) => item.id === 'FQ001'), false);
  assert.equal(cardsAfterDisable.some((item) => item.id === approved.catalogId), true);
  assert.equal(cardsAfterDisable.find((item) => item.id === approved.catalogId).reportable, true);
  assert.equal(cardsAfterDisable.find((item) => item.id === approved.catalogId).managedQuestionId, approved.catalogId);

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
