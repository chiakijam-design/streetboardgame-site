import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTranslation, validateCatalog, createCatalogTranslator, requireCompleteCatalog } from '../../src/i18n/catalog-core.js';

const source = [
  { id: 'heading', source: 'How well do you know me?' },
  { id: 'invite', source: '{0} challenged you' },
  { id: 'score', source: '{0} scored {1}/10 on {2}’s quiz.' },
];
const french = {
  heading: 'À quel point me connais-tu ?',
  invite: '{0} te lance un défi',
  score: 'Au quiz de {2}, {0} a obtenu {1}/10.',
};

test('catalog coverage rejects missing entries, extra keys and changed interpolation placeholders', () => {
  assert.equal(validateCatalog(source, french).complete, true);
  assert.deepEqual(validateCatalog(source, { heading: french.heading }).missing, ['invite', 'score']);
  assert.deepEqual(validateCatalog(source, { ...french, score: '{0} {1}' }).invalidPlaceholders, ['score']);
  assert.deepEqual(validateCatalog(source, { ...french, madeUp: 'X' }).unknown, ['madeUp']);
});

test('interpolation reorders template values while preserving names and punctuation verbatim', () => {
  const { translate } = createCatalogTranslator(source, french);
  assert.equal(translate('Alice challenged you'), 'Alice te lance un défi');
  assert.equal(translate('A.*[B] scored 8/10 on さくら’s quiz.'), 'Au quiz de さくら, A.*[B] a obtenu 8/10.');
  assert.equal(translate('  How well do you know me?\n'), '  À quel point me connais-tu ?\n');
  assert.equal(formatTranslation('{0} / {1}', ['{1}', 'Alice']), '{1} / Alice');
});

test('names or user-authored values colliding with public labels are protected and never translated', () => {
  const translator = createCatalogTranslator(source, french, { protectedText: ['How well do you know me?'] });
  assert.equal(translator.translate('How well do you know me?'), 'How well do you know me?');
  translator.protect(['Alice challenged you']);
  assert.equal(translator.translate('Alice challenged you'), 'Alice challenged you');
  assert.equal(translator.translate('Custom private question'), 'Custom private question');
});

test('public release gate rejects incomplete catalogs and missing provenance', () => {
  const catalog = { locale: 'fr', provenance: { method: 'machine-generated', nativeReview: false }, messages: french };
  assert.equal(requireCompleteCatalog(source, catalog, 'fr'), catalog);
  assert.throws(() => requireCompleteCatalog(source, { ...catalog, messages: {} }, 'fr'), /3 missing/);
  assert.throws(() => requireCompleteCatalog(source, catalog, 'de'), /locale mismatch/);
  assert.throws(() => requireCompleteCatalog(source, { ...catalog, provenance: {} }, 'fr'), /provenance/);
});

test('fixed Japanese aliases use the same catalog and never override protected names', () => {
  const translator = createCatalogTranslator(source, french, { aliases: { '私のこと、ちゃんと分かってるよね？': source[0].source } });
  assert.equal(translator.translate('私のこと、ちゃんと分かってるよね？'), french.heading);
  translator.protect(['私のこと、ちゃんと分かってるよね？']);
  assert.equal(translator.translate('私のこと、ちゃんと分かってるよね？'), '私のこと、ちゃんと分かってるよね？');
});
