import { readFile, mkdir, writeFile } from 'node:fs/promises';

const origin = 'https://www.streetboardgame.com';
const keyFile = 'ddcad5635e7c4d609b354b46880d63f9.txt';
const key = (await readFile(keyFile, 'utf8')).trim();
const keyLocation = `${origin}/${keyFile}`;
const keyResponse = await fetch(keyLocation);
if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) throw new Error('Public IndexNow verification file is not ready');
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
if (!sitemapResponse.ok) throw new Error(`Sitemap HTTP ${sitemapResponse.status}`);
const sitemap = await sitemapResponse.text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length || urls.length !== new Set(urls).size) throw new Error('Empty or duplicate sitemap');
const checks = [];
for (const url of urls) {
  const parsed = new URL(url);
  if (parsed.origin !== origin || parsed.search || parsed.hash) throw new Error(`Unexpected sitemap URL: ${url}`);
  const response = await fetch(url, { redirect: 'manual' });
  const html = await response.text();
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  const noindex = /noindex/i.test(response.headers.get('x-robots-tag') || '')
    || /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html);
  if (response.status !== 200 || canonical !== url || noindex) throw new Error(`Not a public canonical page: ${url} (${response.status})`);
  checks.push({ url, status: response.status, canonical, noindex });
}
const result = { checkedAt: new Date().toISOString(), mode: process.argv.includes('--submit') ? 'submit' : 'dry-run', checks };
if (result.mode === 'submit') {
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(origin).hostname, key, keyLocation, urlList: urls }),
  });
  result.status = response.status;
  result.response = await response.text();
}
await mkdir('build/indexnow', { recursive: true });
const output = `build/indexnow/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ mode: result.mode, urlCount: urls.length, status: result.status, output }));
if (result.status && ![200, 202].includes(result.status)) process.exitCode = 1;
