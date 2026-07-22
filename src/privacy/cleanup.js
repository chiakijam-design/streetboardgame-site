import { ensureLivePurchaseD1, getLivePurchaseDb } from '../live/purchases.js';

export const PRIVACY_RETENTION = Object.freeze({
  remoteGameHours: 24,
  liveGameHoursAfterEnd: 24,
  paidAssetDays: 30,
  pendingChannelVerificationDays: 90,
  expiredCreatorInviteDays: 90,
  operationsLogDays: 180,
  purchaseRecordYears: 7,
  ga4Months: 14,
  contactMonths: 12,
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runPrivacyCleanup(env, now = Date.now()) {
  const summary = {
    expiredGames: 0,
    deletedCreatorAssets: 0,
    expiredPurchaseAssets: 0,
    anonymizedPurchases: 0,
    anonymizedCheckoutOrders: 0,
    deletedPurchaseRecords: 0,
    deletedCheckoutOrders: 0,
    deletedRevenueEntries: 0,
    deletedPayoutBatches: 0,
    deletedStripeEvents: 0,
    deletedOperationsLogs: 0,
    deletedPendingVerifications: 0,
    deletedCreatorInvites: 0,
  };
  if (env?.REMOTE_DB) await cleanupGameDatabase(env, now, summary);
  if (getLivePurchaseDb(env)) await cleanupPurchaseDatabase(env, now, summary);
  return summary;
}

async function cleanupGameDatabase(env, now, summary) {
  for (let batch = 0; batch < 20; batch += 1) {
    const rows = await safeRows(env.REMOTE_DB, `
      SELECT code, payload FROM live_games WHERE expires_at < ? ORDER BY expires_at ASC LIMIT 100
    `, [now]);
    if (!rows.length) break;
    const codes = rows.map((row) => String(row.code));
    const creatorKeys = rows.flatMap((row) => creatorAssetKeys(row.payload));
    await deleteR2Keys(env.LIVE_MEDIA, creatorKeys);
    summary.deletedCreatorAssets += creatorKeys.length;
    const placeholders = codes.map(() => '?').join(',');
    await env.REMOTE_DB.prepare(`DELETE FROM live_votes WHERE code IN (${placeholders})`).bind(...codes).run();
    await env.REMOTE_DB.prepare(`DELETE FROM live_participants WHERE code IN (${placeholders})`).bind(...codes).run();
    await env.REMOTE_DB.prepare(`DELETE FROM live_games WHERE code IN (${placeholders}) AND expires_at < ?`).bind(...codes, now).run();
    summary.expiredGames += codes.length;
  }

  await safeRun(env.REMOTE_DB, 'DELETE FROM remote_rooms WHERE expires_at < ?', [now]);
  await safeRun(env.REMOTE_DB, 'DELETE FROM remote_rate_limits WHERE expires_at < ?', [now]);
  await safeRun(env.REMOTE_DB, 'DELETE FROM live_rate_limits WHERE expires_at < ?', [now]);
  await safeRun(env.REMOTE_DB, 'DELETE FROM live_reservations WHERE expires_at < ?', [now]);
  await safeRun(env.REMOTE_DB, 'DELETE FROM live_active_sessions WHERE expires_at < ?', [now]);
  const deletedLogs = await safeRun(
    env.REMOTE_DB,
    'DELETE FROM live_ops_events WHERE created_at < ?',
    [now - PRIVACY_RETENTION.operationsLogDays * DAY_MS],
  );
  summary.deletedOperationsLogs = changes(deletedLogs);
  await safeRun(env.REMOTE_DB, `
    UPDATE live_channel_verifications
    SET oauth_state_hash = NULL, oauth_state_expires_at = NULL, updated_at = ?
    WHERE oauth_state_expires_at IS NOT NULL AND oauth_state_expires_at < ?
  `, [now, now]);
  const deletedVerifications = await safeRun(env.REMOTE_DB, `
    DELETE FROM live_channel_verifications
    WHERE ownership_status = 'pending' AND created_at < ?
  `, [now - PRIVACY_RETENTION.pendingChannelVerificationDays * DAY_MS]);
  summary.deletedPendingVerifications = changes(deletedVerifications);
  const deletedInvites = await safeRun(env.REMOTE_DB, `
    DELETE FROM live_creator_invites
    WHERE (expires_at < ? OR revoked_at < ?)
  `, [now - PRIVACY_RETENTION.expiredCreatorInviteDays * DAY_MS, now - PRIVACY_RETENTION.expiredCreatorInviteDays * DAY_MS]);
  summary.deletedCreatorInvites = changes(deletedInvites);
}

async function cleanupPurchaseDatabase(env, now, summary) {
  await ensureLivePurchaseD1(env);
  const db = getLivePurchaseDb(env);
  for (let batch = 0; batch < 20; batch += 1) {
    const rows = await safeRows(db, `
      SELECT purchase_id, asset_key FROM live_result_entitlements
      WHERE available_until < ? AND (asset_key <> '' OR participant_name <> '' OR participant_id <> ''
        OR code <> '' OR purchaser_email_hash <> '')
      ORDER BY available_until ASC LIMIT 100
    `, [now]);
    if (!rows.length) break;
    const purchaseIds = rows.map((row) => String(row.purchase_id));
    const assetKeys = rows.map((row) => String(row.asset_key || '')).filter(Boolean);
    await deleteR2Keys(env.LIVE_MEDIA, assetKeys);
    const placeholders = purchaseIds.map(() => '?').join(',');
    await db.prepare(`
      UPDATE live_result_entitlements
      SET code = '', participant_id = '', participant_name = '', access_token_hash = '',
        purchaser_email_hash = '', asset_key = '',
        status = CASE WHEN status = 'active' THEN 'expired' ELSE status END, updated_at = ?
      WHERE purchase_id IN (${placeholders}) AND available_until < ?
    `).bind(now, ...purchaseIds, now).run();
    summary.expiredPurchaseAssets += assetKeys.length;
    summary.anonymizedPurchases += purchaseIds.length;
  }
  const purchaseCutoff = now - PRIVACY_RETENTION.purchaseRecordYears * 365 * DAY_MS;
  const deletedPurchases = await safeRun(
    db,
    'DELETE FROM live_result_entitlements WHERE purchased_at < ?',
    [purchaseCutoff],
  );
  summary.deletedPurchaseRecords = changes(deletedPurchases);
  const anonymizedOrders = await safeRun(db, `
    UPDATE live_checkout_orders
    SET participant_name = '', viewer_name = '', updated_at = ?
    WHERE paid_at IS NOT NULL AND paid_at < ? AND (participant_name <> '' OR viewer_name <> '')
  `, [now, now - PRIVACY_RETENTION.paidAssetDays * DAY_MS]);
  summary.anonymizedCheckoutOrders = changes(anonymizedOrders);
  const deletedOrders = await safeRun(db, 'DELETE FROM live_checkout_orders WHERE created_at < ?', [purchaseCutoff]);
  summary.deletedCheckoutOrders = changes(deletedOrders);
  await safeRun(db, `
    DELETE FROM live_payout_allocations
    WHERE revenue_entry_id IN (SELECT revenue_entry_id FROM live_revenue_entries WHERE created_at < ?)
  `, [purchaseCutoff]);
  const deletedRevenue = await safeRun(db, 'DELETE FROM live_revenue_entries WHERE created_at < ?', [purchaseCutoff]);
  summary.deletedRevenueEntries = changes(deletedRevenue);
  const deletedPayouts = await safeRun(db, 'DELETE FROM live_payout_batches WHERE created_at < ?', [purchaseCutoff]);
  summary.deletedPayoutBatches = changes(deletedPayouts);
  const deletedStripeEvents = await safeRun(
    db,
    'DELETE FROM live_stripe_events WHERE created_at < ?',
    [now - PRIVACY_RETENTION.operationsLogDays * DAY_MS],
  );
  summary.deletedStripeEvents = changes(deletedStripeEvents);
  await safeRun(db, 'DELETE FROM live_purchase_recovery_limits WHERE expires_at < ?', [now]);
}

function creatorAssetKeys(payload) {
  try {
    const creatorImage = JSON.parse(String(payload || '{}')).creatorImage || {};
    return [creatorImage.originalKey, creatorImage.previewKey, creatorImage.paidKey].filter(Boolean).map(String);
  } catch (error) {
    return [];
  }
}

async function deleteR2Keys(bucket, keys) {
  if (!keys.length) return;
  if (!bucket) throw new Error('privacy-r2-not-configured');
  for (let offset = 0; offset < keys.length; offset += 1000) {
    await bucket.delete(keys.slice(offset, offset + 1000));
  }
}

async function safeRows(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return result?.results || [];
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

async function safeRun(db, sql, bindings = []) {
  try {
    return await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

function isMissingTable(error) {
  return /no such table|does not exist/i.test(String(error?.message || error || ''));
}

function changes(result) {
  return Number(result?.meta?.changes || 0);
}
