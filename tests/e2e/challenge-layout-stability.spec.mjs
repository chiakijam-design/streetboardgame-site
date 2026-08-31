import { expect, test } from '@playwright/test';

test('問題カタログ待機中も通常版の初期レイアウト領域を予約する', async ({ page }) => {
  let releaseCatalog;
  const catalogGate = new Promise((resolve) => { releaseCatalog = resolve; });
  await page.route('**/api/questions/catalog', async (route) => {
    await catalogGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ questions: [], selectionStats: [] }),
    });
  });

  await page.goto('/challenge', { waitUntil: 'domcontentloaded' });

  const app = page.locator('#challenge-app');
  await expect(app).toHaveAttribute('aria-busy', 'true');
  await expect(app.locator('.challenge-app-placeholder')).toBeVisible();
  const initial = await app.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    overflow: getComputedStyle(element).overflow,
  }));
  expect(initial.height).toBe(760);
  expect(initial.overflow).toBe('hidden');

  releaseCatalog();
  await expect(page.locator('.challenge-hero')).toBeVisible();
  await expect(app).not.toHaveAttribute('aria-busy', 'true');
  await expect(app.locator('.challenge-app-placeholder')).toHaveCount(0);
  const renderedHeight = await app.evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(renderedHeight - initial.height)).toBeLessThan(8);
});
