# 匿名の日別詳細集計（2026-10-01追加）

正本は既存D1 `streetboardgame-remote` の `play_daily_actions`。
保存する列は `day / mode / metric / count` のみ。日付はAsia/Tokyo。
名前、回答、点数、ルーム、トークン、IP、GA4識別子は長期集計に保存しない。
これは操作件数であってユニーク人数ではない。既存の開始・完了集計とは別表。

| metric | 定義と取得元 |
|---|---|
| result_image_ready | 通常版の結果PNG生成成功（ブラウザー通知） |
| result_image_save_requested | 通常版の保存処理／共有保存シート呼び出し成功。端末への実保存完了は確認できない（ブラウザー通知） |
| answer_report_viewed | 通常版の答え合わせレポート領域が25%以上画面内に入った（ブラウザー通知） |
| role_swap_started | 通常版で同じ10問を使った役割交代を開始（ブラウザー通知） |
| answers_published | LIVEの1問の答え公開。voting→reveal、review-question→review-answer（既存D1行の更新トリガー） |
| chat_messages_sent | LIVE通常チャットの保存成功。応援購入や非表示化／復元は数えない（既存D1行の挿入トリガー） |

LIVEのトリガーは元の書き込みと同じトランザクション。ポーリング、再表示、既出回答の前後移動は加算しない。
通常版の通知は回答完了済み参加者の既存トークンをサーバーで検証し、列挙した4種以外は拒否する。
トークンは認証に使うだけで集計には書かない。同一トークンの通知は固定1分12件まで。
ブラウザーは1ページ寿命・1回答試行・1指標につき1回だけ送信し、再挑戦時は新たに数える。
リロード、別タブ、別端末をまたいだ重複排除ではない。通信断・ブロッカーで欠測し得る。JS通知失敗でプレイは止めない。
SQLトリガーとブラウザー通知の完全性は区別する。過去分のバックフィルはしない。
`play_daily_actions_meta.started_at` からの部分期間として診断する。

## 通常版ルーム作成の連続アクセス制限

対象は `POST /api/challenge/rooms` だけ。同一Cloudflare接続元IP・固定1分60回まで。
61回目以降は429とRetry-After。GET、通常回答、LIVE定期通信、Stripe Webhookはこの制限の対象外。
既存D1 `live_rate_limits` に原子的UPSERTで加算し、時間窓を含むハッシュだけを保存する。
有効期間2分、既存の毎時Cronで期限切れを削除するため物理削除には最大約1時間の遅れがある。
CF-Connecting-IPまたはD1のないローカルKV経路では作成制限を適用しない。本番はD1・Cloudflare経路。
共有IPや境界直前直後のバースト、分散アクセスには限界がある。エッジWAFルールの追加ではない。

## 適用・切り戻し

追加対象は `migrations/0028_play_daily_actions.sql` のみ。既存データの削除や書き換えはしない。
先にマイグレーションを適用し、対応Workerを通常デプロイする。
切り戻す場合は直前Workerバージョンへ戻す。集計表は残してよい。
追加トリガーを止める必要がある場合だけ `play_daily_answer_publish` と `play_daily_chat_send` をDROPする。
以前の `play_daily_counts`、元ゲーム行、購入DBやその設定は変更しない。
