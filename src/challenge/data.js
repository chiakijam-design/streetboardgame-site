export function normalizeChallengeTitle(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function mergeChallengeCards(...cardGroups) {
  const seen = new Set();
  return cardGroups.flatMap((cards) => cards || []).filter((card) => {
    const key = normalizeChallengeTitle(card && card.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Array.isArray(card.choices) && card.choices.length === 5;
  });
}

export function pickChallengeCards(cards, count = 10, random = Math.random) {
  const pool = (cards || []).slice();
  const selected = [];
  const limit = Math.min(Math.max(Number(count) || 0, 0), pool.length);

  while (selected.length < limit) {
    const seenCounts = pool.map((card) => Math.max(0, Number(card?.personalSeenCount) || 0));
    const leastSeenCount = Math.min(...seenCounts);
    const candidateIndexes = seenCounts.flatMap((seenCount, index) => (
      seenCount === leastSeenCount ? [index] : []
    ));
    const weights = candidateIndexes.map((index) => questionSelectionWeight(pool[index]));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = Math.max(0, Math.min(Number(random()) || 0, 0.9999999999999999)) * totalWeight;
    let candidateIndex = weights.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      cursor -= weights[index];
      if (cursor < 0) {
        candidateIndex = index;
        break;
      }
    }
    const selectedIndex = candidateIndexes[candidateIndex];
    selected.push(pool.splice(selectedIndex, 1)[0]);
  }
  return selected;
}

export function questionSkipRate(card) {
  const shownCount = Math.max(0, Number(card?.selectionShownCount) || 0);
  const skipCount = Math.min(shownCount, Math.max(0, Number(card?.selectionSkipCount) || 0));
  return (skipCount + 1) / (shownCount + 4);
}

export function questionSelectionWeight(card) {
  const completionRate = 1 - questionSkipRate(card);
  return Math.max(0.15, completionRate ** 2);
}
