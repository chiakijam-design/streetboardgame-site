import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ignoreText = await readFile(new URL('../../.assetsignore', import.meta.url), 'utf8');
const ignored = new Set(ignoreText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#')));

test('開発・運用・DBファイルを静的アセットとして公開しない', () => {
  const requiredPatterns = [
    '_worker.js',
    'src/',
    'tests/',
    'docs/',
    'tools/',
    'migrations/',
    'migrations-purchases/',
    'data/',
    '_headers',
    '_redirects',
    'wrangler.jsonc',
    'package*.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'playwright.config.*',
    'capacitor.config.*',
    '*.md',
    '*.mjs',
    '*.jsx',
    '*.py',
    '*.sql',
    '*.toml',
    '*.yaml',
    '*.yml',
  ];

  for (const pattern of requiredPatterns) {
    assert.equal(ignored.has(pattern), true, `${pattern} must stay excluded from public assets`);
  }
});

test('本番ページが使う公開形式を一括除外しない', () => {
  for (const pattern of ['dist/', 'assets/', 'en/', '*.html', '*.css', '*.js', '*.webmanifest', '*.xml']) {
    assert.equal(ignored.has(pattern), false, `${pattern} would block required public assets`);
  }
});
