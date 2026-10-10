import assert from 'node:assert/strict';
import test from 'node:test';
import { localizePublicHtml, localizedAssetRoute, safeScriptJson, injectPublicLocaleShell } from '../../src/i18n/public-html.js';

const data = { entries: [{ id: 'greeting', source: 'Welcome' }], aliases: {}, catalog: {
  locale: 'ar', provenance: { method: 'machine-generated', nativeReview: false }, messages: { greeting: 'أهلاً <script>evil()</script>' },
} };
test('server copy is escaped, scripts preserved and room capabilities absent from canonical metadata', () => {
  const html = '<html lang="ja"><head><title>Welcome</title><link rel="canonical" href="https://old.example/"></head><body><h1>Welcome</h1><a href="/challenge?room=public-code#manage=private">Welcome</a><script>const label="Welcome";</script></body></html>';
  const output = localizePublicHtml(html, data, new URL('https://www.streetboardgame.com/ar/challenge?room=public-code#manage=private'), ['ja', 'ar']);
  assert.match(output, /lang="ar" dir="rtl"/);
  assert.match(output, /أهلاً &lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.match(output, /<script>const label="Welcome";<\/script>/);
  assert.match(output, /href="\/ar\/challenge\?room=public-code#manage=private"/);
  assert.match(output, /rel="canonical" href="https:\/\/www.streetboardgame.com\/ar\/challenge"/);
  assert.doesNotMatch(output.match(/<head>[\s\S]*?<\/head>/)[0], /public-code|#manage/);
  assert.match(output, /hreflang="ja"/);
  assert.ok(output.indexOf('__WATACHAN_ANALYTICS_LOCALE_REVIEW_PENDING__') < output.indexOf('<title>'));
});
test('route selection never localizes APIs, management tools or retired games', () => {
  assert.equal(localizedAssetRoute('/ar/challenge/manage'), '/challenge.html');
  assert.equal(localizedAssetRoute('/zh-Hant/live-challenge'), '/live_challenge.html');
  assert.equal(localizedAssetRoute('/es/challenge-guide'), '/challenge-guide');
  for (const path of ['/ar/api/live', '/ar/live-ops', '/ar/remote', '/ar/love']) assert.equal(localizedAssetRoute(path), null);
});
test('serialized public catalog cannot close its script element', () => {
  assert.doesNotMatch(safeScriptJson({ copy: '</script><script>alert(1)</script>' }), /</);
});

test('localized HTML preserves root asset locations while retaining responsive image descriptors', () => {
  const output = localizePublicHtml('<html><head></head><body><img src="assets/girl.webp"><source srcSet="assets/girl-320.webp 320w, ./assets/girl-640.webp 640w"><img src="https://example.com/photo.webp"></body></html>', data, new URL('https://www.streetboardgame.com/ar/'), ['ja', 'ar']);
  assert.match(output, /src="\/assets\/girl.webp"/);
  assert.match(output, /srcSet="\/assets\/girl-320.webp 320w, \/assets\/girl-640.webp 640w"/);
  assert.match(output, /src="https:\/\/example.com\/photo.webp"/);
});

test('Japanese navigation exposes completed locales without changing original copy or leaking capabilities', () => {
  const html = '<html lang="ja"><head><link rel="canonical" href="https://old.example/"></head><body>元の日本語</body></html>';
  const output = injectPublicLocaleShell(html, new URL('https://www.streetboardgame.com/challenge?room=TEST#manage=TEST'), ['ja', 'en', 'ar']);
  assert.match(output, /元の日本語/);
  assert.match(output, /hreflang="ar" href="https:\/\/www.streetboardgame.com\/ar\/challenge"/);
  assert.doesNotMatch(output, /room=TEST|manage=TEST/);
});

test('structured metadata follows the actual URL locale and a mismatched catalog is rejected', () => {
  const output = localizePublicHtml('<html><head><script type="application/ld+json">{"name":"Welcome","inLanguage":"ja","url":"https://www.streetboardgame.com/challenge"}</script></head><body></body></html>', data, new URL('https://www.streetboardgame.com/ar/challenge'), ['ja', 'ar']);
  assert.match(output, /"inLanguage":"ar"/);
  assert.match(output, /"url":"https:\/\/www.streetboardgame.com\/ar\/challenge"/);
  assert.throws(() => localizePublicHtml('<html></html>', data, new URL('https://www.streetboardgame.com/fr/')), /locale mismatch/);
});
