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
  assert.deepEqual(CHALLENGE_RESULT_TIERS.map((tier) => tier.title), [
    '未知のわたし、全問発見',
    'ぴったりの第一歩',
    '「そうなんだ！」が2つ',
    'わかってきた予感',
    'わたし理解度、更新中',
    '半分ぴったり、半分発見',
    'ぴったりが一歩リード',
    'かなりのわたし通',
    'わたし解像度、高画質',
    'あと1問も、会話の種',
    'わたし解像度100%',
  ]);
  for (let score = 0; score <= 10; score += 1) {
    assert.equal(getChallengeResultTier(score), CHALLENGE_RESULT_TIERS[score]);
  }
  assert.equal(getChallengeResultTier(-10), CHALLENGE_RESULT_TIERS[0]);
  assert.equal(getChallengeResultTier(99), CHALLENGE_RESULT_TIERS[10]);
  assert.match(getChallengeResultTier(0).message, /まだ知らない話が10個見つかった/);
  for (const score of [1, 2, 3]) {
    assert.match(getChallengeResultTier(score).message, /ここから話すほど/);
  }
  for (const score of [4, 5]) {
    assert.match(getChallengeResultTier(score).message, /分かるところ|半分/);
  }
  for (const score of [7, 8, 9]) {
    assert.match(getChallengeResultTier(score).message, /かなり分かっている/);
    assert.match(getChallengeResultTier(score).message, /発見/);
  }
  assert.match(getChallengeResultTier(10).message, /10問すべて同じ答え。理解度ぴったり/);
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

test('0点の答え合わせレポートも失敗扱いせず10個の発見として案内する', () => {
  const answers = Array.from({ length: 10 }, (_, index) => ({
    match: false,
    card: { title: `お題${index + 1}` },
  }));
  const review = getChallengeReviewLines({
    score: 0,
    participant: { name: 'ゆう' },
    creatorName: 'ちあき',
    answers,
  });

  assert.equal(review.length, 4);
  assert.match(review.join(' '), /10問すべてが新しい発見/);
  assert.doesNotMatch(review.join(' '), /見習い|分かってる風|惜し/);
});
