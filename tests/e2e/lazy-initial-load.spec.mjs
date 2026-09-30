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
    await trends.scrollIntoViewIfNeeded();
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
  await expect(trends.getByRole('heading', { name: 'Popular now' })).toBeVisible();
});

test('LIVEは招待画面が必要になるまでQR生成コードを取得しない', async ({ page }) => {
  const qrRequests = [];
  page.on('request', (request) => {
    if (/\/dist\/qr-code-[A-Z0-9]+\.js/.test(request.url())) qrRequests.push(request.url());
  });
  await page.goto('/live-challenge');
  await expect(page.locator('h1')).toBeVisible();
  expect(qrRequests).toEqual([]);
  const lazyScript = page.locator('script[data-build-lazy="qr-code"]');
  await expect(lazyScript).toHaveAttribute('type', 'application/x-page-script');
  // A local host-room fixture exercises the actual render/loader path.
  await page.route('**/api/live/games/123456', (route) => route.fulfill({ json: {
    code: '123456',
    game: {
      mode: 'stream-challenge', phase: 'lobby', subjectName: 'QRテスト',
      currentQuestionIndex: 0, questionCount: 10, participantCount: 0,
      participantLimit: 1000, realtime: false, results: [], host: true,
    },
  } }));
  await page.goto('/live-challenge?room=123456#host=' + 'b'.repeat(48));
  await expect(page.locator('#live-challenge-qr')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.WatachanLiveQrCode))).toBe(true);
  expect(qrRequests).toHaveLength(1);
  const colors = () => page.evaluate(() => {
    const canvas = document.getElementById('live-challenge-qr');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return [...new Set(Array.from(pixels))];
  });
  await expect.poll(colors).toContain(0);
  await expect.poll(colors).toContain(255);
});
