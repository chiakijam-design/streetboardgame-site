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
