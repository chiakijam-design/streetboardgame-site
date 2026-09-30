-- Long-lived, non-identifying daily counts. Dates are Asia/Tokyo.
-- No backfill: pre-installation data is incomplete because source rows expire.
CREATE TABLE IF NOT EXISTS play_daily_counts (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  mode TEXT NOT NULL CHECK (mode IN ('challenge', 'live')),
  metric TEXT NOT NULL CHECK (metric IN ('rooms_created', 'rooms_started', 'rooms_completed', 'participants_joined', 'plays_started', 'plays_completed', 'retries', 'votes_recorded')),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (day, mode, metric)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS play_daily_meta (
  key TEXT PRIMARY KEY CHECK (key IN ('schema_version', 'd1_started_at', 'realtime_started_at')),
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO play_daily_meta VALUES ('schema_version', '1');
INSERT OR IGNORE INTO play_daily_meta VALUES ('d1_started_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- Temporary retry cursors, random per-shard (not per-user), without room/participant IDs.
-- Purged seven days after the existing room expiry. Only totals survive.
CREATE TABLE IF NOT EXISTS play_daily_live_streams (
  stream_id TEXT NOT NULL,
  day TEXT NOT NULL,
  plays_started INTEGER NOT NULL CHECK (plays_started >= 0),
  plays_completed INTEGER NOT NULL CHECK (plays_completed >= 0),
  votes_recorded INTEGER NOT NULL CHECK (votes_recorded >= 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (stream_id, day)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_play_daily_streams_expiry ON play_daily_live_streams (expires_at);

-- At most the configured questions for one participant are read on a polling vote.
CREATE INDEX IF NOT EXISTS idx_live_votes_participant ON live_votes (code, participant_id, question_id);
CREATE TRIGGER IF NOT EXISTS play_daily_challenge_room
AFTER INSERT ON challenge_rooms
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.created_at / 1000.0, 'unixepoch', '+9 hours'), 'challenge', 'rooms_created', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_challenge_join
AFTER INSERT ON challenge_participants
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.created_at / 1000.0, 'unixepoch', '+9 hours'), 'challenge', 'participants_joined', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_challenge_start
AFTER UPDATE OF answers_json ON challenge_participants
WHEN (OLD.answers_json IS NULL OR OLD.answers_json = '[]') AND json_valid(NEW.answers_json) AND json_array_length(NEW.answers_json) > 0
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) / 1000.0, 'unixepoch', '+9 hours'), 'challenge', 'plays_started', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_challenge_complete
AFTER UPDATE OF completed_at ON challenge_participants
WHEN OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.completed_at / 1000.0, 'unixepoch', '+9 hours'), 'challenge', 'plays_completed', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_challenge_retry
AFTER UPDATE OF completed_at ON challenge_participants
WHEN OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) / 1000.0, 'unixepoch', '+9 hours'), 'challenge', 'retries', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_live_room
AFTER INSERT ON live_games
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.created_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'rooms_created', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_live_start
AFTER UPDATE OF payload ON live_games
WHEN json_valid(OLD.payload) AND json_valid(NEW.payload) AND json_extract(OLD.payload, '$.phase') = 'lobby' AND json_extract(NEW.payload, '$.phase') IN ('voting', 'answering')
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'rooms_started', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_live_complete
AFTER UPDATE OF payload ON live_games
WHEN json_valid(OLD.payload) AND json_valid(NEW.payload) AND json_extract(OLD.payload, '$.phase') <> 'complete' AND json_extract(NEW.payload, '$.phase') = 'complete'
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'rooms_completed', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_live_join
AFTER INSERT ON live_participants
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.joined_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'participants_joined', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_live_vote
AFTER INSERT ON live_votes
WHEN EXISTS (
  SELECT 1 FROM live_games g, json_each(g.payload, '$.questions') q
  WHERE g.code = NEW.code AND json_extract(q.value, '$.id') = NEW.question_id
)
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'votes_recorded', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  SELECT date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'plays_started', 1
  WHERE (SELECT COUNT(*) FROM live_votes WHERE code = NEW.code AND participant_id = NEW.participant_id) = 1
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  SELECT date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'plays_completed', 1
  FROM live_games g
  WHERE g.code = NEW.code AND json_array_length(g.payload, '$.questions') > 0
    AND (SELECT COUNT(*) FROM live_votes v
      JOIN json_each(g.payload, '$.questions') q ON json_extract(q.value, '$.id') = v.question_id
      WHERE v.code = NEW.code AND v.participant_id = NEW.participant_id)
      = json_array_length(g.payload, '$.questions')
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_stream_insert
AFTER INSERT ON play_daily_live_streams
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'plays_started', NEW.plays_started)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'plays_completed', NEW.plays_completed)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'votes_recorded', NEW.votes_recorded)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_stream_update
AFTER UPDATE ON play_daily_live_streams
BEGIN
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'plays_started', NEW.plays_started - OLD.plays_started)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'plays_completed', NEW.plays_completed - OLD.plays_completed)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
  INSERT INTO play_daily_counts (day, mode, metric, count)
  VALUES (NEW.day, 'live', 'votes_recorded', NEW.votes_recorded - OLD.votes_recorded)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + excluded.count;
END;
