-- LIVE_PURCHASE_DB専用。売上・70%分配・Connect送金の監査台帳。
CREATE TABLE IF NOT EXISTS live_revenue_entries (
  revenue_entry_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  channel_verification_id TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'jpy',
  gross_amount INTEGER NOT NULL,
  creator_amount INTEGER NOT NULL,
  platform_amount INTEGER NOT NULL,
  stripe_balance_transaction_id TEXT,
  stripe_fee_amount INTEGER,
  platform_net_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  paid_at INTEGER,
  available_at INTEGER,
  sale_payout_batch_id TEXT,
  offset_payout_batch_id TEXT,
  stripe_transfer_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_revenue_entries_account_status
  ON live_revenue_entries (stripe_account_id, currency, status, available_at);
CREATE INDEX IF NOT EXISTS idx_live_revenue_entries_paid
  ON live_revenue_entries (paid_at, status);

CREATE TABLE IF NOT EXISTS live_payout_batches (
  batch_id TEXT PRIMARY KEY,
  period_key TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'jpy',
  gross_sales_amount INTEGER NOT NULL,
  creator_sales_amount INTEGER NOT NULL,
  offset_amount INTEGER NOT NULL DEFAULT 0,
  transfer_amount INTEGER NOT NULL,
  order_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  stripe_transfer_id TEXT UNIQUE,
  failure_code TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  transferred_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE (period_key, stripe_account_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_live_payout_batches_status
  ON live_payout_batches (status, created_at DESC);

CREATE TABLE IF NOT EXISTS live_payout_allocations (
  batch_id TEXT NOT NULL,
  revenue_entry_id TEXT NOT NULL,
  allocation_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (batch_id, revenue_entry_id, allocation_type)
);

CREATE INDEX IF NOT EXISTS idx_live_payout_allocations_entry
  ON live_payout_allocations (revenue_entry_id, allocation_type);
