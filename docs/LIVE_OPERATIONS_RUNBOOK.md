# YouTuber向けLIVE 監視・障害対応手順書

最終更新: 2026-07-22

## 1. 運営コンソールと本番設定

- URL: `https://www.streetboardgame.com/live-ops`
- 認証: 管理トークンと認証アプリのTOTPによる二要素認証。認証後の管理セッションは15分
- 管理トークンと短期セッションはURLへ付けない。画面ではタブを閉じると消える`sessionStorage`だけに保存し、TOTPは保存しない。
- コンソールは`noindex`だが、URLを知ること自体は権限にならない。防御の本体は二要素認証と短期署名セッションである。

```powershell
npx wrangler secret put LIVE_ADMIN_TOKEN
npx wrangler secret put LIVE_ADMIN_TOTP_SECRET
npx wrangler secret put LIVE_ADMIN_SESSION_SECRET
npx wrangler secret put LIVE_OPS_ALERT_WEBHOOK_URL
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put LIVE_PURCHASE_ACCESS_SECRET
npx wrangler d1 execute streetboardgame-remote --remote --file migrations/0006_live_operations.sql
npx wrangler d1 execute streetboardgame-remote --remote --file migrations/0007_live_abuse_prevention.sql
npx wrangler d1 execute streetboardgame-remote --remote --file migrations/0008_live_creator_agreements.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0002_live_checkout_orders.sql
```

荒らし・なりすまし・不適切画像・カード不正利用への対応は[`LIVE_ABUSE_PREVENTION.md`](LIVE_ABUSE_PREVENTION.md)を使用する。初期版の応援メッセージは公開せず、YouTuber招待は二要素認証済みの運営コンソールから手動審査後にだけ発行する。

TOTP設定、購入履歴専用D1、Cron削除は`docs/PRIVACY_OPERATIONS.md`を参照する。個人データの漏えいまたはその疑いがある場合は、通常の障害対応より先に`docs/PRIVACY_INCIDENT_RESPONSE.md`を実行する。

### 1.1 チャンネル所有・Stripe名義審査

1. YouTuber本人が秘密の確認URLからOAuthまたは概要欄コードで確認する。使えない場合だけ手動審査申請を受ける。
2. `/live-ops`の「チャンネル所有・Stripe名義確認」で対象Channel IDと実際のチャンネルを照合する。
3. 手動審査では、登録メールからの返信、チャンネル管理画面の一時的な証跡、所属事務所・法人からの委任資料のうち必要なものを別経路で確認する。資料そのものはLIVEのゲームD1へ保存しない。
4. Stripe Connectの`acct_...`を登録後、YouTuber本人へ秘密URLから収益分配規約へ同意してもらう。同意記録ID、規約バージョン、契約者名、日時をコンソールで確認する。
5. Stripe本人確認状態、Connect名義とチャンネル運営者の関係を照合する。
6. 5条件が揃う場合だけ「確認済み・本人確認済み・関係確認済み」を保存する。画面が「有料販売可」になったことを再確認する。
7. 不一致やなりすましの疑いがある場合は却下し、招待コードも失効する。有料販売は再審査完了まで開放しない。

無料LIVEは所有確認未完了でも利用できる。確認URLは本人用の秘密URLとして扱い、漏えい時はその確認申請を却下して新しい申請を作る。OAuth設定が未完了でも概要欄コードと手動審査は利用できるが、概要欄確認には`YOUTUBE_API_KEY`が必要である。

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
3. `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`payment_intent.payment_failed`、`charge.failed`、`charge.succeeded`、`charge.refunded`、`refund.updated`、`refund.failed`、`charge.dispute.created`、`charge.dispute.closed`、`radar.early_fraud_warning.created`、`transfer.created`、`transfer.updated`、`transfer.reversed`を購読する。
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

### 5.3 開始前の予約変更・キャンセル

通常の予約管理は運営コンソールではなく、企画保存時に発行したスタッフ用URLから行う。

1. 変更時は新しい日時を選び、「変更先の空きを確認」を押す。
2. 空きがある場合だけ確定する。確定に失敗した場合、現在の予約枠は保持される。
3. キャンセル時は対象企画と日時を再確認して実行する。予約枠は直ちに解放され、元に戻せない。
4. ライブ開始後は日時変更、キャンセル、非公開URL再発行を行えない。障害時は運営コンソールの強制終了を使う。
5. クローズドβ中は変更後も前後20時間を確保する。5,000人試験の合格条件を満たすまで短縮しない。

### 5.4 強制終了

1. 対象ルームで「強制終了」を押し、利用者向け理由を入力する。
2. ルームは`terminated`になり、予約と全体稼働ロックを解放する。
3. 全端末に終了画面が配信される。元に戻せないため、再開は新しいLIVEを予約する。

### 5.5 漏えいURLの無効化

1. 開始前はスタッフ用URLから、開始後またはスタッフ用URLを紛失した場合は運営コンソールから、スタッフURLまたは本人URLを再発行する。
2. 実行時点で旧トークンは無効になる。
3. 新URLを安全な連絡手段で担当スタッフまたは本人へ渡す。公開チャットや配信概要欄へ貼らない。

### 5.6 返金と購入権限

- 返金対象を確認したら「権限停止・返金待ち」。ダウンロードとYouTuber分配を即時停止する。
- 注文・PaymentIntent・返金理由を照合後、「Stripeへ全額返金」を押す。WorkerがRefund APIを注文単位の冪等キー付きで呼ぶ。
- `refund.updated`または`charge.refunded` Webhookで`refunded`へ同期されたことを確認する。
- URL紛失・期限再発行は「購入権限を再発行」。旧URLを失効し、新しい30日間のURLを発行する。
- `refund_pending`または`refunded`の購入は再発行できない。

### 5.7 70%月次分配と売上台帳

1. 毎月15日以降に運営コンソールの「70%分配・売上台帳」を開き、前月を選んで「月次分配台帳を作成」を押す。
2. 14日保留中、返金待ち、不正審査中の売上が送金対象に入っていないことを確認する。
3. YouTuber70%残高から返金確定後の相殺額を引いた金額が5,000円未満なら翌月へ繰り越す。
4. バッチの対象売上、70%、相殺額、ConnectアカウントIDを契約記録と照合する。
5. 確認後だけ「Stripe Connectへ送金」を押す。ボタンはStripe上の資金移動を発生させるため、二重操作せず結果を待つ。
6. `tr_...`が表示され、状態が`transferred`になったことをStripe Dashboardと照合する。
7. `transfer_failed`は失敗理由とプラットフォーム残高、Connect制限を確認してから同じバッチを再実行する。冪等キーにより同一バッチの二重送金を防止する。
8. `reversed`または`payout_reversed`は自動再送金せず、Connect残高・返金・不正利用を手動調査する。

## 6. 復旧判定

1. 原因を修正し、該当APIを本番で確認する。
2. テストルームで参加、本人回答、投票、答え合わせまで確認する。
3. 15分間、API重大エラー0件、WebSocket予期せぬ切断率5%未満を確認する。
4. 告知を`normal`へ戻す。
5. 発生・検知・告知・復旧時刻、影響ルーム、決済影響、再発防止策を記録する。

## 7. 制約

- コンソールの「Stripeへ全額返金」はStripe APIを直接呼ぶ。実行前に必ず「権限停止・返金待ち」で対象を確定し、TOTP管理セッションを第三者へ共有しない。
- Cloudflare全体のエラー率とD1/DO請求使用量はCloudflare Dashboardが正。アプリ画面だけで請求判断しない。
- `LIVE_OPS_ALERT_WEBHOOK_URL`未設定ではアプリ通知は送られない。
- 管理トークン、Stripe署名secret、通知Webhook URLをGitへコミットしない。
- TOTP秘密鍵、管理セッション署名secret、購入履歴データもGitへコミットしない。
