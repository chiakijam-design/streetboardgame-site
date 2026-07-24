import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createLiveAdminSession, generateLiveAdminTotp } from '../../src/live/admin-auth.js';
import { handleQuestionApi } from '../../src/questions/api.js';

test('未チェックでは保存せず、明示同意したお題だけ審査・承認・掲載先変更できる', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(await readFile(new URL('../../migrations/0012_question_catalog_moderation.sql', import.meta.url), 'utf8'));
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

  const submittedResponse = await handleQuestionApi(jsonRequest('/api/questions/submissions', {
    consent: true,
    sourceMode: 'challenge',
    questions: [question],
  }), env, '/api/questions/submissions');
  assert.equal(submittedResponse.status, 201);
  const submitted = await submittedResponse.json();
  assert.equal(submitted.submitted, 1);

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
  assert.equal(overview.submissions.length, 1);
  assert.equal(overview.submissions[0].status, 'pending');

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
