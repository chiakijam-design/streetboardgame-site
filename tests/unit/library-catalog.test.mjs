import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker from '../../_worker.js';
import { LIBRARY_CATALOG } from '../../src/generated/library-catalog.js';
import { libraryCatalogQuestionCount, renderLibraryCatalogSection, removeLibraryCatalog, injectLibraryCatalog } from '../../src/challenge/library-catalog.js';
import { loadBuiltInJapaneseCards, libraryCatalogModule } from '../../tools/build-library-catalog.mjs';

test('generated library catalog matches the built-in Japanese question cards', async () => {
  const cards = await loadBuiltInJapaneseCards(new URL('../../', import.meta.url));
  const generated = await readFile(new URL('../../src/generated/library-catalog.js', import.meta.url), 'utf8');
  assert.equal(generated, libraryCatalogModule(cards), 'run node tools/build-library-catalog.mjs');
  assert.equal(libraryCatalogQuestionCount(LIBRARY_CATALOG), cards.length);
});

test('catalog section escapes text and lists every built-in question once', () => {
  const html = renderLibraryCatalogSection([{ name: 'A&B', questions: [{ id: 'X1', title: '<b>t</b>', choices: ['"a"', 'b'] }] }], []);
  assert.match(html, /A&amp;B（1問）/);
  assert.match(html, /&lt;b&gt;t&lt;\/b&gt;/);
  assert.match(html, /&quot;a&quot;／b/);
  const full = renderLibraryCatalogSection();
  for (const category of LIBRARY_CATALOG) for (const question of category.questions) {
    assert.ok(full.includes(`<b>${question.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`), question.id);
  }
  const page = '<main><div id="challenge-app"></div></main>';
  const injected = injectLibraryCatalog(page);
  assert.equal(injectLibraryCatalog(injected), injected);
  assert.equal(removeLibraryCatalog(injected), page);
});

const env = { ASSETS: { async fetch(request) {
  const path = new URL(request.url).pathname;
  try { return new Response(await readFile(new URL('../..' + path, import.meta.url)), { headers: { 'content-type': 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };

test('Japanese /challenge/library serves the crawlable catalog; other routes do not', async () => {
  const library = await worker.fetch(new Request('https://www.streetboardgame.com/challenge/library'), env);
  assert.equal(library.status, 200);
  assert.doesNotMatch(library.headers.get('x-robots-tag') || '', /noindex/);
  const html = await library.text();
  assert.equal((html.match(/data-library-catalog/g) || []).length, 1);
  assert.match(html, new RegExp(`収録しているお題の一覧（全${libraryCatalogQuestionCount()}問）`));
  assert.ok(html.indexOf('data-library-catalog') < html.indexOf('</main>'));
  for (const path of ['/challenge', '/challenge?room=ABCDEFGH', '/challenge/manage?room=ABCDEFGH', '/en/challenge/library', '/fr/challenge/library']) {
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
    assert.doesNotMatch(await response.text(), /data-library-catalog/, path);
  }
});
