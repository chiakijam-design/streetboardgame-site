import { expect, test } from './test.mjs';







test('initial library image and secondary page fonts are discoverable without JS font downloads', async ({ page, request }) => {
  const library = await (await request.get('/challenge/library')).text();
  expect(library).toContain('rel="preload" as="image" href="/assets/question-packs/easy-first-meeting.svg"');
  await page.goto('/challenge/library');
  const images = page.getByTestId('question-library').locator('img');
  await expect(images.first()).toHaveAttribute('loading', 'eager');
  await expect(images.nth(1)).toHaveAttribute('loading', 'lazy');
  const product = await (await request.get('/product')).text();
  expect(product).toContain('data-page-subset="true"');
  expect(product).toContain('as="image" href="/assets/product/board-game-package-photo.webp"');
  const english = await (await request.get('/en/')).text();
  const englishFont = english.match(/href="(\/dist\/(?:english|home)-font-[a-f0-9]+\.css)"/)?.[1];
  expect(englishFont).toBeTruthy();
  expect((await request.get(englishFont)).status()).toBe(200);
  const initialLinks = english.match(/<link\b[^>]+>/g) || [];
  expect(initialLinks.some(link => link.includes('family=Noto+Sans+JP'))).toBe(false);
});

test('library artwork paints before the reviewed catalog arrives without exposing stale question details', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/questions/catalog', async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/challenge/library');
  const first = page.locator('.challenge-pack-card').first();
  await expect(first.locator('img')).toBeVisible();
  await expect(first.locator('details')).toHaveAttribute('inert', '');
  await expect(first.locator('ol li')).toHaveCount(0);
  release();
  await expect(first.locator('details')).not.toHaveAttribute('inert', '');
  await expect(first.locator('ol li')).toHaveCount(10);
});

test('completed normal play delivers image, report and role-swap actions without identity in the body', async ({ page, request }) => {
  // Simulate the OS accepting a file share; this is not a physical-device save test.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
  const actions = [];
  await page.route('**/api/challenge/rooms/*/actions', async route => {
    actions.push(route.request().postDataJSON());
    await route.continue();
  });
  await page.goto('/challenge');
  const cards = await page.evaluate(() => window.COMMON_QUESTION_CARDS.slice(0, 10));
  const created = await request.post('/api/challenge/rooms', { data: { creatorName: 'Host', cards, answers: Array(10).fill(0) } });
  const { code } = await created.json();
  await page.goto(`/challenge?room=${code}`);
  await page.locator('#participant-name').fill('Player');
  await page.locator('[data-action="join"]').click();
  for (let i=0;i<10;i++) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i+1}/10`);
    await page.locator('[data-action="answer"]').first().click();
  }
  await expect.poll(() => actions.map(a=>a.metric)).toContain('result_image_ready');
  await page.getByTestId('challenge-ai-review').scrollIntoViewIfNeeded();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('answer_report_viewed');
  await page.locator('[data-action="save-result-image"]').click();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('result_image_save_requested');
  await page.locator('[data-action="swap-roles"]').click();
  await expect.poll(() => actions.map(a=>a.metric)).toContain('role_swap_started');
  expect(actions.every(a=>Object.keys(a).length===1 && typeof a.metric==='string')).toBe(true);
  expect(actions.length).toBe(4);
});
