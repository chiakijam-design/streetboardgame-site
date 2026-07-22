CREATE TABLE IF NOT EXISTS live_channel_verifications (
  verification_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  confirmation_code TEXT NOT NULL,
  ownership_status TEXT NOT NULL DEFAULT 'pending',
  ownership_method TEXT NOT NULL DEFAULT '',
  stripe_account_id TEXT NOT NULL DEFAULT '',
  stripe_identity_verified INTEGER NOT NULL DEFAULT 0,
  stripe_relationship_status TEXT NOT NULL DEFAULT 'pending',
  oauth_state_hash TEXT,
  oauth_state_expires_at INTEGER,
  verified_at INTEGER,
  reviewed_at INTEGER,
  reviewed_by TEXT NOT NULL DEFAULT '',
  request_ip TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_channel_verification_code
  ON live_channel_verifications (confirmation_code);

CREATE INDEX IF NOT EXISTS idx_live_channel_verification_channel
  ON live_channel_verifications (channel_id, ownership_status);

CREATE INDEX IF NOT EXISTS idx_live_channel_verification_oauth_state
  ON live_channel_verifications (oauth_state_hash, oauth_state_expires_at);

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
