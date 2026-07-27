import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { mergeChallengeCards } from '../../src/challenge/data.js';
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

const japaneseCards = mergeChallengeCards(loadCards('prototype_common_data.js', 'COMMON_QUESTION_CARDS'));
const englishCards = mergeChallengeCards(loadCards('prototype_english_common_data.js', 'ENGLISH_COMMON_QUESTION_CARDS'));

const expectedJapanesePackTop10 = Object.freeze({
  'easy-first-meeting': ['Q001', 'Q215', 'HLD087', 'HLD002', 'Q428', 'HLD086', 'Q427', 'HLD176', 'HLD046', 'HLD198'],
  'school-after-school': ['HLD032', 'Q209', 'HLD028', 'HLD200', 'HLD119', 'Q214', 'HLD214', 'HLD213', 'HLD228', 'HLD496'],
  'food-preferences': ['Q401', 'Q414', 'HLD014', 'Q007', 'HLD079', 'HLD181', 'Q018', 'Q507', 'HLD199', 'HLD184'],
  'my-manual': ['HLD101', 'HLD292', 'HLD353', 'HLD133', 'HLD008', 'Q302', 'HLD060', 'HLD158', 'HLD162', 'HLD297'],
  'unexpected-side': ['Q307', 'HLD134', 'Q305', 'Q547', 'HLD071', 'HLD381', 'HLD382', 'HLD384', 'HLD385', 'HLD388'],
  'holiday-outings': ['HLD055', 'HLD006', 'HLD145', 'HLD146', 'HLD188', 'HLD189', 'Q519', 'HLD111', 'HLD149', 'HLD113'],
  'smartphone-social-fandom': ['Q416', 'Q045', 'Q067', 'Q079', 'HLD253', 'HLD255', 'HLD127', 'HLD132', 'HLD442', 'HLD141'],
  'values-future': ['Q150', 'HLD057', 'HLD168', 'HLD056', 'HLD341', 'HLD063', 'HLD152', 'HLD336', 'HLD174', 'Q435'],
  'memories-past': ['HLD120', 'HLD026', 'HLD117', 'HLD118', 'Q208', 'HLD277', 'HLD124', 'HLD271', 'HLD275', 'HLD397'],
  'live-comment-split': ['Q406', 'Q410', 'Q412', 'HLD144', 'Q434', 'HLD143', 'HLD313', 'HLD315', 'Q433', 'Q438'],
  'live-first-viewers': ['HLD096', 'Q423', 'Q407', 'Q422', 'Q418', 'HLD085', 'Q293', 'Q432', 'HLD159', 'Q442'],
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

test('通常版に画像付き10問パックを9種類提供する', () => {
  const packs = questionPacks(false);
  assert.deepEqual(
    packs.map(({ title }) => title),
    [
      '初対面でも答えやすい10問',
      '学校・放課後の10問',
      '食べものの好み10問',
      'わたしのトリセツ10問',
      '意外な一面が分かる10問',
      '休日とおでかけの10問',
      'スマホ・SNS・推しの10問',
      '価値観と未来の10問',
      '思い出と昔の自分10問',
    ],
  );
  assert.equal(packs.every(({ image }) => image.startsWith('/assets/question-packs/')), true);
});

test('LIVE版専用の画像付き10問パックを2種類提供する', () => {
  const packs = liveExclusiveQuestionPacks(false);
  assert.deepEqual(
    packs.map(({ title }) => title),
    [
      'LIVEで答えが割れる10問',
      'LIVE初見でも即答できる10問',
    ],
  );
  assert.equal(packs.every(({ image }) => image.startsWith('/assets/question-packs/live-')), true);
});

test('最初に表示する主力6パックを固定する', () => {
  const featuredSlugs = [
    ...questionPacks(false),
    ...liveExclusiveQuestionPacks(false),
  ].filter(({ featured }) => featured).map(({ slug }) => slug);
  assert.deepEqual(featuredSlugs, [
    'easy-first-meeting',
    'school-after-school',
    'food-preferences',
    'my-manual',
    'unexpected-side',
    'live-comment-split',
  ]);
});

for (const [language, cards, isEnglish] of [
  ['日本語', japaneseCards, false],
  ['英語', englishCards, true],
]) {
  test(`${language}の通常版パックは重複のない有効な10問になる`, () => {
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
  assert.equal(liveQuestionPackBySlug('live-comment-split', false)?.title, 'LIVEで答えが割れる10問');
  assert.deepEqual(questionPackCards(japaneseCards, 'live-comment-split', false), []);
  assert.equal(
    questionPackCards(japaneseCards, 'live-comment-split', false, 10, { includeLive: true }).length,
    10,
  );
});

test('採用済みの管理問題がある場合は指定した先頭10問を優先する', () => {
  const packs = [...questionPacks(false), ...liveExclusiveQuestionPacks(false)];
  const cards = cardsWithManagedPackCandidates(packs, japaneseCards);

  for (const pack of packs) {
    const selected = questionPackCards(cards, pack.slug, false, 10, { includeLive: true });
    assert.deepEqual(
      selected.map(({ id }) => id),
      pack.questionIds.slice(0, 10),
      pack.slug,
    );
  }
});

test('11パックの先頭10問は重複のない110問に固定する', () => {
  const packs = [...questionPacks(false), ...liveExclusiveQuestionPacks(false)];
  assert.deepEqual(
    Object.fromEntries(packs.map((pack) => [pack.slug, pack.questionIds.slice(0, 10)])),
    expectedJapanesePackTop10,
  );
  assert.equal(
    new Set(Object.values(expectedJapanesePackTop10).flat()).size,
    110,
  );
});
