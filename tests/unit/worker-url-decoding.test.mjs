import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../_worker.js';

const invalidPaths = [
  '/%C0', '/%C0/', '/%', '/%0', '/%GG', '/%E0%A4%A',
  '/%80', '/%ED%A0%80', '/%F4%90%80%80',
  '/challenge/%C0', '/api/live/%C0', '/api/challenge/%GG',
];

test('malformed URL paths return a controlled 400 without accessing downstream services', async () => {
  const env = { ASSETS: { fetch: async () => { throw new Error('must-not-fetch-assets'); } } };
  for (const path of invalidPaths) {
    for (const method of ['GET', 'HEAD', 'POST']) {
      const response = await worker.fetch(new Request(`https://www.streetboardgame.com${path}`, { method }), env);
      assert.equal(response.status, 400, `${method} ${path}`);
      assert.equal(response.headers.get('content-type'), 'text/plain; charset=UTF-8');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
      if (method === 'HEAD') assert.equal(response.body, null);
      assert.equal(await response.text(), method === 'HEAD' ? '' : 'Bad Request');
    }
  }
});

test('encoded valid routes still resolve and query strings are not decoded as paths', async () => {
  const assetRequests = [];
  const env = { ASSETS: { fetch: async request => {
    assetRequests.push(new URL(request.url).pathname);
    return new Response('<html>asset</html>', { headers: { 'content-type': 'text/html' } });
  } } };
  for (const path of ['/%63hallenge', '/challenge?source=%C0', '/encoded-%25']) {
    const response = await worker.fetch(new Request(`https://www.streetboardgame.com${path}`), env);
    assert.equal(response.status, 200, path);
  }
  assert.deepEqual(assetRequests, ['/challenge.html', '/challenge.html', '/encoded-%25']);
});

test('apex and HTTP malformed paths retain the canonical redirect before returning 400', async () => {
  for (const origin of ['http://streetboardgame.com', 'http://www.streetboardgame.com', 'https://streetboardgame.com']) {
    const response = await worker.fetch(new Request(`${origin}/%C0?source=test`), {});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://www.streetboardgame.com/%C0?source=test');
    const terminal = await worker.fetch(new Request(response.headers.get('location')), {});
    assert.equal(terminal.status, 400);
  }
});

test('unrelated downstream errors, including URIError, are not hidden as invalid requests', async () => {
  for (const error of [new Error('upstream-failed'), new URIError('upstream-uri-failed')]) {
    await assert.rejects(worker.fetch(new Request('https://www.streetboardgame.com/'), {
      ASSETS: { fetch: async () => { throw error; } },
    }), candidate => candidate === error);
  }
});

test('non-URIError decoder failures are rethrown', async t => {
  const error = new Error('unexpected-decoder-failure');
  t.mock.method(globalThis, 'decodeURIComponent', () => { throw error; });
  await assert.rejects(worker.fetch(new Request('https://www.streetboardgame.com/'), {}), candidate => candidate === error);
});
