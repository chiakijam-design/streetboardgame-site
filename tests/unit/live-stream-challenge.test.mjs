import test from 'node:test';
import assert from 'node:assert/strict';

import { handleLiveApi } from '../../src/live/api.js';
import { validateStreamChallengeDraft } from '../../src/live/model.js';

test('stream challenge requires exactly ten five-option questions', () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({
    id: `stream-${index}`,
    sourceId: `Q${String(index + 1).padStart(3, '0')}`,
    text: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D', 'E'],
  }));
  const valid = validateStreamChallengeDraft({
    subjectName: 'Streamer',
    showLiveVoteCounts: true,
    questions,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.draft.questions.length, 10);
  assert.equal(valid.draft.questions.every((question) => question.type === 'guess-person'), true);
  assert.equal(valid.draft.questions.every((question) => question.lockedIndex === null), true);
  assert.equal(valid.draft.questions[0].sourceId, 'Q001');
  assert.equal(valid.draft.showLiveVoteCounts, true);
  assert.equal(valid.draft.paidSalesRequested, false);
  assert.equal(valid.draft.resultImagePrice, 0);
  assert.equal(validateStreamChallengeDraft({ subjectName: 'Streamer', questions: questions.slice(0, 9) }).valid, false);
  assert.equal(validateStreamChallengeDraft({ subjectName: 'Streamer', questions: [...questions, questions[0]] }).valid, false);
  assert.equal(validateStreamChallengeDraft({
    subjectName: 'Streamer',
    questions: questions.map((question, index) => index === 0 ? { ...question, options: ['A', 'B'] } : question),
  }).valid, false);
});

test('stream challenge accepts only approved-price paid sales metadata', () => {
  const questions = Array.from({ length: 10 }, (_, index) => ({
    id: `paid-stream-${index}`,
    text: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D', 'E'],
  }));
  const paid = validateStreamChallengeDraft({
    subjectName: 'Streamer',
    paidSalesRequested: true,
    channelName: 'Verified channel',
    channelId: 'UC1234567890',
    channelVerificationId: 'a'.repeat(32),
    resultImagePrice: 980,
    questions,
  });
  assert.equal(paid.valid, true);
  assert.equal(paid.draft.paidSalesRequested, true);
  assert.equal(paid.draft.channelName, 'Verified channel');
  assert.equal(paid.draft.resultImagePrice, 980);
  assert.equal(validateStreamChallengeDraft({
    subjectName: 'Streamer',
    paidSalesRequested: true,
    channelId: 'UC1234567890',
    channelVerificationId: 'a'.repeat(32),
    resultImagePrice: 1000,
    questions,
  }).valid, false);
  assert.equal(validateStreamChallengeDraft({
    subjectName: 'Streamer',
    paidSalesRequested: true,
    resultImagePrice: 480,
    questions,
  }).valid, false);
});

test('streamer and viewer complete ten simultaneous answers with a personalized score', async () => {
  const kv = liveMemoryKv();
  const env = { LIVE_KV: kv };
  const questions = Array.from({ length: 10 }, (_, index) => ({
    id: `stream-flow-${index}`,
    text: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D', 'E'],
  }));
  const createdResponse = await handleLiveApi(new Request('https://example.com/api/live/stream-games', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subjectName: 'Streamer', showLiveVoteCounts: false, questions }),
  }), env, '/api/live/stream-games');
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.code, /^[0-9]{6}$/);
  assert.equal(created.game.mode, 'stream-challenge');
  assert.equal(created.game.questionCount, 10);

  const joinedResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Viewer' }),
  }), env, `/api/live/games/${created.code}/join`);
  assert.equal(joinedResponse.status, 201);
  const joined = await joinedResponse.json();

  const hostHeaders = { 'content-type': 'application/json', 'x-live-host-token': created.hostToken };
  const subjectHeaders = { 'content-type': 'application/json', 'x-live-subject-token': created.game.subjectToken };
  const participantHeaders = { 'content-type': 'application/json', 'x-live-participant-token': joined.participantToken };
  let hostState = await (await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/start`, {
    method: 'POST', headers: hostHeaders, body: '{}',
  }), env, `/api/live/games/${created.code}/start`)).json();

  for (let index = 0; index < 10; index += 1) {
    const question = hostState.game.question;
    const optionIndex = index % 5;
    const subjectResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/subject-answer`, {
      method: 'POST',
      headers: subjectHeaders,
      body: JSON.stringify({ questionId: question.id, optionIndex }),
    }), env, `/api/live/games/${created.code}/subject-answer`);
    assert.equal(subjectResponse.status, 200);
    const voteResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/vote`, {
      method: 'POST',
      headers: participantHeaders,
      body: JSON.stringify({ questionId: question.id, optionIndex }),
    }), env, `/api/live/games/${created.code}/vote`);
    assert.equal(voteResponse.status, 200);

    const beforeRevealResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}`, {
      headers: { 'x-live-participant-token': joined.participantToken },
    }), env, `/api/live/games/${created.code}`);
    const beforeReveal = await beforeRevealResponse.json();
    assert.equal(beforeReveal.game.phase, 'voting');
    assert.equal(beforeReveal.game.question.result, null);

    const advanceResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/advance`, {
      method: 'POST', headers: hostHeaders, body: '{}',
    }), env, `/api/live/games/${created.code}/advance`);
    assert.equal(advanceResponse.status, 200);
    hostState = await advanceResponse.json();

    assert.equal(hostState.game.phase, 'reveal');
    assert.equal(hostState.game.currentQuestionIndex, index);
    const revealResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}`, {
      headers: { 'x-live-participant-token': joined.participantToken },
    }), env, `/api/live/games/${created.code}`);
    const reveal = await revealResponse.json();
    assert.equal(reveal.game.phase, 'reveal');
    assert.equal(reveal.game.question.result.subjectAnswerIndex, optionIndex);
    assert.equal(reveal.game.question.result.myVoteIndex, optionIndex);
    assert.equal(reveal.game.question.result.myIsCorrect, true);

    if (index === 0) {
      const lateVoteResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/vote`, {
        method: 'POST',
        headers: participantHeaders,
        body: JSON.stringify({ questionId: question.id, optionIndex: 1 }),
      }), env, `/api/live/games/${created.code}/vote`);
      assert.equal(lateVoteResponse.status, 409);
    }

    const nextResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}/next`, {
      method: 'POST', headers: hostHeaders, body: '{}',
    }), env, `/api/live/games/${created.code}/next`);
    assert.equal(nextResponse.status, 200);
    hostState = await nextResponse.json();
    assert.equal(hostState.game.phase, index === 9 ? 'complete' : 'voting');
    assert.equal(hostState.game.currentQuestionIndex, index === 9 ? 9 : index + 1);
  }

  assert.equal(hostState.game.phase, 'complete');
  const resultResponse = await handleLiveApi(new Request(`https://example.com/api/live/games/${created.code}`, {
    headers: { 'x-live-participant-token': joined.participantToken },
  }), env, `/api/live/games/${created.code}`);
  const result = await resultResponse.json();
  assert.equal(result.game.results.length, 10);
  assert.equal(result.game.results.filter((item) => item.myIsCorrect).length, 10);
});

function liveMemoryKv() {
  const values = new Map();
  return {
    async get(key, options = {}) {
      const stored = values.get(key);
      if (stored === undefined) return null;
      return options?.type === 'json' ? JSON.parse(stored) : stored;
    },
    async put(key, value) {
      values.set(key, String(value));
    },
    async delete(key) {
      values.delete(key);
    },
  };
}
