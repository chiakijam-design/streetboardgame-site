import test from 'node:test';
import assert from 'node:assert/strict';

import { startYouTubeOAuth } from '../../src/live/ownership.js';

test('所有確認済みでも字幕を再取込でき、必要なYouTube字幕スコープだけを要求する', async () => {
  const accessToken = 'a'.repeat(48);
  const row = {
    verification_id: 'b'.repeat(32),
    access_token_hash: await sha256(accessToken),
    ownership_status: 'verified',
  };
  const updates = [];
  const env = {
    YOUTUBE_OAUTH_CLIENT_ID: 'oauth-client-id',
    YOUTUBE_OAUTH_CLIENT_SECRET: 'oauth-client-secret',
    YOUTUBE_OAUTH_REDIRECT_URI: 'https://www.streetboardgame.com/api/live/channel-verifications/oauth/callback',
    REMOTE_DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              first: async () => row,
              run: async () => { updates.push({ sql, values }); return { success: true }; },
            };
          },
        };
      },
    },
  };
  const request = new Request('https://www.streetboardgame.com/api/live/channel-verifications/test/oauth-start', {
    method: 'POST', headers: { 'x-live-verification-token': accessToken },
  });
  const response = await startYouTubeOAuth(request, env, row.verification_id);
  assert.equal(response.status, 200);
  const body = await response.json();
  const authorizationUrl = new URL(body.authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.force-ssl');
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'online');
  assert.equal(updates.length, 1);
});

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
