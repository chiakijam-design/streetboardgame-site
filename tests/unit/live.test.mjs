import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateLiveResult,
  createLiveQuestion,
  recommendYouTubeCandidates,
  validateLiveDraft,
} from '../../src/live/model.js';
import {
  generateYouTubeQuestions,
  normalizeYouTubeChannelUrl,
  publicLiveGame,
} from '../../src/live/api.js';

test('LIVE問題は1問以上で、10問を超えても固定上限で切り捨てない', () => {
  const questions = Array.from({ length: 12 }, (_, index) => createLiveQuestion({
    id: `q-${index}`,
    type: 'poll',
    text: `問題${index + 1}`,
    options: ['A', 'B'],
  }));
  const result = validateLiveDraft({ title: 'テストLIVE', subjectName: '主役', questions });
  assert.equal(result.valid, true);
  assert.equal(result.draft.questions.length, 12);
});

test('手入力の非アンケート問題は非公開回答が必要で、選択肢は2〜4個に正規化する', () => {
  const invalid = validateLiveDraft({
    title: 'テストLIVE', subjectName: '主役',
    questions: [{ id: 'q-1', type: 'guess-person', text: 'どれ？', options: ['A', 'B'], lockedIndex: null }],
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /非公開回答/);
  const valid = validateLiveDraft({
    title: 'テストLIVE', subjectName: '主役',
    questions: [{ id: 'q-1', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'], lockedIndex: 1 }],
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.draft.questions[0].options, ['A', 'B', 'C', 'D']);
});

test('YouTubeモードは30問以内・同一タイプ・各5択に固定する', () => {
  const baseQuestion = {
    type: 'guess-person', text: '本人はどれ？', options: ['A', 'B', 'C', 'D', 'E'], lockedIndex: 0,
  };
  const questions = Array.from({ length: 30 }, (_, index) => ({ ...baseQuestion, id: `yt-${index}` }));
  const valid = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人', questions,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.draft.questions.length, 30);
  assert.equal(valid.draft.questions.every((question) => question.options.length === 5), true);
  const fifthOptionResult = calculateLiveResult({ ...baseQuestion, id: 'result-5', lockedIndex: 4 }, { participant: 4 });
  assert.equal(fifthOptionResult.options.length, 5);
  assert.equal(fifthOptionResult.options[4].count, 1);
  assert.equal(fifthOptionResult.isCorrect, true);

  const tooMany = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人',
    questions: [...questions, { ...baseQuestion, id: 'yt-30' }],
  });
  assert.match(tooMany.errors.join('\n'), /30問以内/);
  const fourOptions = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人',
    questions: [{ ...baseQuestion, options: ['A', 'B', 'C', 'D'] }],
  });
  assert.match(fourOptions.errors.join('\n'), /選択肢を5個/);
  const mixedTypes = validateLiveDraft({
    creationMode: 'youtube', title: 'YouTube LIVE', subjectName: '本人',
    questions: [baseQuestion, { ...baseQuestion, type: 'guess-majority' }],
  });
  assert.match(mixedTypes.errors.join('\n'), /問題タイプを統一/);
});

test('3タイプの票数・割合・最多回答・当たり判定を生成する', () => {
  const person = calculateLiveResult({ id: 'a', type: 'guess-person', text: '本人は？', options: ['A', 'B'], lockedIndex: 0 }, { p1: 0, p2: 0, p3: 1 });
  assert.deepEqual(person.options.map(({ count, percentage }) => ({ count, percentage })), [
    { count: 2, percentage: 66.7 }, { count: 1, percentage: 33.3 },
  ]);
  assert.deepEqual(person.popularIndices, [0]);
  assert.equal(person.isCorrect, true);
  assert.equal(person.subjectAnswerIndex, 0);

  const majority = calculateLiveResult({ id: 'b', type: 'guess-majority', text: '1位は？', options: ['A', 'B'], lockedIndex: 1 }, { p1: 1, p2: 1 });
  assert.equal(majority.isCorrect, true);
  assert.equal(majority.predictionIndex, 1);

  const poll = calculateLiveResult({ id: 'c', type: 'poll', text: '投票', options: ['A', 'B'], lockedIndex: null }, {});
  assert.equal(poll.totalVotes, 0);
  assert.deepEqual(poll.popularIndices, []);
  assert.equal('isCorrect' in poll, false);
});

test('投票締切前の公開状態から正解・トークン・投票内訳を除外する', () => {
  const game = {
    title: '秘密テスト', subjectName: '本人', phase: 'voting', currentQuestionIndex: 0,
    hostToken: 'secret-host',
    questions: [{ id: 'q-1', type: 'guess-person', text: '本人の答え', options: ['秘密A', '秘密B'], lockedIndex: 1 }],
    participants: [{ id: 'p-1', token: 'secret-participant', name: '参加者' }],
    votes: { 'q-1': { 'p-1': 0 } }, results: [],
  };
  const publicState = publicLiveGame(game);
  const serialized = JSON.stringify(publicState);
  assert.equal(serialized.includes('lockedIndex'), false);
  assert.equal(serialized.includes('secret-host'), false);
  assert.equal(serialized.includes('secret-participant'), false);
  assert.equal(serialized.includes('subjectAnswerIndex'), false);
  assert.equal(publicState.question.voteCount, 1);
});

test('YouTubeの一般的なチャンネルURLを正規化し、選んだ1種類だけ30問を作る', () => {
  assert.equal(normalizeYouTubeChannelUrl('https://www.youtube.com/@sample/videos'), 'https://www.youtube.com/@sample');
  assert.equal(normalizeYouTubeChannelUrl('youtube.com/channel/UC1234567890'), 'https://www.youtube.com/channel/UC1234567890');
  assert.equal(normalizeYouTubeChannelUrl('https://example.com/@sample'), '');
  const profile = { channelName: 'サンプル', videoTitles: ['動画Aです', '動画Bです', '動画Cです', '動画Dです'] };
  const personQuestions = generateYouTubeQuestions(profile, 0, 'guess-person');
  const majorityQuestions = generateYouTubeQuestions(profile, 0, 'guess-majority');
  assert.equal(personQuestions.length, 30);
  assert.equal(personQuestions.every(({ type }) => type === 'guess-person'), true);
  assert.equal(personQuestions.every(({ options }) => options.length === 5), true);
  assert.equal(new Set(personQuestions.map(({ text }) => text)).size, 30);
  assert.equal(majorityQuestions.length, 30);
  assert.equal(majorityQuestions.every(({ type }) => type === 'guess-majority'), true);
  assert.equal(majorityQuestions.every(({ options }) => options.length === 5), true);
  assert.equal(new Set(majorityQuestions.map(({ text }) => text)).size, 30);
  assert.equal(recommendYouTubeCandidates(personQuestions).filter(({ selected }) => selected).length, 5);
});
