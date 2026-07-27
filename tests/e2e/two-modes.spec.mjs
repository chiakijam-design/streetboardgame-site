import { expect, test } from './test.mjs';

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

async function buildChallengeQuestions(page, startIndex = 0) {
  for (let index = startIndex; index < 10; index += 1) {
    await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
    await expect(page.locator('.challenge-q-number')).toHaveText(`Q${index + 1}/10`);
    if (index === 0) {
      const paperCard = page.locator('.challenge-builder-card');
      const answerPad = page.getByTestId('challenge-builder-answer-pad');
      await expect(paperCard).toBeVisible();
      await expect(paperCard.locator('.notebook-question-card-visual')).toHaveCount(1);
      await expect(paperCard.locator('.notebook-card-accessible-choices li')).toHaveCount(5);
      await expect(answerPad.locator('[data-action="builder-answer"]')).toHaveCount(5);
      await expect(page.getByRole('button', { name: /この問題をスキップ/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /問題・選択肢を編集する/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /10問をランダムで選び直す/ })).toHaveCount(0);
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
  await expect(page.getByTestId('challenge-share-screen')).toContainText(`${creatorName}の「わたし理解度診断」ができました！`);
  await expect(page.getByRole('button', { name: 'リンクをコピーする' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Instagramでシェア' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xでシェア' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'LINEで送る' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SMS・その他で送る' })).toBeVisible();
  const url = await page.getByRole('textbox', { name: '挑戦用URL' }).inputValue();
  expect(url).toMatch(/\/challenge\?room=[A-Z2-9]{8}&share=challenge-20260726-1$/);
  return url;
}

test.beforeEach(async ({ page, request }) => {
  await request.post('/__test/reset');
  await preparePage(page);
});

test('SMS・その他は再挑戦と任意公開を明記した招待文を共有する', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        sessionStorage.setItem('captured-participation-share', JSON.stringify(payload));
      },
    });
  });
  const url = await createChallenge(page, 'ちあき');
  await page.getByRole('button', { name: 'SMS・その他で送る' }).click();
  const shared = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem('captured-participation-share') || 'null',
  ));
  expect(shared).toEqual({
    title: 'ちあきの「わたし理解度診断」',
    text: `ちあきの「わたし理解度診断」📒\n私のこと、ちゃんと分かってるよね？\n当てるより、話すための10問。\n結果を公開するかは自分で選べて、再挑戦もOK。\n10問やってみて👇\n${url}`,
  });
});

test('トップは作成者向けに通常版とライブ配信版の2本だけを案内する', async ({ page }, testInfo) => {
  await page.goto('/');
  const topCards = page.getByTestId('top-question-card');
  await expect(topCards).toHaveCount(3);
  await expect(topCards.locator('svg.notebook-question-card-visual')).toHaveCount(3);
  await expect(topCards.locator('.notebook-question-card-choice')).toHaveCount(15);
  await expect(topCards.locator('svg').first()).toHaveAttribute('viewBox', '0 0 756 1122');
  const topCardFont = await topCards.locator('.notebook-question-card-copy').first().evaluate((element) => (
    getComputedStyle(element).fontFamily
  ));
  expect(topCardFont).toContain('HuiFontP29');
  const challengeButton = page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true }).first();
  const liveButton = page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true }).first();
  await expect(page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true })).toHaveCount(1);
  await expect(page.getByText('わたし理解度診断', { exact: true })).toBeVisible();
  await expect(page.getByText('当てるより、話すための10問。', { exact: true })).toHaveCount(0);
  await expect(page.getByText('通常でも配信でも使える理解度診断メーカー', { exact: true })).toHaveCount(0);
  await expect(page.getByText('相手を理解できるまで、何度でも挑戦できる', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('top-result-card-previews')).toHaveCount(0);
  await expect(page.getByText('作る前に、結果カードを見てみよう', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('top-mode-pillars')).toContainText('友達向け');
  await expect(page.getByTestId('top-mode-pillars')).toContainText('URLを送って、好きな時間に回答');
  await expect(page.getByTestId('top-mode-pillars')).toContainText('LIVE向け');
  await expect(page.getByTestId('top-mode-pillars')).toContainText('配信者と視聴者が同時回答し、1問ずつ答え合わせ');
  await expect(page.getByTestId('top-mode-pillars')).toContainText('①10問を作る②自分の正解を登録③参加URLを送る');
  await expect(page.getByTestId('top-mode-pillars')).toContainText('①10問を作る②配信で参加方法を案内③視聴者と同時回答');
  const titleLines = page.getByTestId('top-rules-title-line');
  await expect(titleLines).toHaveCount(2);
  await expect(titleLines.nth(0)).toHaveText('あなたの「わたし理解度診断」を');
  await expect(titleLines.nth(1)).toHaveText('作って、みんなに挑戦してもらおう');
  for (const line of await titleLines.all()) {
    const metrics = await line.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  }
  const liveJoinStepParts = page.getByTestId('top-live-join-step').locator('span');
  await expect(liveJoinStepParts).toHaveCount(2);
  await expect(liveJoinStepParts.nth(0)).toHaveText('②配信で');
  await expect(liveJoinStepParts.nth(1)).toHaveText('参加方法を案内');
  if (testInfo.project.name === 'mobile-chrome') {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const line of await titleLines.all()) {
      const metrics = await line.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    }
  }
  await expect(page.getByText('クイズを作る人向け', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('あなたの名前（12文字まで）')).toBeVisible();
  await expect(page.getByText('この説明は出題者向けです。')).toHaveCount(0);
  await expect(page.getByText('回答する人は、届いた参加URLから直接遊びます。')).toHaveCount(0);
  await expect(page.getByText('このトップページは出題者・配信者向けです。')).toHaveCount(0);
  const [challengeStyle, liveStyle] = await Promise.all([
    challengeButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        border: style.border,
        borderRadius: style.borderRadius,
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
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        minHeight: style.minHeight,
      };
    }),
  ]);
  expect(liveStyle).toEqual(challengeStyle);
  expect(challengeStyle.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(challengeStyle.color).toBe('rgb(26, 26, 26)');
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

test('通常版とLIVE版は表示・スキップを問題選出統計へ記録する', async ({ page }) => {
  const events = [];
  await page.route('**/api/questions/catalog', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ questions: [], selectionStats: [] }),
  }));
  await page.route('**/api/questions/selection-events', async (route) => {
    events.push(await route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ recorded: true }),
    });
  });

  await page.goto('/challenge');
  await page.getByLabel('出題者の名前（12文字まで）').fill('統計確認');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect.poll(() => events.filter((event) => event.mode === 'challenge'
    && event.event === 'shown').length).toBe(1);
  const challengeQuestionId = events.find((event) => event.mode === 'challenge'
    && event.event === 'shown').questionId;
  await page.getByRole('button', { name: /この問題をスキップ/ }).click();
  await expect.poll(() => events.some((event) => event.mode === 'challenge'
    && event.event === 'skipped' && event.questionId === challengeQuestionId)).toBe(true);

  await page.goto('/live-challenge');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect.poll(() => events.filter((event) => event.mode === 'live'
    && event.event === 'shown').length).toBe(1);
  const liveQuestionId = events.find((event) => event.mode === 'live'
    && event.event === 'shown').questionId;
  await page.getByRole('button', { name: /この問題をスキップ/ }).click();
  await expect.poll(() => events.some((event) => event.mode === 'live'
    && event.event === 'skipped' && event.questionId === liveQuestionId)).toBe(true);
});

test('同じ端末では過去に見た問題より初めて見る問題を優先する', async ({ page }) => {
  await page.goto('/challenge');
  const unseenQuestion = await page.evaluate(() => {
    const cards = window.COMMON_QUESTION_CARDS;
    const target = cards.at(-1);
    const history = Object.fromEntries(cards.slice(0, -1).map((card) => [card.id, 1]));
    localStorage.setItem('watachan:question-view-history:v1', JSON.stringify(history));
    return { id: target.id, title: target.title };
  });
  await page.reload();
  await page.getByLabel('出題者の名前（12文字まで）').fill('初見優先確認');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.getByTestId('challenge-builder-paper-card')).toContainText(unseenQuestion.title);
  await expect.poll(() => page.evaluate(({ key, id }) => {
    const history = JSON.parse(localStorage.getItem(key) || '{}');
    return history[id] || 0;
  }, {
    key: 'watachan:question-view-history:v1',
    id: unseenQuestion.id,
  })).toBe(1);
});

test('トップ下部から挑戦モードの説明を読み、10問クイズ作成へ進める', async ({ page }) => {
  await page.goto('/');
  const guideLink = page.locator('nav[aria-label="ゲームシリーズの紹介ページ"] a[href="/challenge-guide"]');
  await expect(guideLink).toHaveCount(1);
  await guideLink.click();
  await expect(page).toHaveURL('/challenge-guide');
  await expect(page.getByRole('heading', { level: 1, name: 'みんなに挑戦してもらう' })).toBeVisible();
  await expect(page.getByText('あなたの答えを、最大50人が予想します', { exact: true })).toBeVisible();
  await expect(page.getByTestId('challenge-guide-hero')).toBeVisible();
  await expect(page.getByText('PLAY SCENE', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'こんな人におすすめ' })).toBeVisible();
  await expect(page.getByTestId('challenge-guide-promise')).toContainText('何度でも挑戦できる');
  await expect(page.getByText('点数順ではなく回答完了順で表示します。')).toBeVisible();
  await expect(page.getByRole('link', { name: '10問の理解度診断を作る' })).toHaveAttribute('href', '/challenge');
  await expect(page.getByRole('link', { name: /LIVE版もあります/ })).toHaveAttribute('href', '/live-challenge');
  await expect(page.getByTestId('challenge-guide-page')).toHaveCSS('max-width', '600px');
  await expect(page.getByRole('link', { name: '彼氏の愛情判定を見る' })).toHaveCount(0);
  await expect(page.locator('a[href="/love"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('PCのトップページは横へ広がらず中央600px以内に収まる', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'PCの横長画面専用の確認');
  await page.setViewportSize({ width: 1900, height: 1000 });
  await page.goto('/');

  const geometry = await page.locator('main').first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.width).toBeLessThanOrEqual(600);
  expect(Math.abs(geometry.left - (geometry.viewportWidth - geometry.width) / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.right - (geometry.viewportWidth + geometry.width) / 2)).toBeLessThanOrEqual(1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('製品版はパッケージ風デザインで現在の通常版・LIVE版とつながる', async ({ page }) => {
  await page.goto('/product');
  await expect(page.getByRole('heading', { name: '製品版もあります' })).toBeVisible();
  await expect(page.getByTestId('product-showcase')).toBeVisible();
  await expect(page.getByTestId('product-package-photo')).toBeVisible();
  await expect(page.getByRole('img', { name: 'ピンクの製品版カードゲームパッケージの実物写真' })).toHaveAttribute(
    'src',
    '/assets/product/board-game-package-photo.webp',
  );
  await expect(page.getByText('写真は製品版の実物パッケージです。Web版とは問題数・遊び方が異なります。')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Web版で盛り上がったら、製品版でもう一度' })).toBeVisible();
  await expect(page.getByText('54問入り', { exact: true })).toBeVisible();
  await expect(page.getByText('休み時間・放課後に', { exact: true })).toBeVisible();
  await expect(page.getByText('どの遊び方でも、合言葉は「当てるより、話すため」。')).toBeVisible();
  await expect(page.getByRole('link', { name: /通常版.*好きな時間に回答/ })).toHaveAttribute('href', '/challenge');
  await expect(page.getByRole('link', { name: /LIVE版.*視聴者が同時回答/ })).toHaveAttribute('href', '/live-challenge');
  await expect(page.getByRole('link', { name: /Amazonで製品版を見る/ })).toHaveAttribute('href', /amazon\.co\.jp/);
  await expect(page.getByTestId('product-page')).toHaveCSS('max-width', '600px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('共通お題を挑戦クイズと人気ライブラリで使える', async ({ page }) => {
  await page.goto('/challenge');
  const commonCard = await page.evaluate(() => ({
    id: window.COMMON_QUESTION_CARDS[0].id,
    title: window.COMMON_QUESTION_CARDS[0].title,
    firstChoice: window.COMMON_QUESTION_CARDS[0].choices[0],
  }));
  await page.goto(`/challenge?question=${encodeURIComponent(commonCard.id)}`);
  await expect(page.getByText(commonCard.title, { exact: true })).toBeVisible();
  await page.getByLabel('出題者の名前（12文字まで）').fill('共通お題テスト');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  const builderCard = page.locator('.challenge-builder-card');
  await expect(builderCard.getByRole('heading', { level: 2 })).toHaveText(commonCard.title);
  await expect(builderCard).toContainText(commonCard.firstChoice);
  await expect(builderCard.locator('svg.notebook-question-card-visual')).toHaveCount(1);
  await expect(builderCard.locator('.notebook-question-card-picture')).toHaveCount(0);
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
  await expect(page.getByText('送信した内容は運営が編集し、他の利用者へ公開する可能性があります。')).toBeVisible();
  await expect(page.getByText('性的内容、いじめ、容姿攻撃、差別表現は審査対象です。')).toBeVisible();
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

test('承認済み自作お題を理由付きで通報すると、即時非公開APIへ送って別のお題へ移る', async ({ page }) => {
  const questionId = 'CUSREPORTABLE1234567890';
  const reportBodies = [];
  await page.route('**/api/questions/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        questions: [{
          id: questionId,
          sourceKind: 'custom',
          sourceRef: null,
          title: '通報テストのお題',
          category: 'みんなのお題',
          choices: ['選択肢1', '選択肢2', '選択肢3', '選択肢4', '選択肢5'],
          status: 'approved',
          useChallenge: true,
          useLive: true,
        }],
      }),
    });
  });
  await page.route(`**/api/questions/catalog/${questionId}/report`, async (route) => {
    reportBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ questionId, hidden: true }),
    });
  });

  await page.goto(`/challenge?question=${questionId}`);
  await page.getByLabel('出題者の名前（12文字まで）').fill('通報確認');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.locator('.challenge-builder-card h2')).toHaveText('通報テストのお題');
  await page.locator('[data-report-reason]').selectOption('discrimination');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'このお題を通報する' }).click();

  await expect.poll(() => reportBodies.length).toBe(1);
  expect(reportBodies[0]).toEqual({ reason: 'discrimination', detail: '' });
  await expect(page.locator('.challenge-builder-card h2')).not.toHaveText('通報テストのお題');
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

test('出題者10問→共有URL→挑戦者10問→答え合わせ・点数入りカード・理解度ボードまで完走する', async ({ browser, page }, testInfo) => {
  const challengeUrl = await createChallenge(page);
  await expect(page.getByTestId('participant-count')).toContainText('0人回答済み');
  await expect(page.locator('#challenge-qr')).toBeHidden();
  await page.getByText('QRコードで送る', { exact: true }).click();
  await expect(page.locator('#challenge-qr')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => { window.__instagramCopiedUrl = text; } },
    });
  });
  const dialogPromise = page.waitForEvent('dialog');
  const instagramClick = page.getByRole('button', { name: 'Instagramでシェア' }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('あなたのクイズのリンクをコピーしました。\nInstagramストーリーズにシェアしてください！');
  await dialog.accept();
  await instagramClick;
  await expect.poll(() => page.evaluate(() => window.__instagramCopiedUrl)).toBe(challengeUrl);

  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  try {
    await participant.addInitScript(() => {
      window.__quizFeedbackFrequencies = [];
      window.AudioContext = class {
        constructor() {
          this.state = 'running';
          this.currentTime = 1;
          this.destination = {};
        }

        async resume() {
          this.state = 'running';
        }

        createOscillator() {
          return {
            type: 'sine',
            frequency: {
              setValueAtTime(value) {
                window.__quizFeedbackFrequencies.push(value);
              },
            },
            connect() {},
            start() {},
            stop() {},
          };
        }

        createGain() {
          return {
            gain: {
              setValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            connect() {},
          };
        }
      };
    });
    await participant.goto(challengeUrl);
    await expect(participant.getByText('相手を理解できるまで、何度でも挑戦できる')).toBeVisible();
    await expect(participant.getByRole('heading', { name: 'ちあきさんからの挑戦' })).toBeVisible();
    await participant.getByLabel('表示名（12文字まで）').fill('ゆう');
    await expect(participant.getByText(/回答後に、理解度ボードへ載せるかを結果画面で選べます/)).toBeVisible();
    await participant.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
    await participant.locator('[data-action="answer"]').first().click();
    await expect(participant.locator('.challenge-q-number')).toHaveText('Q2/10');
    await expect.poll(() => participant.evaluate(
      () => window.__quizFeedbackFrequencies.slice(0, 2),
    )).toEqual([659.25, 783.99]);
    await participant.reload();
    await expect(participant.getByTestId('participant-question')).toBeVisible();
    await expect(participant.locator('.challenge-q-number')).toHaveText('Q2/10');
    await participant.locator('[data-action="answer"]').nth(1).click();
    await expect(participant.locator('.challenge-q-number')).toHaveText('Q3/10');
    await expect.poll(() => participant.evaluate(
      () => window.__quizFeedbackFrequencies.slice(0, 2),
    )).toEqual([174.61, 146.83]);
    for (let index = 2; index < 9; index += 1) {
      await participant.locator('[data-action="answer"]').first().click();
      await expect(participant.locator('.challenge-q-number')).toHaveText(`Q${index + 2}/10`);
    }
    await participant.locator('[data-action="answer"]').first().click();
    await expect(participant.getByRole('heading', { name: '9/10問 正解' })).toHaveCount(1);
    await expect(participant.locator('.challenge-hero')).toHaveCount(0);
    await expect(participant.locator('.challenge-result')).toHaveCount(10);
    await expect(participant.getByRole('heading', { name: 'どこが当たった？' })).toBeVisible();
    await expect(participant.getByRole('heading', { name: '点数入り結果カード' })).toHaveCount(0);
    await expect(participant.getByRole('heading', { name: 'シェアするカードを選ぶ' })).toHaveCount(0);
    await expect(participant.locator('[data-action="select-result-card"]')).toHaveCount(0);
    await expect(participant.locator('input[name="board-comment"]')).toHaveCount(0);
    await expect(participant.getByRole('textbox', { name: /コメント/ })).toHaveCount(0);
    await expect(participant.getByTestId('challenge-score-actions')).toHaveCount(0);
    await expect(participant.getByRole('button', { name: '理解度ボードに載せる（任意）' })).toHaveCount(0);
    const resultImage = participant.getByTestId('challenge-result-image');
    await expect(resultImage).toBeVisible();
    await expect(resultImage).toHaveAttribute('alt', /9\/10問正解/);
    await expect.poll(() => resultImage.evaluate((image) => ({
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))).toEqual({ width: 1080, height: 1350 });
    expect(await participant.evaluate(() => {
      const image = document.querySelector('[data-testid="challenge-result-image"]');
      const answerCheck = document.querySelector('.challenge-results');
      return Boolean(image && answerCheck
        && (image.compareDocumentPosition(answerCheck) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
    const resultShare = participant.getByTestId('challenge-result-share');
    await expect(resultShare).toHaveCSS('background-color', 'rgb(255, 227, 111)');
    await expect(resultShare.getByRole('heading', { name: 'この結果、友達に伝えよう' })).toBeVisible();
    const boardCheckbox = resultShare.getByRole('checkbox', { name: /理解度ボードに載せる/ });
    await expect(boardCheckbox).toBeChecked();
    await expect(boardCheckbox).toBeEnabled();
    const boardOnlyButton = resultShare.getByRole('button', { name: '理解度ボードだけに載せる' });
    await expect(boardOnlyButton).toBeEnabled();
    await expect(resultShare.getByRole('button', { name: /Instagram用/ })).toBeEnabled();
    await expect(resultShare.getByRole('button', { name: 'LINEで送る' })).toBeVisible();
    await expect(resultShare.getByRole('button', { name: 'Xで結果を投稿' })).toBeVisible();
    await expect(resultShare.getByRole('button', { name: '画像だけ保存' })).toBeEnabled();
    await expect(participant.getByRole('button', { name: '文章だけコピーする' })).toHaveCount(0);
    expect(await resultShare.evaluate((share) => {
      const shareRect = share.getBoundingClientRect();
      const buttons = Array.from(share.querySelectorAll('button')).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          height: rect.height,
        };
      });
      return {
        shareLeft: shareRect.left,
        shareRight: shareRect.right,
        viewportWidth: window.innerWidth,
        buttonsFit: buttons.every((button) => (
          button.left >= shareRect.left
          && button.right <= shareRect.right
          && button.height >= 44
        )),
      };
    })).toMatchObject({
      buttonsFit: true,
    });
    await participant.evaluate(() => {
      window.open = (url) => { window.__openedResultShareUrl = url; };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text) => { window.__copiedResultText = text; } },
      });
    });
    await boardOnlyButton.click();
    await expect(resultShare.getByRole('button', { name: '理解度ボードに掲載済み' })).toBeDisabled();
    if (testInfo.project.name === 'desktop-chrome') {
      await boardCheckbox.uncheck();
      await resultShare.getByRole('button', { name: 'Xで結果を投稿' }).click();
      expect(await participant.evaluate(() => window.__openedResultShareUrl)).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
      expect(decodeURIComponent(await participant.evaluate(() => window.__openedResultShareUrl)))
        .toContain('/challenge?room=');
      await boardCheckbox.check();
      const downloadPromise = participant.waitForEvent('download');
      const dialogPromise = participant.waitForEvent('dialog');
      const instagramClick = resultShare.getByRole('button', { name: /Instagram用/ }).click();
      await downloadPromise;
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('文章をコピーし、結果画像を用意しました');
      await dialog.accept();
      await instagramClick;
      expect(await participant.evaluate(() => window.__copiedResultText)).toContain('称号は「');
      expect(await participant.evaluate(() => window.__copiedResultText.includes(location.origin))).toBe(false);
    }
    const feedbackToneCount = await participant.evaluate(
      () => window.__quizFeedbackFrequencies.length,
    );
    expect(feedbackToneCount).toBe(18);
    const firstAnswer = participant.locator('[data-result-answer="0"]');
    await firstAnswer.scrollIntoViewIfNeeded();
    await expect(firstAnswer).toHaveClass(/is-feedback-revealed/);
    await participant.waitForTimeout(700);
    expect(await participant.evaluate(() => window.__quizFeedbackFrequencies.length))
      .toBe(feedbackToneCount);
    const aiReview = participant.getByTestId('challenge-ai-review');
    await expect(aiReview).toContainText('答え合わせレポート');
    await expect(aiReview).toContainText('10問の一致・すれ違いから作成');
    await expect(aiReview.locator(':scope > div > p')).toHaveCount(4);
    expect(await aiReview.evaluate((review) => {
      const body = review.querySelector(':scope > div');
      const paragraphs = Array.from(review.querySelectorAll(':scope > div > p'));
      return {
        bodyBorder: getComputedStyle(body).borderTopWidth,
        paragraphBorders: paragraphs.map((paragraph) => getComputedStyle(paragraph).borderTopWidth),
      };
    })).toEqual({
      bodyBorder: '2px',
      paragraphBorders: ['0px', '0px', '0px', '0px'],
    });
    expect(await participant.evaluate(() => {
      const answers = document.querySelector('.challenge-results');
      const review = document.querySelector('[data-testid="challenge-ai-review"]');
      return Boolean(answers && review
        && (answers.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
    await expect(participant.getByRole('link', { name: '別の10問で自分も作る' })).toHaveAttribute('href', '/challenge');
    await participant.getByRole('link', { name: '理解度ボードを見る' }).click();
    await expect(participant.getByTestId('understanding-board')).toContainText('ゆう');
    await expect(participant.getByTestId('understanding-board')).toContainText('答え合わせ済み');
    await expect(participant.getByTestId('understanding-board')).toContainText('9/10問一致');
    await expect(participant.getByTestId('understanding-board').locator('.challenge-board-comment')).toHaveCount(0);
    await expect(participant.getByTestId('understanding-board')).not.toContainText('1位');
    await expect(participant.getByText('掲載された回答は、10問を回答し終えた順に表示します。')).toBeVisible();
    await expect(participant.getByText(/順位や点数順の並び替えはありません/)).toBeVisible();
  } finally {
    await participantContext.close();
  }

  await page.getByRole('button', { name: '回答状況を更新' }).click();
  await expect(page.getByTestId('participant-count')).toContainText('1人回答済み');
  await expect(page.getByTestId('host-answer-management')).toContainText('ゆう');
  await expect(page.getByTestId('host-answer-management')).toContainText('9/10問');
});

test('低い点数を載せず同じ10問を予想し直し、高い点数だけ理解度ボードへ載せられる', async ({ browser, page }) => {
  const challengeUrl = await createChallenge(page);
  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  try {
    await participant.goto(challengeUrl);
    await participant.getByLabel('表示名（12文字まで）').fill('再挑戦');
    await expect(participant.getByRole('checkbox', { name: /理解度ボードに載せる/ })).toHaveCount(0);
    await participant.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
    for (let index = 0; index < 10; index += 1) {
      await participant.locator('[data-action="answer"]').nth(1).click();
    }
    await expect(participant.getByRole('heading', { name: '0/10問 正解' })).toHaveCount(1);
    const firstAttemptBoardCheckbox = participant.getByTestId('challenge-result-share')
      .getByRole('checkbox', { name: /理解度ボードに載せる/ });
    await expect(firstAttemptBoardCheckbox).toBeChecked();
    await expect(firstAttemptBoardCheckbox).toBeEnabled();
    await firstAttemptBoardCheckbox.uncheck();
    await expect(firstAttemptBoardCheckbox).not.toBeChecked();
    await expect(firstAttemptBoardCheckbox).toBeEnabled();
    await participant.getByRole('button', { name: 'もう一度、答えを予想する' }).click();
    await expect(participant.locator('.challenge-q-number')).toHaveText('Q1/10');
    for (let index = 0; index < 10; index += 1) {
      await participant.locator('[data-action="answer"]').first().click();
    }
    await expect(participant.getByRole('heading', { name: '10/10問 正解' })).toHaveCount(1);
    const secondAttemptBoardCheckbox = participant.getByTestId('challenge-result-share')
      .getByRole('checkbox', { name: /理解度ボードに載せる/ });
    await expect(secondAttemptBoardCheckbox).toBeChecked();
    await expect(secondAttemptBoardCheckbox).toBeEnabled();
    await participant.getByRole('button', { name: '理解度ボードだけに載せる' }).click();
    await participant.getByRole('link', { name: '理解度ボードを見る' }).click();
    await expect(participant.getByTestId('understanding-board')).toContainText('再挑戦');
    await expect(participant.getByTestId('understanding-board')).toContainText('答え合わせ済み');
    await expect(participant.getByTestId('understanding-board')).toContainText('10/10問一致');
    await expect(participant.getByTestId('understanding-board')).not.toContainText('1位');
    await expect(participant.getByText(/順位や点数順の並び替えはありません/)).toBeVisible();
  } finally {
    await participantContext.close();
  }

  await page.getByRole('button', { name: '回答状況を更新' }).click();
  await expect(page.getByTestId('host-answer-management')).toContainText('再挑戦');
  await expect(page.getByTestId('host-answer-management')).toContainText('理解度ボード掲載');
  await expect(page.getByTestId('host-answer-management')).toContainText('10/10問');
});

test('参加者が結果画面から役割交代し、同じ10問の出題者になれる', async ({ browser, page }) => {
  const challengeUrl = await createChallenge(page, '最初の出題者');
  const participantContext = await browser.newContext();
  const participant = await participantContext.newPage();
  try {
    await participant.goto(challengeUrl);
    await participant.getByLabel('表示名（12文字まで）').fill('次の出題者');
    await participant.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
    const firstQuestion = await participant.locator('.notebook-card-accessible-title').first().textContent();
    for (let index = 0; index < 10; index += 1) {
      await participant.locator('[data-action="answer"]').first().click();
    }
    await expect(participant.getByTestId('challenge-role-swap')).toContainText('今度は役割交代');
    await expect(participant.getByTestId('challenge-role-swap')).toContainText('元の出題者の正解は引き継がれません');
    await participant.getByRole('button', { name: '役割交代して、次は自分が出題する' }).click();
    await expect(participant).toHaveURL('/challenge?role=swap');
    await expect(participant.locator('.challenge-hero h1')).toHaveText('次の出題者さんのクイズを作成');
    await expect(participant.getByTestId('challenge-builder-paper-card')).toContainText(firstQuestion.trim());
    await expect(participant.locator('[data-action="builder-answer"].is-selected')).toHaveCount(0);
  } finally {
    await participantContext.close();
  }
});

test('途中保存から再開し、画像付き10問パックでクイズ作成へ戻れる', async ({ page }) => {
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
  await expect(page.getByTestId('question-library').locator('.challenge-pack-card')).toHaveCount(7);
  await expect(page.getByTestId('question-library').locator('.challenge-pack-card img')).toHaveCount(7);
  await expect(page.getByRole('heading', { name: '意外な一面が分かる10問' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '夏休みの10問' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '推し活の10問' })).toBeVisible();
  await expect(page.getByTestId('question-library')).not.toContainText('回プレイ');
  await page.locator('[data-pack="unexpected-side"]').getByRole('link', { name: '通常版で作る' }).click();
  await expect(page.getByTestId('selected-question-pack')).toContainText('意外な一面が分かる10問');
  await page.getByLabel('出題者の名前（12文字まで）').fill('パックテスト');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.locator('.challenge-q-number')).toHaveText('Q1/10');
  await expect(page.locator('.challenge-builder-card')).toContainText('「第一印象」と本当の自分の違いに近いのは');
});

test('10問パックをLIVE版の作成画面でもそのまま使える', async ({ page }) => {
  await page.goto('/challenge/library');
  await page.locator('[data-pack="summer-vacation"]').getByRole('link', { name: 'LIVE版で作る' }).click();
  await expect(page).toHaveURL('/live-challenge?pack=summer-vacation');
  await expect(page.locator('.selected-live-pack')).toContainText('夏休みの10問');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByRole('heading', { name: '1問ずつクイズを作る' })).toBeVisible();
  await expect(page.locator('.selected-live-pack')).toContainText('夏休みの10問');
  await expect(page.getByTestId('live-builder-paper-card')).toContainText('行ってみたい都道府県');
});

test('LIVE専用4パックを選べ、不要な案内文カードを表示しない', async ({ page }) => {
  await page.goto('/live-challenge');
  const livePacks = page.getByTestId('live-exclusive-packs');
  await expect(page.getByTestId('live-intro-copy')).toHaveCount(0);
  await expect(livePacks.locator('.live-pack-card')).toHaveCount(4);
  await expect(livePacks.locator('.live-pack-card img')).toHaveCount(4);
  await expect(livePacks).toContainText('コメント欄が割れそうな10問');
  await expect(livePacks).toContainText('初見視聴者も答えやすい10問');
  await expect(livePacks).toContainText('配信者の意外な一面が分かる10問');
  await expect(livePacks).toContainText('30人以下の配信向け10問');
  await expect(livePacks.getByRole('link', { name: '通常版と共通の7パックを見る' }))
    .toHaveAttribute('href', '/challenge/library');

  await page.locator('[data-live-pack="live-comment-split"]')
    .getByRole('link', { name: 'このパックでLIVEを作る' }).click();
  await expect(page).toHaveURL('/live-challenge?pack=live-comment-split');
  await expect(page.locator('.selected-live-pack')).toContainText('コメント欄が割れそうな10問');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByTestId('live-builder-paper-card')).toContainText('目玉焼きにかけるのは');
});

test('正解は回答前の公開レスポンスへ出さず、51人目をサーバー側で拒否する', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '人数上限のAPI検証は画面幅に依存しないためPCで1回実行');
  await page.goto('/challenge');
  const mergedPool = await page.evaluate(() => {
    const merged = [...window.COMMON_QUESTION_CARDS];
    const seen = new Set();
    const unique = merged.filter((card) => {
      const key = card.title.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { count: unique.length, cards: unique.slice(0, 10) };
  });
  expect(mergedPool.count).toBeGreaterThanOrEqual(10);
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

test('PC・スマホとも横スクロールせず10問モードを操作できる', async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name.includes('mobile')
    ? { width: 375, height: 667 }
    : { width: 1280, height: 720 });
  await page.goto('/challenge');
  const dimensions = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  await page.getByLabel('出題者の名前（12文字まで）').fill('レイアウト確認');
  await page.getByRole('button', { name: /10問に答えてクイズを作る/ }).click();
  await expect(page.getByTestId('challenge-question-editor')).toBeVisible();
  const builderCard = page.getByTestId('challenge-builder-paper-card');
  const builderPad = page.getByTestId('challenge-builder-answer-pad');
  const builderButtons = builderPad.locator('[data-action="builder-answer"]');
  const skipButton = page.getByRole('button', { name: 'この問題をスキップ', exact: true });
  const editButton = page.getByRole('button', { name: '✎ 問題・選択肢を編集する', exact: true });
  const customButton = page.getByRole('button', { name: '＋ 自分で問題を作る', exact: true });
  await expect(builderCard.locator('.notebook-question-card-visual')).toHaveCount(1);
  await expect(builderButtons).toHaveCount(5);
  await expect(builderPad).toContainText('タップでドットの色を選択');
  await expect(page.locator('.challenge-progress span')).toHaveCount(10);
  const [cardBox, padBox, skipBox, editBox, customBox, buttonBoxes, cardGeometry, viewport] = await Promise.all([
    builderCard.boundingBox(),
    builderPad.boundingBox(),
    skipButton.boundingBox(),
    editButton.boundingBox(),
    customButton.boundingBox(),
    builderButtons.evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })),
    builderCard.evaluate((element) => {
      const paperRect = element.getBoundingClientRect();
      const visualRect = element.querySelector('.notebook-question-card-visual').getBoundingClientRect();
      return {
        width: paperRect.width,
        height: paperRect.height,
        visualWidth: visualRect.width,
        visualHeight: visualRect.height,
        visualLeft: visualRect.left - paperRect.left,
        visualTop: visualRect.top - paperRect.top,
      };
    }),
    page.evaluate(() => ({ innerHeight, scrollY })),
  ]);
  expect(cardBox?.y + cardBox?.height).toBeLessThanOrEqual(padBox?.y);
  expect(viewport.scrollY).toBe(0);
  for (const box of [cardBox, padBox, skipBox, editBox, customBox]) {
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect(box?.y + box?.height).toBeLessThanOrEqual(viewport.innerHeight);
  }
  expect(cardGeometry.width).toBeLessThanOrEqual(506);
  expect(cardGeometry.height / cardGeometry.width).toBeGreaterThan(1.47);
  expect(cardGeometry.height / cardGeometry.width).toBeLessThan(1.50);
  expect(cardGeometry.visualWidth).toBeGreaterThan(cardGeometry.width - 8);
  expect(cardGeometry.visualHeight).toBeGreaterThan(cardGeometry.height - 8);
  expect(cardGeometry.visualLeft).toBeGreaterThanOrEqual(0);
  expect(cardGeometry.visualTop).toBeGreaterThanOrEqual(0);
  buttonBoxes.forEach(({ width, height }) => {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  });
  const builderDimensions = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(builderDimensions.scrollWidth).toBeLessThanOrEqual(builderDimensions.innerWidth);

  const participantCards = await page.evaluate(() => window.COMMON_QUESTION_CARDS.slice(0, 10));
  const roomResponse = await page.request.post('/api/challenge/rooms', {
    data: {
      creatorName: '表示確認',
      cards: participantCards,
      answers: Array(10).fill(0),
    },
  });
  expect(roomResponse.status()).toBe(201);
  const room = await roomResponse.json();
  await page.goto(`/challenge?room=${room.code}`);
  await page.getByLabel('表示名（12文字まで）').fill('回答確認');
  await page.getByRole('button', { name: /10問の答え当てに挑戦する/ }).click();
  const participantScreen = page.getByTestId('participant-question');
  await expect(participantScreen).toBeVisible();
  await expect(page.locator('.challenge-hero')).toBeHidden();
  const participantCard = page.getByTestId('challenge-paper-card');
  const participantPad = page.getByTestId('challenge-answer-pad');
  await expect(participantPad).toContainText('タップでドットの色を選択');
  await expect(participantCard.locator('.notebook-question-card-visual')).toHaveCount(1);
  const [participantCardBox, participantPadBox, participantCardGeometry, participantViewport] = await Promise.all([
    participantCard.boundingBox(),
    participantPad.boundingBox(),
    participantCard.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
    page.evaluate(() => ({ innerHeight, scrollY })),
  ]);
  expect(participantViewport.scrollY).toBe(0);
  for (const box of [participantCardBox, participantPadBox]) {
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect(box?.y + box?.height).toBeLessThanOrEqual(participantViewport.innerHeight);
  }
  expect(participantCardBox?.y + participantCardBox?.height).toBeLessThanOrEqual(participantPadBox?.y - 4);
  expect(participantCardGeometry.height / participantCardGeometry.width).toBeGreaterThan(1.47);
  expect(participantCardGeometry.height / participantCardGeometry.width).toBeLessThan(1.50);
});

test('廃止した公開URLと遠隔APIは404になり、旧screen指定も開かない', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', 'HTTP状態は画面幅に依存しないためPCで1回実行');
  for (const path of ['/love', '/friends', '/family', '/boardgame', '/remote', '/remote-boardgame', '/live', '/live-guide']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(404);
  }
  expect((await request.get('/api/remote/rooms/123456')).status()).toBe(404);
  await page.goto('/?screen=friendIntro');
  await expect(page.getByRole('button', { name: 'みんなに挑戦してもらう', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ライブ配信でみんなに挑戦してもらう', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '彼氏の愛情を判定する' })).toHaveCount(0);
  await expect(page.getByText('友達の友情判定ゲーム', { exact: true })).toHaveCount(0);
});
