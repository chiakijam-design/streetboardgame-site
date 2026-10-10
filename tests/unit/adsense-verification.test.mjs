import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';

test('common HTML head includes exactly one approved AdSense ownership tag without loading ads', async () => {
  const env = { ASSETS: { fetch: async (request) => new URL(request.url).pathname === '/locale-assets/en.json'
    ? new Response(await readFile(new URL('../../locale-assets/en.json', import.meta.url)), { headers: { 'content-type': 'application/json' } })
    : new Response('<!doctype html><html><head><meta name="google-adsense-account" content="old"><meta content="duplicate" name="google-adsense-account"></head><body>fixture</body></html>', { headers: { 'content-type': 'text/html' } }) } };
  for (const path of ['/', '/challenge', '/live-challenge', '/about', '/terms', '/en/terms']) {
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
    const html = await response.text();
    assert.equal((html.match(/name="google-adsense-account"/g) || []).length, 1, path);
    assert.match(html, /<meta name="google-adsense-account" content="ca-pub-8959934584200203">/, path);
    assert.doesNotMatch(html, /adsbygoogle|pagead2\.googlesyndication\.com/, path);
  }
});
