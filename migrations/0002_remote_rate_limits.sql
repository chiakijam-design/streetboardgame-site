CREATE TABLE IF NOT EXISTS remote_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remote_rate_limits_expires_at
  ON remote_rate_limits (expires_at);
