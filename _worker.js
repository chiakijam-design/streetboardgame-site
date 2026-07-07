// Cloudflare Workers 静的サイト + ルーティング
// https://developers.cloudflare.com/pages/functions/advanced-mode/
//
// 動作:
//   /watachan         → / にリダイレクト
//   /watachan/        → / にリダイレクト
//   /friends          → 友達の友情判定ページとして index.html を返す
//   /friends/         → 友達の友情判定ページとして index.html を返す
//   /family           → 家族の絆判定ページとして index.html を返す
//   /family/          → 家族の絆判定ページとして index.html を返す
//   /contact          → /?screen=about&to=contact にリダイレクト
//   /contact/         → /?screen=about&to=contact にリダイレクト
//   その他の存在しないパス → / にリダイレクト
//   存在するファイル (HTML/画像/JSX) → そのまま配信

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');

    const pageMap = {
      '/friends': {
        title: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        description: '本人が選んだ答えを友達が予想する、スマホ1台で遊べる無料友情判定ゲーム。2〜4人で友達の理解度をチェックできます。',
        url: url.origin + '/friends',
        ogTitle: '友達の友情判定｜わたちゃん',
        pageId: url.origin + '/friends#webpage',
        gameId: url.origin + '/friends#friend-game',
        gameName: 'わたちゃん 友達の友情判定',
        headline: '本人が選んだ答えを友達が予想する無料友情判定ゲーム',
        genre: ['友情ゲーム', '友達ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '友情判定ゲーム, 友達ゲーム, 友情診断, 友達診断, スマホゲーム, わたちゃん',
      },
      '/family': {
        title: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        description: '本人が選んだ答えを家族が予想する、スマホ1台で遊べる無料家族ゲーム。2〜4人で家族の絆をチェックできます。',
        url: url.origin + '/family',
        ogTitle: '家族の絆判定｜わたちゃん',
        pageId: url.origin + '/family#webpage',
        gameId: url.origin + '/family#family-game',
        gameName: 'わたちゃん 家族の絆判定',
        headline: '本人が選んだ答えを家族が予想する無料家族診断ゲーム',
        genre: ['家族ゲーム', '絆ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '家族ゲーム, 家族診断, 絆判定, 家族の絆, スマホゲーム, わたちゃん',
      },
    };

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
      return Response.redirect(target.toString(), 301);
    }

    // 静的アセットをそのまま返す (env.ASSETS は wrangler.jsonc の assets binding)
    const response = await env.ASSETS.fetch(request);

    // 404 になったら / にフォールバック
    if (response.status === 404) {
      return Response.redirect(url.origin + '/', 301);
    }

    return response;
  },
};

function applySeoMeta(html, page) {
  return html
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${page.url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.ogTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${page.url}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${page.ogTitle}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${page.description}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(buildStructuredData(page))}</script>`);
}

function buildStructuredData(page) {
  const organizationId = 'https://www.streetboardgame.com/#organization';
  const websiteId = 'https://www.streetboardgame.com/#website';

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'streetboardgame.com',
        url: 'https://www.streetboardgame.com/',
        logo: 'https://www.streetboardgame.com/assets/favicon-girl.png',
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: 'https://www.streetboardgame.com/',
        name: 'streetboardgame.com',
        inLanguage: 'ja',
        description: '彼氏の愛情判定ゲームをメインに、友達の友情判定や家族の絆判定などのシリーズを展開するオリジナルゲームサイトです。',
        publisher: {
          '@id': organizationId,
        },
      },
      {
        '@type': 'WebPage',
        '@id': page.pageId,
        url: page.url,
        name: page.title,
        description: page.description,
        inLanguage: 'ja',
        isPartOf: {
          '@id': websiteId,
        },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: 'https://www.streetboardgame.com/assets/ogp.jpg',
          width: 1200,
          height: 630,
        },
        mainEntity: {
          '@id': page.gameId,
        },
      },
      {
        '@type': ['WebApplication', 'Game'],
        '@id': page.gameId,
        url: page.url,
        name: page.gameName,
        alternateName: 'わたちゃん',
        headline: page.headline,
        description: page.description,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        genre: page.genre,
        keywords: page.keywords,
        image: 'https://www.streetboardgame.com/assets/ogp.jpg',
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
      },
    ],
  };
}
