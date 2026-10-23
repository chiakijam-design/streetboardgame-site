import { expect, test } from './test.mjs';
test('pricing clearly offers a free quiz and retains previous-purchase support', async ({ page, request }, testInfo) => {
  await page.goto('/?analytics=exclude');
  await page.getByTestId('top-pricing-link').click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('body')).toContainText('無料（0円）');
  await expect(page.locator('body')).toContainText('新規の有料販売・配信者登録は受け付けていません');
  await expect(page.locator('[data-price-list]')).toHaveCount(0);
  await expect(page.locator('a[href*="live-challenge"]')).toHaveCount(0);
  for (const path of ['/challenge', '/refund-policy', '/legal', '/contact']) expect((await request.get(path)).status()).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pricing.png'), fullPage: true });
});
