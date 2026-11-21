import { readFile, mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { PUBLIC_LOCALES } from '../src/generated/public-locales.js';
import { switchLocalePath } from '../src/i18n/locales.js';
import { requireCompleteCatalog } from '../src/i18n/catalog-core.js';
import { safeScriptJson } from '../src/i18n/public-html.js';
import { runtimeCatalogEntries, unescapeScriptText } from '../src/i18n/runtime-catalog.js';

const root = new URL('../', import.meta.url);
const pages = ['/', '/challenge', '/challenge/manage', '/challenge/ranking', '/challenge/library', '/challenge-guide', '/about', '/product', '/terms', '/privacy', '/legal', '/content-guidelines', '/minor-policy'];
const manifest = {};
const activeCatalogAssets = new Set();
const env = { __STATIC_HTML_BUILD: true, ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  // Recompile from the current templates, never from a previous build.
  if (pathname.startsWith('/locale-pages/')) return new Response('Not Found', { status: 404 });
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  assert.ok(!file.includes('..'));
  try { return new Response(await readFile(new URL(file, root)), { headers: { 'content-type': file.endsWith('.json') ? 'application/json' : 'text/html' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };
await mkdir(new URL('locale-pages/', root), { recursive: true });
for (const name of await readdir(new URL('locale-pages/', root))) if (name.endsWith('.html')) await unlink(new URL('locale-pages/' + name, root));
const CATALOG_MARKER = '<!--watachan-locale-catalog-->';
async function listFiles(dir) {
  const files = [];
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...await listFiles(dir + entry.name + '/'));
    else files.push(dir + entry.name);
  }
  return files;
}
// Client bundles escape non-ASCII text, so compare against the decoded source.
// src/content/ holds original copy per search language; it is never translated.
const sharedRuntimeFiles = (await listFiles('src/'))
  .filter((file) => file.endsWith('.js') && !file.startsWith('src/live/') && !file.startsWith('src/generated/') && !file.startsWith('src/content/'));
const sharedRuntimeText = (await Promise.all([...sharedRuntimeFiles, '_worker.js']
  .map(async (file) => unescapeScriptText(await readFile(new URL(file, root), 'utf8'))))).join('\n');
const scriptTextCache = new Map();
async function scriptText(path) {
  if (!scriptTextCache.has(path)) {
    let text = '';
    try { text = unescapeScriptText(await readFile(new URL(path, root), 'utf8')); } catch {}
    scriptTextCache.set(path, text);
  }
  return scriptTextCache.get(path);
}
for (const locale of PUBLIC_LOCALES.filter(value => value !== 'ja')) {
  const data = JSON.parse(await readFile(new URL(`locale-assets/${locale}.json`, root), 'utf8'));
  requireCompleteCatalog(data.entries, data.catalog, locale);
  const rendered = [];
  for (const page of pages) {
    const path = switchLocalePath(page, locale);
    const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path), env);
    assert.equal(response.status, 200, path);
    let html = (await response.text()).replace(/\snonce="[^"]*"/g, '');
    const initialization = /<script\b[^>]*>window\.__WATACHAN_I18N__=[\s\S]*?<\/script>/g;
    assert.equal([...html.matchAll(initialization)].length, 1, path + ' catalog initialization');
    rendered.push({ page, path, html: html.replace(initialization, CATALOG_MARKER) });
  }
  // A parser-blocking public script initializes the catalog before the
  // existing deferred game/shell bundles. Names and answers never enter it.
  // One cacheable file per locale carries only the copy these pages can still
  // translate in the browser (2026-11-15): strings in the scripts they load, in
  // the pages themselves and in shared runtime modules / Worker-injected UI.
  // Precompiled policy copy and retired LIVE copy are not shipped to visitors.
  const runtimeTexts = [sharedRuntimeText];
  for (const { html } of rendered) {
    runtimeTexts.push(html);
    const scripts = [...html.matchAll(/<script\b[^>]*\ssrc="\/([^"?#]+\.js)/g)].map((match) => match[1]);
    runtimeTexts.push(...await Promise.all(scripts.map(scriptText)));
  }
  const entries = runtimeCatalogEntries(data.entries, [...new Set(runtimeTexts)].join('\n'));
  const messages = Object.fromEntries(entries.map(({ id }) => [id, data.catalog.messages[id]]));
  const catalogScript = 'window.__WATACHAN_I18N__=' + safeScriptJson({ ...data, entries, catalog: { ...data.catalog, messages }, publicLocales: PUBLIC_LOCALES }) + ';\n';
  const catalogHash = createHash('sha256').update(catalogScript).digest('hex').slice(0, 12);
  const catalogPath = `/locale-assets/${locale}-${catalogHash}.js`;
  activeCatalogAssets.add(catalogPath.slice(1));
  await writeFile(new URL(catalogPath.slice(1), root), catalogScript);
  for (const { page, path, html: template } of rendered) {
    let html = template.replace(CATALOG_MARKER, `<script data-watachan-locale-catalog src="${catalogPath}"></script>`);
    html = html.replace(/^[\t ]+$/gm, '');
    // 2026-11-21 (Codex review #20): translated pages use the English question library, so the
    // Japanese question data script is not shipped with them (same rule as the Worker's selectQuestionDataScript).
    if (locale !== 'ja') html = html.replace(/\s*<script\b[^>]*data-build-entry=["']prototype_common_data["'][^>]*>\s*<\/script>/i, '');
    assert.ok(html.length < 100000, path + ' bounded Worker HTML');
    const hash = createHash('sha256').update(html).digest('hex').slice(0, 12);
    const name = `${locale}-${page === '/' ? 'index' : page.slice(1).replaceAll('/', '-')}-${hash}.html`;
    await writeFile(new URL('locale-pages/' + name, root), html);
    manifest[path.replace(/\/+$/, '')] = '/locale-pages/' + name;
  }
}
await writeFile(new URL('src/generated/public-locale-pages.js', root), '// Generated by tools/build-public-locale-pages.mjs.\nexport const PUBLIC_LOCALE_PAGES = Object.freeze(' + JSON.stringify(manifest, null, 2) + ');\n');
// Remove only stale generated dictionaries. Retired page bundles and old public
// offer copy must not stay downloadable through unused immutable asset URLs.
for (const name of await readdir(new URL('locale-assets/', root))) {
  if (/^[a-zA-Z-]+-[a-f0-9]{12}\.js$/.test(name) && !activeCatalogAssets.has('locale-assets/' + name)) {
    await unlink(new URL('locale-assets/' + name, root));
  }
}
console.log(`Precompiled ${Object.keys(manifest).length} localized pages; request-time catalogs are static scripts.`);
