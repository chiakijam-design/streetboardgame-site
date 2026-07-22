CREATE TABLE IF NOT EXISTS live_creator_invites (
  invite_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  reviewed_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_live_creator_invites_channel
  ON live_creator_invites (channel_id, status);

CREATE INDEX IF NOT EXISTS idx_live_creator_invites_expiry
  ON live_creator_invites (expires_at, status);
