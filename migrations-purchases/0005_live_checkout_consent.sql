-- 金銭授受前の利用規約同意を、注文と同じ購入履歴専用D1へ保存する。
CREATE TABLE IF NOT EXISTS live_checkout_consents (
  order_id TEXT PRIMARY KEY,
  terms_version TEXT NOT NULL,
  terms_document_sha256 TEXT NOT NULL,
  terms_accepted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
