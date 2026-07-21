export function isCorrectAnswer(answer) {
  if (Array.isArray(answer?.matches)) {
    return answer.matches.some(Boolean);
  }

  return Boolean(answer?.match);
}

export function countPlayerMatches(answers = [], playerIndex = 0) {
  if (!Array.isArray(answers)) return 0;
  return answers.filter((answer) => Boolean(answer?.matches?.[playerIndex])).length;
}

export function createScoreboard(answers = [], players = []) {
  return players.map((player, playerIndex) => ({
    ...player,
    score: countPlayerMatches(answers, playerIndex),
    total: answers.length,
  }));
}

export function countMatches(answers = []) {
  return Array.isArray(answers) ? answers.filter(isCorrectAnswer).length : 0;
}

export function clampScore(score, maximum = 5) {
  const max = Math.max(0, Number(maximum) || 0);
  return Math.max(0, Math.min(max, Number(score) || 0));
}

export function getScoreBand(score) {
  const value = Number(score) || 0;
  if (value >= 4) return 'high';
  if (value >= 2) return 'mid';
  return 'low';
}

export function getScoreLevel(score) {
  const band = getScoreBand(score);
  if (band === 'high') return 'かなり近い波長';
  if (band === 'mid') return '半分シンクロ型';
  return '未知数多めの開拓型';
}

export function getTierByScore(tiers, score, maximum = 5) {
  const safeScore = clampScore(score, maximum);
  return tiers?.[safeScore] || tiers?.[0] || null;
}
