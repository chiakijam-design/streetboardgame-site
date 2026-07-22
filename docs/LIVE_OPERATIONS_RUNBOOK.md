# YouTuber向けLIVE 監視・障害対応手順書

最終更新: 2026-07-22

## 1. 運営コンソールと本番設定

- URL: `https://www.streetboardgame.com/live-ops`
- 認証: Worker secret `LIVE_ADMIN_TOKEN`（32文字以上）
- トークンはURLへ付けない。画面ではタブを閉じると消える`sessionStorage`だけに保存する。
- コンソールは`noindex`だが、URLを知ること自体は権限にならない。防御の本体は管理トークンである。

```powershell
npx wrangler secret put LIVE_ADMIN_TOKEN
npx wrangler secret put LIVE_OPS_ALERT_WEBHOOK_URL
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler d1 execute streetboardgame-remote --remote --file migrations/0006_live_operations.sql
```

`LIVE_OPS_ALERT_WEBHOOK_URL`にはHTTPS通知受信URLを設定する。重大APIエラー、Stripe失敗、Stripe Webhook処理失敗、WebSocket切断率超過をJSON POSTする。通知先が固定形式を要求する場合は中継Workerで変換する。

D1自体が利用不能な緊急時は、次のWorker環境変数を設定してデプロイする。これらはD1上の告知より優先される。

- `LIVE_EMERGENCY_MODE`: `degraded`または`maintenance`
- `LIVE_EMERGENCY_TITLE`: 利用者向け見出し
- `LIVE_EMERGENCY_MESSAGE`: 利用者向け本文

## 2. 監視項目と初期しきい値

| 項目 | 初期しきい値 | 一次対応 |
|---|---:|---|
| LIVE API 5xx | 1件以上 | 運営イベント、Cloudflare Logs、該当APIを確認 |
| WebSocket予期せぬ切断率 | 5分で20切断以上かつ20%以上 | Cloudflare障害、デプロイ時刻、特定ルーム集中を確認 |
| Stripe決済失敗 | 1件以上 | 決済IDと理由を確認し、別決済方法を案内 |
| Stripe Webhook処理失敗 | 1件以上 | 署名secret、D1、Worker Logsを確認 |
| D1 rows read/written | 月間枠の70% / 90% | 高負荷SQL、索引、プランを確認 |
| Durable Objects | 通常値の2倍または予算70% / 90% | requests、WebSocket、duration、storageを名前空間別に確認 |

WebSocketしきい値は`LIVE_WS_ALERT_MIN_DISCONNECTS`（既定20）と`LIVE_WS_ALERT_RATE`（既定0.2）で変更できる。Cloudflareのデプロイは既存WebSocketを切断するため、予約時間中のデプロイは禁止する。

## 3. Cloudflare Dashboardで必ず行う設定

コードだけではCloudflareアカウント全体の利用量・エッジエラー率を監視できない。

1. NotificationsでCloudflare IncidentとUsage Based Billingを有効化する。
2. D1 Rows Read / Rows Writtenを70%と90%で通知する。
3. D1 > `streetboardgame-remote` > MetricsでQPS、rows、latency、storageを週1回確認する。
4. Workers & Pages > `streetboardgame` > Metrics / Logsで5xxとCPU時間を確認する。
5. Durable Objectsの`LiveRoomCoordinator`と`LiveVoteShard`でrequests、WebSocket、duration、storageを確認する。
6. EnterpriseではAdvanced Error Rate Alertを`streetboardgame.com`のedge/origin 5xxへ設定する。
7. Enterprise以外では外形監視から`GET /api/live/status`を1分間隔で確認し、5分中2回失敗で通知する。

公式資料:

- https://developers.cloudflare.com/notifications/notification-available/
- https://developers.cloudflare.com/d1/observability/metrics-analytics/
- https://developers.cloudflare.com/d1/observability/billing/
- https://developers.cloudflare.com/durable-objects/observability/metrics-and-analytics/

## 4. Stripeで必ず行う設定

1. Stripe Workbench > Webhooksで本番エンドポイントを作る。
2. URLを`https://www.streetboardgame.com/api/live/stripe/webhook`にする。
3. `payment_intent.payment_failed`、`checkout.session.async_payment_failed`、`charge.failed`を購読する。
4. 署名secretを`STRIPE_WEBHOOK_SECRET`へ保存する。
5. テストイベントを送り、運営コンソールと通知Webhookの両方へ出ることを確認する。
6. StripeのWebhook配信失敗通知を有効化し、毎日Undelivered eventsが0件であることを確認する。

Stripeは本番Webhookを最大3日間再送する。復旧後は未配信イベントをID単位で確認し、重複処理を監査する。

公式資料:

- https://docs.stripe.com/payments/payment-intents/verifying-status
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/webhooks/process-undelivered-events

## 5. 障害対応フロー

### 5.1 最初の5分

1. 運営コンソールで重大イベント、稼働中ルーム、WebSocket切断率を確認する。
2. `/api/live/status`、`/live`、対象ルームを別回線から確認する。
3. Cloudflare Status、Workers Logs、D1/DO Metrics、Stripe Webhookを確認する。
4. 影響を「新規作成のみ」「参加・投票」「決済・画像DL」「サイト全体」に分類する。

### 5.2 利用者告知

- 継続可能な一部障害: `degraded`。警告を出すが新規作成・参加は止めない。
- データ不整合や投票不能の恐れ: `maintenance`。新規問題生成、ゲーム作成、参加を503で止める。
- D1障害でコンソールが使えない: `LIVE_EMERGENCY_MODE`等を設定して緊急デプロイする。

告知文テンプレート:

> LIVE機能で接続しづらい状態を確認しています。新規参加を一時停止し、復旧対応中です。決済の再操作は行わず、この画面の更新をお待ちください。

### 5.3 強制終了

1. 対象ルームで「強制終了」を押し、利用者向け理由を入力する。
2. ルームは`terminated`になり、予約と全体稼働ロックを解放する。
3. 全端末に終了画面が配信される。元に戻せないため、再開は新しいLIVEを予約する。

### 5.4 漏えいURLの無効化

1. 対象ルームでスタッフURLまたは本人URLを再発行する。
2. 実行時点で旧トークンは無効になる。
3. 新URLは一度だけ表示されるため、安全な連絡手段で本人へ渡す。公開チャットや配信概要欄へ貼らない。

### 5.5 返金と購入権限

- 返金対象を確認したら「権限停止・返金待ち」。ダウンロードは即時停止する。
- Stripe DashboardでPaymentIntentを照合して実返金する。
- Stripe返金成功後だけ「Stripe返金完了」を押す。
- URL紛失・期限再発行は「購入権限を再発行」。旧URLを失効し、新しい30日間のURLを発行する。
- `refund_pending`または`refunded`の購入は再発行できない。

## 6. 復旧判定

1. 原因を修正し、該当APIを本番で確認する。
2. テストルームで参加、本人回答、投票、答え合わせまで確認する。
3. 15分間、API重大エラー0件、WebSocket予期せぬ切断率5%未満を確認する。
4. 告知を`normal`へ戻す。
5. 発生・検知・告知・復旧時刻、影響ルーム、決済影響、再発防止策を記録する。

## 7. 制約

- コンソールの返金操作はStripe APIを直接呼ばない。権限停止と状態管理であり、実返金はStripe Dashboardで行う。
- Cloudflare全体のエラー率とD1/DO請求使用量はCloudflare Dashboardが正。アプリ画面だけで請求判断しない。
- `LIVE_OPS_ALERT_WEBHOOK_URL`未設定ではアプリ通知は送られない。
- 管理トークン、Stripe署名secret、通知Webhook URLをGitへコミットしない。
