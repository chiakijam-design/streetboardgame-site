let purchaseReadyDb = null;
let purchaseReadyPromise = null;

export function getLivePurchaseDb(env) {
  return env?.LIVE_PURCHASE_DB || null;
}

export async function requireLivePurchaseDb(env) {
  const db = getLivePurchaseDb(env);
  if (!db) throw purchaseError('live-purchase-storage-not-configured', 503);
  await ensureLivePurchaseD1(env);
  return db;
}

export async function ensureLivePurchaseD1(env) {
  const db = getLivePurchaseDb(env);
  if (!db) return false;
  if (purchaseReadyDb !== db || !purchaseReadyPromise) {
    purchaseReadyDb = db;
    purchaseReadyPromise = Promise.all([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_result_entitlements (
          purchase_id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          participant_name TEXT NOT NULL,
          access_token_hash TEXT NOT NULL,
          stripe_payment_intent_id TEXT NOT NULL UNIQUE,
          asset_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          purchased_at INTEGER NOT NULL,
          available_until INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_checkout_orders (
          order_id TEXT PRIMARY KEY, checkout_request_id TEXT NOT NULL UNIQUE,
          product_type TEXT NOT NULL, code TEXT NOT NULL, participant_id TEXT NOT NULL,
          participant_name TEXT NOT NULL, viewer_name TEXT NOT NULL,
          channel_verification_id TEXT NOT NULL, stripe_account_id TEXT NOT NULL,
          amount INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'jpy',
          creator_amount INTEGER NOT NULL, platform_amount INTEGER NOT NULL,
          purchase_id TEXT, stripe_checkout_session_id TEXT UNIQUE, stripe_checkout_url TEXT,
          stripe_checkout_expires_at INTEGER, stripe_payment_intent_id TEXT UNIQUE,
          stripe_charge_id TEXT, stripe_refund_id TEXT, status TEXT NOT NULL DEFAULT 'creating',
          paid_at INTEGER, refunded_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_stripe_events (
          event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'processing', attempt_count INTEGER NOT NULL DEFAULT 1,
          last_error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL, processed_at INTEGER
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_revenue_entries (
          revenue_entry_id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE,
          channel_verification_id TEXT NOT NULL, stripe_account_id TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'jpy', gross_amount INTEGER NOT NULL,
          creator_amount INTEGER NOT NULL, platform_amount INTEGER NOT NULL,
          stripe_balance_transaction_id TEXT, stripe_fee_amount INTEGER,
          platform_net_amount INTEGER, status TEXT NOT NULL DEFAULT 'pending_payment',
          paid_at INTEGER, available_at INTEGER, sale_payout_batch_id TEXT,
          offset_payout_batch_id TEXT, stripe_transfer_id TEXT,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_payout_batches (
          batch_id TEXT PRIMARY KEY, period_key TEXT NOT NULL, stripe_account_id TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'jpy', gross_sales_amount INTEGER NOT NULL,
          creator_sales_amount INTEGER NOT NULL, offset_amount INTEGER NOT NULL DEFAULT 0,
          transfer_amount INTEGER NOT NULL, order_count INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft', stripe_transfer_id TEXT UNIQUE,
          failure_code TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
          transferred_at INTEGER, updated_at INTEGER NOT NULL,
          UNIQUE (period_key, stripe_account_id, currency)
        )
      `).run(),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS live_payout_allocations (
          batch_id TEXT NOT NULL, revenue_entry_id TEXT NOT NULL,
          allocation_type TEXT NOT NULL, amount INTEGER NOT NULL, created_at INTEGER NOT NULL,
          PRIMARY KEY (batch_id, revenue_entry_id, allocation_type)
        )
      `).run(),
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_participant ON live_result_entitlements (code, participant_id, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_expiry ON live_result_entitlements (available_until, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_purchase_date ON live_result_entitlements (purchased_at)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_participant ON live_checkout_orders (code, participant_id, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_status ON live_checkout_orders (status, updated_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_stripe_events_status ON live_stripe_events (status, updated_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_revenue_entries_account_status ON live_revenue_entries (stripe_account_id, currency, status, available_at)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_revenue_entries_paid ON live_revenue_entries (paid_at, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_payout_batches_status ON live_payout_batches (status, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_payout_allocations_entry ON live_payout_allocations (revenue_entry_id, allocation_type)').run(),
    ])).catch((error) => {
      purchaseReadyPromise = null;
      throw error;
    });
  }
  await purchaseReadyPromise;
  return true;
}

function purchaseError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
