import { expect, test } from './test.mjs';

const ORIGIN = 'https://www.streetboardgame.com';

test('公開する2モードと共通ページのSEO・構造が一貫する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタは画面幅に依存しないためPCで1回検証');
  const routes = [
    ['/', 'わたし理解度診断｜私のこと、ちゃんと分かってるよね？', 'わたし理解度診断｜私のこと、ちゃんと分かってるよね？'],
    ['/challenge-guide', 'みんなに挑戦してもらう｜10問クイズの遊び方・作り方', 'みんなに挑戦してもらう'],
    ['/challenge', '通常版｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？', '私のこと、ちゃんと分かってるよね？'],
    ['/challenge/library', '人気の10問パック｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？', '人気のお題ライブラリ'],
    ['/live-challenge', 'LIVE版｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？', '私のこと、ちゃんと'],
    ['/about', 'About｜わたし理解度診断・私のこと、ちゃんと分かってるよね？', 'About'],
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
test('廃止した6モードと遠隔APIは404を返す', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTP状態は画面幅に依存しないためPCで1回検証');
  for (const path of ['/love', '/friends', '/family', '/boardgame', '/remote', '/remote-boardgame']) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
  expect((await request.get('/api/remote/rooms/123456')).status()).toBe(404);
});

test('サイトマップ掲載URLは200・自己canonical・index可能で統一する', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPメタ情報は画面幅に依存しないためPCで1回検証');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.streetboardgame\.com\/[^<]*)<\/loc>/g)]
    .map((match) => match[1]);
  const lastModifiedDates = [...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)]
    .map((match) => match[1]);
  expect(urls.length).toBeGreaterThan(10);
  expect(new Set(urls).size).toBe(urls.length);
  expect(lastModifiedDates).toHaveLength(urls.length);
  expect(lastModifiedDates.every((value) => Number.isFinite(Date.parse(`${value}T00:00:00Z`)))).toBe(true);
  for (const updatedUrl of [
    `${ORIGIN}/`,
    `${ORIGIN}/challenge`,
    `${ORIGIN}/challenge/library`,
    `${ORIGIN}/live-challenge`,
    `${ORIGIN}/terms`,
    `${ORIGIN}/privacy`,
    `${ORIGIN}/en/challenge`,
    `${ORIGIN}/en/live-challenge`,
    `${ORIGIN}/en/terms`,
    `${ORIGIN}/en/privacy`,
  ]) {
    const expectedDate = [
      `${ORIGIN}/privacy`,
      `${ORIGIN}/en/privacy`,
    ].includes(updatedUrl) ? '2026-08-18' : [
      `${ORIGIN}/challenge`,
      `${ORIGIN}/live-challenge`,
      `${ORIGIN}/terms`,
      `${ORIGIN}/en/challenge`,
      `${ORIGIN}/en/live-challenge`,
      `${ORIGIN}/en/terms`,
    ].includes(updatedUrl) ? '2026-07-28' : '2026-07-27';
    expect(sitemap).toContain(`<loc>${updatedUrl}</loc>\n    <lastmod>${expectedDate}</lastmod>`);
  }

  const titles = new Set();
  const descriptions = new Set();
  for (const url of urls) {
    const response = await request.get(new URL(url).pathname);
    expect(response.status(), url).toBe(200);
    const html = await response.text();
    expect(html, url).toContain(`<link rel="canonical" href="${url}"`);
    expect(html.match(/<link rel="canonical"/gi) || [], `${url} canonical count`).toHaveLength(1);
    expect(html.match(/<h1(?:\s|>)/gi) || [], `${url} h1 count`).toHaveLength(1);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
    const description = html.match(/<meta name="description" content="([^"]+)"/i)?.[1]?.trim() || '';
    expect(title.length, `${url} title`).toBeGreaterThan(10);
    expect(description.length, `${url} description`).toBeGreaterThan(30);
    expect(titles.has(title), `${url} duplicate title: ${title}`).toBe(false);
    expect(descriptions.has(description), `${url} duplicate description: ${description}`).toBe(false);
    titles.add(title);
    descriptions.add(description);
    const robots = html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] || '';
    expect(robots, url).not.toContain('noindex');
  }

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  expect(robots).not.toContain('Disallow: /challenge');
  expect(robots).not.toContain('Disallow: /live-challenge');
});

test('ゲーム画面は表示言語のお題データだけを読み込む', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '配信HTMLは画面幅に依存しないためPCで1回検証');
  for (const path of ['/challenge', '/live-challenge']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('data-build-entry="prototype_common_data"');
    expect(html, path).not.toContain('data-build-entry="prototype_english_common_data"');
  }
  for (const path of ['/en/challenge', '/en/live-challenge']) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain('data-build-entry="prototype_common_data"');
    expect(html, path).toContain('data-build-entry="prototype_english_common_data"');
  }
});

test('内容ハッシュ付きCSSを長期キャッシュする', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPキャッシュは画面幅に依存しないためPCで1回検証');
  for (const path of ['/', '/challenge', '/live-challenge', '/terms']) {
    const html = await (await request.get(path)).text();
    const stylesheets = [...html.matchAll(/<link[^>]+data-build-style="[^"]+"[^>]+href="([^"]+)"/g)]
      .map((match) => match[1]);
    expect(stylesheets.length, path).toBeGreaterThan(0);
    for (const stylesheetPath of stylesheets) {
      expect(stylesheetPath, path).toMatch(/^\/dist\/[a-z0-9-]+-[a-f0-9]{12}\.css$/);
      const stylesheet = await request.get(stylesheetPath);
      expect(stylesheet.status(), stylesheetPath).toBe(200);
      expect(stylesheet.headers()['cache-control'], stylesheetPath).toContain('max-age=31536000');
      expect(stylesheet.headers()['cache-control'], stylesheetPath).toContain('immutable');
    }
  }
});

test('手書きフォントは軽量WOFF2だけを参照し長期キャッシュする', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPキャッシュは画面幅に依存しないためPCで1回検証');
  const fontPath = '/assets/fonts/HuiFontP29.woff2?v=20260727-font-1';
  for (const path of ['/', '/challenge', '/live-challenge']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain(fontPath);
    expect(html, path).not.toContain('HuiFontP29.ttf');
  }
  const font = await request.get(fontPath);
  expect(font.status()).toBe(200);
  expect(font.headers()['content-type']).toContain('font/woff2');
  expect(font.headers()['cache-control']).toContain('max-age=31536000');
  expect(font.headers()['cache-control']).toContain('immutable');
  expect((await font.body()).byteLength).toBeLessThan(2_000_000);
});

test('トップの内部リンクと構造化データに廃止モードを残さない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTML構造は画面幅に依存しないためPCで1回検証');
  await page.goto('/');
  await expect(page.locator('a[href="/love"]')).toHaveCount(0);
  await expect(page.locator('a[href="/challenge-guide"]').first()).toBeAttached();
  await expect(page.locator('footer a[href="/challenge"]')).toBeAttached();
  await expect(page.locator('footer a[href="/live-challenge"]')).toBeAttached();
  await expect(page.locator('footer a[href="/challenge-guide"]')).toBeAttached();
  await expect(page.getByRole('button', { name: '10問を作り始める', exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: 'LIVE版で作る', exact: true })).toBeAttached();
  await expect(page.locator('a[href="/challenge/library"]').first()).toContainText('人気のお題');
  await expect(page.locator('a[href="/privacy"]').first()).toBeAttached();
  await expect(page.locator('#retired-love-schema')).toHaveCount(0);
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

test('ゲームページはパンくず構造化データ、専用canonical、画像プレビュー設定を持つ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'SEOメタは画面幅に依存しないためPCで1回検証');
  for (const path of ['/challenge', '/challenge/library', '/live-challenge', '/en/challenge', '/en/live-challenge']) {
    await page.goto(path);
    const jsonLd = (await page.locator('script[type="application/ld+json"]').first().textContent()) || '';
    expect(jsonLd, path).toContain('BreadcrumbList');
    const graph = JSON.parse(jsonLd)['@graph'] || [];
    const pageNode = graph.find((node) => ['WebPage', 'CollectionPage'].includes(node['@type']));
    expect(pageNode?.primaryImageOfPage?.url, `${path} primary image`).toMatch(/^https:\/\/www\.streetboardgame\.com\/assets\/ogp-/);
    if (path !== '/challenge/library') {
      const appNode = graph.find((node) => Array.isArray(node['@type']) && node['@type'].includes('WebApplication'));
      expect(appNode?.isAccessibleForFree, `${path} free app`).toBe(true);
      expect(appNode?.offers, `${path} free offer`).toMatchObject({
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
      });
    }
    const canonical = path === '/challenge/library' ? `${ORIGIN}/challenge/library` : `${ORIGIN}${path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /max-image-preview:large/);
  }
  await page.goto('/challenge/library');
  await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute('href', `${ORIGIN}/challenge/library`);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
});

test('日英の主要ページは共有先へブランド名・言語・安全なOGP画像URLを渡す', async ({ page }) => {
  for (const path of ['/', '/challenge', '/live-challenge']) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'わたし理解度診断');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ja_JP');
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute('content', 'en_US');
    await expect(page.locator('meta[property="og:image:secure_url"]')).toHaveAttribute('content', /^https:\/\/www\.streetboardgame\.com\/assets\/ogp-/);
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png');
  }

  for (const path of ['/en/', '/en/challenge', '/en/live-challenge']) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Understanding Quiz');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute('content', 'ja_JP');
    await expect(page.locator('meta[property="og:image:secure_url"]')).toHaveAttribute('content', /^https:\/\/www\.streetboardgame\.com\/assets\/ogp-/);
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png');
  }
});

test('英語トップのLCP画像は初期HTMLから適切な候補を高優先で取得する', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTML属性は画面幅に依存しないためPCで1回検証');
  await page.goto('/en/');
  const preload = page.locator('link[rel="preload"][as="image"][href="/assets/character/girl-full-480.webp"]');
  await expect(preload).toHaveAttribute('imagesrcset', /girl-full-960\.webp/);
  await expect(preload).toHaveAttribute('fetchpriority', 'high');
  const hero = page.locator('img.girl');
  await expect(hero).toHaveAttribute('srcset', /girl-full-960\.webp/);
  await expect(hero).toHaveAttribute('sizes', /\(max-width: 460px\) 135px, 190px/);
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect(hero).toHaveAttribute('width', '326');
  await expect(hero).toHaveAttribute('height', '480');
});

test('公開ページの画像は代替テキストと表示寸法を持つ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '画像属性は画面幅に依存しないためPCで1回検証');
  for (const path of ['/', '/challenge-guide', '/about', '/product', '/en/']) {
    await page.goto(path);
    const images = page.locator('img');
    for (let index = 0; index < await images.count(); index += 1) {
      const image = images.nth(index);
      const attributes = await image.evaluate((element) => ({
        alt: element.getAttribute('alt'),
        width: element.getAttribute('width'),
        height: element.getAttribute('height'),
      }));
      expect(attributes.alt, `${path} img[${index}] alt`).not.toBeNull();
      expect(Number(attributes.width), `${path} img[${index}] width`).toBeGreaterThan(0);
      expect(Number(attributes.height), `${path} img[${index}] height`).toBeGreaterThan(0);
    }
  }
});

test('トップの自己ホストスクリプトをCSPで拒否せず、不要なscript preloadを送らない', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'CSPは画面幅に依存しないためPCで1回検証');
  const errors = [];
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|violates the following/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    if (/\/assets\/vendor\/react(?:-dom)?\.production\.min-/.test(request.url())) failures.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('#root h1')).toBeVisible();
  await expect(page.locator('link[data-build-preload="react"], link[data-build-preload="react_dom"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('挑戦モードと説明ページは専用OGP画像を配信する', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'OGPメタと画像配信は画面幅に依存しないためPCで1回検証');
  const imageUrl = `${ORIGIN}/assets/ogp-challenge-v3.png?v=20260726-ogp-2`;
  for (const path of ['/challenge', '/challenge-guide']) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', imageUrl);
  }
  const sharePath = '/challenge?room=ABCDEFGH&share=challenge-20260726-1';
  const shareUrl = `${ORIGIN}${sharePath}`;
  await page.goto(sharePath);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', shareUrl);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl);
  const imageResponse = await request.get('/assets/ogp-challenge-v3.png');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toBe('image/png');
  expect((await imageResponse.body()).byteLength).toBeGreaterThan(100_000);
});

test('CSP・主要セキュリティヘッダーと404を維持する', async ({ request, page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTPヘッダーは画面幅に依存しないためPCで1回検証');
  for (const path of ['/', '/challenge-guide', '/challenge', '/live-challenge', '/privacy']) {
    const response = await request.get(path);
    expect(response.headers()['content-type'], path).toContain('text/html; charset=UTF-8');
    const csp = response.headers()['content-security-policy'];
    expect(csp, path).toContain("default-src 'none'");
    expect(csp, path).toContain('https://scripts.clarity.ms');
    expect(csp, path).toContain('https://c.clarity.ms');
    expect(csp, path).toContain('https://h.clarity.ms');
    expect(csp, path).toContain("frame-src 'none'");
    expect(response.headers()['x-content-type-options'], path).toBe('nosniff');
    expect(response.headers()['referrer-policy'], path).toBeTruthy();
  }
  const response = await page.goto('/does-not-exist-for-test');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
});
