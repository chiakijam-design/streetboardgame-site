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
    ]).then(() => Promise.all([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_participant ON live_result_entitlements (code, participant_id, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_expiry ON live_result_entitlements (available_until, status)').run(),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_purchase_date ON live_result_entitlements (purchased_at)').run(),
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
