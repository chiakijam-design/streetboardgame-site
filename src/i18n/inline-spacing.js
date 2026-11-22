// 2026-11-22（Gemini 見直し4）：日本語は文の途中のリンクの前後に空白を入れないが、訳した言語では
// 「See our」「Privacy Policy」「for details.」がくっついて表示されていた。空白で語を区切る言語だけ、リンクの前後に空白を入れる。
const NO_SPACE_LOCALES = new Set(['ja', 'zh-Hans', 'zh-Hant', 'th']);
export function usesWordSpaces(locale) { return !NO_SPACE_LOCALES.has(locale); }

// 前もって作る HTML 用：<a> の前後で、文字と文字がくっついているところにだけ空白を入れる（script・style・コメントは触らない）
export function spaceAroundLinks(html, locale) {
  if (!usesWordSpaces(locale)) return html;
  return html.replace(/(<script\b[\s\S]*?<\/script\b[^>]*>|<style\b[\s\S]*?<\/style\b[^>]*>|<!--[\s\S]*?--!?>)|([\p{L}\p{N},;:])(<a\b)|(<\/a\s*>)([\p{L}\p{N}(])/giu,
    (whole, protectedBlock, before, open, close, after) => {
      if (protectedBlock) return protectedBlock;
      if (open) return before + ' ' + open;
      return close + ' ' + after;
    });
}

// 画面で訳すとき用：訳した文字の隣がリンクなら、くっつかないように空白を足す
export function spaceTextNextToLinks(node, text, locale) {
  if (!usesWordSpaces(locale) || !text) return text;
  let out = text;
  const next = node.nextSibling, previous = node.previousSibling;
  if (next && next.nodeType === 1 && next.tagName === 'A' && /[\p{L}\p{N},;:]$/u.test(out)) out += ' ';
  if (previous && previous.nodeType === 1 && previous.tagName === 'A' && /^[\p{L}\p{N}(]/u.test(out)) out = ' ' + out;
  return out;
}
