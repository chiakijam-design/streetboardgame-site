CREATE TABLE IF NOT EXISTS question_weekly_activity (
  question_id TEXT NOT NULL,
  week_start INTEGER NOT NULL,
  mode TEXT NOT NULL,
  selected_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, week_start, mode)
);

CREATE INDEX IF NOT EXISTS idx_question_weekly_activity_recent
  ON question_weekly_activity (week_start, selected_count DESC);

CREATE TABLE IF NOT EXISTS question_live_option_weekly (
  question_id TEXT NOT NULL,
  week_start INTEGER NOT NULL,
  option_index INTEGER NOT NULL,
  answer_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (question_id, week_start, option_index)
);

CREATE INDEX IF NOT EXISTS idx_question_live_option_recent
  ON question_live_option_weekly (week_start, question_id);
