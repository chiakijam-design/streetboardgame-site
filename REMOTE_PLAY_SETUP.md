# 遠隔プレイ機能の Cloudflare 設定

このサイトには、彼氏の愛情判定だけ対応した `/remote` のルームコード方式を追加しています。

## 必要なバインド

Cloudflare Pages/Workers の設定で、どちらかを追加してください。

### 推奨: D1

- Binding name: `REMOTE_DB`
- Database: 任意の D1 database
- Schema: `migrations/0001_remote_rooms.sql`

Worker 側でも `CREATE TABLE IF NOT EXISTS` を実行するため、初回アクセス時にテーブルがなければ作られます。

### 代替: KV

- Binding name: `REMOTE_KV`
- Namespace: 任意の KV namespace

D1 がある場合は D1 を優先し、D1 がない場合だけ KV を使います。

## 動作

- `/remote` で判定方向、名前、作成者の役割を選んでから6桁の数字ルームコードを作成
- 6桁のルームコードまたはURLを相手に送る
- 相手は同じページでコード入力するだけで、作成者と反対側の役割として参加
- 片方が本人の答え、もう片方が予想を入力
- 5問終わると結果と答え合わせを表示

## 注意

ルームは6時間で期限切れになる想定です。個人情報は名前6文字と回答だけで、ログインは不要です。
