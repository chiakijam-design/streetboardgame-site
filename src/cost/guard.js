// Application operation budgets, NOT a Cloudflare account spending cap.
// UTC calendar months intentionally do not claim to match a billing cycle.
export const COST_POLICIES = Object.freeze({
  'overview-full': Object.freeze({ intervalMs: 60_000, interval: 60, day: 2000, month: 40000 }),
  'overview-pending': Object.freeze({ intervalMs: 60_000, interval: 120, day: 4000, month: 80000 }),
  social: Object.freeze({ intervalMs: 3_600_000, interval: 1, day: 24, month: 744 }),
});

export async function consumeCostBudget(env, scope, now = Date.now()) {
  const mode = String(env?.WATA_COST_GUARD_MODE || 'off');
  if (mode === 'off') return { allowed: true, enforced: false };
  const policy = COST_POLICIES[scope];
  if (mode !== 'enforce' || !policy || !Number.isSafeInteger(now) || now < 0) return unavailable();
  const stop = scope === 'social' ? env.WATA_COST_STOP_SOCIAL : env.WATA_COST_STOP_OVERVIEW;
  if (stop === 'true') return { allowed: false, status: 503, error: 'cost-guard-paused', retryAfter: 300 };
  const interval = Math.floor(now / policy.intervalMs) * policy.intervalMs;
  const day = Math.floor(now / 86400000) * 86400000;
  const date = new Date(now);
  const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  try {
    const row = await env.REMOTE_DB.prepare(`
      INSERT INTO wata_cost_budgets(scope, interval_start, interval_count, day_start, day_count, month_start, month_count)
      VALUES (?, ?, 1, ?, 1, ?, 1)
      ON CONFLICT(scope) DO UPDATE SET
        interval_count = CASE WHEN excluded.interval_start > interval_start THEN 1 ELSE interval_count + 1 END,
        day_count = CASE WHEN excluded.day_start > day_start THEN 1 ELSE day_count + 1 END,
        month_count = CASE WHEN excluded.month_start > month_start THEN 1 ELSE month_count + 1 END,
        interval_start = excluded.interval_start, day_start = excluded.day_start, month_start = excluded.month_start
      WHERE excluded.interval_start >= interval_start AND excluded.day_start >= day_start AND excluded.month_start >= month_start
        AND (excluded.interval_start > interval_start OR interval_count < ?)
        AND (excluded.day_start > day_start OR day_count < ?)
        AND (excluded.month_start > month_start OR month_count < ?)
      RETURNING scope
    `).bind(scope, interval, day, month, policy.interval, policy.day, policy.month).first();
    if (row) return { allowed: true, enforced: true };
    const current = await env.REMOTE_DB.prepare('SELECT * FROM wata_cost_budgets WHERE scope = ?').bind(scope).first();
    if (!current) return unavailable();
    const nextMonth = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    const retryAt = Math.max(
      current.interval_start > interval || current.interval_count >= policy.interval ? current.interval_start + policy.intervalMs : now,
      current.day_start > day || current.day_count >= policy.day ? current.day_start + 86400000 : now,
      current.month_start > month || current.month_count >= policy.month ? Math.max(nextMonth, current.month_start) : now,
    );
    return { allowed: false, status: 429, error: 'cost-guard-limit', retryAfter: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
  } catch {
    // No recursive operational logging on an unavailable budget database.
    return unavailable();
  }
}

function unavailable() {
  return { allowed: false, status: 503, error: 'cost-guard-unavailable', retryAfter: 60 };
}

export function costBudgetResponse(result) {
  return new Response(JSON.stringify({ error: result.error, retryAfter: result.retryAfter }), {
    status: result.status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store', 'retry-after': String(result.retryAfter) },
  });
}

export async function runBudgetedSocialPublishing(env, now, publish) {
  if (String(env?.SOCIAL_PUBLISHING_ENABLED || '').toLowerCase() !== 'true') return { enabled: false };
  // Use delivery time, not possibly stale scheduledTime: duplicate/backlogged
  // deliveries must not obtain fresh budgets by replaying historical timestamps.
  const admission = await consumeCostBudget(env, 'social', now);
  if (!admission.allowed) return { skipped: true, reason: admission.error };
  return publish(env, now);
}
