export const MAX_QUIZ_QUESTIONS = 10;

export function validQuizLength(count) {
  return Number.isInteger(count) && count >= 1 && count <= MAX_QUIZ_QUESTIONS;
}

// A sparse or unfinished answer must never become a published question.
export function answeredQuestionCount(cards, answers) {
  if (!Array.isArray(cards) || !Array.isArray(answers)) return 0;
  let count = 0;
  while (count < Math.min(cards.length, MAX_QUIZ_QUESTIONS)
    && Number.isInteger(answers[count]) && answers[count] >= 0 && answers[count] < 5) count += 1;
  return count;
}

export function completedCreatorQuiz(cards, answers) {
  const count = answeredQuestionCount(cards, answers);
  return count ? { cards: cards.slice(0, count), answers: answers.slice(0, count) } : null;
}

// 2026-11-22（Gemini 見直し6）：最初の未回答の番号。ただし、その後ろに答えた問題があるときだけ（なければ -1）
export function answerGapBeforeLater(cards, answers) {
  if (!Array.isArray(cards) || !Array.isArray(answers)) return -1;
  const gap = answeredQuestionCount(cards, answers);
  const valid = (value) => Number.isInteger(value) && value >= 0 && value < 5;
  for (let i = gap + 1; i < Math.min(cards.length, MAX_QUIZ_QUESTIONS); i += 1) if (valid(answers[i])) return gap;
  return -1;
}
