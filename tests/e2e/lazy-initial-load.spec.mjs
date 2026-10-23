import { expect, test } from './test.mjs';

test('ライブラリは最近人気の取得を初期表示から外し、開いた問題一覧を保持する', async ({ page }) => {
  let trendsRequests = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/questions/trends?*', async (route) => {
    trendsRequests += 1;
    await ready;
    await route.fulfill({ json: { weeklySelections: [{ questionId: 'Q001', selectedCount: 3 }] } });
  });
  try {
    await page.goto('/challenge/library', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('question-library').locator('.challenge-pack-card')).toHaveCount(9);
    expect(trendsRequests).toBe(0);
    const details = page.locator('.challenge-pack-card details').first();
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    const trends = page.getByTestId('recent-question-trends');
    await page.getByTestId('public-question-examples').scrollIntoViewIfNeeded();
    await expect.poll(() => trendsRequests).toBe(1);
    await expect(trends).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(trends).toHaveAttribute('aria-busy', 'false');
    await expect(trends.locator('[data-trend-group="weekly"] li')).toHaveCount(1);
    await expect(details).toHaveAttribute('open', '');
  } finally {
    release();
  }
});

test('IntersectionObserverなしでもライブラリの最近人気を取得できる', async ({ page }) => {
  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.goto('/en/challenge/library');
  const trends = page.getByTestId('recent-question-trends');
  await expect(trends).toHaveAttribute('aria-busy', 'false');
  await expect(trends).toBeHidden();
});
