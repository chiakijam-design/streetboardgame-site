CREATE TABLE IF NOT EXISTS question_selection_stats (
  question_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  shown_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_shown_at INTEGER,
  last_skipped_at INTEGER,
  PRIMARY KEY (question_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_question_selection_priority
  ON question_selection_stats (mode, shown_count, skip_count);
