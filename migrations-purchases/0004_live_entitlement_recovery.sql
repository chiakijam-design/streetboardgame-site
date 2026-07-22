-- LIVE_PURCHASE_DB専用。購入メールは平文保存せず、HMAC-SHA-256だけを30日間保持する。
ALTER TABLE live_result_entitlements
  ADD COLUMN purchaser_email_hash TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS live_purchase_recovery_limits (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
