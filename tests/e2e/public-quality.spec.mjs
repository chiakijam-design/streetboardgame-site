import { expect, test } from './test.mjs';

test('current legal pages explain the free quiz and keep historical purchase conditions separate', async ({ page }, testInfo) => {
  for (const path of ['/legal', '/terms', '/privacy', '/minor-policy', '/content-guidelines']) {
    await page.goto(path + '?analytics=exclude');
    const history = page.getByTestId('historical-provisions');
    await expect(history).not.toHaveAttribute('open', '');
    const visible = await page.locator('main').innerText();
    expect(visible).not.toMatch(/LIVE版の有料サービスの内容をご案内|お金がかかる機能|出題者または配信者|有料販売を行う場合は|選択したコメントまたは|Googleセキュリティ設定|上記目的/);
    if (path === '/terms' || path === '/content-guidelines') {
      expect(visible).toContain('掲載候補の送信に同意した利用者コンテンツ');
      expect(visible).toContain('無償かつ非独占的');
    }
    if (path !== '/legal') expect(visible).toContain('掲載候補として送信しない問題は、この目的では公開しません');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(path.slice(1) + '-current.png'), fullPage: true });
  }
  await page.goto('/en/terms?analytics=exclude');
  await expect(page.locator('main')).toContainText("These terms apply to Streetboardgame's free standard quiz");
});

test('library shows real questions and choices before game creation and hides empty metrics', async ({ page }, testInfo) => {
  const writes = [];
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') writes.push(route.request().url());
    if (route.request().url().includes('/api/questions/trends')) return route.fulfill({ json: { metrics: [] } });
    await route.continue();
  });
  await page.goto('/challenge/library?analytics=exclude');
  const library = page.getByTestId('question-library');
  await expect(library.locator('.challenge-pack-card')).toHaveCount(9);
  await expect(library).not.toContainText(/メインターゲット|主力候補|共有時の訴求/);
  const examples = page.getByTestId('public-question-examples');
  await expect(examples).toContainText('コンビニでつい買うなら');
  await expect(examples).toContainText('おにぎり');
  await expect(examples).toContainText('出題者と同じ選択肢を選ぶと1問正解');
  await expect(examples.locator('ol li')).toHaveCount(10);
  await expect(page.getByTestId('recent-question-trends')).toBeHidden();
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const image of await library.locator('img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  await examples.screenshot({ path: testInfo.outputPath('question-examples.png') });
  await page.screenshot({ path: testInfo.outputPath('question-library.png'), fullPage: true });
});

test('public pages retain useful content, working links and no LIVE entry', async ({ page, request }, testInfo) => {
  for (const path of ['/', '/challenge-guide', '/about', '/product', '/pricing', '/terms', '/privacy', '/legal', '/refund-policy', '/content-guidelines', '/minor-policy']) {
    const response = await page.goto(path + '?analytics=exclude');
    expect(response.status(), path).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('a[href*="live-challenge"], [data-home-mode="live"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), path).toBe(true);
    const links = await page.locator('main a[href^="/"]').evaluateAll(elements => [...new Set(elements.map(e => e.getAttribute('href')))]);
    for (const href of links) expect((await request.get(href)).status(), path + ' → ' + href).toBe(200);
  }
  await page.goto('/privacy?analytics=exclude');
  await expect(page.locator('body')).toContainText('Googleの広告Cookie');
  await expect(page.locator('a[href="https://myadcenter.google.com/personalizationoff"]')).toBeVisible();
  await expect(page.locator('a[href="https://www.aboutads.info/choices/"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('privacy.png'), fullPage: true });
});
