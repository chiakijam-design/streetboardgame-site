import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TARGET_LOCALES } from '../../src/i18n/locales.js';
import { PARTICIPANT_ANSWER_OWNER_COPY, participantAnswerOwnerText } from '../../src/i18n/challenge-participant-copy.js';

test('participant answer owner line has copy for every public language', () => {
  assert.deepEqual(Object.keys(PARTICIPANT_ANSWER_OWNER_COPY), [...TARGET_LOCALES]);
  for (const locale of TARGET_LOCALES) {
    const text = participantAnswerOwnerText(locale, 'ゆう');
    assert.ok(text.includes('ゆう'), locale);
    assert.doesNotMatch(text, /[<>]|\{name\}/, locale);
  }
});

test('requested ja/en/pt/es wording and unknown locale fallback', () => {
  assert.equal(participantAnswerOwnerText('ja', 'ちあき'), 'ちあきさんの答えは？');
  assert.equal(participantAnswerOwnerText('en', 'Chiaki'), 'What did Chiaki answer?');
  assert.equal(participantAnswerOwnerText('pt', 'Chiaki'), 'O que Chiaki respondeu?');
  assert.equal(participantAnswerOwnerText('es', 'Chiaki'), '¿Qué respondió Chiaki?');
  assert.equal(participantAnswerOwnerText('unknown', 'Chiaki'), 'What did Chiaki answer?');
});

test('display name is inserted literally (no replacement patterns) and rendered with textContent', async () => {
  assert.equal(participantAnswerOwnerText('ja', '$&<b>'), '$&<b>さんの答えは？');
  const source = await readFile(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  assert.match(source, /answerOwner\.textContent = participantAnswerOwnerText\(currentLocale, state\.room\?\.creatorName\)/);
  assert.match(source, /data-testid="participant-answer-owner" data-user-copy><\/p>/);
});
