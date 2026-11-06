// Reviewed 2026-11-06: Wata account sharing and this stream's enhanced
// measurement are OFF. Direct, non-advertising, purpose-limited Japan scope.
// Evidence and limitations: docs/REGIONAL_PV_POLICY.md. No other region cleared.
export const JP_GA4_REVIEW = Object.freeze({ accountSharingRestricted:true, advertisingBlocked:true, automaticEventsControlled:true, disclosureReady:true });
export function japanGA4Mode(cf,review=JP_GA4_REVIEW){return cf?.country==='JP' && Object.keys(JP_GA4_REVIEW).every(k=>review?.[k]===true) ? 'jp-basic' : 'off';}
export const JP_BASIC_DESCRIPTION={
 ja:'日本から日本語・英語ページに接続する場合に限り、Google Analytics 4（Google LLC）で公開ページの閲覧とクイズの開始・回答受理・結果表示・共有操作を集計します。Cookieの識別子、参照元ドメイン、端末・ブラウザ情報を利用します。広告用識別子との関連付けと広告のパーソナライズは無効にし、表示名・問題文・回答内容・管理用キーは送信しないよう制限します。データは米国など日本国外で処理される場合があります。下の既存の停止リンクでアクセス解析を停止できます。GTMとMicrosoft Clarityは開始しません。',
 en:'Only connections from Japan to Japanese or English pages use Google Analytics 4 (Google LLC) for public-page views and quiz starts, accepted answers, results and sharing actions. This uses cookie identifiers, referring domains and device/browser information. Advertising-identifier association and ad personalization are disabled, and display names, question text, answers and management keys are excluded. Data may be processed outside Japan, including the United States. The existing stop link below disables analytics. GTM and Microsoft Clarity are not started.'
};
