import { test, expect } from '@playwright/test';

test.use({ locale: 'ja-JP' });

test('通常版はカタログの応答前に表示し、入力した名前を保持する', async ({ page }) => {
  let releaseCatalog;
  const catalogReady = new Promise((resolve) => { releaseCatalog = resolve; });
  await page.route('**/api/questions/catalog', async (route) => {
    await catalogReady;
    await route.fulfill({ json: { questions: [] } });
  });
  await page.goto('/challenge', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.challenge-hero h1')).toBeVisible();
  await expect(page.locator('[data-action="start-create"]')).toBeDisabled();
  await page.locator('#creator-name').fill('先に入力');
  releaseCatalog();
  await expect(page.locator('[data-action="start-create"]')).toBeEnabled();
  await expect(page.locator('#creator-name')).toHaveValue('先に入力');
  await page.locator('[data-action="start-create"]').click();
  await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
});

test('ゲーム画面の可変フォントCSSは初期描画後に適用される', async ({ page }) => {
  for (const path of ['/challenge', '/live-challenge']) {
    await page.goto(path);
    await expect(page.locator('#game-font-styles')).toHaveAttribute('href', /wght@400\.\.900/);
    await expect(page.locator('#game-font-styles')).toHaveAttribute('media', 'all');
    await expect(page.locator('h1').first()).toBeVisible();
  }
});

test('トップはReactと外部フォントを取得せず、静的HTMLを表示する', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '10問を作り始める', exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="top-question-card"]')).toHaveCount(3);
  await expect(page.locator('main')).toHaveCount(1);
  expect(requested.filter((url) => /react(?:-dom)?\.production|prototype_app-|prototype_character-/.test(url))).toEqual([]);
  expect(requested.filter((url) => /fonts\.(?:googleapis|gstatic)\.com/.test(url))).toEqual([]);
  await page.screenshot({ path: `build/lcp/home-${test.info().project.name}.png`, fullPage: true });
});

test('JavaScriptなしでもトップの主要内容とリンクは重複せず表示される', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('#site-title')).toHaveCount(1);
    await expect(page.locator('[data-testid="top-character-visual"] img')).toBeVisible();
    await expect(page.locator('a[href="/pricing"]').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
