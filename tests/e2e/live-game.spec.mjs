import { devices, expect, test } from '@playwright/test';
import { stat } from 'node:fs/promises';
import { LIVE_FALLBACK_VIEWER_LIMIT, LIVE_RESERVATION_BUFFER_HOURS, LIVE_RESULT_IMAGE_SERVICE, LIVE_VIEWER_LIMIT } from '../../src/live/config.js';
import { CHECKOUT_TERMS } from '../../src/live/checkout-terms-config.js';

const TEST_CREATOR_INVITE = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const creatorHeaders = (extra = {}) => ({ 'x-live-creator-invite': TEST_CREATOR_INVITE, ...extra });

test('結果画面から高画質画像と応援金のStripe Checkoutを開始できる', async ({ page }) => {
  const checkoutBodies = [];
  await page.addInitScript(() => sessionStorage.setItem('live:participant:123456', 'a'.repeat(48)));
  await page.route('**/api/live/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: { mode: 'normal' } }) }));
  await page.route('**/api/live/games/123456', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: '123456', game: {
    title: '決済LIVE', subjectName: '本人', channelName: '決済チャンネル', phase: 'complete', flowVersion: 5,
    currentQuestionIndex: 0, questionCount: 1, participantCount: 1, participantLimit: 50, participants: [],
    results: [{ questionId: 'q1', type: 'guess-person', text: '問題', options: [{ text: 'A', count: 1 }], popularIndices: [0], subjectAnswerIndex: 0, myVoteIndex: 0, myIsCorrect: true }],
    participantName: '視聴者A', scheduledAt: Date.now(), resultImagePrice: 1000,
    supportAmounts: [200, 500, 1000, 3000], paidSalesEnabled: true,
    supportPaymentsEnabled: true, resultImageSalesEnabled: true,
  } }) }));
  await page.route('**/api/live/games/123456/result-preview**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="675"></svg>' }));
  await page.route('**/api/live/games/123456/checkout', async (route) => {
    checkoutBodies.push({ body: route.request().postDataJSON(), headers: route.request().headers() });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ orderId: 'ord_test', checkoutSessionId: 'cs_test_checkout', checkoutUrl: 'https://checkout.stripe.com/c/pay/test', expiresAt: Date.now() + 1_800_000 }) });
  });
  await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Stripe Checkout</h1>' }));
  await page.goto('/live?room=123456');
  await expect(page.getByText(LIVE_RESULT_IMAGE_SERVICE.name, { exact: true })).toBeVisible();
  await expect(page.getByText(/ダウンロードリンクが利用可能になった時点で本サービスの提供完了/)).toBeVisible();
  const resultCheckoutButton = page.getByRole('button', { name: '1,000円で生成・ダウンロードを申し込む' });
  const checkoutConsent = page.getByRole('checkbox', { name: /利用規約.*表示金額の決済と提供条件に同意/ });
  await expect(checkoutConsent).not.toBeChecked();
  await expect(resultCheckoutButton).toBeDisabled();
  const purchasePanel = page.locator('.live-result-image-panel');
  for (const legalLink of ['利用規約', '特定商取引法に基づく表記', '返金・キャンセルポリシー', 'プライバシーポリシー', '未成年者利用規定']) {
    await expect(purchasePanel.getByRole('link', { name: legalLink, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: '♡ 応援金を送る' }).click();
  await expect(page.getByRole('button', { name: '♡ 応援金を送る' })).toHaveAttribute('aria-expanded', 'true');
  for (const amount of ['200円', '500円', '1,000円', '3,000円']) await expect(page.getByRole('button', { name: amount, exact: true })).toBeDisabled();
  await checkoutConsent.check();
  await expect(resultCheckoutButton).toBeEnabled();
  for (const amount of ['200円', '500円', '1,000円', '3,000円']) await expect(page.getByRole('button', { name: amount, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '500円', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stripe Checkout' })).toBeVisible();
  expect(checkoutBodies).toHaveLength(1);
  expect(checkoutBodies[0].body).toMatchObject({ productType: 'support', amount: 500, viewerName: '視聴者A', termsAccepted: true, termsVersion: CHECKOUT_TERMS.version, termsDocumentSha256: CHECKOUT_TERMS.documentSha256 });
  expect(checkoutBodies[0].headers['x-live-participant-token']).toBe('a'.repeat(48));
  expect(checkoutBodies[0].headers['x-live-checkout-request']).toMatch(/^[a-f0-9]{32}$/);

  await page.goto('/live?room=123456');
  await page.getByRole('checkbox', { name: /利用規約.*表示金額の決済と提供条件に同意/ }).check();
  await page.getByRole('button', { name: '1,000円で生成・ダウンロードを申し込む' }).click();
  await expect(page.getByRole('heading', { name: 'Stripe Checkout' })).toBeVisible();
  expect(checkoutBodies).toHaveLength(2);
  expect(checkoutBodies[1].body).toMatchObject({ productType: 'result_image', viewerName: '視聴者A', termsAccepted: true, termsVersion: CHECKOUT_TERMS.version, termsDocumentSha256: CHECKOUT_TERMS.documentSha256 });
  expect(checkoutBodies[1].headers['x-live-participant-token']).toBe('a'.repeat(48));
  expect(checkoutBodies[1].headers['x-live-checkout-request']).toMatch(/^[a-f0-9]{32}$/);
});

test('画像販売設定がなくても応援金ボタンを表示できる', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('live:participant:123456', 'a'.repeat(48)));
  await page.route('**/api/live/status', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ status: { mode: 'normal' } }),
  }));
  await page.route('**/api/live/games/123456', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: '123456', game: {
      title: '応援LIVE', subjectName: '本人', channelName: '応援チャンネル', phase: 'complete', flowVersion: 5,
      currentQuestionIndex: 0, questionCount: 1, participantCount: 1, participantLimit: 50, participants: [],
      results: [{ questionId: 'q1', type: 'guess-person', text: '問題', options: [{ text: 'A', count: 1 }], popularIndices: [0], subjectAnswerIndex: 0, myVoteIndex: 0, myIsCorrect: true }],
      participantName: '視聴者A', scheduledAt: Date.now(), resultImagePrice: 1000,
      supportAmounts: [200, 500, 1000, 3000], paidSalesEnabled: true,
      supportPaymentsEnabled: true, resultImageSalesEnabled: false,
    } }),
  }));
  await page.route('**/api/live/games/123456/result-preview**', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="675"></svg>',
  }));

  await page.goto('/live?room=123456');
  await expect(page.getByRole('button', { name: '♡ 応援金を送る' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1,000円で生成・ダウンロードを申し込む' })).toHaveCount(0);
});

test('注文番号と購入メールで高画質画像を再ダウンロードできる', async ({ page }) => {
  await page.route('**/api/live/status', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ status: { mode: 'normal' } }),
  }));
  await page.route('**/api/live/purchases/recover', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      orderId: `ord_${'a'.repeat(32)}`,
      email: 'viewer@example.com',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        purchaseId: 'purchase_recovery01',
        availableUntil: Date.now() + 24 * 60 * 60 * 1000,
        downloadUrl: 'https://www.streetboardgame.com/api/live/downloads/purchase_recovery01?expires=1&signature=test',
      }),
    });
  });
  await page.goto('/live?recover=1');
  await expect(page.getByRole('heading', { name: '高画質結果画像を再ダウンロード' })).toBeVisible();
  await page.locator('#recoveryOrderId').fill(`ord_${'a'.repeat(32)}`);
  await page.locator('#recoveryEmail').fill('viewer@example.com');
  await page.getByRole('button', { name: '購入権限を確認する' }).click();
  await expect(page.getByText('購入権限を確認しました。')).toBeVisible();
  await expect(page.getByRole('link', { name: '高画質画像をダウンロード' })).toHaveAttribute(
    'href',
    /\/api\/live\/downloads\/purchase_recovery01\?expires=1&signature=test/,
  );
});

function scheduleForTest(testInfo, slot) {
  const projectOffsetDays = testInfo.project.name === 'mobile-chrome' ? 100 : 0;
  const date = new Date(Date.now() + (projectOffsetDays + slot * 2 + 2) * 24 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

async function selectLiveSchedule(page, testInfo, slot) {
  const input = page.locator('#scheduledAt');
  await expect(input).toHaveAttribute('type', 'datetime-local');
  await input.fill(scheduleForTest(testInfo, slot));
  await page.locator('#checkSchedule').click();
  await expect(page.getByText('この日時は予約できます。企画保存時に予約を確定します。')).toBeVisible();
}

async function resetLiveTestState(request) {
  const response = await request.post('/__test/reset');
  expect(response.status()).toBe(204);
}

test.beforeEach(async ({ context, request }) => {
  await resetLiveTestState(request);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.addInitScript(() => {
    sessionStorage.setItem('live:creator-invite', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
  });
});

test.afterEach(async ({ request }) => {
  await resetLiveTestState(request);
});

test('手入力形式の新規作成APIを受け付けない', async ({ request }) => {
  const response = await request.post('/api/live/games', {
    data: {
      draft: {
        creationMode: 'manual',
        title: '手入力LIVE',
        subjectName: '本人',
        questions: [{ type: 'poll', text: '手入力問題', options: ['A', 'B'] }],
      },
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'youtube-creation-required' });
});

test('招待コード発行手順を確認しLIVE問い合わせを送信できる', async ({ page }) => {
  let submittedBody = '';
  await page.route('https://formspree.io/f/xrevejjr', async (route) => {
    submittedBody = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/live');
  await expect(page.locator('#liveRoot .shell > section.panel > h2, #liveRoot .shell > section.viewer-entry-panel h2')).toHaveText([
    'YouTubeチャンネルから問題を作る',
    'YouTubeライブを見ている視聴者はこちら',
    '購入済み画像を再ダウンロード',
    '【YouTuber向け】招待コードの申請・使い方の問い合わせ',
  ]);
  await expect(page.getByText('YOUTUBE VIEWER')).toBeVisible();
  await expect(page.getByText('配信で6桁コードを確認')).toBeVisible();
  await expect(page.getByLabel('配信で案内された6桁のルームコード')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByRole('button', { name: '視聴者としてLIVEに参加' })).toBeVisible();
  await expect(page.getByText('招待コードをお持ちでない方へ')).toBeVisible();
  await page.getByRole('link', { name: '招待コードを申請・使い方を問い合わせる' }).click();
  await expect(page.getByRole('heading', { name: '【YouTuber向け】招待コードの申請・使い方の問い合わせ' })).toBeVisible();
  await expect(page.locator('.invite-step')).toHaveCount(3);
  await expect(page.getByText('フォームから申請')).toBeVisible();
  await expect(page.getByText('運営が手動審査')).toBeVisible();
  await expect(page.getByText('メールでコードを受け取る')).toBeVisible();
  await expect(page.getByText(/コードの有効期間は発行から90日/)).toBeVisible();
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await expect(page.locator('#inquiryChannelUrl')).toHaveValue('https://www.youtube.com/@sample');
  await page.locator('#inquiryName').fill('配信スタッフ山田');
  await page.locator('#inquiryEmail').fill('staff@example.com');
  await page.locator('#inquiryType').selectOption('招待コード発行を希望');
  await page.locator('#inquiryMessage').fill('来月のライブ配信で利用したいです。');
  await page.locator('#inquiryPrivacy').check();
  await page.locator('#submitLiveInquiry').click();
  await expect(page.locator('#liveInquiryStatus')).toHaveText(/送信しました。運営が内容を確認し/);
  expect(submittedBody).toContain('staff@example.com');
  expect(submittedBody).toContain('https://www.youtube.com/@sample');
  expect(submittedBody).not.toContain('live:creator-invite');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('YouTubeの本人回答モードだけ30問を生成し、1問以上を選んで共通編集へ進む', async ({ page }, testInfo) => {
  await page.goto('/live');
  await expect(page.getByRole('heading', { name: 'YouTuberと視聴者の絆を判定する、私のことちゃんとわかってるよね?Youtubeライブver.' })).toBeVisible();
  const heroTitleLines = page.locator('.live-series-title > span');
  await expect(heroTitleLines).toHaveText([
    'YouTuberと視聴者の絆を判定する、',
    '私のことちゃんとわかってるよね？',
    'Youtubeライブver.',
  ]);
  expect(await heroTitleLines.evaluateAll((lines) => lines.every((line) => line.scrollWidth <= line.clientWidth + 1))).toBe(true);
  await expect(heroTitleLines.first()).toHaveCSS('text-shadow', 'none');
  await expect(page.getByRole('button', { name: /自分で問題を作る/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'YouTubeチャンネルから問題を作る' })).toBeVisible();
  await expect(page.locator('#entryRoomCode')).toBeVisible();

  await expect(page.locator('#channelUrl')).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveCount(0);
  const personModeButton = page.locator('[data-youtube-type="guess-person"]');
  const majorityModeButton = page.locator('[data-youtube-type="guess-majority"]');
  await expect(personModeButton).toBeHidden();
  await expect(majorityModeButton).toBeHidden();
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.questionType).toBe('guess-person');
    const label = body.questionType === 'guess-majority' ? '1位' : '本人';
    const regenerated = body.seed ? '再生成' : '';
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `mock-${index}`,
      type: body.questionType,
      text: `${label}${regenerated}候補問題${index + 1}`,
      options: ['選択A', '選択B', '選択C', '選択D', '選択E'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'サンプルチャンネル', source: 'youtube-public-page' },
        questionType: body.questionType,
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await expect(personModeButton).toBeVisible();
  await expect(majorityModeButton).toBeVisible();
  await expect(personModeButton).toContainText('YouTuberの答えを視聴者が予想する（30問生成し、採用する問題を選ぶ）');
  await expect(majorityModeButton).toContainText('YouTuberが視聴者投票の1位を予想する（30問生成し、採用する問題を選ぶ）');
  await personModeButton.click();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
  await expect(page.locator('[data-candidate-index="0"] [data-option-index]')).toHaveCount(5);
  await expect(page.getByText('選択中：本人の答えを当てる（30問）')).toBeVisible();
  await expect(page.locator('[data-candidate-index] [data-field="type"]')).toHaveCount(0);
  await page.locator('[data-candidate-index="1"] [data-action="candidate-up"]').click();
  await expect(page.locator('[data-candidate-index="0"] [data-field="text"]')).toHaveValue('本人候補問題2');
  await page.locator('[data-candidate-index="0"] [data-action="regenerate"]').click();
  await expect(page.locator('[data-candidate-index="0"] [data-field="text"]')).toHaveValue(/本人再生成候補問題/);
  await page.locator('[data-candidate-index="0"] [data-field="text"]').fill('編集した候補問題');
  await page.locator('#autoRecommend').click();
  await expect(page.locator('[data-field="selected"]:checked')).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await page.locator(`[data-candidate-index="${index}"] [data-field="selected"]`).uncheck();
  }
  await expect(page.locator('#useCandidates')).toBeDisabled();
  await page.locator('[data-candidate-index="0"] [data-field="selected"]').check();
  await expect(page.locator('#useCandidates')).toBeEnabled();
  await page.locator('#useCandidates').click();
  await expect(page.getByRole('heading', { name: '問題を編集する' })).toBeVisible();
  await expect(page.locator('.editor-flow-step')).toHaveCount(3);
  await expect(page.locator('.editor-flow-step.is-current')).toContainText('いまここ');
  await expect(page.getByText('まず、企画の基本情報を確認')).toBeVisible();
  await expect(page.getByRole('heading', { name: '次に、問題と5択を確認' })).toBeVisible();
  await expect(page.locator('#gameTitle')).toHaveValue(/サンプルチャンネル/);
  await expect(page.locator('[data-question-index="0"] [data-field="question-text"]')).toHaveValue('編集した候補問題');
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toBeDisabled();
  await expect(page.locator('[data-question-index="0"] [data-field="question-type"]')).toHaveValue('guess-person');
  await expect(page.locator('[data-question-index="0"] [data-editor-option]')).toHaveCount(5);
  await expect(page.locator('[data-question-index="0"] .editor-option-number')).toHaveText(['1', '2', '3', '4', '5']);
  await expect(page.locator('#showLiveVoteCounts')).not.toBeChecked();
  await expect(page.locator('#scheduledAt')).toHaveValue('');
  await expect(page.getByText(`設計上限：視聴者${LIVE_VIEWER_LIMIT.toLocaleString('ja-JP')}人`)).toBeVisible();
  await expect(page.getByText(`予約時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間は、ほかのYouTuberが予約できません。`)).toBeVisible();
  await selectLiveSchedule(page, testInfo, 0);
  await expect(page.getByText('全問題で選択肢別の現在票数を表示する')).toBeVisible();
  await expect(page.locator('.editor-question-card')).toHaveCount(1);
  await expect(page.locator('.editor-question-card').first()).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('#addQuestion')).toHaveCount(0);
  await expect(page.locator('[data-action="add-option"], [data-action="remove-option"]')).toHaveCount(0);
  await expect(page.locator('[data-question-index="0"] [data-field="locked-index"]')).toHaveCount(0);
  await expect(page.getByText(/本人の答えは配信中に入力します/).first()).toBeVisible();
  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
  await expect(page.getByRole('heading', { name: '企画を保存しました' })).toBeVisible();
  await expect(page.locator('#managementUrl')).toHaveValue(/#host=[a-f0-9]+$/);
});

test('スタッフが秘密の所有確認URLを発行し、YouTuber本人が概要欄コードで確認できる', async ({ page }) => {
  const verificationId = 'a'.repeat(32);
  const accessToken = 'b'.repeat(48);
  let ownershipStatus = 'pending';
  let agreementAccepted = false;
  await page.route('**/api/live/youtube-candidates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/channel/UC1234567890_sample',
        profile: { channelId: 'UC1234567890_sample', channelName: '所有確認サンプル', channelUrl: 'https://www.youtube.com/channel/UC1234567890_sample', source: 'youtube-data-api-v3' },
        questionType: 'guess-person',
        questions: Array.from({ length: 30 }, (_, index) => ({
          id: `verify-${index}`, type: 'guess-person', text: `確認候補${index + 1}`,
          options: ['選択A', '選択B', '選択C', '選択D', '選択E'], selected: index === 0, recommended: index === 0,
        })),
      }),
    });
  });
  await page.route(/\/api\/live\/channel-verifications(?:\/.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const base = {
      verificationId, channelId: 'UC1234567890_sample', channelName: '所有確認サンプル',
      channelUrl: 'https://www.youtube.com/channel/UC1234567890_sample', confirmationCode: 'SBLV-ABCD-EF01',
      ownershipStatus, ownershipMethod: ownershipStatus === 'verified' ? 'description' : '',
      stripeIdentityVerified: false, stripeRelationshipStatus: 'pending', creatorAgreementAccepted: agreementAccepted,
      creatorAgreementTermsVersion: agreementAccepted ? '1.1' : '', canSellPaid: false, updatedAt: Date.now(),
    };
    if (url.pathname === '/api/live/channel-verifications' && request.method() === 'POST') {
      expect(request.headers()['x-live-creator-invite']).toBe(TEST_CREATOR_INVITE);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...base, accessToken }) });
    }
    expect(request.headers()['x-live-verification-token']).toBe(accessToken);
    if (url.pathname.endsWith('/agreement')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        expect(body).toMatchObject({ termsVersion: '1.1', contractingName: 'テスト株式会社', contactEmail: 'creator@example.com', confirmTerms: true, confirmAuthority: true, confirmPrivacy: true });
        agreementAccepted = true;
      }
      const agreement = agreementAccepted ? {
        agreementId: '11111111-2222-4333-8444-555555555555', termsVersion: '1.1',
        termsDocumentSha256: 'c'.repeat(64), contractingName: 'テスト株式会社',
        contactEmailMasked: 'cr•••••@example.com', acceptedAt: Date.now(), stripeAccountMasked: 'acct_••••r123',
      } : null;
      return route.fulfill({ status: request.method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify({
        terms: { version: '1.1', effectiveDate: '2026-07-23', url: 'https://www.streetboardgame.com/creator-terms', documentSha256: 'c'.repeat(64) },
        ownershipVerified: ownershipStatus === 'verified', stripeAccountRegistered: true,
        stripeAccountMasked: 'acct_••••r123', readyToAccept: ownershipStatus === 'verified', accepted: agreementAccepted, agreement,
      }) });
    }
    if (url.pathname.endsWith('/verify-description') && request.method() === 'POST') ownershipStatus = 'verified';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, ownershipStatus, ownershipMethod: ownershipStatus === 'verified' ? 'description' : '' }) });
  });

  await page.goto('/live');
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('[data-youtube-type="guess-person"]').click();
  await page.locator('#useCandidates').click();
  await expect(page.getByText('動画内容の取込・有料販売の本人確認（任意）')).toBeVisible();
  await page.locator('#createChannelVerification').click();
  const verificationUrl = await page.locator('#channelVerificationUrl').inputValue();
  expect(verificationUrl).toContain(`/live?verify=${verificationId}#verification=${accessToken}`);
  await expect(page.getByText('無料LIVEはこのまま利用できます。')).toBeVisible();

  await page.goto(verificationUrl);
  await expect(page).toHaveURL(`/live?verify=${verificationId}`);
  await expect(page.getByRole('heading', { name: 'YouTubeチャンネル所有者確認' })).toBeVisible();
  await expect(page.getByText('SBLV-ABCD-EF01')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Googleでチャンネル所有を確認・字幕を取り込む' })).toBeVisible();
  await page.getByRole('button', { name: '概要欄に掲載したコードを確認' }).click();
  await expect(page.getByText('所有確認済み')).toBeVisible();
  await expect(page.getByRole('heading', { name: '収益分配契約へ同意する' })).toBeVisible();
  for (const legalLink of ['収益分配規約の全文を読む', 'プライバシーポリシーを読む', 'コンテンツ・肖像権ガイドラインを読む', '未成年者利用規定を読む']) {
    await expect(page.getByRole('link', { name: legalLink, exact: true })).toBeVisible();
  }
  await page.locator('#agreementContractingName').fill('テスト株式会社');
  await page.locator('#agreementContactEmail').fill('creator@example.com');
  await page.locator('#confirmCreatorTerms').check();
  await page.locator('#confirmCreatorAuthority').check();
  await page.locator('#confirmCreatorPrivacy').check();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '同意して契約を申し込む' }).click();
  await expect(page.getByRole('heading', { name: '収益分配契約の申込みを受け付けました' })).toBeVisible();
  await expect(page.getByText('11111111-2222-4333-8444-555555555555')).toBeVisible();
  await expect(page.getByText('無料LIVEはこのまま利用できます。有料機能は4段階すべての確認後に有効になります。')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('YouTubeの視聴者1位モードを選ぶと30問すべてを同じタイプに固定する', async ({ page }) => {
  await page.goto('/live');
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.questionType).toBe('guess-majority');
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `majority-${index}`,
      type: 'guess-majority',
      text: `視聴者1位候補${index + 1}`,
      options: ['選択A', '選択B', '選択C', '選択D', '選択E'],
      selected: true,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'サンプルチャンネル', source: 'youtube-public-page' },
        questionType: body.questionType,
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('[data-youtube-type="guess-majority"]').click();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
  await expect(page.getByText('選択中：みんなの1位を当てる（30問）')).toBeVisible();
  await expect(page.locator('[data-candidate-index] .badge')).toHaveCount(30);
  await expect(page.locator('[data-candidate-index] .badge').first()).toHaveText('みんなの1位を当てる');
  await expect(page.locator('#useCandidates')).toContainText('選んだ30問を編集する');
  await page.locator('#useCandidates').click();
  await expect(page.locator('[data-question-index]')).toHaveCount(30);
  await expect(page.locator('[data-field="question-type"]:not(:disabled)')).toHaveCount(0);
  expect(await page.locator('[data-field="question-type"]').evaluateAll((selects) => selects.every((select) => select.value === 'guess-majority'))).toBe(true);
  await expect(page.locator('[data-editor-option]')).toHaveCount(150);
  await expect(page.locator('#addQuestion')).toHaveCount(0);
});

test('動画URLを入力すると投稿元チャンネルを使った30問を表示する', async ({ page }) => {
  const videoUrl = 'https://www.youtube.com/watch?v=HTRGCp7sDpl';
  await page.goto('/live');
  await expect(page.getByLabel('YouTubeチャンネル・動画URL')).toBeVisible();
  await expect(page.getByText(/通常動画・短縮URL・Shorts・ライブのURLにも対応/)).toBeVisible();
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.channelUrl).toBe(videoUrl);
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `video-source-${index}`,
      type: 'guess-person',
      text: `内輪向け候補${index + 1}`,
      options: ['夏合宿', '幼なじみ王', '罰ゲーム旅行', '未公開トーク', '料理対決'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/channel/UC1234567890_sample',
        profile: {
          channelName: 'わたちゃんず',
          inputKind: 'video',
          source: 'youtube-video-and-channel',
          videoTitles: Array.from({ length: 15 }, (_, index) => `公開動画${index + 1}`),
          videoDescriptionCount: 15,
          contentSourceCount: 3,
          contentGrounding: 'owner-authorized-captions',
        },
        questionType: 'guess-person',
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill(videoUrl);
  await page.locator('[data-youtube-type="guess-person"]').click();
  await expect(page.getByRole('heading', { name: 'わたちゃんず' })).toBeVisible();
  await expect(page.getByText(/動画URLから投稿元の「わたちゃんず」を特定/)).toBeVisible();
  await expect(page.getByText(/動画の中身を反映済み/)).toBeVisible();
  await expect(page.getByText(/公開動画 3本の字幕から、実際の発言・場面/)).toBeVisible();
  await expect(page.locator('[data-candidate-index]')).toHaveCount(30);
});

test('5問を同時回答した後、一問ずつ答え合わせして個人結果を表示する', async ({ browser, page, request }, testInfo) => {
  await page.goto('/live');
  await page.route('**/api/live/youtube-candidates', async (route) => {
    const questions = Array.from({ length: 30 }, (_, index) => ({
      id: `flow-${index}`,
      type: 'guess-person',
      text: index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`,
      options: ['ピンク', 'ブルー', '黄色', '緑', '白'],
      selected: index < 5,
      recommended: index < 5,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channelUrl: 'https://www.youtube.com/@sample',
        profile: { channelName: 'わたちゃん', source: 'youtube-public-page' },
        questionType: 'guess-person',
        questions,
      }),
    });
  });
  await page.locator('#channelUrl').fill('https://www.youtube.com/@sample');
  await page.locator('[data-youtube-type="guess-person"]').click();
  await page.locator('#useCandidates').click();
  await expect(page.locator('[data-question-index]')).toHaveCount(5);
  await selectLiveSchedule(page, testInfo, 2);
  await page.locator('#creatorImage').setInputFiles({
    name: 'creator.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAf2uS0sAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('.creator-image-preview img')).toBeVisible();
  await page.locator('#showLiveVoteCounts').check();
  await page.locator('#createGame').click();
  await expect(page.getByText('HOST LOBBY')).toBeVisible();
  await expect(page.getByText(`視聴者上限 ${LIVE_FALLBACK_VIEWER_LIMIT}人`)).toBeVisible();
  const roomCode = await page.locator('.room-code').first().textContent();
  expect(roomCode).toMatch(/^\d{6}$/);
  const subjectUrl = await page.locator('#subjectUrl').inputValue();
  expect(subjectUrl).toMatch(new RegExp(`/live\\?room=${roomCode}#subject=[a-f0-9]+$`));

  const publicBefore = await request.get(`/api/live/games/${roomCode}`);
  const publicBeforeText = await publicBefore.text();
  expect(publicBeforeText).not.toContain('lockedIndex');
  expect(publicBeforeText).not.toContain('subjectAnswerIndex');
  expect(publicBeforeText).not.toContain('hostToken');
  expect(publicBeforeText).not.toContain('subjectToken');
  expect(publicBeforeText).not.toContain('creatorImageDataUrl');

  const subjectContext = await browser.newContext();
  const subject = await subjectContext.newPage();
  await subject.goto(subjectUrl);
  await expect(subject.getByRole('heading', { name: 'YouTuber本人専用画面' })).toBeVisible();

  const participantContext = await browser.newContext(
    testInfo.project.name === 'mobile-chrome' ? devices['Pixel 7'] : {}
  );
  const participant = await participantContext.newPage();
  await participant.goto(`/live?room=${roomCode}`);
  await participant.locator('#participantName').fill('参加者A');
  await participant.locator('#joinGame').click();
  await expect(participant.getByText(/司会者が開始/)).toBeVisible();
  await expect(page.getByText('参加者A')).toBeVisible();

  await page.locator('#startLive').click();
  await expect(subject.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(participant.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(participant.getByText('YouTuberと同時に回答してください。')).toBeVisible();

  for (let index = 0; index < 5; index += 1) {
    const questionText = index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`;
    await expect(page.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(subject.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(participant.getByRole('heading', { name: questionText })).toBeVisible();
    await expect(page.locator('#advanceQuestion')).toBeDisabled();
    await expect(page.locator('[data-host-answer-index]')).toHaveCount(0);
    if (index === 0) {
      const forbiddenAnswer = await request.post(`/api/live/games/${roomCode}/subject-answer`, {
        data: { questionId: 'flow-0', optionIndex: 0 },
      });
      expect(forbiddenAnswer.status()).toBe(403);
    }
    await subject.locator('[data-subject-answer-index="0"]').click();
    await subject.locator('#confirmSubjectAnswer').click();
    await expect(subject.getByText('秘密回答を確定しました')).toBeVisible();
    await expect(page.locator('.personal-result').getByText('回答済み')).toBeVisible();
    await expect(page.locator('#advanceQuestion')).toBeEnabled();
    await participant.locator('[data-vote-index="0"]').click();
    await expect(participant.getByText(/回答しました/)).toBeVisible();
    if (index === 0) {
      await expect(participant.getByText('選択肢別の現在票数を表示しています。')).toBeVisible();
      await expect(participant.locator('.live-vote-count').first()).toHaveText('1票');
      await expect(participant.locator('.live-vote-count').nth(1)).toHaveText('0票');
      const publicVoting = await request.get(`/api/live/games/${roomCode}`);
      const publicVotingJson = await publicVoting.json();
      expect(JSON.stringify(publicVotingJson)).not.toContain('lockedIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('subjectAnswerIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('myAnswerIndex');
      expect(JSON.stringify(publicVotingJson)).not.toContain('subjectToken');
      expect(publicVotingJson.game.question.result).toBeNull();
      expect(publicVotingJson.game.question.voteCount).toBe(1);
      expect(publicVotingJson.game.question.voteCounts).toEqual([1, 0, 0, 0, 0]);
      expect(publicVotingJson.game.results).toEqual([]);
    }
    await page.locator('#advanceQuestion').click();
  }

  await expect(page.getByText('ANSWER CHECK')).toBeVisible();
  await expect(page.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
  await expect(page.getByText('わたちゃんの答え：ピンク')).toHaveCount(0);
  await expect(participant.getByText('わたちゃんの答え：ピンク')).toHaveCount(0);
  const publicReviewQuestion = await request.get(`/api/live/games/${roomCode}`);
  const publicReviewQuestionJson = await publicReviewQuestion.json();
  expect(publicReviewQuestionJson.game.question.result).toBeNull();
  expect(publicReviewQuestionJson.game.results).toEqual([]);

  for (let index = 0; index < 5; index += 1) {
    const questionText = index === 0 ? '本人が選んだ色は？' : `候補問題${index + 1}`;
    await expect(page.getByRole('heading', { name: questionText })).toBeVisible();
    await page.locator('#revealAnswer').click();
    await expect(page.getByText('わたちゃんの答え：ピンク')).toBeVisible();
    await expect(participant.getByText('あなたの回答：ピンク')).toBeVisible();
    await expect(participant.locator('.personal-result').getByText('正解！')).toBeVisible();
    await expect(page.getByText('みんなの予想は当たり！')).toBeVisible();
    if (index === 0) {
      await expect(page.locator('#previousQuestion')).toHaveCount(0);
    }
    if (index === 1) {
      const previousButton = page.locator('#previousQuestion');
      const nextButton = page.locator('#nextQuestion');
      await expect(previousButton).toHaveText('前に戻る');
      const [previousBox, nextBox] = await Promise.all([previousButton.boundingBox(), nextButton.boundingBox()]);
      expect(previousBox).not.toBeNull();
      expect(nextBox).not.toBeNull();
      expect(previousBox.x + previousBox.width).toBeLessThanOrEqual(nextBox.x);
      expect(Math.abs((previousBox.y + previousBox.height / 2) - (nextBox.y + nextBox.height / 2))).toBeLessThanOrEqual(1);
      await previousButton.click();
      await expect(page.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
      await expect(participant.getByRole('heading', { name: '本人が選んだ色は？' })).toBeVisible();
      await expect(page.locator('#previousQuestion')).toHaveCount(0);
      await page.locator('#nextQuestion').click();
      await expect(page.getByRole('heading', { name: '候補問題2' })).toBeVisible();
      await expect(participant.getByRole('heading', { name: '候補問題2' })).toBeVisible();
      await expect(page.getByText('わたちゃんの答え：ピンク')).toBeVisible();
    }
    await page.locator('#nextQuestion').click();
  }

  await expect(page.getByRole('heading', { name: '最終結果' })).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(5);
  await expect(page.getByTestId('amazon-product-card')).toHaveAttribute('href', 'https://www.amazon.co.jp/dp/B0G87M4ZYK');
  await expect(participant.getByRole('heading', { name: 'あなたの最終結果' })).toBeVisible();
  await expect(participant.getByText('5 / 5問正解')).toBeVisible();
  await expect(participant.locator('.result-card')).toHaveCount(5);
  await expect(participant.getByRole('heading', { name: 'サービス申込み前の結果画像プレビュー' })).toBeVisible();
  await expect(participant.locator('#resultViewerName')).toHaveValue('参加者A');
  await expect(participant.locator('#liveResultPreview')).toBeVisible();
  await expect(participant.locator('#liveResultPreview')).toHaveAttribute('src', /^blob:/);
  expect(await participant.locator('#liveResultPreview').evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight }))).toEqual({ width: 540, height: 675 });
  await participant.locator('#resultViewerName').fill('視聴者テスト');
  await expect(participant.locator('#liveResultPreview')).toHaveAttribute('data-viewer-name', '視聴者テスト');
  await expect(participant.getByRole('button', { name: 'Xで結果をツイート' })).toBeVisible();
  await expect(participant.getByRole('button', { name: 'LINEで結果を送る' })).toBeVisible();
  await expect(participant.getByRole('button', { name: '結果画像を保存／送る' })).toBeVisible();
  const participantProductCard = participant.getByTestId('amazon-product-card');
  await expect(participantProductCard).toBeVisible();
  await expect(participantProductCard).toHaveAttribute('href', 'https://www.amazon.co.jp/dp/B0G87M4ZYK');
  await expect(participantProductCard).toHaveAttribute('target', '_blank');
  await expect(participantProductCard).toHaveAttribute('rel', /sponsored/);
  await expect(participantProductCard).toContainText('Amazonアフィリエイトを利用しています');
  if (testInfo.project.name === 'mobile-chrome') {
    await participant.evaluate(() => {
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
    await participant.getByRole('button', { name: '結果画像を保存／送る' }).click();
    await expect.poll(() => participant.evaluate(() => window.__sharedResultImage)).toMatchObject({
      files: [{
        name: 'watachan-live-result-5-5.svg',
        type: 'image/svg+xml',
      }],
    });
    expect(await participant.evaluate(() => window.__sharedResultImage.files[0].size)).toBeGreaterThan(1_000);
    await expect(participant.locator('#resultShareStatus')).toHaveText('共有・保存画面を開きました。');
  } else {
    await participant.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    const [download] = await Promise.all([
      participant.waitForEvent('download'),
      participant.getByRole('button', { name: '結果画像を保存／送る' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('watachan-live-result-5-5.svg');
    expect((await stat(await download.path())).size).toBeGreaterThan(1_000);
    await expect(participant.locator('#resultShareStatus')).toHaveText('結果画像を保存しました。');
  }
  if (testInfo.project.name === 'desktop-chrome') {
    await participant.evaluate(() => {
      window.__liveResultShareUrl = '';
      window.open = (url) => { window.__liveResultShareUrl = String(url); return null; };
    });
    await participant.getByRole('button', { name: 'Xで結果をツイート' }).click();
    const xShareUrl = await participant.evaluate(() => window.__liveResultShareUrl);
    expect(xShareUrl).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
    expect(new URL(xShareUrl).searchParams.get('text')).toContain('視聴者テストは5/5問正解でした');
    expect(new URL(xShareUrl).searchParams.get('text')).toContain(`${new URL(participant.url()).origin}/live`);
    await participant.route('https://line.me/**', (route) => route.fulfill({ status: 200, body: 'LINE share test' }));
    await Promise.all([
      participant.waitForURL(/^https:\/\/line\.me\/R\/msg\/text\//),
      participant.getByRole('button', { name: 'LINEで結果を送る' }).click(),
    ]);
    expect(decodeURIComponent(new URL(participant.url()).search.slice(1))).toContain('視聴者テストは5/5問正解でした');
  }
  await expect(subject.getByRole('heading', { name: '最終結果' })).toBeVisible();
  await expect(subject.locator('.result-card')).toHaveCount(5);
  await expect(subject.getByTestId('amazon-product-card')).toHaveAttribute('href', 'https://www.amazon.co.jp/dp/B0G87M4ZYK');
  await subjectContext.close();
  await participantContext.close();
});

test('予約日時の前後20時間は別のLIVE予約をAPIでも拒否する', async ({ request }, testInfo) => {
  const scheduledAt = new Date(scheduleForTest(testInfo, 10)).getTime();
  const draft = {
    creationMode: 'youtube',
    title: '予約競合テスト',
    subjectName: '本人',
    channelName: '予約テストチャンネル',
    scheduledAt,
    questions: [{ id: 'reservation-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
  };
  const first = await request.post('/api/live/games', { headers: creatorHeaders(), data: { draft } });
  expect(first.status()).toBe(201);

  const conflict = await request.post('/api/live/games', {
    headers: creatorHeaders(),
    data: { draft: { ...draft, title: '競合する予約', scheduledAt: scheduledAt + 60 * 60 * 1000 } },
  });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toEqual({ error: 'live-slot-unavailable' });

  const availability = await request.get(`/api/live/reservations/availability?scheduledAt=${scheduledAt + 2 * 60 * 60 * 1000}`);
  expect(availability.status()).toBe(200);
  expect(await availability.json()).toMatchObject({ available: false, viewerLimit: LIVE_FALLBACK_VIEWER_LIMIT, bufferHours: 20 });
});

test('スタッフ用URLから予約日時変更・URL再発行・キャンセルを完了できる', async ({ page, request }, testInfo) => {
  const originalScheduledAt = new Date(scheduleForTest(testInfo, 70)).getTime();
  const changedScheduleValue = scheduleForTest(testInfo, 75);
  const changedScheduledAt = new Date(changedScheduleValue).getTime();
  const createdResponse = await request.post('/api/live/games', {
    headers: creatorHeaders(),
    data: {
      draft: {
        creationMode: 'youtube', title: '予約セルフサービステスト', subjectName: '本人', channelName: '予約管理チャンネル',
        scheduledAt: originalScheduledAt,
        questions: [{ id: 'reservation-manage-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
      },
    },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  const oldHostToken = created.hostToken;
  const oldSubjectToken = created.game.subjectToken;

  await page.goto(`/live?room=${created.code}#host=${oldHostToken}`);
  await expect(page).toHaveURL(`/live?room=${created.code}`);
  await expect(page.getByRole('heading', { name: '予約を変更・キャンセル' })).toBeVisible();
  await expect(page.getByText(`クローズドβ中は変更後も予約時刻の前後${LIVE_RESERVATION_BUFFER_HOURS}時間を確保します。`)).toBeVisible();
  await page.locator('#reservationScheduledAt').fill(changedScheduleValue);
  await page.locator('#checkReschedule').click();
  await expect(page.getByText('この日時へ変更できます。確定するまでは現在の予約枠を保持します。')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#confirmReschedule').click();
  await expect(page.getByText(/予約日時を.+へ変更しました。/)).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#rotateSubjectUrl').click();
  await expect(page.locator('#subjectUrl')).not.toHaveValue(new RegExp(`${oldSubjectToken}$`));
  const oldSubjectAccess = await request.get(`/api/live/games/${created.code}`, {
    headers: { 'x-live-subject-token': oldSubjectToken },
  });
  expect((await oldSubjectAccess.json()).game.subject).toBe(false);

  page.once('dialog', (dialog) => dialog.accept());
  const managementUrl = page.locator('#managementUrl');
  const oldHostUrl = await managementUrl.inputValue();
  await page.locator('#rotateHostUrl').click();
  await expect(managementUrl).not.toHaveValue(oldHostUrl);
  await expect(page.getByText('スタッフ用URLを再発行しました。表示された新URLをコピーして、安全な方法で共有してください。')).toBeVisible();
  const newHostUrl = await managementUrl.inputValue();
  expect(newHostUrl).toMatch(new RegExp(`/live\\?room=${created.code}#host=[a-f0-9]{48}$`));
  expect(newHostUrl).not.toContain(oldHostToken);
  const oldHostAccess = await request.get(`/api/live/games/${created.code}`, {
    headers: creatorHeaders({ 'x-live-host-token': oldHostToken }),
  });
  expect((await oldHostAccess.json()).game.host).toBe(false);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#cancelReservation').click();
  await expect(page.getByRole('heading', { name: 'このLIVE予約はキャンセルされました' })).toBeVisible();
  const publicGame = await request.get(`/api/live/games/${created.code}`);
  expect((await publicGame.json()).game.phase).toBe('cancelled');
  const join = await request.post(`/api/live/games/${created.code}/join`, { data: { name: '視聴者' } });
  expect(join.status()).toBe(410);
  expect(await join.json()).toEqual({ error: 'game-cancelled' });
  expect(changedScheduledAt).toBeGreaterThan(originalScheduledAt);
});

test('漏えいしたスタッフURLだけでは操作できず、別経路の招待コードを要求する', async ({ browser, request }, testInfo) => {
  const createdResponse = await request.post('/api/live/games', {
    headers: creatorHeaders(),
    data: { draft: {
      creationMode: 'youtube', title: 'スタッフ二要素テスト', subjectName: '本人', channelName: '認証チャンネル',
      scheduledAt: new Date(scheduleForTest(testInfo, 85)).getTime(),
      questions: [{ id: 'staff-auth-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
    } },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  const isolated = await browser.newContext();
  const staffPage = await isolated.newPage();
  await staffPage.goto(`/live?room=${created.code}#host=${created.hostToken}`);
  await expect(staffPage.getByRole('heading', { name: 'スタッフ端末を確認' })).toBeVisible();
  await expect(staffPage.getByText('スタッフ用URLだけでは企画を操作できません。')).toBeVisible();
  await staffPage.locator('#staffCreatorInvite').fill(TEST_CREATOR_INVITE);
  await staffPage.locator('#confirmStaffInvite').click();
  await expect(staffPage.getByText('HOST LOBBY')).toBeVisible();
  await isolated.close();
});

test('別のLIVEが進行中は開始を拒否し、完了後に全体ロックを解放する', async ({ request }, testInfo) => {
  const createGame = async (slot, title, questionId) => {
    const response = await request.post('/api/live/games', {
      headers: creatorHeaders(),
      data: {
        draft: {
          creationMode: 'youtube', title, subjectName: '本人', channelName: `${title}チャンネル`,
          scheduledAt: new Date(scheduleForTest(testInfo, slot)).getTime(),
          questions: [{ id: questionId, type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
        },
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const first = await createGame(30, '進行ロック1', 'active-q-1');
  const second = await createGame(31, '進行ロック2', 'active-q-2');
  const hostHeaders = (token) => creatorHeaders({ 'x-live-host-token': token });

  expect((await request.post(`/api/live/games/${first.code}/start`, { headers: hostHeaders(first.hostToken), data: {} })).status()).toBe(200);
  const blocked = await request.post(`/api/live/games/${second.code}/start`, { headers: hostHeaders(second.hostToken), data: {} });
  expect(blocked.status()).toBe(409);
  expect(await blocked.json()).toEqual({ error: 'another-live-active' });

  expect((await request.post(`/api/live/games/${first.code}/subject-answer`, {
    headers: { 'x-live-subject-token': first.game.subjectToken },
    data: { questionId: 'active-q-1', optionIndex: 0 },
  })).status()).toBe(200);
  for (const action of ['advance', 'reveal', 'next']) {
    expect((await request.post(`/api/live/games/${first.code}/${action}`, { headers: hostHeaders(first.hostToken), data: {} })).status()).toBe(200);
  }
  expect((await request.post(`/api/live/games/${second.code}/start`, { headers: hostHeaders(second.hostToken), data: {} })).status()).toBe(200);
  expect((await request.post(`/api/live/games/${second.code}/subject-answer`, {
    headers: { 'x-live-subject-token': second.game.subjectToken },
    data: { questionId: 'active-q-2', optionIndex: 0 },
  })).status()).toBe(200);
  for (const action of ['advance', 'reveal', 'next']) {
    expect((await request.post(`/api/live/games/${second.code}/${action}`, { headers: hostHeaders(second.hostToken), data: {} })).status()).toBe(200);
  }
});

test('安全運用上限を超える視聴者は参加APIで拒否する', async ({ request }, testInfo) => {
  const scheduledAt = new Date(scheduleForTest(testInfo, 20)).getTime();
  const created = await request.post('/api/live/games', {
    headers: creatorHeaders(),
    data: {
      draft: {
        creationMode: 'youtube', title: '人数上限テスト', subjectName: '本人', channelName: '上限テストチャンネル', scheduledAt,
        questions: [{ id: 'capacity-q', type: 'guess-person', text: 'どれ？', options: ['A', 'B', 'C', 'D', 'E'] }],
      },
    },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();
  for (let index = 0; index < LIVE_FALLBACK_VIEWER_LIMIT; index += 1) {
    const joined = await request.post(`/api/live/games/${code}/join`, { data: { name: `参加者${index + 1}` } });
    expect(joined.status(), `参加者${index + 1}`).toBe(201);
  }
  const rejected = await request.post(`/api/live/games/${code}/join`, { data: { name: '参加者51' } });
  expect(rejected.status()).toBe(409);
  expect(await rejected.json()).toEqual({ error: 'participant-limit-reached' });
});

test('トップの家族とLIVEの間にボドゲ仲間ボタンを置き、紹介カードから説明ページへ移動できる', async ({ page }) => {
  await page.goto('/');
  const familyButton = page.getByRole('button', { name: '家族の絆を判定する' });
  const boardgameButton = page.getByRole('button', { name: 'ボドゲ仲間の絆を判定する' });
  const playLink = page.getByRole('link', { name: 'Youtuberと視聴者の絆を判定する', exact: true });
  await expect(playLink).toHaveAttribute('href', '/live');
  const familyBox = await familyButton.boundingBox();
  const boardgameBox = await boardgameButton.boundingBox();
  const playBox = await playLink.boundingBox();
  expect(familyBox).not.toBeNull();
  expect(boardgameBox).not.toBeNull();
  expect(playBox).not.toBeNull();
  expect(boardgameBox.y).toBeGreaterThanOrEqual(familyBox.y + familyBox.height);
  expect(playBox.y).toBeGreaterThanOrEqual(boardgameBox.y + boardgameBox.height);

  await boardgameButton.click();
  await expect(page.getByRole('heading', { name: 'ボドゲ仲間の絆チェック' })).toBeVisible();
  await expect(page.getByText('ボドゲ仲間の絆判定は、本人が選んだ答えをボドゲ仲間が予想して、どれだけ分かっているかをチェックするゲームです。5問中何問正解したかで、ボドゲ仲間のことをどれだけ理解しているか診断します。', { exact: true })).toBeVisible();
  await expect(page.getByText('スマホを順番に渡すだけなので、ボドゲ会のインストに最適です。', { exact: true })).toBeVisible();

  await page.goto('/');
  const guideLink = page.getByRole('link', { name: /Youtuberと視聴者の絆判定/ });
  await expect(guideLink).toHaveAttribute('href', '/live-guide');
  await guideLink.click();
  await expect(page).toHaveURL('/live-guide');
  await expect(page.getByRole('heading', { name: 'YouTuberと視聴者の絆を判定する、私のことちゃんとわかってるよね?Youtubeライブver.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'YouTubeライブの企画ネタが、チャンネルURLだけで作れる' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Youtuberと視聴者の絆を判定する' })).toHaveAttribute('href', '/live');

  await page.goto('/');
  await page.getByRole('link', { name: 'Youtuberと視聴者の絆を判定する', exact: true }).click();
  await expect(page).toHaveURL('/live');
  await expect(page.getByRole('heading', { name: 'YouTuberと視聴者の絆を判定する、私のことちゃんとわかってるよね?Youtubeライブver.' })).toBeVisible();
});

test('末尾スラッシュを参加コード付きの正規URLへ転送する', async ({ request }) => {
  const response = await request.get('/live/?room=123456', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('http://127.0.0.1:4173/live?room=123456');
});
