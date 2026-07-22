export const LIVE_SERIES = Object.freeze({
  name: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE',
  shortName: 'LIVE',
  entryLead: 'スタッフがYouTubeチャンネルから企画を作り、配信中に本人と視聴者が回答するライブゲーム',
  youtubeEntry: 'YouTubeチャンネルから問題を作る',
  defaultGameTitle: 'Youtuber専用　私のこと、ちゃんと分かってるよねLIVE',
  youtubePersonGenerateLabel: 'YouTuberの答えを視聴者が予想する（30問生成し、採用する問題を選ぶ）',
  youtubeMajorityGenerateLabel: 'YouTuberが視聴者投票の1位を予想する（30問生成し、採用する問題を選ぶ）',
});

// Durable Objects分散時の設計上限。バインディングがない環境は50人へ縮退する。
// 本番で案内する上限は段階負荷試験とCloudflareメトリクスの確認後に決める。
export const LIVE_VIEWER_LIMIT = 10_000;
export const LIVE_FALLBACK_VIEWER_LIMIT = 50;
export const LIVE_REALTIME_SHARD_COUNT = 32;
export const LIVE_REALTIME_SHARD_CAPACITY = 400;
export const LIVE_POLL_INTERVAL_MS = 3_000;
export const LIVE_RESERVATION_BUFFER_HOURS = 20;
export const LIVE_RESERVATION_MAX_DAYS = 365;

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

export const LIVE_RESULT_IMAGE_PRICES = Object.freeze([500, 1000, 3000]);
export const LIVE_SUPPORT_AMOUNTS = Object.freeze([200, 500, 1000, 3000]);
