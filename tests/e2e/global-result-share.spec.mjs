import { expect, test } from './test.mjs';

test('OS share cancellation, rapid clicks, errors and returning preserve fallback controls', async ({ page, request }) => {
  const cards = Array.from({ length: 10 }, (_, index) => ({ id: `share-fixture-${index}`, title: `Fixture ${index}`, category: 'Fixture', choices: ['One', 'Two', 'Three', 'Four', 'Five'] }));
  const created = await request.post('/api/challenge/rooms', { data: { creatorName: 'Fixture', cards, answers: Array(10).fill(0) } });
  expect(created.status()).toBe(201);
  const { code } = await created.json();
  await page.addInitScript(() => {
    window.__SHARE_CALLS__ = 0;
    window.__SHARE_MODE__ = 'pending';
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
      window.__SHARE_CALLS__++;
      window.__SHARE_PAYLOAD__ = { url: payload.url, files: payload.files?.length || 0 };
      if (window.__SHARE_MODE__ === 'pending') return new Promise((resolve, reject) => { window.__SHARE_RESOLVE__ = resolve; window.__SHARE_REJECT__ = reject; });
      if (window.__SHARE_MODE__ === 'error') throw new DOMException('Unavailable', 'NotAllowedError');
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__SHARE_COPIED__ = text; } } });
  });
  await page.goto(`/challenge?room=${code}&analytics=exclude`);
  await page.locator('#participant-name').fill('Fixture friend');
  await page.locator('[data-action="join"]').click();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/10`);
    await page.locator('[data-action="answer"]').first().click();
  }
  const controls = page.locator('[data-result-share-controls]');
  const native = controls.locator('[data-result-share="native"]');
  await expect(controls.locator('[data-result-share="save"]')).toBeEnabled();
  await native.click();
  await expect(native).toBeDisabled();
  // Programmatic dispatch simulates a second queued click; no real share opens.
  await native.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(await page.evaluate(() => window.__SHARE_CALLS__)).toBe(1);
  await page.evaluate(() => window.__SHARE_REJECT__(new DOMException('Cancelled', 'AbortError')));
  await expect(native).toBeEnabled();
  await expect(controls.locator('[data-result-share-status]')).toBeEmpty();
  await native.click();
  await page.evaluate(() => {
    window.__SHARE_OLD_REJECT__ = window.__SHARE_REJECT__;
    window.dispatchEvent(new Event('pagehide'));
  });
  await expect(native).toBeEnabled();
  await native.click();
  await page.evaluate(() => window.__SHARE_OLD_REJECT__(new DOMException('Departed', 'AbortError')));
  await expect(native).toBeDisabled();
  await page.evaluate(() => window.__SHARE_REJECT__(new DOMException('Cancelled', 'AbortError')));
  await expect(native).toBeEnabled();
  await expect(controls.locator('[data-result-share-status]')).toBeEmpty();
  await page.evaluate(() => { window.__SHARE_MODE__ = 'error'; });
  await native.click();
  await expect(controls.locator('[data-result-share-status]')).toContainText('リンクをコピー');
  await controls.locator('[data-result-share="copy"]').click();
  expect(await page.evaluate(() => window.__SHARE_COPIED__)).toBe(new URL(page.url()).origin + `/challenge?room=${code}`);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } });
    document.execCommand = () => false;
  });
  await controls.locator('[data-result-share="copy"]').click();
  await expect(controls.locator('[data-result-share-status]')).toContainText('コピーできませんでした');
  await expect(controls.locator('[data-result-share-url]')).toHaveValue(new URL(page.url()).origin + `/challenge?room=${code}`);
  await page.evaluate(() => { window.__SHARE_MODE__ = 'pending'; });
  await native.click();
  await page.getByRole('link', { name: '新しいお題で作る', exact: true }).click();
  await expect(page.locator('[data-result-share-controls]')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('[data-result-share="native"]')).toBeEnabled();
  await expect(page.locator('[data-result-share-status]')).toBeEmpty();
});
