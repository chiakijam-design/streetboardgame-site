const trackedEvents = new Set();
const SESSION_KEY_PREFIX = 'watachan:analytics-event:v1:';

function browserWindow() {
  return typeof window === 'undefined' ? null : window;
}

function sessionKey(onceKey) {
  return `${SESSION_KEY_PREFIX}${String(onceKey)}`;
}

function wasTrackedInSession(onceKey) {
  try {
    return browserWindow()?.sessionStorage?.getItem(sessionKey(onceKey)) === '1';
  } catch (error) {
    return false;
  }
}

function rememberInSession(onceKey) {
  try {
    browserWindow()?.sessionStorage?.setItem(sessionKey(onceKey), '1');
  } catch (error) {
    // Analytics must never interrupt gameplay when storage is unavailable.
  }
}

export function trackAnalyticsEvent(name, params = {}, { onceKey = '', persistSession = false } = {}) {
  const target = browserWindow();
  if (!target || target.analyticsEnabled === false || typeof target.trackEvent !== 'function' || !name) return false;
  if (onceKey && (trackedEvents.has(onceKey) || (persistSession && wasTrackedInSession(onceKey)))) return false;
  try {
    target.trackEvent(name, params);
    if (onceKey) {
      trackedEvents.add(onceKey);
      if (persistSession) rememberInSession(onceKey);
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function trackPurchaseFromCheckout(checkout) {
  const orderId = String(checkout?.orderId || '').trim();
  const productType = String(checkout?.productType || '').trim();
  const currency = String(checkout?.currency || '').trim().toUpperCase();
  const amount = Number(checkout?.amount);
  if (checkout?.status !== 'paid' || !orderId || !['result_image', 'support'].includes(productType)
    || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(amount) || amount <= 0) return false;

  return trackAnalyticsEvent('purchase', {
    transaction_id: orderId,
    value: amount,
    currency,
    affiliation: 'Stripe',
    product_type: productType,
    items: [{
      item_id: productType,
      item_name: productType === 'result_image' ? 'LIVE result image' : 'LIVE support',
      item_category: 'live_challenge',
      price: amount,
      quantity: 1,
    }],
  }, {
    onceKey: `purchase:${orderId}`,
    persistSession: true,
  });
}

// Count players, not visits: call only after an answer has been accepted.
// GA4 Total users for game_play is the player metric; event count is not.
export function trackGamePlay(gameType, playerRole) {
  const roles = {
    challenge: ['creator', 'participant'],
    live_challenge: ['host', 'subject', 'viewer'],
  };
  if (!roles[gameType]?.includes(playerRole)) return false;
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return trackAnalyticsEvent('game_play', {
    game_type: gameType,
    play_mode: gameType === 'challenge' ? 'async' : 'live',
    player_role: playerRole,
    play_criteria: 'accepted_answer',
  }, {
    onceKey: `game_play:${day}:${gameType}:${playerRole}`,
    persistSession: true,
  });
}

export function resetAnalyticsEventTrackingForTests() {
  trackedEvents.clear();
}
