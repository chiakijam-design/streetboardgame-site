import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , sourcePath, outputPath] = process.argv;
if (!sourcePath || !outputPath) {
  throw new Error('usage: node tools/generate-held-question-migration.mjs <candidates.json|candidate-builder.mjs> <migration.sql>');
}

const source = await readFile(path.resolve(sourcePath), 'utf8');
const rows = sourcePath.toLowerCase().endsWith('.json')
  ? readJsonCandidates(source)
  : readLegacyCandidates(source);
validateRows(rows);

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

function readJsonCandidates(sourceText) {
  const parsed = JSON.parse(sourceText);
  return Array.isArray(parsed) ? parsed : parsed.candidates;
}

function readLegacyCandidates(sourceText) {
  const rawBlock = sourceText.match(/const raw = \[\s*([\s\S]*?)\s*\];\s*\n\s*const groupNames/);
  if (!rawBlock) throw new Error('candidate raw block not found');

  const lines = [...rawBlock[1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)]
    .map((match) => JSON.parse(`"${match[1]}"`));
  const currentTheme = new Map();
  return lines.map((line, index) => {
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
    return {
      id: `HLD${String(index + 1).padStart(3, '0')}`,
      sourceRef: `${group}-${String(index + 1).padStart(3, '0')}`,
      title,
      category: theme || 'みんなのお題',
      choices: parts,
    };
  });
}

function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 100) {
    throw new Error(`expected 100 candidates, received ${rows?.length ?? 0}`);
  }
  const ids = new Set();
  const sourceRefs = new Set();
  for (const [index, row] of rows.entries()) {
    if (!/^HLD\d{3}$/.test(String(row.id || ''))) {
      throw new Error(`candidate ${index + 1} has an invalid id`);
    }
    if (ids.has(row.id)) throw new Error(`duplicate candidate id: ${row.id}`);
    if (!row.sourceRef || sourceRefs.has(row.sourceRef)) {
      throw new Error(`duplicate or missing source reference: ${row.sourceRef || index + 1}`);
    }
    if (!row.title?.trim() || !row.category?.trim()) {
      throw new Error(`candidate ${row.id} is missing a title or category`);
    }
    if (!Array.isArray(row.choices) || row.choices.length !== 5) {
      throw new Error(`candidate ${row.id} does not have five choices`);
    }
    if (new Set(row.choices.map((choice) => String(choice).trim())).size !== 5) {
      throw new Error(`candidate ${row.id} has duplicate choices`);
    }
    ids.add(row.id);
    sourceRefs.add(row.sourceRef);
  }
}
