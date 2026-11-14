import { expect, test } from './test.mjs';

test('Aboutは旧来の立体カードデザインで現在のクイズと方針を案内する', async ({ page }) => {
  await page.goto('/about');

  await expect(page.getByTestId('about-hero')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByText('当てるより、話すための1〜10問。')).toBeVisible();
  await expect(page.getByTestId('about-brand-promise')).toContainText('何度でも挑戦できる');
  await expect(page.getByRole('heading', { name: '理解度ボード', exact: true })).toBeVisible();
  await expect(page.getByText(/表示名と点数が理解度ボードに自動で載ります/)).toBeVisible();
  await expect(page.getByRole('link', { name: /クイズ.*みんなに挑戦してもらう/ })).toHaveAttribute('href', '/challenge');
  await expect(page.getByRole('link', { name: /カードで遊べる製品版/ })).toHaveAttribute('href', '/product');
  await expect(page.getByTestId('about-page')).toHaveCSS('max-width', '600px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('感想・改善要望フォームをページ内から自前の受け口 /api/contact へJSONで送信できる', async ({ page }) => {
  const requests = [];
  await page.route('**/api/contact', async (route) => {
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
  expect(new URL(requests[0].url()).pathname).toBe('/api/contact');
  expect(requests[0].headers().accept).toBe('application/json');
  expect(requests[0].headers()['content-type']).toBe('application/json');
  const body = requests[0].postDataJSON();
  expect(body).toMatchObject({
    name: '',
    email: '',
    message: '結果画面が楽しかったです。共有をもっと簡単にしてほしいです。',
    hp: '',
    extra: {
      subject: 'streetboardgame.com 感想・改善要望・お問い合わせ',
      topic: '',
      feedback_type: '改善要望',
      usage_scene: '問題に回答した',
    },
  });
  expect(typeof body.elapsedMs).toBe('number');
  expect(body.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(page.locator('input[name="_subject"]')).toHaveValue('streetboardgame.com 感想・改善要望・お問い合わせ');
});

test('通常の感想は名前とメールアドレスなしで送れる', async ({ page }) => {
  await page.route('**/api/contact', (route) => route.fulfill({
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
  await page.route('**/api/contact', (route) => route.fulfill({
    status: 429,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'rate-limited' }),
  }));

  await page.goto('/about');
  await page.getByLabel('お名前').fill('テスト利用者');
  await page.getByLabel('メールアドレス').fill('contact-test@example.com');
  await page.getByLabel('感想・改善してほしいこと').fill('再送テストです。');
  await page.getByRole('button', { name: '送信する' }).click();

  await expect(page.getByRole('alert')).toContainText('送信に失敗しました。時間をおいてもう一度お試しください。');
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
