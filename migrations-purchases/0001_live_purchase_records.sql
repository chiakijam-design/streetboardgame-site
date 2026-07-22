-- LIVE_PURCHASE_DB専用。ゲーム用REMOTE_DBには適用しない。
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
);

CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_participant
  ON live_result_entitlements (code, participant_id, status);

CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_expiry
  ON live_result_entitlements (available_until, status);

CREATE INDEX IF NOT EXISTS idx_live_result_entitlements_purchase_date
  ON live_result_entitlements (purchased_at);
