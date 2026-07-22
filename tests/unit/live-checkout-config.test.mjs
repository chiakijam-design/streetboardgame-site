import test from 'node:test';
import assert from 'node:assert/strict';

import {
  liveResultImageCheckoutConfigured,
  liveSupportCheckoutConfigured,
} from '../../src/live/checkout-config.js';

test('応援金Checkoutは購入D1とStripeだけで有効になり、画像販売は追加設定を要求する', () => {
  const supportEnv = {
    LIVE_PURCHASE_DB: {},
    STRIPE_SECRET_KEY: 'sk_test_checkout_config',
  };
  assert.equal(liveSupportCheckoutConfigured(supportEnv), true);
  assert.equal(liveResultImageCheckoutConfigured(supportEnv), false);

  const resultImageEnv = {
    ...supportEnv,
    LIVE_MEDIA: {},
    IMAGES: {},
    LIVE_PURCHASE_ACCESS_SECRET: 'a'.repeat(32),
  };
  assert.equal(liveResultImageCheckoutConfigured(resultImageEnv), true);
  assert.equal(liveSupportCheckoutConfigured({ ...supportEnv, STRIPE_SECRET_KEY: '' }), false);
});
