import { expect, test } from '@playwright/test';

test('運営だけが二要素認証後にお題を審査し、全問題の掲載先を変更できる', async ({ page }) => {
  const reviewBodies = [];
  const saveBodies = [];
  const pendingId = '11111111-1111-4111-8111-111111111111';
  const overview = {
    catalog: [],
    submissions: [{
      id: pendingId,
      sourceMode: 'challenge',
      sourceQuestionId: null,
      title: '放課後にみんなでしたいことは？',
      choices: ['カラオケ', 'ゲーム', '買い物', '勉強', '帰宅'],
      status: 'pending',
      submittedAt: Date.now(),
      reviewedAt: null,
      reviewNote: '',
      catalogId: null,
    }],
  };

  await page.route('**/api/live/admin/session', async (route) => {
    expect(route.request().headers()['x-live-admin-token']).toHaveLength(32);
    expect(route.request().headers()['x-live-admin-otp']).toBe('123456');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionToken: 'question-admin-session', expiresAt: Date.now() + 15 * 60 * 1000 }),
    });
  });
  await page.route('**/api/questions/admin/overview', async (route) => {
    expect(route.request().headers()['x-live-admin-session']).toBe('question-admin-session');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) });
  });
  await page.route(`**/api/questions/admin/submissions/${pendingId}/review`, async (route) => {
    reviewBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ submissionId: pendingId, status: 'approved', catalogId: 'CUS1234567890ABCDEFGHIJ' }),
    });
  });
  await page.route('**/api/questions/admin/catalog/*', async (route) => {
    saveBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ question: route.request().postDataJSON() }),
    });
  });

  const response = await page.goto('/question-ops');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  await expect(page).toHaveTitle('お題審査・シリーズ管理 | Streetboardgame');
  await expect(page.locator('#dashboard')).toBeHidden();
  await page.locator('#adminToken').fill('x'.repeat(32));
  await page.locator('#adminOtp').fill('123456');
  await page.locator('#loadQuestions').click();

  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#adminToken')).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('live:admin-session'))).toBe('question-admin-session');
  await expect(page.locator('#pendingSubmissions')).toContainText('放課後にみんなでしたいことは？');
  const totalText = await page.locator('#questionCount').textContent();
  const total = Number(totalText?.match(/全(\d+)問/)?.[1] || 0);
  expect(total).toBeGreaterThan(100);

  const pending = page.locator(`[data-submission="${pendingId}"]`);
  await pending.locator('[data-field="targetFamily"]').uncheck();
  page.once('dialog', (dialog) => dialog.accept());
  await pending.getByRole('button', { name: '編集内容で承認' }).click();
  await expect.poll(() => reviewBodies.length).toBe(1);
  expect(reviewBodies[0]).toMatchObject({
    decision: 'approved',
    useChallenge: true,
    useLive: true,
    targetFriend: true,
    targetFamily: false,
  });

  const firstQuestion = page.locator('[data-catalog]').first();
  await firstQuestion.locator('[data-field="useLive"]').uncheck();
  await firstQuestion.getByRole('button', { name: '編集・掲載先を保存' }).click();
  await expect.poll(() => saveBodies.length).toBe(1);
  expect(saveBodies[0].useChallenge).toBe(true);
  expect(saveBodies[0].useLive).toBe(false);
  expect(saveBodies[0].status).toBe('approved');
});
