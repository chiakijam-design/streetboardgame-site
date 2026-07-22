# プライバシー運用設定

最終更新: 2026-07-23

## 1. コードで実行される処理

- Cron Trigger: 毎時17分に期限切れD1データとR2画像を削除・匿名化
- 遠隔ゲーム: 最終操作から24時間で失効
- LIVEゲーム・投票・参加者: 完了、キャンセル、強制終了後24時間で削除
- 未完了チャンネル所有確認: 90日で削除
- 運用・セキュリティイベント: 180日で削除
- 有料結果画像: 30日でR2から削除。同時に参加者名、参加者ID、ゲームコード、アクセス用ハッシュ、購入メールHMACを購入権限から消去し、Checkout注文の参加者名・画像表示名も匿名化。購入メールの平文はD1へ保存しない
- 購入・返金・売上・分配記録: 購入履歴専用D1で7年保存後に削除

Cronの直近実行と失敗はCloudflare WorkersのCron Trigger、Logs、Notificationsで確認する。

## 2. 購入履歴専用D1

有料販売前に、ゲーム用`REMOTE_DB`とは別に作成する。

```powershell
npx wrangler d1 create streetboardgame-live-purchases
```

返されたdatabase IDを`wrangler.jsonc`のコメント済み`LIVE_PURCHASE_DB`へ設定し、専用マイグレーションを適用する。

```powershell
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0001_live_purchase_records.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0002_live_checkout_orders.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0003_live_revenue_ledger.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0004_live_entitlement_recovery.sql
```

コードは購入・ダウンロード・返金・再発行処理で`LIVE_PURCHASE_DB`を必須とする。未設定時は有料処理を503で停止し、ゲーム用D1へフォールバックしない。

旧`REMOTE_DB.live_result_entitlements`に本番購入が存在する場合は、件数とStripe PaymentIntent IDを照合して専用D1へ移行し、移行確認後に旧テーブルの個人データを削除する。購入が存在しないことを確認せずに旧テーブルを削除しない。

## 2.1 非公開R2

- 元画像、変換画像、購入結果画像は`streetboardgame-live-private`へ保存し、公開バケット・`r2.dev`・カスタムドメインを使わない
- ブラウザへR2のオブジェクトキー、元画像Data URL、R2署名URLを返さない
- 無料プレビューは参加者認証後にWorkerが生成し、`private, no-store`で返す
- 有料画像は購入権限と10分以内のWorker署名URLを確認した場合だけ、Worker経由で`private, no-store`の添付ファイルとして返す
- 画像差し替え・審査却下時は旧3オブジェクトを直ちに削除する。ゲーム終了後の元画像と、購入から30日後の結果画像は毎時Cronで削除する
- 四半期点検ではPublic Development URLが`Disabled`、Custom Domainsが0件、不要なR2 APIトークンとWorkerバインディングがないことも確認する

## 3. 管理画面二要素認証

次の3つをCloudflare Worker secretとして設定する。

```powershell
npx wrangler secret put LIVE_ADMIN_TOKEN
npx wrangler secret put LIVE_ADMIN_TOTP_SECRET
npx wrangler secret put LIVE_ADMIN_SESSION_SECRET
```

- `LIVE_ADMIN_TOKEN`: 32文字以上のランダム値
- `LIVE_ADMIN_TOTP_SECRET`: 認証アプリへ登録するBase32秘密鍵。32文字以上
- `LIVE_ADMIN_SESSION_SECRET`: 32文字以上の別のランダム値
- TOTPは30秒、6桁。時刻ずれは前後1区間まで許容
- 二要素認証成功後の管理セッションは15分で失効し、ブラウザの`sessionStorage`だけに保存

secret設定後、認証アプリの現在コードで`/live-ops`へログインし、誤ったコードと期限切れセッションが拒否されることを確認する。

## 4. 外部サービス側で必要な設定

- GA4: データ保持を14か月に設定する
- Formspree: 対応完了から12か月を超えた問い合わせを月1回削除する
- Cloudflare: Logs・Analyticsの契約上の保持期間を確認し、不要なLogpush保存を行わない
- Stripe: 権限を最小化し、本人確認・決済記録の保持と削除はStripeの契約・法令も確認する
- Google / YouTube: 不要なOAuthクライアントとトークンを削除し、確認用stateを長期保存しない
- Cloudflare通知: Cron失敗、Worker 5xx、D1・R2使用量を通知対象にする

## 5. 四半期点検

1. Cronが毎時成功していることを確認する。
2. D1で期限超過したゲーム、ログ、未完了確認が残っていないことを確認する。
3. R2で期限超過した元画像・結果画像が残っていないことを確認する。
4. 購入履歴専用D1とゲーム用D1のbindingが別database IDであることを確認する。
5. 管理者secretを交換し、不要アカウントを削除する。
6. GA4、Formspree、Stripe、Google、Cloudflareの保持・権限設定を確認する。
