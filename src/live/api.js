import { calculateLiveResult, validateLiveDraft } from './model.js';
import { assertCheckoutConsent } from './checkout-consent.js';
import {
  LIVE_FALLBACK_VIEWER_LIMIT,
  LIVE_RESERVATION_BUFFER_HOURS,
  LIVE_RESERVATION_MAX_DAYS,
  LIVE_RESULT_IMAGE_PRICES,
  LIVE_RESULT_IMAGE_SERVICE,
  LIVE_SUPPORT_AMOUNTS,
  LIVE_VIEWER_LIMIT,
} from './config.js';
import {
  broadcastLiveRealtimeState,
  connectLiveRealtime,
  hasLiveRealtime,
  initializeLiveRealtime,
  liveViewerLimit,
  loadLiveRealtimeParticipantVotes,
  loadLiveRealtimeQuestionSnapshot,
  loadLiveRealtimeStats,
  releaseLiveRealtimeParticipant,
  reserveLiveRealtimeParticipant,
  storeLiveRealtimeVote,
} from './realtime.js';
import { fetchYouTubeDataProfile, normalizeYouTubeInput } from './youtube.js';
import {
  createFreeResultPreview,
  createPaidResultAsset,
  createSignedDownloadUrl,
  deleteCreatorImage,
  storePrivateCreatorImage,
  streamPrivateResult,
  verifySignedDownload,
} from './media.js';
import {
  assertPaidChannelApproved,
  completeYouTubeOAuth,
  createChannelVerification,
  getChannelVerification,
  requestManualReview,
  reviewChannelVerification,
  startYouTubeOAuth,
  verifyChannelDescription,
} from './ownership.js';
import { acceptCreatorAgreement, getCreatorAgreement } from './agreement.js';
import {
  acknowledgeLiveOpsEvent,
  ensureLiveOpsD1,
  getLiveHealth,
  getLiveOpsOverview,
  getLiveSystemStatus,
  recordLiveOpsEvent,
  setLiveSystemStatus,
} from './ops.js';
import { createLiveAdminSession, requireLiveAdminSession } from './admin-auth.js';
import { getLivePurchaseDb, requireLivePurchaseDb } from './purchases.js';
import { liveResultImageCheckoutConfigured, liveSupportCheckoutConfigured } from './checkout-config.js';
import { calculateLiveRevenueAllocation } from './revenue.js';
import {
  createLiveCheckoutSession,
  createLiveCreatorTransfer,
  createLiveStripeRefund,
  retrieveLiveStripeBalanceTransaction,
  retrieveLiveStripeCharge,
} from './stripe.js';
import {
  buildMonthlyPayoutBatches,
  completePayoutBatch,
  failPayoutBatch,
  getPayoutBatch,
  markPayoutBatchProcessing,
  recordPaidRevenue,
  recordRevenueProcessingFee,
  syncPayoutTransferEvent,
  syncRevenueOrderStatus,
  verifyPayoutBatchAllocations,
} from './revenue-ledger.js';
import {
  LIVE_SUPPORT_MESSAGES_PUBLIC,
  assessStripePaymentRisk,
  createLiveCreatorInvite,
  normalizeParticipantName,
  requireLiveCreatorInvite,
  revokeLiveCreatorInvite,
} from './security.js';

const LIVE_ACTIVE_TTL_SECONDS = 60 * 60 * 24;
const LIVE_SAVED_TTL_SECONDS = 60 * 60 * 24 * 30;
const LIVE_RESERVATION_BUFFER_MS = LIVE_RESERVATION_BUFFER_HOURS * 60 * 60 * 1000;
const LIVE_CODE_PATTERN = /^[0-9]{6}$/;
let liveD1ReadyPromise = null;
let liveRateLimitReadyPromise = null;

export async function handleLiveApi(request, env, path) {
  if (request.method === 'OPTIONS') return liveJson({});
  try {
    if (path === '/api/live/stripe/webhook' && request.method === 'POST') {
      return await handleLiveStripeWebhook(request, env);
    }
    if (path === '/api/live/status' && request.method === 'GET') {
      return liveJson({ status: await getLiveSystemStatus(env) });
    }
    if (path === '/api/live/health' && request.method === 'GET') {
      const health = await getLiveHealth(env);
      return liveJson(health, health.ok ? 200 : 503);
    }
    if (path === '/api/live/admin/session' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'admin-auth', 10);
      return liveJson(await createLiveAdminSession(request, env));
    }
    if (path.startsWith('/api/live/admin/')) {
      await enforceLiveRateLimit(request, env, 'admin-api', 120);
      await requireLiveAdminSession(request, env);
    }
    if (path === '/api/live/admin/overview' && request.method === 'GET') {
      await ensureLiveD1(env);
      return liveJson(await getLiveOpsOverview(env));
    }
    if (path === '/api/live/admin/status' && request.method === 'POST') {
      return liveJson({ status: await setLiveSystemStatus(env, await readLiveJson(request)) });
    }
    if (path === '/api/live/admin/ops-events' && request.method === 'POST') {
      return liveJson({ event: await recordLiveOpsEvent(env, await readLiveJson(request)) }, 201);
    }
    if (path === '/api/live/admin/creator-invites' && request.method === 'POST') {
      return await createLiveCreatorInviteAsAdmin(request, env);
    }
    const creatorInviteRoute = path.match(/^\/api\/live\/admin\/creator-invites\/([a-f0-9-]{36})\/revoke$/i);
    if (creatorInviteRoute && request.method === 'POST') {
      const invite = await revokeLiveCreatorInvite(env, creatorInviteRoute[1]);
      await recordLiveOpsEvent(env, {
        category: 'security', severity: 'warning', eventType: 'creator-invite-revoked',
        message: 'YouTuber招待を失効しました。', metadata: { inviteId: invite.inviteId },
      });
      return liveJson({ invite });
    }
    const acknowledgeRoute = path.match(/^\/api\/live\/admin\/ops-events\/([a-f0-9-]{36})\/acknowledge$/i);
    if (acknowledgeRoute && request.method === 'POST') {
      return liveJson(await acknowledgeLiveOpsEvent(env, acknowledgeRoute[1]));
    }
    const adminGameRoute = path.match(/^\/api\/live\/admin\/games\/([0-9]{6})\/(terminate|cancel|rotate-links)$/);
    if (adminGameRoute && request.method === 'POST') {
      await ensureLiveD1(env);
      if (adminGameRoute[2] === 'terminate') return await terminateLiveGameAsAdmin(request, env, adminGameRoute[1]);
      if (adminGameRoute[2] === 'cancel') return await cancelLiveReservationAsAdmin(request, env, adminGameRoute[1]);
      return await rotateLiveGameLinksAsAdmin(request, env, adminGameRoute[1]);
    }
    const creatorImageReviewRoute = path.match(/^\/api\/live\/admin\/games\/([0-9]{6})\/creator-image-review$/);
    if (creatorImageReviewRoute && request.method === 'POST') {
      await ensureLiveD1(env);
      return await reviewLiveCreatorImageAsAdmin(request, env, creatorImageReviewRoute[1]);
    }
    const adminEntitlementRoute = path.match(/^\/api\/live\/admin\/result-entitlements\/([A-Za-z0-9_-]{8,80})\/(refund|reissue)$/);
    if (adminEntitlementRoute && request.method === 'POST') {
      await requireLivePurchaseDb(env);
      return adminEntitlementRoute[2] === 'refund'
        ? await refundLiveResultEntitlement(request, env, adminEntitlementRoute[1])
        : await reissueLiveResultEntitlement(request, env, adminEntitlementRoute[1]);
    }
    const adminCheckoutRefundRoute = path.match(/^\/api\/live\/admin\/checkouts\/([A-Za-z0-9_-]{8,80})\/refund$/);
    if (adminCheckoutRefundRoute && request.method === 'POST') {
      await requireLivePurchaseDb(env);
      return await refundLiveCheckout(request, env, adminCheckoutRefundRoute[1]);
    }
    if (path === '/api/live/admin/revenue/monthly-close' && request.method === 'POST') {
      return await createLiveMonthlyPayoutBatches(request, env);
    }
    const payoutTransferRoute = path.match(/^\/api\/live\/admin\/revenue\/payouts\/(payout_[a-f0-9]{32})\/transfer$/i);
    if (payoutTransferRoute && request.method === 'POST') {
      return await transferLiveMonthlyPayout(request, env, payoutTransferRoute[1]);
    }
    if (path === '/api/live/youtube-candidates' && request.method === 'POST') {
      await assertLiveServiceAvailable(env, true);
      await enforceLiveRateLimit(request, env, 'youtube', 15);
      return await createYouTubeCandidatesResponse(request, env);
    }
    if (path === '/api/live/channel-verifications/oauth/callback' && request.method === 'GET') {
      return await completeYouTubeOAuth(request, env);
    }
    if (path === '/api/live/channel-verifications' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'channel-verification', 10);
      await ensureLiveD1(env);
      return await createChannelVerification(request, env);
    }
    const verificationRoute = path.match(/^\/api\/live\/channel-verifications\/([a-f0-9]{32})(?:\/(verify-description|manual-review|oauth-start))?$/i);
    if (verificationRoute) {
      await ensureLiveD1(env);
      const [, verificationId, action = ''] = verificationRoute;
      if (request.method === 'GET' && !action) return await getChannelVerification(request, env, verificationId);
      if (request.method === 'POST' && action === 'verify-description') return await verifyChannelDescription(request, env, verificationId);
      if (request.method === 'POST' && action === 'manual-review') return await requestManualReview(request, env, verificationId);
      if (request.method === 'POST' && action === 'oauth-start') return await startYouTubeOAuth(request, env, verificationId);
      return liveJson({ error: 'method-not-allowed' }, 405);
    }
    const creatorAgreementRoute = path.match(/^\/api\/live\/channel-verifications\/([a-f0-9]{32})\/agreement$/i);
    if (creatorAgreementRoute) {
      await ensureLiveD1(env);
      if (request.method === 'GET') return await getCreatorAgreement(request, env, creatorAgreementRoute[1]);
      if (request.method === 'POST') return await acceptCreatorAgreement(request, env, creatorAgreementRoute[1]);
      return liveJson({ error: 'method-not-allowed' }, 405);
    }
    const verificationAdminRoute = path.match(/^\/api\/live\/admin\/channel-verifications\/([a-f0-9]{32})\/review$/i);
    if (verificationAdminRoute && request.method === 'POST') {
      await ensureLiveD1(env);
      return await reviewChannelVerification(request, env, verificationAdminRoute[1]);
    }
    if (path === '/api/live/admin/result-entitlements' && request.method === 'POST') {
      await requireLivePurchaseDb(env);
      return await grantLiveResultEntitlement(request, env);
    }
    const entitlementRoute = path.match(/^\/api\/live\/result-entitlements\/([A-Za-z0-9_-]{8,80})$/);
    if (entitlementRoute && request.method === 'GET') {
      await requireLivePurchaseDb(env);
      return await getLiveResultEntitlement(request, env, entitlementRoute[1]);
    }
    const checkoutStatusRoute = path.match(/^\/api\/live\/checkouts\/(cs_(?:test_|live_)?[A-Za-z0-9_]+)$/);
    if (checkoutStatusRoute && request.method === 'GET') {
      await requireLivePurchaseDb(env);
      return await getLiveCheckoutStatus(request, env, checkoutStatusRoute[1]);
    }
    if (path === '/api/live/purchases/recover' && request.method === 'POST') {
      return await recoverLiveResultPurchase(request, env);
    }
    const downloadRoute = path.match(/^\/api\/live\/downloads\/([A-Za-z0-9_-]{8,80})$/);
    if (downloadRoute && request.method === 'GET') {
      await requireLivePurchaseDb(env);
      return await downloadLiveResult(request, env, downloadRoute[1]);
    }
    if (!env.REMOTE_DB && !env.LIVE_KV && !env.REMOTE_KV) {
      return liveJson({ error: 'live-storage-not-configured' }, 500);
    }
    if (path === '/api/live/reservations/availability' && request.method === 'GET') {
      await enforceLiveRateLimit(request, env, 'availability', 120);
      return await getLiveReservationAvailability(request, env);
    }
    if (path === '/api/live/games' && request.method === 'POST') {
      await assertLiveServiceAvailable(env, true);
      await enforceLiveRateLimit(request, env, 'create', 10);
      return await createLiveGame(request, env);
    }

    const route = path.match(/^\/api\/live\/games\/([0-9]{6})(?:\/(join|start|answer|subject-answer|advance|vote|close|reveal|next|socket|creator-image|result-preview|checkout|cancel|reschedule|rotate-links))?$/);
    if (!route) return liveJson({ error: 'not-found' }, 404);
    const [, code, action = ''] = route;
    if (request.method === 'GET' && !action) return await getLiveGameResponse(request, env, code);
    if (request.method === 'GET' && action === 'socket') return await connectLiveGameSocket(request, env, code);
    if (request.method === 'GET' && action === 'result-preview') return await getLiveResultPreview(request, env, code);
    if (request.method !== 'POST') return liveJson({ error: 'method-not-allowed' }, 405);
    if (action === 'cancel') return await cancelLiveReservationAsHost(request, env, code);
    if (action === 'reschedule') return await rescheduleLiveGameAsHost(request, env, code);
    if (action === 'rotate-links') return await rotateLiveGameLinksAsHost(request, env, code);
    if (action === 'creator-image') return await uploadLiveCreatorImage(request, env, code);
    if (action === 'checkout') {
      await enforceLiveRateLimit(request, env, `checkout:${code}`, 10);
      return await createLiveCheckout(request, env, code);
    }
    if (action === 'join') {
      await assertLiveServiceAvailable(env, true);
      await enforceLiveRateLimit(request, env, `join:${code}`, 60);
      return await joinLiveGame(request, env, code);
    }
    if (action === 'vote') {
      if (!hasLiveRealtime(env)) await enforceLiveRateLimit(request, env, 'vote', 600);
      return await voteLiveGame(request, env, code);
    }
    if (action === 'subject-answer') {
      await enforceLiveRateLimit(request, env, 'subject', 300);
      return await answerLiveGameAsSubject(request, env, code);
    }
    if (['start', 'answer', 'advance', 'close', 'reveal', 'next'].includes(action)) {
      await enforceLiveRateLimit(request, env, 'host', 300);
      return await updateLiveGameAsHost(request, env, code, action);
    }
    return liveJson({ error: 'not-found' }, 404);
  } catch (error) {
    const status = Number(error && error.status) || 500;
    if (status >= 500) {
      await recordLiveOpsEvent(env, {
        category: path === '/api/live/stripe/webhook' ? 'stripe' : 'application',
        severity: 'critical',
        eventType: path === '/api/live/stripe/webhook' ? 'stripe-webhook-processing-failed' : 'live-api-error',
        message: error && error.message ? error.message : 'live-api-error',
        metadata: { path, method: request.method, status },
      }).catch(() => {});
    }
    return liveJson({ error: error && error.message ? error.message : 'live-api-error' }, status);
  }
}

async function createLiveGame(request, env) {
  let body;
  let creatorImageFile = null;
  if (/^multipart\/form-data/i.test(request.headers.get('content-type') || '')) {
    const formData = await request.formData().catch(() => null);
    try { body = JSON.parse(String(formData?.get('draft') || '{}')); } catch (error) { body = {}; }
    const image = formData?.get('image');
    if (image && typeof image.arrayBuffer === 'function' && Number(image.size) > 0) creatorImageFile = image;
  } else {
    body = await readLiveJson(request);
  }
  if (body?.draft?.creationMode !== 'youtube') throw liveError('youtube-creation-required', 400);
  const now = Date.now();
  const validation = validateLiveDraft(body && body.draft, { now });
  if (!validation.valid) throw liveError(validation.errors[0] || 'invalid-game', 400);
  const creatorInvite = await requireLiveCreatorInvite(request, env, validation.draft.channelId);
  await cleanupExpiredLiveData(env);
  let code = createLiveCode();
  for (let attempt = 0; attempt < 8 && await getStoredLiveGame(env, code); attempt += 1) code = createLiveCode();
  const reservation = await reserveLiveSlot(env, code, validation.draft.scheduledAt, now);
  const game = {
    version: 5,
    title: validation.draft.title,
    subjectName: validation.draft.subjectName,
    channelName: validation.draft.channelName || validation.draft.subjectName,
    channelId: validation.draft.channelId,
    channelVerificationId: validation.draft.channelVerificationId,
    resultImagePrice: validation.draft.resultImagePrice,
    creatorInviteId: creatorInvite.invite_id,
    creatorImage: null,
    scheduledAt: reservation.scheduledAt,
    reservationEndsAt: reservation.blockedUntil,
    questions: validation.draft.questions,
    hostToken: createLiveToken(24),
    subjectToken: createLiveToken(24),
    phase: 'lobby',
    currentQuestionIndex: 0,
    participants: [],
    votes: {},
    results: [],
    showVoteCount: validation.draft.showLiveVoteCounts,
    participantCount: 0,
    participantLimit: liveViewerLimit(env),
    realtime: hasLiveRealtime(env),
    createdAt: now,
    updatedAt: now,
    expiresAt: reservation.blockedUntil,
  };
  try {
    if (creatorImageFile) game.creatorImage = await storePrivateCreatorImage(creatorImageFile, env, code);
    await putStoredLiveGame(env, code, game);
    if (hasLiveRealtime(env)) {
      await initializeLiveRealtime(env, code);
      await broadcastCurrentRealtimeState(env, code, game);
    }
  } catch (error) {
    await releaseLiveReservation(env, code);
    throw error;
  }
  return liveJson({ code, hostToken: game.hostToken, game: publicLiveGame(game, { host: true }) }, 201);
}

async function createLiveCreatorInviteAsAdmin(request, env) {
  const body = await readLiveJson(request);
  if (body.reviewed !== true) throw liveError('manual-review-required', 400);
  const input = normalizeYouTubeInput(body.channelUrl);
  if (!input) throw liveError('invalid-youtube-url', 400);
  const profile = await fetchYouTubeChannelProfile(input, env);
  const invite = await createLiveCreatorInvite(env, profile, { reviewed: true });
  await recordLiveOpsEvent(env, {
    category: 'security', severity: 'info', eventType: 'creator-invite-issued',
    message: '手動審査済みYouTuberへ招待を発行しました。',
    metadata: { inviteId: invite.inviteId, channelId: profile.channelId, channelName: profile.channelName },
  });
  return liveJson({ invite, profile }, 201);
}

async function reviewLiveCreatorImageAsAdmin(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  if (!game.creatorImage?.previewKey) throw liveError('creator-image-not-found', 404);
  const body = await readLiveJson(request);
  const decision = String(body.decision || '');
  if (!['approved', 'rejected'].includes(decision)) throw liveError('invalid-review-decision', 400);
  const reviewedAt = Date.now();
  if (decision === 'approved') {
    game.creatorImage = { ...game.creatorImage, moderationStatus: 'approved', reviewedAt };
  } else {
    await deleteCreatorImage(env, game.creatorImage);
    game.creatorImage = null;
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  if (hasLiveRealtime(env)) await broadcastCurrentRealtimeState(env, code, game);
  await recordLiveOpsEvent(env, {
    category: 'moderation', severity: decision === 'approved' ? 'info' : 'warning',
    eventType: `creator-image-${decision}`, code,
    message: decision === 'approved' ? 'YouTuber画像を承認しました。' : '不適切な可能性のあるYouTuber画像を却下・削除しました。',
  });
  return liveJson({ code, decision, game: publicLiveGame(game, { host: true }) });
}

async function getLiveReservationAvailability(request, env) {
  const url = new URL(request.url);
  const scheduledAt = validateLiveScheduledAt(url.searchParams.get('scheduledAt'));
  let excludeCode = '';
  const requestedCode = String(url.searchParams.get('code') || '');
  if (LIVE_CODE_PATTERN.test(requestedCode)) {
    const game = await requireLiveGame(env, requestedCode, { baseOnly: true });
    await requireLiveHost(request, env, game);
    if (game.phase !== 'lobby') throw liveError('reservation-change-closed', 409);
    excludeCode = requestedCode;
  }
  await cleanupExpiredLiveData(env);
  const available = await isLiveSlotAvailable(env, scheduledAt, excludeCode);
  return liveJson({
    available,
    scheduledAt,
    viewerLimit: liveViewerLimit(env),
    bufferHours: LIVE_RESERVATION_BUFFER_HOURS,
  });
}

async function cancelLiveReservationAsHost(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  await requireLiveHost(request, env, game);
  if (game.phase !== 'lobby') throw liveError('reservation-change-closed', 409);
  const body = await readLiveJson(request);
  const message = String(body.message || 'スタッフにより、このLIVE予約はキャンセルされました。').trim().slice(0, 300);
  game.phase = 'cancelled';
  game.cancellationMessage = message;
  game.cancelledAt = Date.now();
  game.updatedAt = game.cancelledAt;
  game.expiresAt = game.cancelledAt + 24 * 60 * 60 * 1000;
  await putStoredLiveGame(env, code, game);
  await Promise.all([releaseLiveReservation(env, code), releaseLiveActiveSlot(env, code)]);
  if (hasLiveRealtime(env)) await broadcastCurrentRealtimeState(env, code, game);
  await recordLiveOpsEvent(env, {
    category: 'reservation', severity: 'info', eventType: 'reservation-cancelled', code,
    message, metadata: { scheduledAt: Number(game.scheduledAt) || 0 },
  });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function rescheduleLiveGameAsHost(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  await requireLiveHost(request, env, game);
  if (game.phase !== 'lobby') throw liveError('reservation-change-closed', 409);
  const body = await readLiveJson(request);
  const scheduledAt = validateLiveScheduledAt(body.scheduledAt);
  const previous = {
    scheduledAt: Number(game.scheduledAt),
    blockedFrom: Number(game.scheduledAt) - LIVE_RESERVATION_BUFFER_MS,
    blockedUntil: Number(game.reservationEndsAt),
  };
  if (scheduledAt === previous.scheduledAt) {
    return liveJson({ code, unchanged: true, game: publicLiveGame(game, { host: true }) });
  }
  const reservation = await moveLiveReservation(env, code, scheduledAt);
  game.scheduledAt = reservation.scheduledAt;
  game.reservationEndsAt = reservation.blockedUntil;
  game.updatedAt = Date.now();
  game.expiresAt = reservation.blockedUntil;
  try {
    await putStoredLiveGame(env, code, game);
  } catch (error) {
    await moveLiveReservation(env, code, previous.scheduledAt).catch(() => {});
    throw error;
  }
  await recordLiveOpsEvent(env, {
    category: 'reservation', severity: 'info', eventType: 'reservation-rescheduled', code,
    message: 'スタッフがLIVE予約日時を変更しました。',
    metadata: { previousScheduledAt: previous.scheduledAt, scheduledAt },
  });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function rotateLiveGameLinksAsHost(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  await requireLiveHost(request, env, game);
  if (game.phase !== 'lobby') throw liveError('reservation-change-closed', 409);
  const body = await readLiveJson(request);
  const rotateHost = body.host === true;
  const rotateSubject = body.subject === true;
  if (!rotateHost && !rotateSubject) throw liveError('rotation-target-required', 400);
  if (rotateHost) game.hostToken = createLiveToken(24);
  if (rotateSubject) game.subjectToken = createLiveToken(24);
  game.updatedAt = Date.now();
  await putStoredLiveGame(env, code, game);
  await recordLiveOpsEvent(env, {
    category: 'security', severity: 'warning', eventType: 'private-links-rotated-by-host', code,
    message: `${rotateHost ? 'スタッフURL' : ''}${rotateHost && rotateSubject ? '・' : ''}${rotateSubject ? '本人URL' : ''}をスタッフが再発行しました。`,
    metadata: { host: rotateHost, subject: rotateSubject },
  });
  const origin = new URL(request.url).origin;
  return liveJson({
    code,
    hostToken: rotateHost ? game.hostToken : undefined,
    subjectToken: rotateSubject ? game.subjectToken : undefined,
    hostUrl: rotateHost ? `${origin}/live?room=${code}#host=${game.hostToken}` : undefined,
    subjectUrl: rotateSubject ? `${origin}/live?room=${code}#subject=${game.subjectToken}` : undefined,
    game: publicLiveGame(game, { host: true }),
  });
}

async function getLiveGameResponse(request, env, code) {
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  const subjectToken = normalizeToken(request.headers.get('x-live-subject-token'));
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, realtime
    ? { baseOnly: true }
    : { polling: true, participantToken });
  const host = Boolean(hostToken && hostToken === game.hostToken)
    && await isLiveHostAuthorized(request, env, game);
  const subject = Boolean(subjectToken && subjectToken === game.subjectToken);
  if (realtime) await enrichRealtimeGame(env, code, game, { host, participantToken });
  const publicGame = publicLiveGame(game, {
    host,
    subject,
    participantToken,
  });
  if (participantToken && game.phase === 'complete') {
    try {
      await assertPaidChannelApproved(env, game.channelVerificationId, game.channelId);
      publicGame.supportPaymentsEnabled = liveSupportCheckoutConfigured(env);
      publicGame.resultImageSalesEnabled = liveResultImageCheckoutConfigured(env);
      publicGame.paidSalesEnabled = publicGame.supportPaymentsEnabled || publicGame.resultImageSalesEnabled;
    } catch (error) {
      publicGame.supportPaymentsEnabled = false;
      publicGame.resultImageSalesEnabled = false;
      publicGame.paidSalesEnabled = false;
    }
  }
  return liveJson({
    code,
    game: publicGame,
  });
}

async function uploadLiveCreatorImage(request, env, code) {
  const game = await requireLiveGame(env, code);
  await requireLiveHost(request, env, game);
  const creatorImage = await storePrivateCreatorImage(request, env, code, game.creatorImage);
  game.creatorImage = creatorImage;
  game.version = Math.max(5, Number(game.version) || 0);
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  if (hasLiveRealtime(env)) await broadcastCurrentRealtimeState(env, code, game);
  return liveJson({ code, uploaded: true, game: publicLiveGame(game, { host: true }) });
}

async function getLiveResultPreview(request, env, code) {
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  if (!participantToken) throw liveError('participant-forbidden', 403);
  const game = await requireLiveGame(env, code, { polling: true, participantToken });
  if (game.phase !== 'complete') throw liveError('result-not-ready', 409);
  const participantGame = publicLiveGame(game, { participantToken });
  if (!participantGame.participantName) throw liveError('participant-forbidden', 403);
  return createFreeResultPreview(request, env, game, participantGame);
}

async function createLiveCheckout(request, env, code) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  if (!participantToken) throw liveError('participant-forbidden', 403);
  const checkoutRequestId = String(request.headers.get('x-live-checkout-request') || '');
  if (!/^[a-f0-9]{32,80}$/i.test(checkoutRequestId)) throw liveError('checkout-request-id-required', 400);
  const body = await readLiveJson(request);
  const checkoutConsent = assertCheckoutConsent(body);
  const productType = String(body.productType || '');
  if (productType === 'support') {
    if (!liveSupportCheckoutConfigured(env)) throw liveError('live-support-checkout-not-configured', 503);
  } else if (productType === 'result_image') {
    if (!liveResultImageCheckoutConfigured(env)) throw liveError('live-result-checkout-not-configured', 503);
  } else {
    throw liveError('invalid-checkout-product', 400);
  }
  const game = await requireLiveGame(env, code, { polling: true, participantToken });
  if (game.phase !== 'complete') throw liveError('result-not-ready', 409);
  const approval = await assertPaidChannelApproved(env, game.channelVerificationId, game.channelId);
  const participant = game.participants.find((item) => item.token === participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  let amount;
  let productName;
  if (productType === 'result_image') {
    amount = Number(game.resultImagePrice);
    if (!LIVE_RESULT_IMAGE_PRICES.includes(amount)) throw liveError('result-image-not-for-sale', 409);
    productName = `${game.channelName || game.subjectName} ${LIVE_RESULT_IMAGE_SERVICE.name}`;
  } else if (productType === 'support') {
    amount = Number(body.amount);
    if (!LIVE_SUPPORT_AMOUNTS.includes(amount)) throw liveError('invalid-support-amount', 400);
    productName = `${game.channelName || game.subjectName} LIVE応援`;
  }
  const viewerName = normalizeParticipantName(body.viewerName || participant.name);
  const existing = await purchaseDb.prepare(`
    SELECT order_id, product_type, code, participant_id, amount, stripe_checkout_session_id, stripe_checkout_url,
      stripe_checkout_expires_at, status
    FROM live_checkout_orders WHERE checkout_request_id = ?
  `).bind(checkoutRequestId).first();
  if (existing && (existing.code !== code || existing.participant_id !== participant.id
    || existing.product_type !== productType || Number(existing.amount) !== amount)) {
    throw liveError('checkout-request-conflict', 409);
  }
  if (existing?.stripe_checkout_url && Number(existing.stripe_checkout_expires_at) > Date.now()
    && !['checkout_failed', 'refunded', 'refund_failed'].includes(existing.status)) {
    return liveJson(checkoutResponse(existing));
  }
  const allocation = calculateLiveRevenueAllocation(amount);
  const orderId = existing?.order_id || `ord_${createLiveToken(16)}`;
  const now = Date.now();
  if (!existing) {
    await purchaseDb.prepare(`
      INSERT INTO live_checkout_orders (
        order_id, checkout_request_id, product_type, code, participant_id, participant_name,
        viewer_name, channel_verification_id, stripe_account_id, amount, currency,
        creator_amount, platform_amount, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'jpy', ?, ?, 'creating', ?, ?)
    `).bind(
      orderId, checkoutRequestId, productType, code, participant.id, participant.name,
      viewerName, game.channelVerificationId, approval.stripe_account_id, amount,
      allocation.creatorAmount, allocation.applicationFeeAmount, now, now,
    ).run();
  }
  await purchaseDb.prepare(`
    INSERT OR IGNORE INTO live_checkout_consents (
      order_id, terms_version, terms_document_sha256, terms_accepted_at, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(orderId, checkoutConsent.termsVersion, checkoutConsent.termsDocumentSha256, now, now).run();
  try {
    const session = await createLiveCheckoutSession(env, {
      requestUrl: request.url, orderId, productType, code, amount, productName,
      termsVersion: checkoutConsent.termsVersion,
      termsDocumentSha256: checkoutConsent.termsDocumentSha256,
      termsAcceptedAt: now,
    }, now);
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(String(session.id || '')) || !/^https:\/\/checkout\.stripe\.com\//.test(String(session.url || ''))) {
      throw liveError('stripe-checkout-response-invalid', 502);
    }
    const expiresAt = Number(session.expires_at) * 1000;
    await purchaseDb.prepare(`
      UPDATE live_checkout_orders
      SET stripe_checkout_session_id = ?, stripe_checkout_url = ?, stripe_checkout_expires_at = ?,
        status = 'checkout_created', updated_at = ? WHERE order_id = ?
    `).bind(session.id, session.url, expiresAt, Date.now(), orderId).run();
    return liveJson({ orderId, checkoutUrl: session.url, checkoutSessionId: session.id, expiresAt }, 201);
  } catch (error) {
    await purchaseDb.prepare(`
      UPDATE live_checkout_orders SET status = 'checkout_failed', updated_at = ? WHERE order_id = ?
    `).bind(Date.now(), orderId).run().catch(() => {});
    throw error;
  }
}

async function getLiveCheckoutStatus(request, env, checkoutSessionId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  if (!participantToken) throw liveError('participant-forbidden', 403);
  const row = await purchaseDb.prepare(`
    SELECT order_id, product_type, code, participant_id, amount, currency, purchase_id,
      stripe_checkout_session_id, status, paid_at, refunded_at
    FROM live_checkout_orders WHERE stripe_checkout_session_id = ?
  `).bind(checkoutSessionId).first();
  if (!row) throw liveError('checkout-not-found', 404);
  const participant = await loadLiveParticipant(env, row.code, participantToken);
  if (!participant || participant.id !== row.participant_id) throw liveError('checkout-forbidden', 403);
  const response = {
    orderId: row.order_id,
    productType: row.product_type,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    paidAt: row.paid_at ? Number(row.paid_at) : undefined,
    refundedAt: row.refunded_at ? Number(row.refunded_at) : undefined,
  };
  if (row.product_type === 'result_image' && row.purchase_id && row.status === 'paid') {
    const accessToken = await derivePurchaseAccessToken(env, row.order_id);
    response.entitlementUrl = `${new URL(request.url).origin}/api/live/result-entitlements/${row.purchase_id}?access=${accessToken}`;
  }
  return liveJson(response);
}

function checkoutResponse(row) {
  return {
    orderId: row.order_id,
    checkoutUrl: row.stripe_checkout_url,
    checkoutSessionId: row.stripe_checkout_session_id,
    expiresAt: Number(row.stripe_checkout_expires_at),
  };
}

async function grantLiveResultEntitlement(request, env) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const body = await readLiveJson(request);
  const code = String(body.code || '');
  const purchaseId = String(body.purchaseId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const paymentIntentId = String(body.stripePaymentIntentId || '');
  const participantToken = normalizeToken(body.participantToken);
  if (!LIVE_CODE_PATTERN.test(code) || purchaseId.length < 8
    || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) || !participantToken) {
    throw liveError('invalid-entitlement', 400);
  }
  const game = await requireLiveGame(env, code, { polling: true, participantToken });
  if (game.phase !== 'complete') throw liveError('result-not-ready', 409);
  await assertPaidChannelApproved(env, game.channelVerificationId, game.channelId);
  const participantGame = publicLiveGame(game, { participantToken });
  if (!participantGame.participantName) throw liveError('participant-forbidden', 403);
  const participant = game.participants.find((item) => item.token === participantToken);
  const accessToken = createLiveToken(32);
  const now = Date.now();
  const availableUntil = now + 30 * 24 * 60 * 60 * 1000;
  const assetKey = await createPaidResultAsset(
    request,
    env,
    game,
    participantGame,
    purchaseId,
    String(body.viewerName || participant.name).replace(/\s+/g, ' ').trim().slice(0, 24),
  );
  await purchaseDb.prepare(`
    INSERT INTO live_result_entitlements (
      purchase_id, code, participant_id, participant_name, access_token_hash,
      purchaser_email_hash, stripe_payment_intent_id, asset_key, status,
      purchased_at, available_until, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
  `).bind(
    purchaseId,
    code,
    participant.id,
    participant.name,
    await hashLiveSecret(accessToken),
    '',
    paymentIntentId,
    assetKey,
    now,
    availableUntil,
    now,
    now,
  ).run();
  return liveJson({ purchaseId, accessToken, availableUntil }, 201);
}

async function recoverLiveResultPurchase(request, env) {
  const purchaseDb = await requireLivePurchaseDb(env);
  await enforcePurchaseRecoveryRateLimit(request, purchaseDb);
  const body = await readLiveJson(request);
  const orderId = String(body.orderId || '').trim();
  const purchaserEmail = normalizePurchaseEmail(body.email);
  if (!/^ord_[a-f0-9]{32}$/i.test(orderId) || !purchaserEmail) {
    throw liveError('invalid-purchase-recovery', 400);
  }
  const row = await purchaseDb.prepare(`
    SELECT entitlement.purchase_id, entitlement.purchaser_email_hash,
      entitlement.status AS entitlement_status, entitlement.available_until,
      checkout.status AS checkout_status
    FROM live_checkout_orders AS checkout
    INNER JOIN live_result_entitlements AS entitlement
      ON entitlement.purchase_id = checkout.purchase_id
    WHERE checkout.order_id = ? AND checkout.product_type = 'result_image'
    LIMIT 1
  `).bind(orderId).first();
  const suppliedHash = await hashPurchaseEmail(env, purchaserEmail);
  const expectedHash = String(row?.purchaser_email_hash || '');
  if (!row || expectedHash.length !== 64
    || !constantTimeEqual(hexToBytes(expectedHash), hexToBytes(suppliedHash))) {
    throw liveError('purchase-recovery-forbidden', 403);
  }
  if (row.checkout_status !== 'paid' || row.entitlement_status !== 'active'
    || Number(row.available_until) <= Date.now()) {
    throw liveError('download-expired', 410);
  }
  return liveJson({
    purchaseId: row.purchase_id,
    availableUntil: Number(row.available_until),
    downloadUrl: await createSignedDownloadUrl(request, env, row.purchase_id, Number(row.available_until)),
  });
}

async function enforcePurchaseRecoveryRateLimit(request, purchaseDb) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = [...new Uint8Array(digest).slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await purchaseDb.prepare(`
    INSERT INTO live_purchase_recovery_limits (ip_hash, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(ip_hash) DO UPDATE SET
      window_start = CASE WHEN live_purchase_recovery_limits.window_start = excluded.window_start
        THEN live_purchase_recovery_limits.window_start ELSE excluded.window_start END,
      request_count = CASE WHEN live_purchase_recovery_limits.window_start = excluded.window_start
        THEN live_purchase_recovery_limits.request_count + 1 ELSE 1 END,
      expires_at = excluded.expires_at
  `).bind(ipHash, windowStart, windowStart + windowMs * 2).run();
  const row = await purchaseDb.prepare(`
    SELECT request_count FROM live_purchase_recovery_limits WHERE ip_hash = ?
  `).bind(ipHash).first();
  if (Number(row?.request_count || 0) > 5) throw liveError('rate-limit-exceeded', 429);
}

async function getLiveResultEntitlement(request, env, purchaseId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const accessToken = new URL(request.url).searchParams.get('access') || '';
  const row = await purchaseDb.prepare(`
    SELECT purchase_id, access_token_hash, status, available_until
    FROM live_result_entitlements WHERE purchase_id = ?
  `).bind(purchaseId).first();
  if (!row || !accessToken || row.access_token_hash !== await hashLiveSecret(accessToken)) throw liveError('entitlement-forbidden', 403);
  if (row.status !== 'active' || Number(row.available_until) <= Date.now()) throw liveError('download-expired', 410);
  return liveJson({
    purchaseId,
    availableUntil: Number(row.available_until),
    downloadUrl: await createSignedDownloadUrl(request, env, purchaseId, Number(row.available_until)),
  });
}

async function downloadLiveResult(request, env, purchaseId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const url = new URL(request.url);
  const row = await purchaseDb.prepare(`
    SELECT asset_key, status, available_until FROM live_result_entitlements WHERE purchase_id = ?
  `).bind(purchaseId).first();
  const valid = row && row.status === 'active' && Number(row.available_until) > Date.now()
    && await verifySignedDownload(env, purchaseId, url.searchParams.get('expires'), url.searchParams.get('signature'));
  if (!valid) throw liveError('download-forbidden', 403);
  return streamPrivateResult(env, row.asset_key, `streetboardgame-live-${purchaseId}.svg`);
}

async function terminateLiveGameAsAdmin(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  const body = await readLiveJson(request);
  const message = String(body.message || '運営上の理由により、このLIVEは終了しました。').trim().slice(0, 300);
  const previousPhase = game.phase;
  game.phase = 'terminated';
  game.terminationMessage = message;
  game.terminatedAt = Date.now();
  game.updatedAt = game.terminatedAt;
  game.expiresAt = game.terminatedAt + 24 * 60 * 60 * 1000;
  await putStoredLiveGame(env, code, game);
  if (hasLiveRealtime(env)) await broadcastCurrentRealtimeState(env, code, game);
  await Promise.all([releaseLiveActiveSlot(env, code), releaseLiveReservation(env, code)]);
  await recordLiveOpsEvent(env, {
    category: 'operations', severity: 'warning', eventType: 'game-force-terminated', code,
    message, metadata: { previousPhase },
  });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function cancelLiveReservationAsAdmin(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  if (game.phase !== 'lobby') throw liveError('reservation-change-closed', 409);
  const body = await readLiveJson(request);
  const message = String(body.message || '運営により、このLIVE予約はキャンセルされました。').trim().slice(0, 300);
  game.phase = 'cancelled';
  game.cancellationMessage = message;
  game.cancelledAt = Date.now();
  game.updatedAt = game.cancelledAt;
  game.expiresAt = game.cancelledAt + 24 * 60 * 60 * 1000;
  await putStoredLiveGame(env, code, game);
  await Promise.all([releaseLiveReservation(env, code), releaseLiveActiveSlot(env, code)]);
  if (hasLiveRealtime(env)) await broadcastCurrentRealtimeState(env, code, game);
  await recordLiveOpsEvent(env, {
    category: 'reservation', severity: 'warning', eventType: 'reservation-cancelled-by-admin', code,
    message, metadata: { scheduledAt: Number(game.scheduledAt) || 0 },
  });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function rotateLiveGameLinksAsAdmin(request, env, code) {
  const game = await requireLiveGame(env, code, { baseOnly: true });
  const body = await readLiveJson(request);
  const rotateHost = body.host !== false;
  const rotateSubject = body.subject !== false;
  if (!rotateHost && !rotateSubject) throw liveError('rotation-target-required', 400);
  if (rotateHost) game.hostToken = createLiveToken(24);
  if (rotateSubject) game.subjectToken = createLiveToken(24);
  game.updatedAt = Date.now();
  await putStoredLiveGame(env, code, game);
  await recordLiveOpsEvent(env, {
    category: 'security', severity: 'warning', eventType: 'private-links-rotated', code,
    message: `漏えい対策として${rotateHost ? 'スタッフURL' : ''}${rotateHost && rotateSubject ? '・' : ''}${rotateSubject ? '本人URL' : ''}を失効しました。`,
    metadata: { host: rotateHost, subject: rotateSubject },
  });
  const origin = new URL(request.url).origin;
  return liveJson({
    code,
    hostUrl: rotateHost ? `${origin}/live?room=${code}#host=${game.hostToken}` : undefined,
    subjectUrl: rotateSubject ? `${origin}/live?room=${code}#subject=${game.subjectToken}` : undefined,
  });
}

async function refundLiveResultEntitlement(request, env, purchaseId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const order = await purchaseDb.prepare(`
    SELECT order_id FROM live_checkout_orders WHERE purchase_id = ?
  `).bind(purchaseId).first();
  if (order?.order_id) return refundLiveCheckout(request, env, order.order_id);
  const body = await readLiveJson(request);
  const status = body.confirmed === true ? 'refunded' : 'refund_pending';
  const row = await purchaseDb.prepare(`
    SELECT purchase_id, code, stripe_payment_intent_id, status FROM live_result_entitlements WHERE purchase_id = ?
  `).bind(purchaseId).first();
  if (!row) throw liveError('entitlement-not-found', 404);
  if (row.status === 'refunded' && status !== 'refunded') throw liveError('already-refunded', 409);
  await purchaseDb.prepare(`
    UPDATE live_result_entitlements SET status = ?, updated_at = ? WHERE purchase_id = ?
  `).bind(status, Date.now(), purchaseId).run();
  await recordLiveOpsEvent(env, {
    category: 'stripe', severity: status === 'refunded' ? 'info' : 'warning',
    eventType: status === 'refunded' ? 'refund-confirmed' : 'refund-requested',
    code: row.code, purchaseId, externalId: row.stripe_payment_intent_id,
    message: status === 'refunded'
      ? 'Stripe上の返金完了を確認し、購入権限を返金済みにしました。'
      : '購入権限を停止し、Stripe上の返金待ちにしました。',
  });
  return liveJson({ purchaseId, status, stripePaymentIntentId: row.stripe_payment_intent_id });
}

async function refundLiveCheckout(request, env, orderId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const body = await readLiveJson(request);
  const execute = body.execute === true || body.confirmed === true;
  const row = await purchaseDb.prepare(`
    SELECT order_id, product_type, code, purchase_id, stripe_payment_intent_id,
      stripe_refund_id, status FROM live_checkout_orders WHERE order_id = ?
  `).bind(orderId).first();
  if (!row) throw liveError('checkout-not-found', 404);
  if (row.status === 'refunded') return liveJson({ orderId, status: 'refunded', refundId: row.stripe_refund_id });
  if (!execute) {
    if (!['paid', 'fraud_review', 'refund_failed'].includes(row.status)) throw liveError('checkout-not-refundable', 409);
    await updateRefundState(purchaseDb, row, 'refund_pending');
    await recordLiveOpsEvent(env, {
      category: 'stripe', severity: 'warning', eventType: 'refund-requested',
      code: row.code, purchaseId: row.purchase_id || '', externalId: row.stripe_payment_intent_id || '',
      message: '購入権限を停止し、Stripe返金実行待ちにしました。', metadata: { orderId },
    });
    return liveJson({ orderId, status: 'refund_pending' });
  }
  if (!['refund_pending', 'refund_processing', 'refund_failed'].includes(row.status)) {
    throw liveError('refund-request-required', 409);
  }
  if (!/^pi_[A-Za-z0-9_]+$/.test(String(row.stripe_payment_intent_id || ''))) {
    throw liveError('stripe-payment-intent-missing', 409);
  }
  const reason = ['duplicate', 'fraudulent', 'requested_by_customer'].includes(body.reason)
    ? body.reason
    : 'requested_by_customer';
  const refund = await createLiveStripeRefund(env, {
    orderId: row.order_id,
    paymentIntentId: row.stripe_payment_intent_id,
    reason,
  });
  const status = refund.status === 'succeeded' ? 'refunded'
    : refund.status === 'failed' || refund.status === 'canceled' ? 'refund_failed' : 'refund_processing';
  await purchaseDb.prepare(`
    UPDATE live_checkout_orders
    SET stripe_refund_id = ?, status = ?, refunded_at = ?, updated_at = ? WHERE order_id = ?
  `).bind(
    String(refund.id || ''), status, status === 'refunded' ? Date.now() : null, Date.now(), row.order_id,
  ).run();
  if (row.purchase_id) {
    await purchaseDb.prepare(`UPDATE live_result_entitlements SET status = ?, updated_at = ? WHERE purchase_id = ?`)
      .bind(status, Date.now(), row.purchase_id).run();
  }
  await syncRevenueOrderStatus(purchaseDb, row.order_id, status, Date.now());
  await recordLiveOpsEvent(env, {
    category: 'stripe', severity: status === 'refunded' ? 'info' : status === 'refund_failed' ? 'critical' : 'warning',
    eventType: status === 'refunded' ? 'refund-completed' : status,
    code: row.code, purchaseId: row.purchase_id || '', externalId: String(refund.id || ''),
    message: status === 'refunded' ? 'Stripe APIで全額返金が完了しました。' : 'Stripeへ返金を送信し、最終状態をWebhookで待機しています。',
    metadata: { orderId, stripeStatus: refund.status || '' },
  });
  return liveJson({ orderId, status, refundId: String(refund.id || '') });
}

async function createLiveMonthlyPayoutBatches(request, env) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const body = await readLiveJson(request);
  const result = await buildMonthlyPayoutBatches(purchaseDb, body.periodKey, Date.now());
  await recordLiveOpsEvent(env, {
    category: 'payout', severity: 'info', eventType: 'monthly-payout-close-created',
    message: `${result.period.key}分の70%分配台帳を作成しました。`,
    metadata: { periodKey: result.period.key, created: result.created, skipped: result.skipped },
  });
  return liveJson(result, 201);
}

async function transferLiveMonthlyPayout(request, env, batchId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const batch = await getPayoutBatch(purchaseDb, batchId);
  if (!batch) throw liveError('payout-batch-not-found', 404);
  if (batch.status === 'transferred') {
    return liveJson({ batchId, status: 'transferred', transferId: batch.stripe_transfer_id });
  }
  if (Number(batch.transfer_amount) < 5000) throw liveError('payout-below-threshold', 409);
  if (!/^acct_[A-Za-z0-9]+$/.test(String(batch.stripe_account_id || ''))) {
    throw liveError('stripe-transfer-destination-invalid', 409);
  }
  await verifyPayoutBatchAllocations(purchaseDb, batch);
  await markPayoutBatchProcessing(purchaseDb, batchId);
  try {
    const transfer = await createLiveCreatorTransfer(env, {
      batchId,
      periodKey: batch.period_key,
      destination: batch.stripe_account_id,
      amount: Number(batch.transfer_amount),
      currency: batch.currency,
    });
    if (!/^tr_[A-Za-z0-9_]+$/.test(String(transfer.id || ''))) {
      throw liveError('stripe-transfer-response-invalid', 502);
    }
    await completePayoutBatch(purchaseDb, batchId, transfer.id);
    await recordLiveOpsEvent(env, {
      category: 'payout', severity: 'info', eventType: 'creator-transfer-completed',
      externalId: transfer.id,
      message: `${batch.period_key}分のYouTuber70%をStripe Connectへ送金しました。`,
      metadata: { batchId, stripeAccountId: batch.stripe_account_id, amount: Number(batch.transfer_amount) },
    });
    return liveJson({ batchId, status: 'transferred', transferId: transfer.id });
  } catch (error) {
    await failPayoutBatch(purchaseDb, batchId, error?.stripeCode || error?.message);
    await recordLiveOpsEvent(env, {
      category: 'payout', severity: 'critical', eventType: 'creator-transfer-failed',
      message: 'Stripe Connectへの月次送金に失敗しました。台帳を確認して再実行してください。',
      metadata: { batchId, stripeCode: error?.stripeCode || '', error: error?.message || '' },
    });
    throw error;
  }
}

async function updateRefundState(purchaseDb, row, status) {
  const now = Date.now();
  await purchaseDb.prepare(`UPDATE live_checkout_orders SET status = ?, updated_at = ? WHERE order_id = ?`)
    .bind(status, now, row.order_id).run();
  if (row.purchase_id) {
    await purchaseDb.prepare(`UPDATE live_result_entitlements SET status = ?, updated_at = ? WHERE purchase_id = ?`)
      .bind(status, now, row.purchase_id).run();
  }
  await syncRevenueOrderStatus(purchaseDb, row.order_id, status, now);
}

async function reissueLiveResultEntitlement(request, env, purchaseId) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const row = await purchaseDb.prepare(`
    SELECT purchase_id, code, status, available_until FROM live_result_entitlements WHERE purchase_id = ?
  `).bind(purchaseId).first();
  if (!row) throw liveError('entitlement-not-found', 404);
  if (row.status !== 'active' || Number(row.available_until) <= Date.now()) {
    throw liveError('entitlement-reissue-blocked', 409);
  }
  const accessToken = createLiveToken(32);
  const availableUntil = Number(row.available_until);
  await purchaseDb.prepare(`
    UPDATE live_result_entitlements
    SET access_token_hash = ?, updated_at = ?
    WHERE purchase_id = ?
  `).bind(await hashLiveSecret(accessToken), Date.now(), purchaseId).run();
  await recordLiveOpsEvent(env, {
    category: 'purchase', severity: 'info', eventType: 'entitlement-reissued',
    code: row.code, purchaseId, message: '購入権限を元の期限内で再発行し、旧アクセスURLを失効しました。',
  });
  const origin = new URL(request.url).origin;
  return liveJson({
    purchaseId,
    accessToken,
    availableUntil,
    entitlementUrl: `${origin}/api/live/result-entitlements/${purchaseId}?access=${accessToken}`,
  });
}

async function assertLiveServiceAvailable(env, blocksMaintenance) {
  const status = await getLiveSystemStatus(env);
  if (blocksMaintenance && status.mode === 'maintenance') throw liveError('live-maintenance', 503);
  return status;
}

async function handleLiveStripeWebhook(request, env) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET || '');
  if (!secret.startsWith('whsec_')) throw liveError('stripe-webhook-not-configured', 503);
  const payload = await request.text();
  const signatureHeader = String(request.headers.get('Stripe-Signature') || '');
  if (!await verifyLiveStripeSignature(payload, signatureHeader, secret)) throw liveError('stripe-signature-invalid', 400);
  let event;
  try { event = JSON.parse(payload); } catch (error) { throw liveError('stripe-payload-invalid', 400); }
  const type = String(event?.type || 'unknown');
  const object = event?.data?.object || {};
  const eventId = String(event?.id || '');
  if (!/^evt_[A-Za-z0-9_]+$/.test(eventId)) throw liveError('stripe-event-id-invalid', 400);
  const requiresPurchaseDb = [
    'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed', 'refund.updated', 'refund.failed',
    'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed',
    'radar.early_fraud_warning.created', 'charge.succeeded',
    'transfer.created', 'transfer.updated', 'transfer.reversed',
  ].includes(type);
  const purchaseDb = getLivePurchaseDb(env);
  if (requiresPurchaseDb && !purchaseDb) throw liveError('live-purchase-storage-not-configured', 503);
  let claimStatus = 'claimed';
  if (purchaseDb) {
    await requireLivePurchaseDb(env);
    claimStatus = await claimStripeEvent(purchaseDb, eventId, type);
    if (claimStatus === 'processed') {
      return liveJson({ received: true, duplicate: true, supportMessagesPublic: LIVE_SUPPORT_MESSAGES_PUBLIC });
    }
    if (claimStatus === 'processing') throw liveError('stripe-event-processing', 409);
  }
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type)
      && (type === 'checkout.session.async_payment_succeeded' || object.payment_status === 'paid')) {
      await fulfillLiveCheckout(request, env, object);
    }
    if (['payment_intent.payment_failed', 'checkout.session.async_payment_failed', 'charge.failed'].includes(type)) {
      if (purchaseDb) await markFailedCheckout(purchaseDb, object);
      await recordLiveOpsEvent(env, {
        category: 'stripe', severity: 'critical', eventType: type,
        externalId: String(event.id || object.id || '').slice(0, 160),
        message: String(object.last_payment_error?.message || object.failure_message || 'Stripe決済が失敗しました。').slice(0, 500),
        metadata: { objectId: String(object.id || ''), livemode: Boolean(event.livemode) },
      });
    }
    if (type === 'charge.succeeded') await syncSucceededCharge(env, object);
    if (['transfer.created', 'transfer.updated', 'transfer.reversed'].includes(type)) {
      const payout = await syncPayoutTransferEvent(purchaseDb, object, type);
      if (payout?.status === 'reversed') {
        await recordLiveOpsEvent(env, {
          category: 'payout', severity: 'critical', eventType: 'creator-transfer-reversed',
          externalId: String(object.id || ''),
          message: 'YouTuberへのConnect送金が取り消されました。売上台帳を手動確認してください。',
          metadata: payout,
        });
      }
    }
    const risk = assessStripePaymentRisk(event);
    if (risk.blocked) await holdRiskyPayment(env, event, risk);
    if (type === 'charge.dispute.closed') await syncClosedDispute(env, object);
    if (type === 'charge.refunded') await syncRefundByPaymentIntent(env, String(object.payment_intent || ''), 'refunded', object.id);
    if (type === 'refund.updated' || type === 'refund.failed') {
      const refundStatus = object.status === 'succeeded' ? 'refunded'
        : object.status === 'failed' || type === 'refund.failed' ? 'refund_failed' : 'refund_processing';
      await syncRefundByRefundId(env, String(object.id || ''), refundStatus);
    }
    if (purchaseDb) await completeStripeEvent(purchaseDb, eventId);
    return liveJson({ received: true, supportMessagesPublic: LIVE_SUPPORT_MESSAGES_PUBLIC });
  } catch (error) {
    if (purchaseDb) await failStripeEvent(purchaseDb, eventId, error).catch(() => {});
    throw error;
  }
}

async function fulfillLiveCheckout(request, env, session) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const orderId = String(session?.metadata?.live_order_id || session?.client_reference_id || '');
  const row = await purchaseDb.prepare(`
    SELECT * FROM live_checkout_orders
    WHERE order_id = ? OR stripe_checkout_session_id = ? LIMIT 1
  `).bind(orderId, String(session.id || '')).first();
  if (!row) throw liveError('checkout-order-not-found', 409);
  if (row.status === 'paid' && (row.product_type !== 'result_image' || row.purchase_id)) return row;
  if (String(session.id || '') !== String(row.stripe_checkout_session_id || '')
    || String(session.currency || '').toLowerCase() !== 'jpy'
    || Number(session.amount_total) !== Number(row.amount)
    || String(session.payment_status || '') !== 'paid') {
    throw liveError('checkout-payment-mismatch', 409);
  }
  const paymentIntentId = String(session.payment_intent || '');
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) throw liveError('stripe-payment-intent-missing', 409);
  let purchaseId = row.purchase_id || null;
  const paidAt = Date.now();
  if (row.product_type === 'result_image') {
    const participant = await loadParticipantById(env, row.code, row.participant_id);
    if (!participant) throw liveError('participant-forbidden', 403);
    const game = await requireLiveGame(env, row.code, { polling: true, participantToken: participant.token });
    if (game.phase !== 'complete') throw liveError('result-not-ready', 409);
    const participantGame = publicLiveGame(game, { participantToken: participant.token });
    purchaseId = purchaseId || `purchase_${String(row.order_id).replace(/^ord_/, '')}`;
    const accessToken = await derivePurchaseAccessToken(env, row.order_id);
    const purchaserEmail = normalizePurchaseEmail(session?.customer_details?.email || session?.customer_email);
    if (!purchaserEmail) throw liveError('checkout-customer-email-missing', 409);
    const availableUntil = paidAt + 30 * 24 * 60 * 60 * 1000;
    const assetKey = await createPaidResultAsset(
      request, env, game, participantGame, purchaseId, row.viewer_name || participant.name,
    );
    await purchaseDb.prepare(`
      INSERT OR IGNORE INTO live_result_entitlements (
        purchase_id, code, participant_id, participant_name, access_token_hash,
        purchaser_email_hash, stripe_payment_intent_id, asset_key, status,
        purchased_at, available_until, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).bind(
      purchaseId, row.code, participant.id, participant.name, await hashLiveSecret(accessToken),
      await hashPurchaseEmail(env, purchaserEmail), paymentIntentId, assetKey,
      paidAt, availableUntil, paidAt, paidAt,
    ).run();
  }
  await purchaseDb.prepare(`
    UPDATE live_checkout_orders
    SET purchase_id = ?, stripe_payment_intent_id = ?, status = 'paid', paid_at = ?, updated_at = ?
    WHERE order_id = ?
  `).bind(purchaseId, paymentIntentId, paidAt, paidAt, row.order_id).run();
  await recordPaidRevenue(purchaseDb, row, paidAt);
  await recordLiveOpsEvent(env, {
    category: 'purchase', severity: 'info', eventType: 'checkout-paid', code: row.code,
    purchaseId: purchaseId || '', externalId: paymentIntentId,
    message: row.product_type === 'result_image' ? '決済成功を確認し、高画質結果画像の生成・ダウンロード権限を発行しました。' : '応援金の決済成功を確認しました。',
    metadata: { orderId: row.order_id, productType: row.product_type, amount: Number(row.amount), creatorAmount: Number(row.creator_amount) },
  });
  return { ...row, purchase_id: purchaseId, stripe_payment_intent_id: paymentIntentId, status: 'paid', paid_at: paidAt };
}

async function loadParticipantById(env, code, participantId) {
  if (env.REMOTE_DB) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT participant_id, participant_token, name, joined_at
      FROM live_participants WHERE code = ? AND participant_id = ? LIMIT 1
    `).bind(code, participantId).first();
    return row ? { id: row.participant_id, token: row.participant_token, name: row.name, joinedAt: Number(row.joined_at) } : null;
  }
  const game = await getStoredLiveGame(env, code);
  return game?.participants?.find((item) => item.id === participantId) || null;
}

async function claimStripeEvent(db, eventId, eventType) {
  const now = Date.now();
  const result = await db.prepare(`
    INSERT OR IGNORE INTO live_stripe_events
      (event_id, event_type, status, attempt_count, last_error, created_at, updated_at)
    VALUES (?, ?, 'processing', 1, '', ?, ?)
  `).bind(eventId, eventType, now, now).run();
  if (Number(result?.meta?.changes) > 0) return 'claimed';
  const current = await db.prepare(`SELECT status, updated_at FROM live_stripe_events WHERE event_id = ?`).bind(eventId).first();
  if (!current || current.status === 'processed') return 'processed';
  if (current.status === 'processing' && Number(current.updated_at) > now - 5 * 60 * 1000) return 'processing';
  await db.prepare(`
    UPDATE live_stripe_events SET status = 'processing', attempt_count = attempt_count + 1,
      last_error = '', updated_at = ? WHERE event_id = ?
  `).bind(now, eventId).run();
  return 'claimed';
}

async function completeStripeEvent(db, eventId) {
  const now = Date.now();
  await db.prepare(`UPDATE live_stripe_events SET status = 'processed', processed_at = ?, updated_at = ? WHERE event_id = ?`)
    .bind(now, now, eventId).run();
}

async function failStripeEvent(db, eventId, error) {
  await db.prepare(`UPDATE live_stripe_events SET status = 'failed', last_error = ?, updated_at = ? WHERE event_id = ?`)
    .bind(String(error?.message || 'stripe-webhook-processing-failed').slice(0, 300), Date.now(), eventId).run();
}

async function markFailedCheckout(db, object) {
  const sessionId = String(object.id || '').startsWith('cs_') ? String(object.id) : '';
  const paymentIntentId = String(object.payment_intent || object.id || '').startsWith('pi_')
    ? String(object.payment_intent || object.id)
    : '';
  const orderId = String(object?.metadata?.live_order_id || '');
  await db.prepare(`
    UPDATE live_checkout_orders SET status = 'payment_failed', updated_at = ?
    WHERE stripe_checkout_session_id = ? OR stripe_payment_intent_id = ? OR order_id = ?
  `).bind(Date.now(), sessionId, paymentIntentId, orderId).run();
}

async function syncSucceededCharge(env, object) {
  const purchaseDb = await requireLivePurchaseDb(env);
  const chargeId = String(object.id || '');
  const paymentIntentId = String(object.payment_intent || '');
  const orderId = String(object?.metadata?.live_order_id || '');
  if (!chargeId.startsWith('ch_') || !paymentIntentId.startsWith('pi_')) return;
  await purchaseDb.prepare(`
    UPDATE live_checkout_orders
    SET stripe_charge_id = ?, stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, ?), updated_at = ?
    WHERE order_id = ? OR stripe_payment_intent_id = ?
  `).bind(chargeId, paymentIntentId, Date.now(), orderId, paymentIntentId).run();
  const order = await purchaseDb.prepare(`
    SELECT order_id, channel_verification_id, stripe_account_id, amount, currency,
      creator_amount, platform_amount
    FROM live_checkout_orders WHERE order_id = ? OR stripe_payment_intent_id = ? LIMIT 1
  `).bind(orderId, paymentIntentId).first();
  const charge = object.balance_transaction ? object : await retrieveLiveStripeCharge(env, chargeId);
  const balanceTransactionValue = charge.balance_transaction;
  const balanceTransactionId = String(
    typeof balanceTransactionValue === 'object' ? balanceTransactionValue?.id : balanceTransactionValue || '',
  );
  if (order && balanceTransactionId.startsWith('txn_')) {
    const balanceTransaction = typeof balanceTransactionValue === 'object'
      ? balanceTransactionValue
      : await retrieveLiveStripeBalanceTransaction(env, balanceTransactionId);
    await recordRevenueProcessingFee(purchaseDb, order, balanceTransaction);
  } else if (order) {
    await recordLiveOpsEvent(env, {
      category: 'payout', severity: 'warning', eventType: 'stripe-fee-pending',
      externalId: chargeId,
      message: 'Stripe残高取引が未確定のため、実決済手数料は売上台帳で未取得です。送金前にStripe Dashboardと照合してください。',
      metadata: { orderId: order.order_id, paymentIntentId },
    });
  }
}

async function holdRiskyPayment(env, event, risk) {
  const object = event?.data?.object || {};
  const paymentIntentId = String(object.payment_intent || object.payment_intent_id
    || object.id?.startsWith?.('pi_') && object.id || '');
  const chargeId = String(object.charge || object.id?.startsWith?.('ch_') && object.id || '');
  const purchaseDb = getLivePurchaseDb(env);
  if (purchaseDb && (paymentIntentId.startsWith('pi_') || chargeId.startsWith('ch_'))) {
    const order = await purchaseDb.prepare(`
      SELECT order_id, purchase_id, stripe_payment_intent_id FROM live_checkout_orders
      WHERE stripe_payment_intent_id = ? OR stripe_charge_id = ? LIMIT 1
    `).bind(paymentIntentId, chargeId).first();
    const matchedPaymentIntentId = String(order?.stripe_payment_intent_id || paymentIntentId);
    await purchaseDb.prepare(`
      UPDATE live_checkout_orders SET status = 'fraud_review', updated_at = ?
      WHERE order_id = ? AND status = 'paid'
    `).bind(Date.now(), order?.order_id || '').run();
    if (matchedPaymentIntentId.startsWith('pi_')) await purchaseDb.prepare(`
        UPDATE live_result_entitlements SET status = 'fraud_review', updated_at = ?
        WHERE stripe_payment_intent_id = ? AND status = 'active'
      `).bind(Date.now(), matchedPaymentIntentId).run();
    if (order?.order_id) await syncRevenueOrderStatus(purchaseDb, order.order_id, 'fraud_review', Date.now());
  }
  await recordLiveOpsEvent(env, {
    category: 'stripe', severity: 'critical', eventType: String(event.type || ''),
    externalId: String(event.id || object.id || '').slice(0, 160),
    message: 'カード不正利用の疑いを検知したため、購入権限とYouTuber分配を保留しました。',
    metadata: { paymentIntentId, chargeId, riskLevel: risk.riskLevel, riskScore: risk.riskScore, livemode: Boolean(event.livemode) },
  });
}

async function syncRefundByPaymentIntent(env, paymentIntentId, status, externalId) {
  if (!paymentIntentId.startsWith('pi_')) return;
  const purchaseDb = await requireLivePurchaseDb(env);
  const row = await purchaseDb.prepare(`
    SELECT order_id, purchase_id FROM live_checkout_orders WHERE stripe_payment_intent_id = ?
  `).bind(paymentIntentId).first();
  if (!row) return;
  await purchaseDb.prepare(`
    UPDATE live_checkout_orders SET status = ?, refunded_at = ?, updated_at = ? WHERE order_id = ?
  `).bind(status, status === 'refunded' ? Date.now() : null, Date.now(), row.order_id).run();
  if (row.purchase_id) await purchaseDb.prepare(`UPDATE live_result_entitlements SET status = ?, updated_at = ? WHERE purchase_id = ?`)
    .bind(status, Date.now(), row.purchase_id).run();
  await syncRevenueOrderStatus(purchaseDb, row.order_id, status, Date.now());
  await recordLiveOpsEvent(env, {
    category: 'stripe', severity: 'info', eventType: 'refund-synchronized', purchaseId: row.purchase_id || '',
    externalId: String(externalId || paymentIntentId), message: 'Stripe Webhookから返金完了を同期しました。', metadata: { orderId: row.order_id },
  });
}

async function syncClosedDispute(env, dispute) {
  const paymentIntentId = String(dispute?.payment_intent || '');
  const chargeId = String(dispute?.charge || '');
  const purchaseDb = await requireLivePurchaseDb(env);
  const row = await purchaseDb.prepare(`
    SELECT order_id, purchase_id FROM live_checkout_orders
    WHERE stripe_payment_intent_id = ? OR stripe_charge_id = ? LIMIT 1
  `).bind(paymentIntentId, chargeId).first();
  if (!row) return;
  const won = ['won', 'warning_closed'].includes(String(dispute.status || ''));
  const status = won ? 'paid' : 'chargeback';
  const now = Date.now();
  await purchaseDb.prepare('UPDATE live_checkout_orders SET status = ?, updated_at = ? WHERE order_id = ?')
    .bind(status, now, row.order_id).run();
  if (row.purchase_id) {
    await purchaseDb.prepare(`
      UPDATE live_result_entitlements
      SET status = CASE WHEN ? = 'paid' AND available_until > ? THEN 'active' ELSE ? END, updated_at = ?
      WHERE purchase_id = ?
    `).bind(status, now, status, now, row.purchase_id).run();
  }
  await syncRevenueOrderStatus(purchaseDb, row.order_id, status, now);
  await recordLiveOpsEvent(env, {
    category: 'stripe', severity: won ? 'info' : 'critical', eventType: won ? 'dispute-won' : 'chargeback-confirmed',
    purchaseId: row.purchase_id || '', externalId: String(dispute.id || ''),
    message: won
      ? 'チャージバック審査の勝訴を確認し、未送金分の保留を解除しました。'
      : 'チャージバック敗訴を確認し、YouTuber送金済み70%を次回分配の相殺対象にしました。',
    metadata: { orderId: row.order_id, disputeStatus: dispute.status || '' },
  });
}

async function syncRefundByRefundId(env, refundId, status) {
  if (!refundId.startsWith('re_')) return;
  const purchaseDb = await requireLivePurchaseDb(env);
  const row = await purchaseDb.prepare(`
    SELECT order_id, purchase_id FROM live_checkout_orders WHERE stripe_refund_id = ?
  `).bind(refundId).first();
  if (!row) return;
  await purchaseDb.prepare(`
    UPDATE live_checkout_orders SET status = ?, refunded_at = ?, updated_at = ? WHERE order_id = ?
  `).bind(status, status === 'refunded' ? Date.now() : null, Date.now(), row.order_id).run();
  if (row.purchase_id) await purchaseDb.prepare(`UPDATE live_result_entitlements SET status = ?, updated_at = ? WHERE purchase_id = ?`)
    .bind(status, Date.now(), row.purchase_id).run();
  await syncRevenueOrderStatus(purchaseDb, row.order_id, status, Date.now());
}

export async function verifyLiveStripeSignature(payload, signatureHeader, secret, now = Date.now()) {
  const signatureParts = signatureHeader.split(',').map((part) => part.trim().split('=', 2));
  const timestamp = Number(signatureParts.find(([key]) => key === 't')?.[1]);
  const signatures = signatureParts.filter(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value || '')).map(([, value]) => value);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300 || signatures.length === 0) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((signature) => constantTimeEqual(expectedBytes, hexToBytes(signature)));
}

function hexToBytes(value) {
  return new Uint8Array(String(value).match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) || []);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function connectLiveGameSocket(request, env, code) {
  if (!hasLiveRealtime(env)) throw liveError('live-realtime-unavailable', 503);
  const protocols = String(request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((item) => item.trim());
  const participantToken = protocols.find((item) => /^[a-f0-9]{20,96}$/i.test(item)) || '';
  const participant = await loadLiveParticipant(env, code, participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  return connectLiveRealtime(request, env, code, participant);
}

async function joinLiveGame(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime && Boolean(env.REMOTE_DB) });
  if (game.phase === 'complete') throw liveError('game-finished', 409);
  if (game.phase === 'terminated') throw liveError('game-terminated', 410);
  if (game.phase === 'cancelled') throw liveError('game-cancelled', 410);
  const body = await readLiveJson(request);
  const name = normalizeParticipantName(body && body.name);
  const viewerLimit = liveViewerLimit(env);
  if (!realtime && game.participants.length >= viewerLimit) throw liveError('participant-limit-reached', 409);
  let participant;
  let reservation;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = { id: createLiveToken(10), token: createLiveToken(24), name, joinedAt: Date.now() };
    try {
      reservation = realtime ? await reserveLiveRealtimeParticipant(env, code, candidate.token) : null;
      participant = candidate;
      break;
    } catch (error) {
      if (error.message !== 'participant-limit-reached' || attempt === 15) throw error;
    }
  }
  if (!participant) throw liveError('participant-limit-reached', 409);
  const usesD1 = await ensureLiveD1(env);
  if (usesD1) {
    try {
      const inserted = realtime
        ? await env.REMOTE_DB.prepare(`
            INSERT INTO live_participants (code, participant_id, participant_token, name, joined_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(code, participant.id, participant.token, participant.name, participant.joinedAt).run()
        : await env.REMOTE_DB.prepare(`
            INSERT INTO live_participants (code, participant_id, participant_token, name, joined_at)
            SELECT ?, ?, ?, ?, ?
            WHERE (SELECT COUNT(*) FROM live_participants WHERE code = ?) < ?
          `).bind(code, participant.id, participant.token, participant.name, participant.joinedAt, code, viewerLimit).run();
      if (Number(inserted?.meta?.changes || 0) !== 1) throw liveError('participant-limit-reached', 409);
    } catch (error) {
      if (realtime) await releaseLiveRealtimeParticipant(env, code, participant.token);
      throw error;
    }
  } else {
    game.participants.push(participant);
  }
  if (!realtime || !usesD1) {
    touchLiveGame(game);
    await putStoredLiveGame(env, code, game);
  }
  const participantCount = realtime ? reservation.participantCount : game.participants.length;
  game.participants = realtime ? [participant] : game.participants;
  game.participantCount = participantCount;
  game.participantLimit = viewerLimit;
  game.realtime = realtime;
  return liveJson({
    code,
    participantId: participant.id,
    participantToken: participant.token,
    game: publicLiveGame(game, { participantToken: participant.token }),
  }, 201);
}

async function voteLiveGame(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  if (game.phase !== 'voting') throw liveError('voting-closed', 409);
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  const participant = realtime
    ? await loadLiveParticipant(env, code, participantToken)
    : game.participants.find((item) => item.token === participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  const body = await readLiveJson(request);
  const question = game.questions[game.currentQuestionIndex];
  const optionIndex = Number(body && body.optionIndex);
  if (!question || body.questionId !== question.id) throw liveError('question-changed', 409);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw liveError('invalid-option', 400);
  }
  if (!realtime && Object.prototype.hasOwnProperty.call(game.votes[question.id] || {}, participant.id)) {
    throw liveError('already-voted', 409);
  }
  if (realtime) {
    await storeLiveRealtimeVote(env, code, participant, question, optionIndex);
    const stats = await loadLiveRealtimeStats(env, code, question);
    game.participants = [participant];
    game.participantCount = Number(stats?.participantCount) || 0;
    game.participantLimit = liveViewerLimit(env);
    game.realtime = true;
    game.currentVoteCounts = stats?.voteCounts || question.options.map(() => 0);
    game.votes = { [question.id]: { [participant.id]: optionIndex } };
    return liveJson({ code, accepted: true, game: publicLiveGame(game, { participantToken }) });
  }
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_votes (code, question_id, participant_id, option_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code, question_id, participant_id) DO UPDATE SET
        option_index = excluded.option_index,
        updated_at = excluded.updated_at
    `).bind(code, question.id, participant.id, optionIndex, Date.now()).run();
  } else {
    game.votes[question.id] = { ...(game.votes[question.id] || {}), [participant.id]: optionIndex };
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  const updatedGame = await requireLiveGame(env, code);
  return liveJson({ code, accepted: true, game: publicLiveGame(updatedGame, { participantToken }) });
}

async function answerLiveGameAsSubject(request, env, code) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  if (Number(game.version) < 4 || !game.subjectToken) throw liveError('subject-not-supported', 409);
  const subjectToken = normalizeToken(request.headers.get('x-live-subject-token'));
  if (!subjectToken || subjectToken !== game.subjectToken) throw liveError('subject-forbidden', 403);
  if (game.phase !== 'voting') throw liveError('answer-not-open', 409);
  const question = game.questions[game.currentQuestionIndex];
  const body = await readLiveJson(request);
  const optionIndex = Number(body && body.optionIndex);
  if (!question || body.questionId !== question.id) throw liveError('question-changed', 409);
  if (Number.isInteger(question.lockedIndex)) throw liveError('already-answered', 409);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw liveError('invalid-option', 400);
  }
  question.lockedIndex = optionIndex;
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  if (realtime) await broadcastCurrentRealtimeState(env, code, game);
  return liveJson({ code, accepted: true, game: publicLiveGame(game, { subject: true }) });
}

async function updateLiveGameAsHost(request, env, code, action) {
  const realtime = hasLiveRealtime(env);
  const game = await requireLiveGame(env, code, { baseOnly: realtime });
  await requireLiveHost(request, env, game);
  const shouldAcquireActiveSlot = action === 'start' && Number(game.version) >= 4;
  if (shouldAcquireActiveSlot && game.phase !== 'lobby') throw liveError('game-already-started', 409);
  if (shouldAcquireActiveSlot) await acquireLiveActiveSlot(env, code, game);
  try {
    if (realtime && action === 'advance' && game.phase === 'voting') {
      const question = game.questions[game.currentQuestionIndex];
      const snapshot = question ? await loadLiveRealtimeQuestionSnapshot(env, code, question) : null;
      if (question && snapshot) {
        game.votes[question.id] = snapshot.votes || {};
        game.currentVoteCounts = snapshot.voteCounts || question.options.map(() => 0);
      }
    }
    if (Number(game.version) >= 4) {
      await updateSeparatedLiveGame(request, game, action);
    } else if (Number(game.version) >= 3) {
      await updateCurrentLiveGame(request, game, action);
    } else {
      await updateLegacyLiveGame(request, game, action);
    }
    touchLiveGame(game);
    await putStoredLiveGame(env, code, game);
    if (realtime) await broadcastCurrentRealtimeState(env, code, game);
  } catch (error) {
    if (shouldAcquireActiveSlot) await releaseLiveActiveSlot(env, code);
    throw error;
  }
  if (game.phase === 'complete') await releaseLiveActiveSlot(env, code);
  if (realtime) await enrichRealtimeGame(env, code, game, { host: true });
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

async function updateSeparatedLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.currentQuestionIndex = 0;
    game.phase = 'voting';
  } else if (action === 'advance') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    if (!question || !Number.isInteger(question.lockedIndex)) throw liveError('answer-required', 409);
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.currentQuestionIndex = 0;
      game.phase = 'review-question';
    } else {
      game.currentQuestionIndex += 1;
    }
  } else if (action === 'reveal') {
    if (game.phase !== 'review-question') throw liveError('review-not-open', 409);
    game.phase = 'review-answer';
  } else if (action === 'next') {
    if (game.phase !== 'review-answer') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = 'review-question';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

async function updateCurrentLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.currentQuestionIndex = 0;
    game.phase = 'voting';
  } else if (action === 'advance') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    const body = await readLiveJson(request);
    const optionIndex = Number(body && body.optionIndex);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw liveError('invalid-option', 400);
    }
    question.lockedIndex = optionIndex;
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.currentQuestionIndex = 0;
      game.phase = 'review-question';
    } else {
      game.currentQuestionIndex += 1;
    }
  } else if (action === 'reveal') {
    if (game.phase !== 'review-question') throw liveError('review-not-open', 409);
    game.phase = 'review-answer';
  } else if (action === 'next') {
    if (game.phase !== 'review-answer') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = 'review-question';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

async function updateLegacyLiveGame(request, game, action) {
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.phase = game.questions[game.currentQuestionIndex]?.lockedIndex === null ? 'answering' : 'voting';
  } else if (action === 'answer') {
    if (game.phase !== 'answering') throw liveError('answer-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    const body = await readLiveJson(request);
    const optionIndex = Number(body && body.optionIndex);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
      throw liveError('invalid-option', 400);
    }
    question.lockedIndex = optionIndex;
    game.phase = 'voting';
  } else if (action === 'close') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    if (question.type !== 'poll' && !Number.isInteger(question.lockedIndex)) throw liveError('answer-required', 409);
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    game.phase = 'reveal';
  } else if (action === 'next') {
    if (game.phase !== 'reveal') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = game.questions[game.currentQuestionIndex]?.lockedIndex === null ? 'answering' : 'voting';
    }
  } else {
    throw liveError('invalid-host-action', 409);
  }
}

export function publicLiveGame(game, access = {}) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const currentVotes = question ? game.votes[question.id] || {} : {};
  const participants = Array.isArray(game.participants) ? game.participants : [];
  const flowVersion = Number(game.version) || 1;
  const participant = access.participantToken
    ? participants.find((item) => item.token === access.participantToken)
    : null;
  const storedRevealResult = question && ['reveal', 'review-answer', 'complete'].includes(game.phase)
    ? game.results.find((item) => item.questionId === question.id) || null
    : null;
  const revealResult = storedRevealResult
    ? participantLiveResult(storedRevealResult, participant, game.votes)
    : null;
  const completedResults = game.phase === 'complete'
    ? game.results.map((result) => participantLiveResult(result, participant, game.votes))
    : [];
  const subjectAnswered = Number.isInteger(question?.lockedIndex);
  const canSeeVoteCount = flowVersion < 4 || access.host || (access.subject ? subjectAnswered : game.showVoteCount);
  const summarizedVoteCounts = question && Array.isArray(game.currentVoteCounts)
    && game.currentVoteCounts.length === question.options.length
    ? game.currentVoteCounts.map((count) => Math.max(0, Number(count) || 0))
    : null;
  const voteCounts = question
    ? summarizedVoteCounts || question.options.map((_, optionIndex) => Object.values(currentVotes).filter((value) => Number(value) === optionIndex).length)
    : [];
  const voteCount = voteCounts.reduce((total, count) => total + count, 0);
  const publicQuestion = question ? {
    id: question.id,
    type: question.type,
    text: question.text,
    options: question.options,
    subjectAnswered,
    result: revealResult,
    ...(canSeeVoteCount ? { voteCount } : {}),
    ...(flowVersion >= 4 && canSeeVoteCount ? { voteCounts } : {}),
    ...(access.subject ? { myAnswerIndex: Number.isInteger(question.lockedIndex) ? question.lockedIndex : null } : {}),
  } : null;
  return {
    title: game.title,
    subjectName: game.subjectName,
    flowVersion,
    phase: game.phase,
    terminated: game.phase === 'terminated',
    terminationMessage: game.phase === 'terminated' ? String(game.terminationMessage || '') : undefined,
    cancelled: game.phase === 'cancelled',
    cancellationMessage: game.phase === 'cancelled' ? String(game.cancellationMessage || '') : undefined,
    currentQuestionIndex: game.currentQuestionIndex,
    questionCount: game.questions.length,
    participantCount: Number.isInteger(game.participantCount) ? game.participantCount : participants.length,
    participantLimit: Number(game.participantLimit) || (game.realtime ? LIVE_VIEWER_LIMIT : LIVE_FALLBACK_VIEWER_LIMIT),
    participants: access.host ? participants.map(({ id, name }) => ({ id, name })) : [],
    question: publicQuestion,
    myVoteIndex: participant && Object.prototype.hasOwnProperty.call(currentVotes, participant.id)
      ? Number(currentVotes[participant.id])
      : null,
    results: completedResults,
    showVoteCount: Boolean(game.showVoteCount),
    realtime: Boolean(game.realtime),
    scheduledAt: Number(game.scheduledAt) || undefined,
    channelName: game.channelName || game.subjectName,
    resultImagePrice: LIVE_RESULT_IMAGE_PRICES.includes(Number(game.resultImagePrice)) ? Number(game.resultImagePrice) : 0,
    supportAmounts: LIVE_SUPPORT_AMOUNTS,
    hasCreatorImage: Boolean(game.creatorImage?.previewKey)
      && (!game.creatorImage.moderationStatus || game.creatorImage.moderationStatus === 'approved'),
    participantName: participant?.name,
    host: Boolean(access.host),
    subject: Boolean(access.subject),
    questions: access.host ? game.questions.map(({ id, type, text, options }) => ({ id, type, text, options })) : undefined,
    ...(access.host && flowVersion >= 4 ? { subjectToken: game.subjectToken } : {}),
    ...(access.host ? { creatorImageModerationStatus: game.creatorImage?.moderationStatus || (game.creatorImage?.previewKey ? 'approved' : 'none') } : {}),
    expiresAt: access.host ? game.expiresAt : undefined,
  };
}

function participantLiveResult(result, participant, votes) {
  if (!participant || !result) return result;
  const questionVotes = votes && votes[result.questionId] || {};
  const hasVote = Object.prototype.hasOwnProperty.call(questionVotes, participant.id);
  const myVoteIndex = hasVote ? Number(questionVotes[participant.id]) : null;
  if (result.type === 'guess-person') {
    return { ...result, myVoteIndex, myIsCorrect: hasVote ? myVoteIndex === result.subjectAnswerIndex : null };
  }
  if (result.type === 'guess-majority') {
    return { ...result, myVoteIndex, myVoteWasPopular: hasVote ? result.popularIndices.includes(myVoteIndex) : null };
  }
  return { ...result, myVoteIndex };
}

async function createYouTubeCandidatesResponse(request, env) {
  const body = await readLiveJson(request);
  const input = normalizeYouTubeInput(body && body.channelUrl);
  if (!input) throw liveError('invalid-youtube-url', 400);
  const questionType = body && body.questionType;
  if (!['guess-person', 'guess-majority'].includes(questionType)) throw liveError('invalid-youtube-question-type', 400);
  const seed = Number(body && body.seed) || 0;
  const profile = await fetchYouTubeChannelProfile(input, env);
  await requireLiveCreatorInvite(request, env, profile.channelId);
  const contentSources = await loadYouTubeCaptionSources(env, profile.channelId);
  const groundedProfile = { ...profile, contentSources };
  return liveJson({
    channelUrl: profile.channelUrl || input.url,
    profile: {
      ...profile,
      contentSourceCount: contentSources.length,
      contentGrounding: contentSources.length ? 'owner-authorized-captions' : 'youtube-metadata',
    },
    questionType,
    questions: generateYouTubeQuestions(groundedProfile, seed, questionType),
  });
}

async function loadYouTubeCaptionSources(env, channelId) {
  if (!env.REMOTE_DB || !channelId) return [];
  try {
    await ensureLiveD1(env);
    const result = await env.REMOTE_DB.prepare(`
      SELECT video_id, video_title, transcript, language, auto_generated
      FROM live_youtube_caption_sources
      WHERE channel_id = ? AND expires_at > ?
      ORDER BY fetched_at DESC LIMIT 8
    `).bind(channelId, Date.now()).all();
    return (result.results || []).map((row) => ({
      videoId: String(row.video_id || ''),
      title: String(row.video_title || ''),
      transcript: String(row.transcript || ''),
      language: String(row.language || ''),
      autoGenerated: Number(row.auto_generated) === 1,
    }));
  } catch (error) {
    return [];
  }
}

export function normalizeYouTubeChannelUrl(value) {
  const input = normalizeYouTubeInput(value);
  return input && input.kind === 'channel' ? input.url : '';
}

export function normalizeYouTubeInputUrl(value) {
  return normalizeYouTubeInput(value)?.url || '';
}

export async function fetchYouTubeChannelProfile(inputValue, env = {}) {
  return fetchYouTubeDataProfile(inputValue, env);
}

export function generateYouTubeQuestions(profile, seed = 0, questionType = 'guess-person') {
  const name = String(profile && profile.channelName || 'このチャンネル').trim() || 'このチャンネル';
  const videos = Array.isArray(profile && profile.videoTitles)
    ? [...new Set(profile.videoTitles.map(shortYouTubeLabel).filter(Boolean))].slice(0, 20)
    : [];
  const topics = extractYouTubeTopics(profile);
  const contentMoments = extractYouTubeContentMoments(profile);
  const videoOptions = (offset) => videos.length >= 2
    ? Array.from({ length: Math.min(5, videos.length) }, (_, index) => videos[(offset + index) % videos.length])
    : ['トーク企画', 'チャレンジ企画', 'コラボ企画', '生配信', '密着・日常企画'];
  const videoAt = (index) => videos[index % Math.max(videos.length, 1)] || 'このチャンネルの動画';
  const topicAt = (index) => topics[index % Math.max(topics.length, 1)] || name;
  const tailoredPersonTemplates = videos.length >= 2 || topics.length >= 2 ? [
    ['本人が撮影の裏話を一番語りたい動画は？', videoOptions(0)],
    ['本人が予想以上の反響に驚いた動画は？', videoOptions(3)],
    ['本人が同じメンバーでもう一度撮りたい動画は？', videoOptions(6)],
    ['本人が公開前に一番緊張した動画は？', videoOptions(9)],
    ['本人が今の自分らしさを一番感じる動画は？', videoOptions(12)],
    [`「${videoAt(0)}」で、本人が実は一番こだわった部分は？`, ['企画の内容', '撮影場所・道具', '話す順番', '編集・見せ方', '出演者とのやり取り']],
    [`「${videoAt(1)}」を公開した直後、本人の気持ちに一番近かったのは？`, ['手応えがあった', '反応が心配だった', 'すぐ続編を考えた', '撮り直したかった', 'やり切って安心した']],
    [`「${videoAt(2)}」で、本人が視聴者に一番気づいてほしいことは？`, ['細かい演出', '出演者の反応', '準備の大変さ', '本人の本音', '動画に込めたメッセージ']],
    [`本人が「${topicAt(0)}」を次に扱うなら、一番やりたい形は？`, ['続編を作る', '生配信で深掘りする', '別の人とコラボする', '視聴者参加型にする', '舞台裏を見せる']],
    [`本人が「${topicAt(1)}」について、まだ話せていないことは？`, ['始めたきっかけ', '失敗したこと', '一番のこだわり', '周りの反応', 'これからの目標']],
    ['チャンネル内で本人だけが知っているハプニングが一番多かった動画は？', videoOptions(15)],
    [`入力された「${videoAt(0)}」を本人が友達に見せるなら、最初に伝えたいことは？`, ['一番笑ってほしい場面', '撮影の裏話', '出演者との関係', '企画の狙い', '最後まで見てほしい理由']],
  ] : [];
  const personTemplates = [
    ['本人が初めて見る人に一番おすすめしたい動画は？', videoOptions(0)],
    ['本人が今もう一度見てほしい動画は？', videoOptions(3)],
    ['本人が撮影で一番大切にしていることは？', ['面白さ', '分かりやすさ', '自分らしさ', '視聴者との距離']],
    ['本人が次に一番挑戦したい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['本人が動画作りで一番好きな時間は？', ['企画を考える時', '撮影中', '編集している時', '公開後の反応を見る時']],
    ['本人が撮影前に一番気にすることは？', ['話す内容', '見た目', '撮影場所', '体調']],
    ['本人がチャンネルの強みだと思うものは？', ['企画力', 'トーク', '編集', 'キャラクター']],
    ['本人が一番うれしい視聴者の反応は？', ['笑った', '参考になった', '元気が出た', 'また見たい']],
    ['本人が一緒に動画を作りたい相手は？', ['同ジャンルの人', '違うジャンルの人', '視聴者', '昔からの友達']],
    ['本人が動画で一番見せたい一面は？', ['面白いところ', '真剣なところ', '自然体', '意外な特技']],
    ['本人が一番落ち着く撮影スタイルは？', ['一人撮影', '少人数', '大人数', '屋外ロケ']],
    ['本人がチャンネルで今後増やしたいものは？', ['短い動画', '長い動画', '生配信', 'シリーズ企画']],
    ['本人が企画を決める時に一番頼るものは？', ['自分の直感', 'コメント', '流行', '仲間の意見']],
    ['本人が動画を公開する時の気持ちに近いものは？', ['楽しみ', '緊張', '達成感', 'すぐ次を作りたい']],
    [`本人が「${name}」を一言で表すなら？`, ['挑戦', '笑い', 'つながり', '自分らしさ']],
    ['本人が動画を一本だけ残すならどれを選ぶ？', videoOptions(6)],
    ['本人が一番自分らしく話せたと思う動画は？', videoOptions(9)],
    ['本人が朝起きて最初に確認するものは？', ['コメント', '再生数', '今日の予定', 'SNS']],
    ['本人が編集で一番こだわる部分は？', ['テンポ', '音楽・効果音', 'テロップ', '映像の色']],
    ['本人が撮影で予想外に苦労しやすいことは？', ['準備', '話の流れ', '機材', '時間管理']],
    ['本人が一番伸ばしたいスキルは？', ['トーク', '企画', '撮影', '編集']],
    ['本人が動画のアイデアを思いつきやすい場所は？', ['自宅', '移動中', '人と話している時', 'コメントを見ている時']],
    ['本人が撮影後に最初にすることは？', ['映像を確認する', '休憩する', '編集を始める', 'SNSを更新する']],
    ['本人が一番大切にしたいチャンネルの雰囲気は？', ['楽しい', '落ち着く', '学べる', '驚きがある']],
    ['本人が視聴者と一緒に実現したいことは？', ['記念企画', 'イベント', '商品作り', '社会貢献']],
    ['本人が過去の自分に一つ助言するなら？', ['もっと投稿する', '失敗を恐れない', '得意を伸ばす', '休む時間を作る']],
    ['本人が撮影日に一番欠かせないものは？', ['飲み物', '台本・メモ', 'お気に入りの機材', '応援してくれる仲間']],
    ['本人が一番達成感を感じる瞬間は？', ['撮影が終わった時', '編集が完成した時', '公開した時', '反響が届いた時']],
    ['本人が次の節目でやりたいことは？', ['特別動画', '生配信', 'コラボ', '視聴者参加企画']],
    [`本人が「${name}」を続ける一番の原動力は？`, ['作る楽しさ', '視聴者の反応', '仲間との活動', '目標の実現']],
  ];
  const tailoredMajorityTemplates = videos.length >= 2 || topics.length >= 2 ? [
    ['視聴者が一番「撮影の裏側を知りたい」と思う動画は？', videoOptions(0)],
    ['視聴者が身内に一番すすめたい動画は？', videoOptions(3)],
    ['視聴者が続編を本気で待っている動画は？', videoOptions(6)],
    ['視聴者が本人らしさを一番感じる動画は？', videoOptions(9)],
    ['視聴者が今見返すと新しい発見がありそうだと思う動画は？', videoOptions(12)],
    [`「${videoAt(0)}」の続編で、視聴者が一番見たいものは？`, ['同じ企画の再挑戦', '撮影の舞台裏', '別メンバー版', '視聴者参加版', '本人による振り返り']],
    [`「${videoAt(1)}」で、視聴者が一番印象に残ったと思う要素は？`, ['本人のリアクション', '出演者との掛け合い', '予想外の展開', '企画そのもの', '最後のまとめ']],
    [`「${videoAt(2)}」について、視聴者が本人に一番聞きたいことは？`, ['撮影前の予想', '一番大変だった場面', '動画に入らなかった話', '出演者との関係', '公開後の本音']],
    [`視聴者が「${topicAt(0)}」で次に見たい企画は？`, ['もっと深掘りする', '別の場所で挑戦する', 'ゲストを呼ぶ', '生配信でやる', '視聴者も参加する']],
    [`視聴者が「${topicAt(1)}」について一番知りたいことは？`, ['始めたきっかけ', '本人のこだわり', '失敗や裏話', '仲間との関係', '今後の予定']],
    ['古参視聴者と最近の視聴者で答えが一番分かれそうな動画は？', videoOptions(15)],
    [`入力された「${videoAt(0)}」を初見の人に見せた時、一番反応されそうなのは？`, ['本人のキャラクター', '企画の発想', '出演者との空気感', '編集のテンポ', '予想外の結末']],
  ] : [];
  const groundedTemplates = contentMoments.length >= 5
    ? buildGroundedYouTubeTemplates(contentMoments, questionType)
    : [];
  const majorityTemplates = [
    ['視聴者が初めての人に一番すすめたい動画は？', videoOptions(1)],
    ['視聴者が続編を一番見たい動画は？', videoOptions(4)],
    ['視聴者が次に一番見たい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['視聴者がチャンネルの一番好きなところは？', ['企画', 'トーク', '編集', '人柄']],
    ['視聴者が動画を見ることが多い時間は？', ['朝', '昼', '夕方', '夜']],
    ['視聴者が一番参加したい企画は？', ['質問コーナー', '投票企画', 'ライブ配信', 'オフラインイベント']],
    ['視聴者がもっと知りたいことは？', ['日常', '制作の裏側', '好きなもの', '今後の目標']],
    ['視聴者が一番うれしい更新は？', ['毎日短く更新', '週1で大作', '不定期ライブ', 'シリーズを継続']],
    ['視聴者がコラボで見たい相手は？', ['同ジャンル', '別ジャンル', '友達', '視聴者']],
    ['視聴者が一番印象に残る要素は？', ['タイトル', 'サムネイル', '最初の1分', 'ラスト']],
    ['視聴者が友達に紹介する時の一言は？', ['笑える', '役に立つ', '親しみやすい', '企画がすごい']],
    ['視聴者が見返したくなる動画は？', ['トーク', 'チャレンジ', 'コラボ', '密着・日常']],
    ['視聴者が一番応援したくなる瞬間は？', ['新しい挑戦', '失敗からの再挑戦', '目標達成', '視聴者への感謝']],
    ['視聴者がグッズにするなら一番ほしいものは？', ['ステッカー', 'Tシャツ', 'アクリルグッズ', '実用品']],
    [`視聴者が「${name}」に今後一番期待することは？`, ['もっと大きな企画', '今の雰囲気を続ける', '更新回数を増やす', '視聴者参加を増やす']],
    ['視聴者が一番人に見せたくなる動画は？', videoOptions(7)],
    ['視聴者がチャンネルを知るきっかけになりそうな動画は？', videoOptions(10)],
    ['視聴者が通知を見てすぐ再生したくなる企画は？', ['新シリーズ', '大型チャレンジ', '人気企画の続編', 'コラボ']],
    ['視聴者が動画で一番聞きたい話は？', ['最近の出来事', '失敗談', '将来の目標', '制作の裏話']],
    ['視聴者が一番まねしてみたいものは？', ['企画', '習慣', '話し方', '使っている道具']],
    ['視聴者が動画を最後まで見る決め手は？', ['展開が気になる', '話が面白い', '役に立つ', '雰囲気が好き']],
    ['視聴者が一番親近感を持つ瞬間は？', ['失敗した時', '日常を見せた時', '本音を話した時', 'コメントに反応した時']],
    ['視聴者が生配信で一番やってほしいことは？', ['質問回答', 'ゲーム・挑戦', '雑談', '一緒に企画を決める']],
    ['視聴者が動画の長さとして一番見やすいのは？', ['1分未満', '5分前後', '10〜20分', '30分以上']],
    ['視聴者が一番保存したくなる動画は？', ['役立つ解説', 'お気に入り企画', '感動する話', '何度も笑える動画']],
    ['視聴者が新しく見てみたい撮影場所は？', ['自宅・スタジオ', '街中', '自然の中', '海外']],
    ['視聴者が一番好きな投稿ペースは？', ['毎日', '週2〜3回', '週1回', '質重視で不定期']],
    ['視聴者がメンバーになったら一番ほしい特典は？', ['限定動画', '限定配信', '制作の裏側', '先行公開']],
    ['視聴者がチャンネルの次の目標にしてほしいことは？', ['登録者の節目', '大型企画', 'イベント開催', '新しい分野への挑戦']],
    [`視聴者が「${name}」を見続ける一番の理由は？`, ['動画が面白い', '本人が好き', '役に立つ', '一緒に成長を感じる']],
  ];
  const rotate = (items) => {
    const offset = Math.abs(Number(seed) || 0) % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };
  const templates = questionType === 'guess-majority'
    ? [...groundedTemplates, ...tailoredMajorityTemplates, ...majorityTemplates].slice(0, 30)
    : [...groundedTemplates, ...tailoredPersonTemplates, ...personTemplates].slice(0, 30);
  const idPrefix = questionType === 'guess-majority' ? 'yt-majority' : 'yt-person';
  return rotate(templates).map(([text, options], index) => ({
    id: `${idPrefix}-${seed}-${index}`,
    type: questionType === 'guess-majority' ? 'guess-majority' : 'guess-person',
    text,
    options: normalizeYouTubeOptions(options),
    lockedIndex: null,
    selected: index < 5,
    recommended: index < 5,
  }));
}

export function extractYouTubeContentMoments(profile) {
  const sources = Array.isArray(profile?.contentSources) ? profile.contentSources : [];
  const moments = [];
  const seen = new Set();
  for (const source of sources) {
    const title = shortYouTubeLabel(source?.title || '動画内の場面');
    const sentences = String(source?.transcript || '')
      .split(/\n+|(?<=[。！？!?])\s*/u)
      .map((value) => cleanYouTubeText(value).replace(/^[-–—・]+/, '').trim())
      .filter(Boolean);
    for (const sentence of sentences) {
      const characters = [...sentence];
      if (characters.length < 8 || characters.length > 72) continue;
      if (/^(はい|えー|あの|ということで|ご視聴|チャンネル登録|ありがとうございました)[、。！!\s]/u.test(sentence)) continue;
      const normalized = sentence.normalize('NFKC').replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase();
      if (normalized.length < 6 || seen.has(normalized)) continue;
      seen.add(normalized);
      moments.push({
        title,
        text: sentence,
        label: characters.length > 34 ? `${characters.slice(0, 33).join('')}…` : sentence,
      });
      if (moments.length >= 32) return moments;
    }
  }
  return moments;
}

function buildGroundedYouTubeTemplates(moments, questionType) {
  const at = (index) => moments[index % moments.length];
  const optionsAt = (offset) => {
    const values = [];
    for (let index = 0; index < moments.length && values.length < 5; index += 1) {
      const label = at(offset + index).label;
      if (!values.includes(label)) values.push(label);
    }
    return values;
  };
  const personBuilders = [
    (moment, index) => [`「${moment.title}」の「${moment.label}」付近で、本人が今いちばん裏話を足したい場面は？`, optionsAt(index)],
    (moment) => [`動画で「${moment.label}」と話していた時、本人の本音に一番近かったのは？`, ['本気でそう思っていた', '笑いを優先していた', '少し迷いがあった', '周りの反応を見ていた', 'まだ続きがあった']],
    (moment, index) => [`本人が「${moment.label}」の続きをライブで話すなら、最初に選ぶ話題は？`, optionsAt(index + 1)],
    (moment, index) => [`「${moment.title}」の「${moment.label}」付近で、本人が一番“内輪”だと思うくだりは？`, optionsAt(index + 2)],
    (moment) => [`本人が「${moment.label}」を今振り返って変えたいところは？`, ['言い方', '企画の進め方', 'リアクション', '編集での見せ方', '何も変えたくない']],
    (moment) => [`「${moment.label}」について、本人だけが知る答えに一番近いのは？`, ['撮影前から決めていた', 'その場で生まれた', 'カットした続きがある', '別の人の提案だった', '本人も予想外だった']],
  ];
  const majorityBuilders = [
    (moment, index) => [`「${moment.title}」の「${moment.label}」付近で、視聴者が一番覚えている内輪の場面は？`, optionsAt(index)],
    (moment) => [`動画内の「${moment.label}」を見た視聴者の反応で一番多そうなのは？`, ['本人らしい', '意外だった', '続きが気になる', '裏話を聞きたい', 'もう一度見返したい']],
    (moment, index) => [`視聴者が「${moment.label}」と一緒に思い出す話題は？`, optionsAt(index + 1)],
    (moment, index) => [`「${moment.title}」の「${moment.label}」付近で、古参視聴者ほど反応しそうなくだりは？`, optionsAt(index + 2)],
    (moment) => [`「${moment.label}」について、視聴者が本人に一番聞きたいことは？`, ['本当の気持ち', '撮影前の経緯', 'カットされた続き', '周りの反応', '今ならどう答えるか']],
    (moment) => [`動画内の「${moment.label}」を次の企画にするなら、視聴者が一番見たい形は？`, ['本人だけで深掘り', '同じメンバーで再挑戦', '別メンバー版', '視聴者参加版', '生配信で答え合わせ']],
  ];
  const builders = questionType === 'guess-majority' ? majorityBuilders : personBuilders;
  return Array.from({ length: 20 }, (_, index) => builders[index % builders.length](at(index), index));
}

export function extractYouTubeTopics(profile) {
  const found = [];
  const add = (value) => {
    const topic = cleanYouTubeText(value)
      .replace(/^#+/, '')
      .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
      .trim();
    const generic = /^(動画|チャンネル|youtube|youtuber|shorts?|ライブ|配信|公式|最新|今回|こちら|お知らせ)$/i;
    if (topic.length >= 2 && topic.length <= 28 && !generic.test(topic) && !found.includes(topic)) found.push(topic);
  };
  const summaries = Array.isArray(profile?.videoSummaries) ? profile.videoSummaries : [];
  const keywordValues = [
    ...(Array.isArray(profile?.sourceVideo?.keywords) ? profile.sourceVideo.keywords : []),
    ...summaries.flatMap((video) => Array.isArray(video.keywords) ? video.keywords : []),
  ];
  keywordValues.forEach(add);
  const texts = [
    profile?.description,
    profile?.sourceVideo?.description,
    ...(Array.isArray(profile?.videoTitles) ? profile.videoTitles : []),
    ...summaries.flatMap((video) => [video.title, video.description]),
  ].filter(Boolean);
  for (const text of texts) {
    for (const match of String(text).matchAll(/#([\p{L}\p{N}_ー]{2,28})/gu)) add(match[1]);
    for (const match of String(text).matchAll(/[【「『]([^】」』]{2,28})[】」』]/gu)) add(match[1]);
    String(text).replace(/https?:\/\/\S+/g, ' ').split(/[\s|｜/／:：!?！？。、,，()（）\[\]【】「」『』]+/u).forEach(add);
    if (found.length >= 16) break;
  }
  return found.slice(0, 16);
}

function shortYouTubeLabel(value) {
  const text = cleanYouTubeText(value);
  const characters = [...text];
  return characters.length > 48 ? `${characters.slice(0, 47).join('')}…` : text;
}

function normalizeYouTubeOptions(options) {
  const normalized = [...new Set((options || []).map((option) => String(option || '').trim()).filter(Boolean))];
  for (const fallback of ['その他', 'どれも同じくらい', 'まだわからない', '特に決めていない', '別の答え']) {
    if (normalized.length >= 5) break;
    if (!normalized.includes(fallback)) normalized.push(fallback);
  }
  return normalized.slice(0, 5);
}


function cleanYouTubeText(value) {
  return decodeHtml(String(value || '').replace(/^<!\[CDATA\[|\]\]>$/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function requireLiveGame(env, code, options = {}) {
  if (!LIVE_CODE_PATTERN.test(code)) throw liveError('room-not-found', 404);
  const game = await getStoredLiveGame(env, code, options);
  if (!game) throw liveError('room-not-found', 404);
  return game;
}

async function ensureLiveD1(env) {
  if (!env.REMOTE_DB) return false;
  if (!liveD1ReadyPromise) {
    liveD1ReadyPromise = Promise.all([
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_games (
          code TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_participants (
          code TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          participant_token TEXT NOT NULL,
          name TEXT NOT NULL,
          joined_at INTEGER NOT NULL,
          PRIMARY KEY (code, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_votes (
          code TEXT NOT NULL,
          question_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          option_index INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (code, question_id, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_rate_limits (
          rate_key TEXT PRIMARY KEY,
          window_start INTEGER NOT NULL,
          request_count INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_reservations (
          code TEXT PRIMARY KEY,
          scheduled_at INTEGER NOT NULL,
          blocked_from INTEGER NOT NULL,
          blocked_until INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_active_sessions (
          lock_key TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          started_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_channel_verifications (
          verification_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, channel_name TEXT NOT NULL,
          channel_url TEXT NOT NULL, access_token_hash TEXT NOT NULL, confirmation_code TEXT NOT NULL,
          ownership_status TEXT NOT NULL DEFAULT 'pending', ownership_method TEXT NOT NULL DEFAULT '',
          stripe_account_id TEXT NOT NULL DEFAULT '', stripe_identity_verified INTEGER NOT NULL DEFAULT 0,
          stripe_relationship_status TEXT NOT NULL DEFAULT 'pending', oauth_state_hash TEXT,
          oauth_state_expires_at INTEGER, verified_at INTEGER, reviewed_at INTEGER,
          reviewed_by TEXT NOT NULL DEFAULT '', request_ip TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_creator_agreements (
          agreement_id TEXT PRIMARY KEY, verification_id TEXT NOT NULL, channel_id TEXT NOT NULL,
          stripe_account_id TEXT NOT NULL, terms_version TEXT NOT NULL,
          terms_document_sha256 TEXT NOT NULL, contracting_name TEXT NOT NULL,
          contact_email TEXT NOT NULL, authority_confirmed INTEGER NOT NULL DEFAULT 0,
          privacy_confirmed INTEGER NOT NULL DEFAULT 0, accepted_at INTEGER NOT NULL,
          accepted_ip TEXT NOT NULL DEFAULT '', user_agent TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
          UNIQUE (verification_id, terms_version, stripe_account_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_youtube_caption_sources (
          channel_id TEXT NOT NULL, video_id TEXT NOT NULL, video_title TEXT NOT NULL,
          transcript TEXT NOT NULL, transcript_sha256 TEXT NOT NULL, language TEXT NOT NULL DEFAULT '',
          auto_generated INTEGER NOT NULL DEFAULT 0, fetched_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
          PRIMARY KEY (channel_id, video_id)
        )
      `).run(),
    ]).then(() => env.REMOTE_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_live_participants_token
      ON live_participants (code, participant_token)
    `).run()).catch((error) => {
      liveD1ReadyPromise = null;
      throw error;
    });
  }
  await liveD1ReadyPromise;
  return true;
}

async function getStoredLiveGame(env, code, options = {}) {
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare('SELECT payload, expires_at FROM live_games WHERE code = ?').bind(code).first();
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) return null;
    const game = JSON.parse(row.payload);
    if (options.baseOnly) return { ...game, participants: [], votes: {} };
    if (options.polling) return loadD1PollingSnapshot(env, code, game, options.participantToken);
    const [participantsResult, votesResult] = await Promise.all([
      env.REMOTE_DB.prepare(`
        SELECT participant_id, participant_token, name, joined_at
        FROM live_participants WHERE code = ? ORDER BY joined_at ASC
      `).bind(code).all(),
      env.REMOTE_DB.prepare(`
        SELECT question_id, participant_id, option_index
        FROM live_votes WHERE code = ?
      `).bind(code).all(),
    ]);
    game.participants = (participantsResult.results || []).map((item) => ({
      id: item.participant_id,
      token: item.participant_token,
      name: item.name,
      joinedAt: Number(item.joined_at),
    }));
    game.votes = {};
    for (const item of votesResult.results || []) {
      game.votes[item.question_id] = {
        ...(game.votes[item.question_id] || {}),
        [item.participant_id]: Number(item.option_index),
      };
    }
    return game;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const game = kv ? await kv.get(`live:${code}`, { type: 'json' }) : null;
  if (options.baseOnly && game) return { ...game, participants: [], votes: {} };
  return options.polling ? createPollingSnapshot(game, options.participantToken) : game;
}

async function loadD1PollingSnapshot(env, code, game, participantToken) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const participantVoteQuery = game.phase === 'complete' && participantToken
    ? env.REMOTE_DB.prepare(`
        SELECT v.question_id, v.option_index, p.participant_id
        FROM live_votes v
        INNER JOIN live_participants p
          ON p.code = v.code AND p.participant_id = v.participant_id
        WHERE v.code = ? AND p.participant_token = ?
      `).bind(code, participantToken).all()
    : Promise.resolve({ results: [] });
  const currentSummaryQuery = game.phase !== 'complete' && question
    ? env.REMOTE_DB.prepare(`
        SELECT v.option_index, COUNT(*) AS vote_count,
          MAX(CASE WHEN p.participant_token = ? THEN v.option_index ELSE NULL END) AS my_vote_index
        FROM live_votes v
        LEFT JOIN live_participants p
          ON p.code = v.code AND p.participant_id = v.participant_id
        WHERE v.code = ? AND v.question_id = ?
        GROUP BY v.option_index
        ORDER BY v.option_index
      `).bind(participantToken || '', code, question.id).all()
    : Promise.resolve({ results: [] });
  const [participantsResult, currentSummaryResult, participantVotesResult] = await Promise.all([
    env.REMOTE_DB.prepare(`
      SELECT participant_id, participant_token, name, joined_at
      FROM live_participants WHERE code = ? ORDER BY joined_at ASC
    `).bind(code).all(),
    currentSummaryQuery,
    participantVoteQuery,
  ]);
  game.participants = (participantsResult.results || []).map((item) => ({
    id: item.participant_id,
    token: item.participant_token,
    name: item.name,
    joinedAt: Number(item.joined_at),
  }));
  game.votes = {};
  if (game.phase === 'complete') {
    for (const item of participantVotesResult.results || []) {
      game.votes[item.question_id] = {
        ...(game.votes[item.question_id] || {}),
        [item.participant_id]: Number(item.option_index),
      };
    }
    game.currentVoteCounts = resultVoteCounts(game, question);
    return game;
  }
  game.currentVoteCounts = question ? question.options.map(() => 0) : [];
  let myVoteIndex = null;
  for (const item of currentSummaryResult.results || []) {
    const optionIndex = Number(item.option_index);
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < game.currentVoteCounts.length) {
      game.currentVoteCounts[optionIndex] = Math.max(0, Number(item.vote_count) || 0);
    }
    if (item.my_vote_index !== null && item.my_vote_index !== undefined) myVoteIndex = Number(item.my_vote_index);
  }
  const participant = participantToken ? game.participants.find((item) => item.token === participantToken) : null;
  if (question && participant && Number.isInteger(myVoteIndex)) {
    game.votes[question.id] = { [participant.id]: myVoteIndex };
  }
  return game;
}

function createPollingSnapshot(game, participantToken) {
  if (!game) return game;
  const question = game.questions[game.currentQuestionIndex] || null;
  const allVotes = game.votes || {};
  const participant = participantToken ? game.participants.find((item) => item.token === participantToken) : null;
  const snapshotVotes = {};
  if (game.phase === 'complete' && participant) {
    for (const [questionId, votes] of Object.entries(allVotes)) {
      if (Object.prototype.hasOwnProperty.call(votes, participant.id)) snapshotVotes[questionId] = { [participant.id]: votes[participant.id] };
    }
  } else if (question && participant && Object.prototype.hasOwnProperty.call(allVotes[question.id] || {}, participant.id)) {
    snapshotVotes[question.id] = { [participant.id]: allVotes[question.id][participant.id] };
  }
  return {
    ...game,
    votes: snapshotVotes,
    currentVoteCounts: game.phase === 'complete'
      ? resultVoteCounts(game, question)
      : question?.options.map((_, optionIndex) => Object.values(allVotes[question.id] || {}).filter((value) => Number(value) === optionIndex).length) || [],
  };
}

function resultVoteCounts(game, question) {
  if (!question) return [];
  const result = (game.results || []).find((item) => item.questionId === question.id);
  return question.options.map((_, optionIndex) => Math.max(0, Number(result?.options?.[optionIndex]?.count) || 0));
}

async function loadLiveParticipant(env, code, participantToken) {
  if (!participantToken) return null;
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT participant_id, participant_token, name, joined_at
      FROM live_participants
      WHERE code = ? AND participant_token = ?
      LIMIT 1
    `).bind(code, participantToken).first();
    return row ? {
      id: row.participant_id,
      token: row.participant_token,
      name: row.name,
      joinedAt: Number(row.joined_at),
    } : null;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const game = kv ? await kv.get(`live:${code}`, { type: 'json' }) : null;
  return game?.participants?.find((item) => item.token === participantToken) || null;
}

async function enrichRealtimeGame(env, code, game, access = {}) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const participantPromise = access.participantToken
    ? loadLiveParticipant(env, code, access.participantToken)
    : Promise.resolve(null);
  const hostParticipantsPromise = access.host && env.REMOTE_DB
    ? env.REMOTE_DB.prepare(`
        SELECT participant_id, participant_token, name, joined_at
        FROM live_participants
        WHERE code = ?
        ORDER BY joined_at ASC
        LIMIT 100
      `).bind(code).all()
    : Promise.resolve({ results: [] });
  const [stats, participant, hostParticipants] = await Promise.all([
    loadLiveRealtimeStats(env, code, question),
    participantPromise,
    hostParticipantsPromise,
  ]);
  game.participantCount = Number(stats?.participantCount) || 0;
  game.participantLimit = liveViewerLimit(env);
  game.realtime = true;
  game.currentVoteCounts = question
    ? (stats?.voteCounts || question.options.map(() => 0))
    : [];
  game.participants = (hostParticipants.results || []).map((item) => ({
    id: item.participant_id,
    token: item.participant_token,
    name: item.name,
    joinedAt: Number(item.joined_at),
  }));
  if (participant && !game.participants.some((item) => item.id === participant.id)) game.participants.push(participant);
  game.votes = {};
  if (participant) {
    const answers = await loadLiveRealtimeParticipantVotes(env, code, participant.token, participant.id);
    for (const [questionId, optionIndex] of Object.entries(answers)) {
      game.votes[questionId] = { [participant.id]: Number(optionIndex) };
    }
  }
  return game;
}

async function broadcastCurrentRealtimeState(env, code, game) {
  if (!hasLiveRealtime(env)) return;
  const question = game.questions[game.currentQuestionIndex] || null;
  const stats = await loadLiveRealtimeStats(env, code, question);
  game.participantCount = Number(stats?.participantCount) || Number(game.participantCount) || 0;
  game.participantLimit = liveViewerLimit(env);
  game.realtime = true;
  game.currentVoteCounts = question
    ? (stats?.voteCounts || game.currentVoteCounts || question.options.map(() => 0))
    : [];
  const publicState = publicLiveGame(game, {});
  publicState.participants = [];
  publicState.realtimeExpiresAt = Number(game.expiresAt) || Date.now() + LIVE_ACTIVE_TTL_SECONDS * 1000;
  await broadcastLiveRealtimeState(env, code, publicState);
}

async function putStoredLiveGame(env, code, game) {
  if (await ensureLiveD1(env)) {
    const { participants, votes, ...storedGame } = game;
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_games (code, payload, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at, expires_at = excluded.expires_at
    `).bind(code, JSON.stringify(storedGame), game.createdAt, game.updatedAt, game.expiresAt).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  if (!kv) throw liveError('live-storage-not-configured', 500);
  const fallbackTtl = game.phase === 'lobby' ? LIVE_SAVED_TTL_SECONDS : LIVE_ACTIVE_TTL_SECONDS;
  const ttlSeconds = Math.max(60, Math.ceil((Number(game.expiresAt) - Date.now()) / 1000) || fallbackTtl);
  await kv.put(`live:${code}`, JSON.stringify(game), { expirationTtl: ttlSeconds });
}

async function cleanupExpiredLiveData(env) {
  const now = Date.now();
  if (!await ensureLiveD1(env)) {
    const kv = env.LIVE_KV || env.REMOTE_KV;
    if (!kv) return;
    const reservations = await getKvLiveReservations(kv);
    await kv.put('live:reservations', JSON.stringify(reservations.filter((item) => Number(item.expiresAt) >= now)));
    return;
  }
  await env.REMOTE_DB.prepare('DELETE FROM live_rate_limits WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_reservations WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_active_sessions WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_youtube_caption_sources WHERE expires_at < ?').bind(now).run();
}

async function isLiveSlotAvailable(env, scheduledAt, excludeCode = '') {
  const blockedFrom = scheduledAt - LIVE_RESERVATION_BUFFER_MS;
  const blockedUntil = scheduledAt + LIVE_RESERVATION_BUFFER_MS;
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare(`
      SELECT code FROM live_reservations
      WHERE scheduled_at > ? AND scheduled_at < ? AND expires_at >= ? AND code <> ?
      LIMIT 1
    `).bind(blockedFrom, blockedUntil, Date.now(), excludeCode).first();
    return !row;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  return !reservations.some((item) => item.code !== excludeCode
    && Math.abs(Number(item.scheduledAt) - scheduledAt) < LIVE_RESERVATION_BUFFER_MS);
}

async function moveLiveReservation(env, code, scheduledAt) {
  const now = Date.now();
  const blockedFrom = scheduledAt - LIVE_RESERVATION_BUFFER_MS;
  const blockedUntil = scheduledAt + LIVE_RESERVATION_BUFFER_MS;
  if (await ensureLiveD1(env)) {
    const moved = await env.REMOTE_DB.prepare(`
      UPDATE live_reservations
      SET scheduled_at = ?, blocked_from = ?, blocked_until = ?, expires_at = ?
      WHERE code = ? AND expires_at >= ? AND NOT EXISTS (
        SELECT 1 FROM live_reservations AS other
        WHERE other.code <> ? AND other.scheduled_at > ? AND other.scheduled_at < ? AND other.expires_at >= ?
      )
    `).bind(scheduledAt, blockedFrom, blockedUntil, blockedUntil, code, now, code, blockedFrom, blockedUntil, now).run();
    if (Number(moved?.meta?.changes || 0) !== 1) throw liveError('live-slot-unavailable', 409);
    return { scheduledAt, blockedFrom, blockedUntil };
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  const currentIndex = reservations.findIndex((item) => item.code === code && Number(item.expiresAt) >= now);
  if (currentIndex < 0) throw liveError('reservation-not-found', 404);
  if (reservations.some((item, index) => index !== currentIndex
    && Math.abs(Number(item.scheduledAt) - scheduledAt) < LIVE_RESERVATION_BUFFER_MS
    && Number(item.expiresAt) >= now)) {
    throw liveError('live-slot-unavailable', 409);
  }
  reservations[currentIndex] = {
    ...reservations[currentIndex], scheduledAt, blockedFrom, blockedUntil, expiresAt: blockedUntil,
  };
  await kv.put('live:reservations', JSON.stringify(reservations));
  return { scheduledAt, blockedFrom, blockedUntil };
}

async function reserveLiveSlot(env, code, scheduledAt, now) {
  const blockedFrom = scheduledAt - LIVE_RESERVATION_BUFFER_MS;
  const blockedUntil = scheduledAt + LIVE_RESERVATION_BUFFER_MS;
  if (await ensureLiveD1(env)) {
    const inserted = await env.REMOTE_DB.prepare(`
      INSERT INTO live_reservations (code, scheduled_at, blocked_from, blocked_until, created_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM live_reservations
        WHERE scheduled_at > ? AND scheduled_at < ? AND expires_at >= ?
      )
    `).bind(code, scheduledAt, blockedFrom, blockedUntil, now, blockedUntil, blockedFrom, blockedUntil, now).run();
    if (Number(inserted?.meta?.changes || 0) !== 1) throw liveError('live-slot-unavailable', 409);
    return { scheduledAt, blockedFrom, blockedUntil };
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  if (reservations.some((item) => Math.abs(Number(item.scheduledAt) - scheduledAt) < LIVE_RESERVATION_BUFFER_MS)) {
    throw liveError('live-slot-unavailable', 409);
  }
  reservations.push({ code, scheduledAt, blockedFrom, blockedUntil, createdAt: now, expiresAt: blockedUntil });
  await kv.put('live:reservations', JSON.stringify(reservations));
  return { scheduledAt, blockedFrom, blockedUntil };
}

async function releaseLiveReservation(env, code) {
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare('DELETE FROM live_reservations WHERE code = ?').bind(code).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const reservations = await getKvLiveReservations(kv);
  await kv.put('live:reservations', JSON.stringify(reservations.filter((item) => item.code !== code)));
}

async function acquireLiveActiveSlot(env, code, game) {
  const now = Date.now();
  const expiresAt = Math.min(
    Number(game.reservationEndsAt) || now + LIVE_ACTIVE_TTL_SECONDS * 1000,
    now + LIVE_ACTIVE_TTL_SECONDS * 1000,
  );
  if (await ensureLiveD1(env)) {
    const locked = await env.REMOTE_DB.prepare(`
      INSERT INTO live_active_sessions (lock_key, code, started_at, expires_at)
      VALUES ('global', ?, ?, ?)
      ON CONFLICT(lock_key) DO UPDATE SET
        code = excluded.code,
        started_at = excluded.started_at,
        expires_at = excluded.expires_at
      WHERE live_active_sessions.expires_at < excluded.started_at
         OR live_active_sessions.code = excluded.code
    `).bind(code, now, expiresAt).run();
    if (Number(locked?.meta?.changes || 0) !== 1) throw liveError('another-live-active', 409);
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const active = await kv.get('live:active', { type: 'json' });
  if (active && active.code !== code && Number(active.expiresAt) >= now) throw liveError('another-live-active', 409);
  await kv.put('live:active', JSON.stringify({ code, startedAt: now, expiresAt }), {
    expirationTtl: Math.max(60, Math.ceil((expiresAt - now) / 1000)),
  });
}

async function releaseLiveActiveSlot(env, code) {
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare('DELETE FROM live_active_sessions WHERE lock_key = ? AND code = ?').bind('global', code).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  const active = await kv.get('live:active', { type: 'json' });
  if (active?.code === code) await kv.delete('live:active');
}

async function getKvLiveReservations(kv) {
  if (!kv) return [];
  const value = await kv.get('live:reservations', { type: 'json' });
  return Array.isArray(value) ? value : [];
}

async function enforceLiveRateLimit(request, env, scope, limit) {
  if (!env.REMOTE_DB) return;
  if (!liveRateLimitReadyPromise) {
    liveRateLimitReadyPromise = env.REMOTE_DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_rate_limits (
        rate_key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run().catch((error) => {
      liveRateLimitReadyPromise = null;
      throw error;
    });
  }
  await liveRateLimitReadyPromise;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `live:${scope}:${ipHash}`;
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      window_start = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.window_start ELSE excluded.window_start END,
      request_count = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.request_count + 1 ELSE 1 END,
      expires_at = excluded.expires_at
  `).bind(key, windowStart, windowStart + windowMs * 2).run();
  const row = await env.REMOTE_DB.prepare('SELECT request_count FROM live_rate_limits WHERE rate_key = ?').bind(key).first();
  if (Number(row && row.request_count || 0) > limit) throw liveError('rate-limit-exceeded', 429);
}

async function requireLiveHost(request, env, game) {
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  if (!hostToken || hostToken !== game.hostToken) throw liveError('host-forbidden', 403);
  if (game.creatorInviteId) {
    await requireLiveCreatorInvite(request, env, game.channelId, game.creatorInviteId);
  }
  return hostToken;
}

async function isLiveHostAuthorized(request, env, game) {
  try {
    await requireLiveHost(request, env, game);
    return true;
  } catch (error) {
    return false;
  }
}

function validateLiveScheduledAt(value) {
  const scheduledAt = Number(value);
  const now = Date.now();
  if (!Number.isFinite(scheduledAt) || scheduledAt <= now) throw liveError('invalid-scheduled-at', 400);
  if (scheduledAt > now + LIVE_RESERVATION_MAX_DAYS * 24 * 60 * 60 * 1000) {
    throw liveError('scheduled-at-too-far', 400);
  }
  return scheduledAt;
}

async function hashLiveSecret(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePurchaseAccessToken(env, orderId) {
  const secret = String(env.LIVE_PURCHASE_ACCESS_SECRET || env.LIVE_DOWNLOAD_SIGNING_SECRET || '');
  if (secret.length < 32) throw liveError('purchase-access-signing-not-configured', 503);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`live-purchase.${orderId}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPurchaseEmail(env, value) {
  const secret = String(env.LIVE_PURCHASE_ACCESS_SECRET || env.LIVE_DOWNLOAD_SIGNING_SECRET || '');
  if (secret.length < 32) throw liveError('purchase-access-signing-not-configured', 503);
  const email = normalizePurchaseEmail(value);
  if (!email) throw liveError('invalid-purchase-email', 400);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`live-purchase-email.${email}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizePurchaseEmail(value) {
  const email = String(value || '').normalize('NFKC').trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function touchLiveGame(game) {
  game.updatedAt = Date.now();
  const ttlSeconds = game.phase === 'lobby' ? LIVE_SAVED_TTL_SECONDS : LIVE_ACTIVE_TTL_SECONDS;
  game.expiresAt = Math.min(
    game.updatedAt + ttlSeconds * 1000,
    Number(game.reservationEndsAt) || Number.POSITIVE_INFINITY,
  );
}

function createLiveCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join('');
}

function createLiveToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeToken(value) {
  const token = String(value || '').trim();
  return /^[a-f0-9]{20,96}$/i.test(token) ? token : '';
}

async function readLiveJson(request) {
  try { return await request.json(); } catch (error) { return {}; }
}

function liveError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function liveJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' },
  });
}
