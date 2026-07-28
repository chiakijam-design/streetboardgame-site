import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_CHAT_MESSAGE_MAX_LENGTH,
  normalizeLiveChatText,
} from '../../src/live/chat.js';

test('LIVEチャットは空白を整え、120文字まで受け付ける', () => {
  assert.equal(normalizeLiveChatText('  配信  楽しい！\n次も見たい  '), '配信 楽しい!次も見たい');
  assert.equal(normalizeLiveChatText('あ'.repeat(LIVE_CHAT_MESSAGE_MAX_LENGTH)).length, LIVE_CHAT_MESSAGE_MAX_LENGTH);
  assert.equal(normalizeLiveChatText('', { optional: true }), '');
});

test('LIVEチャットは空欄・文字数超過・URL・個人情報を拒否する', () => {
  assert.throws(() => normalizeLiveChatText(''), /chat-message-required/);
  assert.throws(() => normalizeLiveChatText('あ'.repeat(LIVE_CHAT_MESSAGE_MAX_LENGTH + 1)), /chat-message-too-long/);
  assert.throws(() => normalizeLiveChatText('https://example.com を見て'), /chat-message-personal-information/);
  assert.throws(() => normalizeLiveChatText('連絡先は test@example.com'), /chat-message-personal-information/);
  assert.throws(() => normalizeLiveChatText('090-1234-5678 に電話して'), /chat-message-personal-information/);
});

test('LIVEチャットはいじめ・性的内容・容姿攻撃・差別表現を拒否する', () => {
  for (const message of ['あいつはキモい', '性的な話をしよう', '見た目が悪い', '差別してよい']) {
    assert.throws(() => normalizeLiveChatText(message), /chat-message-not-allowed/);
  }
});
