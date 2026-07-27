import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';


test('内容ハッシュ付き本番JavaScript・CSSだけを長期キャッシュする', async () => {
  const headers = await readFile('_headers', 'utf8');
  assert.match(headers, /\/dist\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/);
  assert.match(headers, /\/assets\/vendor\/\*[\s\S]*Cache-Control: public, max-age=31536000, immutable/);
  assert.doesNotMatch(headers, /^\/accessibility\.css$/m);
  assert.doesNotMatch(headers, /^\/question-card\.css$/m);
  assert.doesNotMatch(headers, /^\/\*\.js$/m);

  const buildScript = await readFile('tools/build-js.mjs', 'utf8');
  assert.match(buildScript, /const STYLE_ENTRIES = \{/);
  assert.match(buildScript, /data-build-style/);
  for (const [htmlPath, marker] of [
    ['index.html', 'accessibility'],
    ['challenge.html', 'question_card'],
    ['live_challenge.html', 'question_card'],
    ['terms.html', 'legal'],
  ]) {
    const html = await readFile(htmlPath, 'utf8');
    assert.match(html, new RegExp(`data-build-style="${marker}"`), htmlPath);
    assert.match(html, new RegExp(`href="/dist/[a-z0-9-]+-[a-f0-9]{12}\\.css"`), htmlPath);
  }
});

test('sitemapは正規URL・正確な更新日だけを掲載する', async () => {
  const sitemap = await readFile('sitemap.xml', 'utf8');
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const lastModifiedDates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
  assert.equal(new Set(locations).size, locations.length);
  assert.equal(lastModifiedDates.length, locations.length);
  assert.equal(locations.includes('https://www.streetboardgame.com/challenge'), true);
  assert.equal(locations.includes('https://www.streetboardgame.com/live'), false);
  assert.equal(locations.some((location) => location.includes('?')), false);
  assert.equal(sitemap.includes('<changefreq>'), false);
  assert.equal(sitemap.includes('<priority>'), false);
  assert.equal(lastModifiedDates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)), true);
  const todayInJapan = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  assert.equal(lastModifiedDates.every((date) => date <= todayInJapan), true);
  const lastModifiedByUrl = new Map(locations.map((location, index) => [location, lastModifiedDates[index]]));
  for (const updatedUrl of [
    'https://www.streetboardgame.com/',
    'https://www.streetboardgame.com/challenge',
    'https://www.streetboardgame.com/challenge/library',
    'https://www.streetboardgame.com/live-challenge',
    'https://www.streetboardgame.com/terms',
    'https://www.streetboardgame.com/privacy',
    'https://www.streetboardgame.com/en/challenge',
    'https://www.streetboardgame.com/en/live-challenge',
    'https://www.streetboardgame.com/en/terms',
    'https://www.streetboardgame.com/en/privacy',
  ]) {
    assert.equal(lastModifiedByUrl.get(updatedUrl), '2026-07-27', updatedUrl);
  }
});

test('公開説明は現行の二本立てと答え合わせ中心の方針に統一する', async () => {
  const challenge = await readFile('challenge.html', 'utf8');
  const top = await readFile('index.html', 'utf8');
  const topApp = await readFile('prototype_app.jsx', 'utf8');
  const englishTop = await readFile('en/index.html', 'utf8');

  assert.doesNotMatch(challenge, /友達や家族/);
  assert.doesNotMatch(top, /相手を理解できるまで、何度でも挑戦できます/);
  assert.doesNotMatch(topApp, /家族や友達/);
  assert.doesNotMatch(englishTop, /who (?:knows|understands) you best/i);
  assert.match(englishTop, /See where your answers match/);
});

test('運営画面は検索除外・キャッシュ禁止・参照元非送信を重ねて指定する', async () => {
  const headers = await readFile('_headers', 'utf8');
  const worker = await readFile('_worker.js', 'utf8');

  for (const route of ['/live-ops', '/question-ops']) {
    const escapedRoute = route.replace('/', '\\/');
    assert.match(headers, new RegExp(`${escapedRoute}[\\s\\S]*?Referrer-Policy: no-referrer[\\s\\S]*?X-Robots-Tag: noindex, nofollow, noarchive[\\s\\S]*?Cache-Control: no-store`));
  }
  assert.equal((worker.match(/headers\.set\('referrer-policy', 'no-referrer'\)/g) || []).length >= 2, true);
});
