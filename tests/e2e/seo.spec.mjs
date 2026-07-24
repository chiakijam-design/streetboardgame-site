import { expect, test } from '@playwright/test';

const ORIGIN = 'https://www.streetboardgame.com';

test('公開する2モードと共通ページのSEO・構造が一貫する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタは画面幅に依存しないためPCで1回検証');
  const routes = [
    ['/', 'わたちゃん｜彼氏の愛情判定ゲーム・無料カップル診断', 'わたちゃん 彼氏の愛情判定ゲーム'],
    ['/love', '彼氏の愛情判定｜彼女版も遊べる無料カップル診断ゲーム', '彼氏の愛情判定ゲーム'],
    ['/challenge', 'みんなに挑戦してもらう｜私のこと、ちゃんと分かってるよね？', 'みんなに挑戦してもらう'],
    ['/challenge/library', '人気のお題ライブラリ｜私のこと、ちゃんと分かってるよね？', '人気のお題ライブラリ'],
    ['/about', 'About｜わたちゃん・彼氏の愛情判定ゲーム', 'About'],
    ['/product', '製品版｜私のこと、ちゃんと分かってるよね？', '製品版もあります'],
    ['/terms', '利用規約｜Streetboardgame', '利用規約'],
    ['/privacy', 'プライバシーポリシー｜Streetboardgame', 'プライバシーポリシー'],
    ['/legal', '特定商取引法に基づく表記｜Streetboardgame', '特定商取引法に基づく表記'],
  ];
  for (const [path, title, h1] of routes) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}${path}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(h1);
    const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(structuredData.length, path).toBeGreaterThan(0);
    for (const json of structuredData) expect(() => JSON.parse(json), path).not.toThrow();
  }
});

test('サイトマップは2モードだけを掲載し、挑戦URLはnoindexになる', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/love</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/challenge</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/challenge/library</loc>');
  for (const removed of ['/friends', '/family', '/boardgame', '/remote', '/live']) {
    expect(sitemap).not.toContain(`<loc>https://www.streetboardgame.com${removed}</loc>`);
  }
  const roomPage = await request.get('/challenge?room=ABCDEFGH');
  expect(roomPage.headers()['x-robots-tag']).toContain('noindex');
  const rankingPage = await request.get('/challenge/ranking?room=ABCDEFGH');
  expect(rankingPage.headers()['x-robots-tag']).toContain('noindex');
  const managePage = await request.get('/challenge/manage?room=ABCDEFGH');
  expect(managePage.headers()['x-robots-tag']).toContain('noindex');
});

test('トップの内部リンクと構造化データに廃止モードを残さない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTML構造は画面幅に依存しないためPCで1回検証');
  await page.goto('/');
  await expect(page.locator('a[href="/love"]').first()).toBeAttached();
  await expect(page.locator('a[href="/challenge"]').first()).toBeAttached();
  for (const path of ['/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/live', '/live-guide']) {
    await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
  }
  const jsonLd = (await page.locator('script[type="application/ld+json"]').first().textContent()) || '';
  expect(jsonLd).toContain('/challenge#challenge-game');
  expect(jsonLd).not.toContain('/friends#');
  expect(jsonLd).not.toContain('/family#');
  expect(jsonLd).not.toContain('/boardgame#');
  expect(jsonLd).not.toContain('/live-guide#');
});

test('CSP・主要セキュリティヘッダーと404を維持する', async ({ request, page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPヘッダーは画面幅に依存しないためPCで1回検証');
  for (const path of ['/', '/love', '/challenge', '/privacy']) {
    const response = await request.get(path);
    expect(response.headers()['content-security-policy'], path).toContain("default-src 'none'");
    expect(response.headers()['x-content-type-options'], path).toBe('nosniff');
    expect(response.headers()['referrer-policy'], path).toBeTruthy();
  }
  const response = await page.goto('/does-not-exist-for-test');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
});
