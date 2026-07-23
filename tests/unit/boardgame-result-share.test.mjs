import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBoardgameResultShareHash,
  parseBoardgameResultShareHash,
} from '../../src/core/boardgameResultShare.js';

const cards = Array.from({ length: 5 }, (_, index) => ({
  id: `BG00${index + 1}`,
  title: `お題${index + 1}`,
  choices: ['A', 'B', 'C', 'D', 'E'],
}));

test('ボドゲ仲間の結果を共有用ハッシュへ変換し、別端末用の状態へ復元できる', () => {
  const answers = [
    { target: 0, guesses: [0, 1] },
    { target: 1, guesses: [1, 1] },
    { target: 2, guesses: [2, 3] },
    { target: 3, guesses: [4, 3] },
    { target: 4, guesses: [4, 4] },
  ];
  const hash = createBoardgameResultShareHash({
    answers,
    cards,
    players: ['本人', '仲間A', '仲間B'],
  });

  assert.match(hash, /^#result=[A-Za-z0-9_-]+$/);
  const restored = parseBoardgameResultShareHash(hash, cards);
  assert.deepEqual(restored.players, ['本人', '仲間A', '仲間B']);
  assert.deepEqual(restored.cards.map((card) => card.id), cards.map((card) => card.id));
  assert.deepEqual(restored.answers, [
    { target: 0, guesses: [0, 1], matches: [true, false] },
    { target: 1, guesses: [1, 1], matches: [true, true] },
    { target: 2, guesses: [2, 3], matches: [true, false] },
    { target: 3, guesses: [4, 3], matches: [false, true] },
    { target: 4, guesses: [4, 4], matches: [true, true] },
  ]);
});

test('壊れた値・存在しないカード・範囲外の回答は結果として復元しない', () => {
  assert.equal(parseBoardgameResultShareHash('#result=not-json', cards), null);

  const missingCardHash = createBoardgameResultShareHash({
    answers: [{ target: 0, guesses: [0] }],
    cards: [{ id: 'BG999' }],
    players: ['本人', '仲間A'],
  });
  assert.equal(parseBoardgameResultShareHash(missingCardHash, cards), null);

  assert.equal(createBoardgameResultShareHash({
    answers: [{ target: 7, guesses: [0] }],
    cards: [cards[0]],
    players: ['本人', '仲間A'],
  }), '');
});
