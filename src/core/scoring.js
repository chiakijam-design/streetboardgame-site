export function isCorrectAnswer(answer) {
  return Boolean(answer?.match);
}

export function countMatches(answers = []) {
  return Array.isArray(answers) ? answers.filter(isCorrectAnswer).length : 0;
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
