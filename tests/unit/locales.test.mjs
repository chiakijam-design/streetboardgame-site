import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TARGET_LOCALES, CURRENT_PUBLIC_LOCALES, LOCALE_DETAILS,
  normalizeLocale, localeFromPath, stripLocalePrefix,
  switchLocalePath, localeCanonicalPath,
} from '../../src/i18n/locales.js';

test('validated public coverage matches the 34-locale reference and records unreviewed translation', () => {
  assert.equal(TARGET_LOCALES.length, 34);
  assert.equal(new Set(TARGET_LOCALES).size, 34);
  assert.deepEqual(CURRENT_PUBLIC_LOCALES, TARGET_LOCALES);
  assert.equal(TARGET_LOCALES.filter((locale) => !locale.startsWith('zh-')).length + 1, 33);
  for (const locale of TARGET_LOCALES) {
    assert.ok(LOCALE_DETAILS[locale].name);
    assert.equal(LOCALE_DETAILS[locale].nativeReview, 'not-verified');
  }
  assert.equal(LOCALE_DETAILS.fr.translationStatus, 'machine-generated-native-review-unverified');
  assert.equal(LOCALE_DETAILS.ar.direction, 'rtl');
  assert.equal(LOCALE_DETAILS.he.direction, 'rtl');
  assert.equal(LOCALE_DETAILS.hi.direction, 'ltr');
});

test('switching every locale preserves invite and management context and the Japanese URL', () => {
  const context = '?room=ABC123&pack=friends&role=swap#manage=PRIVATE_TEST_TOKEN';
  for (const locale of TARGET_LOCALES) {
    const switched = switchLocalePath('/en/challenge/manage' + context, locale);
    assert.equal(switched, LOCALE_DETAILS[locale].prefix + '/challenge/manage' + context);
    assert.equal(switchLocalePath(switched, 'ja'), '/challenge/manage' + context);
    assert.equal(localeCanonicalPath(switched, locale), LOCALE_DETAILS[locale].prefix + '/challenge');
    assert.equal(localeCanonicalPath(switched, locale).includes('PRIVATE_TEST_TOKEN'), false);
  }
  const live = '/live-challenge?room=123456#host=PRIVATE_TEST_HOST';
  assert.equal(switchLocalePath(live, 'ar'), '/ar' + live);
  assert.equal(localeCanonicalPath(live, 'ar'), '/ar/live-challenge');
  assert.equal(localeCanonicalPath('/ar/challenge/library?pack=friends', 'ar'), '/ar/challenge/library');
});

test('locale matching preserves Chinese script, stable root and rejects unsafe routes', () => {
  assert.equal(normalizeLocale('zh-hant'), 'zh-Hant');
  assert.equal(localeFromPath('/zh-Hans/challenge'), 'zh-Hans');
  assert.equal(localeFromPath('/challenge'), 'ja');
  assert.equal(stripLocalePrefix('/fr/challenge'), '/challenge');
  assert.equal(switchLocalePath('/en/?analytics=exclude', 'zh-Hant'), '/zh-Hant/?analytics=exclude');
  assert.equal(switchLocalePath('/en/', 'ja'), '/');
  for (const path of ['/api/challenge', '/live-ops', '/assets/ogp.jpg', '/love', '//evil.example/challenge']) {
    assert.throws(() => switchLocalePath(path, 'fr'), RangeError);
  }
  assert.throws(() => switchLocalePath('/challenge', 'xx'), RangeError);
});
