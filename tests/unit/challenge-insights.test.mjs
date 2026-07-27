import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuestionConversationInsights } from '../../src/challenge/insights.js';

const cards = Array.from({ length: 3 }, (_, index) => ({
  id: `Q${index + 1}`,
  title: `問題${index + 1}`,
  choices: ['A', 'B', 'C', 'D', 'E'],
}));

function participant(name, selections, correct = [0, 0, 0]) {
  return {
    name,
    submitted: true,
    answers: selections.map((selected, index) => ({
      selected,
      correct: correct[index],
      match: selected === correct[index],
    })),
  };
}

test('完成した回答だけから会話向けの3種類の問題ハイライトを作る', () => {
  const insights = buildQuestionConversationInsights(cards, [
    participant('A', [0, 1, 1]),
    participant('B', [1, 1, 1]),
    participant('C', [2, 0, 2]),
    participant('D', [3, 1, 2]),
    { name: '回答中', submitted: false, answers: [{ selected: 4, correct: 0 }] },
  ]);

  assert.equal(insights.completedCount, 4);
  assert.deepEqual(insights.questions[0].counts, [1, 1, 1, 1, 0]);
  assert.equal(insights.highlights.split.index, 0);
  assert.equal(insights.highlights.leastCorrect.index, 2);
  assert.equal(insights.highlights.surprising.index, 1);
  assert.equal(insights.highlights.surprising.unexpectedChoiceIndex, 1);
  assert.equal(insights.highlights.surprising.unexpectedCount, 3);
});

test('回答者が1人以下なら断定的なハイライトを出さず、選択人数だけ保持する', () => {
  const insights = buildQuestionConversationInsights(cards, [
    participant('A', [4, 0, 2]),
  ]);

  assert.equal(insights.completedCount, 1);
  assert.equal(insights.highlights.split, null);
  assert.equal(insights.highlights.leastCorrect, null);
  assert.equal(insights.highlights.surprising, null);
  assert.deepEqual(insights.questions[0].counts, [0, 0, 0, 0, 1]);
});
