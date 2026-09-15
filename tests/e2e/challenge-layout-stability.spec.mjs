import { expect, test } from '@playwright/test';

test('初期HTMLはH1と領域を確保し、カタログ取得で開始画面を動かさない', async ({ page }) => {
  // Isolate catalog-driven layout from independently timed remote font swaps.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
  let releaseGame;
  const gameGate = new Promise((resolve) => { releaseGame = resolve; });
  await page.route('**/dist/challenge_game-*.js', async (route) => {
    await gameGate;
    await route.continue();
  });
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

  await page.goto('/challenge', { waitUntil: 'commit' });

  const app = page.locator('#challenge-app');
  await expect(app).toHaveAttribute('aria-busy', 'true');
  await expect(app.locator('.challenge-app-placeholder')).toBeVisible();
  await expect(app.locator('h1')).toContainText('私のこと、ちゃんと');
  const initial = await app.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    overflow: getComputedStyle(element).overflow,
  }));
  expect(initial.height).toBe(760);
  expect(initial.overflow).toBe('hidden');

  releaseGame();
  await expect(page.locator('.challenge-hero')).toBeVisible();
  await expect(app).not.toHaveAttribute('aria-busy', 'true');
  await expect(app.locator('.challenge-app-placeholder')).toHaveCount(0);
  const start = page.locator('[data-action="start-create"]');
  await expect(start).toBeDisabled();
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await document.fonts.ready;
  });
  // Current behavior renders the real start form before the catalog resolves.
  const before = await app.boundingBox();
  const buttonBefore = await start.boundingBox();
  releaseCatalog();
  await expect(start).toBeEnabled();
  const after = await app.boundingBox();
  const buttonAfter = await start.boundingBox();
  expect(Math.abs(after.height - before.height)).toBeLessThan(2);
  expect(Math.abs((buttonAfter.y - after.y) - (buttonBefore.y - before.y))).toBeLessThan(2);
});
