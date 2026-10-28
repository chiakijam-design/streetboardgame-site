import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { challengeStartCopy } from '../../src/i18n/challenge-start-copy.js';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { createCatalogTranslator } from '../../src/i18n/catalog-core.js';
import { translateLegacyEnglish } from '../../src/i18n/legacy-copy.js';

for (const locale of TARGET_LOCALES) test(`${locale}: start instructions allow 1–10 questions and retain the 50-player cap`, () => {
  const data = locale === 'ja' ? null : JSON.parse(fs.readFileSync(new URL(`../../locale-assets/${locale}.json`, import.meta.url)));
  const translator = data && createCatalogTranslator(data.entries, data.catalog.messages, { aliases: data.aliases });
  const translate = (text) => {
    const direct = translator.translate(text);
    return direct !== text ? direct : translator.translate(translateLegacyEnglish(text));
  };
  const copy = challengeStartCopy(locale, translate);
  const range = locale === 'ja' ? '1〜10' : '1–10';
  assert.ok(copy.intro.includes(range), copy.intro);
  assert.ok(copy.step.includes(range), copy.step);
  assert.match(copy.intro, /50/);
  assert.doesNotMatch(copy.intro + copy.step, /undefined|<[^>]*>/);
  if (locale !== 'ja') assert.doesNotMatch(copy.intro + copy.step, /[ぁ-んァ-ン]/);
});
