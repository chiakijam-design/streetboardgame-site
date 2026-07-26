import { expect, test } from './test.mjs';
import { readFile } from 'node:fs/promises';

test('運営だけが二要素認証後に表形式でお題を審査し、採用・保留・無効化を管理できる', async ({ page }) => {
  const reviewBodies = [];
  const saveBodies = [];
  const pendingId = '11111111-1111-4111-8111-111111111111';
  const overview = {
    catalog: [{
      id: 'CUSCOMPAREACTIVE1',
      sourceKind: 'custom',
      sourceRef: null,
      title: '管理テスト専用の休み時間は？',
      category: 'みんなのお題',
      choices: ['図書室', '校庭', '教室', '購買', '音楽室'],
      status: 'approved',
      useChallenge: true,
      useLive: true,
      reportCount: 0,
      lastReportedAt: null,
    }, {
      id: 'CUSCOMPAREACTIVE2',
      sourceKind: 'custom',
      sourceRef: null,
      title: '管理テスト専用の休み時間は？',
      category: 'みんなのお題',
      choices: ['図書室', '校庭', '教室', '購買', '音楽室'],
      status: 'approved',
      useChallenge: true,
      useLive: true,
      reportCount: 0,
      lastReportedAt: null,
    }, {
      id: 'CUSCOMPAREHELD',
      sourceKind: 'candidate',
      sourceRef: 'A-001',
      title: '管理テスト専用の休み時間は？',
      category: 'みんなのお題',
      choices: ['図書室', '校庭', '教室', '購買', '音楽室'],
      status: 'held',
      useChallenge: false,
      useLive: false,
      reportCount: 0,
      lastReportedAt: null,
    }, {
      id: 'CUSCOMPAREDISABLED',
      sourceKind: 'custom',
      sourceRef: null,
      title: '管理テスト専用の休み時間は？',
      category: 'みんなのお題',
      choices: ['図書室', '校庭', '教室', '購買', '音楽室'],
      status: 'disabled',
      useChallenge: false,
      useLive: false,
      reportCount: 0,
      lastReportedAt: null,
    }, {
      id: 'CUSREPORTED123',
      sourceKind: 'custom',
      sourceRef: null,
      title: '通報されたお題',
      category: 'みんなのお題',
      choices: ['1', '2', '3', '4', '5'],
      status: 'disabled',
      useChallenge: false,
      useLive: false,
      reportCount: 1,
      lastReportedAt: Date.now(),
    }, {
      id: 'CUSSIMILAR123',
      sourceKind: 'custom',
      sourceRef: null,
      title: '通報されていないお題',
      category: 'みんなのお題',
      choices: ['1', '2', '3', '4', '5'],
      status: 'approved',
      useChallenge: true,
      useLive: true,
      reportCount: 0,
      lastReportedAt: null,
    }],
    selectionStats: [{
      questionId: 'CUSCOMPAREACTIVE1',
      mode: 'challenge',
      shownCount: 10,
      skipCount: 3,
    }, {
      questionId: 'CUSCOMPAREACTIVE1',
      mode: 'live',
      shownCount: 10,
      skipCount: 1,
    }, {
      questionId: 'CUSCOMPAREACTIVE2',
      mode: 'challenge',
      shownCount: 20,
      skipCount: 1,
    }, {
      questionId: 'CUSCOMPAREHELD',
      mode: 'challenge',
      shownCount: 10,
      skipCount: 2,
    }, {
      questionId: 'CUSCOMPAREDISABLED',
      mode: 'challenge',
      shownCount: 10,
      skipCount: 3,
    }],
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
      safetyFlags: ['bullying', 'appearance-attack'],
    }],
  };

  await page.route('**/api/live/admin/session', async (route) => {
    expect(route.request().headers()['x-live-admin-token']).toHaveLength(32);
    expect(route.request().headers()['x-live-admin-otp']).toBe('123456');
    expect(route.request().headers()['x-live-admin-remember']).toBe('1');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionToken: 'question-admin-session',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        trusted: true,
      }),
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
  await expect(page).toHaveTitle('お題審査・問題管理 | Streetboardgame');
  await expect(page.locator('#dashboard')).toBeHidden();
  await page.locator('#adminToken').fill('x'.repeat(32));
  await page.locator('#adminOtp').fill('123456');
  await page.locator('#loadQuestions').click();

  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#adminToken')).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('live:admin-session'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('live:trusted-admin-session'))).toBe('question-admin-session');
  await expect(page.locator('#authPanel')).toBeHidden();
  await page.reload();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#authPanel')).toBeHidden();
  await expect(page.locator('#pendingSubmissions')).toContainText('放課後にみんなでしたいことは？');
  await expect(page.locator('#pendingSubmissions')).toContainText('重点審査：いじめ・容姿攻撃');
  await expect(page.getByText('通常版とLIVE版は同じ採用済みお題を使います。採用・保留・無効化、問題文、5つの選択肢を表でまとめて管理できます。')).toBeVisible();
  await expect(page.locator('#allQuestions')).toContainText('通報1件・即時非公開');
  await expect(page.locator('#allQuestions table')).toBeVisible();
  await expect(page.locator('#allQuestions thead')).toContainText('選択肢5');
  await expect(page.locator('#allQuestions thead')).toContainText('スキップ率');
  await expect(page.locator('#allQuestions')).not.toContainText('友達向け');
  await expect(page.locator('#allQuestions')).not.toContainText('家族向け');
  const totalText = await page.locator('#questionCount').textContent();
  const total = Number(totalText?.match(/全(\d+)問/)?.[1] || 0);
  expect(total).toBeGreaterThanOrEqual(60);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '全お題をスプレッドシート用に保存' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^streetboardgame-questions-\d{4}-\d{2}-\d{2}_\d{4}\.csv$/);
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xFEFF);
  expect(csv).toContain('状態,問題ID,問題文,選択肢1,選択肢2,選択肢3,選択肢4,選択肢5');
  expect(csv).toContain('無効化,CUSREPORTED123,通報されたお題,1,2,3,4,5');
  expect(csv.split('\r\n').length - 2).toBe(total);
  await expect(page.locator('#authStatus')).toContainText(`全${total}問`);
  const statusOrder = await page.locator('#allQuestions [data-catalog]').evaluateAll((rows) => rows.map((row) => row.dataset.statusRow));
  expect(statusOrder.indexOf('held')).toBeGreaterThan(statusOrder.lastIndexOf('approved'));
  expect(statusOrder.indexOf('disabled')).toBeGreaterThan(statusOrder.lastIndexOf('approved'));
  expect(statusOrder.indexOf('disabled')).toBeGreaterThan(statusOrder.lastIndexOf('held'));
  const activeRowsInDisplayOrder = await page.locator('#allQuestions [data-catalog^="CUSCOMPAREACTIVE"]').evaluateAll(
    (rows) => rows.map((row) => row.dataset.catalog),
  );
  expect(activeRowsInDisplayOrder).toEqual(['CUSCOMPAREACTIVE2', 'CUSCOMPAREACTIVE1']);
  await expect(page.locator('#similaritySummary')).not.toHaveText('類似候補：0問');
  const activeCompareRow = page.locator('[data-catalog="CUSCOMPAREACTIVE1"]');
  const heldCompareRow = page.locator('[data-catalog="CUSCOMPAREHELD"]');
  const disabledCompareRow = page.locator('[data-catalog="CUSCOMPAREDISABLED"]');
  await expect(activeCompareRow.locator('.skip-col')).toContainText('20.0%');
  await expect(activeCompareRow.locator('.skip-col')).toContainText('通常 30.0%（3/10）');
  await expect(activeCompareRow.locator('.skip-col')).toContainText('LIVE 10.0%（1/10）');
  await expect(page.locator('[data-catalog="CUSSIMILAR123"] .skip-col')).toContainText('データなし');
  await expect(activeCompareRow).toContainText('類似候補 100%');
  await expect(heldCompareRow).toContainText('類似候補 100%');
  await expect(disabledCompareRow).toContainText('類似候補 100%');
  await expect(disabledCompareRow.locator('[data-compare]')).toHaveCount(1);
  await activeCompareRow.getByRole('button', { name: '並べて比較' }).click();
  const activeComparison = page.locator('[data-comparison="CUSCOMPAREACTIVE1"]');
  await expect(activeComparison.locator('[data-compare-catalog]')).toHaveCount(2);
  await expect(activeComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE2"]')).toBeVisible();
  await expect(activeComparison.locator('[data-compare-catalog="CUSCOMPAREHELD"]')).toHaveCount(0);
  await expect(activeComparison.locator('[data-compare-catalog="CUSCOMPAREDISABLED"]')).toHaveCount(0);
  await heldCompareRow.getByRole('button', { name: '並べて比較' }).click();
  const heldComparison = page.locator('[data-comparison="CUSCOMPAREHELD"]');
  await expect(heldComparison.locator('[data-compare-catalog="CUSCOMPAREHELD"]')).toBeVisible();
  await expect(heldComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE1"]')).toBeVisible();
  await expect(heldComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE2"]')).toBeVisible();
  await expect(heldComparison.locator('[data-compare-catalog="CUSCOMPAREHELD"] [data-compare-status][value="held"]')).toBeChecked();
  await disabledCompareRow.getByRole('button', { name: '並べて比較' }).click();
  const disabledComparison = page.locator('[data-comparison="CUSCOMPAREDISABLED"]');
  await expect(disabledComparison.locator('[data-compare-catalog="CUSCOMPAREDISABLED"]')).toBeVisible();
  await expect(disabledComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE1"]')).toBeVisible();
  await expect(disabledComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE2"]')).toBeVisible();
  const comparedCandidate = activeComparison.locator('[data-compare-catalog="CUSCOMPAREACTIVE2"]');
  await comparedCandidate.locator('[data-field="title"]').fill('編集した休み時間の過ごし方は？');
  await comparedCandidate.locator('[data-choice="0"]').fill('中庭');
  await comparedCandidate.locator('[data-compare-status][value="disabled"]').check();
  await expect(comparedCandidate).toHaveClass(/dirty/);
  await comparedCandidate.getByRole('button', { name: 'この問題を保存' }).click();
  await expect.poll(() => saveBodies.length).toBe(1);
  expect(saveBodies[0]).toMatchObject({
    title: '編集した休み時間の過ごし方は？',
    status: 'disabled',
  });
  expect(saveBodies[0].choices[0]).toBe('中庭');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(await page.locator('#allQuestions .table-wrap').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const pending = page.locator(`[data-submission="${pendingId}"]`);
  page.once('dialog', (dialog) => dialog.accept());
  await pending.getByRole('button', { name: '採用' }).click();
  await expect.poll(() => reviewBodies.length).toBe(1);
  expect(reviewBodies[0]).toMatchObject({
    decision: 'approved',
    category: 'みんなのお題',
  });
  expect(reviewBodies[0]).not.toHaveProperty('targetFriend');
  expect(reviewBodies[0]).not.toHaveProperty('targetFamily');

  const firstQuestion = page.locator('[data-catalog]').first();
  await firstQuestion.locator('[data-status][value="disabled"]').check();
  await expect(page.locator('#saveAllQuestions')).toContainText('1問');
  await firstQuestion.getByRole('button', { name: 'この行を保存' }).click();
  await expect.poll(() => saveBodies.length).toBe(2);
  expect(saveBodies[1].status).toBe('disabled');
  expect(saveBodies[1]).not.toHaveProperty('useChallenge');
  expect(saveBodies[1]).not.toHaveProperty('useLive');
});
