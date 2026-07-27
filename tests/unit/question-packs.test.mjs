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

const expectedJapanesePackTop10 = Object.freeze({
  'unexpected-side': ['Q307', 'HLD134', 'HLD070', 'HLD071', 'HLD072', 'HLD075', 'HLD123', 'HLD129', 'HLD141', 'HLD112'],
  'easy-first-meeting': ['HLD014', 'HLD079', 'HLD087', 'HLD090', 'HLD181', 'HLD182', 'HLD183', 'HLD188', 'HLD194', 'HLD197'],
  'fandom-social': ['HLD127', 'HLD128', 'HLD132', 'HLD136', 'HLD046', 'Q067', 'HLD048', 'HLD112', 'HLD193', 'HLD194'],
  'know-me-deeper': ['HLD162', 'HLD168', 'HLD167', 'HLD158', 'HLD157', 'HLD159', 'HLD150', 'HLD152', 'HLD147', 'HLD133'],
  'live-party': ['HLD143', 'HLD144', 'HLD148', 'HLD149', 'HLD154', 'HLD155', 'HLD172', 'HLD174', 'HLD175', 'HLD188'],
  'summer-vacation': ['HLD140', 'HLD139', 'HLD120', 'HLD189', 'HLD195', 'HLD111', 'HLD018', 'Q428', 'HLD149', 'HLD171'],
  'oshi-life': ['HLD127', 'HLD128', 'HLD132', 'HLD112', 'HLD130', 'HLD136', 'HLD141', 'HLD145', 'HLD193', 'HLD194'],
  'live-comment-split': ['HLD181', 'HLD182', 'HLD183', 'HLD184', 'HLD186', 'HLD187', 'HLD188', 'HLD192', 'HLD177', 'HLD176'],
  'live-first-viewers': ['HLD101', 'HLD103', 'HLD105', 'HLD108', 'HLD109', 'HLD110', 'HLD111', 'HLD114', 'HLD176', 'HLD197'],
  'live-streamer-surprises': ['Q307', 'HLD134', 'HLD123', 'HLD117', 'HLD118', 'HLD124', 'HLD125', 'HLD130', 'HLD138', 'HLD174'],
  'live-small-stream': ['HLD156', 'HLD160', 'HLD161', 'HLD162', 'HLD165', 'HLD166', 'HLD167', 'HLD168', 'HLD169', 'HLD170'],
});

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

test('Japanese pack top 10 selections stay fixed after the theme review', () => {
  const packs = [...questionPacks(false), ...liveExclusiveQuestionPacks(false)];
  assert.deepEqual(
    Object.fromEntries(packs.map((pack) => [pack.slug, pack.questionIds.slice(0, 10)])),
    expectedJapanesePackTop10,
  );
  assert.equal(
    new Set(Object.values(expectedJapanesePackTop10).flat()).size,
    83,
  );
});
