import { test, expect } from '@playwright/test';

async function mockAdminLogin(page) {
  await page.route('**/api/live/admin/session', async (route) => {
    expect(route.request().headers()['x-live-admin-token']).toHaveLength(32);
    expect(route.request().headers()['x-live-admin-otp']).toBe('123456');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionToken: 'test-admin-session', expiresAt: Date.now() + 15 * 60 * 1000 }),
    });
  });
}

test('LIVE運営コンソールで監視・予約・購入対応を確認できる', async ({ page }) => {
  const refundBodies = [];
  const payoutCloses = [];
  const payoutTransfers = [];
  const overview = {
    generatedAt: Date.now(),
    status: { mode: 'degraded', title: '接続遅延', message: '復旧対応中です。' },
    reservations: [{ code: '123456', title: 'テストLIVE', channelName: 'テスト', phase: 'lobby', scheduledAt: Date.now() + 3_600_000, participantLimit: 50, creatorImageModerationStatus: 'pending' }],
    activeSessions: [],
    entitlements: [{ purchase_id: 'purchase_test_01', code: '123456', participant_id: 'p1', participant_name: '参加者', stripe_payment_intent_id: 'pi_test_01', status: 'active', purchased_at: Date.now(), available_until: Date.now() + 86_400_000, updated_at: Date.now() }],
    checkouts: [{ order_id: 'ord_test_01', product_type: 'result_image', code: '123456', participant_name: '参加者', amount: 1000, currency: 'jpy', creator_amount: 700, platform_amount: 300, purchase_id: 'purchase_test_01', stripe_payment_intent_id: 'pi_test_01', stripe_refund_id: '', status: 'paid', created_at: Date.now(), updated_at: Date.now() }],
    revenue: {
      policy: { creatorSharePercent: 70, holdDays: 14, payoutThreshold: 5000, defaultPeriod: '2026-06' },
      balances: [{ stripe_account_id: 'acct_creator123', channel_verification_id: 'a'.repeat(32), currency: 'jpy', holding_amount: 700, available_amount: 5600, offset_amount: 0, review_amount: 0, transferred_amount: 0, entry_count: 9, payable_amount: 5600, payout_eligible: true }],
      batches: [{ batch_id: `payout_${'b'.repeat(32)}`, period_key: '2026-06', stripe_account_id: 'acct_creator123', currency: 'jpy', gross_sales_amount: 8000, creator_sales_amount: 5600, offset_amount: 0, transfer_amount: 5600, order_count: 8, status: 'draft', stripe_transfer_id: '', failure_code: '', created_at: Date.now(), updated_at: Date.now() }],
      ledger: [{ revenue_entry_id: 'rev_test_01', order_id: 'ord_test_01', stripe_account_id: 'acct_creator123', currency: 'jpy', gross_amount: 1000, creator_amount: 700, platform_amount: 300, stripe_fee_amount: 36, platform_net_amount: 264, status: 'available', paid_at: Date.now(), available_at: Date.now(), updated_at: Date.now() }],
    },
    events: [{ event_id: '11111111-1111-4111-8111-111111111111', category: 'stripe', severity: 'critical', event_type: 'payment_intent.payment_failed', code: '123456', purchase_id: '', external_id: 'pi_test_01', message: 'カード決済失敗', metadata: {}, created_at: Date.now(), acknowledged_at: null, acknowledged_by: '' }],
    recentEventCounts: [{ category: 'stripe', severity: 'critical', event_count: 1 }],
    realtime: [],
    creatorInvites: [{ invite_id: '11111111-2222-4333-8444-555555555555', channel_id: 'UC1234567890', channel_name: '審査済みチャンネル', status: 'active', expires_at: Date.now() + 86_400_000, last_used_at: null }],
    channelVerifications: [{ verificationId: 'a'.repeat(32), channelId: 'UC1234567890', channelName: '所有確認チャンネル', channelUrl: 'https://www.youtube.com/channel/UC1234567890', ownershipStatus: 'manual_pending', ownershipMethod: 'manual', stripeAccountId: '', stripeIdentityVerified: false, stripeRelationshipStatus: 'pending', creatorAgreementAccepted: false, canSellPaid: false, updatedAt: Date.now() }],
    infrastructure: { d1Configured: true, durableObjectsConfigured: true, privateR2Configured: true, imagesBindingConfigured: true, alertWebhookConfigured: true, stripeWebhookConfigured: true },
  };
  await mockAdminLogin(page);
  await page.route('**/api/live/admin/overview', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) }));
  await page.route('**/api/live/admin/checkouts/ord_test_01/refund', async (route) => {
    refundBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orderId: 'ord_test_01', status: 'refund_pending' }) });
  });
  await page.route('**/api/live/admin/revenue/monthly-close', async (route) => {
    payoutCloses.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ period: { key: '2026-06' }, created: [], skipped: [] }) });
  });
  await page.route(`**/api/live/admin/revenue/payouts/payout_${'b'.repeat(32)}/transfer`, async (route) => {
    payoutTransfers.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'transferred', transferId: 'tr_test01' }) });
  });
  const response = await page.goto('/live-ops');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
  await expect(page).toHaveTitle('LIVE運営コンソール | Streetboardgame');
  await page.locator('#adminToken').fill('x'.repeat(32));
  await page.locator('#adminOtp').fill('123456');
  await page.locator('#loadOps').click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.locator('#sessions')).toContainText('テストLIVE');
  await expect(page.locator('#entitlements')).toContainText('purchase_test_01');
  await expect(page.locator('#checkouts')).toContainText('ord_test_01');
  await expect(page.locator('#checkouts')).toContainText('YouTuber分配予定: 700円');
  await expect(page.getByRole('heading', { name: '70%分配・売上台帳' })).toBeVisible();
  await expect(page.locator('#revenueBalances')).toContainText('送金可能: 5,600円');
  await expect(page.locator('#revenueLedger')).toContainText('Stripe実手数料: 36円');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '月次分配台帳を作成' }).click();
  await expect.poll(() => payoutCloses.length).toBe(1);
  expect(payoutCloses[0]).toEqual({ periodKey: '2026-06' });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Stripe Connectへ送金' }).click();
  await expect.poll(() => payoutTransfers.length).toBe(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '権限停止・返金待ち' }).click();
  await expect.poll(() => refundBodies.length).toBe(1);
  expect(refundBodies[0]).toEqual({ execute: false });
  await expect(page.locator('#events')).toContainText('カード決済失敗');
  await expect(page.locator('#metrics')).toContainText('WebSocket予期せぬ切断率');
  await expect(page.locator('#metrics')).toContainText('非公開R2 / Images');
  await expect(page.getByRole('heading', { name: 'YouTuber招待・手動審査' })).toBeVisible();
  await expect(page.locator('#creatorInvites')).toContainText('審査済みチャンネル');
  await expect(page.getByRole('heading', { name: 'チャンネル所有・契約・Stripe名義確認' })).toBeVisible();
  await expect(page.locator('#channelVerifications')).toContainText('所有確認チャンネル');
  await expect(page.locator('[data-review-field="stripeAccountId"]')).toHaveAttribute('placeholder', 'acct_...');
  await expect(page.getByRole('button', { name: '画像を承認' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow,noarchive');
});

test('障害告知を運営コンソールから更新できる', async ({ page }) => {
  const statusBodies = [];
  const base = { generatedAt: Date.now(), status: { mode: 'normal', title: '', message: '' }, reservations: [], activeSessions: [], entitlements: [], checkouts: [], revenue: { policy: {}, balances: [], batches: [], ledger: [] }, events: [], recentEventCounts: [], realtime: [], creatorInvites: [], channelVerifications: [], infrastructure: {} };
  await mockAdminLogin(page);
  await page.route('**/api/live/admin/overview', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base) }));
  await page.route('**/api/live/admin/status', async (route) => {
    statusBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: statusBodies.at(-1) }) });
  });
  await page.goto('/live-ops');
  await page.locator('#adminToken').fill('x'.repeat(32));
  await page.locator('#adminOtp').fill('123456');
  await page.locator('#loadOps').click();
  await page.locator('#statusMode').selectOption('maintenance');
  await page.locator('#statusTitle').fill('緊急メンテナンス');
  await page.locator('#statusMessage').fill('新規参加を停止しています。');
  await page.locator('#saveStatus').click();
  await expect.poll(() => statusBodies.length).toBe(1);
  expect(statusBodies[0]).toEqual({ mode: 'maintenance', title: '緊急メンテナンス', message: '新規参加を停止しています。' });
});
