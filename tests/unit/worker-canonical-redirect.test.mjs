import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../../_worker.js';

const env = {
  ASSETS: {
    fetch: async () => new Response('asset', { status: 200 }),
  },
};

test('public HTTP and apex requests redirect once to canonical HTTPS while preserving path and query', async () => {
  const cases = [
    'http://streetboardgame.com/challenge?room=ABCDEFGH',
    'http://www.streetboardgame.com/challenge?room=ABCDEFGH',
    'https://streetboardgame.com/challenge?room=ABCDEFGH',
  ];

  for (const requestUrl of cases) {
    const response = await worker.fetch(new Request(requestUrl), env);
    assert.equal(response.status, 301, requestUrl);
    assert.equal(
      response.headers.get('location'),
      'https://www.streetboardgame.com/challenge?room=ABCDEFGH',
      requestUrl,
    );
  }
});

test('canonical HTTPS requests are not redirected', async () => {
  const response = await worker.fetch(
    new Request('https://www.streetboardgame.com/example?source=test'),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
});
