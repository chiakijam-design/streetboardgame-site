import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';
import { readdir } from 'node:fs/promises';
import { switchLocalePath, LOCALE_DETAILS } from '../../src/i18n/locales.js';

const publicPages = ['/', '/challenge', '/challenge/library', '/challenge-guide', '/about', '/product', '/pricing', '/terms', '/privacy', '/legal', '/refund-policy', '/content-guidelines', '/minor-policy'];
test('new fixed public copy does not silently fall back to Japanese on English pages', async () => {
  for (const name of (await readdir('locale-pages')).filter(name => name.startsWith('en-') && name.endsWith('.html'))) {
    const html = await readFile('locale-pages/' + name, 'utf8');
    const visibleCopy = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');
    assert.doesNotMatch(visibleCopy, /[ぁ-んァ-ヶ一-龠]/, name);
  }
});
const cache = new Map();
const env = { ASSETS: { async fetch(request) {
  let path = new URL(request.url).pathname;
  if (['/', '/about', '/product'].includes(path)) path = '/index.html';
  if (path === '/challenge') path = '/challenge.html';
  if (!cache.has(path)) {
    try { cache.set(path, await readFile(new URL('../..' + path, import.meta.url))); }
    catch { return new Response('Not Found', { status: 404 }); }
  }
  return new Response(cache.get(path), { headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'text/html' } });
} } };

test('all 442 stable locale pages render SEO HTML without room or capability URLs', async () => {
  assert.equal(PUBLIC_LOCALES.length, 34);
  const sitemap = await readFile(new URL('../../sitemap.xml', import.meta.url), 'utf8');
  const titles = new Set();
  const descriptions = new Set();
  for (const locale of PUBLIC_LOCALES) for (const path of publicPages) {
    const route = switchLocalePath(path, locale);
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + route), env);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, new RegExp(`lang="${locale}"`), route);
    if (locale !== 'ja') assert.ok(html.includes(`dir="${LOCALE_DETAILS[locale].direction}"`), route);
    assert.ok(html.includes(`rel="canonical" href="https://www.streetboardgame.com${route}"`), route);
    assert.equal((html.match(/hreflang="/g) || []).length, 35, route);
    assert.match(html, /<title>[^<]+<\/title>/, route);
    assert.match(html, /name="description" content="[^"]+"/, route);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const description = html.match(/name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(`${locale}:${title}`), route + ' unique page title within locale');
    assert.ok(!descriptions.has(`${locale}:${description}`), route + ' unique description within locale');
    titles.add(`${locale}:${title}`);
    descriptions.add(`${locale}:${description}`);
    assert.equal((html.match(/name="google-adsense-account"/g) || []).length, 1, route);
    assert.ok(sitemap.includes(`<loc>https://www.streetboardgame.com${route}</loc>`), route);
  }
  assert.equal((sitemap.match(/<loc>/g) || []).length, 442);
  for (const [, location] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.doesNotMatch(location, /[?#]|\/manage|\/ranking|\/remote/);
  }
});
