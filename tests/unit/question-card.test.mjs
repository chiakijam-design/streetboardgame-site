import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderNotebookQuestionCard,
} from '../../src/challenge/question-card.js';

const sourceCard = {
  id: 'Q037',
  title: '人生を漢字1文字で表すと',
  choices: ['楽', '幸', '金', '無', '苦'],
};

test('共通お題は完成済み画像を使わず共通SVGで描画する', () => {
  const card = { ...sourceCard };
  const markup = renderNotebookQuestionCard(card);
  assert.match(markup, /<svg[\s\S]+viewBox="0 0 756 1122"/);
  assert.doesNotMatch(markup, /<picture/);
});

test('編集した問題も同じ共通SVGで描画する', () => {
  const edited = {
    ...sourceCard,
    title: '編集した問題',
  };
  const markup = renderNotebookQuestionCard(edited);
  assert.match(markup, /<svg[\s\S]+viewBox="0 0 756 1122"/);
  assert.doesNotMatch(markup, /<picture/);
});

test('自作問題も同じ縦横比のノートカードで描画する', () => {
  const markup = renderNotebookQuestionCard({
    id: 'Q001',
    title: '休み時間にしたいこと',
    choices: ['話す', '動画', 'ゲーム', '勉強', '寝る'],
  });
  assert.match(markup, /viewBox="0 0 756 1122"/);
  assert.match(markup, /休み時間にしたいこと/);
  assert.equal((markup.match(/<li>/g) || []).length, 5);
});

test('同じ画面に複数カードを描画してもSVG定義IDが重複しない', () => {
  const markup = [
    renderNotebookQuestionCard(sourceCard),
    renderNotebookQuestionCard({ ...sourceCard, id: 'Q038', title: '別のお題' }),
    renderNotebookQuestionCard({ ...sourceCard, id: 'Q039', title: 'もう一つのお題' }),
  ].join('');
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const references = [...markup.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);

  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(references.every((id) => ids.includes(id)), true);
});
