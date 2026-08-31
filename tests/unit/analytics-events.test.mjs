import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resetAnalyticsEventTrackingForTests,
  trackAnalyticsEvent,
  trackPurchaseFromCheckout,
} from '../../src/analytics/events.js';

function installWindow() {
  const events = [];
  const storage = new Map();
  globalThis.window = {
    trackEvent(name, params) {
      events.push({ name, params });
    },
    sessionStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
  };
  resetAnalyticsEventTrackingForTests();
  return { events, storage };
}

test.afterEach(() => {
  delete globalThis.window;
  resetAnalyticsEventTrackingForTests();
});

test('tracking is safe when analytics is unavailable', () => {
  assert.equal(trackAnalyticsEvent('game_start', { game_type: 'challenge' }), false);
});

test('tracking exclusion does not consume a once key', () => {
  const { events } = installWindow();
  window.analyticsEnabled = false;
  assert.equal(trackAnalyticsEvent('purchase', {}, { onceKey: 'purchase:1', persistSession: true }), false);
  window.analyticsEnabled = true;
  assert.equal(trackAnalyticsEvent('purchase', {}, { onceKey: 'purchase:1', persistSession: true }), true);
  assert.equal(events.length, 1);
});

test('once events are not sent twice', () => {
  const { events } = installWindow();
  assert.equal(trackAnalyticsEvent('game_result', { score: 10 }, { onceKey: 'result:1' }), true);
  assert.equal(trackAnalyticsEvent('game_result', { score: 10 }, { onceKey: 'result:1' }), false);
  assert.equal(events.length, 1);
});

test('paid Stripe status produces one GA4 purchase with matching value and transaction', () => {
  const { events } = installWindow();
  const checkout = {
    status: 'paid',
    orderId: 'order_123',
    productType: 'support',
    amount: 480,
    currency: 'jpy',
  };
  assert.equal(trackPurchaseFromCheckout(checkout), true);
  assert.equal(trackPurchaseFromCheckout(checkout), false);
  resetAnalyticsEventTrackingForTests();
  assert.equal(trackPurchaseFromCheckout(checkout), false);
  assert.deepEqual(events, [{
    name: 'purchase',
    params: {
      transaction_id: 'order_123',
      value: 480,
      currency: 'JPY',
      affiliation: 'Stripe',
      product_type: 'support',
      items: [{
        item_id: 'support',
        item_name: 'LIVE support',
        item_category: 'live_challenge',
        price: 480,
        quantity: 1,
      }],
    },
  }]);
});

test('unpaid or incomplete checkout never produces purchase', () => {
  const { events } = installWindow();
  assert.equal(trackPurchaseFromCheckout({
    status: 'pending', orderId: 'order_1', productType: 'support', amount: 180, currency: 'JPY',
  }), false);
  assert.equal(trackPurchaseFromCheckout({
    status: 'paid', orderId: '', productType: 'support', amount: 180, currency: 'JPY',
  }), false);
  assert.equal(trackPurchaseFromCheckout({
    status: 'paid', orderId: 'order_2', productType: 'unknown', amount: 180, currency: 'JPY',
  }), false);
  assert.equal(trackPurchaseFromCheckout({
    status: 'paid', orderId: 'order_3', productType: 'support', amount: 0, currency: 'JPY',
  }), false);
  assert.equal(events.length, 0);
});
