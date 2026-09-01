import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  CHALLENGE_RESULT_TIERS_EN,
  getChallengeResultTierEnglish,
  getChallengeReviewLinesEnglish,
} from '../../src/challenge/result.js';
import { applyManagedQuestionCards } from '../../src/questions/catalog.js';

const rootUrl = new URL('../../', import.meta.url);

function text(path) {
  return readFileSync(new URL(path, rootUrl), 'utf8');
}

test('日本語標準ライブラリは復元した158問を重複IDなし・各5択で保持する', () => {
  const context = { window: {} };
  vm.runInNewContext(text('prototype_common_data.js'), context);
  const cards = context.window.COMMON_QUESTION_CARDS;
  assert.equal(cards.length, 158);
  assert.equal(new Set(cards.map((card) => card.id)).size, 158);
  for (const card of cards) {
    assert.match(card.id, /^Q/);
    assert.equal(card.choices.length, 5, card.id);
    assert.ok(card.title.trim().length > 0, card.id);
  }
});

test('英語標準ライブラリは60問・各5択の共通配列として分離する', () => {
  const context = { window: {} };
  vm.runInNewContext(text('prototype_english_common_data.js'), context);
  const cards = context.window.ENGLISH_COMMON_QUESTION_CARDS;
  assert.equal(cards.length, 60);
  assert.equal(new Set(cards.map((card) => card.id)).size, 60);
  for (const card of cards) {
    assert.match(card.id, /^EN/);
    assert.equal(card.choices.length, 5, card.id);
    assert.ok(card.title.length >= 8, card.id);
    assert.equal(card.title.includes('です'), false, card.id);
  }
});

test('承認済みの自作お題は日本語版と英語版で混在しない', () => {
  const base = [{ id: 'ENF001', category: 'Food', title: 'Base', choices: ['A', 'B', 'C', 'D', 'E'] }];
  const managed = [
    {
      id: 'CUSJA1', sourceKind: 'custom', language: 'ja', status: 'approved',
      useChallenge: true, useLive: true, title: '日本語のお題', category: '友達',
      choices: ['一', '二', '三', '四', '五'],
    },
    {
      id: 'CUSEN1', sourceKind: 'custom', language: 'en', status: 'approved',
      useChallenge: true, useLive: true, title: 'English question', category: 'Friends',
      choices: ['One', 'Two', 'Three', 'Four', 'Five'],
    },
  ];
  const english = applyManagedQuestionCards(base, managed, 'challenge', 'en');
  const japanese = applyManagedQuestionCards([], managed, 'challenge', 'ja');
  assert.deepEqual(english.map((card) => card.id), ['ENF001', 'CUSEN1']);
  assert.deepEqual(japanese.map((card) => card.id), ['CUSJA1']);
});

test('英語結果は0点から10点まで11称号と英語総評を返す', () => {
  assert.equal(CHALLENGE_RESULT_TIERS_EN.length, 11);
  assert.deepEqual(CHALLENGE_RESULT_TIERS_EN.map((tier) => tier.score), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(CHALLENGE_RESULT_TIERS_EN.map((tier) => tier.title)).size, 11);
  assert.equal(getChallengeResultTierEnglish(0).title, '10 New Sides Discovered');
  assert.equal(getChallengeResultTierEnglish(10).title, 'You in 100% Focus');
  assert.match(getChallengeResultTierEnglish(0).message, /ten new things to talk about/i);
  assert.match(getChallengeResultTierEnglish(10).message, /All ten answers matched/);
  const review = getChallengeReviewLinesEnglish({
    score: 1,
    creatorName: 'Mia',
    participant: { name: 'Alex' },
    answers: [
      { match: true, card: { title: 'Favorite food' } },
      { match: false, card: { title: 'Dream trip' } },
    ],
  });
  assert.equal(review.length, 4);
  assert.match(review.join(' '), /Favorite food/);
  assert.match(review.join(' '), /Dream trip/);
});

test('英語ルート・hreflang・専用OGP・初回言語案内を静的構成にもつ', () => {
  const worker = text('_worker.js');
  const switchSource = text('language_switch.js');
  const sitemap = text('sitemap.xml');
  for (const route of ['/en/', '/en/challenge', '/en/live-challenge', '/en/terms', '/en/privacy']) {
    assert.ok(worker.includes(route.replace(/\/$/, '') || '/en'), route);
    assert.ok(sitemap.includes(`<loc>https://www.streetboardgame.com${route}</loc>`), route);
  }
  assert.match(switchSource, /navigator\.languages/);
  assert.match(switchSource, /watachan:language:v1/);
  assert.match(switchSource, /English version available/);
  assert.match(switchSource, /if \(!topPage\) return/);
  assert.match(switchSource, /\.site-language-switch\{position:absolute/);
  assert.doesNotMatch(switchSource, /\.site-language-switch\{position:fixed/);
  for (const page of ['en/index.html', 'en/terms.html', 'en/privacy.html']) {
    const html = text(page);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /hreflang="ja"/);
    assert.match(html, /hreflang="en"/);
  }
  for (const page of ['index.html', 'en/index.html']) {
    assert.match(text(page), /<script[^>]*\bsrc="\/language_switch\.js/);
  }
  for (const page of [
    'challenge.html',
    'live_challenge.html',
    'terms.html',
    'privacy.html',
    'en/terms.html',
    'en/privacy.html',
  ]) {
    assert.doesNotMatch(text(page), /language_switch\.js/, page);
  }
  assert.ok(statSync(new URL('assets/ogp-challenge-en.png', rootUrl)).size > 100_000);
});
