export function onRequest() {
  return Response.redirect(
    new URL('/?screen=about&to=contact', 'https://streetboardgame.chiaki-jam.workers.dev').toString(),
    302
  );
}
