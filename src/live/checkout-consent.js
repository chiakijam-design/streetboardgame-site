import { CHECKOUT_TERMS } from './checkout-terms-config.js';

export function assertCheckoutConsent(body) {
  if (body?.termsAccepted !== true
    || body?.termsVersion !== CHECKOUT_TERMS.version
    || body?.termsDocumentSha256 !== CHECKOUT_TERMS.documentSha256) {
    const error = new Error('checkout-terms-acceptance-required');
    error.status = 400;
    throw error;
  }
  return {
    termsVersion: CHECKOUT_TERMS.version,
    termsDocumentSha256: CHECKOUT_TERMS.documentSha256,
  };
}
