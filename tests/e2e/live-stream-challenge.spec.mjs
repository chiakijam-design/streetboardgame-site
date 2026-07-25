import { expect, test } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset');
});

async function buildLiveQuestions(page, startIndex = 0) {
  for (let index = startIndex; index < 10; index += 1) {
    await expect(page.getByTestId('live-question-builder')).toBeVisible();
    await expect(page.locator('.q-badge')).toHaveText(`Q${index + 1}/10`);
    await expect(page.locator('.live-builder-option')).toHaveCount(5);
    await page.getByRole('button', {
      name: index === 9 ? /この問題を使ってLIVEを作る/ : /この問題を使う/,
    }).click();
  }
}

test('top page exposes normal and live creator buttons with the same primary design', async ({ page }) => {
  await page.goto('/');
  const normal = page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true }).first();
  const live = page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true }).first();
  const nameInput = page.getByLabel('あなたの名前（12文字まで）');
  const visual = page.getByTestId('top-character-visual');
  const rules = page.getByTestId('top-common-rules');
  await expect(rules).toBeVisible();
  await expect(rules).toContainText('あなたの理解度診断の作り方');
  await expect(rules).toContainText('あなたの理解度診断を作って、みんなに挑戦してもらおう');
  await expect(rules).toHaveCSS(
    'background-image',
    'linear-gradient(160deg, rgb(255, 214, 229) 0%, rgb(255, 234, 241) 100%)',
  );
  await expect(rules).toHaveCSS('box-shadow', 'rgb(214, 58, 117) 5px 5px 0px 0px');
  await expect(page.getByTestId('top-common-rule-step')).toHaveCount(4);
  await expect(nameInput).toBeVisible();
  await expect(live).toBeVisible();
  const [visualBox, rulesBox, nameBox, normalBox, liveBox] = await Promise.all([
    visual.boundingBox(),
    rules.boundingBox(),
    nameInput.boundingBox(),
    normal.boundingBox(),
    live.boundingBox(),
  ]);
  expect(visualBox?.y + visualBox?.height).toBeLessThanOrEqual(rulesBox?.y);
  expect(nameBox?.y).toBeGreaterThan(rulesBox?.y);
  expect(nameBox?.y + nameBox?.height).toBeLessThanOrEqual(normalBox?.y);
  expect(normalBox?.y + normalBox?.height).toBeLessThanOrEqual(liveBox?.y);
  expect(liveBox?.y + liveBox?.height).toBeLessThanOrEqual(rulesBox?.y + rulesBox?.height);
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
  await page.route('**/api/questions/submissions', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ submitted: 1, submissionIds: ['33333333-3333-4333-8333-333333333333'] }),
    });
  });
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/questions/submissions') {
      questionSubmissionRequests += 1;
    }
  });
  await page.goto('/live-challenge');
  await expect(page.getByRole('heading', { name: /ライブ配信で/ })).toBeVisible();
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByLabel('このクイズを友達や他の人も使えるようにする')).toBeChecked();
  await page.getByLabel('配信者名（24文字まで）').fill('わたちゃん');
  const beforeSkip = await page.getByTestId('live-question-builder').getByRole('heading', { level: 3 }).textContent();
  await page.getByRole('button', { name: /スキップ/ }).click();
  await expect(page.getByTestId('live-question-builder').getByRole('heading', { level: 3 })).not.toHaveText(beforeSkip || '');
  await page.getByRole('button', { name: /編集する/ }).click();
  await page.locator('[data-question="0"]').fill('配信で一番盛り上がるのは？');
  await page.locator('[data-option="0:0"]').fill('クイズ');
  await page.getByRole('button', { name: /この内容で問題に戻る/ }).click();
  await buildLiveQuestions(page);

  await expect(page.getByRole('heading', { name: '視聴者を招待する' })).toBeVisible();
  expect(questionSubmissionRequests).toBe(1);
  await expect(page.getByTestId('question-submission-status')).toContainText('掲載候補として1問を運営へ送信しました');
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

test('ライブ版も初期同意で、外したくない人はそのまま自作お題を運営へ送信する', async ({ page }) => {
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
  await page.getByLabel('配信者名（24文字まで）').fill('配信テスト');
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('[data-question="0"]').fill('ライブ中に一番盛り上がる企画は？');
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-option="0:${index}"]`).fill(`ライブ選択肢${index + 1}`);
  }
  const consent = page.getByLabel('このクイズを友達や他の人も使えるようにする');
  await expect(consent).toBeChecked();
  await page.getByRole('button', { name: /この内容で問題に戻る/ }).click();
  await buildLiveQuestions(page);

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

test('ライブ版も公開候補チェックを外した自作お題は運営へ送信しない', async ({ page }) => {
  let submissionRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/questions/submissions') {
      submissionRequests += 1;
    }
  });
  await page.goto('/live-challenge');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await page.getByLabel('配信者名（24文字まで）').fill('非公開配信');
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('[data-question="0"]').fill('配信内だけで使いたい問題は？');
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-option="0:${index}"]`).fill(`配信限定${index + 1}`);
  }
  await page.getByLabel('このクイズを友達や他の人も使えるようにする').uncheck();
  await page.getByRole('button', { name: /この内容で問題に戻る/ }).click();
  await buildLiveQuestions(page);
  await expect(page.getByRole('heading', { name: '視聴者を招待する' })).toBeVisible();
  expect(submissionRequests).toBe(0);
  await expect(page.getByTestId('question-submission-status')).toHaveCount(0);
});
