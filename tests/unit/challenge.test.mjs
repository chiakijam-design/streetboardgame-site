import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  buildBoardCommentCandidates,
  CHALLENGE_BOARD_COMMENT_MAX_LENGTH,
  CHALLENGE_MAX_PARTICIPANTS,
  CHALLENGE_QUESTION_COUNT,
  handleChallengeApi,
} from '../../src/challenge/api.js';
import {
  mergeChallengeCards,
  pickChallengeCards,
  questionSelectionWeight,
  questionSkipRate,
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

test('スキップ率が低い問題ほど候補選出の重みが高くなる', () => {
  const oftenSkipped = {
    id: 'Q-SKIP',
    title: 'よくスキップされる',
    choices: ['1', '2', '3', '4', '5'],
    selectionShownCount: 20,
    selectionSkipCount: 16,
  };
  const rarelySkipped = {
    id: 'Q-KEEP',
    title: 'ほとんどスキップされない',
    choices: ['1', '2', '3', '4', '5'],
    selectionShownCount: 20,
    selectionSkipCount: 1,
  };
  const newQuestion = {
    id: 'Q-NEW',
    title: '新しい問題',
    choices: ['1', '2', '3', '4', '5'],
  };

  assert.ok(questionSkipRate(rarelySkipped) < questionSkipRate(oftenSkipped));
  assert.ok(questionSelectionWeight(rarelySkipped) > questionSelectionWeight(oftenSkipped));
  assert.ok(questionSelectionWeight(newQuestion) > questionSelectionWeight(oftenSkipped));
  assert.equal(
    pickChallengeCards([oftenSkipped, rarelySkipped, newQuestion], 1, () => 0.2)[0].id,
    'Q-KEEP',
  );
});

test('保留候補は非公開のまま、採用後は通常版・LIVE版の共通お題へ追加できる', async () => {
  const {
    applyManagedQuestionCards,
    applyQuestionSelectionStats,
  } = await import('../../src/questions/catalog.js');
  const managed = [{
    id: 'HLD001',
    sourceKind: 'candidate',
    title: '候補のお題',
    category: '会話',
    choices: ['1', '2', '3', '4', '5'],
    status: 'held',
    language: 'ja',
  }];
  assert.equal(applyManagedQuestionCards([], managed, 'challenge').length, 0);
  const approved = applyManagedQuestionCards([], [{ ...managed[0], status: 'approved' }], 'challenge');
  assert.equal(approved.length, 1);
  assert.equal(approved[0].sourceKind, 'candidate');
  assert.equal(approved[0].reportable, false);
  const withStats = applyQuestionSelectionStats(approved, [{
    questionId: 'HLD001',
    mode: 'challenge',
    shownCount: 12,
    skipCount: 3,
  }, {
    questionId: 'HLD001',
    mode: 'live',
    shownCount: 20,
    skipCount: 9,
  }], 'challenge');
  assert.deepEqual(
    [withStats[0].selectionShownCount, withStats[0].selectionSkipCount],
    [12, 3],
  );
});

test('答え合わせから3定型文を2種類ずつ生成し、自由入力は使わない', () => {
  const candidates = buildBoardCommentCandidates({
    cards,
    answerKey: Array(CHALLENGE_QUESTION_COUNT).fill(0),
  }, {
    answers: [1, 1, ...Array(CHALLENGE_QUESTION_COUNT - 2).fill(0)],
  });
  assert.equal(candidates.length, 6);
  assert.equal(candidates.filter((comment) => comment.endsWith('なんだね。意外！')).length, 2);
  assert.equal(candidates.filter((comment) => comment.includes('は絶対')).length, 2);
  assert.equal(candidates.filter((comment) => comment.endsWith('と2択で迷った')).length, 2);
});

test('満点または0点では実際に存在する正解・不正解だけからコメント候補を作る', () => {
  const room = {
    cards,
    answerKey: Array(CHALLENGE_QUESTION_COUNT).fill(0),
  };
  const perfect = buildBoardCommentCandidates(room, {
    answers: Array(CHALLENGE_QUESTION_COUNT).fill(0),
  });
  const zero = buildBoardCommentCandidates(room, {
    answers: Array(CHALLENGE_QUESTION_COUNT).fill(1),
  });
  assert.equal(perfect.length, 2);
  assert.equal(perfect.every((comment) => comment.includes('は絶対')), true);
  assert.equal(zero.length, 4);
  assert.equal(zero.some((comment) => comment.includes('は絶対')), false);
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

test('挑戦者の得点と10問の答え合わせを本人だけに返し、順位は返さない', async () => {
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
  assert.equal(Object.hasOwn(unpublishedResult, 'rank'), false);
  assert.equal(unpublishedResult.participant.rankingParticipating, false);
  const tooLongComment = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
    method: 'POST',
    headers: tokenHeader,
    body: JSON.stringify({ comment: 'あ'.repeat(CHALLENGE_BOARD_COMMENT_MAX_LENGTH + 1) }),
  });
  assert.equal(tooLongComment.status, 400);
  assert.equal((await tooLongComment.json()).error, 'board-comment-too-long');
  const personalComment = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
    method: 'POST',
    headers: tokenHeader,
    body: JSON.stringify({ comment: '連絡先は090-1234-5678です' }),
  });
  assert.equal(personalComment.status, 400);
  assert.equal((await personalComment.json()).error, 'board-comment-personal-information');
  const boardComment = '次は旅行の話をもっと聞いてみたい！';
  const registered = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
    method: 'POST',
    headers: tokenHeader,
    body: JSON.stringify({ comment: boardComment }),
  });
  assert.equal(registered.status, 200);
  assert.equal(Object.hasOwn(await registered.json(), 'rank'), false);
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
  assert.equal(Object.hasOwn(result, 'rank'), false);
  assert.equal(result.answers.length, 10);
  assert.equal(result.answers.every((answer) => answer.match), true);

  const ranking = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
  assert.deepEqual(ranking.participants.map((participant) => ({
    name: participant.name,
    score: participant.score,
    comment: participant.comment,
  })), [{ name: '挑戦者', score: 10, comment: boardComment }]);
  assert.equal(ranking.participants.every((participant) => !Object.hasOwn(participant, 'rank')), true);

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
  sqlite.exec(readFileSync(new URL('../../migrations/0018_challenge_board_comments.sql', import.meta.url), 'utf8'));
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
  sqlite.exec(readFileSync(new URL('../../migrations/0018_challenge_board_comments.sql', import.meta.url), 'utf8'));
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
    assert.equal(Object.hasOwn(firstResult, 'rank'), false);
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
    assert.equal(Object.hasOwn(await registered.json(), 'rank'), false);
    const finalRanking = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
    assert.deepEqual(finalRanking.participants.map(({ name, score }) => ({ name, score })), [
      { name: '再挑戦者', score: 10 },
    ]);
    assert.equal(finalRanking.participants.every((participant) => !Object.hasOwn(participant, 'rank')), true);

    const managed = await (await api(env, `/api/challenge/rooms/${created.code}/manage`, {
      headers: { 'x-challenge-manage-token': created.manageToken },
    })).json();
    assert.equal(managed.participants.length, 1);
    assert.equal(managed.participants[0].rankingParticipating, true);
    assert.equal(managed.participants[0].answers.length, 10);
  }

  sqlite.close();
});

test('理解度ボードは点数ではなく10問の回答完了順で並び、順位を返さない', async (t) => {
  let currentTime = 1_750_000_000_000;
  t.mock.method(Date, 'now', () => {
    currentTime += 1;
    return currentTime;
  });

  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0010_challenge_rooms.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0011_challenge_ranking_library.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0018_challenge_board_comments.sql', import.meta.url), 'utf8'));
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

    const answerAndList = async (name, answers) => {
      const joined = await (await api(env, `/api/challenge/rooms/${created.code}/join`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })).json();
      const tokenHeaders = {
        'content-type': 'application/json',
        'x-challenge-participant-token': joined.participantToken,
      };
      assert.equal((await api(env, `/api/challenge/rooms/${created.code}/submit`, {
        method: 'POST',
        headers: tokenHeaders,
        body: JSON.stringify({ answers }),
      })).status, 200);
      const registration = await api(env, `/api/challenge/rooms/${created.code}/ranking`, {
        method: 'POST',
        headers: tokenHeaders,
      });
      assert.equal(registration.status, 200);
      assert.equal(Object.hasOwn(await registration.json(), 'rank'), false);
    };

    await answerAndList('先に回答・0問一致', Array(CHALLENGE_QUESTION_COUNT).fill(1));
    await answerAndList('後に回答・10問一致', Array(CHALLENGE_QUESTION_COUNT).fill(0));

    const board = await (await api(env, `/api/challenge/rooms/${created.code}/ranking`)).json();
    assert.deepEqual(board.participants, [
      { name: '先に回答・0問一致', score: 0, comment: '' },
      { name: '後に回答・10問一致', score: 10, comment: '' },
    ]);
    assert.equal(board.participants.every((participant) => !Object.hasOwn(participant, 'rank')), true);
  }

  sqlite.close();
});

test('挑戦モードのD1移行は理解度ボード掲載同意と人気お題集計を追加する', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0010_challenge_rooms.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0011_challenge_ranking_library.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0018_challenge_board_comments.sql', import.meta.url), 'utf8'));
  const participantColumns = sqlite.prepare('PRAGMA table_info(challenge_participants)').all()
    .map((column) => column.name);
  assert.equal(participantColumns.includes('ranking_consent_at'), true);
  assert.equal(participantColumns.includes('board_comment'), true);
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
