ALTER TABLE challenge_participants
ADD COLUMN ranking_consent_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_challenge_participants_public_ranking
ON challenge_participants (room_code, ranking_consent_at, completed_at, score);

CREATE TABLE IF NOT EXISTS challenge_question_stats (
  question_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_question_stats_popular
ON challenge_question_stats (play_count DESC, last_played_at DESC);
