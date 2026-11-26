// Reading copy for the search languages and the 10-question pack pages (2026-11-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { PACK_SLUGS, SEARCH_COPY, SEARCH_COPY_LOCALES, RELATED_PACKS, packPagePath } from '../../src/content/search-copy.js';
import { PACK_QUESTIONS } from '../../src/generated/pack-questions.js';
import { packQuestionData, packQuestionModule } from '../../tools/build-pack-questions.mjs';
import { pvPublicPath } from '../../src/analytics/pv-policy.js';
import { PUBLIC_LOCALES } from '../../src/generated/public-locales.js';

const root = new URL('../../', import.meta.url);
const env = { ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  try { return new Response(await readFile(new URL(file, root)), { headers: { 'content-type': file.endsWith('.json') ? 'application/json' : file.endsWith('.js') ? 'text/javascript' : 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };
const get = (path) => worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
// Visible text without JavaScript, as a crawler reads it.
function visibleText(html) {
  // 2026-11-27：CodeQL の決まりに合わせ、閉じタグの空白も許し、消し残しがなくなるまでくり返す（テストの中だけの文字数の数え方）
  let text = html, before;
  do {
    before = text;
    text = text.replace(/<head[\s\S]*?<\/head\s*>/gi, '').replace(/<script[\s\S]*?<\/script[^>]*>/gi, '').replace(/<style[\s\S]*?<\/style[^>]*>/gi, '');
  } while (text !== before);
  return text.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x').replace(/\s+/g, ' ').trim();
}
const size = (locale, text) => (locale === 'ja' ? text.replace(/\s/g, '').length : text.split(' ').length);

test('pack question data is generated from the current question sources', async () => {
  assert.equal(await readFile(new URL('src/generated/pack-questions.js', root), 'utf8'), packQuestionModule(await packQuestionData(root)));
  for (const slug of PACK_SLUGS) for (const locale of SEARCH_COPY_LOCALES) {
    // 2026-11-27（①-11）：予備のお題も持つ（公開のときに非公開を除いて先頭の10問を出す）
    assert.ok(PACK_QUESTIONS[slug][locale].length >= 10, `${locale} ${slug}`);
    assert.ok(PACK_QUESTIONS[slug][locale].every(({ choices }) => choices.length === 5));
  }
});

test('every search language has its own copy for every pack', () => {
  assert.deepEqual(SEARCH_COPY_LOCALES, ['ja', 'en', 'es', 'pt']);
  const seen = new Set();
  for (const locale of SEARCH_COPY_LOCALES) {
    const copy = SEARCH_COPY[locale];
    assert.deepEqual(Object.keys(copy.packs).sort(), [...PACK_SLUGS].sort(), locale);
    for (const slug of PACK_SLUGS) {
      const pack = copy.packs[slug];
      for (const key of ['title', 'summary', 'description', 'lead']) assert.ok(pack[key]?.trim(), `${locale} ${slug} ${key}`);
      assert.equal(pack.body.length, 2);
      assert.ok(pack.scenes.length >= 3 && pack.tips.length >= 3 && pack.talk.length >= 3, `${locale} ${slug}`);
      // No paragraph is reused between packs or languages.
      for (const text of [pack.lead, ...pack.body]) { assert.ok(!seen.has(text), text); seen.add(text); }
    }
    assert.equal(RELATED_PACKS[PACK_SLUGS[0]].length, 3);
  }
});

test('the top page keeps its first-screen container and adds the copy after it', async () => {
  for (const locale of SEARCH_COPY_LOCALES) {
    const path = locale === 'ja' ? '/' : `/${locale}/`;
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    const guide = html.indexOf('data-wata-guide="home"');
    assert.ok(guide > html.indexOf('data-testid="top-start-form"'), path + ': below the name form');
    assert.ok(guide > html.indexOf('data-testid="top-common-rules"'), path + ': below the steps');
    const mainEnd = html.lastIndexOf('</main>', html.indexOf('<!-- /home-prerender -->'));
    assert.ok(html.indexOf('<footer') < mainEnd && mainEnd < guide && guide < html.indexOf('<!-- /home-prerender -->'), path + ': after the existing page, outside its container');
    assert.equal(html.split('data-wata-guide="home"').length, 2);
    for (const slug of PACK_SLUGS) assert.ok(html.includes(`href="${packPagePath(slug, locale)}"`), `${path} links ${slug}`);
    assert.ok(size(locale, visibleText(html)) >= (locale === 'ja' ? 2000 : 800), path + ' reads as a full page');
  }
  // Other languages are unchanged.
  assert.ok(!(await (await get('/fr/')).text()).includes('data-wata-guide'));
});

test('/challenge has crawlable copy under the game, hidden while writing or answering', async () => {
  for (const locale of SEARCH_COPY_LOCALES) {
    const path = locale === 'ja' ? '/challenge' : `/${locale}/challenge`;
    const html = await (await get(path)).text();
    assert.ok(html.indexOf('data-wata-guide="challenge"') > html.indexOf('id="challenge-app"'), path);
    assert.match(html, /html\[data-challenge-mode\]:not\(\[data-challenge-mode="create"\]\) \.wata-guide--challenge\{display:none\}/);
    assert.ok(size(locale, visibleText(html)) >= (locale === 'ja' ? 1200 : 450), path);
  }
  for (const path of ['/challenge/manage', '/challenge/library', '/en/challenge/ranking']) {
    assert.ok(!(await (await get(path)).text()).includes('data-wata-guide="challenge"'), path);
  }
});

test('each pack has its own indexable page in ja, en, es and pt', async () => {
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  for (const locale of SEARCH_COPY_LOCALES) for (const slug of PACK_SLUGS) {
    const path = packPagePath(slug, locale);
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(`<link rel="canonical" href="https://www.streetboardgame.com${path}">`), path);
    for (const language of SEARCH_COPY_LOCALES) assert.ok(html.includes(`hreflang="${language}" href="https://www.streetboardgame.com${packPagePath(slug, language)}"`), `${path} ${language}`);
    assert.ok(html.includes(`<html lang="${locale}">`));
    assert.ok(html.includes(`href="${locale === 'ja' ? '' : '/' + locale}/challenge?pack=${slug}"`), path + ' creates a quiz with the pack');
    for (const question of PACK_QUESTIONS[slug][locale].slice(0, 10)) assert.ok(html.includes(question.title.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;')), `${path}: ${question.title}`);
    for (const related of RELATED_PACKS[slug]) assert.ok(html.includes(`href="${packPagePath(related, locale)}"`));
    assert.doesNotMatch(html, /adsbygoogle|pagead2/, 'no ads');
    assert.ok(size(locale, visibleText(html)) >= (locale === 'ja' ? 1100 : 450), path);
    assert.ok(sitemap.includes(`<loc>https://www.streetboardgame.com${path}</loc>`), path + ' in the sitemap');
    assert.equal(pvPublicPath(path, PUBLIC_LOCALES), `/challenge/library/${slug}`);
  }
  assert.equal((await get('/challenge/library/easy-first-meeting/')).status, 301);
  const other = await get('/fr/challenge/library/easy-first-meeting');
  assert.equal(other.status, 301);
  assert.equal(other.headers.get('location'), 'https://www.streetboardgame.com/fr/challenge/library');
  assert.equal((await get('/challenge/library/unknown-pack')).status, 404);
});

test('library pages link to the pack pages', async () => {
  for (const locale of SEARCH_COPY_LOCALES) {
    const path = locale === 'ja' ? '/challenge/library' : `/${locale}/challenge/library`;
    const html = await (await get(path)).text();
    for (const slug of PACK_SLUGS) assert.ok(html.includes(`href="${packPagePath(slug, locale)}"`), `${path} ${slug}`);
  }
});
