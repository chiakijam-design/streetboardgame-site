// Site-audit findings (2026-11-17): no internal link leads to a removed page,
// titles say what the page is, and meta descriptions stay short enough to be
// shown whole in search results.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import worker from '../../_worker.js';

const root = new URL('../../', import.meta.url);
const env = { ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  try { return new Response(await readFile(new URL(file, root)), { headers: { 'content-type': file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };
const ORIGIN = 'https://www.streetboardgame.com';
const get = (path) => worker.fetch(new Request(ORIGIN + path), env);
const pick = (html, re) => (html.match(re) || [])[1] || '';
// &amp; last, so "&amp;lt;" stays "&lt;" (no double unescaping).
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('archived legal pages link to archived copies instead of removed pages', async () => {
  const files = (await readdir(new URL('legal-history/', root))).filter((f) => f.endsWith('.html'));
  for (const file of files) {
    const response = await get('/legal-history/' + file);
    assert.equal(response.status, 200, file);
    const html = await response.text();
    assert.doesNotMatch(html, /(?:href="|"url":")(?:https:\/\/www\.streetboardgame\.com)?\/(?:creator-terms|refund-policy)"/, file);
    for (const [, target] of html.matchAll(/href="(?:https:\/\/www\.streetboardgame\.com)?(\/legal-history\/[^"]+)"/g)) {
      assert.equal((await get(target)).status, 200, `${file} -> ${target}`);
    }
  }
  // The removed pages themselves stay gone.
  for (const path of ['/creator-terms', '/refund-policy']) assert.equal((await get(path)).status, 410, path);
});

test('every sitemap page has a descriptive title and a description of at most 160 characters', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length > 50);
  for (const url of urls) {
    const html = await (await get(url.slice(ORIGIN.length))).text();
    const title = [...decode(pick(html, /<title>([\s\S]*?)<\/title>/))];
    const description = [...decode(pick(html, /<meta name="description" content="([^"]*)"/))];
    assert.ok(title.length >= 15, `${url} title: ${title.join('')}`);
    assert.ok(description.length > 0 && description.length <= 160, `${url} description ${description.length}`);
  }
});

test('pack pages keep their description around 120 characters', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  const packs = [...sitemap.matchAll(/<loc>([^<]*\/challenge\/library\/[^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(packs.length, 36);
  for (const url of packs) {
    const html = await (await get(url.slice(ORIGIN.length))).text();
    const length = [...decode(pick(html, /<meta name="description" content="([^"]*)"/))].length;
    assert.ok(length >= 60 && length <= 130, `${url} ${length}`);
  }
});
