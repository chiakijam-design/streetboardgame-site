import { expect, test } from '@playwright/test';

const ORIGIN = 'https://www.streetboardgame.com';
const PUBLIC_ROUTES = [
  { path: '/', title: 'わたちゃん｜彼氏の愛情判定ゲーム・無料カップル診断', h1: 'わたちゃん 彼氏の愛情判定ゲーム' },
  { path: '/love', title: '彼氏の愛情判定｜彼女版も遊べる無料カップル診断ゲーム', h1: '彼氏の愛情判定ゲーム' },
  { path: '/remote', title: '遠隔で2人の理解度判定 | わたちゃん', h1: '遠隔で理解度判定' },
  { path: '/friends', title: '友達の友情判定｜わたちゃん無料友情診断ゲーム', h1: '友達の友情判定ゲーム' },
  { path: '/family', title: '家族の絆判定｜わたちゃん無料家族診断ゲーム', h1: '家族の絆判定ゲーム' },
  { path: '/live-guide', title: '私のこと、ちゃんとわかってるよね？LIVE｜ライブ投票ゲーム', h1: '私のこと、ちゃんとわかってるよね？LIVE' },
  { path: '/about', title: 'About｜わたちゃん・彼氏の愛情判定ゲーム', h1: 'About' },
  { path: '/product', title: '製品版｜私のこと、ちゃんと分かってるよね？', h1: '製品版もあります' },
];

test('公開ページのtitle・canonical・見出し・構造化データが一貫する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタは画面幅に依存しないためPCで1回検証');

  for (const route of PUBLIC_ROUTES) {
    const response = await page.goto(route.path);
    expect(response?.status(), route.path).toBe(200);
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}${route.path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(route.h1);

    const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(structuredData.length, `${route.path}に構造化データがある`).toBeGreaterThan(0);
    for (const json of structuredData) expect(() => JSON.parse(json), `${route.path}のJSON-LD`).not.toThrow();
  }
});

test('内部リンクを実URLで辿れ、主要ランドマークが存在する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTML構造は画面幅に依存しないためPCで1回検証');

  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'ゲームシリーズの紹介ページ' })).toBeVisible();
  await expect(page.locator('footer')).toHaveCount(1);
  for (const path of ['/remote', '/live', '/live-guide', '/love', '/friends', '/family', '/about', '/product']) {
    await expect(page.locator(`a[href="${path}"]`).first(), `${path}への内部リンク`).toBeAttached();
  }

  for (const path of ['/love', '/friends', '/family', '/live-guide']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
    await expect(page.locator('header')).toHaveCount(1);
  }
});

test('sitemap・robots・末尾スラッシュの正規化が一致する', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTP応答は画面幅に依存しないためPCで1回検証');

  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locations).toEqual(PUBLIC_ROUTES.map(({ path }) => `${ORIGIN}${path}`));
  expect(new Set(locations).size).toBe(locations.length);
  expect([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].every(([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);

  const robotsResponse = await request.get('/robots.txt');
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();
  expect(robots).toContain('Disallow: /*?screen=');
  expect(robots).toContain('Disallow: /api/remote/');
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

  for (const path of ['/love', '/remote', '/friends', '/family', '/live-guide', '/about', '/product']) {
    const response = await request.get(`${path}/`, { maxRedirects: 0 });
    expect(response.status(), `${path}/のステータス`).toBe(301);
    expect(response.headers().location, `${path}/の転送先`).toBe(`http://127.0.0.1:4173${path}`);
  }
});
