import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuestionBackupCsv,
  QUESTION_BACKUP_HEADERS,
  questionBackupFilename,
} from '../../src/questions/export.js';

test('全お題のバックアップCSVはBOM・見出し・採用状態・5択を保持する', () => {
  const csv = buildQuestionBackupCsv([{
    id: 'Q001',
    title: '好きな食べ物は？',
    choices: ['寿司', '焼肉', 'パスタ', 'ケーキ', '家ごはん'],
    category: 'みんなのお題',
    status: 'approved',
    sourceKind: 'static',
    sourceRef: 'Q001',
    reportCount: 0,
    updatedAt: Date.UTC(2026, 6, 26, 1, 2, 3),
  }, {
    id: 'CUS001',
    title: 'カンマ,と"引用符"を含む問題',
    choices: ['=HYPERLINK("https://example.invalid")', '2', '3', '4', '5'],
    status: 'disabled',
    sourceKind: 'custom',
    reportCount: 2,
  }]);

  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(csv.includes(QUESTION_BACKUP_HEADERS.join(',')));
  assert.ok(csv.includes('採用,Q001,好きな食べ物は？,寿司,焼肉,パスタ,ケーキ,家ごはん'));
  assert.ok(csv.includes('無効化,CUS001,"カンマ,と""引用符""を含む問題"'));
  assert.ok(csv.includes(',"\'=HYPERLINK(""https://example.invalid"")",'));
  assert.ok(csv.includes(',使用,使用,0,'));
  assert.ok(csv.includes(',停止,停止,2,'));
  assert.ok(csv.includes('2026-07-26T01:02:03.000Z'));
  assert.ok(csv.endsWith('\r\n'));
});

test('バックアップCSV名に端末時刻を含める', () => {
  const filename = questionBackupFilename(new Date(2026, 6, 26, 9, 7));
  assert.equal(filename, 'streetboardgame-questions-2026-07-26_0907.csv');
});
