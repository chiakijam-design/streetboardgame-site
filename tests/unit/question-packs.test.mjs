import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import {
  liveExclusiveQuestionPacks,
  liveQuestionPackBySlug,
  questionPackBySlug,
  questionPackCards,
  questionPacks,
} from '../../src/challenge/packs.js';

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

function cardsWithManagedPackCandidates(packs, cards) {
  const managedIds = [...new Set(
    packs.flatMap(({ questionIds }) => questionIds)
      .filter((id) => String(id).startsWith('HLD')),
  )];
  return [
    ...cards,
    ...managedIds.map((id) => ({
      id,
      title: `管理対象 ${id}`,
      choices: ['1', '2', '3', '4', '5'],
    })),
  ];
}

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

test('LIVE版専用の画像付き10問パックを4種類提供する', () => {
  const packs = liveExclusiveQuestionPacks(false);
  assert.deepEqual(
    packs.map(({ title }) => title),
    [
      'コメント欄が割れそうな10問',
      '初見視聴者も答えやすい10問',
      '配信者の意外な一面が分かる10問',
      '30人以下の配信向け10問',
    ],
  );
  assert.equal(packs.every(({ image }) => image.startsWith('/assets/question-packs/live-')), true);
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

  test(`${language}のLIVE専用パックは重複のない有効な10問になる`, () => {
    for (const pack of liveExclusiveQuestionPacks(isEnglish)) {
      const selected = questionPackCards(cards, pack.slug, isEnglish, 10, { includeLive: true });
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

test('LIVE専用パックは通常版から選べず、LIVE版からだけ選べる', () => {
  assert.equal(questionPackBySlug('live-comment-split', false), null);
  assert.equal(liveQuestionPackBySlug('live-comment-split', false)?.title, 'コメント欄が割れそうな10問');
  assert.deepEqual(questionPackCards(japaneseCards, 'live-comment-split', false), []);
  assert.equal(
    questionPackCards(japaneseCards, 'live-comment-split', false, 10, { includeLive: true }).length,
    10,
  );
});

test('日本語パックは採用済みの新規候補を含む先頭10問を優先する', () => {
  const packs = [...questionPacks(false), ...liveExclusiveQuestionPacks(false)];
  const cards = cardsWithManagedPackCandidates(packs, japaneseCards);

  for (const pack of packs) {
    const selected = questionPackCards(
      cards,
      pack.slug,
      false,
      10,
      { includeLive: true },
    );
    assert.deepEqual(
      selected.map(({ id }) => id),
      pack.questionIds.slice(0, 10),
      pack.slug,
    );
  }
});
