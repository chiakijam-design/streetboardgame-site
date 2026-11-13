import assert from 'node:assert/strict';
import test from 'node:test';
import { isPerfectResult, perfectTitle, perfectPopupCopy, PERFECT_LOCALES } from '../../src/challenge/perfect.js';
import { CHALLENGE_RESULT_TIERS, CHALLENGE_RESULT_TIERS_EN } from '../../src/challenge/result.js';
import { CHALLENGE_RESULT_COPY } from '../../src/i18n/challenge-result-copy.js';

const answers = (n) => Array.from({ length: n }, () => ({ match: true }));

test('only a full score counts as perfect', () => {
  assert.equal(isPerfectResult({ score: 10, answers: answers(10) }), true);
  assert.equal(isPerfectResult({ score: 9, answers: answers(10) }), false);
  assert.equal(isPerfectResult({ score: 3, answers: answers(3) }), true);
  assert.equal(isPerfectResult({ score: 0, answers: [] }), false);
  assert.equal(isPerfectResult(null), false);
});

test('perfect title puts the creator name into every locale', () => {
  assert.equal(perfectTitle('ゆう', 'ja'), 'ゆう王');
  assert.equal(perfectTitle('Alex', 'en'), 'King of Alex');
  assert.equal(perfectTitle('', 'ja'), '出題者王');
  assert.equal(perfectTitle('A'.repeat(40), 'ja'), `${'A'.repeat(24)}王`);
  // Same locale set as the existing result-screen copy (ja + 33 languages).
  assert.deepEqual([...PERFECT_LOCALES].sort(), Object.keys(CHALLENGE_RESULT_COPY).sort());
  for (const locale of PERFECT_LOCALES) assert.match(perfectTitle('Mio', locale), /Mio/, locale);
  assert.equal(perfectTitle('Mio', 'xx'), 'King of Mio');
});

test('perfect popup copy exists for every locale', () => {
  for (const locale of PERFECT_LOCALES) {
    const copy = perfectPopupCopy(locale);
    for (const key of ['heading', 'lead', 'share', 'close']) assert.ok(copy[key]?.trim(), `${locale}.${key}`);
  }
  assert.deepEqual(perfectPopupCopy('ja'), { heading: '満点でした！', lead: 'この結果をみんなに伝えましょう', share: '結果を共有', close: '閉じる' });
  assert.equal(perfectPopupCopy('xx').heading, 'Perfect score!');
});

test('ja/en result cards have a 4-line comment; the 2-line message stays as the translation key', () => {
  assert.equal(CHALLENGE_RESULT_TIERS.length, 11);
  for (const tier of CHALLENGE_RESULT_TIERS) {
    const lines = tier.messageLong.split('\n');
    assert.equal(lines.length, 4, tier.title);
    for (const line of lines) assert.ok([...line].length <= 20, `${tier.title}: ${line}`);
    assert.equal(tier.message.split('\n').length, 2, tier.title);
  }
  for (const tier of CHALLENGE_RESULT_TIERS_EN) {
    assert.equal(tier.messageLong.split('\n').length, 4, tier.title);
    assert.equal(tier.message.split('\n').length, 2, tier.title);
  }
});
