# 遠隔プレイ機能の Cloudflare 設定

このサイトには、彼氏の愛情判定だけ対応した `/remote` のLINE受け渡し方式を追加しています。

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

- `/remote` で判定方向と名前を設定してルームを作成
- ルームを作った本人が、自分の答えを5問続けて選ぶ
- 表示されたボタンから、予想する相手へメッセージとURLをLINEで送る
- 相手が5問続けて予想すると、通常版と同じ結果と答え合わせを表示
- 相手は結果URLをLINEまたはコピーで本人へ返せる
- 回答用URLは1回のラウンドだけ有効で、使用済みURLからは再回答できない

## 注意

ルームと結果URLは、作成・回答・再プレイなどの最終操作から24時間で期限切れになる想定です。個人情報は名前6文字と回答だけで、ログインは不要です。
