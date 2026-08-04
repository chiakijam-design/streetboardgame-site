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

test('感想・改善要望フォームをページ内からFormspreeへ送信できる', async ({ page }) => {
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
  await expect(page.getByTestId('feedback-prompt')).toContainText('何が楽しかったか');
  await page.getByLabel('送りたい内容').selectOption('改善要望');
  await page.getByLabel('使った場面').selectOption('問題に回答した');
  await page.getByLabel('感想・改善してほしいこと').fill('結果画面が楽しかったです。共有をもっと簡単にしてほしいです。');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByRole('status')).toContainText('声を届けていただきありがとうございます');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].method()).toBe('POST');
  expect(requests[0].headers().accept).toBe('application/json');
  const body = requests[0].postData() || '';
  expect(body).toContain('改善要望');
  expect(body).toContain('問題に回答した');
  expect(body).toContain('結果画面が楽しかったです。共有をもっと簡単にしてほしいです。');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.locator('input[name="_subject"]')).toHaveValue('streetboardgame.com 感想・改善要望・お問い合わせ');
});

test('通常の感想は名前とメールアドレスなしで送れる', async ({ page }) => {
  await page.route('https://formspree.io/f/xrevejjr', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));

  await page.goto('/about');
  await expect(page.getByLabel('お名前')).not.toHaveAttribute('required', '');
  await expect(page.getByLabel('メールアドレス')).not.toHaveAttribute('required', '');
  await page.getByLabel('感想・改善してほしいこと').fill('短い感想です。');
  await page.getByRole('button', { name: '送信する' }).click();
  await expect(page.getByRole('status')).toContainText('送信しました');
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
  await page.getByLabel('感想・改善してほしいこと').fill('再送テストです。');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByRole('alert')).toContainText('入力内容を確認してください。');
  await expect(page.getByRole('button', { name: '送信する' })).toBeEnabled();
});

test('特商法表示事項の開示請求は専用案内と入力ひな形を表示する', async ({ page }) => {
  await page.goto('/?screen=about&to=contact&topic=commerce-disclosure');

  await expect(page.getByTestId('commerce-disclosure-contact-notice')).toContainText('所在地・電話番号の開示');
  await expect(page.getByLabel('お問い合わせ内容')).toHaveValue(/特定商取引法第11条に基づく表示事項/);
  await expect(page.locator('input[name="_subject"]')).toHaveValue('streetboardgame.com 特定商取引法第11条表示事項の開示請求');
  await expect(page.locator('input[name="topic"]')).toHaveValue('commerce-disclosure');
  await expect(page.getByLabel('お名前')).toHaveAttribute('required', '');
  await expect(page.getByLabel('メールアドレス')).toHaveAttribute('required', '');
  await expect(page.getByLabel('送りたい内容')).toHaveCount(0);
});

test('返金申請は専用案内と注文情報の入力ひな形を表示する', async ({ page }) => {
  await page.goto('/?screen=about&to=contact&topic=refund-request');

  await expect(page.getByTestId('refund-request-contact-notice')).toContainText('カード番号全桁やセキュリティコードは入力しない');
  await expect(page.getByLabel('お問い合わせ内容')).toHaveValue(/注文番号（ord_から始まる番号）/);
  await expect(page.locator('input[name="_subject"]')).toHaveValue('streetboardgame.com 返金・キャンセル申請');
  await expect(page.locator('input[name="topic"]')).toHaveValue('refund-request');
});
