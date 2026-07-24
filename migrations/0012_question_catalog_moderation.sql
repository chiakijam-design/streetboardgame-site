CREATE TABLE IF NOT EXISTS question_catalog (
  question_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_ref TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'みんなのお題',
  choices_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  use_challenge INTEGER NOT NULL DEFAULT 0,
  use_live INTEGER NOT NULL DEFAULT 0,
  target_friend INTEGER NOT NULL DEFAULT 0,
  target_family INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_catalog_public
ON question_catalog (status, use_challenge, use_live, updated_at);

CREATE TABLE IF NOT EXISTS question_submissions (
  submission_id TEXT PRIMARY KEY,
  source_mode TEXT NOT NULL,
  source_question_id TEXT,
  title TEXT NOT NULL,
  choices_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  review_note TEXT,
  catalog_id TEXT,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_submissions_review
ON question_submissions (status, submitted_at);

CREATE TABLE IF NOT EXISTS question_submission_limits (
  rate_key TEXT PRIMARY KEY,
  question_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
