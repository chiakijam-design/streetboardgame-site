import test from 'node:test';
import assert from 'node:assert/strict';

import { handleLiveApi } from '../../src/live/api.js';
import {
  createLiveCheckoutSession,
  createLiveCreatorTransfer,
  createLiveStripeRefund,
  retrieveLiveStripeBalanceTransaction,
  retrieveLiveStripeCharge,
} from '../../src/live/stripe.js';

test('CheckoutはJPY税込・カード限定・注文メタデータ・冪等キーをStripeへ送る', async () => {
  let captured;
  const env = stripeEnv(async (url, options) => {
    captured = { url, options, params: new URLSearchParams(options.body) };
    return Response.json({ id: 'cs_test_checkout01', url: 'https://checkout.stripe.com/c/pay/test', expires_at: 1_800_001_800 });
  });
  const session = await createLiveCheckoutSession(env, {
    requestUrl: 'https://www.streetboardgame.com/api/live/games/123456/checkout',
    orderId: 'ord_test01', productType: 'result_image', code: '123456', amount: 1000,
    productName: 'テストチャンネル LIVE高画質結果画像',
  }, 1_800_000_000_000);
  assert.equal(session.id, 'cs_test_checkout01');
  assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(captured.options.headers['idempotency-key'], 'checkout-ord_test01');
  assert.equal(captured.params.get('payment_method_types[0]'), 'card');
  assert.equal(captured.params.get('line_items[0][price_data][currency]'), 'jpy');
  assert.equal(captured.params.get('line_items[0][price_data][unit_amount]'), '1000');
  assert.equal(captured.params.get('line_items[0][price_data][tax_behavior]'), 'inclusive');
  assert.equal(captured.params.get('metadata[live_order_id]'), 'ord_test01');
  assert.equal(captured.params.get('payment_intent_data[transfer_group]'), 'ord_test01');
  assert.equal(captured.params.has('payment_intent_data[transfer_data][destination]'), false);
  assert.match(captured.params.get('success_url'), /session_id=\{CHECKOUT_SESSION_ID\}/);
});

test('返金はPaymentIntent全額・理由・注文単位の冪等キーでStripeへ送る', async () => {
  let captured;
  const env = stripeEnv(async (url, options) => {
    captured = { url, options, params: new URLSearchParams(options.body) };
    return Response.json({ id: 're_test_refund01', status: 'succeeded' });
  });
  const refund = await createLiveStripeRefund(env, {
    orderId: 'ord_test01', paymentIntentId: 'pi_test01', reason: 'duplicate',
  });
  assert.equal(refund.status, 'succeeded');
  assert.equal(captured.url, 'https://api.stripe.com/v1/refunds');
  assert.equal(captured.options.headers['idempotency-key'], 'refund-ord_test01');
  assert.equal(captured.params.get('payment_intent'), 'pi_test01');
  assert.equal(captured.params.get('reason'), 'duplicate');
  assert.equal(captured.params.has('amount'), false);
});

test('月次70%分配はConnect宛のTransferをバッチ単位の冪等キーで送る', async () => {
  let captured;
  const env = stripeEnv(async (url, options) => {
    captured = { url, options, params: new URLSearchParams(options.body) };
    return Response.json({ id: 'tr_monthly01', amount: 5600, currency: 'jpy' });
  });
  const transfer = await createLiveCreatorTransfer(env, {
    batchId: `payout_${'a'.repeat(32)}`, periodKey: '2026-07',
    destination: 'acct_creator123', amount: 5600, currency: 'jpy',
  });
  assert.equal(transfer.id, 'tr_monthly01');
  assert.equal(captured.url, 'https://api.stripe.com/v1/transfers');
  assert.equal(captured.options.headers['idempotency-key'], `payout-payout_${'a'.repeat(32)}`);
  assert.equal(captured.params.get('amount'), '5600');
  assert.equal(captured.params.get('destination'), 'acct_creator123');
  assert.equal(captured.params.get('metadata[live_revenue_share]'), '70-percent');
});

test('Stripe残高取引はGETで実手数料を取得する', async () => {
  let captured;
  const env = stripeEnv(async (url, options) => {
    captured = { url, options };
    return Response.json({ id: 'txn_fee01', amount: 1000, fee: 36, net: 964, currency: 'jpy' });
  });
  const transaction = await retrieveLiveStripeBalanceTransaction(env, 'txn_fee01');
  assert.equal(transaction.fee, 36);
  assert.equal(captured.url, 'https://api.stripe.com/v1/balance_transactions/txn_fee01');
  assert.equal(captured.options.method, 'GET');
});

test('ChargeはGETで残高取引IDを再確認できる', async () => {
  let captured;
  const env = stripeEnv(async (url, options) => {
    captured = { url, options };
    return Response.json({ id: 'ch_fee01', balance_transaction: 'txn_fee01' });
  });
  const charge = await retrieveLiveStripeCharge(env, 'ch_fee01');
  assert.equal(charge.balance_transaction, 'txn_fee01');
  assert.equal(captured.url, 'https://api.stripe.com/v1/charges/ch_fee01');
  assert.equal(captured.options.method, 'GET');
});

test('決済成功Webhookは1回だけ高画質画像と30日権限を発行する', async () => {
  const purchaseDb = new PurchaseDb();
  const participant = { id: 'p1', token: 'a'.repeat(48), name: '視聴者A', joinedAt: Date.now() };
  const game = {
    version: 5, title: '決済テスト', subjectName: '本人', channelName: 'テストチャンネル',
    channelId: 'UC1234567890_sample', channelVerificationId: 'b'.repeat(32), resultImagePrice: 500,
    scheduledAt: Date.now(), phase: 'complete', currentQuestionIndex: 0,
    questions: [{ id: 'q1', type: 'guess-person', text: '問題', options: ['A','B','C','D','E'], lockedIndex: 0 }],
    results: [{ questionId: 'q1', type: 'guess-person', text: '問題', options: [{ text: 'A', count: 1 },{ text: 'B', count: 0 },{ text: 'C', count: 0 },{ text: 'D', count: 0 },{ text: 'E', count: 0 }], popularIndices: [0], subjectAnswerIndex: 0, isCorrect: true }],
    participants: [participant], votes: { q1: { p1: 0 } }, participantCount: 1, participantLimit: 50,
    creatorImage: null, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 60_000,
  };
  purchaseDb.order = {
    order_id: 'ord_webhook01', checkout_request_id: 'c'.repeat(32), product_type: 'result_image',
    code: '123456', participant_id: 'p1', participant_name: '視聴者A', viewer_name: '視聴者A',
    amount: 500, currency: 'jpy', creator_amount: 350, platform_amount: 150,
    stripe_checkout_session_id: 'cs_test_webhook01', status: 'checkout_created', purchase_id: null,
  };
  const media = new Map();
  const env = {
    LIVE_PURCHASE_DB: purchaseDb,
    LIVE_KV: memoryKv({ 'live:123456': JSON.stringify(game) }),
    LIVE_MEDIA: { async put(key, value) { media.set(key, value); } },
    IMAGES: {},
    ASSETS: { fetch: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }) },
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    LIVE_DOWNLOAD_SIGNING_SECRET: 'd'.repeat(32),
  };
  const event = {
    id: 'evt_checkout01', type: 'checkout.session.completed', livemode: false,
    data: { object: {
      id: 'cs_test_webhook01', client_reference_id: 'ord_webhook01', payment_status: 'paid',
      payment_intent: 'pi_webhook01', amount_total: 500, currency: 'jpy',
      metadata: { live_order_id: 'ord_webhook01' },
    } },
  };
  const payload = JSON.stringify(event);
  const signature = await stripeSignature(env.STRIPE_WEBHOOK_SECRET, payload);
  const request = () => new Request('https://www.streetboardgame.com/api/live/stripe/webhook', {
    method: 'POST', headers: { 'stripe-signature': signature }, body: payload,
  });
  const first = await handleLiveApi(request(), env, '/api/live/stripe/webhook');
  assert.equal(first.status, 200);
  assert.equal(purchaseDb.order.status, 'paid');
  assert.equal(purchaseDb.order.stripe_payment_intent_id, 'pi_webhook01');
  assert.equal(purchaseDb.entitlements.length, 1);
  assert.equal(purchaseDb.entitlements[0].status, 'active');
  assert.match(purchaseDb.entitlements[0].purchase_id, /^purchase_/);
  assert.equal(media.has(`live/results/${purchaseDb.entitlements[0].purchase_id}.svg`), true);

  purchaseDb.events.get(event.id).status = 'processing';
  purchaseDb.events.get(event.id).updated_at = Date.now();
  const concurrent = await handleLiveApi(request(), env, '/api/live/stripe/webhook');
  assert.equal(concurrent.status, 409);
  assert.equal((await concurrent.json()).error, 'stripe-event-processing');

  purchaseDb.events.get(event.id).status = 'processed';
  const second = await handleLiveApi(request(), env, '/api/live/stripe/webhook');
  assert.equal(second.status, 200);
  assert.equal((await second.json()).duplicate, true);
  assert.equal(purchaseDb.entitlements.length, 1);
});

function stripeEnv(fetcher) {
  return { STRIPE_SECRET_KEY: 'sk_test_123456789', STRIPE_FETCH: fetcher };
}

async function stripeSignature(secret, payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const signature = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${signature}`;
}

function memoryKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    async get(key, options = {}) { const value = values.get(key); return value === undefined ? null : options.type === 'json' ? JSON.parse(value) : value; },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
  };
}

class PurchaseDb {
  constructor() { this.order = null; this.events = new Map(); this.entitlements = []; }
  prepare(sql) {
    const db = this;
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    return {
      bindings: [],
      bind(...bindings) { this.bindings = bindings; return this; },
      async first() {
        if (/SELECT \* FROM live_checkout_orders/i.test(normalized)) return db.order;
        if (/SELECT status, updated_at FROM live_stripe_events/i.test(normalized)) return db.events.get(this.bindings[0]) || null;
        return null;
      },
      async all() { return { results: [] }; },
      async run() {
        if (/INSERT OR IGNORE INTO live_stripe_events/i.test(normalized)) {
          const [eventId, eventType, createdAt, updatedAt] = this.bindings;
          if (db.events.has(eventId)) return { meta: { changes: 0 } };
          db.events.set(eventId, { event_id: eventId, event_type: eventType, status: 'processing', created_at: createdAt, updated_at: updatedAt });
          return { meta: { changes: 1 } };
        }
        if (/SET status = 'processed'/i.test(normalized)) {
          const event = db.events.get(this.bindings[2]);
          Object.assign(event, { status: 'processed', processed_at: this.bindings[0], updated_at: this.bindings[1] });
        } else if (/INSERT OR IGNORE INTO live_result_entitlements/i.test(normalized)) {
          const [purchase_id, code, participant_id, participant_name, access_token_hash, stripe_payment_intent_id, asset_key, purchased_at, available_until, created_at, updated_at] = this.bindings;
          if (!db.entitlements.some((item) => item.purchase_id === purchase_id)) db.entitlements.push({ purchase_id, code, participant_id, participant_name, access_token_hash, stripe_payment_intent_id, asset_key, status: 'active', purchased_at, available_until, created_at, updated_at });
        } else if (/UPDATE live_checkout_orders SET purchase_id/i.test(normalized)) {
          Object.assign(db.order, { purchase_id: this.bindings[0], stripe_payment_intent_id: this.bindings[1], status: 'paid', paid_at: this.bindings[2], updated_at: this.bindings[3] });
        }
        return { meta: { changes: 1 } };
      },
    };
  }
}
