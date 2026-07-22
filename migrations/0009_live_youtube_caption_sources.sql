CREATE TABLE IF NOT EXISTS live_youtube_caption_sources (
  channel_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  transcript_sha256 TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  auto_generated INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (channel_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_live_youtube_caption_sources_expiry
  ON live_youtube_caption_sources (expires_at);
