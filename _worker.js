export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');

    const redirectMap = {
      '/watachan': '/?screen=intro',
      '/contact':  '/?screen=about&to=contact',
    };

    if (redirectMap[path]) {
      const target = new URL(redirectMap[path], url.origin);
      return Response.redirect(target.toString(), 302);
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      return Response.redirect(url.origin + '/', 302);
    }

    return response;
  },
};
