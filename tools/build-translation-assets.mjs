import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { TARGET_LOCALES } from '../src/i18n/locales.js';
import { requireCompleteCatalog } from '../src/i18n/catalog-core.js';
import { switchLocalePath } from '../src/i18n/locales.js';

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
const publicPages = ['/', '/challenge', '/challenge/library', '/live-challenge', '/challenge-guide', '/about', '/product', '/pricing', '/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy'];
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
for (const locale of TARGET_LOCALES) for (const page of publicPages) {
  const location = 'https://www.streetboardgame.com' + switchLocalePath(page, locale);
  if (!existing.has(location)) existing.set(location, date);
}
await writeFile(sitemapPath, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...existing].map(([location, date]) => `  <url>\n    <loc>${location}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`).join('\n') + '\n</urlset>\n');
console.log(`Validated and packaged ${catalogs.length} catalogs. Runtime/SEO/visual checks still required before deployment.`);
