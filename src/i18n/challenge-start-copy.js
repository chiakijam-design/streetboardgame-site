// Game-only instructions: changing a quiz length must not rebuild home/legal copy.
const PREVIOUS_INTRO = '当てるより、話すための10問。先に自分が回答し、できたURLを送ると最大50人が挑戦できます。';
const PREVIOUS_STEP = 'あなたが10問に回答';

export function challengeStartCopy(locale, translate) {
  if (locale === 'ja') return {
    intro: '当てるより、話すためのクイズ。1〜10問で作成し、できたURLを送ると最大50人が挑戦できます。',
    step: 'あなたが1〜10問に回答',
  };
  if (locale === 'en') return {
    intro: 'A quiz made for conversation. Create 1–10 questions, then share the link so up to 50 friends can play.',
    step: 'Answer 1–10 questions',
  };
  // Keep each existing complete translated sentence; replace only its length.
  const withRange = (source) => translate(source).replace(/(?<!\d)10(?!\d)/g, '1–10');
  return { intro: withRange(PREVIOUS_INTRO), step: withRange(PREVIOUS_STEP) };
}
