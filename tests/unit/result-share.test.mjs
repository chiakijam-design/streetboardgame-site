import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { shareResult, whatsappShareUrl, resultSocialUrl, resultShareMarkup } from '../../src/platform/resultShare.js';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { createCatalogTranslator } from '../../src/i18n/catalog-core.js';

const payload = { src: 'data:image/png;base64,aW1hZ2U=', filename: 'result.png', title: 'Result', text: 'Public text\nhttps://example.com/ar/challenge?room=PUBLIC', url: 'https://example.com/ar/challenge?room=PUBLIC' };
const env = (navigatorRef) => ({ navigatorRef, windowRef: { isSecureContext: true }, FileRef: File });
test('desktop capability detection passes image and locale invitation without awaiting other work', async () => {
  let called = false;
  const promise = shareResult(payload, env({ userAgent: 'Desktop', canShare: () => true, share: async (data) => {
    called = true;
    assert.equal(data.url, payload.url);
    assert.equal(data.files[0].name, 'result.png');
    assert.equal(await data.files[0].text(), 'image');
  } }));
  assert.equal(called, true);
  assert.equal(await promise, 'handed-off-image');
});
test('files denied or canShare absent uses link only; combined payload denied preserves link', async () => {
  for (const canShare of [undefined, () => false, (data) => !data.url]) {
    let received;
    assert.equal(await shareResult(payload, env({ canShare, share: async (data) => { received = data; } })), 'handed-off-link');
    assert.equal(received.files, undefined);
    assert.equal(received.url, payload.url);
  }
});
test('cancel and API rejection do not trigger a second share or claim posting success', async () => {
  for (const name of ['AbortError', 'NotAllowedError', 'TypeError', 'InvalidStateError']) {
    let calls = 0;
    const outcome = await shareResult(payload, env({ canShare: () => true, share: async () => { calls++; throw Object.assign(new Error(), { name }); } }));
    assert.equal(outcome, name === 'AbortError' ? 'cancelled' : 'unavailable');
    assert.equal(calls, 1);
  }
});
test('missing secure context/API/activation never invokes the share sheet', async () => {
  let called = false;
  const nav = { share: async () => { called = true; }, userActivation: { isActive: false } };
  assert.equal(await shareResult(payload, env(nav)), 'unavailable');
  assert.equal(await shareResult(payload, { ...env({ ...nav, userActivation: { isActive: true } }), windowRef: { isSecureContext: false } }), 'unavailable');
  assert.equal(await shareResult(payload, env({})), 'unavailable');
  assert.equal(called, false);
});
test('WhatsApp uses official text URL with complete Unicode invitation, no attachment parameter', () => {
  const text = '結果 & friends? 🌍\n' + payload.url;
  const url = new URL(whatsappShareUrl(text));
  assert.equal(url.origin + url.pathname, 'https://wa.me/');
  assert.equal(url.searchParams.get('text'), text);
  assert.equal([...url.searchParams].length, 1);
});
test('SNS helpers request HTTPS web intents without guessing installed apps', () => {
  for (const action of ['x', 'line', 'whatsapp']) {
    const url = new URL(resultSocialUrl(action, payload.text));
    assert.equal(url.protocol, 'https:');
    assert.ok(decodeURIComponent(url.href).includes(payload.url));
  }
  assert.throws(() => resultSocialUrl('unknown', payload.text));
});
test('all 34 locales include natural share controls and attachment guidance', async () => {
  const root = new URL('../../', import.meta.url);
  const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root)));
  const supplement = JSON.parse(await readFile(new URL('data/translation-supplement-public-html.json', root)));
  const source = JSON.parse(await readFile(new URL('data/result-share-translations.json', root)));
  for (const locale of TARGET_LOCALES) {
    const translate = locale === 'ja' ? (value) => value : createCatalogTranslator([...corpus.entries, ...supplement.entries], JSON.parse(await readFile(new URL(`src/i18n/catalogs/${locale}.json`, root))).messages, { aliases: corpus.aliases }).translate;
    const html = resultShareMarkup({ translate, escape: (value) => value });
    for (const message of source.sources.slice(0, 5)) {
      if (locale !== 'ja') assert.notEqual(translate(message), message, locale);
      assert.ok(html.includes(translate(message)), locale);
    }
    for (const action of ['native', 'copy', 'save', 'x', 'line', 'whatsapp', 'instagram']) assert.ok(html.includes(`data-result-share="${action}"`), locale);
  }
});
