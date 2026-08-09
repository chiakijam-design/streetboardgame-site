import { handleLiveApi } from './src/live/api.js';
import { handleChallengeApi } from './src/challenge/api.js';
import { handleQuestionApi } from './src/questions/api.js';
import { runPrivacyCleanup } from './src/privacy/cleanup.js';
import { runSocialPublishing } from './src/social/publisher.js';
export { LiveRoomCoordinator, LiveVoteShard } from './src/live/realtime.js';

// Cloudflare Workers 静的サイト + ルーティング
// https://developers.cloudflare.com/pages/functions/advanced-mode/
//
// 現行の通常版・LIVE版、共通ページ、法務ページと静的アセットだけを配信する。
// 廃止したゲームURLとAPIは互換転送せず404を返す。

const CANONICAL_ORIGIN = 'https://www.streetboardgame.com';
const HASHED_BUILD_ASSET_PATH = /^\/(?:dist\/(?:[a-z0-9_]+-[a-z0-9]{8}\.js|[a-z0-9-]+-[a-f0-9]{12}\.css)|assets\/vendor\/react(?:-dom)?\.production\.min-[a-f0-9]{12}\.js)$/i;
const VERSIONED_STATIC_ASSET_PATH = /\.(?:css|js|png|jpe?g|svg|webp|woff2)$/i;
const RETIRED_GAME_PATHS = new Set([
  '/love',
  '/friends',
  '/family',
  '/boardgame',
  '/remote',
  '/remote-boardgame',
  '/live',
  '/live-guide',
]);
const CHALLENGE_PAGE_PATHS = new Set([
  '/challenge',
  '/challenge/manage',
  '/challenge/ranking',
  '/challenge/library',
]);
const LIVE_CHALLENGE_PATH = '/live-challenge';
const ENGLISH_CHALLENGE_PAGE_PATHS = new Set([
  '/en/challenge',
  '/en/challenge/manage',
  '/en/challenge/ranking',
  '/en/challenge/library',
]);
const LEGAL_PAGE_FILES = Object.freeze({
  '/terms': '/terms.html',
  '/privacy': '/privacy.html',
  '/legal': '/legal.html',
  '/creator-terms': '/creator-terms.html',
  '/refund-policy': '/refund-policy.html',
  '/content-guidelines': '/content-guidelines.html',
  '/minor-policy': '/minor-policy.html',
});

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await handleRequest(request, env), request);
  },
  async scheduled(controller, env, context) {
    const scheduledAt = Number(controller?.scheduledTime) || Date.now();
    context.waitUntil(Promise.all([
      runPrivacyCleanup(env, scheduledAt),
      runSocialPublishing(env, scheduledAt),
    ]));
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'streetboardgame.com') {
      url.hostname = 'www.streetboardgame.com';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const rawPath = decodeURIComponent(url.pathname);
    const path = rawPath.replace(/\/+$/, '');

    // Cloudflare Access only protects the custom domain. Do not expose the
    // management surface through the Worker preview hostname, which would
    // otherwise bypass the Access policy applied to www.streetboardgame.com.
    const isWorkersDevHost = url.hostname.endsWith('.workers.dev');
    const isAdminSurface = /^\/(?:live-ops|question-ops)(?:\/|$)/.test(path)
      || /^\/api\/(?:live|questions)\/admin(?:\/|$)/.test(path);
    if (isWorkersDevHost && isAdminSurface) {
      return new Response(request.method === 'HEAD' ? null : 'Not Found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=UTF-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    const cleanHtmlPaths = {
      '/index.html': '/',
      '/en/index.html': '/en/',
      '/en/terms.html': '/en/terms',
      '/en/privacy.html': '/en/privacy',
      '/challenge.html': '/challenge',
      '/live_challenge.html': LIVE_CHALLENGE_PATH,
      '/live_ops.html': '/live-ops',
      '/question_ops.html': '/question-ops',
    };
    if (cleanHtmlPaths[rawPath]) {
      return Response.redirect(url.origin + cleanHtmlPaths[rawPath] + url.search, 301);
    }

    if (path.startsWith('/api/live')) {
      return handleLiveApi(request, env, path);
    }

    if (path.startsWith('/api/remote')) {
      return new Response(JSON.stringify({ error: 'not-found' }), {
        status: 404,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    if (path.startsWith('/api/challenge')) {
      return handleChallengeApi(request, env, path);
    }

    if (path.startsWith('/api/questions')) {
      return handleQuestionApi(request, env, path);
    }

    if (path === '/api/social/x/callback') {
      return new Response(JSON.stringify({
        ok: true,
        message: 'X OAuth callback is configured. Automated posting uses the approved account token.',
      }), {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    if (path === '/en') {
      const pageUrl = new URL('/en/index.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(pageUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      return new Response(request.method === 'HEAD' ? null : await response.text(), {
        status: response.status,
        headers,
      });
    }

    if (rawPath !== '/en/' && rawPath.endsWith('/') && (
      path === '/en/live-challenge'
      || ENGLISH_CHALLENGE_PAGE_PATHS.has(path)
      || path === '/en/terms'
      || path === '/en/privacy'
    )) {
      return Response.redirect(url.origin + path + url.search, 301);
    }

    if (path === '/en/live-challenge') {
      const pageUrl = new URL('/live_challenge.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(pageUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      if (url.searchParams.has('room')) headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      const html = request.method === 'HEAD' ? null : await response.text();
      return new Response(html ? applyEnglishGameMeta(html, 'live', url) : null, {
        status: response.status,
        headers,
      });
    }

    if (ENGLISH_CHALLENGE_PAGE_PATHS.has(path)) {
      const pageUrl = new URL('/challenge.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(pageUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      if (url.searchParams.has('room') || path.endsWith('/manage') || path.endsWith('/ranking')) {
        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      }
      const html = request.method === 'HEAD' ? null : await response.text();
      return new Response(html ? applyEnglishGameMeta(html, 'challenge', url) : null, {
        status: response.status,
        headers,
      });
    }

    if (path === '/en/terms' || path === '/en/privacy') {
      const pageUrl = new URL(path === '/en/terms' ? '/en/terms.html' : '/en/privacy.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(pageUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      return new Response(request.method === 'HEAD' ? null : await response.text(), {
        status: response.status,
        headers,
      });
    }

    if (rawPath !== '/' && rawPath.endsWith('/') && path === LIVE_CHALLENGE_PATH) {
      return Response.redirect(url.origin + path + url.search, 301);
    }

    if (path === LIVE_CHALLENGE_PATH) {
      const pageUrl = new URL('/live_challenge.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(pageUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      if (url.searchParams.has('room')) headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      const html = request.method === 'HEAD' ? null : await response.text();
      return new Response(html ? selectQuestionDataScript(html, 'ja') : null, {
        status: response.status,
        headers,
      });
    }

    if (rawPath !== '/' && rawPath.endsWith('/') && CHALLENGE_PAGE_PATHS.has(path)) {
      return Response.redirect(url.origin + path + url.search, 301);
    }

    if (CHALLENGE_PAGE_PATHS.has(path)) {
      const challengeUrl = new URL('/challenge.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(challengeUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      if (url.searchParams.has('room') || path === '/challenge/manage' || path === '/challenge/ranking') {
        headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      }
      const html = request.method === 'HEAD' ? null : await response.text();
      const localizedBody = html && path === '/challenge/library'
        ? applyChallengeLibraryMeta(html)
        : html && path === '/challenge'
          ? applyChallengeShareMeta(html, url)
          : html;
      const body = localizedBody ? selectQuestionDataScript(localizedBody, 'ja') : localizedBody;
      return new Response(body, {
        status: response.status,
        headers,
      });
    }

    if (RETIRED_GAME_PATHS.has(path)) {
      return new Response(request.method === 'HEAD' ? null : 'Not Found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=UTF-8',
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        },
      });
    }

    if (rawPath !== '/' && rawPath.endsWith('/') && path === '/live-ops') {
      return Response.redirect(url.origin + path, 301);
    }

    if (path === '/live-ops') {
      const opsUrl = new URL('/live_ops.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(opsUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      headers.set('cache-control', 'no-store');
      headers.set('referrer-policy', 'no-referrer');
      return new Response(request.method === 'HEAD' ? null : await response.text(), { status: response.status, headers });
    }

    if (rawPath !== '/' && rawPath.endsWith('/') && path === '/question-ops') {
      return Response.redirect(url.origin + path, 301);
    }

    if (path === '/question-ops') {
      const opsUrl = new URL('/question_ops.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(opsUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
      headers.set('cache-control', 'no-store');
      headers.set('referrer-policy', 'no-referrer');
      return new Response(request.method === 'HEAD' ? null : await response.text(), { status: response.status, headers });
    }

    const cleanLegalPath = Object.entries(LEGAL_PAGE_FILES)
      .find(([, file]) => rawPath === file)?.[0];
    if (cleanLegalPath) {
      return Response.redirect(url.origin + cleanLegalPath, 301);
    }

    if (rawPath !== '/' && rawPath.endsWith('/') && LEGAL_PAGE_FILES[path]) {
      return Response.redirect(url.origin + path, 301);
    }

    if (LEGAL_PAGE_FILES[path]) {
      const legalUrl = new URL(LEGAL_PAGE_FILES[path], url.origin);
      const response = await env.ASSETS.fetch(new Request(legalUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      return new Response(request.method === 'HEAD' ? null : await response.text(), {
        status: response.status,
        headers,
      });
    }

    const pageMap = {
      '/challenge-guide': {
        title: 'みんなに挑戦してもらう｜10問クイズの遊び方・作り方',
        description: '自分が先に答えた10問をみんなに予想してもらう無料クイズ。専用URLを送るだけで最大50人が挑戦でき、答え合わせと任意の理解度ボードを楽しめます。',
        url: CANONICAL_ORIGIN + '/challenge-guide',
        ogTitle: 'みんなに挑戦してもらう｜わたし理解度診断',
        ogImage: CANONICAL_ORIGIN + '/assets/ogp-challenge-v3.png?v=20260726-ogp-2',
        imageWidth: 1200,
        imageHeight: 630,
        imageAlt: 'わたし理解度診断｜私のこと、ちゃんと分かってるよね？｜当てるより、話すための10問。',
        pageId: CANONICAL_ORIGIN + '/challenge-guide#webpage',
        noscriptTitle: 'みんなに挑戦してもらう｜10問クイズの遊び方',
        noscriptBody: '自分が先に10問へ回答し、発行された専用URLを参加者へ送ると、最大50人があなたの答えを予想できます。',
        faq: [
          {
            question: 'どうやってクイズを作りますか？',
            answer: '出題者名を入力して10問へ回答すると、挑戦者へ送る専用URLが発行されます。',
          },
          {
            question: '何人まで挑戦できますか？',
            answer: '1つのクイズに最大50人まで挑戦できます。',
          },
          {
            question: '無料で遊べますか？',
            answer: '無料で遊べます。クイズ作成、専用URLの共有、答え合わせ、答え合わせレポート、任意の理解度ボードまで利用できます。',
          },
        ],
      },
      '/about': {
        title: 'About｜わたし理解度診断・私のこと、ちゃんと分かってるよね？',
        description: '「わたし理解度診断」は、自分の10問を最大50人に予想してもらう通常版と、視聴者と同時回答するLIVE版を公開する無料ゲームサイトです。',
        url: CANONICAL_ORIGIN + '/about',
        ogTitle: 'About｜わたし理解度診断',
        imageAlt: 'わたし理解度診断「私のこと、ちゃんと分かってるよね？」',
        pageId: CANONICAL_ORIGIN + '/about#webpage',
        noscriptTitle: 'About｜わたし理解度診断',
        noscriptBody: '「わたし理解度診断」は、10問を作って参加URLを送る通常版と、視聴者と同時回答するLIVE版を公開しています。',
      },
      '/product': {
        title: '製品版｜私のこと、ちゃんと分かってるよね？',
        description: 'Amazonで販売中のカードゲーム版「私のこと、ちゃんと分かってるよね？」を紹介するページです。54問入りで、集まりや旅行、おうち時間でも遊べます。',
        url: CANONICAL_ORIGIN + '/product',
        ogTitle: '製品版｜私のこと、ちゃんと分かってるよね？',
        imageAlt: 'ボードゲーム版 私のこと、ちゃんと分かってるよね？',
        pageId: CANONICAL_ORIGIN + '/product#webpage',
        preloadImage: '/assets/character/girl-full-960.webp',
        noscriptTitle: '製品版｜私のこと、ちゃんと分かってるよね？',
        noscriptBody: 'Amazonで販売中のカードゲーム版「私のこと、ちゃんと分かってるよね？」を紹介するページです。54問入りで、集まりや旅行、おうち時間でも遊べます。',
      },
    };

    if (rawPath !== '/' && rawPath.endsWith('/') && pageMap[path]) {
      return Response.redirect(url.origin + path, 301);
    }

    if (pageMap[path]) {
      const indexUrl = new URL('/index.html', url.origin);
      const indexRequest = new Request(indexUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      });
      const response = await env.ASSETS.fetch(indexRequest);
      const html = await response.text();
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      return new Response(applySeoMeta(html, pageMap[path]), {
        status: 200,
        headers,
      });
    }

    // 旧Wix URL → 正規URLへ恒久リダイレクト
    const redirectMap = {
      '/watachan': '/',
      '/contact': '/?screen=about&to=contact',
    };

    if (redirectMap[path]) {
      const target = new URL(redirectMap[path], url.origin);
      if (path === '/contact' && ['live-creator-registration', 'commerce-disclosure', 'refund-request'].includes(url.searchParams.get('topic'))) {
        target.searchParams.set('topic', url.searchParams.get('topic'));
      }
      return Response.redirect(target.toString(), 301);
    }

    // 静的アセットをそのまま返す (env.ASSETS は wrangler.jsonc の assets binding)
    const response = await env.ASSETS.fetch(request);

    // 存在しないURLは、検索エンジンにも正しく伝わる404ページを返す
    if (response.status === 404) {
      const notFoundUrl = new URL('/404.html', url.origin);
      const notFoundResponse = await env.ASSETS.fetch(new Request(notFoundUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(notFoundResponse.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('cache-control', 'no-cache, must-revalidate');
      headers.set('x-robots-tag', 'noindex, follow');
      const body = request.method === 'HEAD' ? null : await notFoundResponse.arrayBuffer();
      return new Response(body, { status: 404, headers });
    }

    if (response.ok && (HASHED_BUILD_ASSET_PATH.test(url.pathname) || isVersionedStaticAsset(url))) {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
}

async function withSecurityHeaders(response, request) {
  if (response.status === 101 || response.webSocket) return response;
  const headers = new Headers(response.headers);
  const isHtml = /text\/html/i.test(headers.get('content-type') || '');
  if (isHtml) headers.set('content-type', 'text/html; charset=UTF-8');
  const nonce = isHtml ? createCspNonce() : '';
  const requestPath = request ? new URL(request.url).pathname : '';
  const sensitivePath = /^\/(?:en\/(?:challenge|live-challenge)(?:\/|$)|challenge(?:\/|$)|live(?:-ops)?|question-ops|api(?:\/|$))/.test(requestPath);
  headers.set('content-security-policy', [
    "default-src 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ''} https://www.googletagmanager.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' blob: https://www.google-analytics.com https://region1.google-analytics.com https://formspree.io",
    "form-action 'self' https://formspree.io",
    "frame-src 'none'",
    "media-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "report-uri /api/live/security/csp-report",
  ].join('; '));
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  headers.set('x-frame-options', 'DENY');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-permitted-cross-domain-policies', 'none');
  headers.set('origin-agent-cluster', '?1');
  headers.set('referrer-policy', sensitivePath ? 'no-referrer' : 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'accelerometer=(), autoplay=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), serial=(), usb=(), xr-spatial-tracking=()');
  if (isHtml) {
    headers.set('cross-origin-opener-policy', 'same-origin');
    headers.set('cross-origin-resource-policy', 'same-origin');
  }
  let body = response.body;
  if (isHtml && response.body) {
    body = (await response.text()).replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
    headers.delete('content-length');
    headers.delete('content-encoding');
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

function createCspNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function applySeoMeta(html, page) {
  const ogImage = page.ogImage || 'https://www.streetboardgame.com/assets/ogp-challenge-v3.png?v=20260726';
  const imageWidth = Number(page.imageWidth || 1200);
  const imageHeight = Number(page.imageHeight || 630);
  const ogUrl = page.ogUrl || page.url;
  const preloadImage = page.preloadImage || '/assets/character/girl-default.webp';
  const preloadTag = preloadImage.includes('girl-full')
    ? '<link rel="preload" as="image" href="/assets/character/girl-full-960.webp" imagesrcset="/assets/character/girl-full-480.webp 326w, /assets/character/girl-full-960.webp 653w, /assets/character/girl-full.webp 2088w" imagesizes="156px" type="image/webp" fetchpriority="high" />'
    : `<link rel="preload" as="image" href="${preloadImage}" type="image/webp" fetchpriority="high" />`;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${page.url}" />`)
    .replace(/<link rel="alternate" hreflang="ja" href="[^"]*" \/>/, `<link rel="alternate" hreflang="ja" href="${page.url}" />`)
    .replace(
      /\s*<link rel="alternate" hreflang="en" href="[^"]*" \/>/,
      page.enUrl ? `\n<link rel="alternate" hreflang="en" href="${page.enUrl}" />` : '',
    )
    .replace(/<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, `<link rel="alternate" hreflang="x-default" href="${page.url}" />`)
    .replace(/<link rel="preload" as="image"[^>]*\/>/, preloadTag)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.ogTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${ogUrl}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${page.imageAlt || page.ogTitle}" />`)
    .replace(/<meta property="og:image:width" content="[^"]*" \/>/, `<meta property="og:image:width" content="${imageWidth}" />`)
    .replace(/<meta property="og:image:height" content="[^"]*" \/>/, `<meta property="og:image:height" content="${imageHeight}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${page.ogTitle}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${page.description}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${page.imageAlt || page.ogTitle}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(buildStructuredData(page))}</script>`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, buildNoscript(page));
}

function applyChallengeLibraryMeta(html) {
  const title = '人気の10問パック｜わたし理解度診断｜私のこと、ちゃんと分かってるよね？';
  const description = '意外な一面、初対面、推し・SNS、深く知る、LIVE、夏休み、推し活から選べる画像付き10問パックです。通常版・LIVE版のクイズをすぐ作れます。';
  const url = CANONICAL_ORIGIN + '/challenge/library';
  const breadcrumbId = url + '#breadcrumb';
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<link rel="alternate" hreflang="ja" href="[^"]*">/, `<link rel="alternate" hreflang="ja" href="${url}">`)
    .replace(/\s*<link rel="alternate" hreflang="en" href="[^"]*">/, '')
    .replace(/<link rel="alternate" hreflang="x-default" href="[^"]*">/, `<link rel="alternate" hreflang="x-default" href="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            '@id': url + '#webpage',
            name: '人気の10問パック',
            url,
            description,
            inLanguage: 'ja',
            isPartOf: { '@type': 'WebSite', url: CANONICAL_ORIGIN + '/' },
            primaryImageOfPage: {
              '@type': 'ImageObject',
              url: CANONICAL_ORIGIN + '/assets/ogp-challenge-v3.png?v=20260726-ogp-2',
              width: 1200,
              height: 630,
            },
            breadcrumb: { '@id': breadcrumbId },
          },
          {
            '@type': 'BreadcrumbList',
            '@id': breadcrumbId,
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'わたし理解度診断',
                item: CANONICAL_ORIGIN + '/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: '人気の10問パック',
                item: url,
              },
            ],
          },
        ],
      })}</script>`,
    );
}

function isVersionedStaticAsset(url) {
  const version = String(url.searchParams.get('v') || '');
  return VERSIONED_STATIC_ASSET_PATH.test(url.pathname)
    && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(version);
}

function applyEnglishGameMeta(html, kind, requestUrl) {
  html = selectQuestionDataScript(html, 'en');
  const isLive = kind === 'live';
  const canonicalPath = isLive ? '/en/live-challenge' : '/en/challenge';
  const title = isLive
    ? 'Livestream Challenge | Play with Instagram or YouTube viewers'
    : 'Challenge Your Friends | How well do they know you?';
  const description = isLive
    ? 'Answer the same 10 questions with your livestream viewers. Earn one point for every match and give each viewer a personal result card.'
    : 'Create a free 10-question quiz, share one link, and see how well up to 50 friends know your answers.';
  const ogTitle = isLive ? 'Challenge your livestream viewers | Understanding Quiz' : 'How well do you know me? | Understanding Quiz';
  const shareUrl = new URL(canonicalPath, CANONICAL_ORIGIN);
  const room = String(requestUrl.searchParams.get('room') || '').trim();
  if (room) shareUrl.searchParams.set('room', room);
  const canonicalUrl = CANONICAL_ORIGIN + canonicalPath;
  const gameId = canonicalUrl + '#game';
  const breadcrumbId = canonicalUrl + '#breadcrumb';
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl + '#webpage',
        name: title,
        url: canonicalUrl,
        description,
        inLanguage: 'en',
        breadcrumb: { '@id': breadcrumbId },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: CANONICAL_ORIGIN + '/assets/ogp-challenge-en.png?v=20260725-en-1',
          width: 1729,
          height: 910,
        },
        mainEntity: { '@id': gameId },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Understanding Quiz',
            item: CANONICAL_ORIGIN + '/en/',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: ogTitle,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': ['WebApplication', 'Game'],
        '@id': gameId,
        name: ogTitle,
        url: canonicalUrl,
        description,
        image: CANONICAL_ORIGIN + '/assets/ogp-challenge-en.png?v=20260725-en-1',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: 'en',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'JPY',
        },
      },
    ],
  };
  let localized = html
    .replace(/<html lang="[^"]*">/i, '<html lang="en">')
    .replace(/<title>.*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${CANONICAL_ORIGIN + canonicalPath}">`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${ogTitle}">`)
    .replace(/<meta property="og:site_name" content="[^"]*"\s*\/?>/i, '<meta property="og:site_name" content="Understanding Quiz">')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}">`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${shareUrl.toString()}">`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/i, '<meta property="og:image" content="https://www.streetboardgame.com/assets/ogp-challenge-en.png?v=20260725-en-1">')
    .replace(/<meta property="og:image:secure_url" content="[^"]*"\s*\/?>/i, '<meta property="og:image:secure_url" content="https://www.streetboardgame.com/assets/ogp-challenge-en.png?v=20260725-en-1">')
    .replace(/<meta property="og:image:width" content="[^"]*"\s*\/?>/i, '<meta property="og:image:width" content="1729">')
    .replace(/<meta property="og:image:height" content="[^"]*"\s*\/?>/i, '<meta property="og:image:height" content="910">')
    .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/i, `<meta property="og:image:alt" content="${ogTitle}">`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${ogTitle}">`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${description}">`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/i, '<meta name="twitter:image" content="https://www.streetboardgame.com/assets/ogp-challenge-en.png?v=20260725-en-1">')
    .replace(/<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image:alt" content="${ogTitle}">`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`);
  if (/<meta property="og:locale" content="[^"]*"\s*\/?>/i.test(localized)) {
    localized = localized.replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/i, '<meta property="og:locale" content="en_US">');
  } else {
    localized = localized.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="website">\n  <meta property="og:locale" content="en_US">');
  }
  if (/<meta property="og:locale:alternate" content="[^"]*"\s*\/?>/i.test(localized)) {
    localized = localized.replace(/<meta property="og:locale:alternate" content="[^"]*"\s*\/?>/i, '<meta property="og:locale:alternate" content="ja_JP">');
  } else {
    localized = localized.replace('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="en_US">\n  <meta property="og:locale:alternate" content="ja_JP">');
  }
  localized = localized
    .replace('わたし理解度診断｜LIVE版', 'Know Me Quiz | Live')
    .replace('<h1>私のこと、ちゃんと<br>分かってるよね？</h1>', '<h1>How well do you<br>know me?</h1>')
    .replace('私のこと、ちゃんと分かってるよね？', 'How well do you know me?')
    .replace('<strong>当てるより、話すための10問。</strong>', '<strong>10 questions made for conversation.</strong>')
    .replace('配信者と視聴者が同時回答し、答えが一致するたび1点。最後に一人ずつ結果カードが出ます。', 'The streamer and viewers answer together. Earn one point for every match and get a personal result card.')
    .replace('← トップへ', '← Home')
    .replace('トップへ', 'Home')
    .replace('最大1,000人', 'Up to 1,000 players')
    .replace('ライブ配信で<br>みんなに挑戦してもらう', 'Challenge your<br>livestream viewers')
    .replace('配信者と視聴者が同じ10問に同時回答。答えが一致するたび1点、最後に一人ずつ結果カードが出ます。', 'The streamer and viewers answer the same 10 questions together. Earn one point for every match and get a personal result card.')
    .replace('Instagramライブ', 'Instagram Live')
    .replace('YouTubeライブ', 'YouTube Live')
    .replace('無料・連携不要', 'Free · no account link')
    .replace('利用規約', 'Terms')
    .replace('プライバシー', 'Privacy');
  return localized;
}

function selectQuestionDataScript(html, language) {
  const entryToRemove = language === 'en'
    ? 'prototype_common_data'
    : 'prototype_english_common_data';
  const scriptPattern = new RegExp(
    `\\s*<script\\b[^>]*data-build-entry=["']${entryToRemove}["'][^>]*>\\s*<\\/script>`,
    'i',
  );
  return html.replace(scriptPattern, '');
}

function applyChallengeShareMeta(html, requestUrl) {
  const room = String(requestUrl.searchParams.get('room') || '').trim().toUpperCase();
  if (!/^[A-Z2-9]{8}$/.test(room)) return html;
  const shareUrl = new URL('/challenge', CANONICAL_ORIGIN);
  shareUrl.searchParams.set('room', room);
  const shareVersion = String(requestUrl.searchParams.get('share') || '').trim();
  if (/^[a-z0-9-]{1,40}$/i.test(shareVersion)) shareUrl.searchParams.set('share', shareVersion);
  return html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${shareUrl.toString()}">`,
  );
}

function buildNoscript(page) {
  return `<noscript>
  <main style="max-width: 720px; margin: 32px auto; padding: 24px; font-family: sans-serif; line-height: 1.8; color: #1A1A1A; background: #FFFFFF;">
    <h1>${page.noscriptTitle || page.title}</h1>
    <p>${page.noscriptBody || page.description}</p>
    <p>JavaScriptを有効にすると、ゲーム本編とSNSでシェアできる診断結果を表示できます。</p>
    <p><a href="/challenge">みんなに挑戦してもらうクイズを作る</a> / <a href="/live-challenge">ライブ配信用クイズを作る</a> / <a href="/challenge-guide">遊び方を見る</a></p>
  </main>
</noscript>`;
}

function buildStructuredData(page) {
  const organizationId = 'https://www.streetboardgame.com/#organization';
  const websiteId = 'https://www.streetboardgame.com/#website';
  const pageImage = page.ogImage || 'https://www.streetboardgame.com/assets/ogp-challenge-v3.png?v=20260726-ogp-2';

  const webPage = {
    '@type': 'WebPage',
    '@id': page.pageId,
    url: page.url,
    name: page.title,
    description: page.description,
    inLanguage: 'ja',
    isPartOf: {
      '@id': websiteId,
    },
    breadcrumb: {
      '@id': page.url + '#breadcrumb',
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: pageImage,
      width: Number(page.imageWidth || 1200),
      height: Number(page.imageHeight || 630),
    },
  };

  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'Streetboardgame',
      url: 'https://www.streetboardgame.com/',
      logo: 'https://www.streetboardgame.com/assets/favicon-girl.png',
    },
    {
      '@type': 'WebSite',
      '@id': websiteId,
      url: 'https://www.streetboardgame.com/',
      name: 'わたし理解度診断',
      alternateName: '私のこと、ちゃんと分かってるよね？',
      inLanguage: 'ja',
      description: '自分の10問を最大50人へ出題する通常版と、視聴者と同時回答するライブ配信版を公開する無料クイズサイトです。',
      publisher: {
        '@id': organizationId,
      },
      hasPart: [
        {
          '@id': 'https://www.streetboardgame.com/challenge#challenge-game',
        },
        {
          '@id': 'https://www.streetboardgame.com/live-challenge#game',
        },
      ],
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': 'https://www.streetboardgame.com/#site-navigation',
      name: [
        'みんなに挑戦してもらう',
        'ライブ配信でみんなに挑戦してもらう',
        'About',
      ],
      url: [
        'https://www.streetboardgame.com/challenge',
        'https://www.streetboardgame.com/live-challenge',
        'https://www.streetboardgame.com/about',
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': page.url + '#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'わたし理解度診断',
          item: 'https://www.streetboardgame.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: page.ogTitle || page.title,
          item: page.url,
        },
      ],
    },
    webPage,
  ];

  if (page.gameId) {
    webPage.mainEntity = {
      '@id': page.gameId,
    };
    graph.push({
      '@type': ['WebApplication', 'Game'],
      '@id': page.gameId,
      url: page.url,
      name: page.gameName,
      alternateName: '私のこと、ちゃんと分かってるよね？',
      headline: page.headline,
      description: page.description,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      genre: page.genre,
      keywords: page.keywords,
      image: pageImage,
      inLanguage: 'ja',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
      },
      mainEntityOfPage: {
        '@id': page.pageId,
      },
      publisher: {
        '@id': organizationId,
      },
    });
  }

  if (page.faq && page.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': page.url + '#faq',
      mainEntity: page.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
      mainEntityOfPage: {
        '@id': page.pageId,
      },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function jsonResponse(data, status = 200, extraHeaders) {
  const headers = new Headers(extraHeaders || {});
  headers.set('content-type', 'application/json; charset=UTF-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}
