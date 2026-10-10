import assert from 'node:assert/strict';
import test from 'node:test';
import { localizedQuestionCard, wrapLocalizedText } from '../../src/i18n/display-copy.js';

test('official question display copy is translated without altering stored IDs or original snapshots', () => {
  const card = { id: 'COM001', title: 'Question', category: 'Category', choices: ['One', 'Two'] };
  const localized = localizedQuestionCard(card, (value) => 'translated:' + value);
  assert.equal(localized.id, card.id);
  assert.equal(localized.title, 'translated:Question');
  assert.deepEqual(localized.choices, ['translated:One', 'translated:Two']);
  assert.equal(card.title, 'Question');
  assert.deepEqual(card.choices, ['One', 'Two']);
  const custom = { ...card, id: 'CUS001' };
  assert.equal(localizedQuestionCard(custom, () => { throw new Error('User-authored copy must stay intact'); }), custom);
});

test('translated PNG paragraphs and names retain all words within the permitted line count', () => {
  const text = 'Fixture User en el cuestionario de Fixture Host.\nLas diez respuestas coinciden. Pregunta todos los motivos y disfruta de la conversación.';
  const lines = wrapLocalizedText(text, 'es', 4);
  assert.ok(lines.length <= 4);
  assert.equal(lines.join(' '), text.replace(/\s+/g, ' '));
  assert.ok(lines.every((line) => !/cuest$|^ionario/.test(line)));
  for (const locale of ['ar', 'he', 'hi', 'bn', 'th']) {
    const copy = 'คำตอบทั้งหมดตรงกัน นี่คือคำถามที่คุณเลือก';
    assert.equal(wrapLocalizedText(copy, locale, 3).join('').replace(/\s/g, ''), copy.replace(/\s/g, ''));
  }
});
