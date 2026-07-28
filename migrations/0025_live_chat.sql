CREATE TABLE IF NOT EXISTS live_chat_messages (
  message_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'viewer',
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'chat',
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible',
  stripe_order_id TEXT UNIQUE,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room
  ON live_chat_messages (code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_sender
  ON live_chat_messages (code, participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_review
  ON live_chat_messages (status, updated_at DESC);
