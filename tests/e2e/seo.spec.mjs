import { expect, test } from '@playwright/test';

const ORIGIN = 'https://www.streetboardgame.com';
const PUBLIC_ROUTES = [
  { path: '/', title: 'わたちゃん｜彼氏の愛情判定ゲーム・無料カップル診断', h1: 'わたちゃん 彼氏の愛情判定ゲーム' },
  { path: '/love', title: '彼氏の愛情判定｜彼女版も遊べる無料カップル診断ゲーム', h1: '彼氏の愛情判定ゲーム' },
  { path: '/remote', title: '遠隔で2人の理解度判定 | わたちゃん', h1: '遠隔で理解度判定' },
  { path: '/remote-boardgame', title: '遠隔でボドゲ仲間の絆判定 | わたちゃん', h1: '遠隔でボドゲ仲間の絆判定' },
  { path: '/friends', title: '友達の友情判定｜わたちゃん無料友情診断ゲーム', h1: '友達の友情判定ゲーム' },
  { path: '/family', title: '家族の絆判定｜わたちゃん無料家族診断ゲーム', h1: '家族の絆判定ゲーム' },
  { path: '/boardgame', title: 'ボドゲ仲間の絆判定｜2〜4人の無料ボードゲーム', h1: 'ボドゲ仲間の絆判定ゲーム' },
  { path: '/live-guide', title: 'YouTube企画のネタに｜視聴者参加型ライブゲーム【無料】｜わたちゃん', h1: 'YouTuberと視聴者の絆を判定する、私のことちゃんとわかってるよね?Youtubeライブver.' },
  { path: '/about', title: 'About｜わたちゃん・彼氏の愛情判定ゲーム', h1: 'About' },
  { path: '/product', title: '製品版｜私のこと、ちゃんと分かってるよね？', h1: '製品版もあります' },
  { path: '/terms', title: '利用規約｜Streetboardgame', h1: '利用規約' },
  { path: '/privacy', title: 'プライバシーポリシー｜Streetboardgame', h1: 'プライバシーポリシー' },
  { path: '/legal', title: '特定商取引法に基づく表記｜Streetboardgame', h1: '特定商取引法に基づく表記' },
  { path: '/creator-terms', title: 'YouTuber向け収益分配規約｜Streetboardgame', h1: 'YouTuber向け収益分配規約' },
  { path: '/refund-policy', title: '返金・キャンセルポリシー｜Streetboardgame', h1: '返金・キャンセルポリシー' },
  { path: '/content-guidelines', title: 'コンテンツ・肖像権ガイドライン｜Streetboardgame', h1: 'コンテンツ・肖像権ガイドライン' },
  { path: '/minor-policy', title: '未成年者利用規定｜Streetboardgame', h1: '未成年者利用規定' },
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

test('LIVE紹介ページがYouTube企画を探す人向けの検索情報と本文を持つ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタと構造化データは画面幅に依存しないためPCで1回検証');

  await page.goto('/live-guide');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /YouTubeのライブ配信企画・視聴者参加型のネタ/);
  await expect(page.getByRole('heading', { name: 'YouTubeライブの企画ネタが、チャンネルURLだけで作れる' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'YouTubeライブで使える2つの視聴者参加型企画' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '企画ネタが決まるまでの3ステップ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'YouTubeの企画ネタが思いつかない時に使えますか？' })).toBeVisible();

  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsed = structuredData.map((json) => JSON.parse(json));
  const structuredItems = parsed.flatMap((item) => item['@graph'] || [item]);
  const faq = structuredItems.find((item) => item['@type'] === 'FAQPage');
  expect(faq?.mainEntity.some((item) => item.name === 'YouTubeの企画ネタが思いつかない時に使えますか？')).toBe(true);
});

test('内部リンクを実URLで辿れ、主要ランドマークが存在する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTML構造は画面幅に依存しないためPCで1回検証');

  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'ゲームシリーズの紹介ページ' })).toBeVisible();
  await expect(page.locator('footer')).toHaveCount(1);
  for (const path of ['/remote', '/remote-boardgame', '/live', '/live-guide', '/love', '/friends', '/family', '/boardgame', '/about', '/product', '/terms', '/legal']) {
    await expect(page.locator(`a[href="${path}"]`).first(), `${path}への内部リンク`).toBeAttached();
  }
  const footerLinks = page.locator('footer a');
  await expect(footerLinks).toHaveCount(4);
  expect(await footerLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual(['/about', '/product', '/terms', '/legal']);
  await footerLinks.filter({ hasText: '利用規約' }).click();
  await expect(page).toHaveURL('/terms');
  const legalNav = page.getByRole('navigation', { name: '法務ページ' });
  for (const path of ['/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy']) {
    await expect(legalNav.locator(`a[href="${path}"]`)).toHaveCount(1);
  }

  for (const path of ['/love', '/friends', '/family', '/boardgame', '/live-guide']) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: '関連ゲーム' })).toHaveCount(1);
  }

  for (const path of ['/about', '/product']) {
    await page.goto(path);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
  }
  await page.goto('/about');
  await expect(page.getByRole('navigation', { name: 'ゲームシリーズ' })).toHaveCount(1);
  await expect(page.locator('footer')).toHaveCount(1);
});

test('表示中のヒーロー画像だけを先読みし、トップの装飾カードは縮小版を使う', async ({ page }) => {
  await page.goto('/love');
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute('href', '/assets/character/girl-default.webp');
  const loveResources = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname));
  expect(loveResources).not.toContain('/assets/character/girl-full.webp');

  await page.goto('/product');
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute('href', '/assets/character/girl-full-960.webp');

  await page.goto('/');
  const decorativeCards = page.locator('img[alt=""]');
  await expect(decorativeCards).toHaveCount(3);
  expect(await decorativeCards.evaluateAll((images) => images.map((image) => new URL(image.currentSrc).pathname)))
    .toEqual(['/assets/cards/hero/1.webp', '/assets/cards/hero/20.webp', '/assets/cards/hero/15.webp']);
});

test('LIVE公開入口は登録可能にし、運営画面と秘密情報付きURLは検索対象から除外する', async ({ page, request }) => {
  const liveResponse = await page.goto('/live');
  expect(liveResponse?.headers()['x-robots-tag']).toBeUndefined();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/live`);

  expect((await request.get('/live-ops')).headers()['x-robots-tag']).toContain('noindex');
  expect((await request.get('/remote?room=ABC123&turn=secret')).headers()['x-robots-tag']).toContain('noindex');
  expect((await request.get('/remote')).headers()['x-robots-tag']).toBeUndefined();
  expect((await request.get('/remote-boardgame?room=ABC123&turn=secret')).headers()['x-robots-tag']).toContain('noindex');
  expect((await request.get('/remote-boardgame')).headers()['x-robots-tag']).toBeUndefined();
});

test('法務ページに販売条件・分配条件・非提携表示があり相互に移動できる', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByText('Streetboardgame運営者', { exact: true })).toBeVisible();
  await expect(page.getByText('平川智章', { exact: true })).toBeVisible();
  await expect(page.getByText(/群馬県吾妻郡嬬恋村鎌原1040-1613/)).toBeVisible();
  await expect(page.getByText('090-4707-5225', { exact: true })).toBeVisible();
  await expect(page.getByText(/購入日から30日間/)).toBeVisible();

  await page.getByRole('link', { name: '収益分配規約' }).click();
  await expect(page).toHaveURL('/creator-terms');
  await expect(page.getByText(/対象サービスおよび応援機能の売上総額（税込）の70%/)).toBeVisible();
  await expect(page.getByText(/14日間保留/)).toBeVisible();
  await expect(page.getByText(/5,000円未満の場合は翌月以降へ繰り越し/)).toBeVisible();
  await expect(page.getByText(/規約のバージョン/)).toBeVisible();
  await expect(page.getByText(/Stripe ConnectアカウントID/)).toBeVisible();
  await expect(page.getByText(/YouTube、Googleまたはその関係会社が提供、後援、承認するサービスではありません/).first()).toBeVisible();

  const nav = page.getByRole('navigation', { name: '法務ページ' });
  for (const path of ['/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy']) {
    await expect(nav.locator(`a[href="${path}"]`)).toHaveCount(1);
  }
});

test('全法務ページをPC・スマホ幅で読みやすく表示できる', async ({ page }) => {
  for (const path of ['/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('navigation', { name: '法務ページ' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path}で横スクロールが発生しない`).toBe(true);
  }
});

test('プライバシー方針に利用目的・委託先・保存期間・自動削除を明記する', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '3. 利用目的' })).toBeVisible();
  for (const processor of ['Cloudflare Workers / CDN', 'Cloudflare D1（ゲーム用）', 'Cloudflare D1（購入履歴専用）', 'Cloudflare R2', 'Stripe', 'Google / YouTube API Services', 'Google Analytics 4（GA4）', 'Formspree']) {
    await expect(page.getByText(processor, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Cloudflare Cron Triggerにより毎時自動削除または匿名化/)).toBeVisible();
  await expect(page.getByText(/購入後30日。その後R2画像を削除/)).toBeVisible();
  await expect(page.getByText(/ゲームデータとは別の購入履歴専用D1/)).toBeVisible();
  await expect(page.getByText(/管理画面の二要素認証と短期セッション/)).toBeVisible();
  await expect(page.getByText(/個人情報保護委員会への報告と対象者への通知/)).toBeVisible();
});

test('WorkerがHTML・APIへContent Security Policyと共通セキュリティヘッダーを付ける', async ({ request, page }) => {
  for (const path of ['/', '/live', '/privacy', '/live-ops', '/api/live/status']) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers['content-security-policy'], path).toContain("default-src 'none'");
    expect(headers['content-security-policy'], path).toContain("object-src 'none'");
    expect(headers['content-security-policy'], path).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy'], path).toContain("script-src-attr 'none'");
    expect(headers['content-security-policy'], path).toContain("frame-src 'none'");
    expect(headers['content-security-policy'], path).toContain("media-src 'none'");
    expect(headers['content-security-policy'], path).toContain('https://formspree.io');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['strict-transport-security'], path).toContain('max-age=31536000');
    expect(headers['x-permitted-cross-domain-policies'], path).toBe('none');
    expect(headers['origin-agent-cluster'], path).toBe('?1');
  }
  for (const path of ['/live', '/live-ops', '/remote', '/api/live/status']) {
    expect((await request.get(path)).headers()['referrer-policy'], path).toBe('no-referrer');
  }
  const pageResponse = await page.goto('/');
  const csp = pageResponse?.headers()['content-security-policy'] || '';
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  const scriptNonces = await page.locator('script').evaluateAll((scripts) => scripts.map((script) => script.nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every((value) => value === nonce)).toBe(true);

  await page.goto('/remote?room=ABC123&role=target&turn=secret-token&manage=secret-manage');
  const analyticsScript = (await page.locator('script').allTextContents()).find((text) => text.includes("gtag('config'")) || '';
  expect(analyticsScript).toContain('page_location: location.origin + location.pathname');
  expect(analyticsScript).toContain('page_path: location.pathname');
});

test('sitemap・robots・末尾スラッシュの正規化が一致する', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTP応答は画面幅に依存しないためPCで1回検証');

  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locations).toEqual(PUBLIC_ROUTES.flatMap(({ path }) => (
    path === '/live-guide' ? [`${ORIGIN}${path}`, `${ORIGIN}/live`] : [`${ORIGIN}${path}`]
  )));
  expect(new Set(locations).size).toBe(locations.length);
  expect([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].every(([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);

  const robotsResponse = await request.get('/robots.txt');
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();
  expect(robots).toContain('Disallow: /*?screen=');
  expect(robots).toContain('Disallow: /api/');
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

  for (const path of ['/love', '/remote', '/friends', '/family', '/boardgame', '/live-guide', '/about', '/product', '/terms', '/privacy', '/legal', '/creator-terms', '/refund-policy', '/content-guidelines', '/minor-policy']) {
    const response = await request.get(`${path}/`, { maxRedirects: 0 });
    expect(response.status(), `${path}/のステータス`).toBe(301);
    expect(response.headers().location, `${path}/の転送先`).toBe(`http://127.0.0.1:4173${path}`);
  }

  for (const [file, cleanPath] of [['/index.html', '/'], ['/remote.html', '/remote'], ['/live.html', '/live'], ['/live_ops.html', '/live-ops']]) {
    const response = await request.get(file, { maxRedirects: 0 });
    expect(response.status(), `${file}のステータス`).toBe(301);
    expect(response.headers().location, `${file}の転送先`).toBe(`http://127.0.0.1:4173${cleanPath}`);
  }
});
