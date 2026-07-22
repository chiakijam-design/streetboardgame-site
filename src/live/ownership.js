import { fetchOwnedYouTubeChannels, fetchYouTubeDataProfile } from './youtube.js';

const VERIFY_TOKEN_HEADER = 'x-live-verification-token';

export async function createChannelVerification(request, env) {
  requireD1(env);
  const body = await request.json().catch(() => ({}));
  const profile = await fetchYouTubeDataProfile(body.channelUrl, env);
  const verificationId = randomHex(16);
  const accessToken = randomHex(24);
  const confirmationCode = `SBLV-${randomHex(4).toUpperCase()}-${randomHex(4).toUpperCase()}`;
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_channel_verifications (
      verification_id, channel_id, channel_name, channel_url, access_token_hash,
      confirmation_code, ownership_status, ownership_method, stripe_relationship_status,
      created_at, updated_at, request_ip
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', '', 'pending', ?, ?, ?)
  `).bind(
    verificationId,
    profile.channelId,
    profile.channelName,
    profile.channelUrl,
    await sha256(accessToken),
    confirmationCode,
    now,
    now,
    clientIp(request),
  ).run();
  return json({
    verificationId,
    accessToken,
    channelId: profile.channelId,
    channelName: profile.channelName,
    channelUrl: profile.channelUrl,
    confirmationCode,
    ownershipStatus: 'pending',
    stripeRelationshipStatus: 'pending',
    canSellPaid: false,
  }, 201);
}

export async function getChannelVerification(request, env, verificationId) {
  const row = await requireVerification(request, env, verificationId);
  return json(publicVerification(row));
}

export async function verifyChannelDescription(request, env, verificationId) {
  const row = await requireVerification(request, env, verificationId);
  const profile = await fetchYouTubeDataProfile(`https://www.youtube.com/channel/${row.channel_id}`, env);
  if (!String(profile.description || '').includes(row.confirmation_code)) {
    throw ownershipError('youtube-confirmation-code-not-found', 409);
  }
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = 'verified', ownership_method = 'description', verified_at = ?, updated_at = ?
    WHERE verification_id = ?
  `).bind(now, now, verificationId).run();
  return getChannelVerification(request, env, verificationId);
}

export async function requestManualReview(request, env, verificationId) {
  await requireVerification(request, env, verificationId);
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = 'manual_pending', ownership_method = 'manual', updated_at = ?
    WHERE verification_id = ?
  `).bind(Date.now(), verificationId).run();
  return getChannelVerification(request, env, verificationId);
}

export async function startYouTubeOAuth(request, env, verificationId) {
  await requireVerification(request, env, verificationId);
  const clientId = String(env.YOUTUBE_OAUTH_CLIENT_ID || '');
  const redirectUri = String(env.YOUTUBE_OAUTH_REDIRECT_URI || '');
  if (!clientId || !redirectUri) throw ownershipError('youtube-oauth-not-configured', 503);
  const state = randomHex(32);
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET oauth_state_hash = ?, oauth_state_expires_at = ?, updated_at = ?
    WHERE verification_id = ?
  `).bind(await sha256(state), expiresAt, Date.now(), verificationId).run();
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', clientId);
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('access_type', 'online');
  authorizationUrl.searchParams.set('include_granted_scopes', 'true');
  return json({ authorizationUrl: authorizationUrl.toString(), expiresAt });
}

export async function completeYouTubeOAuth(request, env) {
  requireD1(env);
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!state || !code) throw ownershipError('youtube-oauth-callback-invalid', 400);
  const row = await env.REMOTE_DB.prepare(`
    SELECT * FROM live_channel_verifications
    WHERE oauth_state_hash = ? AND oauth_state_expires_at > ?
  `).bind(await sha256(state), Date.now()).first();
  if (!row) throw ownershipError('youtube-oauth-state-invalid', 400);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: String(env.YOUTUBE_OAUTH_CLIENT_ID || ''),
      client_secret: String(env.YOUTUBE_OAUTH_CLIENT_SECRET || ''),
      redirect_uri: String(env.YOUTUBE_OAUTH_REDIRECT_URI || ''),
      grant_type: 'authorization_code',
      code,
    }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) throw ownershipError('youtube-oauth-token-failed', 502);
  const ownedChannels = await fetchOwnedYouTubeChannels(token.access_token);
  const ownsTarget = ownedChannels.some(({ channelId }) => channelId === row.channel_id);
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.access_token)}`, { method: 'POST' }).catch(() => {});
  if (!ownsTarget) throw ownershipError('youtube-channel-not-owned', 403);
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = 'verified', ownership_method = 'oauth', verified_at = ?,
        oauth_state_hash = NULL, oauth_state_expires_at = NULL, updated_at = ?
    WHERE verification_id = ?
  `).bind(now, now, row.verification_id).run();
  return new Response(successHtml(row.channel_name), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function reviewChannelVerification(request, env, verificationId) {
  requireD1(env);
  const body = await request.json().catch(() => ({}));
  const ownershipStatus = ['verified', 'rejected', 'manual_pending'].includes(body.ownershipStatus)
    ? body.ownershipStatus
    : 'manual_pending';
  const stripeRelationshipStatus = ['verified', 'rejected', 'pending'].includes(body.stripeRelationshipStatus)
    ? body.stripeRelationshipStatus
    : 'pending';
  const stripeAccountId = /^acct_[A-Za-z0-9]+$/.test(String(body.stripeAccountId || '')) ? String(body.stripeAccountId) : '';
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = ?, ownership_method = CASE WHEN ? = 'verified' THEN 'manual' ELSE ownership_method END,
        stripe_account_id = ?, stripe_identity_verified = ?, stripe_relationship_status = ?,
        verified_at = CASE WHEN ? = 'verified' THEN COALESCE(verified_at, ?) ELSE verified_at END,
        reviewed_at = ?, reviewed_by = 'admin', updated_at = ?
    WHERE verification_id = ?
  `).bind(
    ownershipStatus,
    ownershipStatus,
    stripeAccountId,
    body.stripeIdentityVerified === true ? 1 : 0,
    stripeRelationshipStatus,
    ownershipStatus,
    now,
    now,
    now,
    verificationId,
  ).run();
  const row = await env.REMOTE_DB.prepare('SELECT * FROM live_channel_verifications WHERE verification_id = ?').bind(verificationId).first();
  if (!row) throw ownershipError('verification-not-found', 404);
  return json(publicVerification(row));
}

export async function assertPaidChannelApproved(env, verificationId, channelId) {
  requireD1(env);
  if (!verificationId) throw ownershipError('paid-channel-verification-required', 403);
  const row = await env.REMOTE_DB.prepare(`
    SELECT ownership_status, stripe_relationship_status, stripe_identity_verified, channel_id
    FROM live_channel_verifications WHERE verification_id = ?
  `).bind(verificationId).first();
  if (!row || row.channel_id !== channelId || row.ownership_status !== 'verified'
    || row.stripe_relationship_status !== 'verified' || Number(row.stripe_identity_verified) !== 1) {
    throw ownershipError('paid-channel-verification-required', 403);
  }
}

async function requireVerification(request, env, verificationId) {
  requireD1(env);
  const token = request.headers.get(VERIFY_TOKEN_HEADER) || '';
  if (!token) throw ownershipError('verification-forbidden', 403);
  const row = await env.REMOTE_DB.prepare('SELECT * FROM live_channel_verifications WHERE verification_id = ?').bind(verificationId).first();
  if (!row || !timingSafeEqual(row.access_token_hash, await sha256(token))) throw ownershipError('verification-forbidden', 403);
  return row;
}

function publicVerification(row) {
  const canSellPaid = row.ownership_status === 'verified'
    && row.stripe_relationship_status === 'verified'
    && Number(row.stripe_identity_verified) === 1;
  return {
    verificationId: row.verification_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelUrl: row.channel_url,
    confirmationCode: row.confirmation_code,
    ownershipStatus: row.ownership_status,
    ownershipMethod: row.ownership_method || '',
    stripeRelationshipStatus: row.stripe_relationship_status,
    stripeIdentityVerified: Number(row.stripe_identity_verified) === 1,
    canSellPaid,
    verifiedAt: row.verified_at || undefined,
    updatedAt: row.updated_at,
  };
}

function requireD1(env) {
  if (!env.REMOTE_DB) throw ownershipError('live-d1-required', 503);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomHex(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function clientIp(request) {
  return String(request.headers.get('cf-connecting-ip') || '').slice(0, 64);
}

function successHtml(channelName) {
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>所有確認完了</title><body><main><h1>チャンネル所有確認が完了しました</h1><p>${escapeHtml(channelName)} の確認結果を保存しました。この画面を閉じて元の画面へ戻ってください。</p></main></body></html>`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function ownershipError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
