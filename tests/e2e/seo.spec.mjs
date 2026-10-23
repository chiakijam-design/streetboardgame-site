import { expect, test } from './test.mjs';
const ORIGIN = 'https://www.streetboardgame.com';
test('current public metadata, sitemap, privacy and retirement are consistent', async ({ request }, testInfo) => {
 test.skip(testInfo.project.name !== 'desktop-chrome', 'One HTTP inventory.');
 const sitemap = await (await request.get('/sitemap.xml')).text();
 expect(sitemap).not.toMatch(/live-challenge|creator-terms|\?room=|\/manage<|\/ranking</);
 const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
 expect(urls).toHaveLength(442);
 expect(new Set(urls).size).toBe(urls.length);
 for (const url of urls) {
  const path = new URL(url).pathname;
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  expect(response.headers()['x-robots-tag'] || '', path).not.toContain('noindex');
  const html = await response.text();
  expect(html, path).toContain('rel="canonical" href="' + url + '"');
  expect(html.match(/<meta name="robots"[^>]+>/)?.[0] || '', path).not.toContain('noindex');
  expect(html).not.toContain('/live-challenge#');
 }
});
test('private and historical URLs remain noindex; retired games return permanent errors', async ({ request }) => {
 for (const path of ['/challenge?room=ABCDEFGH', '/challenge/manage?room=ABCDEFGH', '/challenge/ranking?room=ABCDEFGH', '/en/challenge?room=ABCDEFGH', '/live-ops', '/question-ops', '/legal-history/terms.html']) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  expect(response.headers()['x-robots-tag'], path).toContain('noindex');
 }
 for (const path of ['/live', '/live-guide', '/live-challenge', '/en/live-challenge', '/ar/live-challenge?room=123456']) expect((await request.get(path)).status(), path).toBe(410);
 for (const path of ['/love', '/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/api/remote/rooms/123456']) expect((await request.get(path)).status(), path).toBe(404);
});
test('publisher identity, robots, CSP and current hashed assets remain correct', async ({ page, request }) => {
 expect((await (await request.get('/ads.txt')).text()).trim()).toBe('google.com, pub-8959934584200203, DIRECT, f08c47fec0942fa0');
 const robots = await (await request.get('/robots.txt')).text();
 expect(robots).toContain('Sitemap: ' + ORIGIN + '/sitemap.xml');
 expect(robots).toContain('Disallow: /api/');
 expect(robots).toContain('Allow: /*?screen=live');
 expect(robots).not.toContain('Disallow: /live-challenge');
 const response = await request.get('/');
 const html = await response.text();
 expect(html).toContain('ca-pub-8959934584200203');
 expect(html).not.toMatch(/adsbygoogle|pagead2\.googlesyndication/);
 expect(response.headers()['content-security-policy']).toContain("default-src 'none'");
 expect(response.headers()['content-security-policy']).toContain("'strict-dynamic'");
 expect(response.headers()['x-content-type-options']).toBe('nosniff');
 expect(response.headers()['x-frame-options']).toBe('DENY');
 expect(response.headers()['permissions-policy']).toContain('payment=()');
 for (const path of ['/%C0', '/challenge/%GG', '/api/live/%E0%A4%A']) expect((await request.get(path)).status()).toBe(400);
 await page.goto('/challenge/library?analytics=exclude');
 const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n => n.getAttribute('src')));
 expect(scripts.some(path => path.includes('challenge_game-'))).toBe(true);
 expect(scripts.some(path => path.includes('live_challenge-'))).toBe(false);
 for (const path of scripts.filter(path => path.startsWith('/'))) expect((await request.get(path)).status(), path).toBe(200);
});
