// Cloudflare Workers 静的サイト + ルーティング
// https://developers.cloudflare.com/pages/functions/advanced-mode/
//
// 動作:
//   /watachan         → / にリダイレクト
//   /watachan/        → / にリダイレクト
//   /friends          → 友達の友情判定ページとして専用SEOメタ付きHTMLを返す
//   /friends/         → /friends にリダイレクト
//   /family           → 家族の絆判定ページとして専用SEOメタ付きHTMLを返す
//   /family/          → /family にリダイレクト
//   /contact          → /?screen=about&to=contact にリダイレクト
//   /contact/         → /?screen=about&to=contact にリダイレクト
//   その他の存在しないパス → / にリダイレクト
//   存在するファイル (HTML/画像/JSX) → そのまま配信

const CANONICAL_ORIGIN = 'https://www.streetboardgame.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'streetboardgame.com') {
      url.hostname = 'www.streetboardgame.com';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    const rawPath = decodeURIComponent(url.pathname);
    const path = rawPath.replace(/\/+$/, '');

    const pageMap = {
      '/friends': {
        title: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        description: '本人が選んだ答えを友達が予想する、スマホ1台で遊べる無料友情判定ゲーム。2〜4人で友達の理解度をチェックできます。',
        url: CANONICAL_ORIGIN + '/friends',
        ogTitle: '友達の友情判定｜わたちゃん',
        imageAlt: 'わたちゃん 友達の友情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/friends#webpage',
        gameId: CANONICAL_ORIGIN + '/friends#friend-game',
        gameName: 'わたちゃん 友達の友情判定',
        headline: '本人が選んだ答えを友達が予想する無料友情判定ゲーム',
        genre: ['友情ゲーム', '友達ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '友情判定ゲーム, 友達ゲーム, 友情診断, 友達診断, スマホゲーム, わたちゃん',
        noscriptTitle: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、友達がその答えを予想する無料友情判定ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に友達それぞれの理解度を確認できます。',
      },
      '/family': {
        title: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        description: '本人が選んだ答えを家族が予想する、スマホ1台で遊べる無料家族ゲーム。2〜4人で家族の絆をチェックできます。',
        url: CANONICAL_ORIGIN + '/family',
        ogTitle: '家族の絆判定｜わたちゃん',
        imageAlt: 'わたちゃん 家族の絆判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/family#webpage',
        gameId: CANONICAL_ORIGIN + '/family#family-game',
        gameName: 'わたちゃん 家族の絆判定',
        headline: '本人が選んだ答えを家族が予想する無料家族診断ゲーム',
        genre: ['家族ゲーム', '絆ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '家族ゲーム, 家族診断, 絆判定, 家族の絆, スマホゲーム, わたちゃん',
        noscriptTitle: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、家族がその答えを予想する無料家族診断ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に家族それぞれの理解度を確認できます。',
      },
      '/about': {
        title: 'About｜わたちゃん・彼氏の愛情判定ゲーム',
        description: 'わたちゃんは、彼氏の愛情判定ゲームをメインに、友達の友情判定や家族の絆判定を展開するスマホ向け無料ゲームサイトです。',
        url: CANONICAL_ORIGIN + '/about',
        ogTitle: 'About｜わたちゃん',
        imageAlt: 'わたちゃん 彼氏の愛情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/about#webpage',
        noscriptTitle: 'About｜わたちゃん',
        noscriptBody: 'わたちゃんは、彼氏が彼女の答えを当てる「彼氏の愛情判定ゲーム」をメインにしたスマホ向け無料ゲームサイトです。シリーズとして友達の友情判定や家族の絆判定も公開しています。',
      },
      '/product': {
        title: '製品版｜私のこと、ちゃんと分かってるよね？',
        description: 'Amazonで販売中のボードゲーム版「私のこと、ちゃんと分かってるよね？」を紹介するページです。54問入りで、飲み会や旅行、おうちデートでも遊べます。',
        url: CANONICAL_ORIGIN + '/product',
        ogTitle: '製品版｜私のこと、ちゃんと分かってるよね？',
        imageAlt: 'ボードゲーム版 私のこと、ちゃんと分かってるよね？',
        pageId: CANONICAL_ORIGIN + '/product#webpage',
        noscriptTitle: '製品版｜私のこと、ちゃんと分かってるよね？',
        noscriptBody: 'Amazonで販売中のボードゲーム版「私のこと、ちゃんと分かってるよね？」を紹介するページです。54問入りで、飲み会や旅行、おうちデートでも遊べます。',
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
    .replace(/<link rel="alternate" hreflang="ja" href="[^"]*" \/>/, `<link rel="alternate" hreflang="ja" href="${page.url}" />`)
    .replace(/<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/, `<link rel="alternate" hreflang="x-default" href="${page.url}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.ogTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${page.url}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${page.imageAlt || page.ogTitle}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${page.ogTitle}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${page.description}" />`)
    .replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${page.imageAlt || page.ogTitle}" />`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(buildStructuredData(page))}</script>`)
    .replace(/<noscript>[\s\S]*?<\/noscript>/, buildNoscript(page));
}

function buildNoscript(page) {
  return `<noscript>
  <main style="max-width: 720px; margin: 32px auto; padding: 24px; font-family: sans-serif; line-height: 1.8; color: #1A1A1A; background: #FFFFFF;">
    <h1>${page.noscriptTitle || page.title}</h1>
    <p>${page.noscriptBody || page.description}</p>
    <p>JavaScriptを有効にすると、ゲーム本編とSNSでシェアできる診断結果を表示できます。</p>
    <p><a href="/">彼氏の愛情を判定する</a> / <a href="/friends">友達の友情を判定する</a> / <a href="/family">家族の絆を判定する</a> / <a href="/product">製品版を見る</a></p>
  </main>
</noscript>`;
}

function buildStructuredData(page) {
  const organizationId = 'https://www.streetboardgame.com/#organization';
  const websiteId = 'https://www.streetboardgame.com/#website';

  const graph = [
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
      hasPart: [
        {
          '@id': 'https://www.streetboardgame.com/#couple-game',
        },
        {
          '@id': 'https://www.streetboardgame.com/friends#friend-game',
        },
        {
          '@id': 'https://www.streetboardgame.com/family#family-game',
        },
      ],
    },
    {
      '@type': 'SiteNavigationElement',
      '@id': 'https://www.streetboardgame.com/#site-navigation',
      name: [
        '彼氏の愛情判定',
        '友達の友情判定',
        '家族の絆判定',
        '製品版',
        'About',
      ],
      url: [
        'https://www.streetboardgame.com/',
        'https://www.streetboardgame.com/friends',
        'https://www.streetboardgame.com/family',
        'https://www.streetboardgame.com/product',
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
          name: 'わたちゃん',
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
      breadcrumb: {
        '@id': page.url + '#breadcrumb',
      },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://www.streetboardgame.com/assets/ogp.jpg',
        width: 1200,
        height: 630,
      },
    },
  ];

  if (page.gameId) {
    graph[4].mainEntity = {
      '@id': page.gameId,
    };
    graph.push({
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
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
