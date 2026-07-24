import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  CHALLENGE_QUESTION_COUNT,
  handleChallengeApi,
} from '../../src/challenge/api.js';
import { mergeChallengeCards, pickChallengeCards } from '../../src/challenge/data.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key, options = {}) {
    const value = this.values.get(key);
    if (!value) return null;
    return options.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, String(value)); }
}

const cards = Array.from({ length: CHALLENGE_QUESTION_COUNT }, (_, index) => ({
  id: `T${index}`,
  category: 'テスト',
  title: `問題${index + 1}`,
  choices: ['A', 'B', 'C', 'D', 'E'],
}));

function api(env, path, options = {}) {
  return handleChallengeApi(new Request(`https://example.com${path}`, options), env, path);
}

test('友達・家族データは題名を正規化して重複を除ける', () => {
  const merged = mergeChallengeCards(
    [{ title: '同じ 問題', choices: ['1', '2', '3', '4', '5'] }, { title: '友達問題', choices: ['1', '2', '3', '4', '5'] }],
    [{ title: '同じ問題', choices: ['a', 'b', 'c', 'd', 'e'] }, { title: '家族問題', choices: ['1', '2', '3', '4', '5'] }],
  );
  assert.deepEqual(merged.map((card) => card.title), ['同じ 問題', '友達問題', '家族問題']);
  assert.equal(pickChallengeCards(merged, 2, () => 0).length, 2);
});

test('挑戦ルームは10問固定で正解を公開せず50人まで受け付ける', async () => {
  const env = { REMOTE_KV: new MemoryKV() };
  const createdResponse = await api(env, '/api/challenge/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creatorName: '出題者', cards, answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();

  const publicResponse = await api(env, `/api/challenge/rooms/${created.code}`);
  const publicText = await publicResponse.text();
  assert.equal(publicResponse.status, 200);
  assert.equal(publicText.includes('answerKey'), false);
  assert.equal(publicText.includes('manageToken'), false);

  for (let index = 0; index < CHALLENGE_MAX_PARTICIPANTS; index += 1) {
    const joined = await api(env, `/api/challenge/rooms/${created.code}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `参加者${index + 1}`, rankingConsent: true }),
    });
    assert.equal(joined.status, 201);
  }
  const rejected = await api(env, `/api/challenge/rooms/${created.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '51人目', rankingConsent: true }),
  });
  assert.equal(rejected.status, 409);
});

test('挑戦者の得点・同率順位・10問の答え合わせを本人だけに返す', async () => {
  const env = { REMOTE_KV: new MemoryKV() };
  const created = await (await api(env, '/api/challenge/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creatorName: '出題者', cards, answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
  })).json();

  const joined = await (await api(env, `/api/challenge/rooms/${created.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '挑戦者', rankingConsent: true }),
  })).json();
  const tokenHeader = { 'content-type': 'application/json', 'x-challenge-participant-token': joined.participantToken };
  const submitted = await api(env, `/api/challenge/rooms/${created.code}/submit`, {
    method: 'POST',
    headers: tokenHeader,
    body: JSON.stringify({ answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
  });
  assert.equal(submitted.status, 200);
  const resubmitted = await api(env, `/api/challenge/rooms/${created.code}/submit`, {
    method: 'POST',
    headers: tokenHeader,
    body: JSON.stringify({ answers: Array(CHALLENGE_QUESTION_COUNT).fill(1) }),
  });
  assert.equal(resubmitted.status, 409);
  const result = await (await api(env, `/api/challenge/rooms/${created.code}/result`, {
    headers: { 'x-challenge-participant-token': joined.participantToken },
  })).json();
  assert.equal(result.score, 10);
  assert.equal(result.rank, 1);
  assert.equal(result.answers.length, 10);
  assert.equal(result.answers.every((answer) => answer.match), true);

  const ranking = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
  assert.deepEqual(ranking.participants.map((participant) => ({
    name: participant.name,
    score: participant.score,
    rank: participant.rank,
  })), [{ name: '挑戦者', score: 10, rank: 1 }]);

  const managed = await (await api(env, `/api/challenge/rooms/${created.code}/manage`, {
    headers: { 'x-challenge-manage-token': created.manageToken },
  })).json();
  assert.equal(managed.participants.length, 1);
  assert.equal(managed.participants[0].answers.length, 10);
  assert.equal(managed.participants[0].answers.every((answer) => answer.match), true);

  const library = await (await api(env, '/api/challenge/library')).json();
  assert.equal(library.questions.length, 10);
  assert.equal(library.questions.every((question) => question.playCount === 1), true);
});

test('ランキング公開への明示同意がない参加は拒否する', async () => {
  const env = { REMOTE_KV: new MemoryKV() };
  const created = await (await api(env, '/api/challenge/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creatorName: '出題者', cards, answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
  })).json();
  const response = await api(env, `/api/challenge/rooms/${created.code}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '未同意' }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'ranking-consent-required' });
});

test('挑戦モードのD1移行はランキング同意と人気お題集計を追加する', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0010_challenge_rooms.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0011_challenge_ranking_library.sql', import.meta.url), 'utf8'));
  const participantColumns = sqlite.prepare('PRAGMA table_info(challenge_participants)').all()
    .map((column) => column.name);
  assert.equal(participantColumns.includes('ranking_consent_at'), true);
  const statsColumns = sqlite.prepare('PRAGMA table_info(challenge_question_stats)').all()
    .map((column) => column.name);
  assert.deepEqual(statsColumns, [
    'question_id',
    'title',
    'category',
    'choices_json',
    'play_count',
    'last_played_at',
  ]);
});
