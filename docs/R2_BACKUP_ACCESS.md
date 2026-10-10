# R2素材バックアップに不足する権限（2026-10-10）

## 現在の判断: 本人指示で対象外

2026-10-10の本人最新指示により、`streetboardgame-live-private` の素材取得・バックアップ調査・追加権限設定を中止。素材数が少ないため、今回のバックアップ対象外とする判断。ChromeのR2調査待ちは解除。バケットや既存素材は削除していない。保存済みコードZIPとD1バックアップを保持する。

このR2素材はGitHub・コードZIP・D1 SQLから復元できる保証はない。以下は中止前の確認記録と当時の候補手順であり、実行中の承認要求ではない。再開や新資格情報作成は行わない。

## 実際に拒否された操作

- Cloudflareアカウント: `Chiaki.jam@gmail.com's Account`
- アカウントID: `8b38f72887dc4715f9b73c94169faff7`
- 非公開バケット: `streetboardgame-live-private`（現`LIVE_MEDIA` binding）
- 操作: `wrangler r2 bucket info streetboardgame-live-private`。
- GET: `/accounts/8b38f72887dc4715f9b73c94169faff7/r2/buckets/streetboardgame-live-private`
- 結果: `Authentication error [code: 10000]`。
- 現CLI OAuth scope: `user(read)`, `offline_access`, `account(read)`, `workers_scripts(write)`, `d1(write)`。R2 scopeなし。アカウントのSuper Administrator資格があっても、このCLI tokenの権限が自動で増えるわけではない。

拒否を迂回するWorker endpointを作らず、バケット公開化、OAuthの広範scope追加、新token作成は行っていない。

## 第一候補: 既存ダッシュボードで正式にダウンロード

他担当のChrome利用と調整できた時点で、既存ログインのR2一覧から対象バケットの件数・容量を確認する。オブジェクトが少数なら、各オブジェクトの`... > Download`で本人がMacの同期対象外・非公開ローカル保管先へダウンロードする。API keyを新規作成する必要はない。全件のkey/size/checksum/取得時刻を記録して、件数と整合性を確認する。

公式手順: https://developers.cloudflare.com/r2/objects/download-objects/

ダッシュボードへのアクセス・件数・個別downloadの成功はまだ確認していない。アカウントのロールが十分でも、未検証の成功を保証しない。

## 大量で一括取得が必要な場合の最小案

対象を上記1バケットに限定した`Object Read only`。用途はS3 APIでのListObjects/GetObjectによる一度だけのローカル保全。有効期限は短期間（例: 本人作業予定から1日以内）として、取得検証後に本人が失効を確認する。全バケット、Admin Read/Write、Object Write/Delete、公開化の権限は不要。

この`Object Read only`はS3互換API向けで、Cloudflare RESTの`bucket info`を再試行する権限とは異なる。正式なS3 clientで読み取る。endpointは対象アカウントの`https://8b38f72887dc4715f9b73c94169faff7.r2.cloudflarestorage.com`（jurisdictionはダッシュボードで先に確認し、必要なら正式なjurisdiction endpointを使う）。

新規key/権限を作る前に、対象・Read only・期限・用途・保存先を本人へ提示し所定の具体承認を得る。秘密値の表示画面、入力、コピー、安全な保管は本人操作とする。Codexは秘密値を取得・出力・チャット/Git/ZIPへ保存しない。新費用・契約が求められた場合も、その条件を確認するまで進めない。

公式権限・S3/REST区別: https://developers.cloudflare.com/r2/api/tokens/

## コード・D1との区別

コードZIPとD1別保管は完了済みで、再作成/再exportは不要。R2オブジェクト・Cloudflare Images・DO/KV・外部設定はこの2つから復元できない。R2追加保全が未完了でも、独立した翻訳/コード検証を止めない。DAIVは当面編集せず、復帰時の未Push差分保全を先に行う。
