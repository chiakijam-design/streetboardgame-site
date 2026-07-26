import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , sourcePath, outputPath] = process.argv;
if (!sourcePath || !outputPath) {
  throw new Error('usage: node tools/generate-held-question-migration.mjs <candidate-builder.mjs> <migration.sql>');
}

const source = await readFile(path.resolve(sourcePath), 'utf8');
const rawBlock = source.match(/const raw = \[\s*([\s\S]*?)\s*\];\s*\n\s*const groupNames/);
if (!rawBlock) throw new Error('candidate raw block not found');

const lines = [...rawBlock[1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)]
  .map((match) => JSON.parse(`"${match[1]}"`));
if (lines.length !== 100) throw new Error(`expected 100 candidates, received ${lines.length}`);

const currentTheme = new Map();
const rows = lines.map((line, index) => {
  const parts = line.split('|');
  const group = parts.shift();
  const sourceName = parts.shift();
  const sourceKey = `${group}:${sourceName}`;
  let theme = currentTheme.get(sourceKey);
  if (parts.length === 7) {
    theme = parts.shift();
    currentTheme.set(sourceKey, theme);
  }
  const title = parts.shift();
  if (parts.length !== 5) throw new Error(`candidate ${index + 1} does not have five choices`);
  return {
    id: `HLD${String(index + 1).padStart(3, '0')}`,
    sourceRef: `${group}-${String(index + 1).padStart(3, '0')}`,
    title,
    category: theme || 'みんなのお題',
    choices: parts,
  };
});

const sql = [
  '-- New 100-question candidates are intentionally hidden until an operator approves them.',
  '-- Source references and editorial rationale are documented in the candidate workbook.',
  'INSERT OR IGNORE INTO question_catalog',
  '  (question_id, source_kind, source_ref, title, category, choices_json, status,',
  '   use_challenge, use_live, created_at, updated_at)',
  'VALUES',
  rows.map((row) => `  (${[
    row.id,
    'candidate',
    row.sourceRef,
    row.title,
    row.category,
    JSON.stringify(row.choices),
    'held',
  ].map(sqlText).join(', ')}, 0, 0, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000)`).join(',\n'),
  ';',
  '',
].join('\n');

await writeFile(path.resolve(outputPath), sql, 'utf8');

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
