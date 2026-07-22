export function liveSupportCheckoutConfigured(env) {
  return Boolean(
    env.LIVE_PURCHASE_DB
    && /^sk_(test|live)_[A-Za-z0-9_]+$/.test(String(env.STRIPE_SECRET_KEY || '')),
  );
}

export function liveResultImageCheckoutConfigured(env) {
  const purchaseSecret = String(env.LIVE_PURCHASE_ACCESS_SECRET || env.LIVE_DOWNLOAD_SIGNING_SECRET || '');
  return Boolean(
    liveSupportCheckoutConfigured(env) && env.LIVE_MEDIA && env.IMAGES && purchaseSecret.length >= 32,
  );
}
