import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reactPath = path.join(root, 'node_modules/react/umd/react.production.min.js');
const reactDomPath = path.join(root, 'node_modules/react-dom/umd/react-dom.production.min.js');

async function preparePage(page) {
  await page.route('https://unpkg.com/react@18.3.1/umd/react.production.min.js', (route) => route.fulfill({ path: reactPath }));
  await page.route('https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js', (route) => route.fulfill({ path: reactDomPath }));
  await page.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay = 0, ...args) => nativeTimeout(callback, Math.min(Number(delay) || 0, 12), ...args);
    localStorage.clear();
  });
}

async function pickColor(page, index) {
  const button = page.getByTestId(`color-${index}`);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
}

async function openResult(page) {
  const button = page.getByRole('button', { name: '答え合わせへ' });
  await expect(button).toBeVisible();
  await button.click();
}

async function playLove(page, mode, score) {
  await page.goto('/?screen=intro');
  await page.getByTestId(`love-mode-${mode}`).click();
  await page.getByTestId('love-start').click();
  for (let question = 0; question < 5; question += 1) {
    await pickColor(page, 0);
    await pickColor(page, question < score ? 0 : 1);
  }
  await openResult(page);
  await expect(page.getByText(`${score}/5`, { exact: true }).first()).toBeVisible();
}

async function playGroup(page, kind, playerCount, score) {
  await page.goto(`/?screen=${kind}Intro`);
  await page.getByTestId(`${kind}-count-${playerCount}`).click();
  await page.getByRole('button', { name: /この順番で始める/ }).click();
  for (let question = 0; question < 5; question += 1) {
    await pickColor(page, 0);
    for (let guesser = 1; guesser < playerCount; guesser += 1) {
      await pickColor(page, question < score ? 0 : 1);
    }
  }
  await openResult(page);
  const scores = page.getByText(`${score}/5`, { exact: true });
  await expect(scores).toHaveCount((playerCount - 1) * 2);
  await expect(scores.first()).toBeVisible();
}

async function playGroupMixed(page, kind, scores) {
  const playerCount = scores.length + 1;
  await page.goto(`/?screen=${kind}Intro`);
  await page.getByTestId(`${kind}-count-${playerCount}`).click();
  await page.getByRole('button', { name: /この順番で始める/ }).click();
  for (let question = 0; question < 5; question += 1) {
    await pickColor(page, 0);
    for (const score of scores) await pickColor(page, question < score ? 0 : 1);
  }
  await openResult(page);
  for (const score of scores) {
    await expect(page.getByText(`${score}/5`, { exact: true }).first()).toBeVisible();
  }
}

test.beforeEach(async ({ page }) => preparePage(page));

test('全カードデータ: 件数・選択肢・画像', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'データ検証はブラウザ幅に依存しないためPCで1回実行');
  await page.goto('/?screen=top');
  const data = await page.evaluate(() => ({
    love: window.ALL_CARDS,
    friend: window.FRIEND_CARDS,
    family: window.FAMILY_CARDS,
  }));
  expect(data.love).toHaveLength(42);
  expect(data.friend).toHaveLength(54);
  expect(data.family).toHaveLength(54);
  for (const [kind, cards] of Object.entries(data)) {
    expect(new Set(cards.map((card) => card.id)).size, `${kind}のIDは重複しない`).toBe(cards.length);
    for (const card of cards) {
      expect(card.title, `${kind}:${card.id}のタイトル`).toBeTruthy();
      expect(card.choices, `${kind}:${card.id}の選択肢`).toHaveLength(5);
    }
  }
  for (const card of data.love) {
    const response = await request.get(`/${card.image}`);
    expect(response.ok(), `${card.image}が取得できる`).toBeTruthy();
  }
});

for (const mode of ['girlTarget', 'boyTarget']) {
  test(`彼氏・彼女版 ${mode}: 0〜5点`, async ({ page }) => {
    for (let score = 0; score <= 5; score += 1) await playLove(page, mode, score);
  });
}

for (const kind of ['friend', 'family']) {
  for (const playerCount of [2, 3, 4]) {
    test(`${kind}版 ${playerCount}人: 全員0〜5点`, async ({ page }) => {
      for (let score = 0; score <= 5; score += 1) await playGroup(page, kind, playerCount, score);
    });
  }
  test(`${kind}版 4人: 個別得点5・3・0`, async ({ page }) => {
    await playGroupMixed(page, kind, [5, 3, 0]);
  });
}
