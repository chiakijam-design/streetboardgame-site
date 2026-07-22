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
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_participant ON live_result_entitlements (code, participant_id, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_expiry ON live_result_entitlements (available_until, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_purchase_date ON live_result_entitlements (purchased_at)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_participant ON live_checkout_orders (code, participant_id, created_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_status ON live_checkout_orders (status, updated_at DESC)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_stripe_events_status ON live_stripe_events (status, updated_at DESC)').run(),
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
