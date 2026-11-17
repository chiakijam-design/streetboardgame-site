import { expect, test } from './test.mjs';

// 2026-11-17：Playwright 1.65 は 32767px を超える画面写真を撮れない（mobile-safari の長い規約ページで失敗）。
// 写真は確認用の記録なので、長すぎるページは見えている範囲だけ撮る。
const canFullPage = page => page.evaluate(() => document.documentElement.scrollHeight * devicePixelRatio < 32000);

test('current legal pages explain the free quiz and link only to previous versions (LIVE removed 2026-11-15)', async ({ page }, testInfo) => {
  for (const path of ['/legal', '/terms', '/privacy', '/minor-policy', '/content-guidelines']) {
    await page.goto(path + '?analytics=exclude');
    const history = page.getByTestId('historical-provisions');
    if (path === '/legal') await expect(history).toHaveCount(0);
    else { await expect(history).toHaveCount(1); await expect(history).not.toHaveAttribute('open', ''); }
    const visible = await page.locator('main').innerText();
    expect(visible).not.toMatch(/LIVE版の有料サービスの内容をご案内|お金がかかる機能|出題者または配信者|有料販売を行う場合は|選択したコメントまたは|Googleセキュリティ設定|上記目的/);
    if (path === '/terms' || path === '/content-guidelines') {
      expect(visible).toContain('掲載候補の送信に同意した利用者コンテンツ');
      expect(visible).toContain('無償かつ非独占的');
    }
    if (path !== '/legal') expect(visible).toContain('掲載候補として送信しない問題は、この目的では公開しません');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '-current.png'), fullPage: await canFullPage(page) });
  }
  await page.goto('/en/terms?analytics=exclude');
  await expect(page.locator('main')).toContainText('These Terms apply to the free quiz “Know Me Quiz”');
});

test('library shows real questions and choices before game creation and hides empty metrics', async ({ page }, testInfo) => {
  const writes = [];
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    if (route.request().url().includes('/api/questions/trends')) return route.fulfill({ json: { metrics: [] } });
    await route.continue();
  });
  await page.goto('/challenge/library?analytics=exclude');
  const library = page.getByTestId('question-library');
  await expect(library.locator('.challenge-pack-card')).toHaveCount(9);
  await expect(library).not.toContainText(/メインターゲット|主力候補|共有時の訴求/);
  const examples = page.getByTestId('public-question-examples');
  await expect(examples).toContainText('コンビニでつい買うなら');
  await expect(examples).toContainText('おにぎり');
  await expect(examples).toContainText('出題者と同じ選択肢を選ぶと1問正解');
  await expect(examples.locator('ol li')).toHaveCount(10);
  await expect(page.getByTestId('recent-question-trends')).toBeHidden();
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const image of await library.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  await examples.screenshot({ path: testInfo.outputPath('question-examples.png') });
  await page.screenshot({ path: testInfo.outputPath('question-library.png') });
});

test('public pages retain useful content, working links and no LIVE entry', async ({ page, request }, testInfo) => {
  for (const path of ['/', '/challenge-guide', '/about', '/product', '/terms', '/privacy', '/legal', '/content-guidelines', '/minor-policy']) {
    const response = await page.goto(path + '?analytics=exclude');
    expect(response.status(), path).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByTestId('live-retirement-notice')).toHaveCount(0);
    await expect(page.locator('a[href$="/pricing"]')).toHaveCount(0);
    await expect(page.locator('a[href*="live-challenge"], [data-home-mode="live"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBe(true);
    const links = await page.locator('main a[href^="/"]').evaluateAll(elements => [...new Set(elements.map(e => e.getAttribute('href')))]);
    for (const href of links) expect((await request.get(href)).status(), path + ' → ' + href).toBe(200);
  }
  await page.goto('/privacy?analytics=exclude');
  await expect(page.locator('body')).toContainText('Googleの広告Cookie');
  await expect(page.locator('a[href="https://myadcenter.google.com/personalizationoff"]')).toBeVisible();
  await expect(page.locator('a[href="https://www.aboutads.info/choices/"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('privacy.png'), fullPage: await canFullPage(page) });
});

test('free quiz and Amazon product information stay separate, readable and keyboard accessible', async ({page}, info) => {
  for (const locale of ['ja','en','ar']) for (const width of [1280,390,320]) {
    await page.setViewportSize({width,height:800});
    await page.goto((locale==='ja'?'':'/'+locale)+'/legal?analytics=exclude');
    await expect(page.getByTestId('free-quiz-information')).toBeVisible();
    // 2026-11-15: /legal is the operator page; the physical edition is our own product sold on Amazon.
    await expect(page.getByTestId('operator-information')).toContainText(locale==='ja'?'平川智章':'Chiaki Hirakawa');
    const product=page.getByTestId('physical-product-information');
    await expect(product).toBeVisible();
    const seller=product.locator('a[href="https://www.amazon.co.jp/sp?seller=A3QW758BCMIP1P"]');
    const returns=product.locator('a[href*="GKM69DUUYKQWKWX7"]');
    await expect(seller).toBeVisible();await expect(returns).toBeVisible();
    expect(await seller.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43);
    expect(await returns.evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await expect(page.locator('a[href$="/refund-policy"]')).toHaveCount(0);
    await seller.focus();await page.keyboard.press('Tab');await expect(returns).toBeFocused();
    if(locale==='ja'&&width===390)await page.screenshot({path:info.outputPath('commerce-ja-390.png'),fullPage:true});
  }
});
