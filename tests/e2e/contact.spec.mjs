import { expect, test } from './test.mjs';

test('Aboutは旧来の立体カードデザインで現在の2モードと方針を案内する', async ({ page }) => {
  await page.goto('/about');

  await expect(page.getByTestId('about-hero')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByText('当てるより、話すための10問。')).toBeVisible();
  await expect(page.getByTestId('about-brand-promise')).toContainText('何度でも挑戦できる');
  await expect(page.getByText('結果公開は自分で選べる', { exact: true })).toBeVisible();
  await expect(page.getByText('点数による順位づけもしません。')).toBeVisible();
  await expect(page.getByRole('link', { name: /通常版.*みんなに挑戦してもらう/ })).toHaveAttribute('href', '/challenge');
  await expect(page.getByRole('link', { name: /LIVE版.*ライブ配信でみんなに挑戦してもらう/ })).toHaveAttribute('href', '/live-challenge');
  await expect(page.getByRole('link', { name: /カードで遊べる製品版/ })).toHaveAttribute('href', '/product');
  await expect(page.getByTestId('about-page')).toHaveCSS('max-width', '600px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('お問い合わせフォームをページ内からFormspreeへ送信できる', async ({ page }) => {
  const requests = [];
  await page.route('https://formspree.io/f/xrevejjr', async (route) => {
    requests.push(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/about');
  await expect(page.locator('a[href*="docs.google.com/forms"]')).toHaveCount(0);
  await page.getByLabel('お名前').fill('テスト利用者');
  await page.getByLabel('メールアドレス').fill('contact-test@example.com');
  await page.getByLabel('お問い合わせ内容').fill('お問い合わせフォームの動作確認です。');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByRole('status')).toContainText('送信しました');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].method()).toBe('POST');
  expect(requests[0].headers().accept).toBe('application/json');
  const body = requests[0].postData() || '';
  expect(body).toContain('contact-test@example.com');
  expect(body).toContain('お問い合わせフォームの動作確認です。');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('送信先がエラーを返した場合は再送できる案内を表示する', async ({ page }) => {
  await page.route('https://formspree.io/f/xrevejjr', (route) => route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({ errors: [{ message: '入力内容を確認してください。' }] }),
  }));

  await page.goto('/about');
  await page.getByLabel('お名前').fill('テスト利用者');
  await page.getByLabel('メールアドレス').fill('contact-test@example.com');
  await page.getByLabel('お問い合わせ内容').fill('再送テストです。');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByRole('alert')).toContainText('入力内容を確認してください。');
  await expect(page.getByRole('button', { name: '送信する' })).toBeEnabled();
});
