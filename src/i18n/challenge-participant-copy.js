// Participant answer screen: one line naming whose answers are being guessed.
// {name} is the creator's display name and is inserted with textContent, never as HTML.
// Machine translated; native-language review remains unverified, as for existing catalogs.
const rows = `ja|{name}さんの答えは？
en|What did {name} answer?
es|¿Qué respondió {name}?
fr|Qu'a répondu {name} ?
de|Was hat {name} geantwortet?
it|Cosa ha risposto {name}?
pt|O que {name} respondeu?
ru|Что ответил(а) {name}?
uk|Що відповів(-ла) {name}?
pl|Co odpowiedział(a) {name}?
nl|Wat antwoordde {name}?
sv|Vad svarade {name}?
da|Hvad svarede {name}?
no|Hva svarte {name}?
fi|Mitä {name} vastasi?
cs|Co odpověděl(a) {name}?
el|Τι απάντησε {name};
ro|Ce a răspuns {name}?
hu|Mit válaszolt {name}?
bg|Какво отговори {name}?
hr|Što je {name} odgovorio/la?
sk|Čo odpovedal(a) {name}?
tr|{name} ne cevap verdi?
ar|ماذا أجاب {name}؟
he|מה {name} ענה/ענתה?
hi|{name} का जवाब क्या है?
bn|{name}-এর উত্তর কী?
id|Apa jawaban {name}?
ms|Apakah jawapan {name}?
th|{name} ตอบว่าอะไร?
vi|{name} đã trả lời gì?
ko|{name}님의 답은?
zh-Hans|{name}的答案是？
zh-Hant|{name}的答案是？`;
export const PARTICIPANT_ANSWER_OWNER_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map((row) => {
  const [locale, text] = row.split('|');
  if (!text || !text.includes('{name}')) throw Error('Missing participant answer owner copy ' + locale);
  return [locale, text];
})));
export function participantAnswerOwnerText(locale, name) {
  const template = PARTICIPANT_ANSWER_OWNER_COPY[locale] || PARTICIPANT_ANSWER_OWNER_COPY.en;
  return template.replace('{name}', () => String(name ?? ''));
}
