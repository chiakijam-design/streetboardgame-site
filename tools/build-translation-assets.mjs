import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { TARGET_LOCALES } from '../src/i18n/locales.js';
import { requireCompleteCatalog } from '../src/i18n/catalog-core.js';
import { switchLocalePath, SEARCH_INDEXED_LOCALES } from '../src/i18n/locales.js';

const root = new URL('../', import.meta.url);
const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root), 'utf8'));
const supplement = JSON.parse(await readFile(new URL('data/translation-supplement-public-html.json', root), 'utf8'));
const entries = [...corpus.entries, ...supplement.entries].map(({ id, source }) => ({ id, source }));
const catalogs = [];
// Validate every target before writing any public asset. Drafts stay in src/,
// excluded by .assetsignore, and cannot be mistaken for deployed languages.
for (const locale of TARGET_LOCALES.filter((value) => value !== 'ja')) {
  const catalog = JSON.parse(await readFile(new URL(`src/i18n/catalogs/${locale}.json`, root), 'utf8'));
  requireCompleteCatalog(entries, catalog, locale);
  catalogs.push(catalog);
}
await mkdir(new URL('locale-assets/', root), { recursive: true });
for (const catalog of catalogs) {
  await writeFile(new URL(`locale-assets/${catalog.locale}.json`, root), JSON.stringify({ entries, aliases: corpus.aliases, catalog }) + '\n');
}
await writeFile(new URL('locale-assets/manifest.json', root), JSON.stringify({ schemaVersion: 1, publicLocales: TARGET_LOCALES, nativeReview: false }) + '\n');
await writeFile(new URL('src/generated/public-locales.js', root), `// Generated after strict catalog validation. Native review remains unverified.\nexport const PUBLIC_LOCALES = Object.freeze(${JSON.stringify(TARGET_LOCALES)});\n`);
// Preserve the existing URL dates; append only stable public pages. Invitation,
// management and ranking URLs are deliberately absent from the sitemap.
const sitemapPath = new URL('sitemap.xml', root);
const sitemap = await readFile(sitemapPath, 'utf8');
const existing = new Map([...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)].map(([, location, date]) => [location, date]));
for (const location of existing.keys()) if (/\/(?:live-challenge|creator-terms|pricing|refund-policy)(?:\/|$)/.test(new URL(location).pathname)) existing.delete(location);
// Only search-indexed locales are listed (2026-11-15); existing dates are kept.
const localeOf = (location) => { const first = new URL(location).pathname.split('/')[1]; return TARGET_LOCALES.includes(first) ? first : 'ja'; };
for (const location of existing.keys()) if (!SEARCH_INDEXED_LOCALES.includes(localeOf(location))) existing.delete(location);
const publicPages = ['/', '/challenge', '/challenge/library', '/challenge-guide', '/about', '/product', '/terms', '/privacy', '/legal', '/content-guidelines', '/minor-policy'];
const policyDates = new Map(await Promise.all(publicPages.slice(-5).map(async (page) => {
  const html = await readFile(new URL(page.slice(1) + '.html', root), 'utf8');
  const revision = html.match(/<p class="meta">(\d{4}-\d{2}-\d{2})<\/p>/)?.[1];
  if (!revision) throw new Error(`Missing policy revision date: ${page}`);
  return [page, revision];
})));
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
for (const locale of SEARCH_INDEXED_LOCALES) for (const page of publicPages) {
  const location = 'https://www.streetboardgame.com' + switchLocalePath(page, locale);
  if (policyDates.has(page)) existing.set(location, policyDates.get(page));
  else if (!existing.has(location)) existing.set(location, date);
}
await writeFile(sitemapPath, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...existing].map(([location, date]) => `  <url>\n    <loc>${location}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`).join('\n') + '\n</urlset>\n');
console.log(`Validated and packaged ${catalogs.length} catalogs. Runtime/SEO/visual checks still required before deployment.`);
