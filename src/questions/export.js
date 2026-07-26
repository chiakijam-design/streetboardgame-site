export const QUESTION_BACKUP_HEADERS = [
  '状態',
  '問題ID',
  '問題文',
  '選択肢1',
  '選択肢2',
  '選択肢3',
  '選択肢4',
  '選択肢5',
  'カテゴリ',
  '言語',
  '作成元',
  '元データID',
  '通常版',
  'LIVE版',
  '通報件数',
  '最終通報日時',
  '作成日時',
  '更新日時',
];

export function buildQuestionBackupCsv(questions) {
  const rows = (questions || []).map(questionBackupRow);
  return `\uFEFF${[QUESTION_BACKUP_HEADERS, ...rows].map(csvLine).join('\r\n')}\r\n`;
}

export function questionBackupFilename(date = new Date()) {
  const parts = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ];
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `streetboardgame-questions-${parts.join('-')}_${time}.csv`;
}

export function downloadQuestionBackup(questions, options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const urlRef = options.urlRef || globalThis.URL;
  if (!documentRef || !urlRef?.createObjectURL) throw new Error('question-backup-download-unavailable');

  const csv = buildQuestionBackupCsv(questions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = urlRef.createObjectURL(blob);
  const link = documentRef.createElement('a');
  link.href = objectUrl;
  link.download = questionBackupFilename(options.date || new Date());
  link.hidden = true;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  return { count: (questions || []).length, filename: link.download };
}

function questionBackupRow(question) {
  const choices = Array.from({ length: 5 }, (_, index) => question?.choices?.[index] || '');
  const status = question?.status === 'held' ? 'held' : question?.status === 'disabled' ? 'disabled' : 'approved';
  const approved = status === 'approved';
  return [
    status === 'held' ? '保留' : approved ? '採用' : '無効化',
    question?.id || '',
    question?.title || '',
    ...choices,
    question?.category || 'みんなのお題',
    question?.language === 'en' || String(question?.id || '').startsWith('CUSEN') ? '英語' : '日本語',
    question?.sourceKind === 'custom' ? '採用した自作' : question?.sourceKind === 'candidate' ? '新規候補' : '標準のお題',
    question?.sourceRef || '',
    approved ? '使用' : '停止',
    approved ? '使用' : '停止',
    Number(question?.reportCount || 0),
    isoDate(question?.lastReportedAt),
    isoDate(question?.createdAt),
    isoDate(question?.updatedAt),
  ];
}

function csvLine(values) {
  return values.map(csvCell).join(',');
}

function csvCell(value) {
  const original = String(value ?? '');
  const text = /^\s*[=+\-@]/.test(original) ? `'${original}` : original;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function isoDate(value) {
  if (value == null || value === '') return '';
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function pad(value) {
  return String(value).padStart(2, '0');
}
