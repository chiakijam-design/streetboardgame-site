import { test, expect } from './test.mjs';
import { createHash } from 'node:crypto';

const hash = (i) => createHash('sha256').update(`isolated-operations-${i}`).digest('hex');
function fixture(i, kind) {
  const suffix = String(i).padStart(4, '0');
  return { id: kind === 'catalog' ? `PERFCAT${suffix}` : `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    sourceKind: 'custom', sourceRef: `isolated-${suffix}`, sourceMode: 'challenge', title: `架空の管理確認 ${hash(i).slice(0, 12)} は？`,
    choices: Array.from({ length: 5 }, (_, j) => `架空${hash(i + j * 9000).slice(0, 6)}`), status: kind === 'catalog' ? 'approved' : 'pending',
    useChallenge: kind === 'catalog', useLive: false, submittedAt: 1000 + i, reviewNote: `未審査・隔離確認 ${suffix}`, reportCount: 0, safetyFlags: [] };
}

async function stubCMS(page, { holdNext = false } = {}) {
  const catalog = Array.from({ length: 120 }, (_, i) => fixture(i + 1, 'catalog'));
  const requests = [], writes = [];
  let authenticated = true, release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/live/admin/session', async route => route.fulfill({ status: authenticated ? 200 : 401, contentType: 'application/json', body: JSON.stringify(authenticated ? { csrfToken: 'isolated-cms-csrf', expiresAt: Date.now() + 900000, trusted: true } : { error: 'admin-session-required' }) }));
  await page.route('**/api/live/admin/session/logout', async route => { authenticated = false; await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  await page.route('**/api/questions/admin/overview*', async route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('submissionOffset'));
    requests.push(offset);
    if (holdNext && offset === 50) await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ catalog, selectionStats: [], reports: [], submissions: Array.from({ length: Math.min(50, 2842 - offset) }, (_, i) => fixture(offset + i + 1, 'pending')), submissionPagination: { offset, limit: 50, total: 2842 } }) });
  });
  await page.route('**/api/questions/admin/catalog/*', async route => {
    const body = route.request().postDataJSON();
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1));
    writes.push({ id, ...body });
    const item = catalog.find(q => q.id === id);
    if (item) Object.assign(item, body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ question: item }) });
  });
  await page.goto('/question-ops?analytics=exclude');
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#dashboard')).toHaveAttribute('aria-busy', 'false');
  return { requests, writes, release };
}

test('大量キューは50問ずつ表示し、次へ・戻る・キーボード移動で未審査の編集を保持する', async ({ page }) => {
  const state = await stubCMS(page);
  await expect(page.locator('#pendingSubmissions tr[data-submission]')).toHaveCount(50);
  await expect(page.locator('#allQuestions tr[data-catalog]')).toHaveCount(50);
  expect(await page.locator('input,textarea').count()).toBeLessThan(1500);
  await expect(page.locator('#pendingPageStatus')).toHaveText('1〜50問／審査待ち全2842問');
  const first = page.locator('#pendingSubmissions tr[data-submission]').first();
  await expect(first.locator('[data-field="reviewNote"]')).toHaveValue('未審査・隔離確認 0001');
  await first.locator('[data-field="title"]').fill('未保存でも保持される架空の問題は？');
  await page.locator('#pendingNext').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pendingPageStatus')).toHaveText('51〜100問／審査待ち全2842問');
  await page.locator('#pendingPrevious').click();
  await expect(page.locator('#pendingPageStatus')).toHaveText('1〜50問／審査待ち全2842問');
  await expect(page.locator('#pendingSubmissions tr[data-submission]').first().locator('[data-field="title"]')).toHaveValue('未保存でも保持される架空の問題は？');
  expect(state.requests).toEqual([0, 50, 0]);
  expect(state.writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('#pendingNext').evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test('一覧を検索・ページ移動しても編集を失わず、ページ外の変更もまとめて保存できる', async ({ page }) => {
  const state = await stubCMS(page);
  await page.locator('#questionSearch').fill('PERFCAT');
  await expect(page.locator('#questionPageStatus')).toHaveText('1〜50問／対象120問');
  const first = page.locator('#allQuestions tr[data-catalog]').first();
  const firstId = await first.getAttribute('data-catalog');
  await first.locator('[data-field="title"]').fill('架空編集一つ目の選び方は？');
  await page.locator('#questionNext').click();
  await expect(page.locator('#questionPageStatus')).toHaveText('51〜100問／対象120問');
  const second = page.locator('#allQuestions tr[data-catalog]').first();
  const secondId = await second.getAttribute('data-catalog');
  await second.locator('[data-field="title"]').fill('架空編集二つ目の選び方は？');
  await expect(page.locator('#saveAllQuestions')).toContainText('2問');
  await page.locator('#saveAllQuestions').click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes).toEqual(expect.arrayContaining([expect.objectContaining({ id: firstId, title: '架空編集一つ目の選び方は？' }), expect.objectContaining({ id: secondId, title: '架空編集二つ目の選び方は？' })]));
  await expect(page.locator('#saveAllQuestions')).toBeDisabled();
  await page.locator('#questionSearch').fill(firstId);
  await expect(page.locator('#allQuestions tr[data-catalog]')).toHaveCount(1);
  await expect(page.locator('#allQuestions [data-field="title"]').first()).toHaveValue('架空編集一つ目の選び方は？');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportQuestionsCsv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test('ページ読込中の重複操作を防ぎ、ログアウト後に遅い結果で管理画面を再表示しない', async ({ page }) => {
  const state = await stubCMS(page, { holdNext: true });
  await page.locator('#pendingNext').click();
  await expect(page.locator('#pendingNext')).toBeDisabled();
  await expect(page.locator('#dashboard')).toHaveAttribute('aria-busy', 'true');
  expect(state.requests).toEqual([0, 50]);
  await expect(page.locator('#forgetTrustedDevice')).toBeVisible();
  await page.locator('#forgetTrustedDevice').click();
  await expect(page.locator('#dashboard')).toBeHidden();
  state.release();
  await expect(page.locator('#dashboard')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#dashboard')).toBeHidden();
  await expect(page.locator('#allQuestions')).toBeEmpty();
  await expect(page.locator('#pendingSubmissions')).toBeEmpty();
  expect(state.writes).toHaveLength(0);
});
