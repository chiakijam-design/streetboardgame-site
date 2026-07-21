export function createAnswerDetailModel({ card, target, guesses = [], index = 0 } = {}) {
  return {
    index,
    question: card?.title || '',
    category: card?.category || '',
    target,
    guesses: Array.isArray(guesses) ? guesses : [],
  };
}
