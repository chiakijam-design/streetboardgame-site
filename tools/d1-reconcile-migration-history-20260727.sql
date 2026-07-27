-- Production D1 migration-ledger reconciliation.
--
-- Run only after comparing the live sqlite_schema and data with migrations
-- 0011 through 0022. These migrations were applied historically by direct SQL,
-- so replaying them would fail on duplicate columns or repeat data rewrites.
--
-- The audit on 2026-07-27 found two missing, non-destructive indexes. Create
-- them first, then record the already-realized migrations in Wrangler's ledger.

CREATE INDEX IF NOT EXISTS idx_question_submissions_review
ON question_submissions (status, submitted_at);

CREATE INDEX IF NOT EXISTS idx_question_selection_priority
ON question_selection_stats (mode, shown_count, skip_count);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0011_challenge_ranking_library.sql'),
  ('0012_question_catalog_moderation.sql'),
  ('0013_question_safety_reports.sql'),
  ('0014_unify_question_catalog.sql'),
  ('0016_restore_common_question_overrides.sql'),
  ('0017_consolidate_legacy_question_ids.sql'),
  ('0018_challenge_board_comments.sql'),
  ('0019_add_held_question_candidates.sql'),
  ('0020_question_selection_stats.sql'),
  ('0021_add_more_held_question_candidates.sql'),
  ('0022_add_300_held_question_candidates.sql');
