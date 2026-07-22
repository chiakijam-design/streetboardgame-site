import { hasLiveRealtime, loadLiveRealtimeStats } from './realtime.js';
import { ensureLivePurchaseD1, getLivePurchaseDb } from './purchases.js';
import { listLiveCreatorInvites } from './security.js';
import { listChannelVerifications } from './ownership.js';
import { getLiveRevenueOverview } from './revenue-ledger.js';

let opsReadyPromise = null;

export async function ensureLiveOpsD1(env) {
  if (!env?.REMOTE_DB) return false;
  if (!opsReadyPromise) {
    opsReadyPromise = Promise.all([
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_ops_events (
          event_id TEXT PRIMARY KEY, category TEXT NOT NULL, severity TEXT NOT NULL,
          event_type TEXT NOT NULL, code TEXT NOT NULL DEFAULT '', purchase_id TEXT NOT NULL DEFAULT '',
          external_id TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL, acknowledged_at INTEGER, acknowledged_by TEXT NOT NULL DEFAULT ''
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_system_status (
          status_key TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'normal', title TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT ''
        )
      `).run(),
    ]).then(() => Promise.all([
      env.REMOTE_DB.prepare('CREATE INDEX IF NOT EXISTS idx_live_ops_events_created ON live_ops_events (created_at DESC)').run(),
      env.REMOTE_DB.prepare('CREATE INDEX IF NOT EXISTS idx_live_ops_events_category ON live_ops_events (category, created_at DESC)').run(),
      env.REMOTE_DB.prepare('CREATE INDEX IF NOT EXISTS idx_live_ops_events_external ON live_ops_events (category, event_type, external_id)').run(),
    ])).catch((error) => {
      opsReadyPromise = null;
      throw error;
    });
  }
  await opsReadyPromise;
  return true;
}

export async function getLiveSystemStatus(env) {
  const emergencyMode = normalizeMode(env?.LIVE_EMERGENCY_MODE);
  if (emergencyMode !== 'normal') {
    return {
      mode: emergencyMode,
      title: String(env?.LIVE_EMERGENCY_TITLE || 'LIVEサービスからのお知らせ').slice(0, 80),
      message: String(env?.LIVE_EMERGENCY_MESSAGE || '現在、LIVEサービスを一時停止しています。').slice(0, 500),
      source: 'environment',
      updatedAt: 0,
    };
  }
  if (!await ensureLiveOpsD1(env)) return { mode: 'normal', title: '', message: '', source: 'default', updatedAt: 0 };
  const row = await env.REMOTE_DB.prepare(`
    SELECT mode, title, message, updated_at FROM live_system_status WHERE status_key = 'live' LIMIT 1
  `).first();
  return row ? {
    mode: normalizeMode(row.mode),
    title: String(row.title || ''),
    message: String(row.message || ''),
    source: 'database',
    updatedAt: Number(row.updated_at) || 0,
  } : { mode: 'normal', title: '', message: '', source: 'default', updatedAt: 0 };
}

export async function getLiveHealth(env, now = Date.now()) {
  const checkedAt = Number(now) || Date.now();
  const realtimeConfigured = hasLiveRealtime(env);
  if (!env?.REMOTE_DB || !realtimeConfigured) {
    return {
      ok: false,
      state: 'unavailable',
      checkedAt,
      checks: { worker: true, database: false, realtime: realtimeConfigured },
    };
  }
  try {
    const databaseProbe = await env.REMOTE_DB.prepare('SELECT 1 AS ok').first();
    const databaseOk = Number(databaseProbe?.ok) === 1;
    const status = await getLiveSystemStatus(env);
    const acceptingTraffic = status.mode !== 'maintenance';
    return {
      ok: databaseOk && acceptingTraffic,
      state: !databaseOk ? 'unavailable' : status.mode,
      checkedAt,
      checks: { worker: true, database: databaseOk, realtime: true },
    };
  } catch (error) {
    return {
      ok: false,
      state: 'unavailable',
      checkedAt,
      checks: { worker: true, database: false, realtime: true },
    };
  }
}

export async function setLiveSystemStatus(env, input, operator = 'admin') {
  if (!await ensureLiveOpsD1(env)) throw opsError('live-storage-not-configured', 500);
  const mode = normalizeMode(input?.mode);
  const title = String(input?.title || '').trim().slice(0, 80);
  const message = String(input?.message || '').trim().slice(0, 500);
  if (mode !== 'normal' && (!title || !message)) throw opsError('status-message-required', 400);
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_system_status (status_key, mode, title, message, updated_at, updated_by)
    VALUES ('live', ?, ?, ?, ?, ?)
    ON CONFLICT(status_key) DO UPDATE SET mode = excluded.mode, title = excluded.title,
      message = excluded.message, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).bind(mode, title, message, now, String(operator || 'admin').slice(0, 80)).run();
  await recordLiveOpsEvent(env, {
    category: 'operations', severity: mode === 'normal' ? 'info' : 'warning',
    eventType: 'system-status-changed', message: mode === 'normal' ? '障害告知を解除しました。' : `${title}: ${message}`,
    metadata: { mode },
  });
  return getLiveSystemStatus(env);
}

export async function recordLiveOpsEvent(env, input) {
  if (!await ensureLiveOpsD1(env)) return null;
  const category = normalizeText(input?.category, 40, 'application');
  const eventType = normalizeText(input?.eventType, 80, 'unknown');
  const externalId = normalizeText(input?.externalId, 160);
  if (category === 'stripe' && externalId) {
    const existing = await env.REMOTE_DB.prepare(`
      SELECT event_id, created_at FROM live_ops_events
      WHERE category = 'stripe' AND event_type = ? AND external_id = ? LIMIT 1
    `).bind(eventType, externalId).first();
    if (existing) return { eventId: existing.event_id, createdAt: Number(existing.created_at), deduplicated: true };
  }
  const event = {
    eventId: crypto.randomUUID(),
    category,
    severity: ['info', 'warning', 'critical'].includes(input?.severity) ? input.severity : 'warning',
    eventType,
    code: normalizeText(input?.code, 20),
    purchaseId: normalizeText(input?.purchaseId, 100),
    externalId,
    message: normalizeText(input?.message, 500, '詳細なし'),
    metadata: JSON.stringify(safeMetadata(input?.metadata)),
    createdAt: Date.now(),
  };
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_ops_events
      (event_id, category, severity, event_type, code, purchase_id, external_id, message, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(event.eventId, event.category, event.severity, event.eventType, event.code, event.purchaseId,
    event.externalId, event.message, event.metadata, event.createdAt).run();
  if (event.severity === 'critical' || event.category === 'stripe') {
    await notifyLiveOpsWebhook(env, event).catch(() => {});
  }
  return event;
}

export async function acknowledgeLiveOpsEvent(env, eventId, operator = 'admin') {
  if (!await ensureLiveOpsD1(env)) throw opsError('live-storage-not-configured', 500);
  const now = Date.now();
  const result = await env.REMOTE_DB.prepare(`
    UPDATE live_ops_events SET acknowledged_at = ?, acknowledged_by = ?
    WHERE event_id = ? AND acknowledged_at IS NULL
  `).bind(now, String(operator || 'admin').slice(0, 80), eventId).run();
  if (Number(result?.meta?.changes || 0) !== 1) throw opsError('ops-event-not-found', 404);
  return { eventId, acknowledgedAt: now };
}

export async function getLiveOpsOverview(env) {
  if (!await ensureLiveOpsD1(env)) throw opsError('live-storage-not-configured', 500);
  const now = Date.now();
  const purchaseDb = getLivePurchaseDb(env);
  const entitlementsPromise = purchaseDb
    ? ensureLivePurchaseD1(env).then(() => purchaseDb.prepare(`
        SELECT purchase_id, code, participant_id, participant_name, stripe_payment_intent_id,
          status, purchased_at, available_until, updated_at
        FROM live_result_entitlements ORDER BY updated_at DESC LIMIT 100
      `).all())
    : Promise.resolve({ results: [] });
  const checkoutsPromise = purchaseDb
    ? ensureLivePurchaseD1(env).then(() => purchaseDb.prepare(`
        SELECT o.order_id, o.product_type, o.code, o.participant_name, o.amount, o.currency,
          o.creator_amount, o.platform_amount, o.purchase_id, o.stripe_checkout_session_id,
          o.stripe_payment_intent_id, o.stripe_refund_id, c.terms_version, c.terms_document_sha256,
          c.terms_accepted_at, o.status, o.paid_at, o.refunded_at, o.created_at, o.updated_at
        FROM live_checkout_orders o
        LEFT JOIN live_checkout_consents c ON c.order_id = o.order_id
        ORDER BY o.updated_at DESC LIMIT 100
      `).all())
    : Promise.resolve({ results: [] });
  const revenuePromise = purchaseDb
    ? ensureLivePurchaseD1(env).then(() => getLiveRevenueOverview(purchaseDb, now))
    : Promise.resolve({ policy: {}, balances: [], ledger: [], batches: [] });
  const [reservations, activeSessions, entitlements, checkouts, revenue, events, recentCounts, status, creatorInvites, channelVerifications] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT r.code, r.scheduled_at, r.blocked_from, r.blocked_until, r.expires_at, g.payload
      FROM live_reservations r LEFT JOIN live_games g ON g.code = r.code
      WHERE r.expires_at >= ? ORDER BY r.scheduled_at ASC LIMIT 100
    `).bind(now).all(),
    env.REMOTE_DB.prepare(`
      SELECT a.code, a.started_at, a.expires_at, g.payload
      FROM live_active_sessions a LEFT JOIN live_games g ON g.code = a.code
      WHERE a.expires_at >= ? ORDER BY a.started_at DESC LIMIT 10
    `).bind(now).all(),
    entitlementsPromise,
    checkoutsPromise,
    revenuePromise,
    env.REMOTE_DB.prepare(`
      SELECT event_id, category, severity, event_type, code, purchase_id, external_id,
        message, metadata, created_at, acknowledged_at, acknowledged_by
      FROM live_ops_events ORDER BY created_at DESC LIMIT 100
    `).all(),
    env.REMOTE_DB.prepare(`
      SELECT category, severity, COUNT(*) AS event_count FROM live_ops_events
      WHERE created_at >= ? GROUP BY category, severity
    `).bind(now - 15 * 60 * 1000).all(),
    getLiveSystemStatus(env),
    listLiveCreatorInvites(env),
    listChannelVerifications(env),
  ]);
  const active = (activeSessions.results || []).map(parseGameRow);
  const realtime = [];
  if (hasLiveRealtime(env)) {
    for (const item of active) {
      const stats = await loadLiveRealtimeStats(env, item.code).catch(() => null);
      const ws = stats?.webSocket || {};
      const denominator = Math.max(1, Number(ws.disconnected) || 0);
      realtime.push({
        code: item.code,
        participantCount: Number(stats?.participantCount) || 0,
        ...ws,
        unexpectedDisconnectRate: (Number(ws.unexpectedDisconnects) || 0) / denominator,
      });
    }
  }
  return {
    generatedAt: now,
    status,
    reservations: (reservations.results || []).map(parseGameRow),
    activeSessions: active,
    entitlements: entitlements.results || [],
    checkouts: checkouts.results || [],
    revenue,
    events: (events.results || []).map((item) => ({ ...item, metadata: parseJson(item.metadata) })),
    recentEventCounts: recentCounts.results || [],
    realtime,
    creatorInvites,
    channelVerifications,
    infrastructure: {
      d1Configured: Boolean(env.REMOTE_DB),
      purchaseD1Configured: Boolean(purchaseDb),
      durableObjectsConfigured: hasLiveRealtime(env),
      privateR2Configured: Boolean(env.LIVE_MEDIA),
      imagesBindingConfigured: Boolean(env.IMAGES),
      alertWebhookConfigured: Boolean(env.LIVE_OPS_ALERT_WEBHOOK_URL),
      stripeWebhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
      stripeCheckoutConfigured: /^sk_(test|live)_[A-Za-z0-9_]+$/.test(String(env.STRIPE_SECRET_KEY || '')),
    },
  };
}

async function notifyLiveOpsWebhook(env, event) {
  const url = String(env?.LIVE_OPS_ALERT_WEBHOOK_URL || '');
  if (!/^https:\/\//i.test(url)) return false;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `[Streetboardgame LIVE][${event.severity}] ${event.eventType}: ${event.message}`,
      event: { ...event, metadata: parseJson(event.metadata) },
    }),
  });
  if (!response.ok) throw new Error(`ops-webhook-${response.status}`);
  return true;
}

function parseGameRow(row) {
  const game = parseJson(row.payload) || {};
  return {
    code: row.code,
    title: String(game.title || ''),
    channelName: String(game.channelName || game.subjectName || ''),
    phase: String(game.phase || 'unknown'),
    scheduledAt: Number(row.scheduled_at || game.scheduledAt) || 0,
    blockedFrom: Number(row.blocked_from) || 0,
    blockedUntil: Number(row.blocked_until || row.expires_at) || 0,
    startedAt: Number(row.started_at) || 0,
    expiresAt: Number(row.expires_at || game.expiresAt) || 0,
    participantLimit: Number(game.participantLimit) || 0,
    creatorImageModerationStatus: game.creatorImage?.moderationStatus
      || (game.creatorImage?.previewKey ? 'approved' : 'none'),
  };
}

function normalizeMode(value) {
  return ['normal', 'degraded', 'maintenance'].includes(value) ? value : 'normal';
}

function normalizeText(value, maxLength, fallback = '') {
  return String(value || fallback).trim().slice(0, maxLength);
}

function safeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [String(key).slice(0, 80),
    typeof item === 'string' ? item.slice(0, 500) : typeof item === 'number' || typeof item === 'boolean' ? item : null]));
}

function parseJson(value) {
  try { return JSON.parse(String(value || '{}')); } catch (error) { return {}; }
}

function opsError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
