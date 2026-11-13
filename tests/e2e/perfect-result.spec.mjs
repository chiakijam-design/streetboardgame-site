import { createIsolatedContext } from '../helpers/test-network-guard.mjs';
import { test, expect } from './test.mjs';

const choices = ['A', 'B', 'C', 'D', 'E'];
async function isolate(context) { await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort()); }

async function playTwo(browser, request, choice) {
  const made = await request.post('/api/challenge/rooms', { data: { creatorName: 'みお', cards: [0, 1].map(i => ({ id: 'perfect' + i, title: 'Synthetic perfect ' + i, choices })), answers: [0, 0] } });
  expect(made.status()).toBe(201);
  const { code } = await made.json();
  const context = await createIsolatedContext(browser); await isolate(context);
  const page = await context.newPage();
  await page.goto(`/challenge?room=${code}&analytics=exclude`);
  await page.locator('#participant-name').fill('Player');
  await page.locator('[data-action="join"]').evaluate(b => b.click());
  for (let i = 0; i < 2; i++) { await expect(page.locator('.challenge-q-number')).toHaveText(`Q${i + 1}/2`); await page.locator('[data-action="answer"]').nth(choice).click(); }
  await expect(page.getByTestId('challenge-result-image')).toBeVisible();
  return { context, page };
}

test('a perfect score shows the gold "<creator>王" card, confetti and, a few seconds later, a share popup', async ({ browser, request }) => {
  const { context, page } = await playTwo(browser, request, 0);
  await expect(page.getByRole('heading', { name: '2/2問 正解' })).toHaveCount(1);
  await expect(page.getByTestId('challenge-result-image')).toHaveAttribute('alt', /称号はみお王/);
  await expect(page.getByTestId('challenge-confetti')).toHaveCount(1);
  await expect(page.getByTestId('challenge-result-details')).toHaveAttribute('open', '');
  const popup = page.getByTestId('challenge-perfect-popup');
  await expect(popup).toBeVisible({ timeout: 8000 });
  await expect(popup.getByRole('heading')).toHaveText('👑 満点でした！');
  await expect(popup).toContainText('この結果をみんなに伝えましょう');
  await expect(popup.getByRole('button', { name: '結果を共有' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await popup.getByRole('button', { name: '閉じる' }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByTestId('challenge-confetti')).toHaveCount(0, { timeout: 8000 });
  await context.close();
});

test('a non-perfect score keeps the normal card and shows no popup', async ({ browser, request }) => {
  const { context, page } = await playTwo(browser, request, 1);
  await expect(page.getByRole('heading', { name: '0/2問 正解' })).toHaveCount(1);
  await expect(page.getByTestId('challenge-confetti')).toHaveCount(0);
  await page.waitForTimeout(4500);
  await expect(page.getByTestId('challenge-perfect-popup')).toHaveCount(0);
  await context.close();
});
