import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const playwrightRoot = dirname(require.resolve('playwright/package.json', {
  paths: [dirname(require.resolve('@playwright/test/package.json'))],
}));
const { babelParse } = require(join(playwrightRoot, 'lib/transform/babelBundle.js'));
const root = new URL('../', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('data/i18n-source-inventory.json', root), 'utf8'));
const sources = new Map();
const aliases = inventory.fixedUiJapaneseToEnglish;
function add(source, context, force = false) {
  source = String(source || '').trim();
  source = aliases[source] || source;
  if (!source || source === '{0}' || /^https?:\/\//.test(source) || source.length > 1200) return;
  if (!force && !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(source)
    && !/[A-Za-z].*\s.*[A-Za-z]/.test(source) && !/^[A-Z][A-Z ]{2,}$/.test(source)) return;
  if (!sources.has(source)) sources.set(source, new Set());
  sources.get(source).add(context);
}
function fragments(value, context) {
  const text = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (/<\/?[a-z][^>]*>/i.test(text)) {
    text.split(/<[^>]+>/g).forEach((part) => add(part, context));
    for (const match of text.matchAll(/(?:aria-label|placeholder|alt|title)="([^"]+)"/g)) add(match[1], context);
  } else add(text, context);
}
Object.entries(inventory.fixedUiJapaneseToEnglish).forEach(([ja, en]) => {
  add(ja, 'legacy-ui-ja', true); add(en, 'legacy-ui-en', true);
});
for (const [language, questions] of Object.entries(inventory.questions)) for (const question of questions) {
  add(question.title, `question:${language}:${question.id}:title`, true);
  add(question.category, `question:${language}:${question.id}:category`, true);
  question.choices.forEach((choice, index) => add(choice, `question:${language}:${question.id}:choice:${index}`, true));
}
for (const [file, page] of Object.entries(inventory.pages)) {
  add(page.title, `${file}:title`, true); add(page.description, `${file}:description`, true);
  page.bodyText.forEach((text) => add(text, `${file}:body`, true));
}
const files = [
  'challenge_game.js', 'live_challenge.js', 'prototype_app.jsx',
  'src/challenge/result.js', 'src/challenge/packs.js', 'src/challenge/insights.js',
  'src/live/age-notice.js', 'src/live/checkout-terms-config.js',
  'src/questions/safety.js', 'src/platform/share.js', 'src/home/start.js',
];
function visit(node, context) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'StringLiteral') fragments(node.value, context);
  if (node.type === 'JSXText') fragments(node.value.replace(/\s+/g, ' '), context);
  if (node.type === 'TemplateLiteral') {
    const text = node.quasis.map((part, index) => (part.value.cooked || part.value.raw) + (index < node.expressions.length ? `{${index}}` : '')).join('');
    fragments(text, context);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => visit(item, context));
    else if (value && typeof value === 'object') visit(value, context);
  }
}
for (const file of files) visit(babelParse(await readFile(new URL(file, root), 'utf8'), file, false), file);
// Templates produced by the legacy Japanese-to-English pattern translator.
[
  'Question {0} of 10', '{0}/10 correct', 'Show {0}/10', '{0}/10 matched',
  '{0} correct', '{0} players', '{0}, you’re in. This screen will update automatically.',
  'Create {0}’s quiz', '{0}’s quiz', 'Guess {0}’s answers', 'How well do you know {0}?',
  'Share {0}’s quiz and review participation and individual responses.',
  '{0}’s “Know Me” quiz is ready!', '{0} challenged you', '{0} answered / limit {1}',
  '{0}’s result image', '{0} scored {2}/10 on {1}’s quiz and earned {3}.',
  '{0}’s {1} understanding result: {2}, title {3}.', 'Choose {0} as your answer',
  'Guess {0}', '{0} answered', '{0} answered / {1} joined / limit {2}',
  '{0} candidate questions were sent for review. They will not appear in the public library unless approved.',
  'Close voting and go to Q{0}', 'Resume from Q{0}/10. This draft is saved only on this device.',
].forEach((text) => add(text, 'legacy-pattern', true));
const entries = [...sources].sort(([a], [b]) => a.localeCompare(b)).map(([source, contexts]) => ({
  id: 'm' + createHash('sha256').update(source).digest('hex').slice(0, 14),
  source, contexts: [...contexts],
}));
await writeFile(new URL('data/translation-corpus.json', root), JSON.stringify({
  schemaVersion: 1, status: 'public-source-only',
  aliases,
  instructions: 'Translate every source. Preserve {N} placeholders, numbers, URLs, product names and identifiers. Do not edit policy meaning. Machine-generated; no native review claim.',
  entries,
}, null, 2) + '\n');
console.log(JSON.stringify({ entries: entries.length, sourceCharacters: entries.reduce((sum, entry) => sum + entry.source.length, 0) }));
