export const LIVE_SERIES = Object.freeze({
  name: 'YouTuber向け 私のこと、ちゃんとわかってるよね？LIVE',
  shortName: 'LIVE',
  entryLead: 'YouTubeチャンネルの公開動画から問題を作り、視聴者と同時投票で楽しむライブゲーム',
  youtubeEntry: 'YouTubeチャンネルから問題を作る',
  defaultGameTitle: 'YouTuber向け 私のこと、ちゃんとわかってるよね？LIVE',
  youtubePersonGenerateLabel: 'YouTuberの答えを視聴者が予想する（30問生成し、採用する問題を選ぶ）',
  youtubeMajorityGenerateLabel: 'YouTuberが視聴者投票の1位を予想する（30問生成し、採用する問題を選ぶ）',
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
