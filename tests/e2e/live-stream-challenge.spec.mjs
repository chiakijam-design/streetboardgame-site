import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset');
});

test('top page exposes the third live challenge button with the primary design', async ({ page }) => {
  await page.goto('/');
  const love = page.getByRole('button', { name: '彼氏の愛情を判定する' });
  const live = page.getByRole('link', { name: 'ライブ配信でみんなに挑戦してもらう' }).first();
  await expect(live).toBeVisible();
  await expect(live).toHaveAttribute('href', '/live-challenge');
  const styles = await Promise.all([love, live].map((locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      color: style.color,
      fontWeight: style.fontWeight,
      minHeight: style.minHeight,
    };
  })));
  expect(styles[1]).toEqual(styles[0]);
});

test('streamer and viewer answer ten questions and viewer receives a result card', async ({ page, context }) => {
  await page.goto('/live-challenge');
  await expect(page.getByRole('heading', { name: /ライブ配信で/ })).toBeVisible();
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await page.getByLabel('配信者名（24文字まで）').fill('わたちゃん');
  await page.locator('[data-question="0"]').fill('配信で一番盛り上がるのは？');
  await page.locator('[data-option="0:0"]').fill('クイズ');
  await page.getByRole('button', { name: /この10問でLIVEを作る/ }).click();

  await expect(page.getByRole('heading', { name: '視聴者を招待する' })).toBeVisible();
  const code = (await page.locator('.room-code').textContent())?.trim() || '';
  expect(code).toMatch(/^[0-9]{6}$/);
  const viewer = await context.newPage();
  await viewer.goto(`/live-challenge?room=${code}`);
  await viewer.getByLabel('あなたの名前（24文字まで）').fill('視聴者A');
  await viewer.getByRole('button', { name: /^参加する/ }).click();
  await expect(viewer.getByRole('heading', { name: '配信者のスタート待ち' })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: '参加中' })).toContainText('1人');

  await page.getByRole('button', { name: /10問をスタート/ }).click();
  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    await page.locator('[data-action="host-answer"]').first().click();
    await expect(viewer.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    await viewer.locator('[data-action="viewer-answer"]').first().click();
    await expect(viewer.getByText('回答済みです。')).toBeVisible();
    await page.locator('[data-action="advance"]').click();
  }

  await expect(page.getByRole('heading', { name: 'LIVEクイズ終了！' })).toBeVisible();
  await expect(viewer.getByTestId('live-result-card')).toBeVisible();
  await expect(viewer.getByText('10/10', { exact: true })).toBeVisible();
  await expect(viewer.locator('.result-row')).toHaveCount(10);
});
