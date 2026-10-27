import { expect, test } from './test.mjs';

const code = 'QADEMO88';
test('390px by 667px creator controls fit before and after the first answer', async ({ page, request }, testInfo) => {
  await request.post('/__test/reset');
  await page.setViewportSize({ width: 390, height: 667 });
  await page.addInitScript(() => localStorage.setItem('watachan:analytics-excluded:v1', '1'));
  await page.goto('/challenge');
  await page.locator('#creator-name').fill('Layout fixture');
  await page.locator('[data-action=start-create]').click();
  for (const count of [0, 1]) {
    if (count) await page.locator('[data-action=builder-answer]').first().click();
    await expect(page.locator('[data-action=finish-early]')).toHaveText(count ? 'この1問でクイズを作成' : 'クイズを作成');
    const geometry = await page.locator('[data-action=skip-question], [data-action=edit-question], [data-action=finish-early], [data-action=custom-question]').evaluateAll(buttons => buttons.map(button => {
      const r = button.getBoundingClientRect(); return { action: button.dataset.action, top: r.top, bottom: r.bottom, height: r.height };
    }));
    expect(geometry.map(x => x.action)).toEqual(['skip-question', 'edit-question', 'finish-early', 'custom-question']);
    for (const box of geometry) { expect(box.top).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeLessThanOrEqual(667); expect(box.height).toBeGreaterThanOrEqual(44); }
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.screenshot({ path: testInfo.outputPath('creator-390-667.png') });
});

async function fixture(page, scene, locale = 'ja', count = 2) {
  await page.addInitScript(() => {
    localStorage.setItem('watachan:analytics-excluded:v1', '1');
    sessionStorage.setItem('watachan-challenge-token:QADEMO88', 'synthetic-participant');
    window.__opens = []; window.__copies = []; window.__shares = 0;
    window.open = (...args) => { window.__opens.push(args); return null; };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copies.push(value) } });
  });
  const cards = Array.from({ length: count }, (_, i) => ({ id: `fixture-${i}`, title: `Question ${i + 1}`, category: 'Fixture', choices: ['One', 'Two', 'Three', 'Four', 'Five'] }));
  let listed = false;
  const rankingCalls = [];
  await page.route('**/api/challenge/rooms/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const room = { code, creatorName: 'Fixture', cards, participantCount: 0, completedParticipants: 0, maxParticipants: 50 };
    let body = { room };
    if (pathname.endsWith('/manage')) body = { room, participants: [] };
    if (pathname.endsWith('/result')) body = { code, creatorName: 'Fixture', score: count, participant: { name: 'Friend', rankingParticipating: listed }, answers: cards.map(card => ({ card, selected: 0, correct: 0, match: true })) };
    if (pathname.endsWith('/ranking')) {
      rankingCalls.push(route.request().method()); listed = route.request().method() === 'POST';
      body = { participant: { name: 'Friend', rankingParticipating: listed } };
    }
    await route.fulfill({ json: body });
  });
  const prefix = locale === 'ja' ? '' : '/' + locale;
  await page.goto(`${prefix}/challenge${scene === 'host' ? '/manage' : ''}?room=${code}${scene === 'host' ? '#manage=synthetic-management' : ''}`);
  await expect(page.locator('[data-result-share=save]')).toBeEnabled();
  return { url: new URL(page.url()).origin + `${prefix}/challenge?room=${code}`, rankingCalls };
}

for (const scene of ['host', 'result']) for (const [locale, width] of [['ja', 390], ['ja', 1280], ['en', 390], ['ar', 390]]) {
  test(`${scene}/${locale}/${width}: compact controls keep every SNS visible and keyboard accessible`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 667 });
    const { url, rankingCalls } = await fixture(page, scene, locale, width === 390 ? 1 : 10);
    const controls = page.locator('[data-result-share-controls]');
    await expect(page.locator('[data-action=copy-url]')).toHaveCount(0);
    const actions = ['native', 'copy', 'save', 'x', 'line', 'whatsapp', 'instagram-link', 'instagram'];
    for (const action of actions) {
      const button = controls.locator(`[data-result-share="${action}"]`);
      await expect(button).toBeVisible();
      expect(await button.evaluate(el => Boolean(el.closest('details')))).toBe(false);
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const action of ['x', 'line', 'whatsapp', 'instagram-link']) {
      const label = controls.locator(`[data-result-share="${action}"] strong`);
      expect(await label.evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1)).toBe(true);
    }
    await controls.locator('[data-result-share=native]').focus();
    for (const action of actions.slice(1)) {
      await page.keyboard.press('Tab'); await expect(controls.locator(`[data-result-share="${action}"]`)).toBeFocused();
    }
    const help = controls.locator('[data-result-share-fallback]');
    await expect(help).not.toHaveAttribute('open', '');
    await page.keyboard.press('Tab'); await expect(help.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(controls.locator('[data-result-share-url]')).toBeVisible();
    await expect(controls.locator('[data-result-share-url]')).toHaveValue(url);
    await page.keyboard.press('Enter'); await expect(controls.locator('[data-result-share-url]')).toBeHidden();
    if (scene === 'result') {
      await expect(page.locator('[data-board-settings]')).not.toHaveAttribute('open', '');
      expect(await page.locator('[data-action=toggle-ranking]').isChecked()).toBe(false);
    }
    expect(rankingCalls).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.activeElement?.blur());
    const panel = scene === 'host' ? page.getByTestId('challenge-share-screen') : page.getByTestId('challenge-result-share');
    await panel.screenshot({ path: testInfo.outputPath(`${scene}-${locale}-${width}.png`), animations: 'disabled' });
  });
}

for (const scene of ['host', 'result']) test(`${scene}: unsupported, failed, cancelled and rapid shares retain safe fallbacks`, async ({ page }) => {
  const { url, rankingCalls } = await fixture(page, scene);
  const controls = page.locator('[data-result-share-controls]');
  const native = controls.locator('[data-result-share=native]');
  const status = controls.locator('[data-result-share-status]');
  const help = controls.locator('[data-result-share-fallback]');
  await native.click();
  await expect(status).toContainText('リンクをコピー');
  await expect(controls.locator('[data-result-share-url]')).toBeVisible();
  await controls.locator('[data-result-share=copy]').click();
  expect(await page.evaluate(() => window.__copies)).toEqual([url]);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    document.execCommand = () => false;
  });
  await help.locator('summary').click();
  await controls.locator('[data-result-share=copy]').click();
  await expect(status).toContainText('コピーできませんでした');
  await expect(controls.locator('[data-result-share-url]')).toBeVisible();
  await expect(controls.locator('[data-result-share-url]')).toHaveValue(url);
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('save unavailable'); }; });
  await controls.locator('[data-result-share=save]').click();
  await expect(status).toContainText('画像を保存できませんでした');
  await expect(native).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => { window.__shares++; return new Promise((resolve, reject) => { window.__rejectShare = reject; }); } });
  });
  await native.click(); await expect(native).toBeDisabled();
  await native.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.__shares)).toBe(1);
  await page.evaluate(() => window.__rejectShare(new DOMException('cancelled', 'AbortError')));
  await expect(native).toBeEnabled(); await expect(status).toBeEmpty();
  for (const action of ['x', 'line', 'whatsapp']) await controls.locator(`[data-result-share=${action}]`).click();
  const opened = await page.evaluate(() => window.__opens);
  expect(opened).toHaveLength(3);
  for (const [href, target, options] of opened) {
    expect(decodeURIComponent(href)).toContain(url);
    expect(decodeURIComponent(href)).not.toMatch(/manage|synthetic/);
    expect(target).toBe('_blank'); expect(options).toBe('noopener,noreferrer');
  }
  expect(rankingCalls).toEqual([]);
  if (scene === 'result') {
    await page.locator('[data-board-settings] > summary').click();
    await page.locator('[data-action=toggle-ranking]').check();
    await expect(page.locator('[data-action=toggle-ranking]')).toBeFocused();
    expect(rankingCalls).toEqual([]);
    await controls.locator('[data-result-share=copy]').click();
    await expect(page.locator('.challenge-result-board-message')).toContainText('設定を更新しました');
    expect(rankingCalls).toEqual(['POST']);
    await page.locator('[data-action=toggle-ranking]').uncheck();
    await expect(page.locator('[data-action=toggle-ranking]')).toBeFocused();
    await controls.locator('[data-result-share=copy]').click();
    await expect(page.locator('.challenge-result-board-message')).toContainText('設定を更新しました');
    expect(rankingCalls).toEqual(['POST', 'DELETE']);
  }
});
