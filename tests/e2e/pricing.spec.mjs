import { expect, test } from './test.mjs';

test('トップから商品・料金を開き、無料範囲と全税込価格を確認できる', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '10問を作り始める', exact: true })).toBeVisible();
  const pricingLink = page.getByTestId('top-pricing-link');
  await pricingLink.scrollIntoViewIfNeeded();
  await expect(pricingLink).toBeVisible();
  await pricingLink.click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page).toHaveTitle('商品・料金｜STREET BOARD GAME');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('[data-price-list="result-image"]')).toHaveText('480円、980円、2,980円（税込）');
  await expect(page.locator('[data-price-list="support"]')).toHaveText('180円、480円、980円、1,980円、2,980円（税込）');
  await expect(page.locator('#price-list')).toContainText('無料（0円）');
  await expect(page.locator('#price-list')).toContainText('月額料金・自動更新はありません');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pricing-full.png'), fullPage: true });
  await page.getByRole('link', { name: 'トップへ', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '10問を作り始める', exact: true })).toBeVisible();
});

test('商品・料金はJavaScriptなしでも読めて主要導線が利用できる', async ({ browser, request }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  try {
    await page.goto(new URL('/pricing', testInfo.project.use.baseURL).toString());
    await expect(page.getByRole('heading', { name: '商品・サービスと税込価格', exact: true })).toBeVisible();
    await expect(page.locator('#result-image')).toContainText('購入日から30日間');
    await expect(page.locator('#support-message')).toContainText('寄付・贈与ではありません');
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
    for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test('商品・料金の正規URL・転送・セキュリティヘッダーを維持する', async ({ request }) => {
  const response = await request.get('/pricing');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  expect(response.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(await response.text()).toContain('<link rel="canonical" href="https://www.streetboardgame.com/pricing"');
  for (const path of ['/pricing/', '/pricing.html']) {
    const redirect = await request.get(path, { maxRedirects: 0 });
    expect(redirect.status(), path).toBe(301);
    expect(new URL(redirect.headers().location).pathname, path).toBe('/pricing');
  }
});
