export const LIVE_REVENUE_HOLD_DAYS = 14;
export const LIVE_PAYOUT_THRESHOLD_YEN = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function recordPaidRevenue(db, order, paidAt = Date.now()) {
  const availableAt = paidAt + LIVE_REVENUE_HOLD_DAYS * DAY_MS;
  const status = availableAt <= Date.now() ? 'available' : 'holding';
  await db.prepare(`
    INSERT INTO live_revenue_entries (
      revenue_entry_id, order_id, channel_verification_id, stripe_account_id,
      currency, gross_amount, creator_amount, platform_amount, status,
      paid_at, available_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      channel_verification_id = excluded.channel_verification_id,
      stripe_account_id = excluded.stripe_account_id,
      currency = excluded.currency,
      gross_amount = excluded.gross_amount,
      creator_amount = excluded.creator_amount,
      platform_amount = excluded.platform_amount,
      paid_at = excluded.paid_at,
      available_at = excluded.available_at,
      status = CASE
        WHEN live_revenue_entries.status = 'pending_payment' THEN excluded.status
        ELSE live_revenue_entries.status
      END,
      updated_at = excluded.updated_at
  `).bind(
    revenueId(order.order_id), order.order_id, order.channel_verification_id,
    order.stripe_account_id, String(order.currency || 'jpy').toLowerCase(),
    Number(order.amount), Number(order.creator_amount), Number(order.platform_amount),
    status, paidAt, availableAt, paidAt, paidAt,
  ).run();
}

export async function recordRevenueProcessingFee(db, order, balanceTransaction, now = Date.now()) {
  const transactionId = String(balanceTransaction?.id || '');
  const fee = Number(balanceTransaction?.fee);
  const gross = Number(balanceTransaction?.amount);
  const currency = String(balanceTransaction?.currency || '').toLowerCase();
  if (!transactionId.startsWith('txn_') || !Number.isSafeInteger(fee) || fee < 0
    || gross !== Number(order.amount) || currency !== String(order.currency || 'jpy').toLowerCase()) {
    throw revenueError('stripe-balance-transaction-mismatch', 409);
  }
  await ensurePendingRevenueEntry(db, order, now);
  await db.prepare(`
    UPDATE live_revenue_entries
    SET stripe_balance_transaction_id = ?, stripe_fee_amount = ?,
      platform_net_amount = platform_amount - ?, updated_at = ?
    WHERE order_id = ?
  `).bind(transactionId, fee, fee, now, order.order_id).run();
}

export async function syncRevenueOrderStatus(db, orderId, orderStatus, now = Date.now()) {
  const entry = await db.prepare(`
    SELECT revenue_entry_id, status, available_at, sale_payout_batch_id
    FROM live_revenue_entries WHERE order_id = ?
  `).bind(orderId).first();
  if (!entry) return null;
  let payoutStatus = '';
  if (entry.sale_payout_batch_id) {
    const batch = await db.prepare('SELECT status FROM live_payout_batches WHERE batch_id = ?')
      .bind(entry.sale_payout_batch_id).first();
    payoutStatus = String(batch?.status || '');
  }
  const paidOrProcessing = ['processing', 'transferred'].includes(payoutStatus);
  let status;
  if (paidOrProcessing) {
    if (['refunded', 'chargeback'].includes(orderStatus)) status = 'offset_due';
    else if (['refund_pending', 'refund_processing', 'fraud_review'].includes(orderStatus)) status = 'offset_pending';
    else status = 'transferred';
  } else if (['refunded', 'chargeback'].includes(orderStatus)) status = orderStatus;
  else if (['refund_pending', 'refund_processing'].includes(orderStatus)) status = 'refund_pending';
  else if (orderStatus === 'fraud_review') status = 'fraud_review';
  else status = Number(entry.available_at) <= now ? 'available' : 'holding';

  if (entry.sale_payout_batch_id && !paidOrProcessing
    && !['paid', 'refund_failed'].includes(orderStatus)) {
    await cancelReservedPayoutBatch(db, entry.sale_payout_batch_id, now);
  }
  await db.prepare('UPDATE live_revenue_entries SET status = ?, updated_at = ? WHERE order_id = ?')
    .bind(status, now, orderId).run();
  return status;
}

export async function syncRevenueLedgerFromOrders(db, now = Date.now()) {
  const holdMs = LIVE_REVENUE_HOLD_DAYS * DAY_MS;
  await db.prepare(`
    INSERT OR IGNORE INTO live_revenue_entries (
      revenue_entry_id, order_id, channel_verification_id, stripe_account_id,
      currency, gross_amount, creator_amount, platform_amount, status,
      paid_at, available_at, created_at, updated_at
    )
    SELECT 'rev_' || substr(order_id, 5), order_id, channel_verification_id, stripe_account_id,
      currency, amount, creator_amount, platform_amount,
      CASE
        WHEN status = 'refunded' THEN 'refunded'
        WHEN status IN ('refund_pending', 'refund_processing') THEN 'refund_pending'
        WHEN status = 'fraud_review' THEN 'fraud_review'
        WHEN paid_at + ? <= ? THEN 'available'
        ELSE 'holding'
      END,
      paid_at, paid_at + ?, paid_at, updated_at
    FROM live_checkout_orders WHERE paid_at IS NOT NULL
  `).bind(holdMs, now, holdMs).run();
  await db.prepare(`
    UPDATE live_revenue_entries SET status = 'available', updated_at = ?
    WHERE status = 'holding' AND available_at <= ?
  `).bind(now, now).run();
}

export async function getLiveRevenueOverview(db, now = Date.now()) {
  await syncRevenueLedgerFromOrders(db, now);
  const [balances, ledger, batches, support] = await Promise.all([
    db.prepare(`
      SELECT stripe_account_id, channel_verification_id, currency,
        SUM(CASE WHEN status = 'holding' THEN creator_amount ELSE 0 END) AS holding_amount,
        SUM(CASE WHEN status = 'available' THEN creator_amount ELSE 0 END) AS available_amount,
        SUM(CASE WHEN status = 'offset_due' THEN creator_amount ELSE 0 END) AS offset_amount,
        SUM(CASE WHEN status IN ('refund_pending', 'fraud_review', 'offset_pending') THEN creator_amount ELSE 0 END) AS review_amount,
        SUM(CASE WHEN stripe_transfer_id IS NOT NULL THEN creator_amount ELSE 0 END) AS transferred_amount,
        COUNT(*) AS entry_count
      FROM live_revenue_entries
      GROUP BY stripe_account_id, channel_verification_id, currency
      ORDER BY stripe_account_id
    `).all(),
    db.prepare(`
      SELECT e.revenue_entry_id, e.order_id, e.channel_verification_id, e.stripe_account_id,
        e.currency, e.gross_amount, e.creator_amount, e.platform_amount, e.stripe_fee_amount,
        e.platform_net_amount, e.status, e.paid_at, e.available_at, e.sale_payout_batch_id,
        e.offset_payout_batch_id, e.stripe_transfer_id, e.updated_at,
        COALESCE(o.product_type, '') AS product_type
      FROM live_revenue_entries e
      LEFT JOIN live_checkout_orders o ON o.order_id = e.order_id
      ORDER BY e.paid_at DESC LIMIT 200
    `).all(),
    db.prepare(`
      SELECT batch_id, period_key, stripe_account_id, currency, gross_sales_amount,
        creator_sales_amount, offset_amount, transfer_amount, order_count, status,
        stripe_transfer_id, failure_code, created_at, transferred_at, updated_at
      FROM live_payout_batches ORDER BY created_at DESC LIMIT 100
    `).all(),
    getLiveSupportRevenueSummary(db, now),
  ]);
  return {
    policy: {
      creatorSharePercent: 70,
      holdDays: LIVE_REVENUE_HOLD_DAYS,
      payoutThreshold: LIVE_PAYOUT_THRESHOLD_YEN,
      defaultPeriod: defaultPayoutPeriod(now),
    },
    balances: (balances.results || []).map((row) => {
      const availableAmount = Number(row.available_amount) || 0;
      const offsetAmount = Number(row.offset_amount) || 0;
      const reviewAmount = Number(row.review_amount) || 0;
      const payableAmount = Math.max(0, availableAmount - offsetAmount);
      return {
        ...row,
        holding_amount: Number(row.holding_amount) || 0,
        available_amount: availableAmount,
        offset_amount: offsetAmount,
        review_amount: reviewAmount,
        transferred_amount: Number(row.transferred_amount) || 0,
        entry_count: Number(row.entry_count) || 0,
        payable_amount: payableAmount,
        payout_eligible: payableAmount >= LIVE_PAYOUT_THRESHOLD_YEN && reviewAmount === 0,
      };
    }),
    ledger: ledger.results || [],
    batches: batches.results || [],
    support,
  };
}

export async function getLiveSupportRevenueSummary(db, now = Date.now()) {
  const currentJst = new Date(now + JST_OFFSET_MS);
  const periodKey = `${currentJst.getUTCFullYear()}-${String(currentJst.getUTCMonth() + 1).padStart(2, '0')}`;
  const period = payoutPeriodBounds(periodKey);
  const paidStatuses = ['paid'];
  const reviewStatuses = ['refund_pending', 'refund_processing', 'refund_failed', 'fraud_review'];
  const refundedStatuses = ['refunded', 'chargeback'];
  const summary = await db.prepare(`
    SELECT
      COUNT(*) AS total_order_count,
      SUM(CASE WHEN status IN (${paidStatuses.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS paid_order_count,
      COALESCE(SUM(CASE WHEN status IN (${paidStatuses.map(() => '?').join(',')}) THEN amount ELSE 0 END), 0) AS paid_gross_amount,
      COALESCE(SUM(CASE WHEN status IN (${paidStatuses.map(() => '?').join(',')}) THEN creator_amount ELSE 0 END), 0) AS creator_amount,
      COALESCE(SUM(CASE WHEN status IN (${paidStatuses.map(() => '?').join(',')}) THEN platform_amount ELSE 0 END), 0) AS platform_amount,
      SUM(CASE WHEN status IN (${reviewStatuses.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS review_order_count,
      COALESCE(SUM(CASE WHEN status IN (${reviewStatuses.map(() => '?').join(',')}) THEN amount ELSE 0 END), 0) AS review_gross_amount,
      SUM(CASE WHEN status IN (${refundedStatuses.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS refunded_order_count,
      COALESCE(SUM(CASE WHEN status IN (${refundedStatuses.map(() => '?').join(',')}) THEN amount ELSE 0 END), 0) AS refunded_gross_amount
    FROM live_checkout_orders
    WHERE product_type = 'support' AND paid_at >= ? AND paid_at < ?
  `).bind(
    ...paidStatuses,
    ...paidStatuses,
    ...paidStatuses,
    ...paidStatuses,
    ...reviewStatuses,
    ...reviewStatuses,
    ...refundedStatuses,
    ...refundedStatuses,
    period.start,
    period.end,
  ).first();
  const breakdown = await db.prepare(`
    SELECT amount, COUNT(*) AS order_count, COALESCE(SUM(amount), 0) AS gross_amount
    FROM live_checkout_orders
    WHERE product_type = 'support' AND status = 'paid' AND paid_at >= ? AND paid_at < ?
    GROUP BY amount ORDER BY amount
  `).bind(period.start, period.end).all();
  return {
    periodKey,
    totalOrderCount: Number(summary?.total_order_count) || 0,
    paidOrderCount: Number(summary?.paid_order_count) || 0,
    paidGrossAmount: Number(summary?.paid_gross_amount) || 0,
    creatorAmount: Number(summary?.creator_amount) || 0,
    platformAmount: Number(summary?.platform_amount) || 0,
    reviewOrderCount: Number(summary?.review_order_count) || 0,
    reviewGrossAmount: Number(summary?.review_gross_amount) || 0,
    refundedOrderCount: Number(summary?.refunded_order_count) || 0,
    refundedGrossAmount: Number(summary?.refunded_gross_amount) || 0,
    amountBreakdown: (breakdown.results || []).map((row) => ({
      amount: Number(row.amount) || 0,
      orderCount: Number(row.order_count) || 0,
      grossAmount: Number(row.gross_amount) || 0,
    })),
  };
}

export async function buildMonthlyPayoutBatches(db, periodKey, now = Date.now()) {
  const period = payoutPeriodBounds(periodKey);
  if (now < period.closeEligibleAt) throw revenueError('payout-period-still-on-hold', 409);
  await syncRevenueLedgerFromOrders(db, now);
  const accounts = await db.prepare(`
    SELECT stripe_account_id, currency,
      SUM(CASE WHEN status = 'available' AND paid_at < ? THEN creator_amount ELSE 0 END) AS creator_sales_amount,
      SUM(CASE WHEN status = 'available' AND paid_at < ? THEN gross_amount ELSE 0 END) AS gross_sales_amount,
      SUM(CASE WHEN status = 'available' AND paid_at < ? THEN 1 ELSE 0 END) AS order_count,
      SUM(CASE WHEN status = 'offset_due' THEN creator_amount ELSE 0 END) AS offset_amount,
      SUM(CASE WHEN status = 'offset_pending' THEN creator_amount ELSE 0 END) AS pending_offset_amount
    FROM live_revenue_entries
    WHERE (status = 'available' AND paid_at < ?) OR status IN ('offset_due', 'offset_pending')
    GROUP BY stripe_account_id, currency
  `).bind(period.end, period.end, period.end, period.end).all();
  const created = [];
  const skipped = [];
  for (const account of accounts.results || []) {
    const sales = Number(account.creator_sales_amount) || 0;
    const offsets = Number(account.offset_amount) || 0;
    const pendingOffsets = Number(account.pending_offset_amount) || 0;
    const eligibility = calculatePayoutEligibility(sales, offsets, pendingOffsets);
    const transferAmount = eligibility.transferAmount;
    if (eligibility.reason === 'offset-pending') {
      skipped.push({ stripeAccountId: account.stripe_account_id, reason: 'offset-pending', amount: transferAmount });
      continue;
    }
    if (!eligibility.eligible) {
      skipped.push({ stripeAccountId: account.stripe_account_id, reason: 'below-threshold', amount: transferAmount });
      continue;
    }
    const batchId = payoutBatchId();
    const createdAt = now;
    const insert = await db.prepare(`
      INSERT OR IGNORE INTO live_payout_batches (
        batch_id, period_key, stripe_account_id, currency, gross_sales_amount,
        creator_sales_amount, offset_amount, transfer_amount, order_count,
        status, failure_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '', ?, ?)
    `).bind(
      batchId, period.key, account.stripe_account_id, account.currency,
      Number(account.gross_sales_amount) || 0, sales, offsets, transferAmount,
      Number(account.order_count) || 0, createdAt, createdAt,
    ).run();
    if (Number(insert?.meta?.changes) < 1) {
      skipped.push({ stripeAccountId: account.stripe_account_id, reason: 'batch-already-exists', amount: transferAmount });
      continue;
    }
    await db.batch([
      db.prepare(`
        INSERT INTO live_payout_allocations (batch_id, revenue_entry_id, allocation_type, amount, created_at)
        SELECT ?, revenue_entry_id, 'sale', creator_amount, ? FROM live_revenue_entries
        WHERE stripe_account_id = ? AND currency = ? AND status = 'available'
          AND paid_at < ? AND sale_payout_batch_id IS NULL
      `).bind(batchId, now, account.stripe_account_id, account.currency, period.end),
      db.prepare(`
        UPDATE live_revenue_entries SET status = 'payout_reserved', sale_payout_batch_id = ?, updated_at = ?
        WHERE stripe_account_id = ? AND currency = ? AND status = 'available'
          AND paid_at < ? AND sale_payout_batch_id IS NULL
      `).bind(batchId, now, account.stripe_account_id, account.currency, period.end),
      db.prepare(`
        INSERT INTO live_payout_allocations (batch_id, revenue_entry_id, allocation_type, amount, created_at)
        SELECT ?, revenue_entry_id, 'offset', -creator_amount, ? FROM live_revenue_entries
        WHERE stripe_account_id = ? AND currency = ? AND status = 'offset_due'
          AND offset_payout_batch_id IS NULL
      `).bind(batchId, now, account.stripe_account_id, account.currency),
      db.prepare(`
        UPDATE live_revenue_entries SET status = 'offset_reserved', offset_payout_batch_id = ?, updated_at = ?
        WHERE stripe_account_id = ? AND currency = ? AND status = 'offset_due'
          AND offset_payout_batch_id IS NULL
      `).bind(batchId, now, account.stripe_account_id, account.currency),
    ]);
    const totals = await payoutBatchAllocationTotals(db, batchId);
    if (totals.transferAmount < LIVE_PAYOUT_THRESHOLD_YEN) {
      await cancelReservedPayoutBatch(db, batchId, now, 'below-threshold-after-reservation');
      skipped.push({ stripeAccountId: account.stripe_account_id, reason: 'below-threshold', amount: totals.transferAmount });
      continue;
    }
    await db.prepare(`
      UPDATE live_payout_batches SET gross_sales_amount = ?, creator_sales_amount = ?,
        offset_amount = ?, transfer_amount = ?, order_count = ?, updated_at = ?
      WHERE batch_id = ?
    `).bind(
      totals.grossSalesAmount, totals.creatorSalesAmount, totals.offsetAmount,
      totals.transferAmount, totals.orderCount, now, batchId,
    ).run();
    created.push({ batchId, stripeAccountId: account.stripe_account_id, transferAmount: totals.transferAmount });
  }
  return { period, created, skipped };
}

export async function getPayoutBatch(db, batchId) {
  return db.prepare(`
    SELECT batch_id, period_key, stripe_account_id, currency, gross_sales_amount,
      creator_sales_amount, offset_amount, transfer_amount, order_count, status,
      stripe_transfer_id, failure_code, created_at, transferred_at, updated_at
    FROM live_payout_batches WHERE batch_id = ?
  `).bind(batchId).first();
}

export async function markPayoutBatchProcessing(db, batchId, now = Date.now()) {
  const result = await db.prepare(`
    UPDATE live_payout_batches SET status = 'processing', failure_code = '', updated_at = ?
    WHERE batch_id = ? AND status IN ('draft', 'transfer_failed')
  `).bind(now, batchId).run();
  if (Number(result?.meta?.changes) < 1) throw revenueError('payout-batch-not-transferable', 409);
}

export async function verifyPayoutBatchAllocations(db, batch) {
  const allocation = await payoutBatchAllocationTotals(db, batch.batch_id);
  if (allocation.transferAmount !== Number(batch.transfer_amount)
    || allocation.orderCount !== Number(batch.order_count)
    || allocation.creatorSalesAmount !== Number(batch.creator_sales_amount)
    || allocation.offsetAmount !== Number(batch.offset_amount)) {
    throw revenueError('payout-batch-ledger-mismatch', 409);
  }
  return true;
}

export async function completePayoutBatch(db, batchId, transferId, now = Date.now()) {
  await db.batch([
    db.prepare(`
      UPDATE live_payout_batches SET status = 'transferred', stripe_transfer_id = ?,
        transferred_at = ?, updated_at = ? WHERE batch_id = ?
    `).bind(transferId, now, now, batchId),
    db.prepare(`
      UPDATE live_revenue_entries SET
        status = CASE WHEN status = 'payout_reserved' THEN 'transferred' ELSE status END,
        stripe_transfer_id = ?, updated_at = ?
      WHERE sale_payout_batch_id = ?
    `).bind(transferId, now, batchId),
    db.prepare(`
      UPDATE live_revenue_entries SET status = 'offset_settled', updated_at = ?
      WHERE offset_payout_batch_id = ? AND status = 'offset_reserved'
    `).bind(now, batchId),
  ]);
}

export async function failPayoutBatch(db, batchId, failureCode, now = Date.now()) {
  await db.prepare(`
    UPDATE live_payout_batches SET status = 'transfer_failed', failure_code = ?, updated_at = ?
    WHERE batch_id = ? AND status = 'processing'
  `).bind(String(failureCode || 'stripe-transfer-failed').slice(0, 120), now, batchId).run();
}

export async function syncPayoutTransferEvent(db, transfer, eventType, now = Date.now()) {
  const batchId = String(transfer?.metadata?.live_payout_batch_id || '');
  const transferId = String(transfer?.id || '');
  if (!/^payout_[a-f0-9]{32}$/.test(batchId) || !/^tr_[A-Za-z0-9_]+$/.test(transferId)) return null;
  if (eventType === 'transfer.reversed' || transfer.reversed === true) {
    await db.batch([
      db.prepare(`
        UPDATE live_payout_batches SET status = 'reversed', stripe_transfer_id = ?, updated_at = ?
        WHERE batch_id = ?
      `).bind(transferId, now, batchId),
      db.prepare(`
        UPDATE live_revenue_entries SET status = 'payout_reversed', updated_at = ?
        WHERE sale_payout_batch_id = ?
      `).bind(now, batchId),
    ]);
    return { batchId, status: 'reversed' };
  }
  await completePayoutBatch(db, batchId, transferId, now);
  return { batchId, status: 'transferred' };
}

export function defaultPayoutPeriod(now = Date.now()) {
  const date = new Date(now + JST_OFFSET_MS);
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  if (month === 0) { year -= 1; month = 12; }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function payoutPeriodBounds(periodKey) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(periodKey || ''));
  if (!match) throw revenueError('invalid-payout-period', 400);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = Date.UTC(year, month - 1, 1) - JST_OFFSET_MS;
  const end = Date.UTC(year, month, 1) - JST_OFFSET_MS;
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    start,
    end,
    closeEligibleAt: end + LIVE_REVENUE_HOLD_DAYS * DAY_MS,
  };
}

export function calculatePayoutEligibility(availableAmount, offsetAmount = 0, pendingOffsetAmount = 0) {
  for (const value of [availableAmount, offsetAmount, pendingOffsetAmount]) {
    if (!Number.isSafeInteger(value) || value < 0) throw revenueError('invalid-payout-balance', 400);
  }
  const transferAmount = Math.max(0, availableAmount - offsetAmount);
  if (pendingOffsetAmount > 0) return { eligible: false, reason: 'offset-pending', transferAmount };
  if (transferAmount < LIVE_PAYOUT_THRESHOLD_YEN) return { eligible: false, reason: 'below-threshold', transferAmount };
  return { eligible: true, reason: 'eligible', transferAmount };
}

async function ensurePendingRevenueEntry(db, order, now) {
  await db.prepare(`
    INSERT OR IGNORE INTO live_revenue_entries (
      revenue_entry_id, order_id, channel_verification_id, stripe_account_id,
      currency, gross_amount, creator_amount, platform_amount, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)
  `).bind(
    revenueId(order.order_id), order.order_id, order.channel_verification_id,
    order.stripe_account_id, String(order.currency || 'jpy').toLowerCase(),
    Number(order.amount), Number(order.creator_amount), Number(order.platform_amount), now, now,
  ).run();
}

async function payoutBatchAllocationTotals(db, batchId) {
  const row = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN a.allocation_type = 'sale' THEN e.gross_amount ELSE 0 END), 0) AS gross_sales_amount,
      COALESCE(SUM(CASE WHEN a.allocation_type = 'sale' THEN a.amount ELSE 0 END), 0) AS creator_sales_amount,
      COALESCE(-SUM(CASE WHEN a.allocation_type = 'offset' THEN a.amount ELSE 0 END), 0) AS offset_amount,
      COALESCE(SUM(a.amount), 0) AS transfer_amount,
      COALESCE(SUM(CASE WHEN a.allocation_type = 'sale' THEN 1 ELSE 0 END), 0) AS order_count
    FROM live_payout_allocations a
    JOIN live_revenue_entries e ON e.revenue_entry_id = a.revenue_entry_id
    WHERE a.batch_id = ?
  `).bind(batchId).first();
  return {
    grossSalesAmount: Number(row?.gross_sales_amount) || 0,
    creatorSalesAmount: Number(row?.creator_sales_amount) || 0,
    offsetAmount: Number(row?.offset_amount) || 0,
    transferAmount: Number(row?.transfer_amount) || 0,
    orderCount: Number(row?.order_count) || 0,
  };
}

async function cancelReservedPayoutBatch(db, batchId, now, reason = 'order-status-changed') {
  await db.batch([
    db.prepare(`
      UPDATE live_payout_batches SET status = 'cancelled', failure_code = ?, updated_at = ?
      WHERE batch_id = ? AND status IN ('draft', 'transfer_failed')
    `).bind(reason, now, batchId),
    db.prepare(`
      UPDATE live_revenue_entries SET status = CASE WHEN available_at <= ? THEN 'available' ELSE 'holding' END,
        sale_payout_batch_id = NULL, updated_at = ?
      WHERE sale_payout_batch_id = ? AND status = 'payout_reserved'
    `).bind(now, now, batchId),
    db.prepare(`
      UPDATE live_revenue_entries SET status = 'offset_due', offset_payout_batch_id = NULL, updated_at = ?
      WHERE offset_payout_batch_id = ? AND status = 'offset_reserved'
    `).bind(now, batchId),
  ]);
}

function revenueId(orderId) {
  return `rev_${String(orderId || '').replace(/^ord_/, '')}`;
}

function payoutBatchId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `payout_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function revenueError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
