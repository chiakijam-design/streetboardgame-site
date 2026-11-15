// Build-time helpers for the per-page browser translation catalogs
// (tools/build-public-locale-pages.mjs, 2026-11-15).

// esbuild writes non-ASCII text as \uXXXX / \u{...} escapes in bundles.
export function unescapeScriptText(text) {
  return String(text)
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Keep an entry when every literal part of its source (split at {0}-style
// placeholders, ignoring parts shorter than 2 characters) occurs in the text
// the page can render in the browser. Entries without such parts are kept.
export function runtimeCatalogEntries(entries, text) {
  return entries.filter(({ source }) => {
    const parts = String(source).split(/\{\d+\}/).filter((part) => part.trim().length >= 2);
    return !parts.length || parts.every((part) => text.includes(part));
  });
}
