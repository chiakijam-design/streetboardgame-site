# LIVE外部サービス設定

## 実装済みの安全境界

- YouTube情報はWorkerからYouTube Data API v3だけを使用して取得する。HTML、RSS、oEmbedへのフォールバックは行わない
- APIキー未設定・割当超過時は問題生成を停止し、推測したチャンネル情報で続行しない
- 無料LIVEはチャンネル所有確認なしで利用できる
- 有料結果画像の権限発行は、チャンネル所有確認とStripe名義関係確認の両方が完了していなければ拒否する
- YouTuber元画像はゲームJSON、公開API、WebSocketへ入れない。非公開R2のオブジェクトキーだけをゲームへ保存する
- 無料プレビューは参加者トークンを検証したWorkerが540×675・SAMPLE入りで生成する
- 有料版は購入権限発行時に2,160×2,700・SAMPLEなしで生成し、非公開R2へ保存する
- D1の購入権限と、有効期限10分以内の署名URLの両方が有効な場合だけダウンロードできる
- 購入権限の提供期限は購入から30日間

Stripe Checkout / Connectの決済開始・Webhookはまだ未接続である。現時点の管理用権限発行APIは、Stripeの`payment_intent.succeeded`を検証したWebhookから呼ぶための内部境界であり、ブラウザから直接呼ばない。

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
5. 所有確認だけでは有料販売を許可しない。運営者がConnectアカウントID・Stripe本人確認・チャンネルとの名義関係を確認する

秘密URLの確認トークンは`#verification=...`に置き、HTTPリクエストやアクセスログへ送らない。URLは公開チャット、YouTube概要欄、配信画面へ掲載しない。

所有確認の代替手段は次の通り。

- 概要欄確認: 発行した`SBLV-...`コードをチャンネル概要欄へ一時掲載し、公式APIで一致を確認する
- 手動審査: 運営の審査待ちへ移し、管理APIで承認または却下する

## 3. Stripeとの名義関係確認

有料販売の許可条件は次の3つをすべて満たすこと。

- `ownership_status = verified`
- `stripe_identity_verified = 1`
- `stripe_relationship_status = verified`
- `stripe_account_id`が`acct_...`形式で登録済み

Stripe本人確認済み名義とチャンネル運営者が異なる場合、所属法人・事務所・委任関係を示す資料を手動審査する。管理APIは管理トークンとTOTPの二要素認証を必須とする。設定値は`docs/PRIVACY_OPERATIONS.md`を参照する。

運営コンソールで所有確認だけを承認しても、上の4条件が揃うまでは`canSellPaid=false`を維持する。OAuthまたは概要欄コードで確認済みの方式は、Stripe審査を更新しても`manual`へ上書きしない。

```powershell
npx wrangler secret put LIVE_ADMIN_TOKEN
npx wrangler secret put LIVE_ADMIN_TOTP_SECRET
npx wrangler secret put LIVE_ADMIN_SESSION_SECRET
```

## 4. 非公開R2とCloudflare Images

Cloudflare Imagesは有料機能である。契約後に非公開バケットを作成する。

```powershell
npx wrangler r2 bucket create streetboardgame-live-private
```

作成後、`wrangler.jsonc`にある`LIVE_MEDIA`と`IMAGES`のコメントを外す。R2は公開バケット・カスタムドメイン・`r2.dev`公開を有効にしない。

署名URL用の32文字以上のランダム値を登録する。

```powershell
npx wrangler secret put LIVE_DOWNLOAD_SIGNING_SECRET
```

## 5. D1マイグレーション

本番デプロイ前に所有確認テーブルをゲーム用D1へ適用し、購入権限テーブルは購入履歴専用D1へ適用する。

```powershell
npx wrangler d1 migrations apply streetboardgame-remote --remote
npx wrangler d1 execute streetboardgame-live-purchases --remote --file migrations-purchases/0001_live_purchase_records.sql
```

ゲーム用D1には通常マイグレーションを順番に適用し、招待・手動審査には`migrations/0007_live_abuse_prevention.sql`まで必要である。購入用D1は通常マイグレーションと混ざらない専用ディレクトリの`migrations-purchases/0001_live_purchase_records.sql`だけを適用する。所有確認アクセストークン、作成者招待コード、購入アクセスキーは平文保存せずSHA-256ハッシュだけを保存する。購入用`LIVE_PURCHASE_DB`が未設定の場合、有料処理はゲーム用D1へフォールバックせず停止する。本番で`LIVE_CREATOR_INVITE_BYPASS_TOKEN`を設定しない。

## 6. Stripe Webhook接続時の手順

1. Checkout Sessionの作成前に、ゲームへ紐づくチャンネルが有料販売可能か再確認する
2. Webhook署名を検証し、`payment_intent.succeeded`を確認する
3. 同一Worker内の購入権限発行処理を直接呼び、高解像度画像と購入権限を作成する。人間向けの`POST /api/live/admin/result-entitlements`をWebhookからHTTP経由で呼ばない
4. 購入者メールには購入アクセスキー付きの権限確認URLを送る
5. 権限確認APIが10分以内の署名ダウンロードURLを発行する
6. 返金・チャージバック時は権限`status`を失効させ、YouTuber分配を保留・相殺する

人間向け管理APIは管理トークンとTOTPで発行した15分セッション専用とする。Stripe Webhookは署名検証後に同一Worker内の関数を直接呼び、管理者のTOTPセッションをサービス間認証の代用にしない。
