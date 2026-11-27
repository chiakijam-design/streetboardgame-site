// 2026-11-27 (Codex review 11/26 #2-14): keep the sitemap's <lastmod> in step with real page changes.
// data/sitemap-sources.json lists, for each URL, a fingerprint of the files (or the <head> text of a file)
// that make up its main text. tests/unit/sitemap-dates.test.mjs fails when they change but the date does not.
// Run `node tools/update-sitemap-dates.mjs` after such a change: it records the new fingerprint and
// sets that URL's <lastmod> to today (Japan time).
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export const SOURCES = {
  'https://www.streetboardgame.com/challenge': [{ file: 'challenge.html', part: 'head-text' }],
  'https://www.streetboardgame.com/guide/': [{ file: 'guide/index.html' }],
  'https://www.streetboardgame.com/guide/self-quiz-questions': [{ file: 'guide/self-quiz-questions.html' }],
  'https://www.streetboardgame.com/guide/first-meeting-questions': [{ file: 'guide/first-meeting-questions.html' }],
  'https://www.streetboardgame.com/guide/couple-quiz-questions': [{ file: 'guide/couple-quiz-questions.html' }],
  'https://www.streetboardgame.com/guide/team-icebreaker-quiz': [{ file: 'guide/team-icebreaker-quiz.html' }],
  'https://www.streetboardgame.com/guide/kind-questions-and-answer-check': [{ file: 'guide/kind-questions-and-answer-check.html' }],
};

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

function headText(html) {
  // Title, description and canonical only: built script names change with every JS build.
  return [/<title>[^<]*<\/title>/, /<meta name="description"[^>]*>/, /<link rel="canonical"[^>]*>/]
    .map((re) => (html.match(re) || [''])[0]).join('\n');
}

export async function fingerprint(url) {
  const hash = createHash('sha256');
  for (const { file, part } of SOURCES[url]) {
    const text = (await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n');
    hash.update(file + '\n' + (part === 'head-text' ? headText(text) : text) + '\n');
  }
  return hash.digest('hex').slice(0, 16);
}

export function sitemapDate(sitemap, url) {
  const m = sitemap.match(new RegExp('<loc>' + escapeRe(url) + '</loc>\\s*<lastmod>([^<]+)</lastmod>'));
  return m ? m[1] : null;
}

async function main() {
  const recordPath = new URL('data/sitemap-sources.json', root);
  let record = {};
  try { record = JSON.parse(await readFile(recordPath, 'utf8')); } catch {}
  const sitemapPath = new URL('sitemap.xml', root);
  let sitemap = await readFile(sitemapPath, 'utf8');
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  for (const url of Object.keys(SOURCES)) {
    const now = await fingerprint(url);
    const date = sitemapDate(sitemap, url);
    if (!date) throw new Error('not in sitemap: ' + url);
    if (record[url]?.fingerprint === now && record[url]?.lastmod === date) continue;
    const changed = Boolean(record[url]) && record[url].fingerprint !== now;
    const lastmod = changed ? today : date;
    sitemap = sitemap.replace(new RegExp('(<loc>' + escapeRe(url) + '</loc>\\s*<lastmod>)[^<]+'), '$1' + lastmod);
    record[url] = { fingerprint: now, lastmod };
    console.log((changed ? 'updated ' : 'recorded ') + url + ' ' + lastmod);
  }
  await writeFile(sitemapPath, sitemap);
  await writeFile(recordPath, JSON.stringify(record, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
