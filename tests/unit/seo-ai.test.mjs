// Search and AI readers (2026-11-16): schema.org types stay untranslated, each
// page has its own heading, the FAQ data matches the visible FAQ, and llms.txt
// describes the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { SEARCH_COPY } from '../../src/content/search-copy.js';

const root = new URL('../../', import.meta.url);
const env = { ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  try { return new Response(await readFile(new URL(file, root)), { headers: { 'content-type': file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };
const get = async (path) => (await worker.fetch(new Request('https://www.streetboardgame.com' + path), env)).text();
const graph = (html) => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => { const j = JSON.parse(m[1]); return j['@graph'] || [j]; });
const types = (html) => graph(html).flatMap((node) => [].concat(node['@type']));
const KNOWN = new Set(['Organization', 'WebSite', 'WebPage', 'SiteNavigationElement', 'WebApplication', 'Game', 'BreadcrumbList', 'FAQPage', 'CollectionPage']);
// The page outside its script blocks, cut with indexOf (this only reads our own
// test output; nothing is sanitized for display).
function withoutScripts(html) {
  let out = '';
  let at = 0;
  for (;;) {
    const open = html.indexOf('<script', at);
    if (open < 0) return out + html.slice(at);
    out += html.slice(at, open);
    const close = html.indexOf('</script', open);
    if (close < 0) return out;
    at = html.indexOf('>', close) + 1;
  }
}
// Text of an element: drop tags character by character, a line break becomes a space.
function textOf(fragment) {
  let out = '';
  let inTag = false;
  for (const ch of fragment) {
    if (ch === '<') { inTag = true; out += ' '; } else if (ch === '>') inTag = false; else if (!inTag) out += ch;
  }
  return out.split(/\s+/).filter(Boolean).join(' ');
}
const h1 = (html) => withoutScripts(html).split('<h1').slice(1).map((part) => textOf(part.slice(part.indexOf('>') + 1, part.indexOf('</h1>'))));

test('schema.org types are never translated', async () => {
  for (const path of ['/', '/challenge', '/challenge-guide', '/challenge/library', '/en/', '/en/challenge', '/es/', '/es/challenge', '/pt/', '/pt/challenge', '/es/challenge-guide', '/pt/about']) {
    for (const type of types(await get(path))) assert.ok(KNOWN.has(type), `${path}: ${type}`);
  }
});

test('the challenge heading reads as one sentence and the pack list has its own heading', async () => {
  const expected = { en: 'You really know me, right?', es: '¿Me conoces de verdad?', pt: 'Você me conhece de verdade, né?' };
  for (const [locale, text] of Object.entries(expected)) assert.deepEqual(h1(await get(`/${locale}/challenge`)), [text], locale);
  for (const locale of ['ja', 'en', 'es', 'pt']) {
    const path = (locale === 'ja' ? '' : '/' + locale) + '/challenge/library';
    assert.deepEqual(h1(await get(path)), [SEARCH_COPY[locale].ui.packListTitle], path);
  }
});

test('the FAQ data matches the visible FAQ on the guide', async () => {
  const html = await get('/challenge-guide');
  const faq = graph(html).find((node) => node['@type'] === 'FAQPage');
  assert.equal(faq.mainEntity.length, 6);
  const visible = withoutScripts(html);
  for (const item of faq.mainEntity) {
    assert.ok(visible.includes(item.name), item.name);
    assert.ok(visible.includes(item.acceptedAnswer.text), item.acceptedAnswer.text);
  }
});

test('llms.txt lists the main pages and every pack page', async () => {
  const text = await readFile(new URL('llms.txt', root), 'utf8');
  assert.match(text, /^# /);
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  for (const url of text.match(/https:\/\/www\.streetboardgame\.com[^)\s]*/g)) assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  for (const slug of Object.keys(SEARCH_COPY.ja.packs)) assert.ok(text.includes('/challenge/library/' + slug + ')'), slug);
  assert.doesNotMatch(text, /MBTI|16Personalities/);
});
