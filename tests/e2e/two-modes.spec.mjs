import { expect, test } from '@playwright/test';

async function preparePage(page) {
  await page.addInitScript(() => {
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay = 0, ...args) => nativeTimeout(callback, Math.min(Number(delay) || 0, 12), ...args);
    if (window.name !== 'watachan-e2e-ready') {
      localStorage.clear();
      sessionStorage.clear();
      window.name = 'watachan-e2e-ready';
    }
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

async function buildChallengeQuestions(page, startIndex = 0) {
  for (let index = startIndex; index < 10; index += 1) {
    await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${index + 1}/10`);
    if (index === 0) {
      const paperCard = page.locator('.challenge-builder-card');
      await expect(paperCard).toBeVisible();
      await expect(paperCard.locator('[data-action="builder-answer"]')).toHaveCount(5);
      await expect(page.getByRole('button', { name: /この問題をスキップ/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /問題・選択肢を編集する/ })).toBeVisible();
    }
    await page.locator('[data-action="builder-answer"]').first().click();
  }
}

async function createChallenge(page, creatorName = 'ちあき') {
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill(creatorName);
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
  await expect(page.getByLabel('このクイズを友達や他の人も使えるようにする')).toBeChecked();
  await buildChallengeQuestions(page);
  await expect(page.getByRole('heading', { name: '主催者用回答管理' })).toBeVisible();
  const url = await page.getByRole('textbox', { name: '挑戦用URL' }).inputValue();
  expect(url).toMatch(/\/challenge\?room=[A-Z2-9]{8}$/);
  return url;
}

test.beforeEach(async ({ page, request }) => {
  await request.post('/__test/reset');
  await preparePage(page);
});

test('トップは作成者向けに通常版とライブ配信版の2本だけを案内する', async ({ page }) => {
  await page.goto('/');
  const challengeButton = page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true }).first();
  const liveButton = page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true }).first();
  await expect(page.getByText('みんなの理解度診断', { exact: true })).toBeVisible();
  await expect(page.getByText('クイズを作る人向け', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('あなたの名前（12文字まで）')).toBeVisible();
  await expect(page.getByText('このトップページは出題者・配信者向けです。')).toBeVisible();
  const [challengeStyle, liveStyle] = await Promise.all([
    challengeButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        border: style.border,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        minHeight: style.minHeight,
      };
    }),
    liveButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        border: style.border,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        minHeight: style.minHeight,
      };
    }),
  ]);
  expect(liveStyle).toEqual(challengeStyle);
  await expect(page.getByRole('button', { name: '彼氏の愛情を判定する' })).toHaveCount(0);
  await expect(page.locator('a[href="/love"]')).toHaveCount(0);
  await expect(page.getByText('メイン', { exact: true })).toHaveCount(0);
  await expect(page.getByText('NEW', { exact: true })).toHaveCount(0);
  for (const removedLabel of [
    '彼氏の愛情判定',
    '友達の友情を判定する',
    '家族の絆を判定する',
    'ボドゲ仲間の絆を判定する',
    'Youtuberと視聴者の絆を判定する',
    '遠隔で、恋人や友達と二人の理解度チェック',
  ]) {
    await expect(page.getByText(removedLabel, { exact: true })).toHaveCount(0);
  }
  await challengeButton.click();
  await expect(page.getByRole('alert')).toHaveText('名前を入力してください。');
  await expect(page).toHaveURL('/');
});

test('トップで名前を入力すると通常版の10問作成画面へ直接進む', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('あなたの名前（12文字まで）').fill('トップ通常');
  await page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true }).click();
  await expect(page).toHaveURL('/challenge');
  await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
  const beforeSkip = await page.locator('.challenge-builder-card h2').textContent();
  await page.getByRole('button', { name: /この問題をスキップ/ }).click();
  await expect(page.locator('.challenge-builder-card h2')).not.toHaveText(beforeSkip || '');
  await page.getByRole('button', { name: '名前入力に戻る' }).click();
  await expect(page.getByLabel('出題者の名前（12文字まで）')).toHaveValue('トップ通常');
});

test('トップで名前を入力するとライブ版の10問作成画面へ直接進む', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('あなたの名前（12文字まで）').fill('トップ配信');
  await page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true }).click();
  await expect(page).toHaveURL('/live-challenge');
  await expect(page.getByRole('heading', { name: '1問ずつクイズを作る' })).toBeVisible();
  await expect(page.getByLabel('配信者名（24文字まで）')).toHaveValue('トップ配信');
});

test('トップ下部から挑戦モードの説明を読み、10問クイズ作成へ進める', async ({ page }) => {
  await page.goto('/');
  const guideLink = page.locator('nav[aria-label="ゲームシリーズの紹介ページ"] a[href="/challenge-guide"]');
  await expect(guideLink).toHaveCount(1);
  await guideLink.click();
  await expect(page).toHaveURL('/challenge-guide');
  await expect(page.getByRole('heading', { level: 1, name: 'みんなに挑戦してもらう' })).toBeVisible();
  await expect(page.getByText('あなたの答えを、最大50人が予想します', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '10問クイズを作る' })).toHaveAttribute('href', '/challenge');
});

test('旧愛情判定の42問を共通のお題として挑戦クイズに使える', async ({ page }) => {
  await page.goto('/challenge');
  const loveCard = await page.evaluate(() => ({
    id: `LOVE${window.ALL_CARDS[0].id}`,
    title: window.ALL_CARDS[0].title,
    firstChoice: window.ALL_CARDS[0].choices[0],
  }));
  await page.goto(`/challenge?question=${encodeURIComponent(loveCard.id)}`);
  await expect(page.getByText(loveCard.title, { exact: true })).toBeVisible();
  await page.getByLabel('出題者の名前（12文字まで）').fill('愛情お題テスト');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  const builderCard = page.locator('.challenge-builder-card');
  await expect(builderCard.getByRole('heading', { level: 2 })).toHaveText(loveCard.title);
  await expect(builderCard).toContainText(loveCard.firstChoice);
});

test('自作お題は初期同意で、チェック状態を自分で変更して運営へ送信できる', async ({ page }) => {
  const submissions = [];
  await page.route('**/api/questions/submissions', async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ submitted: 1, submissionIds: ['11111111-1111-4111-8111-111111111111'] }),
    });
  });
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill('自作テスト');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('[data-question="0"]').fill('休み時間に一番したいことは？');
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-option="0:${index}"]`).fill(`自作選択肢${index + 1}`);
  }
  const consent = page.getByLabel('このクイズを友達や他の人も使えるようにする');
  await expect(consent).toBeChecked();
  await consent.uncheck();
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.getByRole('button', { name: /この内容で問題に戻る/ }).click();
  await buildChallengeQuestions(page);
  await expect(page.getByTestId('question-submission-status')).toContainText('掲載候補として1問を運営へ送信しました');
  expect(submissions).toHaveLength(1);
  expect(submissions[0].consent).toBe(true);
  expect(submissions[0].sourceMode).toBe('challenge');
  expect(submissions[0].questions).toEqual([{
    sourceQuestionId: null,
    title: '休み時間に一番したいことは？',
    choices: ['自作選択肢1', '自作選択肢2', '自作選択肢3', '自作選択肢4', '自作選択肢5'],
  }]);
});

test('公開候補チェックを外した自作お題は運営へ送信しない', async ({ page }) => {
  let submissionRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/questions/submissions') {
      submissionRequests += 1;
    }
  });
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill('非公開テスト');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await page.getByRole('button', { name: /自分で問題を作る/ }).click();
  await page.locator('[data-question="0"]').fill('自分たちだけで使いたい問題は？');
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-option="0:${index}"]`).fill(`非公開選択肢${index + 1}`);
  }
  await page.getByLabel('このクイズを友達や他の人も使えるようにする').uncheck();
  await page.getByRole('button', { name: /この内容で問題に戻る/ }).click();
  await buildChallengeQuestions(page);
  await expect(page.getByRole('heading', { name: '主催者用回答管理' })).toBeVisible();
  expect(submissionRequests).toBe(0);
  await expect(page.getByTestId('question-submission-status')).toHaveCount(0);
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
    await participant.getByLabel('ランキング表示名（12文字まで）').fill('ゆう');
    await participant.getByRole('checkbox').check();
    await participant.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
    await participant.locator('[data-action="answer"]').first().click();
    await participant.reload();
    await expect(participant.getByTestId('participant-question')).toBeVisible();
    await expect(participant.locator('.challenge-q-number')).toHaveText('Q2/10');
    for (let index = 1; index < 10; index += 1) {
      await participant.locator('[data-action="answer"]').first().click();
    }
    await expect(participant.getByRole('heading', { name: '10/10問 正解' })).toBeVisible();
    await expect(participant.locator('.challenge-result')).toHaveCount(10);
    await expect(participant.getByText('回答済み1人中 1位')).toBeVisible();
    await expect(participant.getByRole('link', { name: '自分も作る' })).toHaveAttribute('href', '/challenge');
    await participant.getByRole('link', { name: 'フレンドランキングを見る' }).click();
    await expect(participant.getByTestId('friend-ranking')).toContainText('ゆう');
    await expect(participant.getByTestId('friend-ranking')).toContainText('10/10');
  } finally {
    await participantContext.close();
  }

  await page.getByRole('button', { name: '回答状況を更新' }).click();
  await expect(page.getByTestId('participant-count')).toContainText('1人回答済み');
  await expect(page.getByTestId('host-answer-management')).toContainText('ゆう');
  await expect(page.getByTestId('host-answer-management')).toContainText('10/10問');
});

test('途中保存から再開し、人気のお題を指定してクイズ作成へ戻れる', async ({ page }) => {
  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill('途中保存');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await page.locator('[data-action="builder-answer"]').first().click();
  await page.reload();
  await expect(page.getByTestId('creator-resume')).toContainText('Q2/10から再開');
  await page.getByRole('button', { name: '途中から再開' }).click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q2/10');

  await page.goto('/challenge/library');
  await expect(page.getByRole('heading', { name: '人気のお題ライブラリ' })).toBeVisible();
  await expect(page.getByTestId('question-library').locator('.challenge-library-card')).toHaveCount(30);
  await page.getByRole('link', { name: 'このお題を入れて作る' }).first().click();
  await expect(page.getByText('選んだお題を必ず入れます')).toBeVisible();
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
      data: { name: `参加${index + 1}`, rankingConsent: true },
    });
    expect(joined.status(), `参加者${index + 1}`).toBe(201);
  }
  const rejected = await request.post(`/api/challenge/rooms/${created.code}/join`, {
    data: { name: '参加51', rankingConsent: true },
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
  await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
  await expect(page.locator('[data-action="builder-answer"]')).toHaveCount(5);
  await expect(page.locator('.challenge-progress span')).toHaveCount(10);
});

test('廃止した公開URLは挑戦モードへ恒久転送し、旧screen指定も開かない', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'リダイレクトは画面幅に依存しないためPCで1回実行');
  for (const path of ['/love', '/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/live', '/live-guide']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(new URL(response.headers().location).pathname, path).toBe('/challenge');
  }
  await page.goto('/?screen=friendIntro');
  await expect(page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '彼氏の愛情を判定する' })).toHaveCount(0);
  await expect(page.getByText('友達の友情判定ゲーム', { exact: true })).toHaveCount(0);
});
