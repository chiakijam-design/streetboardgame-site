// Pure catalog formatting shared by server-rendered HTML, client UI and PNG copy.
// User answers and names are interpolation values, never translation input.
export function formatTranslation(template, values = []) {
  return String(template).replace(/\{(\d+)\}/g, (token, index) => (
    Number(index) < values.length ? String(values[Number(index)] ?? '') : token
  ));
}

export function placeholderIndexes(value) {
  return [...new Set([...String(value).matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);
}

export function validateCatalog(sourceEntries, translations) {
  const missing = [];
  const invalidPlaceholders = [];
  const unknown = [];
  const sources = new Map(sourceEntries.map((entry) => [entry.id, entry.source]));
  for (const [id, source] of sources) {
    const value = translations[id];
    if (typeof value !== 'string' || !value.trim()) missing.push(id);
    else if (placeholderIndexes(source).join(',') !== placeholderIndexes(value).join(',')) {
      invalidPlaceholders.push(id);
    }
  }
  for (const id of Object.keys(translations)) if (!sources.has(id)) unknown.push(id);
  return { complete: !missing.length && !invalidPlaceholders.length && !unknown.length, missing, invalidPlaceholders, unknown };
}

export function createCatalogTranslator(sourceEntries, translations, { protectedText = [], aliases = {} } = {}) {
  const protectedValues = new Set(protectedText.filter((value) => value != null).map(String));
  const bySource = new Map(sourceEntries.map((entry) => [entry.source.trim(), translations[entry.id]]));
  // Japanese fixed labels can retain their existing English pivot without
  // changing stored question IDs, invitation capabilities or answer snapshots.
  for (const [source, pivot] of Object.entries(aliases)) {
    if (bySource.has(String(pivot).trim())) bySource.set(source.trim(), bySource.get(String(pivot).trim()));
  }
  const templates = sourceEntries.filter((entry) => placeholderIndexes(entry.source).length).map((entry) => {
    const captures = [];
    let pattern = '';
    let cursor = 0;
    for (const match of entry.source.matchAll(/\{(\d+)\}/g)) {
      pattern += escapeRegex(entry.source.slice(cursor, match.index)) + '([\\s\\S]*?)';
      captures.push(Number(match[1]));
      cursor = match.index + match[0].length;
    }
    pattern += escapeRegex(entry.source.slice(cursor));
    return { regex: new RegExp('^' + pattern + '$'), captures, translated: translations[entry.id] };
  });

  function translate(value) {
    const raw = String(value ?? '');
    const text = raw.trim();
    if (!text || protectedValues.has(text)) return raw;
    let translated = bySource.get(text);
    if (typeof translated !== 'string' || !translated.trim()) {
      for (const template of templates) {
        if (typeof template.translated !== 'string' || !template.translated.trim()) continue;
        const match = text.match(template.regex);
        if (!match) continue;
        const values = [];
        template.captures.forEach((index, position) => { values[index] = match[position + 1]; });
        translated = formatTranslation(template.translated, values);
        break;
      }
    }
    if (typeof translated !== 'string' || !translated.trim()) return raw;
    const offset = raw.indexOf(text);
    return raw.slice(0, offset) + translated + raw.slice(offset + text.length);
  }

  return { translate, isProtected: (value) => protectedValues.has(String(value).trim()),
    protect: (values) => values.forEach((value) => protectedValues.add(String(value).trim())) };
}

// Release callers must use this gate before serving a translated locale. An
// incomplete draft is useful for authoring but must never become a public route.
export function requireCompleteCatalog(sourceEntries, catalog, expectedLocale) {
  if (catalog?.locale !== expectedLocale) throw new Error('Catalog locale mismatch');
  if (catalog?.provenance?.method !== 'machine-generated' || typeof catalog.provenance.nativeReview !== 'boolean') {
    throw new Error('Catalog translation provenance missing');
  }
  const report = validateCatalog(sourceEntries, catalog.messages || {});
  if (!report.complete) {
    throw new Error(`Incomplete ${expectedLocale} catalog: ${report.missing.length} missing, ${report.invalidPlaceholders.length} placeholder errors, ${report.unknown.length} unknown entries`);
  }
  return catalog;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
