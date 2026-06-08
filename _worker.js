export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 旧Wix URL → クエリパラメータ形式へ
    if (pathname === '/watachan' || pathname === '/watachan/') {
      return Response.redirect(url.origin + '/?screen=intro', 302);
    }
    if (pathname === '/contact' || pathname === '/contact/') {
      return Response.redirect(url.origin + '/?screen=about&to=contact', 302);
    }

    // それ以外は静的アセットを返す (env.ASSETS は wrangler.jsonc の binding)
    return env.ASSETS.fetch(request);
  },
};
