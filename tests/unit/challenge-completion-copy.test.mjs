import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE_COPY } from '../../src/i18n/challenge-copy.js';
import { CHALLENGE_COMPLETION_COPY, challengeCompletionCopy } from '../../src/i18n/challenge-completion-copy.js';

test('completion copy covers every locale and supported length without unfinished fractions', () => {
  assert.deepEqual(Object.keys(CHALLENGE_COMPLETION_COPY), Object.keys(CHALLENGE_COPY));
  for (const locale of Object.keys(CHALLENGE_COPY)) {
    for (let maximum = 1; maximum <= 10; maximum++) for (let count = 0; count <= maximum; count++) {
      const copy = challengeCompletionCopy(locale, count, maximum);
      assert.ok(copy.label && copy.help);
      assert.doesNotMatch(copy.label + copy.help, /\{count\}|\{max\}|\d+\/10|undefined/);
    }
  }
});

test('approved Japanese copy states that the selected count is a complete quiz', () => {
  assert.equal(challengeCompletionCopy('ja', 1).label, 'この1問でクイズを作成');
  assert.equal(challengeCompletionCopy('ja', 2).label, 'この2問でクイズを作成');
  assert.equal(challengeCompletionCopy('ja', 9).label, 'この9問でクイズを作成');
  assert.equal(challengeCompletionCopy('ja', 1).help, '1問から作れます。最大10問まで追加できます。');
  assert.equal(challengeCompletionCopy('ja', 0).label, 'クイズを作成');
  assert.equal(challengeCompletionCopy('ja', 0, 2).help, '1問から作れます。最大2問まで追加できます。');
});

test('singular, plural and Arabic dual remain grammatical', () => {
  assert.equal(challengeCompletionCopy('en', 1).label, 'Create a quiz with 1 question');
  assert.equal(challengeCompletionCopy('en', 2).label, 'Create a quiz with 2 questions');
  assert.equal(challengeCompletionCopy('en', 0, 1).help, 'Create a quiz with 1 question.');
  assert.equal(challengeCompletionCopy('ar', 2).label, 'إنشاء اختبار من سؤالين');
  assert.equal(challengeCompletionCopy('ar', 3).label, 'إنشاء اختبار من 3 أسئلة');
  for (const args of [[-1, 10], [11, 10], [1.5, 10], [2, 1], [0, 0]]) assert.throws(() => challengeCompletionCopy('ja', ...args), RangeError);
});
