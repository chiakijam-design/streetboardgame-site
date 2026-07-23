const SHARE_VERSION = 1;
const SHARE_KEY = 'result';
const MAX_TOKEN_LENGTH = 2048;
const MAX_PLAYER_NAME_LENGTH = 6;
const BOARDGAME_CARD_ID_PATTERN = /^BG\d{3}$/;

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const base64 = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isColorIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 4;
}

function normalizeSharePlayerName(value) {
  const normalized = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return Array.from(normalized).slice(0, MAX_PLAYER_NAME_LENGTH).join('');
}

export function createBoardgameResultShareHash({ answers, cards, players }) {
  const normalizedPlayers = Array.isArray(players)
    ? players.slice(0, 4).map(normalizeSharePlayerName)
    : [];
  if (normalizedPlayers.length < 2 || normalizedPlayers.some((name) => !name)) return '';

  const normalizedCards = Array.isArray(cards)
    ? cards.slice(0, 5).map((card) => String(card?.id || ''))
    : [];
  if (
    normalizedCards.length < 1
    || normalizedCards.some((id) => !BOARDGAME_CARD_ID_PATTERN.test(id))
    || new Set(normalizedCards).size !== normalizedCards.length
  ) return '';

  const normalizedAnswers = Array.isArray(answers)
    ? answers.slice(0, normalizedCards.length).map((answer) => [
      answer?.target,
      ...(Array.isArray(answer?.guesses)
        ? answer.guesses.slice(0, normalizedPlayers.length - 1)
        : []),
    ])
    : [];
  if (
    normalizedAnswers.length !== normalizedCards.length
    || normalizedAnswers.some((row) => (
      row.length !== normalizedPlayers.length || row.some((value) => !isColorIndex(value))
    ))
  ) return '';

  const token = encodeBase64Url(JSON.stringify({
    v: SHARE_VERSION,
    p: normalizedPlayers,
    c: normalizedCards,
    a: normalizedAnswers,
  }));
  return `#${SHARE_KEY}=${token}`;
}

export function parseBoardgameResultShareHash(hash, availableCards) {
  try {
    const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const token = params.get(SHARE_KEY) || '';
    if (
      !token
      || token.length > MAX_TOKEN_LENGTH
      || !/^[A-Za-z0-9_-]+$/.test(token)
    ) return null;

    const payload = JSON.parse(decodeBase64Url(token));
    if (payload?.v !== SHARE_VERSION) return null;

    const players = Array.isArray(payload.p)
      ? payload.p.slice(0, 4).map(normalizeSharePlayerName)
      : [];
    if (players.length < 2 || players.some((name) => !name)) return null;

    const cardLookup = new Map(
      (Array.isArray(availableCards) ? availableCards : [])
        .map((card) => [String(card?.id || ''), card])
    );
    const cardIds = Array.isArray(payload.c) ? payload.c : [];
    if (
      cardIds.length < 1
      || cardIds.length > 5
      || cardIds.some((id) => !BOARDGAME_CARD_ID_PATTERN.test(String(id)))
      || new Set(cardIds).size !== cardIds.length
    ) return null;
    const cards = cardIds.map((id) => cardLookup.get(String(id)));
    if (cards.some((card) => !card)) return null;

    const rows = Array.isArray(payload.a) ? payload.a : [];
    if (
      rows.length !== cards.length
      || rows.some((row) => (
        !Array.isArray(row)
        || row.length !== players.length
        || row.some((value) => !isColorIndex(value))
      ))
    ) return null;

    const answers = rows.map(([target, ...guesses]) => ({
      target,
      guesses,
      matches: guesses.map((guess) => guess === target),
    }));
    return {
      answers,
      cards,
      playerCount: players.length,
      players,
    };
  } catch {
    return null;
  }
}
