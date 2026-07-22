const STRIPE_API_ORIGIN = 'https://api.stripe.com';
const CHECKOUT_TTL_SECONDS = 35 * 60;

export async function createLiveCheckoutSession(env, input, now = Date.now()) {
  const origin = new URL(input.requestUrl).origin;
  const successUrl = new URL('/live', origin);
  successUrl.searchParams.set('room', input.code);
  successUrl.searchParams.set('checkout', 'success');
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  const cancelUrl = new URL('/live', origin);
  cancelUrl.searchParams.set('room', input.code);
  cancelUrl.searchParams.set('checkout', 'cancelled');
  const params = new URLSearchParams({
    mode: 'payment',
    locale: 'ja',
    client_reference_id: input.orderId,
    success_url: successUrl.toString().replace('%7BCHECKOUT_SESSION_ID%7D', '{CHECKOUT_SESSION_ID}'),
    cancel_url: cancelUrl.toString(),
    expires_at: String(Math.floor(now / 1000) + CHECKOUT_TTL_SECONDS),
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'jpy',
    'line_items[0][price_data][unit_amount]': String(input.amount),
    'line_items[0][price_data][tax_behavior]': 'inclusive',
    'line_items[0][price_data][product_data][name]': input.productName,
    'metadata[live_order_id]': input.orderId,
    'metadata[live_product_type]': input.productType,
    'metadata[live_room_code]': input.code,
    'metadata[live_terms_version]': input.termsVersion,
    'metadata[live_terms_sha256]': input.termsDocumentSha256,
    'metadata[live_terms_accepted_at]': String(input.termsAcceptedAt),
    'payment_intent_data[transfer_group]': input.orderId,
    'payment_intent_data[metadata][live_order_id]': input.orderId,
    'payment_intent_data[metadata][live_product_type]': input.productType,
    'payment_intent_data[metadata][live_room_code]': input.code,
    'payment_intent_data[metadata][live_terms_version]': input.termsVersion,
    'payment_intent_data[metadata][live_terms_sha256]': input.termsDocumentSha256,
    'payment_intent_data[metadata][live_terms_accepted_at]': String(input.termsAcceptedAt),
  });
  if (input.productType === 'result_image') {
    params.set(
      'payment_intent_data[description]',
      `${input.productName} / 再ダウンロード: ${origin}/live?recover=1 / 注文番号: ${input.orderId}`,
    );
  }
  return stripeRequest(env, '/v1/checkout/sessions', params, `checkout-${input.orderId}`);
}

export async function createLiveStripeRefund(env, input) {
  const params = new URLSearchParams({
    payment_intent: input.paymentIntentId,
    reason: input.reason,
    'metadata[live_order_id]': input.orderId,
  });
  return stripeRequest(env, '/v1/refunds', params, `refund-${input.orderId}`);
}

export async function retrieveLiveStripeBalanceTransaction(env, transactionId) {
  if (!/^txn_[A-Za-z0-9_]+$/.test(String(transactionId || ''))) {
    throw stripeError('stripe-balance-transaction-invalid', 400);
  }
  return stripeGet(env, `/v1/balance_transactions/${encodeURIComponent(transactionId)}`);
}

export async function retrieveLiveStripeCharge(env, chargeId) {
  if (!/^ch_[A-Za-z0-9_]+$/.test(String(chargeId || ''))) {
    throw stripeError('stripe-charge-invalid', 400);
  }
  return stripeGet(env, `/v1/charges/${encodeURIComponent(chargeId)}`);
}

export async function createLiveCreatorTransfer(env, input) {
  if (!Number.isSafeInteger(input.amount) || input.amount < 5000) {
    throw stripeError('stripe-transfer-amount-invalid', 400);
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(String(input.destination || ''))) {
    throw stripeError('stripe-transfer-destination-invalid', 400);
  }
  const params = new URLSearchParams({
    amount: String(input.amount),
    currency: String(input.currency || 'jpy').toLowerCase(),
    destination: input.destination,
    transfer_group: `live-payout-${input.periodKey}`,
    'metadata[live_payout_batch_id]': input.batchId,
    'metadata[live_payout_period]': input.periodKey,
    'metadata[live_revenue_share]': '70-percent',
  });
  return stripeRequest(env, '/v1/transfers', params, `payout-${input.batchId}`);
}

async function stripeRequest(env, path, params, idempotencyKey) {
  const secret = String(env.STRIPE_SECRET_KEY || '');
  if (!/^sk_(test|live)_[A-Za-z0-9_]+$/.test(secret)) throw stripeError('stripe-secret-key-not-configured', 503);
  const fetcher = typeof env.STRIPE_FETCH === 'function' ? env.STRIPE_FETCH : fetch;
  const headers = {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/x-www-form-urlencoded',
    'idempotency-key': idempotencyKey,
  };
  if (env.STRIPE_API_VERSION) headers['stripe-version'] = String(env.STRIPE_API_VERSION);
  const response = await fetcher(`${STRIPE_API_ORIGIN}${path}`, { method: 'POST', headers, body: params.toString() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = stripeError('stripe-api-request-failed', 502);
    error.stripeCode = String(data?.error?.code || data?.error?.type || '').slice(0, 80);
    throw error;
  }
  return data;
}

async function stripeGet(env, path) {
  const secret = String(env.STRIPE_SECRET_KEY || '');
  if (!/^sk_(test|live)_[A-Za-z0-9_]+$/.test(secret)) throw stripeError('stripe-secret-key-not-configured', 503);
  const fetcher = typeof env.STRIPE_FETCH === 'function' ? env.STRIPE_FETCH : fetch;
  const headers = { authorization: `Bearer ${secret}` };
  if (env.STRIPE_API_VERSION) headers['stripe-version'] = String(env.STRIPE_API_VERSION);
  const response = await fetcher(`${STRIPE_API_ORIGIN}${path}`, { method: 'GET', headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = stripeError('stripe-api-request-failed', 502);
    error.stripeCode = String(data?.error?.code || data?.error?.type || '').slice(0, 80);
    throw error;
  }
  return data;
}

function stripeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
