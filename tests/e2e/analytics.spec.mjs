import { expect, test } from './test.mjs';

test('localhostではGA4を読み込まず、PlaywrightはGA通信を遮断する', async ({ page, analyticsBlocker }) => {
  const analyticsRequests = [];
  page.on('request', (request) => {
    if (/google-analytics|googletagmanager/.test(request.url())) {
      analyticsRequests.push(request.url());
    }
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__WATACHAN_ANALYTICS_DISABLED__)).toBe(true);
  expect(analyticsRequests).toEqual([]);

  await page.evaluate(async () => {
    try {
      await fetch('https://www.google-analytics.com/g/collect?test=playwright-block');
    } catch {
      // Playwrightの共通ルートで遮断されることが期待値。
    }
  });
  await expect.poll(() => analyticsBlocker.blockedRequests).toBeGreaterThan(0);
});

test('計測除外指定をブラウザへ保存し、URLから設定用パラメータを除く', async ({ page }) => {
  await page.goto('/?analytics=exclude');

  await expect(page.getByRole('status')).toContainText('アクセス解析の対象外に設定しました');
  await expect.poll(() => page.url()).not.toContain('analytics=');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('watachan:analytics-excluded:v1'))).toBe('1');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__WATACHAN_ANALYTICS_DISABLED__)).toBe(true);
});
