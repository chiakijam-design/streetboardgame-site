import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyQuestionPacks, questionPacks } from '../../src/challenge/packs.js';
import { CHALLENGE_COPY, CHALLENGE_CONVERSATION_COPY, challengeCopy } from '../../src/i18n/challenge-copy.js';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
test('weekly editorial picks switch at Monday midnight JST and are stable through the week', () => {
  const before=weeklyQuestionPacks(false,Date.parse('2026-10-25T14:59:59Z'));
  const after=weeklyQuestionPacks(false,Date.parse('2026-10-25T15:00:00Z'));
  assert.equal(before.weekStart,'2026-10-19');assert.equal(after.weekStart,'2026-10-26');
  assert.notDeepEqual(before.packs.map(p=>p.slug),after.packs.map(p=>p.slug));
  assert.deepEqual(after,weeklyQuestionPacks(false,Date.parse('2026-10-31T12:00:00Z')));
  assert.equal(new Set(after.packs.map(p=>p.slug)).size,3);
  assert.ok(after.packs.every(p=>questionPacks().some(approved=>approved.slug===p.slug)));
  assert.deepEqual(after.packs.map(p=>p.slug),weeklyQuestionPacks(true,Date.parse('2026-10-26T01:00:00Z')).packs.map(p=>p.slug));
  assert.throws(()=>weeklyQuestionPacks(false,NaN));
});
test('all 34 locales include the new completion, sharing, weekly and role-swap copy', () => {
  assert.equal(Object.keys(CHALLENGE_COPY).length,TARGET_LOCALES.length);
  assert.equal(Object.keys(CHALLENGE_CONVERSATION_COPY).length,TARGET_LOCALES.length);
  for(const locale of TARGET_LOCALES) {
    assert.ok(CHALLENGE_CONVERSATION_COPY[locale]?.trim(),locale);
    assert.equal(challengeCopy(locale,'talk'),CHALLENGE_CONVERSATION_COPY[locale]);
  }
  for(const locale of TARGET_LOCALES) for(const key of ['finish','confirm','create','send','first','weekly','empty','swap']) {
    assert.ok(CHALLENGE_COPY[locale]?.[key]?.trim(),`${locale}/${key}`);
    assert.equal(challengeCopy(locale,key),CHALLENGE_COPY[locale][key]);
  }
});
