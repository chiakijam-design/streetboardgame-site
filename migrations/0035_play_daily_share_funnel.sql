-- 2026-11-27 (Codex review 11/26 #2-13): anonymous daily counts of people who arrived from a shared link
-- and how far they went (opened -> joined -> finished answering -> made their own quiz).
-- Only the day (JST), the page language, the share channel and the step are stored.
-- No room code, token, name, answer, URL, IP or device data.
CREATE TABLE IF NOT EXISTS play_daily_share_funnel (
  day TEXT NOT NULL CHECK(day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  locale TEXT NOT NULL CHECK(length(locale) BETWEEN 2 AND 7),
  channel TEXT NOT NULL CHECK(channel IN ('line', 'x', 'whatsapp', 'copy', 'instagram', 'share', 'qr')),
  step TEXT NOT NULL CHECK(step IN ('arrived', 'joined', 'completed', 'created')),
  count INTEGER NOT NULL CHECK(count >= 0),
  PRIMARY KEY(day, locale, channel, step)
) WITHOUT ROWID;
