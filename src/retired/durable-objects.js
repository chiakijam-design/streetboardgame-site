// Empty stand-ins for the removed LIVE Durable Objects (2026-11-15). Keeping the
// class names avoids a delete-class migration; every request answers 410.
class RetiredLiveObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return new Response(JSON.stringify({ error: 'live-retired' }), {
      status: 410,
      headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' },
    });
  }
}

export class LiveRoomCoordinator extends RetiredLiveObject {}
export class LiveVoteShard extends RetiredLiveObject {}
