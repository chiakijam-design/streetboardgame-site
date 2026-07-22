import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

test('購入権限回復マイグレーションはメールHMAC列と試行制限テーブルを追加する', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0001_live_purchase_records.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations-purchases/0004_live_entitlement_recovery.sql', import.meta.url), 'utf8'));

  const columns = sqlite.prepare('PRAGMA table_info(live_result_entitlements)').all();
  assert.equal(columns.some((column) => column.name === 'purchaser_email_hash'), true);
  assert.equal(
    sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get('live_purchase_recovery_limits')?.name,
    'live_purchase_recovery_limits',
  );
  sqlite.close();
});
