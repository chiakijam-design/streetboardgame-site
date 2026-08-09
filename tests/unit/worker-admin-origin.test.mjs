import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../../_worker.js';

const env = {
  ASSETS: {
    fetch: async () => new Response('<html>asset</html>', {
      headers: { 'content-type': 'text/html; charset=UTF-8' },
    }),
  },
};

test('workers.dev does not expose management pages or admin APIs', async () => {
  for (const path of [
    '/question-ops',
    '/live-ops',
    '/api/questions/admin/overview',
    '/api/live/admin/overview',
  ]) {
    const response = await worker.fetch(
      new Request(`https://streetboardgame.chiaki-jam.workers.dev${path}`),
      env,
    );
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('cache-control'), 'no-store', path);
  }
});

test('workers.dev keeps public pages available', async () => {
  const response = await worker.fetch(
    new Request('https://streetboardgame.chiaki-jam.workers.dev/challenge'),
    env,
  );
  assert.equal(response.status, 200);
});
