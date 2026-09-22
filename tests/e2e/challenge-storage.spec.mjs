import { test, expect } from './test.mjs';

async function disableStorage(page, failure) {
  await page.addInitScript(({ failure }) => {
    if (failure === 'denied') {
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() { throw new DOMException('Storage is blocked', 'SecurityError'); },
        });
      }
    } else if (failure === 'local-denied') {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Local storage is blocked', 'SecurityError'); },
      });
    } else {
      Storage.prototype.setItem = () => {
        throw new DOMException('Storage is full', 'QuotaExceededError');
      };
    }
  }, { failure });
}

async function roomForTest(page, request) {
  await page.goto('/challenge');
  const cards = await page.evaluate(() => window.COMMON_QUESTION_CARDS.slice(0, 10));
  const response = await request.post('/api/challenge/rooms', {
    data: { creatorName: '保存テスト', cards, answers: Array(10).fill(0) },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).code;
}

for (const failure of ['denied', 'quota']) {
  test(`storage ${failure}: participant can finish and retry without persistent storage`, async ({ page, request }) => {
    const code = await roomForTest(page, request);
    await disableStorage(page, failure);
    await page.goto(`/challenge?room=${code}`);
    await page.locator('#participant-name').fill('回答者');
    await page.locator('[data-action="join"]').click();
    for (let i = 0; i < 10; i += 1) {
      await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/10`);
      await page.locator('[data-action="answer"]').first().click();
    }
    await expect(page.locator('.challenge-result')).toHaveCount(10);
    await page.locator('[data-action="retry-challenge"]').click();
    await expect(page.locator('.challenge-q-number')).toHaveText('Q1/10');
  });
}

test('storage denied: creator can publish the completed quiz', async ({ page }) => {
  await disableStorage(page, 'denied');
  await page.goto('/challenge');
  await page.locator('#creator-name').fill('出題者');
  await page.locator('[data-action="start-create"]').click();
  await page.locator('#question-submit-consent').uncheck();
  for (let i = 0; i < 10; i += 1) {
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/10`);
    await page.locator('[data-action="builder-answer"]').first().click();
  }
  await expect(page.getByTestId('challenge-share-screen')).toBeVisible();
  await expect(page).toHaveURL(/\/challenge\/manage\?room=/);
});

test('local storage denied: session storage preserves participant on reload', async ({ page, request }) => {
  const code = await roomForTest(page, request);
  await disableStorage(page, 'local-denied');
  await page.goto(`/challenge?room=${code}`);
  await page.locator('#participant-name').fill('再開テスト');
  await page.locator('[data-action="join"]').click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q1/10');
  await page.locator('[data-action="answer"]').first().click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');
  await page.reload();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');
});
