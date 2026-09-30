-- Read-only, aggregate-only queries for the recurring diagnostic.
-- No source game, vote, participant or purchase rows are returned.
SELECT key, value FROM play_daily_meta ORDER BY key;
SELECT day, mode, metric, count FROM play_daily_counts ORDER BY day, mode, metric;
SELECT substr(day, 1, 7) AS month_jst, mode, metric, SUM(count) AS count
FROM play_daily_counts GROUP BY month_jst, mode, metric ORDER BY month_jst, mode, metric;
SELECT COUNT(*) AS retry_cursor_count, MIN(day) AS first_cursor_day, MAX(day) AS last_cursor_day
FROM play_daily_live_streams;
