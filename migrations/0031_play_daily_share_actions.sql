-- Anonymous daily counts of share-button presses. No room, token, name, IP or device data.
CREATE TABLE IF NOT EXISTS play_daily_share_actions (
  day TEXT NOT NULL CHECK(day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  surface TEXT NOT NULL CHECK(surface IN ('result', 'invite')),
  action TEXT NOT NULL CHECK(action IN ('native', 'copy', 'save', 'x', 'line', 'whatsapp', 'instagram-link', 'instagram')),
  count INTEGER NOT NULL CHECK(count >= 0),
  PRIMARY KEY(day, surface, action)
) WITHOUT ROWID;
