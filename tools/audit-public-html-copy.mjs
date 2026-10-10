// Render only fixed public pages with a local ASSETS mock. No external API,
// database, environment file, submitted content or production request is used.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import worker from '../_worker.js';

const root = new URL('../', import.meta.url);
const corpus = JSON.parse(await readFile(new URL('data/translation-corpus.json', root), 'utf8'));
const known = new Set(corpus.entries.map(({ source }) => source));
const missing = new Map();
const paths = ['/', '/challenge', '/challenge/library', '/live-challenge', '/challenge-guide', '/about', '/product', '/pricing', '/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy', '/en/', '/en/challenge', '/en/live-challenge', '/en/terms', '/en/privacy'];
const env = { ASSETS: { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (file.includes('..')) return new Response('Not Found', { status: 404 });
  try { return new Response(await readFile(new URL(file, root), 'utf8'), { headers: { 'content-type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' } }); }
  catch { return new Response('Not Found', { status: 404 }); }
} } };
function add(raw, context) {
  let source = raw.trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, '\u00a0');
  source = corpus.aliases[source] || source;
  if (!source || known.has(source) || /^https?:\/\//.test(source) || !/\p{L}/u.test(source)) return;
  if (!missing.has(source)) missing.set(source, new Set());
  missing.get(source).add(context);
}
function strings(value, context) {
  if (typeof value === 'string') add(value, context);
  else if (Array.isArray(value)) value.forEach((entry) => strings(entry, context));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => strings(entry, context));
}
for (const path of paths) {
  const response = await worker.fetch(new Request('https://www.streetboardgame.com' + path + '?analytics=exclude'), env);
  if (!response.ok) throw new Error(`Fixed public page failed: ${path} (${response.status})`);
  const html = await response.text();
  for (const [, json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(json);
    // Schema identifiers are technical, while these fields contain public copy.
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      for (const [key, entry] of Object.entries(value)) {
        if (['name', 'description', 'text', 'headline', 'alternateName'].includes(key)) strings(entry, path + ':structured');
        if (typeof entry === 'object') visit(entry);
      }
    }
    visit(data);
  }
  const visible = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  visible.split(/<[^>]+>/g).forEach((value) => add(value, path + ':body'));
  for (const [, value] of visible.matchAll(/(?:aria-label|placeholder|alt|title)="([^"]*)"/gi)) add(value, path + ':attribute');
  for (const [tag] of visible.matchAll(/<meta\b[^>]*>/gi)) {
    const field = tag.match(/(?:name|property)="([^"]*)"/i)?.[1];
    const value = tag.match(/content="([^"]*)"/i)?.[1];
    if (value && /^(?:description|og:(?:title|description|image:alt)|twitter:(?:title|description|image:alt))$/.test(field || '')) add(value, path + ':metadata');
  }
}
const entries = [...missing].map(([source, contexts]) => ({ id: 'm' + createHash('sha256').update(source).digest('hex').slice(0, 14), source, contexts: [...contexts] }));
await writeFile(new URL('data/translation-supplement-public-html.json', root), JSON.stringify({ schemaVersion: 1, status: 'public-fixed-source-only', entries }, null, 2) + '\n');
console.log(JSON.stringify({ publicPages: paths.length, supplementalEntries: entries.length }));
