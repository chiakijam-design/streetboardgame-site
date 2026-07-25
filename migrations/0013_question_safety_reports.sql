CREATE TABLE IF NOT EXISTS question_submission_flags (
  submission_id TEXT PRIMARY KEY,
  flags_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS question_reports (
  report_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  reported_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  UNIQUE (question_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_question_reports_question
ON question_reports (question_id, reported_at);
