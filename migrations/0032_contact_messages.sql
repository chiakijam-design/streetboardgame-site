-- 2026-11-14: our own contact form, replacing Formspree. Messages from the Wata site and from
-- webpersonalitytest.com are kept here first, then mailed to the operator through Resend, so a
-- lost or filtered email never loses a message. No raw IP address is stored; repeated sends are
-- counted with hashed keys in live_rate_limits. Rows are deleted 12 months after receipt by Cron.
-- verdict: ok, or bot (hidden field filled / sent within 3 seconds; stored only, never mailed).
-- mail_status: not_sent, sending, sent, failed or skipped_limit (daily mail cap reached).
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL CHECK(site IN ('wata', 'minna')),
  created_at INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  extra_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(extra_json)),
  verdict TEXT NOT NULL CHECK(verdict IN ('ok', 'bot')),
  mail_status TEXT NOT NULL,
  resend_id TEXT
);
CREATE INDEX IF NOT EXISTS contact_messages_created ON contact_messages(created_at);
