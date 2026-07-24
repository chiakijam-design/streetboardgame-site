import { expect, test } from '@playwright/test';

async function preparePage(page) {
  await page.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay = 0, ...args) => nativeTimeout(callback, Math.min(Number(delay) || 0, 12), ...args);
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function pickLoveColor(page, index) {
  const button = page.getByTestId(`color-${index}`);
  await expect(button).toBeVisible();
  await button.click();
}

async function completeLoveGame(page, mode) {
  await page.goto('/?screen=intro');
  await page.getByTestId(`love-mode-${mode}`).click();
  await page.getByTestId('love-start').click();
  for (let index = 0; index < 5; index += 1) await pickLoveColor(page, 0);
  await page.getByTestId('love-batch-next-button').click();
  for (let index = 0; index < 5; index += 1) await pickLoveColor(page, index < 3 ? 0 : 1);
  await page.getByRole('button', { name: /答え合わせへ/ }).click();
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByTestId('love-reveal-page')).toBeVisible();
    await page.getByTestId(index === 4 ? 'love-reveal-result' : 'love-reveal-next').click();
  }
  await expect(page.getByText('3/5', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('love-answer-details')).toBeVisible();
}

async function answerChallengeQuestions(page, expectedMode) {
  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByTestId(`${expectedMode}-question`)).toBeVisible();
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${index + 1}/10`);
    await page.locator('[data-action="answer"]').first().click();
  }
}

async function createChallenge(page, creatorName = 'ちあき') {
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill(creatorName);
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await answerChallengeQuestions(page, 'creator');
  await expect(page.getByRole('heading', { name: 'クイズができました' })).toBeVisible();
  const url = await page.getByRole('textbox', { name: '挑戦用URL' }).inputValue();
  expect(url).toMatch(/\/challenge\?room=[A-Z2-9]{8}$/);
  return url;
}

test.beforeEach(async ({ page, request }) => {
  await request.post('/__test/reset');
  await preparePage(page);
});

test('トップは彼氏・彼女の愛情判定と挑戦モードの2本だけを案内する', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '彼氏の愛情を判定する' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'みんなに挑戦してもらう', exact: true }).first()).toHaveAttribute('href', '/challenge');
  for (const removedLabel of [
    '友達の友情を判定する',
    '家族の絆を判定する',
    'ボドゲ仲間の絆を判定する',
    'Youtuberと視聴者の絆を判定する',
    '遠隔で、恋人や友達と二人の理解度チェック',
  ]) {
    await expect(page.getByText(removedLabel, { exact: true })).toHaveCount(0);
  }
});

test('彼氏と彼女を入れ替えた両モードが従来どおり5問で完走する', async ({ page }) => {
  await completeLoveGame(page, 'girlTarget');
  await completeLoveGame(page, 'boyTarget');
});

test('出題者10問→共有URL→挑戦者10問→順位と全問答え合わせまで完走する', async ({ browser, page }) => {
  const challengeUrl = await createChallenge(page);
  await expect(page.getByTestId('participant-count')).toContainText('0人回答済み');
  await expect(page.locator('#challenge-qr')).toBeVisible();

  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  try {
    await participant.goto(challengeUrl);
    await expect(participant.getByRole('heading', { name: 'ちあきさんからの挑戦' })).toBeVisible();
    await participant.getByLabel('あなたの名前（12文字まで）').fill('ゆう');
    await participant.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
    await answerChallengeQuestions(participant, 'participant');
    await expect(participant.getByRole('heading', { name: '10/10問 正解' })).toBeVisible();
    await expect(participant.locator('.challenge-result')).toHaveCount(10);
    await expect(participant.getByText('回答済み1人中 1位')).toBeVisible();
  } finally {
    await participantContext.close();
  }

  await page.getByRole('button', { name: '回答人数を更新' }).click();
  await expect(page.getByTestId('participant-count')).toContainText('1人回答済み');
});

test('正解は回答前の公開レスポンスへ出さず、51人目をサーバー側で拒否する', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '人数上限のAPI検証は画面幅に依存しないためPCで1回実行');
  await page.goto('/challenge');
  const mergedPool = await page.evaluate(() => {
    const merged = [...window.FRIEND_CARDS, ...window.FAMILY_CARDS];
    const seen = new Set();
    const unique = merged.filter((card) => {
      const key = card.title.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { count: unique.length, cards: unique.slice(0, 10) };
  });
  expect(mergedPool.count).toBe(94);
  const cards = mergedPool.cards;
  const createdResponse = await request.post('/api/challenge/rooms', {
    data: { creatorName: '出題者', cards, answers: Array(10).fill(0) },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();

  const publicResponse = await request.get(`/api/challenge/rooms/${created.code}`);
  expect(publicResponse.status()).toBe(200);
  const publicText = await publicResponse.text();
  expect(publicText).not.toContain('answerKey');
  expect(publicText).not.toContain('manageToken');

  for (let index = 0; index < 50; index += 1) {
    const joined = await request.post(`/api/challenge/rooms/${created.code}/join`, {
      data: { name: `参加${index + 1}` },
    });
    expect(joined.status(), `参加者${index + 1}`).toBe(201);
  }
  const rejected = await request.post(`/api/challenge/rooms/${created.code}/join`, {
    data: { name: '参加51' },
  });
  expect(rejected.status()).toBe(409);
  expect(await rejected.json()).toMatchObject({ error: 'room-full', maxParticipants: 50 });
});

test('PC・スマホとも横スクロールせず10問モードを操作できる', async ({ page }) => {
  await page.goto('/challenge');
  const dimensions = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  await page.getByLabel('出題者の名前（12文字まで）').fill('レイアウト確認');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.locator('[data-action="answer"]')).toHaveCount(5);
  await expect(page.locator('.challenge-progress span')).toHaveCount(10);
});

test('廃止した公開URLは挑戦モードへ恒久転送し、旧screen指定も開かない', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'リダイレクトは画面幅に依存しないためPCで1回実行');
  for (const path of ['/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/live', '/live-guide']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(new URL(response.headers().location).pathname, path).toBe('/challenge');
  }
  await page.goto('/?screen=friendIntro');
  await expect(page.getByRole('button', { name: '彼氏の愛情を判定する' })).toBeVisible();
  await expect(page.getByText('友達の友情判定ゲーム', { exact: true })).toHaveCount(0);
});
