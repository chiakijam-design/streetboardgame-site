import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  CHALLENGE_MAX_PARTICIPANTS,
  CHALLENGE_QUESTION_COUNT,
  handleChallengeApi,
} from '../../src/challenge/api.js';
import {
  mergeChallengeCards,
  pickChallengeCards,
} from '../../src/challenge/data.js';

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

function d1Adapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bindings: [],
        bind(...bindings) {
          this.bindings = bindings;
          return this;
        },
        async first() {
          return statement.get(...this.bindings) || null;
        },
        async all() {
          return { results: statement.all(...this.bindings) };
        },
        async run() {
          const result = statement.run(...this.bindings);
          return { meta: { changes: Number(result.changes) } };
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

test('共通お題データは題名を正規化して重複を除ける', () => {
  const merged = mergeChallengeCards(
    [{ title: '同じ 問題', choices: ['1', '2', '3', '4', '5'] }, { title: '問題A', choices: ['1', '2', '3', '4', '5'] }],
    [{ title: '同じ問題', choices: ['a', 'b', 'c', 'd', 'e'] }, { title: '問題B', choices: ['1', '2', '3', '4', '5'] }],
  );
  assert.deepEqual(merged.map((card) => card.title), ['同じ 問題', '問題A', '問題B']);
  assert.equal(pickChallengeCards(merged, 2, () => 0).length, 2);
});

test('挑戦ルームは10問固定で正解を公開せず50人まで受け付ける', async () => {
  const env = { CHALLENGE_KV: new MemoryKV() };
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
  const env = { CHALLENGE_KV: new MemoryKV() };
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
  const unpublishedResult = await (await api(env, `/api/challenge/rooms/${created.code}/result`, {
    headers: { 'x-challenge-participant-token': joined.participantToken },
  })).json();
  assert.equal(unpublishedResult.rank, null);
  assert.equal(unpublishedResult.participant.rankingParticipating, false);
  const registered = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
    method: 'POST',
    headers: tokenHeader,
  });
  assert.equal(registered.status, 200);
  assert.equal((await registered.json()).rank, 1);
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

test('選択した1問だけを順番に確定し、正解を漏らさず正誤を即時返す', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0010_challenge_rooms.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0011_challenge_ranking_library.sql', import.meta.url), 'utf8'));
  const environments = [
    { CHALLENGE_KV: new MemoryKV() },
    { REMOTE_DB: d1Adapter(sqlite) },
  ];

  for (const env of environments) {
    const created = await (await api(env, '/api/challenge/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        creatorName: '出題者',
        cards,
        answers: Array(CHALLENGE_QUESTION_COUNT).fill(0),
      }),
    })).json();
    const joined = await (await api(env, `/api/challenge/rooms/${created.code}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '即時判定', rankingConsent: true }),
    })).json();
    const headers = {
      'content-type': 'application/json',
      'x-challenge-participant-token': joined.participantToken,
    };

    const beforeCompletion = await api(env, `/api/challenge/rooms/${created.code}/result`, {
      headers: { 'x-challenge-participant-token': joined.participantToken },
    });
    assert.equal(beforeCompletion.status, 409);

    const first = await api(env, `/api/challenge/rooms/${created.code}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionIndex: 0, choice: 0 }),
    });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), {
      questionIndex: 0,
      match: true,
      completed: false,
      score: 1,
      nextQuestionIndex: 1,
    });

    const repeated = await api(env, `/api/challenge/rooms/${created.code}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionIndex: 0, choice: 0 }),
    });
    assert.equal(repeated.status, 200);
    const changed = await api(env, `/api/challenge/rooms/${created.code}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionIndex: 0, choice: 1 }),
    });
    assert.equal(changed.status, 409);

    const resumed = await (await api(env, `/api/challenge/rooms/${created.code}/join`, {
      method: 'POST',
      headers,
      body: '{}',
    })).json();
    assert.equal(resumed.participant.submitted, false);
    assert.equal(resumed.participant.answerCount, 1);
    assert.equal(resumed.participant.score, null);

    const wrong = await api(env, `/api/challenge/rooms/${created.code}/answer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ questionIndex: 1, choice: 1 }),
    });
    assert.equal(wrong.status, 200);
    assert.equal((await wrong.json()).match, false);

    for (let questionIndex = 2; questionIndex < CHALLENGE_QUESTION_COUNT; questionIndex += 1) {
      const response = await api(env, `/api/challenge/rooms/${created.code}/answer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionIndex, choice: 0 }),
      });
      assert.equal(response.status, 200);
      if (questionIndex === CHALLENGE_QUESTION_COUNT - 1) {
        const final = await response.json();
        assert.equal(final.completed, true);
        assert.equal(final.score, 9);
        assert.equal(final.nextQuestionIndex, null);
      }
    }

    const result = await (await api(env, `/api/challenge/rooms/${created.code}/result`, {
      headers: { 'x-challenge-participant-token': joined.participantToken },
    })).json();
    assert.equal(result.score, 9);
    assert.equal(result.answers[0].match, true);
    assert.equal(result.answers[1].match, false);
  }

  sqlite.close();
});

test('結果確認後だけ点数を登録でき、同じ参加枠で再挑戦して上書きできる', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0010_challenge_rooms.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0011_challenge_ranking_library.sql', import.meta.url), 'utf8'));
  const environments = [
    { CHALLENGE_KV: new MemoryKV() },
    { REMOTE_DB: d1Adapter(sqlite) },
  ];

  for (const env of environments) {
    const created = await (await api(env, '/api/challenge/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creatorName: '出題者', cards, answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
    })).json();
    const joined = await (await api(env, `/api/challenge/rooms/${created.code}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '再挑戦者', rankingConsent: true }),
    })).json();
    assert.equal(joined.participant.rankingParticipating, false);

    const tokenHeader = {
      'content-type': 'application/json',
      'x-challenge-participant-token': joined.participantToken,
    };
    const firstAttempt = await api(env, `/api/challenge/rooms/${created.code}/submit`, {
      method: 'POST',
      headers: tokenHeader,
      body: JSON.stringify({ answers: Array(CHALLENGE_QUESTION_COUNT).fill(1) }),
    });
    assert.equal(firstAttempt.status, 200);

    const firstResult = await (await api(env, `/api/challenge/rooms/${created.code}/result`, {
      headers: tokenHeader,
    })).json();
    assert.equal(firstResult.score, 0);
    assert.equal(firstResult.rank, null);
    assert.equal(firstResult.participant.rankingParticipating, false);
    assert.deepEqual((await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json()).participants, []);

    const retried = await api(env, `/api/challenge/rooms/${created.code}/retry`, {
      method: 'POST',
      headers: tokenHeader,
    });
    assert.equal(retried.status, 200);
    assert.equal((await retried.json()).participant.submitted, false);
    assert.equal((await api(env, `/api/challenge/rooms/${created.code}/result`, {
      headers: tokenHeader,
    })).status, 409);

    const secondAttempt = await api(env, `/api/challenge/rooms/${created.code}/submit`, {
      method: 'POST',
      headers: tokenHeader,
      body: JSON.stringify({ answers: Array(CHALLENGE_QUESTION_COUNT).fill(0) }),
    });
    assert.equal(secondAttempt.status, 200);
    const beforeRegistration = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
    assert.deepEqual(beforeRegistration.participants, []);

    const registered = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
      method: 'POST',
      headers: tokenHeader,
    });
    assert.equal(registered.status, 200);
    assert.equal((await registered.json()).rank, 1);
    const finalRanking = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
    assert.deepEqual(finalRanking.participants.map(({ name, score, rank }) => ({ name, score, rank })), [
      { name: '再挑戦者', score: 10, rank: 1 },
    ]);

    const managed = await (await api(env, `/api/challenge/rooms/${created.code}/manage`, {
      headers: { 'x-challenge-manage-token': created.manageToken },
    })).json();
    assert.equal(managed.participants.length, 1);
    assert.equal(managed.participants[0].rankingParticipating, true);
    assert.equal(managed.participants[0].answers.length, 10);
  }

  sqlite.close();
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
