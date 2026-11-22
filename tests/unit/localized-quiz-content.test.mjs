import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomShareCopy } from '../../src/challenge/share-meta.js';
import { questionPacks } from '../../src/challenge/packs.js';
import { getChallengeReviewLines, getChallengeReviewLinesEnglish } from '../../src/challenge/result.js';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { localizeLinkedHtml } from '../../src/i18n/linked-paragraphs.js';

test('each international pack has ten questions exclusive to its theme', () => {
  const packs = questionPacks(true);
  const ids = packs.flatMap(pack => pack.questionIds);
  assert.equal(packs.length, 9);
  for (const pack of packs) assert.equal(pack.questionIds.length, 10, pack.slug);
  assert.equal(new Set(ids).size, ids.length);
});

test('all invitation locales handle ordinary and redacted names at both question counts', () => {
  for (const count of [1, 10]) {
    const titles = new Set();
    for (const locale of TARGET_LOCALES) {
      const personal = roomShareCopy(locale, { name: 'Alex', count });
      const generic = roomShareCopy(locale, { name: 'spam.com', count });
      assert.ok(personal.title.includes('Alex'), locale);
      assert.ok(personal.description.includes(String(count)), locale);
      assert.ok(generic.description.includes(String(count)), locale);
      assert.ok(!generic.title.includes('spam.com') && !generic.description.includes('spam.com'), locale);
      titles.add(personal.title);
    }
    assert.equal(titles.size, TARGET_LOCALES.length);
  }
});

test('short reviews label hits, surprises and the next topic without altering card titles', () => {
  const result = { score: 1, answers: [
    { match: true, card: { title: 'Card A' } },
    { match: false, card: { title: 'Card B' } },
  ] };
  for (const locale of TARGET_LOCALES) {
    const [score, hit, miss, topic] = locale === 'ja'
      ? getChallengeReviewLines(result)
      : getChallengeReviewLinesEnglish(result, locale);
    assert.equal(score, '1/2');
    for (const [line, title] of [[hit, 'Card A'], [miss, 'Card B'], [topic, 'Card B']]) {
      assert.ok(line.endsWith(title) && /\p{L}/u.test(line.slice(0, -title.length)), locale);
    }
    assert.notEqual(miss, topic);
  }
});

test('privacy paragraphs retain their original anchors and protected HTML', () => {
  const page = readFileSync(new URL('../../privacy.html', import.meta.url), 'utf8');
  const paragraph = page.match(/<p>Google Analytics 4では[\s\S]*?<\/p>/)[0];
  const anchor = paragraph.match(/<a\b[^>]*>/)[0];
  const protectedHtml = '<script>' + paragraph + '</script><!--' + paragraph + '-->';
  for (const locale of ['en', 'es', 'pt']) {
    const translated = localizeLinkedHtml(paragraph + protectedHtml, locale, value => value);
    assert.ok(translated.startsWith('<p>'));
    assert.ok(translated.endsWith(protectedHtml));
    assert.ok(translated.includes(anchor));
    assert.ok(!translated.slice(0, -protectedHtml.length).includes('で確認できます'));
  }
});
