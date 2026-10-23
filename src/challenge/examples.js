export function publicQuestionExamples(cards, english = false) {
  const ids = english ? ['ENF001', 'ENF008'] : ['Q001', 'Q045'];
  return ids.map(id => cards.find(card => card.id === id)).filter(card => card && card.choices?.length === 5);
}
