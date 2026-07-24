CREATE TABLE IF NOT EXISTS challenge_rooms (
  code TEXT PRIMARY KEY,
  creator_name TEXT NOT NULL,
  cards_json TEXT NOT NULL,
  answer_key_json TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_rooms_expires_at
ON challenge_rooms (expires_at);

CREATE TABLE IF NOT EXISTS challenge_participants (
  room_code TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  participant_token_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  answers_json TEXT,
  score INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  PRIMARY KEY (room_code, participant_id),
  UNIQUE (room_code, participant_token_hash),
  FOREIGN KEY (room_code) REFERENCES challenge_rooms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_room_score
ON challenge_participants (room_code, completed_at, score);
