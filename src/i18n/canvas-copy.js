// Translate labels at drawing time, leaving user values in local memory.
export function localizedCanvasContext(context, translate, direction = 'ltr') {
  if (!context) return context;
  context.direction = direction;
  return new Proxy(context, {
    get(target, key) {
      if (key === 'measureText') return (text) => target.measureText(translate(text));
      if (key === 'fillText') return (text, x, y, maxWidth) => {
        const translated = translate(text);
        const width = maxWidth ?? (target.textAlign === 'center'
          ? 2 * Math.min(x, target.canvas.width - x) - 24
          : target.textAlign === 'right' ? x - 24 : target.canvas.width - x - 24);
        target.fillText(translated, x, y, Math.max(1, width));
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) { Reflect.set(target, key, value, target); return true; },
  });
}

export function collectProtectedUserCopy(state, sourceCards = []) {
  const values = [];
  const seen = new WeakSet();
  const sourceById = new Map(sourceCards.map((card) => [String(card.id), card]));
  function visit(value, inChat = false) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const custom = value.sourceKind === 'custom' || value.custom === true || /^(?:CUS|custom-)/.test(String(value.sourceId || value.id || ''));
    const source = sourceById.get(String(value.sourceId || value.id || ''));
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && (/^(?:name|creatorName|participantName|hostName|subjectName|viewerName|playerName|displayName)$/.test(key)
        || inChat && /^(?:text|message|body|content)$/.test(key) || custom && ['title', 'text'].includes(key))) values.push(item);
      if (custom && ['choices', 'options'].includes(key) && Array.isArray(item)) values.push(...item.filter((choice) => typeof choice === 'string'));
      if (source && ['title', 'text'].includes(key) && typeof item === 'string' && item !== source.title) values.push(item);
      if (source && ['choices', 'options'].includes(key) && Array.isArray(item)) values.push(...item.filter((choice, index) => typeof choice === 'string' && choice !== source.choices?.[index]));
      visit(item, inChat || /chat|messages/i.test(key));
    }
  }
  visit(state);
  return values;
}
