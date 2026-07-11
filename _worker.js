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

    if (path.startsWith('/api/remote')) {
      return handleRemoteApi(request, env, path);
    }

    if (path === '/remote') {
      const remoteUrl = new URL('/remote.html', url.origin);
      const response = await env.ASSETS.fetch(new Request(remoteUrl.toString(), {
        method: 'GET',
        headers: request.headers,
      }));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      return new Response(await response.text(), { status: response.status, headers });
    }

    const pageMap = {
      '/love': {
        title: '彼氏の愛情判定｜彼女版も遊べる無料カップル診断ゲーム',
        description: 'メインは彼氏の彼女理解度を測定する彼氏の愛情判定ゲーム。彼女版は同じゲーム内で切り替えでき、大学生カップルのデート、飲み会、旅行、おうち時間にスマホ1台で遊べます。',
        url: CANONICAL_ORIGIN + '/love',
        ogTitle: '彼氏の愛情判定｜わたちゃん',
        imageAlt: 'わたちゃん 彼氏の愛情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/love#webpage',
        gameId: CANONICAL_ORIGIN + '/love#love-game',
        gameName: 'わたちゃん 彼氏の愛情判定ゲーム',
        headline: '彼氏の彼女理解度を測定できる無料カップル診断ゲーム',
        genre: ['カップルゲーム', '恋愛診断', '愛情判定', '診断ゲーム', 'ボードゲーム'],
        keywords: '彼氏の愛情判定, 彼女の愛情判定, カップル診断, 恋愛診断, 大学生カップル, デートゲーム, 飲み会ゲーム, カップルゲーム, 無料ゲーム, わたちゃん',
        noscriptTitle: '彼氏の愛情判定｜わたちゃん無料カップル診断ゲーム',
        noscriptBody: 'メインは彼氏の彼女理解度を測定する彼氏の愛情判定ゲームです。彼女版は同じゲーム内で切り替えでき、スマホ1台で5問後にふたりの理解度を確認できます。',
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
        description: '友達の友情判定は、本人が選んだ答えを友達が予想し、友達のことをどれだけ理解しているか診断できる無料の友情診断ゲームです。',
        url: CANONICAL_ORIGIN + '/friends',
        ogTitle: '友達の友情判定｜わたちゃん',
        imageAlt: 'わたちゃん 友達の友情判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/friends#webpage',
        gameId: CANONICAL_ORIGIN + '/friends#friend-game',
        gameName: 'わたちゃん 友達の友情判定',
        headline: '友達同士で本人の答えを予想する無料友情診断ゲーム',
        genre: ['友情ゲーム', '友達ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '友情判定ゲーム, 友達ゲーム, 友情診断, 友達診断, 大学生 友達 ゲーム, 飲み会ゲーム, 旅行ゲーム, スマホゲーム, わたちゃん',
        noscriptTitle: '友達の友情判定｜わたちゃん無料友情診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、友達がその答えを予想する無料友情判定ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に友達ごとの正解数を確認できます。',
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
        description: '家族の絆判定は、本人が選んだ答えを家族が予想し、家族のことをどれだけ理解しているか診断できる無料の絆チェックゲームです。',
        url: CANONICAL_ORIGIN + '/family',
        ogTitle: '家族の絆判定｜わたちゃん',
        imageAlt: 'わたちゃん 家族の絆判定ゲーム',
        pageId: CANONICAL_ORIGIN + '/family#webpage',
        gameId: CANONICAL_ORIGIN + '/family#family-game',
        gameName: 'わたちゃん 家族の絆判定',
        headline: '家族で本人の答えを予想する無料の絆チェックゲーム',
        genre: ['家族ゲーム', '絆ゲーム', '診断ゲーム', 'ボードゲーム'],
        keywords: '家族ゲーム, 家族診断, 絆判定, 家族の絆, 親子ゲーム, 兄弟姉妹ゲーム, 親戚の集まり ゲーム, スマホゲーム, わたちゃん',
        noscriptTitle: '家族の絆判定｜わたちゃん無料家族診断ゲーム',
        noscriptBody: '本人が自分の答えを選び、家族がその答えを予想する無料家族診断ゲームです。スマホ1台で2〜4人プレイに対応し、5問後に家族ごとの正解数を確認できます。',
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
        noscriptBody: 'わたちゃんは、彼氏の彼女理解度を測定する「彼氏の愛情判定ゲーム」をメインにしたスマホ向け無料ゲームサイトです。彼女版は同じゲーム内で切り替えでき、友達の友情判定、家族の絆判定も公開しています。',
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

const REMOTE_ROOM_TTL_SECONDS = 60 * 60 * 24;
const REMOTE_ROOM_CODE_CHARS = '0123456789';

async function handleRemoteApi(request, env, path) {
  if (request.method === 'OPTIONS') {
    return jsonResponse({});
  }

  if (!env.REMOTE_DB && !env.REMOTE_KV) {
    return jsonResponse({ error: 'remote-storage-not-configured' }, 500);
  }

  try {
    if (path === '/api/remote/rooms' && request.method === 'POST') {
      return await createRemoteRoom(request, env);
    }

    const chooseMatch = path.match(/^\/api\/remote\/rooms\/([0-9]{6})\/choose$/);
    if (chooseMatch && request.method === 'POST') {
      return await chooseRemoteAnswer(request, env, chooseMatch[1]);
    }

    const match = path.match(/^\/api\/remote\/rooms\/([0-9]{6})$/);
    if (match && request.method === 'GET') {
      const code = match[1];
      const room = await getRemoteRoom(env, code);
      if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
      return jsonResponse({
        code,
        room: publicRemoteRoom(room),
        turnAccess: hasRemoteTurnAccess(request, room),
      });
    }

    if (match && request.method === 'POST') {
      const code = match[1];
      const room = await getRemoteRoom(env, code);
      if (!room) return jsonResponse({ error: 'room-not-found' }, 404);
      const body = await readJson(request);
      const patch = sanitizeRemotePatch(body && body.patch);
      const nextRoom = {
        ...room,
        ...patch,
        updatedAt: Date.now(),
        expiresAt: Date.now() + REMOTE_ROOM_TTL_SECONDS * 1000,
      };
      if (nextRoom.phase === 'result') {
        nextRoom.turnToken = null;
      } else if (['target', 'guess'].includes(patch.phase) && (Array.isArray(patch.cards) || room.phase === 'result')) {
        nextRoom.turnToken = createRemoteTurnToken();
      }
      await putRemoteRoom(env, code, nextRoom);
      return jsonResponse({
        code,
        room: publicRemoteRoom(nextRoom),
        nextTurnToken: nextRoom.turnToken || '',
      });
    }

    return jsonResponse({ error: 'not-found' }, 404);
  } catch (error) {
    return jsonResponse({ error: error && error.message ? error.message : 'remote-api-error' }, 500);
  }
}

async function createRemoteRoom(request, env) {
  const body = await readJson(request);
  const room = sanitizeNewRemoteRoom(body);
  let code = createRemoteCode();
  for (let i = 0; i < 6; i += 1) {
    const exists = await getRemoteRoom(env, code);
    if (!exists) break;
    code = createRemoteCode();
  }
  await putRemoteRoom(env, code, room);
  return jsonResponse({ code, room: publicRemoteRoom(room), nextTurnToken: room.turnToken });
}

async function chooseRemoteAnswer(request, env, code) {
  const room = await getRemoteRoom(env, code);
  if (!room) return jsonResponse({ error: 'room-not-found' }, 404);

  const body = await readJson(request);
  const turnToken = String(body && body.turnToken ? body.turnToken : '');
  const expectedRole = room.phase === 'target' ? 'target' : room.phase === 'guess' ? 'guesser' : '';
  if (!expectedRole || room.turnToken !== turnToken || body.role !== expectedRole) {
    return jsonResponse({ error: 'turn-link-expired' }, 409);
  }
  if (!isChoiceIndex(body.choice)) return jsonResponse({ error: 'invalid-choice' }, 400);

  const choice = Number(body.choice);
  const total = (room.cards || []).length;
  const qIdx = Number(room.qIdx || 0);
  const targetAnswers = Array.isArray(room.targetAnswers) ? room.targetAnswers.slice(0, total) : [];
  const guessAnswers = Array.isArray(room.guessAnswers) ? room.guessAnswers.slice(0, total) : [];
  const currentAnswers = expectedRole === 'target' ? targetAnswers : guessAnswers;
  currentAnswers[qIdx] = choice;
  const nextIndex = qIdx + 1;
  const currentRoleDone = nextIndex >= total;
  const otherAnswers = expectedRole === 'target' ? guessAnswers : targetAnswers;
  const otherRoleDone = otherAnswers.length === total && otherAnswers.every(isChoiceIndex);
  const done = currentRoleDone && otherRoleDone;
  const answers = done ? targetAnswers.map((target, index) => ({
    target: Number(target),
    guess: Number(guessAnswers[index]),
    match: Number(target) === Number(guessAnswers[index]),
  })) : [];
  const currentPhase = expectedRole === 'guesser' ? 'guess' : 'target';
  const nextPhase = done ? 'result' : currentRoleDone ? oppositeRemoteRole(expectedRole) : currentPhase;
  const nextRoom = {
    ...room,
    targetAnswers,
    guessAnswers,
    answers,
    qIdx: done ? total - 1 : currentRoleDone ? 0 : nextIndex,
    phase: nextPhase,
    turnToken: done ? null : createRemoteTurnToken(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + REMOTE_ROOM_TTL_SECONDS * 1000,
  };

  await putRemoteRoom(env, code, nextRoom);
  return jsonResponse({
    code,
    room: publicRemoteRoom(nextRoom),
    nextTurnToken: nextRoom.turnToken || '',
  });
}

function sanitizeNewRemoteRoom(body) {
  const cards = Array.isArray(body && body.cards) ? body.cards.slice(0, 5).map(sanitizeRemoteCard) : [];
  if (cards.length !== 5) throw new Error('cards-required');
  const loveMode = body && body.loveMode === 'boyTarget' ? 'boyTarget' : 'girlTarget';
  const creatorSide = body && body.creatorSide === 'girl' ? 'girl' : 'boy';
  const targetSide = loveMode === 'boyTarget' ? 'boy' : 'girl';
  const creatorPhase = creatorSide === targetSide ? 'target' : 'guess';
  const players = body && body.players ? body.players : {};
  const now = Date.now();
  return {
    type: 'love',
    version: 4,
    loveMode,
    creatorSide,
    players: {
      girl: sanitizeRemoteName(players.girl, '彼女'),
      boy: sanitizeRemoteName(players.boy, '彼氏'),
    },
    cards,
    qIdx: 0,
    phase: creatorPhase,
    targetAnswers: [],
    guessAnswers: [],
    turnToken: createRemoteTurnToken(),
    answers: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + REMOTE_ROOM_TTL_SECONDS * 1000,
  };
}

function sanitizeRemotePatch(patch) {
  const source = patch && typeof patch === 'object' ? patch : {};
  const next = {};
  if (source.loveMode === 'girlTarget' || source.loveMode === 'boyTarget') next.loveMode = source.loveMode;
  if (['target', 'guess', 'result'].includes(source.phase)) next.phase = source.phase;
  if (Number.isInteger(source.qIdx) && source.qIdx >= 0 && source.qIdx <= 4) next.qIdx = source.qIdx;
  if (Array.isArray(source.targetAnswers) && source.targetAnswers.length === 0) next.targetAnswers = [];
  if (Array.isArray(source.guessAnswers) && source.guessAnswers.length === 0) next.guessAnswers = [];
  if (Array.isArray(source.cards)) {
    const cards = source.cards.slice(0, 5).map(sanitizeRemoteCard);
    if (cards.length !== 5) throw new Error('cards-required');
    next.cards = cards;
  }
  if (typeof source.roleSwapNonce === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(source.roleSwapNonce)) {
    next.roleSwapNonce = source.roleSwapNonce;
  }
  if (Array.isArray(source.answers)) {
    next.answers = source.answers.slice(0, 5).map((answer) => ({
      target: isChoiceIndex(answer && answer.target) ? Number(answer.target) : 0,
      guess: isChoiceIndex(answer && answer.guess) ? Number(answer.guess) : 0,
      match: Boolean(answer && answer.match),
    }));
  }
  return next;
}

function sanitizeRemoteCard(card) {
  const choices = Array.isArray(card && card.choices) ? card.choices.slice(0, 5) : [];
  if (choices.length !== 5) throw new Error('invalid-card');
  return {
    id: String(card && card.id ? card.id : ''),
    image: String(card && card.image ? card.image : '').slice(0, 160),
    title: String(card && card.title ? card.title : '').slice(0, 80),
    choices: choices.map((choice) => String(choice || '').slice(0, 40)),
  };
}

function sanitizeRemoteName(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 6);
  return text || fallback;
}

function isChoiceIndex(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 4;
}

function oppositeRemoteRole(role) {
  return role === 'target' ? 'guess' : 'target';
}

function createRemoteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => REMOTE_ROOM_CODE_CHARS[byte % REMOTE_ROOM_CODE_CHARS.length]).join('');
}

function createRemoteTurnToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicRemoteRoom(room) {
  const { turnToken, targetAnswers, guessAnswers, ...publicRoom } = room || {};
  return publicRoom;
}

function hasRemoteTurnAccess(request, room) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get('turn') || '');
  const isHandoff = url.searchParams.get('handoff') === '1';
  const claimedRole = isHandoff ? url.searchParams.get('next') : url.searchParams.get('role');
  const expectedRole = room && room.phase === 'target' ? 'target' : room && room.phase === 'guess' ? 'guesser' : '';
  return Boolean(expectedRole && room && room.turnToken && token === room.turnToken && claimedRole === expectedRole);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

async function ensureRemoteD1(env) {
  if (!env.REMOTE_DB) return false;
  await env.REMOTE_DB.prepare(`
    CREATE TABLE IF NOT EXISTS remote_rooms (
      code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `).run();
  return true;
}

async function getRemoteRoom(env, code) {
  if (await ensureRemoteD1(env)) {
    const row = await env.REMOTE_DB
      .prepare('SELECT payload, expires_at FROM remote_rooms WHERE code = ?')
      .bind(code)
      .first();
    if (!row || Number(row.expires_at) < Date.now()) return null;
    return JSON.parse(row.payload);
  }
  if (env.REMOTE_KV) {
    return await env.REMOTE_KV.get(`room:${code}`, { type: 'json' });
  }
  throw new Error('remote-storage-not-configured');
}

async function putRemoteRoom(env, code, room) {
  if (await ensureRemoteD1(env)) {
    await env.REMOTE_DB
      .prepare(`
        INSERT INTO remote_rooms (code, payload, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
      `)
      .bind(code, JSON.stringify(room), room.createdAt || Date.now(), Date.now(), room.expiresAt)
      .run();
    return;
  }
  if (env.REMOTE_KV) {
    await env.REMOTE_KV.put(`room:${code}`, JSON.stringify(room), {
      expirationTtl: REMOTE_ROOM_TTL_SECONDS,
    });
    return;
  }
  throw new Error('remote-storage-not-configured');
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
    },
  });
}
