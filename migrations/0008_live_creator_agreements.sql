CREATE TABLE IF NOT EXISTS live_creator_agreements (
  agreement_id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  terms_document_sha256 TEXT NOT NULL,
  contracting_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  authority_confirmed INTEGER NOT NULL DEFAULT 0,
  privacy_confirmed INTEGER NOT NULL DEFAULT 0,
  accepted_at INTEGER NOT NULL,
  accepted_ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE (verification_id, terms_version, stripe_account_id)
);

CREATE INDEX IF NOT EXISTS idx_live_creator_agreements_verification
  ON live_creator_agreements (verification_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_creator_agreements_channel
  ON live_creator_agreements (channel_id, accepted_at DESC);
