import { countMatches, getTierByScore } from './scoring.js';
import { createReviewContext } from './review.js';

export function createResultModel({ answers = [], cards = [], tiers = [] } = {}) {
  const score = countMatches(answers);
  return {
    score,
    total: answers.length || 5,
    tier: getTierByScore(tiers, score),
    review: createReviewContext(answers, cards),
  };
}
