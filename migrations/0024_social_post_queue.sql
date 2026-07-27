CREATE TABLE IF NOT EXISTS social_posts (
  post_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'ja',
  post_text TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  external_id TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  estimated_cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_social_posts_due
  ON social_posts (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_social_posts_published
  ON social_posts (platform, published_at DESC);

CREATE TABLE IF NOT EXISTS social_billing_usage (
  period_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  estimated_cost_micro_usd INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (period_key, platform)
);
