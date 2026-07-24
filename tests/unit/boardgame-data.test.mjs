import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../prototype_boardgame_data.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);

const cards = context.window.BOARDGAME_CARDS;

test('正式決定したボドゲ54問は重複のないIDと5択を持つ', () => {
  assert.equal(cards.length, 54);
  assert.equal(new Set(cards.map((card) => card.id)).size, 54);
  assert.equal(cards.every((card) => card.title && card.choices.length === 5), true);
});

test('正式決定シートの改訂内容を収録する', () => {
  const byTitle = new Map(cards.map((card) => [card.title, card]));

  assert.deepEqual(
    Array.from(byTitle.get('初心者に最初にすすめたいゲーム').choices),
    ['カタン', 'ラブレター', 'ごきぶりポーカー', 'ブロックス', '宝石の煌めき'],
  );
  assert.deepEqual(
    Array.from(byTitle.get('一番好きな重ゲー').choices),
    ['テラフォーミング・マーズ', 'アグリコラ', 'アルナックの失われし遺跡', 'ブラス：バーミンガム', 'ワイナリーの四季'],
  );
  assert.deepEqual(
    Array.from(byTitle.get('正体隠匿で仲間を見つけたとき').choices),
    ['自然に助ける', '露骨に守る', '一度疑っておく', '最後まで距離を取る', '合図を送り続ける'],
  );
  assert.equal(byTitle.has('初対面の人とも遊びやすいゲーム'), false);
});
