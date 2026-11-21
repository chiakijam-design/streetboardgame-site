// 2026-11-21: fixes for the Codex review (items 10, 11 and 16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadManagedQuestionCards } from '../../src/questions/catalog.js';
import { buildChallengeInviteText } from '../../src/platform/share.js';

test('#10 the 10-question invite says names and scores are listed, not that publishing is optional', () => {
  const text = buildChallengeInviteText({ creatorName: 'ゆう', url: 'https://example.test/challenge?room=ABCDEFGH' });
  assert.match(text, /全問答えると、表示名と点数が理解度ボードに載ります。/);
  assert.doesNotMatch(text, /公開するかは自分で選べ/);
});

test('#16 a failed review lookup never returns the bundled (possibly hidden) questions in strict mode', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(loadManagedQuestionCards([{ id: 'Q1', title: 'x', choices: [] }], 'challenge', 'ja', { strict: true }));
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(loadManagedQuestionCards([{ id: 'Q1', title: 'x', choices: [] }], 'challenge', 'ja', { strict: true }));
  } finally { globalThis.fetch = saved; }
});

test('#11 invitation, board and management screens start before the question catalog arrives', () => {
  const src = readFileSync(new URL('../../challenge_game.js', import.meta.url), 'utf8');
  const boot = src.slice(src.indexOf('async function bootChallenge'), src.indexOf('function startChallengeMode'));
  assert.ok(boot.indexOf("['join', 'ranking', 'manage'].includes(state.mode)") < boot.indexOf('await catalogLoad'));
  assert.match(boot, /setState\(\{ error: 'question-catalog-unavailable' \}\)/);
});
