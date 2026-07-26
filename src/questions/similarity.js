const JAPANESE_COLLATOR = new Intl.Collator('ja', {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true,
});

export function sortQuestionsForOperations(items) {
  return [...(items || [])].sort((left, right) => {
    const statusOrder = statusRank(left?.status) - statusRank(right?.status);
    if (statusOrder) return statusOrder;
    const titleOrder = JAPANESE_COLLATOR.compare(String(left?.title || ''), String(right?.title || ''));
    if (titleOrder) return titleOrder;
    return JAPANESE_COLLATOR.compare(String(left?.id || ''), String(right?.id || ''));
  });
}

export function findSimilarQuestions(items, threshold = 0.58) {
  const questions = (items || []).filter(isCompleteQuestion);
  const matches = new Map(questions.map((item) => [String(item.id), []]));

  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      const left = questions[leftIndex];
      const right = questions[rightIndex];
      const score = questionSimilarity(left, right);
      if (score < threshold) continue;
      matches.get(String(left.id)).push(compactMatch(right, score));
      matches.get(String(right.id)).push(compactMatch(left, score));
    }
  }

  for (const candidates of matches.values()) {
    candidates.sort((left, right) => right.score - left.score || JAPANESE_COLLATOR.compare(left.title, right.title));
  }
  return matches;
}

export function questionSimilarity(left, right) {
  const leftTitle = normalizeText(left?.title);
  const rightTitle = normalizeText(right?.title);
  if (!leftTitle || !rightTitle) return 0;

  const titleScore = leftTitle === rightTitle
    ? 1
    : containsMeaningfulText(leftTitle, rightTitle)
      ? 0.9
      : diceCoefficient(leftTitle, rightTitle);
  const choiceScore = choiceSimilarity(left?.choices, right?.choices);
  const exactChoices = normalizedChoices(left?.choices).join('|') === normalizedChoices(right?.choices).join('|');
  if (exactChoices && titleScore >= 0.35) return Math.max(0.82, titleScore);
  return roundScore(titleScore * 0.72 + choiceScore * 0.28);
}

function choiceSimilarity(leftChoices, rightChoices) {
  const left = normalizedChoices(leftChoices);
  const right = normalizedChoices(rightChoices);
  if (left.length !== 5 || right.length !== 5) return 0;
  const scores = left.map((choice) => Math.max(...right.map((candidate) => (
    choice === candidate ? 1 : diceCoefficient(choice, candidate)
  ))));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function normalizedChoices(choices) {
  return Array.isArray(choices) ? choices.map(normalizeText).filter(Boolean) : [];
}

function diceCoefficient(left, right) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const leftBigrams = bigramCounts(left);
  const rightBigrams = bigramCounts(right);
  let overlap = 0;
  for (const [bigram, leftCount] of leftBigrams) {
    overlap += Math.min(leftCount, rightBigrams.get(bigram) || 0);
  }
  return (2 * overlap) / ((left.length - 1) + (right.length - 1));
}

function bigramCounts(value) {
  const counts = new Map();
  for (let index = 0; index < value.length - 1; index += 1) {
    const bigram = value.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) || 0) + 1);
  }
  return counts;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ja')
    .replace(/[、。・！？!?「」『』（）()【】［］\[\]\s"'’‘“”ー〜～….,/\\:：;；]/g, '');
}

function containsMeaningfulText(left, right) {
  return Math.min(left.length, right.length) >= 6 && (left.includes(right) || right.includes(left));
}

function compactMatch(item, score) {
  return {
    id: String(item.id),
    title: String(item.title || ''),
    choices: Array.isArray(item.choices) ? item.choices.slice(0, 5) : [],
    score: roundScore(score),
  };
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}

function statusRank(status) {
  return status === 'disabled' ? 1 : 0;
}

function isCompleteQuestion(item) {
  return item && item.id && item.title && Array.isArray(item.choices) && item.choices.length === 5;
}
