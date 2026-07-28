import { expect, test } from './test.mjs';

test.beforeEach(async ({ request }) => {
  await request.post('/__test/reset');
});

async function buildLiveQuestions(page, startIndex = 0) {
  for (let index = startIndex; index < 10; index += 1) {
    await expect(page.getByTestId('live-question-builder')).toBeVisible();
    await expect(page.locator('.q-badge')).toHaveText(`Q${index + 1}/10`);
    await expect(page.locator('.notebook-question-card-visual')).toHaveCount(1);
    if (index === 0) {
      const paperCard = page.getByTestId('live-builder-paper-card');
      const useButton = page.getByRole('button', { name: /この問題を使う.*答えは配信中に選択/ });
      await expect(page.getByTestId('live-builder-color-pad')).toHaveCount(0);
      await expect(useButton).toBeVisible();
      const [paperBox, buttonBox, buttonStyle] = await Promise.all([
        paperCard.boundingBox(),
        useButton.boundingBox(),
        useButton.evaluate((button) => {
          const style = getComputedStyle(button);
          return {
            backgroundColor: style.backgroundColor,
            fontSize: Number.parseFloat(style.fontSize),
            minHeight: style.minHeight,
          };
        }),
      ]);
      expect(paperBox?.y + paperBox?.height).toBeLessThanOrEqual(buttonBox?.y);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(64);
      expect(buttonStyle.backgroundColor).toBe('rgb(255, 226, 107)');
      expect(buttonStyle.fontSize).toBeGreaterThanOrEqual(18);
      expect(buttonStyle.minHeight).toBe('74px');
      const dimensions = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
      await expect(page.getByRole('button', { name: /10問をランダムで選び直す/ })).toHaveCount(0);
    }
    await page.getByRole('button', {
      name: /この問題を使う.*答えは配信中に選択/,
    }).click();
  }
}

test('top page prioritizes the normal creator button and keeps LIVE as a secondary route', async ({ page }) => {
  await page.goto('/');
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id).filter(Boolean);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  });
  expect(duplicateIds).toEqual([]);
  const normal = page.getByRole('button', { name: '10問を作り始める', exact: true });
  const live = page.getByRole('button', { name: 'LIVE版で作る', exact: true });
  const nameInput = page.getByLabel('あなたの名前（12文字まで）');
  const visual = page.getByTestId('top-character-visual');
  const character = visual.locator('img');
  const rules = page.getByTestId('top-common-rules');
  const liveAgeNotice = page.getByTestId('live-age-notice');
  await expect(rules).toBeVisible();
  await expect(rules).not.toContainText('あなたの理解度診断の作り方');
  await expect(rules).toContainText('あなたの「わたし理解度診断」を作って、みんなに挑戦してもらおう');
  await expect(rules).not.toContainText('通常版はあなたの答えを予想');
  await expect(rules).toHaveCSS(
    'background-image',
    'linear-gradient(160deg, rgb(255, 214, 229) 0%, rgb(255, 234, 241) 100%)',
  );
  await expect(rules).toHaveCSS('box-shadow', 'rgb(214, 58, 117) 5px 5px 0px 0px');
  await expect(page.getByTestId('top-common-rule-step')).toHaveCount(4);
  await expect(page.getByTestId('top-common-rule-step').locator('span')).toHaveText([
    'あなたが、出題する10問を選ぶ・作る',
    '自分の正解を選ぶ',
    'URL・QRコードで友達に問題を送信',
    '何問正解かでみんなの理解度を診断',
  ]);
  await expect(nameInput).toBeVisible();
  await expect(live).toBeVisible();
  await expect(liveAgeNotice).toHaveText('⚠️ 配信サービスごとの年齢・保護者同意ルールを確認してください。YouTubeで配信を開始できるのは原則16歳以上です。');
  await expect(page.getByRole('navigation', { name: 'ゲームシリーズの紹介ページ' })
    .getByRole('link', { name: /ライブ配信でみんなに挑戦してもらう/ })).toBeVisible();
  const [visualBox, characterBox, rulesBox, nameBox, normalBox, liveBox, liveAgeNoticeBox] = await Promise.all([
    visual.boundingBox(),
    character.boundingBox(),
    rules.boundingBox(),
    nameInput.boundingBox(),
    normal.boundingBox(),
    live.boundingBox(),
    liveAgeNotice.boundingBox(),
  ]);
  expect((characterBox?.height || 0) / (characterBox?.width || 1)).toBeCloseTo(3072 / 2088, 2);
  expect(visualBox?.y + visualBox?.height).toBeLessThanOrEqual(rulesBox?.y);
  expect(nameBox?.y).toBeGreaterThan(rulesBox?.y);
  expect(nameBox?.y + nameBox?.height).toBeLessThanOrEqual(normalBox?.y);
  expect(normalBox?.y + normalBox?.height).toBeLessThanOrEqual(liveBox?.y);
  expect(liveBox?.y + liveBox?.height).toBeLessThanOrEqual(liveAgeNoticeBox?.y);
  expect(liveAgeNoticeBox?.y + liveAgeNoticeBox?.height).toBeLessThanOrEqual(rulesBox?.y + rulesBox?.height);
  const styles = await Promise.all([normal, live].map((locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      border: style.border,
      borderRadius: style.borderRadius,
      color: style.color,
      fontWeight: style.fontWeight,
      minHeight: style.minHeight,
    };
  })));
  expect(styles[0].backgroundColor).toBe('rgb(26, 26, 26)');
  expect(styles[0].color).toBe('rgb(255, 255, 255)');
  expect(styles[1].backgroundColor).toBe('rgb(255, 255, 255)');
  expect(styles[1].color).toBe('rgb(26, 26, 26)');
});

test('LIVE問題作成カードは縦長で整列し、前の問題と最初へ戻れる', async ({ page }) => {
  await page.goto('/live-challenge');
  const liveCreateButton = page.getByRole('button', { name: /LIVEクイズを作る/ });
  const liveAgeNotice = page.getByTestId('live-age-notice');
  await expect(liveAgeNotice).toHaveText('⚠️ 配信サービスごとの年齢・保護者同意ルールを確認してください。YouTubeで配信を開始できるのは原則16歳以上です。');
  const [liveCreateButtonBox, liveAgeNoticeBox] = await Promise.all([
    liveCreateButton.boundingBox(),
    liveAgeNotice.boundingBox(),
  ]);
  expect(liveCreateButtonBox?.y + liveCreateButtonBox?.height).toBeLessThanOrEqual(liveAgeNoticeBox?.y);
  expect(Number.parseFloat(await liveAgeNotice.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await liveCreateButton.click();

  const paper = page.getByTestId('live-builder-paper-card');
  const skip = page.getByRole('button', { name: 'この問題をスキップ', exact: true });
  const previous = page.getByRole('button', { name: '前の問題に戻る', exact: true });
  const restart = page.getByRole('button', { name: '最初に戻る', exact: true });
  await expect(skip).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(restart).toBeVisible();

  const geometry = await paper.evaluate((element) => {
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
  });
  expect(geometry.width).toBeLessThanOrEqual(506);
  expect(geometry.height / geometry.width).toBeGreaterThan(1.47);
  expect(geometry.height / geometry.width).toBeLessThan(1.50);
  expect(geometry.visualWidth).toBeGreaterThan(geometry.width - 8);
  expect(geometry.visualHeight).toBeGreaterThan(geometry.height - 8);
  expect(geometry.visualLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.visualTop).toBeGreaterThanOrEqual(0);

  await page.getByRole('button', { name: /この問題を使う/ }).click();
  await expect(page.locator('.q-badge')).toHaveText('Q2/10');
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(page.locator('.q-badge')).toHaveText('Q1/10');
  await page.getByRole('button', { name: /この問題を使う/ }).click();
  await expect(page.locator('.q-badge')).toHaveText('Q2/10');
  await restart.click();
  const openBuilder = page.getByRole('button', { name: /LIVEクイズを作る/ });
  await expect(openBuilder).toBeVisible();
  await openBuilder.click();
  await expect(page.locator('.q-badge')).toHaveText('Q1/10');
});

test('未登録の配信者は販売登録の申込フォームへ進める', async ({ page }) => {
  await page.goto('/live-challenge');
  const landingRegistrationLink = page.getByRole('link', { name: /配信者登録審査へ進む/ });
  await expect(landingRegistrationLink).toHaveAttribute('href', '/?screen=about&to=contact&topic=live-creator-registration');
  await expect(landingRegistrationLink).toBeVisible();
  await expect(landingRegistrationLink).toHaveCSS('min-height', '44px');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();

  const salesSettings = page.getByTestId('live-sales-settings');
  const salesCheckbox = page.getByLabel('結果画像の販売・応援を受け付ける');
  const registrationLink = page.getByRole('link', { name: /配信者登録を申し込む/ });
  await expect(salesCheckbox).toBeDisabled();
  await expect(salesCheckbox).toHaveAttribute('aria-describedby', 'paid-sales-registration-help');
  await expect(salesSettings).toContainText('無料LIVEは登録せず作れます');
  await expect(registrationLink).toHaveAttribute('href', '/?screen=about&to=contact&topic=live-creator-registration');
  await expect(registrationLink).toBeVisible();

  await registrationLink.click();
  await expect(page).toHaveURL(/screen=about&to=contact&topic=live-creator-registration/);
  await expect(page.getByTestId('creator-registration-contact-notice')).toContainText('LIVE配信者登録のお申し込み');
  await expect(page.getByLabel('お問い合わせ内容')).toHaveValue(/LIVE配信者登録を希望します。/);
  await expect(page.locator('input[name="_subject"]')).toHaveValue('streetboardgame.com LIVE配信者登録申込み');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('審査済み配信者は公開LIVEで結果画像価格と応援販売を設定できる', async ({ page }) => {
  const verificationId = 'a'.repeat(32);
  const verificationToken = 'b'.repeat(48);
  let createRequest = null;
  await page.addInitScript(({ id, token }) => {
    sessionStorage.setItem('live:verification-channel:UC1234567890', JSON.stringify({
      verificationId: id,
      accessToken: token,
    }));
  }, { id: verificationId, token: verificationToken });
  await page.route(`**/api/live/channel-verifications/${verificationId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        verificationId,
        channelId: 'UC1234567890',
        channelName: '審査済み配信者',
        canSellPaid: true,
      }),
    });
  });
  await page.route('**/api/live/stream-games', async (route) => {
    createRequest = {
      body: route.request().postDataJSON(),
      verificationToken: route.request().headers()['x-live-verification-token'],
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '123456',
        hostToken: 'c'.repeat(48),
        game: {
          mode: 'stream-challenge',
          phase: 'lobby',
          subjectToken: 'd'.repeat(48),
          participantCount: 0,
          participantLimit: 1000,
          showVoteCount: false,
          resultImagePrice: 980,
        },
      }),
    });
  });
  await page.goto('/live-challenge');
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByTestId('live-sales-settings')).toContainText('審査済み配信者');
  const sales = page.getByLabel('結果画像の販売・応援を受け付ける');
  await expect(sales).toBeEnabled();
  await sales.check();
  await page.getByLabel('オリジナル結果画像生成・ダウンロードサービス利用料').selectOption('980');
  await page.getByLabel('配信者名（24文字まで）').fill('公開配信者');
  await buildLiveQuestions(page);

  expect(createRequest).toMatchObject({
    verificationToken,
    body: {
      subjectName: '公開配信者',
      paidSalesRequested: true,
      channelName: '審査済み配信者',
      channelId: 'UC1234567890',
      channelVerificationId: verificationId,
      resultImagePrice: 980,
    },
  });
  await expect(page.getByRole('heading', { name: '視聴者を招待する' })).toBeVisible();
});

test('公開LIVEの結果画面に有料結果画像と5段階の応援金額を表示する', async ({ page }) => {
  const participantToken = 'e'.repeat(48);
  await page.addInitScript(({ token }) => {
    sessionStorage.setItem('live-challenge:123456', JSON.stringify({ token, name: '視聴者A' }));
  }, { token: participantToken });
  await page.route('**/api/live/games/123456', async (route) => {
    const results = Array.from({ length: 10 }, (_, index) => ({
      questionId: `result-${index}`,
      type: 'guess-person',
      options: [{ text: '緑' }, { text: '青' }, { text: '黄' }, { text: '赤' }, { text: '橙' }],
      subjectAnswerIndex: 0,
      myVoteIndex: 0,
      myIsCorrect: true,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '123456',
        game: {
          mode: 'stream-challenge',
          phase: 'complete',
          subjectName: '配信者',
          participantName: '視聴者A',
          questionCount: 10,
          results,
          resultImagePrice: 2980,
          resultImageSalesEnabled: true,
          supportPaymentsEnabled: true,
          supportAmounts: [180, 480, 980, 1980, 2980],
        },
      }),
    });
  });
  await page.goto('/live-challenge?room=123456');
  const checkoutPanel = page.getByTestId('live-checkout-panel');
  await expect(checkoutPanel).toBeVisible();
  const buy = page.getByRole('button', { name: '2,980円（税込）で申し込む' });
  await expect(buy).toBeDisabled();
  await page.getByLabel(/利用規約/).check();
  await expect(buy).toBeEnabled();
  await page.getByRole('button', { name: '♡ 配信者を応援する' }).click();
  const supportButtons = page.locator('[data-support-amount]');
  await expect(supportButtons).toHaveCount(5);
  await expect(supportButtons).toHaveText([
    '180円（税込）',
    '480円（税込）',
    '980円（税込）',
    '1,980円（税込）',
    '2,980円（税込）',
  ]);
});

test('視聴者はLIVEチャットへ投稿でき、5段階の応援金額を選べる', async ({ page }) => {
  const participantToken = 'f'.repeat(48);
  let postedMessage = '';
  await page.addInitScript(({ token }) => {
    sessionStorage.setItem('live-challenge:123456', JSON.stringify({ token, name: '視聴者B' }));
  }, { token: participantToken });
  await page.route('**/api/live/games/123456/chat', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    postedMessage = JSON.parse(route.request().postData() || '{}').message || '';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '123456',
        message: {
          id: 'msg_test_12345678',
          participantId: 'participant-b',
          name: '視聴者B',
          role: 'viewer',
          text: postedMessage,
          type: 'chat',
          amount: 0,
          createdAt: Date.now(),
        },
      }),
    });
  });
  await page.route('**/api/live/games/123456', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '123456',
        game: {
          mode: 'stream-challenge',
          phase: 'lobby',
          subjectName: '配信者',
          participantName: '視聴者B',
          participantId: 'participant-b',
          participantCount: 4,
          participantLimit: 1000,
          questionCount: 10,
          realtime: false,
          chatEnabled: true,
          chatMessages: [],
          supportPaymentsEnabled: true,
          supportAmounts: [180, 480, 980, 1980, 2980],
        },
      }),
    });
  });
  await page.goto('/live-challenge?room=123456');
  await expect(page.getByTestId('live-chat-panel')).toBeVisible();
  const [mainBox, chatBox, viewportWidth] = await Promise.all([
    page.locator('.live-session-main').boundingBox(),
    page.getByTestId('live-chat-panel').boundingBox(),
    page.evaluate(() => window.innerWidth),
  ]);
  if (viewportWidth >= 900) {
    expect(chatBox?.x).toBeGreaterThan((mainBox?.x || 0) + (mainBox?.width || 0) - 1);
  } else {
    expect(chatBox?.y).toBeGreaterThan((mainBox?.y || 0) + (mainBox?.height || 0) - 1);
  }
  await page.getByPlaceholder('チャットを入力（120文字まで）').fill('配信楽しみ！');
  await page.getByRole('button', { name: 'チャットを送信' }).click();
  await expect(page.getByTestId('live-chat-panel')).toContainText('配信楽しみ！');
  expect(postedMessage).toBe('配信楽しみ！');
  await page.getByRole('button', { name: /応援メッセージを送る/ }).click();
  await expect(page.locator('[data-chat-support-amount]')).toHaveCount(5);
  await expect(page.locator('[data-chat-support-amount]')).toHaveText([
    '180円',
    '480円',
    '980円',
    '1,980円',
    '2,980円',
  ]);
});

test('配信者には金額色付きの応援通知を確認するまで固定表示する', async ({ page }) => {
  const hostToken = 'h'.repeat(48);
  const supportMessage = {
    id: 'support_paid_2980',
    participantId: 'participant-supporter',
    name: '応援する視聴者',
    role: 'viewer',
    text: '配信とても楽しかったです！',
    type: 'support',
    amount: 2980,
    createdAt: Date.now(),
  };
  await page.route('**/api/live/games/123456', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '123456',
        game: {
          mode: 'stream-challenge',
          phase: 'lobby',
          subjectName: '配信者',
          subjectToken: 's'.repeat(48),
          participantCount: 4,
          participantLimit: 1000,
          questionCount: 10,
          realtime: false,
          chatEnabled: true,
          chatMessages: [supportMessage],
          supportPaymentsEnabled: true,
          supportAmounts: [180, 480, 980, 1980, 2980],
        },
      }),
    });
  });
  await page.goto(`/live-challenge?room=123456#host=${hostToken}`);

  const hostAlert = page.getByTestId('live-support-host-alert');
  await expect(hostAlert).toBeVisible();
  await expect(hostAlert).toContainText('応援する視聴者さん');
  await expect(hostAlert).toContainText('2,980円');
  await expect(hostAlert).toHaveClass(/support-tier-5/);
  await expect(page.locator('[data-chat-message-id="support_paid_2980"]')).toHaveClass(/support-tier-5/);

  await hostAlert.getByRole('button', { name: '確認した' }).click();
  await expect(hostAlert).toBeHidden();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(sessionStorage.getItem('live-challenge:support-ack:123456') || '[]')
  ))).toContain('support_paid_2980');
});

test('streamer and viewer answer ten questions and viewer receives a result card', async ({ page, context }, testInfo) => {
  const activeViewport = testInfo.project.name.includes('mobile')
    ? { width: 375, height: 667 }
    : { width: 1280, height: 720 };
  await page.setViewportSize(activeViewport);
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
  await expect(page.getByRole('heading', { name: /私のこと、ちゃんと/ })).toBeVisible();
  await page.getByRole('button', { name: /LIVEクイズを作る/ }).click();
  await expect(page.getByLabel('このクイズを友達や他の人も使えるようにする')).toBeChecked();
  await page.getByLabel('配信者名（24文字まで）').fill('わたちゃん');
  const beforeSkip = await page.getByTestId('live-question-builder').getByRole('heading', { level: 3 }).textContent();
  await page.getByRole('button', { name: 'この問題をスキップ', exact: true }).click();
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
  await viewer.setViewportSize(activeViewport);
  await viewer.goto(`/live-challenge?room=${code}`);
  await expect(viewer.getByText('相手を理解できるまで、何度でも挑戦できる')).toBeVisible();
  await viewer.getByLabel('あなたの名前（24文字まで）').fill('視聴者A');
  await viewer.getByRole('button', { name: /^参加する/ }).click();
  await expect(viewer.getByRole('heading', { name: '配信者のスタート待ち' })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: '参加中' })).toContainText('1人');

  await page.getByRole('button', { name: /10問をスタート/ }).click();
  for (let index = 0; index < 10; index += 1) {
    await expect(page.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    if (index === 0) {
      const hostQuestion = page.getByTestId('live-host-question');
      await expect(hostQuestion.locator('[data-action="host-answer"]')).toHaveCount(5);
      const [box, viewport] = await Promise.all([
        hostQuestion.boundingBox(),
        page.evaluate(() => ({ innerHeight, scrollY })),
      ]);
      expect(viewport.scrollY).toBe(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect(box?.y + box?.height).toBeLessThanOrEqual(viewport.innerHeight);
    }
    await page.locator('[data-action="host-answer"]').first().click();
    await expect(viewer.getByText(`Q${index + 1}/10`, { exact: false }).first()).toBeVisible();
    if (index === 0) {
      const viewerQuestion = viewer.getByTestId('live-viewer-question');
      await expect(viewerQuestion.locator('[data-action="viewer-answer"]')).toHaveCount(5);
      const [box, viewport] = await Promise.all([
        viewerQuestion.boundingBox(),
        viewer.evaluate(() => ({ innerHeight, scrollY })),
      ]);
      expect(viewport.scrollY).toBe(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect(box?.y + box?.height).toBeLessThanOrEqual(viewport.innerHeight);
    }
    await viewer.locator('[data-action="viewer-answer"]').nth(index === 1 ? 1 : 0).click();
    await expect(viewer.getByText('回答済みです。')).toBeVisible();
    await expect(viewer.getByText('配信者の回答', { exact: true })).toHaveCount(0);
    await page.locator('[data-action="advance"]').click();
    await expect(page.getByTestId('live-host-reveal')).toBeVisible();
    await expect(page.getByText('配信者の回答', { exact: true })).toBeVisible();
    await expect(viewer.getByTestId('live-viewer-reveal')).toBeVisible();
    await expect(viewer.getByText(index === 1 ? '× 不一致' : '○ 一致！ 1点', { exact: true })).toBeVisible();
    await expect(viewer.getByText('配信者の回答', { exact: true })).toBeVisible();
    await expect(viewer.getByText('あなたの回答', { exact: true })).toBeVisible();
    await page.locator('[data-action="next"]').click();
  }

  await expect(page.getByRole('heading', { name: 'LIVEクイズ終了！' })).toBeVisible();
  await expect(viewer.getByTestId('live-result-card')).toBeVisible();
  await expect(viewer.getByText('9/10', { exact: true })).toBeVisible();
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
  await expect(page.getByText('送信した内容は運営が編集し、他の利用者へ公開する可能性があります。')).toBeVisible();
  await expect(page.getByText('性的内容、いじめ、容姿攻撃、差別表現は審査対象です。')).toBeVisible();
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
