import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIVACY_RETENTION, runPrivacyCleanup } from '../../src/privacy/cleanup.js';

test('プライバシー保存期間を固定し、Cron削除でD1匿名化とR2削除を同時に行う', async () => {
  assert.deepEqual(PRIVACY_RETENTION, {
    remoteGameHours: 24,
    liveGameHoursAfterEnd: 24,
    paidAssetDays: 30,
    youtubeCaptionDays: 30,
    pendingChannelVerificationDays: 90,
    expiredCreatorInviteDays: 90,
    operationsLogDays: 180,
    purchaseRecordYears: 7,
    ga4Months: 14,
    contactMonths: 12,
  });
  const now = 1_800_000_000_000;
  const gameDb = new CleanupDb('game', now);
  const purchaseDb = new CleanupDb('purchase', now);
  const deletedKeys = [];
  const summary = await runPrivacyCleanup({
    REMOTE_DB: gameDb,
    LIVE_PURCHASE_DB: purchaseDb,
    LIVE_MEDIA: { async delete(keys) { deletedKeys.push(...(Array.isArray(keys) ? keys : [keys])); } },
  }, now);

  assert.deepEqual(deletedKeys.sort(), [
    'live/123456/creator/original.webp',
    'live/123456/creator/paid.webp',
    'live/123456/creator/preview.webp',
    'live/results/purchase-old.svg',
    'live/results/purchase-recent.svg',
  ].sort());
  assert.equal(summary.expiredGames, 1);
  assert.equal(summary.deletedCreatorAssets, 3);
  assert.equal(summary.expiredPurchaseAssets, 2);
  assert.equal(summary.anonymizedPurchases, 2);
  assert.equal(summary.anonymizedCheckoutOrders, 1);
  assert.equal(summary.deletedPurchaseRecords, 1);
  assert.equal(summary.deletedCheckoutConsents, 1);
  assert.equal(summary.deletedCheckoutOrders, 1);
  assert.equal(summary.deletedStripeEvents, 2);
  assert.equal(summary.deletedOperationsLogs, 2);
  assert.equal(summary.deletedCaptionSources, 3);
  assert.equal(summary.deletedPendingVerifications, 1);
  assert.equal(summary.deletedCreatorInvites, 1);
  assert.equal(gameDb.games.length, 0);
  assert.equal(purchaseDb.purchases.length, 1);
  assert.equal(purchaseDb.purchases[0].participant_name, '');
  assert.equal(purchaseDb.purchases[0].purchaser_email_hash, '');
  assert.equal(purchaseDb.purchases[0].asset_key, '');
});

class CleanupDb {
  constructor(kind, now) {
    this.kind = kind;
    this.now = now;
    this.games = kind === 'game' ? [{
      code: '123456',
      payload: JSON.stringify({ creatorImage: {
        originalKey: 'live/123456/creator/original.webp',
        previewKey: 'live/123456/creator/preview.webp',
        paidKey: 'live/123456/creator/paid.webp',
      } }),
    }] : [];
    this.purchases = kind === 'purchase' ? [
      purchase('purchase-recent', 'live/results/purchase-recent.svg', now - 40 * 24 * 60 * 60 * 1000),
      purchase('purchase-old', 'live/results/purchase-old.svg', now - 8 * 365 * 24 * 60 * 60 * 1000),
    ] : [];
    this.checkoutOrders = kind === 'purchase' ? [{ order_id: 'order-old', participant_name: '視聴者', viewer_name: '視聴者', paid_at: now - 40 * 24 * 60 * 60 * 1000, created_at: now - 8 * 365 * 24 * 60 * 60 * 1000 }] : [];
    this.checkoutConsents = kind === 'purchase' ? [{ order_id: 'order-old' }] : [];
  }

  prepare(sql) {
    const db = this;
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    return {
      bindings: [],
      bind(...bindings) { this.bindings = bindings; return this; },
      async all() {
        if (/SELECT code, payload FROM live_games/i.test(normalized)) return { results: db.games.slice() };
        if (/SELECT purchase_id, asset_key FROM live_result_entitlements/i.test(normalized)) {
          return { results: db.purchases.filter((item) => item.asset_key || item.participant_name).map((item) => ({ ...item })) };
        }
        return { results: [] };
      },
      async run() {
        if (/DELETE FROM live_games/i.test(normalized)) db.games = [];
        if (/UPDATE live_result_entitlements SET code = ''/i.test(normalized)) {
          db.purchases = db.purchases.map((item) => ({
            ...item, code: '', participant_id: '', participant_name: '', access_token_hash: '',
            purchaser_email_hash: '', asset_key: '',
            status: item.status === 'active' ? 'expired' : item.status,
          }));
        }
        if (/DELETE FROM live_result_entitlements WHERE purchased_at/i.test(normalized)) {
          const before = db.purchases.length;
          db.purchases = db.purchases.filter((item) => item.purchased_at >= db.now - 7 * 365 * 24 * 60 * 60 * 1000);
          return { meta: { changes: before - db.purchases.length } };
        }
        if (/UPDATE live_checkout_orders SET participant_name = ''/i.test(normalized)) {
          db.checkoutOrders = db.checkoutOrders.map((item) => ({ ...item, participant_name: '', viewer_name: '' }));
          return { meta: { changes: db.checkoutOrders.length } };
        }
        if (/DELETE FROM live_checkout_orders WHERE created_at/i.test(normalized)) {
          const before = db.checkoutOrders.length;
          db.checkoutOrders = db.checkoutOrders.filter((item) => item.created_at >= db.now - 7 * 365 * 24 * 60 * 60 * 1000);
          return { meta: { changes: before - db.checkoutOrders.length } };
        }
        if (/DELETE FROM live_checkout_consents/i.test(normalized)) {
          const before = db.checkoutConsents.length;
          const expiredOrderIds = new Set(db.checkoutOrders.filter((item) => item.created_at < db.now - 7 * 365 * 24 * 60 * 60 * 1000).map((item) => item.order_id));
          db.checkoutConsents = db.checkoutConsents.filter((item) => !expiredOrderIds.has(item.order_id));
          return { meta: { changes: before - db.checkoutConsents.length } };
        }
        if (/DELETE FROM live_stripe_events/i.test(normalized)) return { meta: { changes: 2 } };
        if (/DELETE FROM live_ops_events/i.test(normalized)) return { meta: { changes: 2 } };
        if (/DELETE FROM live_youtube_caption_sources/i.test(normalized)) return { meta: { changes: 3 } };
        if (/DELETE FROM live_channel_verifications/i.test(normalized)) return { meta: { changes: 1 } };
        if (/DELETE FROM live_creator_invites/i.test(normalized)) return { meta: { changes: 1 } };
        return { meta: { changes: 0 } };
      },
    };
  }
}

function purchase(purchaseId, assetKey, purchasedAt) {
  return {
    purchase_id: purchaseId,
    code: '123456',
    participant_id: 'participant',
    participant_name: '視聴者',
    access_token_hash: 'hash',
    purchaser_email_hash: 'email-hash',
    stripe_payment_intent_id: `pi_${purchaseId}`,
    asset_key: assetKey,
    status: 'active',
    purchased_at: purchasedAt,
    available_until: purchasedAt + 30 * 24 * 60 * 60 * 1000,
  };
}
