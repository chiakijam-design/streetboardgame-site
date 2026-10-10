export function localizedQuestionCard(card, translate) {
  if (!card || card.sourceKind === 'custom' || card.custom === true || /^CUS/.test(String(card.sourceId || card.id || ''))) return card;
  const copy = { ...card };
  for (const key of ['title', 'text', 'category']) if (typeof card[key] === 'string') copy[key] = translate(card[key]);
  for (const key of ['choices', 'options']) if (Array.isArray(card[key])) copy[key] = card[key].map(translate);
  return copy;
}

// Preserve all copy while choosing word boundaries for scripts that have them.
// The drawing layer fits long lines to its available width; no text is omitted.
export function wrapLocalizedText(text, locale, maxLines) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return [];
  const segments = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(value)].map((part) => part.segment)
    : value.split(/(\s+)/);
  const target = Math.ceil(Array.from(value).length / maxLines);
  const lines = [];
  let line = '';
  for (const segment of segments) {
    if (line.trim() && line.length + segment.length > target && lines.length < maxLines - 1 && segment.trim()) {
      lines.push(line.trim());
      line = '';
    }
    line += segment;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
