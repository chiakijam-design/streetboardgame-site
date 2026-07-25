import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHALLENGE_RESULT_TIERS,
  getChallengeResultTier,
  getChallengeReviewLines,
} from '../../src/challenge/result.js';

test('10問版は0点から10点まで重複しない11段階の称号を返す', () => {
  assert.equal(CHALLENGE_RESULT_TIERS.length, 11);
  assert.deepEqual(CHALLENGE_RESULT_TIERS.map((tier) => tier.score), [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(new Set(CHALLENGE_RESULT_TIERS.map((tier) => tier.title)).size, 11);
  for (let score = 0; score <= 10; score += 1) {
    assert.equal(getChallengeResultTier(score), CHALLENGE_RESULT_TIERS[score]);
  }
  assert.equal(getChallengeResultTier(-10), CHALLENGE_RESULT_TIERS[0]);
  assert.equal(getChallengeResultTier(99), CHALLENGE_RESULT_TIERS[10]);
});

test('回答者名・出題者名・正誤傾向から4文の答え合わせレポートを安定して生成する', () => {
  const answers = Array.from({ length: 10 }, (_, index) => ({
    match: index < 7,
    card: {
      category: index % 2 ? '食べ物' : '旅行',
      title: index % 2 ? '好きな食べ物' : '一緒に行きたい場所',
    },
  }));
  const result = {
    score: 7,
    participant: { name: 'ゆう' },
    creatorName: 'ちあき',
    answers,
  };
  const first = getChallengeReviewLines(result);
  const second = getChallengeReviewLines(result);

  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
  assert.match(first.join(' '), /ゆう/);
  assert.match(first.join(' '), /ちあき/);
  assert.match(first.join(' '), /かなり分かってる|7\/10/);
  assert.match(first.join(' '), /食べ物・日常の好み|おでかけ・遊びの感覚/);
});
