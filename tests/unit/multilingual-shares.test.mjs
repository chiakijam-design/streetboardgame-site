import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { createCatalogTranslator } from '../../src/i18n/catalog-core.js';
import { buildChallengeInviteText, openLineShare, openXShare } from '../../src/platform/share.js';

test('every translated invitation preserves the name and locale URL in LINE and X payloads', async () => {
  const root = new URL('../../', import.meta.url);
  const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root), 'utf8'));
  const supplement = JSON.parse(await readFile(new URL('data/translation-supplement-public-html.json', root), 'utf8'));
  for (const locale of TARGET_LOCALES.filter((value) => value !== 'ja')) {
    const catalog = JSON.parse(await readFile(new URL(`src/i18n/catalogs/${locale}.json`, root), 'utf8'));
    const { translate } = createCatalogTranslator([...corpus.entries, ...supplement.entries], catalog.messages, { aliases: corpus.aliases, protectedText: ['Home'] });
    const url = `https://www.streetboardgame.com/${locale}/challenge?room=PUBLIC_TEST_INVITE`;
    const original = buildChallengeInviteText({ creatorName: 'Home', url, isEnglish: true });
    const message = translate(original);
    assert.ok(message.includes('Home'), locale);
    assert.ok(message.includes(url), locale);
    if (locale !== 'en') assert.notEqual(message, original, locale);
    const windowRef = { location: { href: '' }, matchMedia: () => ({ matches: false }), open(href) { this.opened = href; } };
    const navigatorRef = { userAgent: 'Desktop test fixture' };
    const line = openLineShare(message, { windowRef, navigatorRef });
    assert.equal(decodeURIComponent(line.split('?')[1]), message, locale);
    const x = openXShare(message, { windowRef, navigatorRef });
    assert.equal(new URL(x).searchParams.get('text'), message, locale);
    assert.equal(windowRef.opened, x, locale);
    assert.equal(openLineShare(message, { windowRef, navigatorRef: { userAgent: 'Android' } }), 'line://msg/text/' + encodeURIComponent(message), locale);
  }
});
