export function normalizeChallengeTitle(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function mergeChallengeCards(friendCards, familyCards) {
  const seen = new Set();
  return [...(friendCards || []), ...(familyCards || [])].filter((card) => {
    const key = normalizeChallengeTitle(card && card.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Array.isArray(card.choices) && card.choices.length === 5;
  });
}

export function pickChallengeCards(cards, count = 10, random = Math.random) {
  const pool = (cards || []).slice();
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}
