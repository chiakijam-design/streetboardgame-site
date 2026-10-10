import assert from 'node:assert/strict';
import test from 'node:test';
import { localizedCanvasContext, collectProtectedUserCopy } from '../../src/i18n/canvas-copy.js';
test('canvas translates measured/drawn labels and constrains long copy to the card', () => {
  const calls = [];
  const context = { canvas: { width: 1080 }, textAlign: 'center', measureText(text) { return { width: text.length }; }, fillText(...args) { calls.push(args); } };
  const localized = localizedCanvasContext(context, (text) => text === 'Title' ? 'عنوان طويل' : text, 'rtl');
  assert.equal(localized.measureText('Title').width, 'عنوان طويل'.length);
  localized.fillText('Title', 540, 100);
  assert.deepEqual(calls[0], ['عنوان طويل', 540, 100, 1056]);
  assert.equal(context.direction, 'rtl');
});
test('protection collects names, chat and custom questions without suppressing public question labels', () => {
  const state = { creatorName: 'Home', chat: { messages: [{ text: 'Create quiz', name: 'LIVE' }] }, cards: [{ id: 'EN001', title: 'Public question', choices: ['A'] }, { id: 'CUS001', title: 'Custom question', choices: ['Back'] }], liveQuestions: [{ id: 'Q1', sourceId: 'CUS002', text: 'Live custom question', options: ['Next'] }] };
  assert.deepEqual(new Set(collectProtectedUserCopy(state)), new Set(['Home', 'Create quiz', 'LIVE', 'Custom question', 'Back', 'Live custom question', 'Next']));
});
