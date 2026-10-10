import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { TARGET_LOCALES } from '../src/i18n/locales.js';
import { requireCompleteCatalog } from '../src/i18n/catalog-core.js';

const root = new URL('../', import.meta.url);
const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root), 'utf8'));
const entries = corpus.entries.map(({ id, source }) => ({ id, source }));
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
console.log(`Validated and packaged ${catalogs.length} catalogs. Runtime/SEO/visual checks still required before deployment.`);
