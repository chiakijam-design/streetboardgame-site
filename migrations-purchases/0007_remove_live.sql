-- 2026-11-15: LIVE purchases are removed (owner decision). No purchase was ever
-- completed (0 orders, 0 entitlements; 3 Stripe webhook records). A full copy
-- was exported first (AI-HANDOFF/records/backup/wata-live-20261115/purchases-*).
-- The Worker no longer binds this database.
DROP TABLE IF EXISTS live_checkout_consents;
DROP TABLE IF EXISTS live_purchase_recovery_limits;
DROP TABLE IF EXISTS live_payout_allocations;
DROP TABLE IF EXISTS live_payout_batches;
DROP TABLE IF EXISTS live_revenue_entries;
DROP TABLE IF EXISTS live_stripe_events;
DROP TABLE IF EXISTS live_checkout_orders;
DROP TABLE IF EXISTS live_result_entitlements;
