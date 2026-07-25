import { expect, test } from './test.mjs';

const ORIGIN = 'https://www.streetboardgame.com';

test('公開する2モードと共通ページのSEO・構造が一貫する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタは画面幅に依存しないためPCで1回検証');
  const routes = [
    ['/', 'わたちゃん｜自分のクイズを作ってみんなに挑戦してもらう', 'わたちゃん｜自分のクイズを作ってみんなに挑戦してもらう'],
    ['/challenge-guide', 'みんなに挑戦してもらう｜10問クイズの遊び方・作り方', 'みんなに挑戦してもらう'],
    ['/challenge', 'みんなに挑戦してもらう｜私のこと、ちゃんと分かってるよね？', 'みんなに挑戦してもらう'],
    ['/challenge/library', '人気のお題ライブラリ｜私のこと、ちゃんと分かってるよね？', '人気のお題ライブラリ'],
    ['/live-challenge', 'ライブ配信でみんなに挑戦してもらう｜無料10問クイズ', 'ライブ配信で'],
    ['/about', 'About｜わたちゃん・みんなに挑戦してもらうクイズ', 'About'],
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
  expect(sitemap).not.toContain('<loc>https://www.streetboardgame.com/love</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/challenge-guide</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/challenge</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/challenge/library</loc>');
  expect(sitemap).toContain('<loc>https://www.streetboardgame.com/live-challenge</loc>');
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
  await expect(page.locator('a[href="/love"]')).toHaveCount(0);
  await expect(page.locator('a[href="/challenge-guide"]').first()).toBeAttached();
  await expect(page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true })).toBeAttached();
  for (const path of ['/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/live', '/live-guide']) {
    await expect(page.locator(`a[href="${path}"]`)).toHaveCount(0);
  }
  const jsonLd = (await page.locator('script[type="application/ld+json"]').first().textContent()) || '';
  expect(jsonLd).toContain('/challenge#challenge-game');
  expect(jsonLd).toContain('/live-challenge#game');
  expect(jsonLd).not.toContain('/love#');
  expect(jsonLd).not.toContain('/friends#');
  expect(jsonLd).not.toContain('/family#');
  expect(jsonLd).not.toContain('/boardgame#');
  expect(jsonLd).not.toContain('/live-guide#');
});

test('挑戦モードと説明ページは専用OGP画像を配信する', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'OGPメタと画像配信は画面幅に依存しないためPCで1回検証');
  const imageUrl = `${ORIGIN}/assets/ogp-challenge.png?v=20260725-ogp-2`;
  for (const path of ['/challenge', '/challenge-guide']) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', imageUrl);
  }
  const sharePath = '/challenge?room=ABCDEFGH&share=challenge-20260725-2';
  const shareUrl = `${ORIGIN}${sharePath}`;
  await page.goto(sharePath);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', shareUrl);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl);
  const imageResponse = await request.get('/assets/ogp-challenge.png');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toBe('image/png');
  expect((await imageResponse.body()).byteLength).toBeGreaterThan(100_000);
});

test('CSP・主要セキュリティヘッダーと404を維持する', async ({ request, page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPヘッダーは画面幅に依存しないためPCで1回検証');
  for (const path of ['/', '/challenge-guide', '/challenge', '/live-challenge', '/privacy']) {
    const response = await request.get(path);
    expect(response.headers()['content-security-policy'], path).toContain("default-src 'none'");
    expect(response.headers()['x-content-type-options'], path).toBe('nosniff');
    expect(response.headers()['referrer-policy'], path).toBeTruthy();
  }
  const response = await page.goto('/does-not-exist-for-test');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
});

test('廃止した愛情判定URLは通常の挑戦モードへ恒久転送する', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPリダイレクトは画面幅に依存しないためPCで1回検証');
  const response = await request.get('/love', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(new URL(response.headers().location).pathname).toBe('/challenge');
});
