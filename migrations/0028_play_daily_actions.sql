-- Additional anonymous operation counts. No historical backfill or identifiers.
CREATE TABLE IF NOT EXISTS play_daily_actions (
  day TEXT NOT NULL CHECK(day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  mode TEXT NOT NULL CHECK(mode IN ('challenge', 'live')),
  metric TEXT NOT NULL CHECK(metric IN ('result_image_ready', 'result_image_save_requested', 'answer_report_viewed', 'role_swap_started', 'answers_published', 'chat_messages_sent')),
  count INTEGER NOT NULL CHECK(count >= 0),
  PRIMARY KEY(day, mode, metric)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS play_daily_actions_meta (
  key TEXT PRIMARY KEY CHECK(key IN ('schema_version', 'started_at')),
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO play_daily_actions_meta VALUES ('schema_version', '1');
INSERT OR IGNORE INTO play_daily_actions_meta VALUES ('started_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TRIGGER IF NOT EXISTS play_daily_answer_publish
AFTER UPDATE OF payload ON live_games
WHEN json_valid(OLD.payload) AND json_valid(NEW.payload)
 AND ((json_extract(OLD.payload, '$.phase') = 'voting' AND json_extract(NEW.payload, '$.phase') = 'reveal')
   OR (json_extract(OLD.payload, '$.phase') = 'review-question' AND json_extract(NEW.payload, '$.phase') = 'review-answer'))
BEGIN
  INSERT INTO play_daily_actions (day, mode, metric, count)
  VALUES (date(NEW.updated_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'answers_published', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + 1;
END;
CREATE TRIGGER IF NOT EXISTS play_daily_chat_send
AFTER INSERT ON live_chat_messages
WHEN NEW.message_type = 'chat'
BEGIN
  INSERT INTO play_daily_actions (day, mode, metric, count)
  VALUES (date(NEW.created_at / 1000.0, 'unixepoch', '+9 hours'), 'live', 'chat_messages_sent', 1)
  ON CONFLICT(day, mode, metric) DO UPDATE SET count = count + 1;
END;
