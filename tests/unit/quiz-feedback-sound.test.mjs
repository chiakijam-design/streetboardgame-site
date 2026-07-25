import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQuizFeedbackSoundPlayer,
  getQuizFeedbackTonePlan,
} from '../../src/platform/quizFeedbackSound.js';

test('正解音と不正解音は異なる2音の組み合わせを返す', () => {
  const correct = getQuizFeedbackTonePlan(true);
  const incorrect = getQuizFeedbackTonePlan(false);

  assert.equal(correct.length, 2);
  assert.equal(incorrect.length, 2);
  assert.ok(correct.every((tone) => tone.frequency > 600));
  assert.ok(incorrect.every((tone) => tone.frequency < 200));
  assert.notDeepEqual(correct, incorrect);
});

test('音声プレイヤーは停止状態を解除し、結果に対応する2音を1回ずつ予約する', async () => {
  const scheduled = [];

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 1;
      this.destination = {};
    }

    async resume() {
      this.state = 'running';
    }

    createOscillator() {
      const item = { type: '', frequency: 0, start: 0, stop: 0 };
      scheduled.push(item);
      return {
        set type(value) { item.type = value; },
        frequency: { setValueAtTime: (value) => { item.frequency = value; } },
        connect() {},
        start: (value) => { item.start = value; },
        stop: (value) => { item.stop = value; },
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
  }

  const player = createQuizFeedbackSoundPlayer({ AudioContextRef: FakeAudioContext });
  assert.equal(await player.play(true), true);
  assert.deepEqual(scheduled.map((item) => item.frequency), [659.25, 783.99]);
  assert.ok(scheduled.every((item) => item.start >= 1));
  assert.ok(scheduled.every((item) => item.stop > item.start));
});
