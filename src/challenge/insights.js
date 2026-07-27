function compareDescending(left, right, selector) {
  return selector(right) - selector(left);
}

function firstBy(stats, compare) {
  return stats.slice().sort((left, right) => compare(left, right) || left.index - right.index)[0] || null;
}

export function buildQuestionConversationInsights(cards = [], participants = []) {
  const completedParticipants = participants.filter((participant) => (
    participant?.submitted
    && Array.isArray(participant.answers)
    && participant.answers.length > 0
  ));

  const questions = cards.map((card, index) => {
    const choiceCount = Array.isArray(card?.choices) ? card.choices.length : 0;
    const counts = Array(choiceCount).fill(0);
    let correctIndex = null;

    for (const participant of completedParticipants) {
      const answer = participant.answers[index];
      const selected = Number(answer?.selected);
      const correct = Number(answer?.correct);
      if (Number.isInteger(correct) && correct >= 0 && correct < choiceCount) correctIndex = correct;
      if (Number.isInteger(selected) && selected >= 0 && selected < choiceCount) counts[selected] += 1;
    }

    const total = counts.reduce((sum, count) => sum + count, 0);
    const correctCount = Number.isInteger(correctIndex) ? counts[correctIndex] : 0;
    const wrongCount = Math.max(0, total - correctCount);
    const activeChoiceCount = counts.filter((count) => count > 0).length;
    const topCount = counts.length ? Math.max(...counts) : 0;
    const diversity = total > 1
      ? 1 - counts.reduce((sum, count) => sum + ((count / total) ** 2), 0)
      : 0;
    let unexpectedChoiceIndex = null;
    let unexpectedCount = 0;
    counts.forEach((count, choiceIndex) => {
      if (choiceIndex !== correctIndex && count > unexpectedCount) {
        unexpectedChoiceIndex = choiceIndex;
        unexpectedCount = count;
      }
    });

    return {
      index,
      card,
      counts,
      total,
      correctIndex,
      correctCount,
      wrongCount,
      correctRate: total ? correctCount / total : 0,
      activeChoiceCount,
      topCount,
      diversity,
      unexpectedChoiceIndex,
      unexpectedCount,
      unexpectedRate: total ? unexpectedCount / total : 0,
    };
  });

  const answeredQuestions = questions.filter((question) => question.total > 0);
  const splitQuestion = completedParticipants.length >= 2
    ? firstBy(
      answeredQuestions.filter((question) => question.activeChoiceCount >= 2),
      (left, right) => (
        compareDescending(left, right, (question) => question.diversity)
        || compareDescending(left, right, (question) => question.activeChoiceCount)
        || compareDescending(left, right, (question) => question.wrongCount)
      ),
    )
    : null;
  const leastCorrectQuestion = completedParticipants.length >= 2
    ? firstBy(answeredQuestions, (left, right) => (
      left.correctRate - right.correctRate
      || compareDescending(left, right, (question) => question.wrongCount)
    ))
    : null;
  const surprisingQuestion = completedParticipants.length >= 2
    ? firstBy(
      answeredQuestions.filter((question) => question.unexpectedCount > 0),
      (left, right) => (
        compareDescending(left, right, (question) => question.unexpectedRate)
        || compareDescending(left, right, (question) => question.unexpectedCount)
        || compareDescending(left, right, (question) => question.wrongCount)
      ),
    )
    : null;

  return {
    completedCount: completedParticipants.length,
    questions,
    highlights: {
      split: splitQuestion,
      leastCorrect: leastCorrectQuestion,
      surprising: surprisingQuestion,
    },
  };
}
