-- Separate operational metadata only. No participant/question mutation or backfill.
CREATE TABLE IF NOT EXISTS wata_cost_budgets (
  scope TEXT PRIMARY KEY,
  interval_start INTEGER NOT NULL,
  interval_count INTEGER NOT NULL,
  day_start INTEGER NOT NULL,
  day_count INTEGER NOT NULL,
  month_start INTEGER NOT NULL,
  month_count INTEGER NOT NULL
);
