import test from 'node:test';
import assert from 'node:assert/strict';

import {
  originalQuestionCardImage,
  renderNotebookQuestionCard,
} from '../../src/challenge/question-card.js';

const sourceCard = {
  id: 37,
  image: 'assets/cards/37.png',
  title: '人生を漢字1文字で表すと',
  choices: ['楽', '幸', '金', '無', '苦'],
};

test.beforeEach(() => {
  globalThis.window = { ALL_CARDS: [sourceCard] };
});

test.afterEach(() => {
  delete globalThis.window;
});

test('元の42問は完成済みWebPカードをそのまま使う', () => {
  const card = {
    ...sourceCard,
    id: 'LOVE37',
    sourceId: 'LOVE37',
  };
  assert.equal(originalQuestionCardImage(card), '/assets/cards/37.webp');
  const markup = renderNotebookQuestionCard(card);
  assert.match(markup, /<picture class="notebook-question-card-picture">/);
  assert.match(markup, /src="\/assets\/cards\/37\.png"/);
});

test('編集した問題は古い完成画像を使わず共通SVGへ切り替える', () => {
  const edited = {
    ...sourceCard,
    id: 'LOVE37',
    sourceId: 'LOVE37',
    title: '編集した問題',
  };
  assert.equal(originalQuestionCardImage(edited), '');
  const markup = renderNotebookQuestionCard(edited);
  assert.match(markup, /<svg[\s\S]+viewBox="0 0 756 1122"/);
  assert.doesNotMatch(markup, /assets\/cards\/37/);
});

test('友達・家族・自作問題も同じ縦横比のノートカードで描画する', () => {
  const markup = renderNotebookQuestionCard({
    id: 'FQ001',
    title: '休み時間にしたいこと',
    choices: ['話す', '動画', 'ゲーム', '勉強', '寝る'],
  });
  assert.match(markup, /viewBox="0 0 756 1122"/);
  assert.match(markup, /休み時間にしたいこと/);
  assert.equal((markup.match(/<li>/g) || []).length, 5);
});
