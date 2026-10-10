import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET_LOCALES } from '../src/i18n/locales.js';
import { validateCatalog } from '../src/i18n/catalog-core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(await fs.readFile(path.join(root, 'data/translation-corpus.json'), 'utf8'));
const rows = [];
for (const locale of TARGET_LOCALES.filter((locale) => locale !== 'ja')) {
  const file = path.join(root, 'src/i18n/catalogs', locale + '.json');
  let catalog;
  try { catalog = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    rows.push({ locale, translated: 0, total: corpus.entries.length, missing: corpus.entries.length, status: 'absent', nativeReview: false });
    continue;
  }
  const report = validateCatalog(corpus.entries, catalog.messages || {});
  const provenanceValid = catalog.locale === locale && catalog.provenance?.method === 'machine-generated' && typeof catalog.provenance?.nativeReview === 'boolean';
  rows.push({ locale, translated: corpus.entries.length - report.missing.length, total: corpus.entries.length,
    missing: report.missing.length, placeholderErrors: report.invalidPlaceholders.length, unknownEntries: report.unknown.length,
    provenanceValid, status: report.complete && provenanceValid ? 'catalog-complete-runtime-unverified' : 'incomplete', nativeReview: catalog.provenance?.nativeReview === true });
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ corpusEntries: corpus.entries.length, catalogs: rows }, null, 2));
else console.table(rows);
if (!process.argv.includes('--draft') && rows.some((row) => row.status !== 'catalog-complete-runtime-unverified')) process.exitCode = 1;
