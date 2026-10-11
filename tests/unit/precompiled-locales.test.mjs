import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { PUBLIC_LOCALE_PAGES } from '../../src/generated/public-locale-pages.js';

test('localized requests serve bounded precompiled HTML without parsing catalogs and receive fresh CSP nonces', async () => {
  assert.equal(Object.keys(PUBLIC_LOCALE_PAGES).length, 561);
  const requests = [];
  const env = { ASSETS: { async fetch(request) {
    const path = new URL(request.url).pathname;
    requests.push(path);
    assert.ok(path.startsWith('/locale-pages/'), 'no request-time dictionary or template reads');
    return new Response(await readFile(new URL('../..' + path, import.meta.url)), { headers: { 'content-type': 'text/html' } });
  } } };
  for (const path of ['/en/challenge', '/fi/', '/he/terms', '/hi/refund-policy', '/bn/live-challenge', '/zh-Hans/challenge/manage']) {
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path + '?room=TEST_COMPAT'), env);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    if (!path.startsWith('/en/')) assert.match(response.headers.get('cache-control'), /no-store/);
    const html = await response.text();
    assert.ok(html.length < 100000, path);
    assert.match(html, /data-watachan-locale-catalog src="\/locale-assets\/[a-zA-Z-]+-[a-f0-9]{12}\.js"/);
    assert.doesNotMatch(html, /window\.__WATACHAN_I18N__=/);
    const nonce = response.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
    assert.ok([...html.matchAll(/<script\b[^>]*>/g)].every(([tag]) => tag.includes(`nonce="${nonce}"`)));
    const again = await worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
    assert.notEqual(again.headers.get('content-security-policy'), response.headers.get('content-security-policy'));
  }
  assert.equal(requests.length, 12);
  const head = await worker.fetch(new Request('https://www.streetboardgame.com/ar/challenge?room=TEST_COMPAT', { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.match(head.headers.get('x-robots-tag'), /noindex/);
  const internal = await worker.fetch(new Request('https://www.streetboardgame.com' + Object.values(PUBLIC_LOCALE_PAGES)[0]), env);
  assert.equal(internal.status, 404);
  assert.equal(requests.length, 13);
});
