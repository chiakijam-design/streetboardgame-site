CREATE TABLE IF NOT EXISTS remote_rooms (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_remote_rooms_expires_at
  ON remote_rooms (expires_at);
