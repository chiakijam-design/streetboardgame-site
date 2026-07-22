# LIVE外部サービス設定

## 実装済みの安全境界

- YouTube情報はWorkerからYouTube Data API v3だけを使用して取得する。HTML、RSS、oEmbedへのフォールバックは行わない
- APIキー未設定・割当超過時は問題生成を停止し、推測したチャンネル情報で続行しない
- 無料LIVEはチャンネル所有確認なしで利用できる
- 有料結果画像の権限発行は、チャンネル所有確認とStripe名義関係確認の両方が完了していなければ拒否する
- 有料販売は、現行バージョンのYouTuber向け収益分配規約へのWeb同意も完了していなければ拒否する
- YouTuber元画像はゲームJSON、公開API、WebSocketへ入れない。非公開R2のオブジェクトキーだけをゲームへ保存する
- 無料プレビューは参加者トークンを検証したWorkerが540×675・SAMPLE入りで生成する
- 有料版は購入権限発行時に2,160×2,700・SAMPLEなしで生成し、非公開R2へ保存する
- D1の購入権限と、有効期限10分以内の署名URLの両方が有効な場合だけダウンロードできる
- 購入権限の提供期限は購入から30日間

Stripe Checkoutはカード・JPY税込の1回払いとして接続する。成功Webhookが注文金額・通貨・Session ID・PaymentIntentを注文台帳と照合し、高画質画像と30日間の購入権限を自動発行する。Checkout時点ではYouTuberへ即時送金せず、70%を分配予定額として14日間保留する。

## 1. YouTube Data API v3

1. Google CloudでYouTube Data API v3を有効にする
2. API制限を「YouTube Data API v3」だけにした標準APIキーを発行する。Workerからのサーバー間通信にはブラウザのHTTPリファラーが付かないため、ウェブサイト制限は使わない。Cloudflareの送信元IPも固定ではないためIP制限は使わず、Worker secret・API制限・クォータ監視で保護する
3. Worker secretへ登録する

```powershell
npx wrangler secret put YOUTUBE_API_KEY
```

登録後は`https://www.streetboardgame.com/api/live/youtube-candidates`が`youtube-api-not-configured`を返さないことを確認する。APIキーの平文はソース、`wrangler.jsonc`、GitHub、ブラウザ側JavaScriptへ書かない。

動画URLは`videos.list`で投稿元`channelId`を取得する。チャンネルは`channels.list`、最近の公開動画はアップロード再生リストに対する`playlistItems.list`と`videos.list`で取得する。旧`/c/`形式など一意に解決できないURLだけ`search.list`を使うため、通常は`@handle`または`/channel/UC...`を案内する。

## 2. YouTube OAuthによる所有確認

Google CloudのOAuth同意画面とWebアプリクライアントを設定し、次を登録する。

```powershell
npx wrangler secret put YOUTUBE_OAUTH_CLIENT_ID
npx wrangler secret put YOUTUBE_OAUTH_CLIENT_SECRET
npx wrangler secret put YOUTUBE_OAUTH_REDIRECT_URI
```

`YOUTUBE_OAUTH_REDIRECT_URI`は本番の`https://www.streetboardgame.com/api/live/channel-verifications/oauth/callback`にする。OAuthでは`youtube.readonly`だけを要求し、`channels.list(mine=true)`で対象チャンネルを確認後、アクセストークンを破棄・失効させる。アクセストークンとリフレッシュトークンはD1へ保存しない。

画面上の運用フローは次の通り。

1. 撮影スタッフが問題編集画面の「チャンネル所有確認URLを発行する」を押す
2. 発行された秘密URLをYouTuber本人または正式なチャンネル運営者へ、安全な連絡手段で送る
3. YouTuber側はOAuth、概要欄コード、手動審査申請のいずれか1つで所有確認する
4. スタッフは問題編集画面の「確認状況を更新」、運営者は`/live-ops`の「チャンネル所有・Stripe名義確認」で状態を確認する
5. 所有確認後、運営者がConnectアカウントIDを登録し、YouTuber本人が秘密URLから現行の収益分配規約へWeb同意する
6. 所有確認と規約同意だけでは有料販売を許可しない。運営者がStripe本人確認・チャンネルとの名義関係を確認する

秘密URLの確認トークンは`#verification=...`に置き、HTTPリクエストやアクセスログへ送らない。URLは公開チャット、YouTube概要欄、配信画面へ掲載しない。

所有確認の代替手段は次の通り。

- 概要欄確認: 発行した`SBLV-...`コードをチャンネル概要欄へ一時掲載し、公式APIで一致を確認する
- 手動審査: 運営の審査待ちへ移し、管理APIで承認または却下する

## 3. Stripeとの名義関係確認

有料販売の許可条件は次の5つをすべて満たすこと。

- `ownership_status = verified`
- 現在の`terms_version`・規約本文SHA-256・同じ`stripe_account_id`に紐づくWeb同意記録が存在
- `stripe_identity_verified = 1`
- `stripe_relationship_status = verified`
- `stripe_account_id`が`acct_...`形式で登録済み

Stripe本人確認済み名義とチャンネル運営者が異なる場合、所属法人・事務所・委任関係を示す資料を手動審査する。管理APIは管理トークンとTOTPの二要素認証を必須とする。設定値は`docs/PRIVACY_OPERATIONS.md`を参照する。

運営コンソールで所有確認だけを承認しても、上の5条件が揃うまでは`canSellPaid=false`を維持する。ConnectアカウントIDを変更した場合は同じ規約バージョンでも再同意を必要とする。規約本文を変更する場合はバージョンとSHA-256を更新し、現行版への再同意を求める。OAuthまたは概要欄コードで確認済みの方式は、Stripe審査を更新しても`manual`へ上書きしない。

Web同意では、契約者名、連絡先メール、規約バージョン、規約本文SHA-256、同意日時、IP、User-Agent、ConnectアカウントID、権限確認・プライバシー確認をD1へ追記保存する。同意済み行は上書きせず、規約またはConnectアカウント変更時は新しい行を追加する。これはクリック同意の監査証跡であり、Stripe本人確認や運営審査を代替しない。

```powershell
npx wrangler secret put LIVE_ADMIN_TOKEN
npx wrangler secret put LIVE_ADMIN_TOTP_SECRET
npx wrangler secret put LIVE_ADMIN_SESSION_SECRET
```

## 4. 非公開R2とCloudflare Images

Cloudflare Imagesは有料機能である。契約後に非公開バケットを作成する。

```powershell
npx wrangler r2 bucket create streetboardgame-live-private
npx wrangler r2 bucket dev-url disable streetboardgame-live-private
```

作成後、Cloudflare DashboardのR2 > `streetboardgame-live-private` > Settingsで、次を確認してから`wrangler.jsonc`にある`LIVE_MEDIA`と`IMAGES`のコメントを外す。

- Public Development URLが`Disabled`である
- Custom Domainsが0件である
- CORSポリシーを設定していない（ブラウザからR2へ直接PUT/GETしない）
- Workerの`LIVE_MEDIA`バインディング以外に、このバケットを読む不要なWorker・APIトークンがない

R2バケットは既定では非公開だが、`r2.dev`とカスタムドメインは独立した公開経路である。どちらも有効化しない。アプリが発行する「署名URL」はR2のURLではなく、購入権限をD1で再確認するStreetboardgame WorkerのURLである。

保存されるオブジェクトは次の通り。ゲームJSON、公開API、WebSocketにはオブジェクトキーも返さない。

| キー | 内容 | 削除 |
|---|---|---|
| `live/{ルーム}/creator/{ランダムID}/original` | 実バイト検証済みの元画像 | 差し替え・却下・ゲーム失効時 |
| `live/{ルーム}/creator/{ランダムID}/preview.webp` | 384×384の無料プレビュー素材 | 同上 |
| `live/{ルーム}/creator/{ランダムID}/paid.webp` | 1,200×1,200の有料画像素材 | 同上 |
| `live/results/{購入ID}.svg` | 2,160×2,700の購入済み結果画像 | 購入から30日後 |

保存時は`Cache-Control: private, no-store`、用途メタデータ、SHA-256を付け、R2側にもSHA-256一致を検証させる。アップロードはJPEG/PNG/WebP・10MB以下に限定し、ファイル名や申告MIMEではなくマジックバイトとCloudflare Imagesのデコード結果を検証する。変換後の画像だけを結果生成へ使用し、元画像をブラウザへ返さない。

署名URL用の32文字以上のランダム値を登録する。

```powershell
npx wrangler secret put LIVE_DOWNLOAD_SIGNING_SECRET
```

本番デプロイ後は`/live-ops`の「監視設定」に`非公開R2 / Images`が出ることを確認する。文字が出るのはバインディング存在確認であり、公開URLが無効であることの証明ではないため、Dashboardの公開設定も必ず確認する。

## 5. D1マイグレーション

本番デプロイ前に所有確認テーブルをゲーム用D1へ適用し、購入権限テーブルは購入履歴専用D1へ適用する。

```powershell
npx wrangler d1 migrations apply streetboardgame-remote --remote
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0001_live_purchase_records.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0002_live_checkout_orders.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0003_live_revenue_ledger.sql
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0004_live_entitlement_recovery.sql
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put LIVE_PURCHASE_ACCESS_SECRET
```

ゲーム用D1には通常マイグレーションを順番に適用し、Web契約同意には`migrations/0008_live_creator_agreements.sql`まで必要である。購入用D1は通常マイグレーションと混ざらない専用ディレクトリの`migrations-purchases/0004_live_entitlement_recovery.sql`までを順番に適用する。所有確認アクセストークン、作成者招待コード、購入アクセスキーは平文保存せずSHA-256ハッシュだけを保存する。購入メールは平文保存せず、サーバー秘密鍵によるHMAC-SHA-256だけを購入権限へ保存する。購入用`LIVE_PURCHASE_DB`が未設定の場合、有料処理はゲーム用D1へフォールバックせず停止する。本番で`LIVE_CREATOR_INVITE_BYPASS_TOKEN`を設定しない。

## 6. Stripe Webhook接続時の手順

1. Checkout Sessionの作成前に、ゲームへ紐づくチャンネルが有料販売可能か再確認する
2. Webhook署名を検証後、イベントIDを購入履歴専用D1で一意管理し、失敗イベントは再試行可能にする
3. `checkout.session.completed`の金額・通貨・Session ID・PaymentIntentを注文台帳と照合する
4. 同一Worker内で高解像度画像と購入権限を冪等発行する。管理APIをWebhookからHTTP経由で呼ばない
5. 購入者はCheckout成功URLから元の参加端末へ戻り、30日間のダウンロード権限を受け取る
6. Stripe DashboardのCustomer emailsでSuccessful paymentsを有効にする。結果画像のReceiptには`/live?recover=1`と`ord_...`注文番号が記載される
7. 別端末では注文番号と決済時メールを照合し、10分間だけ有効な署名URLを再発行する。照合は10分間に5回までとする
8. 不正リスクが高い決済は注文・権限を`fraud_review`へ変更し、分配を保留する
9. 返金・チャージバック時は権限を失効させ、YouTuber分配を保留・相殺する
10. `charge.succeeded`から残高取引を取得し、注文ごとの実Stripe手数料と運営実残額を売上台帳へ保存する
11. `charge.dispute.closed`で勝訴時は保留解除、敗訴時は次回分配の相殺へ移す
12. `transfer.created`・`transfer.updated`・`transfer.reversed`でConnect送金状態を分配台帳へ同期する

人間向け管理APIは管理トークンとTOTPで発行した15分セッション専用とする。Stripe Webhookは署名検証後に同一Worker内の関数を直接呼び、管理者のTOTPセッションをサービス間認証の代用にしない。
