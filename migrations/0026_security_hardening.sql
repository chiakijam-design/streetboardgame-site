-- Security hardening: quarantine workflow, hashed capabilities, revocable admin sessions,
-- idempotent selection telemetry, and report review data.

ALTER TABLE question_catalog ADD COLUMN quarantined_at INTEGER;
ALTER TABLE question_catalog ADD COLUMN quarantine_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE question_catalog ADD COLUMN previous_status TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS question_report_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS question_reporter_restrictions (
  reporter_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS question_selection_events (
  event_key TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  question_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  event TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_selection_events_ip
  ON question_selection_events (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_selection_events_device
  ON question_selection_events (device_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS live_admin_sessions (
  session_id_hash TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_live_admin_sessions_active
  ON live_admin_sessions (revoked_at, expires_at DESC);

ALTER TABLE live_participants ADD COLUMN participant_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_live_participants_token_hash
  ON live_participants (code, participant_token_hash);

CREATE TABLE IF NOT EXISTS live_chat_reports (
  report_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  message_id TEXT NOT NULL,
  reporter_hash TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE (message_id, reporter_hash)
);

CREATE INDEX IF NOT EXISTS idx_live_chat_reports_review
  ON live_chat_reports (code, message_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_reporter_restrictions (
  reporter_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER
);
