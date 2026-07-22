import { fetchOwnedYouTubeCaptionSources, fetchOwnedYouTubeChannels, fetchYouTubeDataProfile } from './youtube.js';
import { requireLiveCreatorInvite } from './security.js';
import { CREATOR_TERMS } from './creator-agreement-config.js';

const VERIFY_TOKEN_HEADER = 'x-live-verification-token';
const CAPTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function createChannelVerification(request, env) {
  requireD1(env);
  const body = await request.json().catch(() => ({}));
  const profile = await fetchYouTubeDataProfile(body.channelUrl, env);
  await requireLiveCreatorInvite(request, env, profile.channelId);
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
    creatorAgreementAccepted: false,
    canSellPaid: false,
  }, 201);
}

export async function getChannelVerification(request, env, verificationId) {
  const row = await requireVerification(request, env, verificationId);
  return json(publicVerification(row));
}

export async function listChannelVerifications(env, limit = 100) {
  requireD1(env);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const result = await env.REMOTE_DB.prepare(`
    SELECT v.verification_id, v.channel_id, v.channel_name, v.channel_url, v.ownership_status,
      v.ownership_method, v.stripe_account_id, v.stripe_identity_verified,
      v.stripe_relationship_status, v.verified_at, v.reviewed_at, v.created_at, v.updated_at,
      a.agreement_id, a.contracting_name, a.accepted_at AS agreement_accepted_at
    FROM live_channel_verifications v
    LEFT JOIN live_creator_agreements a
      ON a.verification_id = v.verification_id AND a.stripe_account_id = v.stripe_account_id
      AND a.terms_version = ? AND a.terms_document_sha256 = ?
    ORDER BY v.updated_at DESC LIMIT ?
  `).bind(CREATOR_TERMS.version, CREATOR_TERMS.documentSha256, safeLimit).all();
  return (result.results || []).map(adminVerification);
}

export async function verifyChannelDescription(request, env, verificationId) {
  const row = await requireVerification(request, env, verificationId);
  assertVerificationOpen(row);
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
  const row = await requireVerification(request, env, verificationId);
  assertVerificationOpen(row);
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = 'manual_pending', ownership_method = 'manual', updated_at = ?
    WHERE verification_id = ?
  `).bind(Date.now(), verificationId).run();
  return getChannelVerification(request, env, verificationId);
}

export async function startYouTubeOAuth(request, env, verificationId) {
  const verification = await requireVerification(request, env, verificationId);
  if (verification.ownership_status === 'rejected') throw ownershipError('verification-rejected', 409);
  const clientId = String(env.YOUTUBE_OAUTH_CLIENT_ID || '');
  const clientSecret = String(env.YOUTUBE_OAUTH_CLIENT_SECRET || '');
  const redirectUri = String(env.YOUTUBE_OAUTH_REDIRECT_URI || '');
  if (!clientId || !clientSecret || !redirectUri) throw ownershipError('youtube-oauth-not-configured', 503);
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
  authorizationUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.force-ssl');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('access_type', 'online');
  authorizationUrl.searchParams.set('include_granted_scopes', 'true');
  return json({ authorizationUrl: authorizationUrl.toString(), expiresAt });
}

export async function completeYouTubeOAuth(request, env) {
  requireD1(env);
  if (!env.YOUTUBE_OAUTH_CLIENT_ID || !env.YOUTUBE_OAUTH_CLIENT_SECRET || !env.YOUTUBE_OAUTH_REDIRECT_URI) {
    throw ownershipError('youtube-oauth-not-configured', 503);
  }
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  if (!state || !code) throw ownershipError('youtube-oauth-callback-invalid', 400);
  const row = await env.REMOTE_DB.prepare(`
    SELECT * FROM live_channel_verifications
    WHERE oauth_state_hash = ? AND oauth_state_expires_at > ?
  `).bind(await sha256(state), Date.now()).first();
  if (!row) throw ownershipError('youtube-oauth-state-invalid', 400);
  if (row.ownership_status === 'rejected') throw ownershipError('verification-rejected', 409);
  const oauthFetch = typeof env.YOUTUBE_OAUTH_FETCH === 'function' ? env.YOUTUBE_OAUTH_FETCH : fetch;
  const tokenResponse = await oauthFetch('https://oauth2.googleapis.com/token', {
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
  let captionSources = [];
  try {
    const ownedChannels = await fetchOwnedYouTubeChannels(token.access_token, oauthFetch);
    const ownsTarget = ownedChannels.some(({ channelId }) => channelId === row.channel_id);
    if (!ownsTarget) throw ownershipError('youtube-channel-not-owned', 403);
    const profile = await fetchYouTubeDataProfile(`https://www.youtube.com/channel/${row.channel_id}`, env);
    captionSources = await fetchOwnedYouTubeCaptionSources(profile, token.access_token, oauthFetch);
    await replaceCaptionSources(env, row.channel_id, captionSources);
  } catch (error) {
    if (error.message === 'youtube-channel-not-owned' || error.message === 'youtube-oauth-api-failed') throw error;
    // 所有確認は成功させる。字幕がない・字幕APIが一時失敗した場合はメタデータ生成へ戻す。
    captionSources = [];
  } finally {
    await oauthFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token.access_token)}`, { method: 'POST' }).catch(() => {});
  }
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = 'verified', ownership_method = 'oauth', verified_at = ?,
        oauth_state_hash = NULL, oauth_state_expires_at = NULL, updated_at = ?
    WHERE verification_id = ?
  `).bind(now, now, row.verification_id).run();
  return new Response(successHtml(row.channel_name, captionSources.length), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function reviewChannelVerification(request, env, verificationId) {
  requireD1(env);
  const body = await request.json().catch(() => ({}));
  const current = await env.REMOTE_DB.prepare('SELECT * FROM live_channel_verifications WHERE verification_id = ?')
    .bind(verificationId).first();
  if (!current) throw ownershipError('verification-not-found', 404);
  const ownershipStatus = body.ownershipStatus === undefined
    ? current.ownership_status
    : normalizeReviewStatus(body.ownershipStatus, ['verified', 'rejected', 'manual_pending'], 'invalid-ownership-status');
  const stripeRelationshipStatus = body.stripeRelationshipStatus === undefined
    ? current.stripe_relationship_status
    : normalizeReviewStatus(body.stripeRelationshipStatus, ['verified', 'rejected', 'pending'], 'invalid-stripe-relationship-status');
  const requestedStripeAccountId = body.stripeAccountId === undefined ? current.stripe_account_id : body.stripeAccountId;
  const stripeAccountId = /^acct_[A-Za-z0-9]+$/.test(String(requestedStripeAccountId || ''))
    ? String(requestedStripeAccountId)
    : '';
  const stripeIdentityVerified = body.stripeIdentityVerified === undefined
    ? Number(current.stripe_identity_verified) === 1
    : body.stripeIdentityVerified === true;
  if ((stripeIdentityVerified || stripeRelationshipStatus === 'verified') && !stripeAccountId) {
    throw ownershipError('stripe-account-required', 400);
  }
  const now = Date.now();
  await env.REMOTE_DB.prepare(`
    UPDATE live_channel_verifications
    SET ownership_status = ?, ownership_method = CASE
          WHEN ownership_status != 'verified' AND ? = 'verified' THEN 'manual'
          ELSE ownership_method END,
        stripe_account_id = ?, stripe_identity_verified = ?, stripe_relationship_status = ?,
        verified_at = CASE WHEN ? = 'verified' THEN COALESCE(verified_at, ?) ELSE verified_at END,
        reviewed_at = ?, reviewed_by = 'admin', updated_at = ?
    WHERE verification_id = ?
  `).bind(
    ownershipStatus,
    ownershipStatus,
    stripeAccountId,
    stripeIdentityVerified ? 1 : 0,
    stripeRelationshipStatus,
    ownershipStatus,
    now,
    now,
    now,
    verificationId,
  ).run();
  const row = await selectVerificationById(env, verificationId);
  return json(adminVerification(row));
}

export async function assertPaidChannelApproved(env, verificationId, channelId) {
  requireD1(env);
  if (!verificationId) throw ownershipError('paid-channel-verification-required', 403);
  const row = await env.REMOTE_DB.prepare(`
    SELECT v.ownership_status, v.stripe_relationship_status, v.stripe_identity_verified,
      v.stripe_account_id, v.channel_id, a.accepted_at AS agreement_accepted_at
    FROM live_channel_verifications v
    LEFT JOIN live_creator_agreements a
      ON a.verification_id = v.verification_id AND a.stripe_account_id = v.stripe_account_id
      AND a.terms_version = ? AND a.terms_document_sha256 = ?
    WHERE v.verification_id = ?
  `).bind(CREATOR_TERMS.version, CREATOR_TERMS.documentSha256, verificationId).first();
  if (!row || row.channel_id !== channelId || row.ownership_status !== 'verified'
    || row.stripe_relationship_status !== 'verified' || Number(row.stripe_identity_verified) !== 1
    || !/^acct_[A-Za-z0-9]+$/.test(String(row.stripe_account_id || '')) || !row.agreement_accepted_at) {
    throw ownershipError('paid-channel-verification-required', 403);
  }
  return row;
}

export async function requireChannelVerification(request, env, verificationId) {
  requireD1(env);
  const token = request.headers.get(VERIFY_TOKEN_HEADER) || '';
  if (!token) throw ownershipError('verification-forbidden', 403);
  const row = await selectVerificationById(env, verificationId);
  if (!row || !timingSafeEqual(row.access_token_hash, await sha256(token))) throw ownershipError('verification-forbidden', 403);
  return row;
}

const requireVerification = requireChannelVerification;

function assertVerificationOpen(row) {
  if (row.ownership_status === 'verified') throw ownershipError('verification-already-verified', 409);
  if (row.ownership_status === 'rejected') throw ownershipError('verification-rejected', 409);
}

function publicVerification(row) {
  const canSellPaid = row.ownership_status === 'verified'
    && row.stripe_relationship_status === 'verified'
    && Number(row.stripe_identity_verified) === 1
    && /^acct_[A-Za-z0-9]+$/.test(String(row.stripe_account_id || ''))
    && Boolean(row.agreement_accepted_at);
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
    creatorAgreementAccepted: Boolean(row.agreement_accepted_at),
    creatorAgreementAcceptedAt: row.agreement_accepted_at || undefined,
    creatorAgreementTermsVersion: row.agreement_accepted_at ? CREATOR_TERMS.version : '',
    canSellPaid,
    verifiedAt: row.verified_at || undefined,
    updatedAt: row.updated_at,
  };
}

function adminVerification(row) {
  return {
    ...publicVerification(row),
    stripeAccountId: String(row.stripe_account_id || ''),
    creatorAgreementId: String(row.agreement_id || ''),
    creatorAgreementContractingName: String(row.contracting_name || ''),
    reviewedAt: row.reviewed_at || undefined,
    createdAt: row.created_at,
  };
}

async function selectVerificationById(env, verificationId) {
  return env.REMOTE_DB.prepare(`
    SELECT v.*, a.agreement_id, a.contracting_name, a.accepted_at AS agreement_accepted_at
    FROM live_channel_verifications v
    LEFT JOIN live_creator_agreements a
      ON a.verification_id = v.verification_id AND a.stripe_account_id = v.stripe_account_id
      AND a.terms_version = ? AND a.terms_document_sha256 = ?
    WHERE v.verification_id = ? LIMIT 1
  `).bind(CREATOR_TERMS.version, CREATOR_TERMS.documentSha256, verificationId).first();
}

function normalizeReviewStatus(value, allowed, message) {
  if (!allowed.includes(value)) throw ownershipError(message, 400);
  return value;
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

async function replaceCaptionSources(env, channelId, sources) {
  await env.REMOTE_DB.prepare(`
    CREATE TABLE IF NOT EXISTS live_youtube_caption_sources (
      channel_id TEXT NOT NULL, video_id TEXT NOT NULL, video_title TEXT NOT NULL,
      transcript TEXT NOT NULL, transcript_sha256 TEXT NOT NULL, language TEXT NOT NULL DEFAULT '',
      auto_generated INTEGER NOT NULL DEFAULT 0, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      PRIMARY KEY (channel_id, video_id)
    )
  `).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_youtube_caption_sources WHERE channel_id = ?').bind(channelId).run();
  const now = Date.now();
  for (const source of sources) {
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_youtube_caption_sources (
        channel_id, video_id, video_title, transcript, transcript_sha256,
        language, auto_generated, fetched_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      channelId,
      source.videoId,
      source.title,
      source.transcript,
      await sha256(source.transcript),
      source.language || '',
      source.autoGenerated ? 1 : 0,
      now,
      now + CAPTION_RETENTION_MS,
    ).run();
  }
}

function successHtml(channelName, captionCount = 0) {
  const detail = captionCount > 0
    ? `公開動画${captionCount}本の字幕を安全に取り込みました。スタッフが問題を再生成すると、動画内の話題を反映した候補になります。`
    : '所有確認は完了しました。取得できる字幕がなかったため、問題生成では動画タイトル・説明・タグを利用します。';
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>所有確認完了</title><body><main><h1>チャンネル所有確認が完了しました</h1><p>${escapeHtml(channelName)} の確認結果を保存しました。</p><p>${escapeHtml(detail)}</p><p>Googleのアクセストークンは保存せず、失効処理を行いました。この画面を閉じて元の画面へ戻ってください。</p></main></body></html>`;
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
