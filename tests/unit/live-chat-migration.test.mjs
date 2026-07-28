import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  createLiveChatMessage,
  hideLiveChatMessage,
  listLiveChatMessages,
  publishPaidLiveChatMessage,
  reportLiveChatMessage,
} from '../../src/live/chat.js';

test('LIVEチャットのD1マイグレーションは本文・種別・金額・通報状態を保存する', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0025_live_chat.sql', import.meta.url), 'utf8'));
  const columns = sqlite.prepare('PRAGMA table_info(live_chat_messages)').all().map((column) => column.name);
  for (const column of [
    'message_id',
    'code',
    'participant_id',
    'message_text',
    'message_type',
    'amount',
    'status',
    'stripe_order_id',
    'report_count',
  ]) assert.equal(columns.includes(column), true, column);
});

test('無料投稿と決済済み応援を保存し、通報・非表示後は公開一覧から外す', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0025_live_chat.sql', import.meta.url), 'utf8'));
  const env = { REMOTE_DB: d1Adapter(sqlite) };
  const chat = await createLiveChatMessage(env, {
    code: '123456',
    participantId: 'viewer-1',
    participantName: '視聴者',
    text: '配信楽しい！',
  });
  const support = await publishPaidLiveChatMessage(env, {
    orderId: 'ord_paid_1',
    code: '123456',
    participantId: 'viewer-2',
    participantName: '応援者',
    text: '応援しています！',
    amount: 1980,
  });
  assert.deepEqual((await listLiveChatMessages(env, '123456')).map((message) => message.type), ['chat', 'support']);
  assert.equal(support.amount, 1980);

  await reportLiveChatMessage(env, '123456', chat.id);
  assert.deepEqual((await listLiveChatMessages(env, '123456')).map((message) => message.id), [support.id]);
  await hideLiveChatMessage(env, '123456', support.id);
  assert.deepEqual(await listLiveChatMessages(env, '123456'), []);
});

function d1Adapter(sqlite) {
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bindings: [],
        bind(...bindings) {
          this.bindings = bindings;
          return this;
        },
        async first() {
          return statement.get(...this.bindings) || null;
        },
        async all() {
          return { results: statement.all(...this.bindings) };
        },
        async run() {
          const result = statement.run(...this.bindings);
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}
