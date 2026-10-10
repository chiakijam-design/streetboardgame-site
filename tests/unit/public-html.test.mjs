import assert from 'node:assert/strict';
import test from 'node:test';
import { localizePublicHtml, localizedAssetRoute, safeScriptJson } from '../../src/i18n/public-html.js';

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
});
test('route selection never localizes APIs, management tools or retired games', () => {
  assert.equal(localizedAssetRoute('/ar/challenge/manage'), '/challenge.html');
  assert.equal(localizedAssetRoute('/zh-Hant/live-challenge'), '/live_challenge.html');
  for (const path of ['/ar/api/live', '/ar/live-ops', '/ar/remote', '/ar/love']) assert.equal(localizedAssetRoute(path), null);
});
test('serialized public catalog cannot close its script element', () => {
  assert.doesNotMatch(safeScriptJson({ copy: '</script><script>alert(1)</script>' }), /</);
});

test('structured metadata follows the actual URL locale and a mismatched catalog is rejected', () => {
  const output = localizePublicHtml('<html><head><script type="application/ld+json">{"name":"Welcome","inLanguage":"ja","url":"https://www.streetboardgame.com/challenge"}</script></head><body></body></html>', data, new URL('https://www.streetboardgame.com/ar/challenge'), ['ja', 'ar']);
  assert.match(output, /"inLanguage":"ar"/);
  assert.match(output, /"url":"https:\/\/www.streetboardgame.com\/ar\/challenge"/);
  assert.throws(() => localizePublicHtml('<html></html>', data, new URL('https://www.streetboardgame.com/fr/')), /locale mismatch/);
});
