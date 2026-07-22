CREATE TABLE IF NOT EXISTS live_ops_events (
  event_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  event_type TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  purchase_id TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  acknowledged_at INTEGER,
  acknowledged_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_live_ops_events_created
  ON live_ops_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_ops_events_category
  ON live_ops_events (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_ops_events_external
  ON live_ops_events (category, event_type, external_id);

CREATE TABLE IF NOT EXISTS live_system_status (
  status_key TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
