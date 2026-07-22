CREATE TABLE IF NOT EXISTS live_games (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_games_expires_at
  ON live_games (expires_at);

CREATE TABLE IF NOT EXISTS live_participants (
  code TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  participant_token TEXT NOT NULL,
  name TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (code, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_live_participants_code
  ON live_participants (code);

CREATE TABLE IF NOT EXISTS live_votes (
  code TEXT NOT NULL,
  question_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (code, question_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_live_votes_question
  ON live_votes (code, question_id);

CREATE TABLE IF NOT EXISTS live_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_rate_limits_expires_at
  ON live_rate_limits (expires_at);
