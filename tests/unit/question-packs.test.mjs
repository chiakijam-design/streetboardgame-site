import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { questionPackBySlug, questionPackCards, questionPacks } from '../../src/challenge/packs.js';

function loadCards(filename, variableName) {
  const context = { window: {} };
  vm.runInNewContext(
    readFileSync(new URL(`../../${filename}`, import.meta.url), 'utf8'),
    context,
  );
  return context.window[variableName];
}

const japaneseCards = loadCards('prototype_common_data.js', 'COMMON_QUESTION_CARDS');
const englishCards = loadCards('prototype_english_common_data.js', 'ENGLISH_COMMON_QUESTION_CARDS');

test('画像付き10問パックを7種類提供する', () => {
  const packs = questionPacks(false);
  assert.deepEqual(
    packs.map(({ title }) => title),
    [
      '意外な一面が分かる10問',
      '初対面でも答えやすい10問',
      '推し・SNSについて話す10問',
      'もっと深く知る10問',
      'LIVEで盛り上がる10問',
      '夏休みの10問',
      '推し活の10問',
    ],
  );
  assert.equal(packs.every(({ image }) => image.startsWith('/assets/question-packs/')), true);
});

for (const [language, cards, isEnglish] of [
  ['日本語', japaneseCards, false],
  ['英語', englishCards, true],
]) {
  test(`${language}の各パックは重複のない有効な10問になる`, () => {
    for (const pack of questionPacks(isEnglish)) {
      const selected = questionPackCards(cards, pack.slug, isEnglish);
      assert.equal(selected.length, 10, pack.slug);
      assert.equal(new Set(selected.map(({ id }) => id)).size, 10, pack.slug);
      assert.equal(selected.every(({ choices }) => choices.length === 5), true, pack.slug);
    }
  });
}

test('存在しないパックは選択しない', () => {
  assert.equal(questionPackBySlug('not-found', false), null);
  assert.deepEqual(questionPackCards(japaneseCards, 'not-found', false), []);
});
