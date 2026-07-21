export function shuffle(items, random = Math.random) {
  const result = Array.isArray(items) ? items.slice() : [];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function pickRandomItems(items, count, random = Math.random) {
  const size = Math.max(0, Number(count) || 0);
  return shuffle(items, random).slice(0, size);
}
