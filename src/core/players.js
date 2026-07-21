export const PLAYER_NAME_MAX_LENGTH = 6;

export const DEFAULT_PLAYER_NAMES = Object.freeze({
  love: Object.freeze(['彼女', '彼氏']),
  friend: Object.freeze(['本人', '友達A', '友達B', '友達C']),
  family: Object.freeze(['本人', '家族A', '家族B', '家族C']),
});

export function sanitizePlayerName(value, fallback, allowEmpty = false) {
  const text = String(value ?? '').replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX_LENGTH);
  const trimmed = text.trim();
  if (allowEmpty) return text;
  return (trimmed || fallback).slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function normalizePlayerNames(value = {}, allowEmpty = false) {
  const result = {};
  Object.keys(DEFAULT_PLAYER_NAMES).forEach((kind) => {
    const defaults = DEFAULT_PLAYER_NAMES[kind];
    const source = Array.isArray(value[kind]) ? value[kind] : [];
    result[kind] = defaults.map((fallback, index) => (
      sanitizePlayerName(source[index], fallback, allowEmpty)
    ));
  });
  return result;
}

export function normalizePlayerCount(value) {
  const count = Number(value);
  return [2, 3, 4].includes(count) ? count : 2;
}

export function getTargetPlayerOrder(playerCount, targetIndex = 0) {
  const count = normalizePlayerCount(playerCount);
  const parsedTarget = Number(targetIndex);
  const safeTarget = Number.isInteger(parsedTarget) && parsedTarget >= 0 && parsedTarget < count
    ? parsedTarget
    : 0;
  return [safeTarget, ...Array.from({ length: count }, (_, index) => index)
    .filter((index) => index !== safeTarget)];
}

export function getPlayersWithTarget(kind, playerCount, names, targetIndex = 0) {
  const normalized = normalizePlayerNames(names);
  const list = normalized[kind] || DEFAULT_PLAYER_NAMES[kind] || [];
  const orderedIndexes = getTargetPlayerOrder(playerCount, targetIndex);
  const safeTarget = orderedIndexes[0];
  return orderedIndexes.map((index) => ({
    index,
    name: list[index],
    isTarget: index === safeTarget,
  }));
}
