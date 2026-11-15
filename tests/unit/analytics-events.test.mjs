import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resetAnalyticsEventTrackingForTests,
  trackAnalyticsEvent,
  trackGamePlay,
} from '../../src/analytics/events.js';

function installWindow() {
  const events = [];
  const storage = new Map();
  globalThis.window = {
    trackEvent(name, params) {
      events.push({ name, params });
    },
    sessionStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
  };
  resetAnalyticsEventTrackingForTests();
  return { events, storage };
}

test.afterEach(() => {
  delete globalThis.window;
  resetAnalyticsEventTrackingForTests();
});

test('tracking is safe when analytics is unavailable', () => {
  assert.equal(trackAnalyticsEvent('game_start', { game_type: 'challenge' }), false);
});

test('tracking exclusion does not consume a once key', () => {
  const { events } = installWindow();
  window.analyticsEnabled = false;
  assert.equal(trackAnalyticsEvent('purchase', {}, { onceKey: 'purchase:1', persistSession: true }), false);
  window.analyticsEnabled = true;
  assert.equal(trackAnalyticsEvent('purchase', {}, { onceKey: 'purchase:1', persistSession: true }), true);
  assert.equal(events.length, 1);
});

test('once events are not sent twice', () => {
  const { events } = installWindow();
  assert.equal(trackAnalyticsEvent('game_result', { score: 10 }, { onceKey: 'result:1' }), true);
  assert.equal(trackAnalyticsEvent('game_result', { score: 10 }, { onceKey: 'result:1' }), false);
  assert.equal(events.length, 1);
});

test('accepted play sends only safe categorical data, once per role and session day', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T14:59:00Z') });
  const { events } = installWindow();
  assert.equal(trackGamePlay('challenge', 'participant'), true);
  assert.equal(trackGamePlay('challenge', 'participant'), false);
  resetAnalyticsEventTrackingForTests();
  assert.equal(trackGamePlay('challenge', 'participant'), false);
  assert.equal(trackGamePlay('challenge', 'creator'), true);
  assert.equal(trackGamePlay('live_challenge', 'viewer'), true);
  assert.equal(trackGamePlay('live_challenge', 'host'), true);
  assert.equal(trackGamePlay('live_challenge', 'subject'), true);
  assert.equal(trackGamePlay('challenge', 'viewer'), false);
  assert.equal(trackGamePlay('unknown', 'participant'), false);
  assert.deepEqual(events[0], { name: 'game_play', params: {
    game_type: 'challenge', play_mode: 'async', player_role: 'participant', play_criteria: 'accepted_answer',
  } });
  t.mock.timers.tick(60_000);
  assert.equal(trackGamePlay('challenge', 'participant'), true);
  assert.equal(events.length, 6);
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(trackGamePlay('challenge', 'participant'), true);
  assert.equal(events.length, 7);
});

test('excluded play does not consume the player marker', () => {
  const { events } = installWindow();
  window.analyticsEnabled = false;
  assert.equal(trackGamePlay('challenge', 'participant'), false);
  window.analyticsEnabled = true;
  assert.equal(trackGamePlay('challenge', 'participant'), true);
  assert.equal(events.length, 1);
});
