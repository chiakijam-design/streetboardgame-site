// 2026-11-27 (Codex review 11/26 #2-14): a page's main text and its sitemap date change together.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SOURCES, fingerprint, sitemapDate } from '../../tools/update-sitemap-dates.mjs';

test('pages listed in data/sitemap-sources.json have an up-to-date <lastmod>', async () => {
  const root = new URL('../../', import.meta.url);
  const record = JSON.parse(await readFile(new URL('data/sitemap-sources.json', root), 'utf8'));
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
  for (const url of Object.keys(SOURCES)) {
    assert.equal(record[url]?.fingerprint, await fingerprint(url), `${url} changed: run node tools/update-sitemap-dates.mjs`);
    assert.equal(sitemapDate(sitemap, url), record[url].lastmod, `${url}: sitemap date differs from data/sitemap-sources.json`);
  }
});
