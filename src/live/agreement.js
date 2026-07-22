import { CREATOR_TERMS } from './creator-agreement-config.js';
import { requireChannelVerification } from './ownership.js';

export async function getCreatorAgreement(request, env, verificationId) {
  const verification = await requireChannelVerification(request, env, verificationId);
  const agreement = await findCurrentAgreement(env, verification);
  return json(agreementResponse(verification, agreement));
}

export async function acceptCreatorAgreement(request, env, verificationId) {
  const verification = await requireChannelVerification(request, env, verificationId);
  if (verification.ownership_status !== 'verified') throw agreementError('channel-ownership-required', 409);
  if (!validStripeAccountId(verification.stripe_account_id)) throw agreementError('stripe-account-registration-required', 409);
  const body = await request.json().catch(() => ({}));
  if (body.termsVersion !== CREATOR_TERMS.version || body.termsDocumentSha256 !== CREATOR_TERMS.documentSha256) {
    throw agreementError('creator-terms-stale', 409);
  }
  const contractingName = normalizeText(body.contractingName, 120);
  const contactEmail = normalizeEmail(body.contactEmail);
  if (contractingName.length < 2) throw agreementError('contracting-name-required', 400);
  if (!contactEmail) throw agreementError('contract-contact-email-required', 400);
  if (body.confirmTerms !== true || body.confirmAuthority !== true || body.confirmPrivacy !== true) {
    throw agreementError('creator-agreement-confirmation-required', 400);
  }
  const existing = await findCurrentAgreement(env, verification);
  if (existing) return json(agreementResponse(verification, existing));
  const agreementId = crypto.randomUUID();
  const acceptedAt = Date.now();
  await env.REMOTE_DB.prepare(`
    INSERT OR IGNORE INTO live_creator_agreements (
      agreement_id, verification_id, channel_id, stripe_account_id, terms_version,
      terms_document_sha256, contracting_name, contact_email, authority_confirmed,
      privacy_confirmed, accepted_at, accepted_ip, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
  `).bind(
    agreementId,
    verification.verification_id,
    verification.channel_id,
    verification.stripe_account_id,
    CREATOR_TERMS.version,
    CREATOR_TERMS.documentSha256,
    contractingName,
    contactEmail,
    acceptedAt,
    clientIp(request),
    String(request.headers.get('user-agent') || '').slice(0, 500),
    acceptedAt,
  ).run();
  const agreement = await findCurrentAgreement(env, verification);
  return json(agreementResponse(verification, agreement), 201);
}

async function findCurrentAgreement(env, verification) {
  if (!validStripeAccountId(verification.stripe_account_id)) return null;
  return env.REMOTE_DB.prepare(`
    SELECT agreement_id, terms_version, terms_document_sha256, contracting_name,
      contact_email, accepted_at, stripe_account_id
    FROM live_creator_agreements
    WHERE verification_id = ? AND channel_id = ? AND stripe_account_id = ?
      AND terms_version = ? AND terms_document_sha256 = ?
    ORDER BY accepted_at DESC LIMIT 1
  `).bind(
    verification.verification_id,
    verification.channel_id,
    verification.stripe_account_id,
    CREATOR_TERMS.version,
    CREATOR_TERMS.documentSha256,
  ).first();
}

function agreementResponse(verification, agreement) {
  return {
    terms: CREATOR_TERMS,
    ownershipVerified: verification.ownership_status === 'verified',
    stripeAccountRegistered: validStripeAccountId(verification.stripe_account_id),
    stripeAccountMasked: maskStripeAccountId(verification.stripe_account_id),
    readyToAccept: verification.ownership_status === 'verified' && validStripeAccountId(verification.stripe_account_id),
    accepted: Boolean(agreement),
    agreement: agreement ? {
      agreementId: agreement.agreement_id,
      termsVersion: agreement.terms_version,
      termsDocumentSha256: agreement.terms_document_sha256,
      contractingName: agreement.contracting_name,
      contactEmailMasked: maskEmail(agreement.contact_email),
      acceptedAt: Number(agreement.accepted_at),
      stripeAccountMasked: maskStripeAccountId(agreement.stripe_account_id),
    } : null,
  };
}

function validStripeAccountId(value) {
  return /^acct_[A-Za-z0-9]+$/.test(String(value || ''));
}

function normalizeText(value, maxLength) {
  return String(value || '').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/gu, '')
    .replace(/\s+/gu, ' ').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function maskStripeAccountId(value) {
  const text = String(value || '');
  return validStripeAccountId(text) ? `${text.slice(0, 5)}••••${text.slice(-4)}` : '';
}

function maskEmail(value) {
  const [local = '', domain = ''] = String(value || '').split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
}

function clientIp(request) {
  return String(request.headers.get('cf-connecting-ip') || '').slice(0, 64);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function agreementError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
