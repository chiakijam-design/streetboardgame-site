import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  LIVE_PAYOUT_THRESHOLD_YEN,
  LIVE_REVENUE_HOLD_DAYS,
  calculatePayoutEligibility,
  buildMonthlyPayoutBatches,
  completePayoutBatch,
  defaultPayoutPeriod,
  getLiveRevenueOverview,
  getLiveSupportRevenueSummary,
  getPayoutBatch,
  markPayoutBatchProcessing,
  payoutPeriodBounds,
  recordPaidRevenue,
  recordRevenueProcessingFee,
  syncRevenueOrderStatus,
  verifyPayoutBatchAllocations,
} from '../../src/live/revenue-ledger.js';

test('月次分配は日本時間の前月を対象にし、月末から14日間保留する', () => {
  const now = Date.parse('2026-08-20T03:00:00Z');
  assert.equal(defaultPayoutPeriod(now), '2026-07');
  const period = payoutPeriodBounds('2026-07');
  assert.equal(new Date(period.start).toISOString(), '2026-06-30T15:00:00.000Z');
  assert.equal(new Date(period.end).toISOString(), '2026-07-31T15:00:00.000Z');
  assert.equal(new Date(period.closeEligibleAt).toISOString(), '2026-08-14T15:00:00.000Z');
  assert.equal(LIVE_REVENUE_HOLD_DAYS, 14);
});

test('YouTuber残高5,000円以上だけ送金し、返金確定分を相殺する', () => {
  assert.equal(LIVE_PAYOUT_THRESHOLD_YEN, 5000);
  assert.deepEqual(calculatePayoutEligibility(7000, 1400, 0), {
    eligible: true, reason: 'eligible', transferAmount: 5600,
  });
  assert.deepEqual(calculatePayoutEligibility(7000, 2100, 0), {
    eligible: false, reason: 'below-threshold', transferAmount: 4900,
  });
});

test('今月の有料応援メッセージを結果画像と分けて売上・審査・返金別に集計する', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0002_live_checkout_orders.sql', import.meta.url), 'utf8'));
  const db = d1Adapter(sqlite);
  const insert = sqlite.prepare(`
    INSERT INTO live_checkout_orders (
      order_id, checkout_request_id, product_type, code, participant_id, participant_name,
      viewer_name, channel_verification_id, stripe_account_id, amount, currency,
      creator_amount, platform_amount, status, paid_at, created_at, updated_at
    ) VALUES (?, ?, ?, '123456', ?, '', '', ?, 'acct_creator123', ?, 'jpy', ?, ?, ?, ?, ?, ?)
  `);
  const july = Date.parse('2026-07-10T12:00:00+09:00');
  const rows = [
    ['support180', 'support', 180, 126, 54, 'paid', july],
    ['support480', 'support', 480, 336, 144, 'paid', july + 1000],
    ['support980', 'support', 980, 686, 294, 'refund_pending', july + 2000],
    ['support1980', 'support', 1980, 1386, 594, 'refunded', july + 3000],
    ['image2980', 'result_image', 2980, 2086, 894, 'paid', july + 4000],
    ['oldSupport', 'support', 2980, 2086, 894, 'paid', Date.parse('2026-06-20T12:00:00+09:00')],
  ];
  for (const [id, product, amount, creator, platform, status, paidAt] of rows) {
    insert.run(
      `ord_${id}`, id.padEnd(32, 'x'), product, `p_${id}`, 'v'.repeat(32),
      amount, creator, platform, status, paidAt, paidAt, paidAt,
    );
  }
  const summary = await getLiveSupportRevenueSummary(db, Date.parse('2026-07-28T12:00:00+09:00'));
  assert.deepEqual(summary, {
    periodKey: '2026-07',
    totalOrderCount: 4,
    paidOrderCount: 2,
    paidGrossAmount: 660,
    creatorAmount: 462,
    platformAmount: 198,
    reviewOrderCount: 1,
    reviewGrossAmount: 980,
    refundedOrderCount: 1,
    refundedGrossAmount: 1980,
    amountBreakdown: [
      { amount: 180, orderCount: 1, grossAmount: 180 },
      { amount: 480, orderCount: 1, grossAmount: 480 },
    ],
  });
});

test('返金・不正審査中の相殺があれば月次送金を止める', () => {
  assert.deepEqual(calculatePayoutEligibility(10000, 0, 700), {
    eligible: false, reason: 'offset-pending', transferAmount: 10000,
  });
  assert.throws(() => calculatePayoutEligibility(-1, 0, 0), /invalid-payout-balance/);
});

test('送金直前に70%配分明細の合計金額と注文数を再照合する', async () => {
  const batch = { batch_id: `payout_${'a'.repeat(32)}`, creator_sales_amount: 5600, offset_amount: 0, transfer_amount: 5600, order_count: 8 };
  const db = allocationDb({ gross_sales_amount: 8000, creator_sales_amount: 5600, offset_amount: 0, transfer_amount: 5600, order_count: 8 });
  assert.equal(await verifyPayoutBatchAllocations(db, batch), true);
  await assert.rejects(
    verifyPayoutBatchAllocations(allocationDb({ gross_sales_amount: 8000, creator_sales_amount: 5599, offset_amount: 0, transfer_amount: 5599, order_count: 8 }), batch),
    /payout-batch-ledger-mismatch/,
  );
});

test('実SQLiteで売上2件を月次締めし、送金後返金を翌月相殺へ移す', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0002_live_checkout_orders.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0003_live_revenue_ledger.sql', import.meta.url), 'utf8'));
  const db = d1Adapter(sqlite);
  const july1 = Date.parse('2026-07-01T00:00:00+09:00');
  for (const [suffix, paidAt] of [['01', july1], ['02', july1 + 86_400_000]]) {
    const order = {
      order_id: `ord_sale${suffix}`, channel_verification_id: 'v'.repeat(32),
      stripe_account_id: 'acct_creator123', currency: 'jpy', amount: 4000,
      creator_amount: 2800, platform_amount: 1200,
    };
    sqlite.prepare(`
      INSERT INTO live_checkout_orders (
        order_id, checkout_request_id, product_type, code, participant_id, participant_name,
        viewer_name, channel_verification_id, stripe_account_id, amount, currency,
        creator_amount, platform_amount, status, paid_at, created_at, updated_at
      ) VALUES (?, ?, 'support', '123456', ?, '', '', ?, ?, ?, 'jpy', ?, ?, 'paid', ?, ?, ?)
    `).run(order.order_id, suffix.repeat(16), `p${suffix}`, order.channel_verification_id,
      order.stripe_account_id, order.amount, order.creator_amount, order.platform_amount, paidAt, paidAt, paidAt);
    await recordPaidRevenue(db, order, paidAt);
    if (suffix === '01') await recordRevenueProcessingFee(db, order, {
      id: 'txn_sale01', amount: 4000, fee: 144, net: 3856, currency: 'jpy',
    }, paidAt + 1000);
  }

  const closeAt = Date.parse('2026-08-15T00:00:00+09:00');
  const close = await buildMonthlyPayoutBatches(db, '2026-07', closeAt);
  assert.equal(close.created.length, 1);
  assert.equal(close.created[0].transferAmount, 5600);
  const batch = await getPayoutBatch(db, close.created[0].batchId);
  assert.equal(await verifyPayoutBatchAllocations(db, batch), true);
  await markPayoutBatchProcessing(db, batch.batch_id, closeAt);
  await completePayoutBatch(db, batch.batch_id, 'tr_sqlite01', closeAt);

  await syncRevenueOrderStatus(db, 'ord_sale01', 'refunded', closeAt + 1000);
  const overview = await getLiveRevenueOverview(db, closeAt + 1000);
  const refunded = overview.ledger.find((item) => item.order_id === 'ord_sale01');
  assert.equal(refunded.status, 'offset_due');
  assert.equal(refunded.stripe_transfer_id, 'tr_sqlite01');
  assert.equal(refunded.stripe_fee_amount, 144);
  assert.equal(refunded.platform_net_amount, 1056);
  assert.equal(overview.batches[0].status, 'transferred');
});

function allocationDb(row) {
  return {
    prepare() {
      return { bind() { return this; }, async first() { return row; } };
    },
  };
}

function d1Adapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const wrapper = {
        bindings: [],
        bind(...bindings) { this.bindings = bindings; return this; },
        async first() { return statement.get(...this.bindings) || null; },
        async all() { return { results: statement.all(...this.bindings) }; },
        async run() {
          const result = statement.run(...this.bindings);
          return { meta: { changes: Number(result.changes) } };
        },
      };
      return wrapper;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
