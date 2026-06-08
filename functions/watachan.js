export function onRequest() {
  return Response.redirect(
    new URL('/?screen=intro', 'https://streetboardgame.chiaki-jam.workers.dev').toString(),
    302
  );
}
