export const LIVE_SERIES = Object.freeze({
  name: 'わかってるよね？LIVE',
  shortName: 'LIVE',
  entryLead: '自分で作った問題を、みんなで同時に投票して楽しむライブゲーム',
  manualEntry: '自分で問題を作る',
  youtubeEntry: 'YouTubeチャンネルから作る',
  defaultGameTitle: 'みんなでわかってるよね？LIVE',
  recommendedQuestionCount: '5〜10問程度がおすすめです。1問から好きな数だけ作れます。',
  youtubeGenerateLabel: 'このチャンネルの問題を30問作る',
});

export const LIVE_QUESTION_TYPES = Object.freeze([
  Object.freeze({
    value: 'guess-person',
    label: '本人の答えを当てる',
    predictionLabel: '本人の答え（投票前は非公開）',
  }),
  Object.freeze({
    value: 'guess-majority',
    label: 'みんなの1位を当てる',
    predictionLabel: '作成者の事前予想（開始後は変更不可）',
  }),
  Object.freeze({
    value: 'poll',
    label: '普通のアンケート',
    predictionLabel: '',
  }),
]);

export const LIVE_TYPE_LABELS = Object.freeze(Object.fromEntries(
  LIVE_QUESTION_TYPES.map(({ value, label }) => [value, label]),
));
