import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset');
});

test('top page exposes normal and live creator buttons with the same primary design', async ({ page }) => {
  await page.goto('/');
  const normal = page.getByRole('link', { name: 'みんなに挑戦してもらう', exact: true }).first();
  const live = page.getByRole('link', { name: 'ライブ配信でみんなに挑戦してもらう' }).first();
  const visual = page.getByTestId('top-character-visual');
  const rules = page.getByTestId('top-common-rules');
  await expect(rules).toBeVisible();
  await expect(rules).toContainText('クイズを作る人の基本の流れ');
  await expect(rules).toContainText('あなたのクイズを作って');
  await expect(page.getByTestId('top-common-rule-step')).toHaveCount(4);
  await expect(live).toBeVisible();
  await expect(live).toHaveAttribute('href', '/live-challenge');
  const [visualBox, rulesBox, normalBox] = await Promise.all([
    visual.boundingBox(),
    rules.boundingBox(),
    normal.boundingBox(),
  ]);
  expect(visualBox?.y + visualBox?.height).toBeLessThanOrEqual(rulesBox?.y);
  expect(rulesBox?.y + rulesBox?.height).toBeLessThanOrEqual(normalBox?.y);
  const styles = await Promise.all([normal, live].map((locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      color: style.color,
      fontWeight: style.fontWeight,
      minHeight: style.minHeight,
    };
  })));
  expect(styles[1]).toEqual(styles[0]);
});

test('streamer and viewer answer ten questions and viewer receives a result card', async ({ page, context }) => {
  let questionSubmissionRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/questions/submissions') {
      questionSubmissionRequests += 1;
    }
  });
  await page.goto('/live-challenge');
  await expect(page.getByRole('heading', { name: /ライブ配信で/ })).toBeVisible();
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByLabel(/掲載候補として運営に送る/)).not.toBeChecked();
  const loveCard = await page.evaluate(() => ({
    id: `LOVE${window.ALL_CARDS[0].id}`,
    title: window.ALL_CARDS[0].title,
    firstChoice: window.ALL_CARDS[0].choices[0],
  }));
  const firstLibrary = page.locator('[data-library="0"]');
  await expect(firstLibrary.locator(`option[value="${loveCard.id}"]`)).toHaveCount(1);
  await firstLibrary.selectOption(loveCard.id);
  await expect(page.locator('[data-question="0"]')).toHaveValue(loveCard.title);
  await expect(page.locator('[data-option="0:0"]')).toHaveValue(loveCard.firstChoice);
  await page.getByLabel('配信者名（24文字まで）').fill('わたちゃん');
  await page.locator('[data-question="0"]').fill('配信で一番盛り上がるのは？');
  await page.locator('[data-option="0:0"]').fill('クイズ');
  await page.getByRole('button', { name: /この10問でLIVEを作る/ }).click();

  await expect(page.getByRole('heading', { name: '視聴者を招待する' })).toBeVisible();
  expect(questionSubmissionRequests).toBe(0);
  await expect(page.getByTestId('question-submission-status')).toHaveCount(0);
  const code = (await page.locator('.room-code').textContent())?.trim() || '';
  expect(code).toMatch(/^[0-9]{6}$/);
  const viewer = await context.newPage();
  await viewer.goto(`/live-challenge?room=${code}`);
  await viewer.getByLabel('あなたの名前（24文字まで）').fill('視聴者A');
  await viewer.getByRole('button', { name: /^参加する/ }).click();
  await expect(viewer.getByRole('heading', { name: '配信者のスタート待ち' })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: '参加中' })).toContainText('1人');

  await page.getByRole('button', { name: /10問をスタート/ }).click();
  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    await page.locator('[data-action="host-answer"]').first().click();
    await expect(viewer.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    await viewer.locator('[data-action="viewer-answer"]').first().click();
    await expect(viewer.getByText('回答済みです。')).toBeVisible();
    await page.locator('[data-action="advance"]').click();
  }

  await expect(page.getByRole('heading', { name: 'LIVEクイズ終了！' })).toBeVisible();
  await expect(viewer.getByTestId('live-result-card')).toBeVisible();
  await expect(viewer.getByText('10/10', { exact: true })).toBeVisible();
  await expect(viewer.locator('.result-row')).toHaveCount(10);
});

test('ライブ版もチェックした自作お題だけ運営へ送信する', async ({ page }) => {
  const submissions = [];
  await page.route('**/api/questions/submissions', async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ submitted: 1, submissionIds: ['22222222-2222-4222-8222-222222222222'] }),
    });
  });
  await page.goto('/live-challenge');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await page.locator('[data-library="0"]').selectOption('__custom__');
  await page.locator('[data-question="0"]').fill('ライブ中に一番盛り上がる企画は？');
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-option="0:${index}"]`).fill(`ライブ選択肢${index + 1}`);
  }
  const consent = page.getByLabel(/掲載候補として運営に送る/);
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.getByLabel('配信者名（24文字まで）').fill('配信テスト');
  await page.getByRole('button', { name: /この10問でLIVEを作る/ }).click();

  await expect(page.getByTestId('question-submission-status')).toContainText('掲載候補として1問を運営へ送信しました');
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    consent: true,
    sourceMode: 'live-challenge',
    questions: [{
      sourceQuestionId: null,
      title: 'ライブ中に一番盛り上がる企画は？',
      choices: ['ライブ選択肢1', 'ライブ選択肢2', 'ライブ選択肢3', 'ライブ選択肢4', 'ライブ選択肢5'],
    }],
  });
});
