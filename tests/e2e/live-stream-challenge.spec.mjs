import { expect, test } from './test.mjs';
test('retired LIVE pages and aliases return 410 without creating games', async ({ page, request }) => {
  for (const path of ['/live-challenge', '/en/live-challenge?pack=live-party', '/fr/live-challenge?room=123456', '/live_challenge.html', '/?screen=live']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(410);
    expect(response.headers()['x-robots-tag']).toContain('noindex');
  }
  await page.goto('/live-challenge?analytics=exclude');
  await expect(page.getByRole('heading')).toHaveText('LIVE版は終了しました');
  await expect(page.getByRole('link', { name: '無料クイズ', exact: true })).toBeVisible();
});
test('new LIVE and payment operations are closed before bindings or Stripe calls', async ({ request }) => {
  for (const path of ['/api/live/games', '/api/live/stream-games', '/api/live/games/123456/checkout', '/api/live/games/123456/join', '/api/live/channel-verifications']) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(410);
    expect(await response.json()).toEqual({ error: 'live-retired' });
  }
});

test('previous buyers can recover an existing image without opening LIVE or a checkout', async ({ page }) => {
  const requests = [];
  let valid = true;
  await page.route('**/api/live/purchases/recover', async route => {
    requests.push(route.request().postDataJSON());
    const downloadUrl = valid ? new URL('/api/live/downloads/old_purchase?signature=fixture', route.request().url()).href : 'https://other.example/image.png';
    await route.fulfill({ json: { downloadUrl } });
  });
  await page.goto('/live-challenge?analytics=exclude');
  expect(requests).toHaveLength(0);
  await page.locator('summary').click();
  await page.getByLabel('Order ID').fill('ord_' + 'a'.repeat(32));
  await page.getByLabel('メールアドレス').fill('receipt@example.invalid');
  await page.getByRole('button', { name: '送信', exact: true }).click();
  const link = page.locator('#purchase-recovery-download');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\/api\/live\/downloads\/old_purchase/);
  expect(requests).toEqual([{ orderId: 'ord_' + 'a'.repeat(32), email: 'receipt@example.invalid' }]);
  valid = false;
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(link).toBeHidden();
  await expect(page.getByRole('status')).toContainText('お問い合わせフォーム');
});
