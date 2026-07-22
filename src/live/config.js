export const LIVE_SERIES = Object.freeze({
  name: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE',
  shortName: 'LIVE',
  entryLead: 'スタッフがYouTubeチャンネルから企画を作り、配信中に本人と視聴者が回答するライブゲーム',
  youtubeEntry: 'YouTubeチャンネルから問題を作る',
  defaultGameTitle: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE',
  youtubePersonGenerateLabel: 'YouTuberの答えを視聴者が予想する（30問生成し、採用する問題を選ぶ）',
  youtubeMajorityGenerateLabel: 'YouTuberが視聴者投票の1位を予想する（30問生成し、採用する問題を選ぶ）',
});

// 現在のD1ポーリング構成で安全側に倒した初期上限。
// 実負荷試験と本番メトリクスを確認するまでは引き上げない。
export const LIVE_VIEWER_LIMIT = 50;
export const LIVE_RESERVATION_BUFFER_HOURS = 20;
export const LIVE_RESERVATION_MAX_DAYS = 365;
export const LIVE_CREATOR_IMAGE_MAX_LENGTH = 450_000;

export const LIVE_QUESTION_TYPES = Object.freeze([
  Object.freeze({
    value: 'guess-person',
    label: '本人の答えを当てる',
    predictionLabel: '本人の答え（ライブ中に回答）',
  }),
  Object.freeze({
    value: 'guess-majority',
    label: 'みんなの1位を当てる',
    predictionLabel: 'YouTuberの予想（ライブ中に回答）',
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

export const LIVE_REVENUE_POLICY = Object.freeze({
  creatorShareBps: 7000,
  cardProcessingFeeReferenceBps: 360,
  platformApplicationFeeBps: 3000,
  platformNetReferenceBps: 2640,
});
