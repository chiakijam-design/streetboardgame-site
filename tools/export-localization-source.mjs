// Export committed public copy only. Never reads D1, .env, credentials or user records.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { TARGET_LOCALES } from '../src/i18n/locales.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const runtime = await read('src/i18n/runtime.js');
const context = vm.createContext({ window: { location: { pathname: '/' } } });
vm.runInContext(runtime.replace(/^export /gm, '') + '\nthis.uiMessages = Object.fromEntries(UI_TEXT);', context);

async function questionLibrary(file, globalName) {
  const scope = vm.createContext({ window: {} });
  vm.runInContext(await read(file), scope);
  return scope.window[globalName];
}

const japanese = await questionLibrary('prototype_common_data.js', 'COMMON_QUESTION_CARDS');
const english = await questionLibrary('prototype_english_common_data.js', 'ENGLISH_COMMON_QUESTION_CARDS');
const htmlFiles = [
  'index.html', 'en/index.html', 'challenge.html', 'live_challenge.html',
  'terms.html', 'en/terms.html', 'privacy.html', 'en/privacy.html', 'legal.html',
  'creator-terms.html', 'refund-policy.html', 'minor-policy.html',
  'content-guidelines.html', 'pricing.html', '404.html',
];
const pages = {};
for (const file of htmlFiles) {
  const html = await read(file);
  pages[file] = {
    title: html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '',
    description: html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] || '',
    // Preserve exact copy. Translation needs a parser/explicit template integration,
    // not blind replacement of arbitrary user-authored DOM nodes.
    bodyText: [...new Set(html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '').split(/<[^>]+>/g)
      .map((text) => text.trim()).filter(Boolean))],
  };
}

const filesToAudit = [
  'challenge_game.js', 'live_challenge.js', 'prototype_app.jsx',
  'src/challenge/result.js', 'src/challenge/packs.js',
  'src/challenge/insights.js', 'src/live/age-notice.js',
  'src/live/checkout-terms-config.js', 'src/questions/safety.js',
];
const remainingSource = {};
for (const file of filesToAudit) {
  // Keep dynamic ${...} placeholders unchanged for the following template pass.
  const matches = [...(await read(file)).matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g)];
  remainingSource[file] = [...new Set(matches.map((match) => match[2])
    .filter((text) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text)))];
}

const output = {
  schemaVersion: 1,
  targetLocales: TARGET_LOCALES,
  status: 'source-inventory-not-translated',
  caveats: [
    'Literal extraction is a starting inventory, not proof of full screen coverage.',
    'UI_TEXT covers existing fixed English translations; regex patterns require explicit templates.',
    'Keep question IDs and choice ordering; Japanese 158 and existing English 60 are distinct legacy libraries.',
    'Do not send personal, invitation, answer, D1 or user-authored text to translation/analytics services.',
    'Native review of translations has not been verified.',
  ],
  fixedUiJapaneseToEnglish: context.uiMessages,
  questions: { japanese, english },
  pages,
  remainingSource,
};
await writeFile(new URL('data/i18n-source-inventory.json', root), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({
  targetLocales: TARGET_LOCALES.length,
  fixedMessages: Object.keys(context.uiMessages).length,
  japaneseQuestions: japanese.length,
  englishQuestions: english.length,
  pages: htmlFiles.length,
  status: output.status,
}));
