import { test, expect } from './test.mjs';
test.use({ hasTouch: true });

test('Bing指摘の5ページはJS実行前からページ固有のH1を返す', async ({ page, request }) => {
  for (const [path, heading] of [
    ['/', 'わたし理解度診断'], ['/challenge', '私のこと、ちゃんと'],
    ['/challenge-guide', 'みんなに挑戦してもらう'], ['/about', 'About'], ['/product', '製品版もあります'],
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = (await response.text()).replace(/<noscript[\s\S]*?<\/noscript>/g, '');
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    expect(headings, path).toHaveLength(1);
    expect(headings[0][1].replace(/<[^>]+>/g, ''), path).toContain(heading);
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(heading);
  }
});

test('旧404 URLは404のまま、公開サイトマップから参照しない', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of ['/play', '/ボードゲームをプレイ']) {
    expect((await request.get(encodeURI(path), { maxRedirects: 0 })).status()).toBe(404);
    expect(sitemap).not.toContain(path);
  }
});

test('カード内タップと5色ボタンで通常版を完走し、二重送信と掲載初期OFFを保つ', async ({ page, browser, request }, testInfo) => {
  await request.post('/__test/reset');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill('テスト出題者');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  for (let index = 0; index < 10; index += 1) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${index + 1}/10`);
    const card = page.getByTestId('challenge-builder-paper-card');
    await expect(card.locator('.notebook-card-choice-button')).toHaveCount(5);
    if (index === 0) await page.screenshot({ path: `build/interaction-qa/${testInfo.project.name}-card.png`, fullPage: true });
    await card.locator('.notebook-card-choice-button').nth(index % 5).tap();
  }
  await expect(page.getByRole('heading', { name: '主催者用回答管理' })).toBeVisible();
  const url = await page.getByRole('button', { name: 'URLをコピー' }).getAttribute('data-copy-value');
  const playerContext = await browser.newContext({
    viewport: page.viewportSize(), hasTouch: true,
    isMobile: testInfo.project.name.startsWith('mobile-'),
    userAgent: await page.evaluate(() => navigator.userAgent),
  });
  const player = await playerContext.newPage();
  player.on('pageerror', (error) => errors.push(error.message));
  await player.goto(url);
  await player.getByLabel('表示名（12文字まで）').fill('テスト回答者');
  await player.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
  let releaseAnswer;
  await player.route('**/api/challenge/rooms/*/answer', async (route) => {
    await new Promise((resolve) => { releaseAnswer = resolve; });
    await route.continue();
  });
  await player.locator('.notebook-card-choice-button').first().tap();
  await expect(player.locator('.notebook-card-choice-button:disabled')).toHaveCount(5);
  await expect(player.locator('.challenge-color-choice:disabled')).toHaveCount(5);
  await expect.poll(() => typeof releaseAnswer).toBe('function');
  releaseAnswer();
  await expect(player.locator('.challenge-q-number')).toHaveText('Q2/10');
  await player.unroute('**/api/challenge/rooms/*/answer');
  await player.reload();
  await expect(player.locator('.challenge-q-number')).toHaveText('Q2/10');
  for (let index = 1; index < 10; index += 1) {
    const selector = index % 2 ? '.challenge-color-choice' : '.notebook-card-choice-button';
    await player.locator(selector).nth(index % 5).tap();
    if (index < 9) await expect(player.locator('.challenge-q-number')).toHaveText(`Q${index + 2}/10`);
  }
  await expect(player.getByRole('heading', { name: '10/10問 正解' })).toBeVisible();
  await player.screenshot({ path: `build/interaction-qa/${testInfo.project.name}-result.png`, fullPage: true });
  await expect(player.locator('.challenge-result')).toHaveCount(10);
  await expect(player.locator('[data-action="publish-board-only"]')).toBeEnabled();
  const room = new URL(url).searchParams.get('room');
  const board = await (await request.get(`/api/challenge/rooms/${room}/ranking`)).json();
  expect(board.participants).toHaveLength(0);
  await expect(player.getByRole('button', { name: '同じ10問で、今度は私が出題する' })).toBeVisible();
  expect(errors).toEqual([]);
  await playerContext.close();
});
