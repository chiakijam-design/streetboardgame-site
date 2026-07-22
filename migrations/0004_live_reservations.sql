CREATE TABLE IF NOT EXISTS live_reservations (
  code TEXT PRIMARY KEY,
  scheduled_at INTEGER NOT NULL,
  blocked_from INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_reservations_window
  ON live_reservations (blocked_from, blocked_until);

CREATE INDEX IF NOT EXISTS idx_live_reservations_expires_at
  ON live_reservations (expires_at);

CREATE TABLE IF NOT EXISTS live_active_sessions (
  lock_key TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
