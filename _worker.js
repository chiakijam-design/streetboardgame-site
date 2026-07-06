// Cloudflare Workers 静的サイト + ルーティング
// https://developers.cloudflare.com/pages/functions/advanced-mode/
//
// 動作:
//   /watachan         → / にリダイレクト
//   /watachan/        → / にリダイレクト
//   /friends          → /?screen=friendIntro にリダイレクト
//   /friends/         → /?screen=friendIntro にリダイレクト
//   /contact          → /?screen=about&to=contact にリダイレクト
//   /contact/         → /?screen=about&to=contact にリダイレクト
//   その他の存在しないパス → / にリダイレクト
//   存在するファイル (HTML/画像/JSX) → そのまま配信

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');

    // 旧Wix URL → 正規URLへ恒久リダイレクト
    const redirectMap = {
      '/watachan': '/',
      '/friends': '/?screen=friendIntro',
      '/contact':  '/?screen=about&to=contact',
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
