const CREATOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const CREATOR_IMAGE_MAX_DIMENSION = 12_000;
const CREATOR_IMAGE_MAX_PIXELS = 100_000_000;
const CREATOR_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PRIVATE_MEDIA_SCHEMA = 'live-private-media-v1';

export async function storePrivateCreatorImage(source, env, code, previous = null) {
  requireMediaBindings(env);
  const file = typeof source?.arrayBuffer === 'function'
    ? source
    : (await source.formData().catch(() => null))?.get('image');
  if (!file || typeof file.arrayBuffer !== 'function') throw mediaError('creator-image-required', 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > CREATOR_IMAGE_MAX_BYTES) throw mediaError('creator-image-too-large', 413);
  const contentType = detectImageType(bytes);
  const declaredType = String(file.type || '').toLowerCase();
  if (!CREATOR_IMAGE_TYPES.has(contentType) || (declaredType && declaredType !== contentType)) {
    throw mediaError('invalid-creator-image', 400);
  }
  const info = await env.IMAGES.info(bytesToStream(bytes)).catch(() => null);
  if (!info?.width || !info?.height) throw mediaError('invalid-creator-image', 400);
  if (Number(info.width) > CREATOR_IMAGE_MAX_DIMENSION || Number(info.height) > CREATOR_IMAGE_MAX_DIMENSION
    || Number(info.width) * Number(info.height) > CREATOR_IMAGE_MAX_PIXELS) {
    throw mediaError('creator-image-dimensions-too-large', 413);
  }
  const assetId = randomHex(16);
  const prefix = `live/${code}/creator/${assetId}`;
  const originalKey = `${prefix}/original`;
  const previewKey = `${prefix}/preview.webp`;
  const paidKey = `${prefix}/paid.webp`;
  let previewBytes;
  let paidBytes;
  try {
    [previewBytes, paidBytes] = await Promise.all([
      transformImage(env, bytes, 384, 384, 76),
      transformImage(env, bytes, 1200, 1200, 88),
    ]);
  } catch (error) {
    throw mediaError('creator-image-transform-failed', 502);
  }
  try {
    await Promise.all([
      putPrivateObject(env.LIVE_MEDIA, originalKey, bytes, contentType, {
        assetType: 'creator-original', gameCode: code,
      }),
      putPrivateObject(env.LIVE_MEDIA, previewKey, previewBytes, 'image/webp', {
        assetType: 'creator-preview', gameCode: code,
      }),
      putPrivateObject(env.LIVE_MEDIA, paidKey, paidBytes, 'image/webp', {
        assetType: 'creator-paid', gameCode: code,
      }),
    ]);
  } catch (error) {
    await env.LIVE_MEDIA.delete([originalKey, previewKey, paidKey]).catch(() => {});
    throw mediaError('creator-image-storage-failed', 502);
  }
  await deleteCreatorImage(env, previous);
  return { assetId, originalKey, previewKey, paidKey, uploadedAt: Date.now(), moderationStatus: 'pending' };
}

export async function deleteCreatorImage(env, image) {
  if (!env.LIVE_MEDIA || !image) return;
  const keys = [image.originalKey, image.previewKey, image.paidKey].filter(isCreatorImageKey);
  if (keys.length) await env.LIVE_MEDIA.delete(keys).catch(() => {});
}

export async function createFreeResultPreview(request, env, game, participantGame) {
  const viewerName = new URL(request.url).searchParams.get('name') || participantGame.participantName || '視聴者';
  const portrait = await loadPortrait(request, env, game, false);
  const svg = buildResultSvg({
    width: 540,
    height: 675,
    channelName: game.channelName || game.subjectName,
    viewerName,
    scheduledAt: game.scheduledAt,
    correctCount: correctCount(participantGame.results),
    questionCount: participantGame.questionCount || participantGame.results?.length || 0,
    portrait,
    sample: true,
  });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'private, no-store',
      'content-security-policy': "default-src 'none'; img-src data:",
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function createPaidResultAsset(request, env, game, participantGame, purchaseId, viewerName) {
  requireMediaBindings(env);
  const portrait = await loadPortrait(request, env, game, true);
  const svg = buildResultSvg({
    width: 2160,
    height: 2700,
    channelName: game.channelName || game.subjectName,
    viewerName: viewerName || participantGame.participantName || '視聴者',
    scheduledAt: game.scheduledAt,
    correctCount: correctCount(participantGame.results),
    questionCount: participantGame.questionCount || participantGame.results?.length || 0,
    portrait,
    sample: false,
  });
  const normalizedPurchaseId = String(purchaseId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(normalizedPurchaseId)) throw mediaError('invalid-purchase-id', 400);
  const assetKey = `live/results/${normalizedPurchaseId}.svg`;
  try {
    await putPrivateObject(env.LIVE_MEDIA, assetKey, svg, 'image/svg+xml; charset=utf-8', {
      assetType: 'paid-result', purchaseId: normalizedPurchaseId,
    });
  } catch (error) {
    throw mediaError('result-image-storage-failed', 502);
  }
  return assetKey;
}

export async function createSignedDownloadUrl(request, env, purchaseId, expiresAt) {
  const secret = String(env.LIVE_DOWNLOAD_SIGNING_SECRET || '');
  if (secret.length < 32) throw mediaError('download-signing-not-configured', 503);
  const expires = Math.min(Number(expiresAt) || 0, Date.now() + 10 * 60 * 1000);
  if (expires <= Date.now()) throw mediaError('download-expired', 410);
  const payload = `${purchaseId}.${expires}`;
  const signature = await sign(payload, secret);
  const url = new URL(`/api/live/downloads/${encodeURIComponent(purchaseId)}`, request.url);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  return url.toString();
}

export async function verifySignedDownload(env, purchaseId, expires, signature) {
  const secret = String(env.LIVE_DOWNLOAD_SIGNING_SECRET || '');
  const timestamp = Number(expires);
  if (secret.length < 32 || !Number.isFinite(timestamp) || timestamp <= Date.now()) return false;
  const expected = await sign(`${purchaseId}.${timestamp}`, secret);
  return timingSafeEqual(expected, String(signature || ''));
}

export async function streamPrivateResult(env, assetKey, filename) {
  if (!env.LIVE_MEDIA) throw mediaError('live-media-not-configured', 503);
  if (!isPrivateResultKey(assetKey)) throw mediaError('invalid-private-media-key', 500);
  const object = await env.LIVE_MEDIA.get(assetKey);
  if (!object) throw mediaError('result-image-not-found', 404);
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set('content-type', headers.get('content-type') || 'image/svg+xml; charset=utf-8');
  headers.set('content-disposition', `attachment; filename="${String(filename || 'live-result.svg').replace(/[^A-Za-z0-9_.-]/g, '_')}"`);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

async function loadPortrait(request, env, game, paid) {
  const imageApproved = game.creatorImage
    && (!game.creatorImage.moderationStatus || game.creatorImage.moderationStatus === 'approved');
  const key = imageApproved ? (paid ? game.creatorImage?.paidKey : game.creatorImage?.previewKey) : '';
  if (key) {
    if (!env.LIVE_MEDIA) throw mediaError('live-media-not-configured', 503);
    if (!isCreatorImageKey(key)) throw mediaError('invalid-private-media-key', 500);
    const object = await env.LIVE_MEDIA.get(key);
    if (object) return toEmbeddedImage(await object.arrayBuffer(), 'image/webp');
  }
  const assetUrl = new URL('/assets/character/girl-default.webp', request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl));
  if (!response.ok) throw mediaError('default-image-not-found', 500);
  return toEmbeddedImage(await response.arrayBuffer(), response.headers.get('content-type') || 'image/webp');
}

function buildResultSvg(input) {
  const scale = input.width / 540;
  const s = (value) => Math.round(value * scale * 100) / 100;
  const date = formatDate(input.scheduledAt);
  const channelName = fitText(input.channelName || 'YouTubeチャンネル', 36);
  const viewerName = fitText(input.viewerName || '視聴者', 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-label="LIVE結果画像">
  <rect width="100%" height="100%" fill="#EC4F88"/>
  <rect x="${s(28)}" y="${s(28)}" width="${s(484)}" height="${s(619)}" rx="${s(22)}" fill="#1A1A1A"/>
  <rect x="${s(38)}" y="${s(38)}" width="${s(464)}" height="${s(599)}" rx="${s(18)}" fill="#FFF8F1"/>
  <path d="M${s(38)} ${s(56)}a${s(18)} ${s(18)} 0 0 1 ${s(18)} -${s(18)}h${s(428)}a${s(18)} ${s(18)} 0 0 1 ${s(18)} ${s(18)}v${s(70)}H${s(38)}z" fill="#1A1A1A"/>
  <text x="${s(58)}" y="${s(76)}" fill="#fff" font-size="${s(16)}" font-weight="900" font-family="sans-serif">${escapeXml(channelName)}</text>
  <text x="${s(58)}" y="${s(104)}" fill="#5BD4E8" font-size="${s(12)}" font-weight="900" font-family="monospace">LIVE RESULT</text>
  <defs><clipPath id="portrait"><circle cx="${s(270)}" cy="${s(235)}" r="${s(92)}"/></clipPath></defs>
  <image href="${input.portrait}" x="${s(178)}" y="${s(143)}" width="${s(184)}" height="${s(184)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait)"/>
  <circle cx="${s(270)}" cy="${s(235)}" r="${s(95)}" fill="none" stroke="#1A1A1A" stroke-width="${s(6)}"/>
  <text x="${s(270)}" y="${s(365)}" text-anchor="middle" fill="#1A1A1A" font-size="${s(20)}" font-weight="900" font-family="sans-serif">${escapeXml(viewerName)} さんの結果</text>
  <text x="${s(270)}" y="${s(443)}" text-anchor="middle" fill="#EC4F88" font-size="${s(66)}" font-weight="900" font-family="sans-serif">${input.correctCount}/${input.questionCount}</text>
  <text x="${s(270)}" y="${s(472)}" text-anchor="middle" fill="#1A1A1A" font-size="${s(15)}" font-weight="900" font-family="sans-serif">問正解</text>
  <rect x="${s(74)}" y="${s(497)}" width="${s(392)}" height="${s(70)}" rx="${s(14)}" fill="#FFE26B"/>
  <text x="${s(270)}" y="${s(526)}" text-anchor="middle" fill="#1A1A1A" font-size="${s(16)}" font-weight="900" font-family="sans-serif">${escapeXml(date)}</text>
  <text x="${s(270)}" y="${s(550)}" text-anchor="middle" fill="#1A1A1A" font-size="${s(12)}" font-weight="800" font-family="sans-serif">視聴者参加型LIVE 記念結果</text>
  ${input.sample ? `<text x="${s(270)}" y="${s(602)}" text-anchor="middle" fill="#D63A75" opacity="0.22" font-size="${s(42)}" font-weight="900" font-family="sans-serif" transform="rotate(-5 ${s(270)} ${s(594)})">SAMPLE</text>` : ''}
  <text x="${s(270)}" y="${s(622)}" text-anchor="middle" fill="#1A1A1A" font-size="${s(10)}" font-weight="700" font-family="monospace">streetboardgame.com</text>
</svg>`;
}

async function transformImage(env, bytes, width, height, quality) {
  const output = await env.IMAGES.input(bytesToStream(bytes))
    .transform({ width, height, fit: 'cover', gravity: 'center' })
    .output({ format: 'image/webp', quality, anim: false });
  const response = output?.response?.();
  if (!response?.ok) throw mediaError('creator-image-transform-failed', 502);
  const transformed = new Uint8Array(await response.arrayBuffer());
  if (!transformed.byteLength) throw mediaError('creator-image-transform-failed', 502);
  return transformed;
}

function requireMediaBindings(env) {
  if (!env.LIVE_MEDIA || !env.IMAGES) throw mediaError('live-media-not-configured', 503);
}

function bytesToStream(bytes) {
  return new Blob([bytes]).stream();
}

async function putPrivateObject(bucket, key, value, contentType, metadata) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      schema: PRIVATE_MEDIA_SCHEMA,
      ...Object.fromEntries(Object.entries(metadata || {}).map(([name, item]) => [name, String(item)])),
      sha256: hex(new Uint8Array(digest)),
    },
    sha256: digest,
  });
}

function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function isCreatorImageKey(value) {
  return /^live\/[0-9]{6}\/creator\/[a-f0-9]{32}\/(?:original|preview\.webp|paid\.webp)$/.test(String(value || ''));
}

function isPrivateResultKey(value) {
  return /^live\/results\/[A-Za-z0-9_-]{8,80}\.svg$/.test(String(value || ''));
}

function toEmbeddedImage(buffer, contentType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function correctCount(results) {
  return (results || []).filter((result) => (
    result.type === 'guess-person' ? result.myIsCorrect === true : result.myVoteWasPopular === true
  )).length;
}

function formatDate(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '日時未設定';
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function fitText(value, max) {
  return [...String(value || '').replace(/\s+/g, ' ').trim()].slice(0, max).join('');
}

function escapeXml(value) {
  return String(value || '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mediaError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
