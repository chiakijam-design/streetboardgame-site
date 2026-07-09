// Cloudflare Workers 静的サイト + ルーティング
// https://developers.cloudflare.com/pages/functions/advanced-mode/
//
// 動作:
//   /watachan         → / にリダイレクト
//   /watachan/        → / にリダイレクト
//   /love             → 彼氏の愛情判定紹介ページ（彼女版も対応）として専用SEOメタ付きHTMLを返す
//   /friends          → 友達の友情判定紹介ページとして専用SEOメタ付きHTMLを返す
//   /friends/         → /friends にリダイレクト
//   /family           → 家族の絆判定紹介ページとして専用SEOメタ付きHTMLを返す
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
      '/love': {
        title: '彼氏の愛情判定｜彼女版も遊べる無料カップル診断ゲーム',
        description: 'メインは彼氏が彼女の答えを当てる彼氏の愛情判定ゲーム。彼女版は同じゲーム内で切り替えでき、スマホ1台でふたりの理解度をチェックできます。',
        url: CANONICAL_ORIGIN + '/love',
        ogTitle: '彼氏の愛情判定｜わたちゃん',
        imageAlt: 'わたちゃん 彼氏の愛情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/love#webpage',
        gameId: CANONICAL_ORIGIN + '/love#love-game',
        gameName: 'わたちゃん 彼氏の愛情判定ゲーム',
        headline: '彼氏が彼女の答えを当てる無料カップル診断ゲーム',
        genre: ['カップルゲーム', '恋愛診断', '愛情判定', '診断ゲーム', 'ボードゲーム'],
        keywords: '彼氏の愛情判定, 彼女の愛情判定, カップル診断, 恋愛診断, カップルゲーム, 無料ゲーム, わたちゃん',
        noscriptTitle: '彼氏の愛情判定｜わたちゃん無料カップル診断ゲーム',
        noscriptBody: 'メインは彼氏が彼女の答えを当てる彼氏の愛情判定ゲームです。彼女版は同じゲーム内で切り替えでき、スマホ1台で5問後にふたりの理解度を確認できます。',
        faq: [
          {
            question: '彼氏の愛情判定と彼女の愛情判定は何が違う？',
            answer: 'どちらの答えを相手が当てるかを選べます。彼女の答えを彼氏が当てる遊び方も、彼氏の答えを彼女が当てる遊び方もできます。',
          },
          {
            question: '無料で遊べますか？',
            answer: '無料で遊べます。スマホ1台で5問だけ出題され、結果画像やシェア文も作れます。',
          },
          {
            question: 'どんな場面で遊びやすいですか？',
            answer: '大学生カップルのデート中、飲み会、旅行、おうち時間など、短時間で相手の好みや考え方を知りたい場面に向いています。',
          },
        ],
      },
      '/friends': {
        title: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        description: '友達同士で本人の答えを予想する無料友情診断ゲーム。スマホ1台で2〜4人プレイに対応し、友達の理解度を楽しくチェックできます。',
        url: CANONICAL_ORIGIN + '/friends',
        ogTitle: '友達の友情判定｜わたちゃん',
        imageAlt: 'わたちゃん 友達の友情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/friends#webpage',
        gameId: CANONICAL_ORIGIN + '/friends#friend-game',
        gameName: 'わたちゃん 友達の友情判定',
        headline: '友達同士で本人の答えを予想する無料友情診断ゲーム',
        genre: ['友情ゲーム', '友達ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '友情判定ゲーム, 友達ゲーム, 友情診断, 友達診断, スマホゲーム, わたちゃん',
        noscriptTitle: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、友達がその答えを予想する無料友情判定ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に友達それぞれの理解度を確認できます。',
        faq: [
          {
            question: '友達の友情判定は何人で遊べますか？',
            answer: '2〜4人で遊べます。本人が答えを選び、友達A、友達B、友達Cが順番に予想します。',
          },
          {
            question: '友情診断の結果はどう表示されますか？',
            answer: '5問後に、友達ごとの正解数とランク表、答え合わせ、AI総評をまとめて確認できます。',
          },
          {
            question: '友達同士のどんな場面に向いていますか？',
            answer: '大学生の集まり、休み時間、飲み会、旅行など、会話のきっかけが欲しい場面で遊びやすいゲームです。',
          },
        ],
      },
      '/family': {
        title: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        description: '家族で本人の答えを予想する無料の絆チェックゲーム。スマホ1台で2〜4人プレイに対応し、家族の理解度を楽しく確認できます。',
        url: CANONICAL_ORIGIN + '/family',
        ogTitle: '家族の絆判定｜わたちゃん',
        imageAlt: 'わたちゃん 家族の絆判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/family#webpage',
        gameId: CANONICAL_ORIGIN + '/family#family-game',
        gameName: 'わたちゃん 家族の絆判定',
        headline: '家族で本人の答えを予想する無料の絆チェックゲーム',
        genre: ['家族ゲーム', '絆ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '家族ゲーム, 家族診断, 絆判定, 家族の絆, スマホゲーム, わたちゃん',
        noscriptTitle: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、家族がその答えを予想する無料家族診断ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に家族それぞれの理解度を確認できます。',
        faq: [
          {
            question: '家族の絆判定は何人で遊べますか？',
            answer: '2〜4人で遊べます。本人が選んだ答えを、家族が順番に予想する形式です。',
          },
          {
            question: '家族診断の結果では何が分かりますか？',
            answer: '家族ごとの正解数、ランク表、答え合わせ、AI総評を表示します。普段聞かない好みや考え方を知るきっかけになります。',
          },
          {
            question: 'どんな家族イベントに向いていますか？',
            answer: 'おうち時間、親戚の集まり、家族旅行、親子の会話など、少し笑いながらお互いを知りたい場面に向いています。',
          },
        ],
      },
      '/about': {
        title: 'About｜わたちゃん・彼氏の愛情判定ゲーム',
        description: 'わたちゃんは、彼氏の愛情判定ゲームをメインに、同じゲーム内で遊べる彼女版、友達の友情判定、家族の絆判定へ広がるスマホ向け無料ゲームサイトです。',
        url: CANONICAL_ORIGIN + '/about',
        ogTitle: 'About｜わたちゃん',
        imageAlt: 'わたちゃん 彼氏の愛情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/about#webpage',
        noscriptTitle: 'About｜わたちゃん',
        noscriptBody: 'わたちゃんは、彼氏が彼女の答えを当てる「彼氏の愛情判定ゲーム」をメインにしたスマホ向け無料ゲームサイトです。彼女版は同じゲーム内で切り替えでき、友達の友情判定、家族の絆判定も公開しています。',
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
    <p><a href="/">彼氏の愛情を判定する</a> / <a href="/love">彼氏の愛情判定の遊び方を見る</a> / <a href="/friends">友達の友情判定を見る</a> / <a href="/family">家族の絆判定を見る</a> / <a href="/product">製品版を見る</a></p>
  </main>
</noscript>`;
}

function buildStructuredData(page) {
  const organizationId = 'https://www.streetboardgame.com/#organization';
  const websiteId = 'https://www.streetboardgame.com/#website';

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
      url: 'https://www.streetboardgame.com/assets/ogp.jpg',
      width: 1200,
      height: 630,
    },
  };

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
          '@id': 'https://www.streetboardgame.com/love#love-game',
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
