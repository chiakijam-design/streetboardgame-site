-- LIVE_PURCHASE_DB専用。ゲーム用REMOTE_DBには適用しない。
CREATE TABLE IF NOT EXISTS live_checkout_orders (
  order_id TEXT PRIMARY KEY,
  checkout_request_id TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL,
  code TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  viewer_name TEXT NOT NULL,
  channel_verification_id TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'jpy',
  creator_amount INTEGER NOT NULL,
  platform_amount INTEGER NOT NULL,
  purchase_id TEXT,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_checkout_url TEXT,
  stripe_checkout_expires_at INTEGER,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'creating',
  paid_at INTEGER,
  refunded_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_participant
  ON live_checkout_orders (code, participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_checkout_orders_status
  ON live_checkout_orders (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS live_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_live_stripe_events_status
  ON live_stripe_events (status, updated_at DESC);
