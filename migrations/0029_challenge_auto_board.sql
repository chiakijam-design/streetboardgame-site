-- New attempts opt into the disclosed automatic-board policy via the client.
-- No UPDATE/backfill: previously private results must stay private.
ALTER TABLE challenge_participants ADD COLUMN board_auto INTEGER NOT NULL DEFAULT 0;
ALTER TABLE challenge_participants ADD COLUMN board_best_score INTEGER;
ALTER TABLE challenge_participants ADD COLUMN board_first_at INTEGER;
ALTER TABLE challenge_participants ADD COLUMN board_best_at INTEGER;
