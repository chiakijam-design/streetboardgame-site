-- 2026-11-15: LIVE (ended 2026-10-23) is removed together with its tables (owner decision).
-- A full copy of every dropped table was exported before this migration
-- (AI-HANDOFF/records/backup/wata-live-20261115/). No LIVE purchase was ever completed.
-- Shared infrastructure that used LIVE-named tables moves to neutral names:
--   live_rate_limits    -> rate_limits     (challenge, contact, operator sign-in limits)
--   live_admin_sessions -> admin_sessions  (/question-ops sign-in)
--   live_ops_events     -> Workers Logs    (no table)
CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id_hash TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions (revoked_at, expires_at DESC);

DROP TABLE IF EXISTS live_active_sessions;
DROP TABLE IF EXISTS live_admin_sessions;
DROP TABLE IF EXISTS live_channel_verifications;
DROP TABLE IF EXISTS live_chat_messages;
DROP TABLE IF EXISTS live_chat_reports;
DROP TABLE IF EXISTS live_creator_agreements;
DROP TABLE IF EXISTS live_creator_invites;
DROP TABLE IF EXISTS live_games;
DROP TABLE IF EXISTS live_image_transform_usage;
DROP TABLE IF EXISTS live_ops_events;
DROP TABLE IF EXISTS live_participants;
DROP TABLE IF EXISTS live_rate_limits;
DROP TABLE IF EXISTS live_reporter_restrictions;
DROP TABLE IF EXISTS live_reservations;
DROP TABLE IF EXISTS live_result_entitlements;
DROP TABLE IF EXISTS live_system_status;
DROP TABLE IF EXISTS live_votes;
DROP TABLE IF EXISTS live_youtube_caption_sources;
DROP TABLE IF EXISTS play_daily_live_streams;
DROP TABLE IF EXISTS question_live_option_weekly;
