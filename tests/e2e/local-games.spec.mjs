import { expect, test } from '@playwright/test';
import { stat } from 'node:fs/promises';

async function preparePage(page) {
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
  const button = page.getByRole('button', { name: /答え合わせへ/ });
  await expect(button).toBeVisible();
  await button.click();
}

async function expectAmazonProductCard(page) {
  const card = page.getByTestId('amazon-product-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('href', 'https://www.amazon.co.jp/dp/B0G87M4ZYK');
  await expect(card).toHaveAttribute('target', '_blank');
  await expect(card).toHaveAttribute('rel', /sponsored/);
  await expect(card).toContainText('Web版で盛り上がったら、製品版でもう一度');
  await expect(card).toContainText('Amazonアフィリエイトを利用しています');
}

async function expectAnswerPickLayout(page, expectedCount) {
  const answerLayout = await page.locator('.result-answer-pick').evaluateAll((picks) => picks.map((pick) => {
    const name = pick.querySelector('.result-answer-name').getBoundingClientRect();
    const choice = pick.querySelector('.result-answer-choice').getBoundingClientRect();
    const dot = pick.querySelector('.result-answer-dot').getBoundingClientRect();
    return {
      nameBeforeChoice: name.bottom <= choice.top + 1,
      dotCenterOffset: Math.abs((dot.top + dot.height / 2) - (choice.top + choice.height / 2)),
    };
  }));
  expect(answerLayout).toHaveLength(expectedCount);
  expect(answerLayout.every(({ nameBeforeChoice, dotCenterOffset }) => nameBeforeChoice && dotCenterOffset <= 1)).toBe(true);
}

async function expectRevealLayout(page, kind) {
  const [question, target, guesses] = await Promise.all([
    page.getByTestId(`${kind}-reveal-question`).boundingBox(),
    page.getByTestId('group-reveal-target').boundingBox(),
    page.getByTestId('group-reveal-guesses').boundingBox(),
  ]);
  expect(question).not.toBeNull();
  expect(target).not.toBeNull();
  expect(guesses).not.toBeNull();
  expect(question.y + question.height).toBeLessThanOrEqual(target.y);
  expect(target.y + target.height).toBeLessThanOrEqual(guesses.y);
}

async function playLove(page, mode, score) {
  await page.goto('/?screen=intro');
  await page.getByTestId(`love-mode-${mode}`).click();
  await page.getByTestId('love-start').click();
  for (let question = 0; question < 5; question += 1) {
    await pickColor(page, 0);
  }
  const nextButton = page.getByTestId('love-batch-next-button');
  await expect(nextButton).toBeVisible();
  await nextButton.click();
  for (let question = 0; question < 5; question += 1) {
    await pickColor(page, question < score ? 0 : 1);
  }
  await openResult(page);
  for (let question = 0; question < 5; question += 1) {
    await expect(page.getByTestId('love-reveal-page')).toBeVisible();
    const verdict = page.getByTestId('love-reveal-verdict');
    await expect(verdict).toBeVisible();
    const isCorrect = (await verdict.textContent()).includes('正解');
    const confetti = page.getByTestId('love-reveal-confetti');
    if (isCorrect) await expect(confetti).toBeVisible();
    else await expect(confetti).toHaveCount(0);
    await expect(page.getByText('ここでトーク', { exact: true })).toHaveCount(0);
    await expectAnswerPickLayout(page, 2);
    await expectRevealLayout(page, 'love');
    const nextButton = page.getByTestId(question === 4 ? 'love-reveal-result' : 'love-reveal-next');
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  }
  await expect(page.getByText(`${score}/5`, { exact: true }).first()).toBeVisible();
  await expectAnswerPickLayout(page, 10);
}

async function answerGroupInBatches(page, kind, scores) {
  for (let question = 0; question < 5; question += 1) await pickColor(page, 0);
  for (const score of scores) {
    const nextButton = page.getByTestId(`${kind}-batch-next-button`);
    await expect(nextButton).toBeVisible();
    await nextButton.click();
    for (let question = 0; question < 5; question += 1) {
      await pickColor(page, question < score ? 0 : 1);
    }
  }
}

async function revealGroupAnswers(page, kind, playerCount) {
  const startButton = page.getByTestId(`${kind}-reveal-start`);
  await expect(startButton).toBeVisible();
  await startButton.click();
  for (let question = 0; question < 5; question += 1) {
    await expect(page.getByTestId(`${kind}-reveal-page`)).toBeVisible();
    const verdict = page.getByTestId(`${kind}-reveal-verdict`);
    await expect(verdict).toBeVisible();
    const allCorrect = (await verdict.textContent()).includes('全員正解');
    const confetti = page.getByTestId(`${kind}-reveal-confetti`);
    if (allCorrect) await expect(confetti).toBeVisible();
    else await expect(confetti).toHaveCount(0);
    await expect(page.getByText('ここでトーク', { exact: true })).toHaveCount(0);
    await expectAnswerPickLayout(page, playerCount);
    await expectRevealLayout(page, kind);
    const nextButton = page.getByTestId(question === 4 ? `${kind}-reveal-result` : `${kind}-reveal-next`);
    await expect(nextButton).toBeVisible();
    await nextButton.click();
  }
}

async function playGroup(page, kind, playerCount, score) {
  await page.goto(`/?screen=${kind}Intro`);
  await page.getByTestId(`${kind}-count-${playerCount}`).click();
  await page.getByRole('button', { name: /この順番で始める/ }).click();
  await answerGroupInBatches(page, kind, Array(playerCount - 1).fill(score));
  await revealGroupAnswers(page, kind, playerCount);
  const scores = page.getByText(`${score}/5`, { exact: true });
  await expect(scores).toHaveCount((playerCount - 1) * 2);
  await expect(scores.first()).toBeVisible();
}

async function playGroupMixed(page, kind, scores) {
  const playerCount = scores.length + 1;
  await page.goto(`/?screen=${kind}Intro`);
  await page.getByTestId(`${kind}-count-${playerCount}`).click();
  await page.getByRole('button', { name: /この順番で始める/ }).click();
  await answerGroupInBatches(page, kind, scores);
  await revealGroupAnswers(page, kind, playerCount);
  for (const score of scores) {
    await expect(page.getByText(`${score}/5`, { exact: true }).first()).toBeVisible();
  }
}

test.beforeEach(async ({ page }) => preparePage(page));

test('トップのボドゲ仲間ボタン直下から遠隔版へ移動できる', async ({ page }) => {
  await page.goto('/?screen=top');
  const localButton = page.getByRole('button', { name: 'ボドゲ仲間の絆を判定する', exact: true });
  const remoteLink = page.getByRole('link', { name: '遠隔で、ボドゲ仲間と二人の理解度チェック', exact: true });
  await expect(localButton).toBeVisible();
  await expect(remoteLink).toHaveAttribute('href', '/remote-boardgame');
  expect(await localButton.evaluate((button, link) => Boolean(button.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING), await remoteLink.elementHandle())).toBe(true);
  await remoteLink.click();
  await expect(page).toHaveURL('/remote-boardgame');
  await expect(page.locator('h1')).toContainText('ボドゲ仲間の絆判定');
});

test('通常4シリーズは外部通信を遮断しても完走できる', async ({ page }) => {
  const remoteApiRequests = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/remote')) remoteApiRequests.push(url);
    if (!url.startsWith('http://127.0.0.1:4173')) {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await playLove(page, 'girlTarget', 3);
  await expectAmazonProductCard(page);
  await playGroup(page, 'friend', 2, 3);
  await expectAmazonProductCard(page);
  await playGroup(page, 'family', 2, 3);
  await expectAmazonProductCard(page);
  await playGroup(page, 'boardgame', 2, 3);
  await expectAmazonProductCard(page);

  expect(remoteApiRequests).toHaveLength(0);
});

test('通常5シリーズの結果画像は本番CSP下でもPC・スマホで保存できる', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chrome';
  if (isMobile) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files, title }) => {
          window.__sharedResultImage = {
            title,
            files: files?.map(({ name, size, type }) => ({ name, size, type })),
          };
        },
      });
    });
  }
  const cases = [
    {
      play: () => playLove(page, 'girlTarget', 3),
      filename: 'watachan-love-result-3-5.png',
    },
    {
      play: () => playLove(page, 'boyTarget', 3),
      filename: 'watachan-love-result-3-5.png',
    },
    {
      play: () => playGroup(page, 'friend', 2, 3),
      filename: 'watachan-friend-result-5.png',
    },
    {
      play: () => playGroup(page, 'family', 2, 3),
      filename: 'watachan-family-result-5.png',
    },
    {
      play: () => playGroup(page, 'boardgame', 2, 3),
      filename: 'watachan-boardgame-result-5.png',
    },
  ];

  for (const resultCase of cases) {
    await resultCase.play();
    const saveButton = page.getByRole('button', { name: '判定画像も送りたい。まずは画像を保存' }).first();
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
    if (isMobile) {
      await saveButton.click();
      await expect.poll(() => page.evaluate(() => window.__sharedResultImage)).toMatchObject({
        files: [{
          name: resultCase.filename,
          type: 'image/png',
        }],
      });
      expect(await page.evaluate(() => window.__sharedResultImage.files[0].size)).toBeGreaterThan(1_000);
      continue;
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      saveButton.click(),
    ]);
    expect(download.suggestedFilename()).toBe(resultCase.filename);
    expect((await stat(await download.path())).size).toBeGreaterThan(1_000);
  }
});

test('全JSをハッシュ付きで自前配信しsource mapを公開しない', async ({ page, request }) => {
  await page.goto('/?screen=top');
  const scriptSources = await page.locator('script[src]').evaluateAll((scripts) => scripts.map((script) => script.src));
  expect(scriptSources.some((source) => source.includes('unpkg.com'))).toBe(false);
  await expect.poll(() => page.evaluate(() => window.React && window.React.version)).toBe('18.3.1');
  await expect.poll(() => page.evaluate(() => window.ReactDOM && window.ReactDOM.version)).toMatch(/^18\.3\.1(?:-|$)/);

  const indexBuildSources = await page.locator('script[data-build-entry]').evaluateAll((scripts) => scripts.map((script) => script.src));
  expect(indexBuildSources).toHaveLength(9);
  await page.goto('/remote');
  const remoteBuildSources = await page.locator('script[data-build-entry]').evaluateAll((scripts) => scripts.map((script) => script.src));
  expect(remoteBuildSources).toHaveLength(4);

  for (const source of [...new Set([...indexBuildSources, ...remoteBuildSources])]) {
    const url = new URL(source);
    expect(url.origin).toBe('http://127.0.0.1:4173');
    expect(url.pathname).toMatch(/^\/(?:dist\/[a-z0-9_]+-[a-z0-9]{8}\.js|assets\/vendor\/react(?:-dom)?\.production\.min-[a-f0-9]{12}\.js)$/i);
    const response = await request.get(url.pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(await response.text()).not.toContain('sourceMappingURL=');
    expect((await request.get(`${url.pathname}.map`)).status()).toBe(404);
  }
});

test('About・製品版の内部移動を実URLのリンクで行う', async ({ page }) => {
  await page.goto('/?screen=top');
  const aboutLink = page.getByRole('link', { name: 'About', exact: true });
  const productLink = page.getByRole('link', { name: '製品版', exact: true });
  await expect(aboutLink).toHaveAttribute('href', '/about');
  await expect(productLink).toHaveAttribute('href', '/product');

  await aboutLink.click();
  await expect(page).toHaveURL('/about');
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '彼氏の愛情判定を開く' })).toHaveAttribute('href', '/love');
  await expect(page.getByRole('link', { name: '友達の友情判定を開く' })).toHaveAttribute('href', '/friends');
  await expect(page.getByRole('link', { name: '家族の絆判定を開く' })).toHaveAttribute('href', '/family');
  await expect(page.getByRole('link', { name: 'ボドゲ仲間の絆判定を開く' })).toHaveAttribute('href', '/boardgame');
  await expect(page.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'トップページに戻る' })).toHaveAttribute('href', '/');

  await page.goBack();
  await expect(page).toHaveURL('/?screen=top');
  await page.getByRole('link', { name: '製品版', exact: true }).click();
  await expect(page).toHaveURL('/product');
  await expect(page.getByRole('heading', { name: '製品版もあります' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'トップに戻る' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'トップページに戻る' })).toHaveAttribute('href', '/');
});

test('存在しないURL: 404ページとnoindexを返す', async ({ page }) => {
  const response = await page.goto('/does-not-exist-for-test');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'トップページに戻る' })).toHaveAttribute('href', '/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
});

test('全カードデータ: 件数・選択肢・画像', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'データ検証はブラウザ幅に依存しないためPCで1回実行');
  await page.goto('/?screen=top');
  const data = await page.evaluate(() => ({
    love: window.ALL_CARDS,
    friend: window.FRIEND_CARDS,
    family: window.FAMILY_CARDS,
    boardgame: window.BOARDGAME_CARDS,
  }));
  expect(data.love).toHaveLength(42);
  expect(data.friend).toHaveLength(54);
  expect(data.family).toHaveLength(54);
  expect(data.boardgame).toHaveLength(54);
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

for (const kind of ['friend', 'family', 'boardgame']) {
  for (const playerCount of [2, 3, 4]) {
    test(`${kind}版 ${playerCount}人: 全員0〜5点`, async ({ page }) => {
      for (let score = 0; score <= 5; score += 1) await playGroup(page, kind, playerCount, score);
    });
  }
  test(`${kind}版 4人: 個別得点5・3・0`, async ({ page }) => {
    await playGroupMixed(page, kind, [5, 3, 0]);
  });
}
