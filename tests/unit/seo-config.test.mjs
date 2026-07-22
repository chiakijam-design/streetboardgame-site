import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';


test('ハッシュ付き本番JavaScriptだけを長期キャッシュする', async () => {
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /\/dist\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/assets\/vendor\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /^\/\*\.js$/m);
});

test('sitemapは正規URL・正確な更新日だけを掲載する', async () => {
  const sitemap = await readFile('sitemap.xml', 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locations).size, locations.length);
  assert.equal(locations.includes('https://www.streetboardgame.com/live'), true);
  assert.equal(locations.some((location) => location.includes('?')), false);
  assert.equal(sitemap.includes('<changefreq>'), false);
  assert.equal(sitemap.includes('<priority>'), false);
  assert.equal([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].every(([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date)), true);
});
