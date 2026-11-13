import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateAnswerStats, ANSWER_STATS_MINIMUM } from '../../src/challenge/api.js';

const cards = [
  { title: 'Q1', choices: ['a', 'b', 'c', 'd', 'e'] },
  { title: 'Q2', choices: ['a', 'b', 'c', 'd', 'e'] },
];
const done = (answers, extra = {}) => ({ id: Math.random().toString(36), name: 'secret-name', answers, completedAt: 1, ...extra });

test('respondents see no per-question counts below the minimum of three completed answers', () => {
  assert.equal(ANSWER_STATS_MINIMUM, 3);
  const stats = aggregateAnswerStats(cards, [done([0, 1]), done([2, 1])]);
  assert.deepEqual(stats, { minimum: 3, completed: 2, questions: null });
});

test('three or more completed answers return choice totals only, never names or who chose what', () => {
  const stats = aggregateAnswerStats(cards, [done([0, 1]), done([0, 4]), done([3, 1]), { answers: [2, 2], completedAt: null }]);
  assert.equal(stats.completed, 3);
  assert.deepEqual(stats.questions, [{ counts: [2, 0, 0, 1, 0], total: 3 }, { counts: [0, 2, 0, 0, 1], total: 3 }]);
  const json = JSON.stringify(stats);
  assert.equal(json.includes('secret-name'), false);
  assert.equal(/"id"|"name"|"answers"/.test(json), false);
});

test('incomplete or malformed answers are ignored', () => {
  const stats = aggregateAnswerStats(cards, [done([0, 1]), done([0, 1]), done([0, 1]), done([9, -1]), done([0])]);
  assert.equal(stats.completed, 4);
  assert.deepEqual(stats.questions[0].counts, [3, 0, 0, 0, 0]);
  assert.equal(stats.questions[1].total, 3);
});

test('managed participant answers ({selected, correct} objects) are counted the same way', () => {
  const obj = (a, b) => done([{ selected: a, correct: 0 }, { selected: b, correct: 0 }]);
  const stats = aggregateAnswerStats(cards, [obj(1, 1), obj(1, 2), obj(0, 1)]);
  assert.deepEqual(stats.questions.map((q) => q.counts), [[1, 2, 0, 0, 0], [0, 2, 1, 0, 0]]);
});
