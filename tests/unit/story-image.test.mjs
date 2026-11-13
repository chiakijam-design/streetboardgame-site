import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoryCanvas, storyCardRect, storyNote, STORY_LOCALES, STORY_WIDTH, STORY_HEIGHT, STORY_STICKER_SPACE } from '../../src/platform/storyImage.js';
import { CHALLENGE_RESULT_COPY } from '../../src/i18n/challenge-result-copy.js';

test('story frame is 1080x1920 and leaves about 300px free at the bottom', () => {
  assert.equal(STORY_WIDTH, 1080);
  assert.equal(STORY_HEIGHT, 1920);
  const rect = storyCardRect(1080, 1350);
  assert.ok(rect.x >= 0 && rect.x + rect.width <= STORY_WIDTH);
  assert.ok(rect.y >= 0);
  assert.ok(rect.y + rect.height <= STORY_HEIGHT - STORY_STICKER_SPACE, JSON.stringify(rect));
  assert.ok(Math.abs(rect.width / rect.height - 1080 / 1350) < 0.01, 'keeps the card ratio');
});

test('sticker hint exists for every locale', () => {
  assert.deepEqual([...STORY_LOCALES].sort(), Object.keys(CHALLENGE_RESULT_COPY).sort());
  for (const locale of STORY_LOCALES) assert.ok(storyNote(locale).trim(), locale);
  assert.equal(storyNote('ja'), 'リンクはスタンプで貼ってね');
  assert.equal(storyNote('xx'), storyNote('en'));
});

test('story canvas draws the card on top and the hint in the sticker space', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, key) => key in target ? target[key]
      : key === 'createLinearGradient' ? () => ({ addColorStop: () => {} })
        : (...args) => calls.push([key, ...args]),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const doc = { createElement: () => canvas };
  const out = createStoryCanvas({ width: 1080, height: 1350 }, { locale: 'ja', background: 'gold', documentRef: doc });
  assert.equal(out.width, 1080);
  assert.equal(out.height, 1920);
  const draw = calls.find(c => c[0] === 'drawImage');
  // drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
  assert.ok(draw && draw[7] + draw[9] <= 1920 - 300, JSON.stringify(draw.slice(2)));
  const text = calls.find(c => c[0] === 'fillText');
  assert.match(text[1], /リンクはスタンプで貼ってね/);
  assert.ok(text[3] > 1920 - 300);
});
