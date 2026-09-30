# 個人情報を持たない日別プレイ集計

## 保存と定義

正本は既存D1 `streetboardgame-remote` の `play_daily_counts`。
長期保存する列は `day / mode / metric / count` のみ。日付はAsia/Tokyo。
名前、回答、点数、部屋コード、参加者ID、IP、Cookie、GA4識別子は含まない。
個人の重複排除をしないため「人数」ではなく「延べ回数」として報告する。
元のゲームデータの保存・削除期限は変更しない。

| metric | 通常版 challenge | LIVE live |
|---|---|---|
| rooms_created | 10問と正解の保存成功 | ゲーム保存成功 |
| participants_joined | 参加登録成功（再開は除外） | 視聴者参加登録成功 |
| plays_started | 各挑戦で最初の回答を受理（参加だけは除外） | 視聴者の最初の回答を受理 |
| plays_completed | 10問回答の完了（再挑戦を含む） | 設定された全問への回答完了 |
| retries | 完了済み挑戦のリセット成功 | 使用しない |
| rooms_started | 使用しない | lobbyからvoting/answeringへの遷移 |
| rooms_completed | 使用しない | completeへの初回遷移 |
| votes_recorded | 使用しない | 受理した回答数 |

LIVEの「全問回答」と「配信者の進行完了」は別指標。
月をまたぐ開始／完了があるので、同じ月の完了/開始は同一参加集団の完了率ではない。
GA4・Stripe売上とも別定義。購入や決済設定には触れない。
通常版の一括送信・逐次送信の双方を集計する。

## 集計経路

- D1の通常版・LIVEポーリング経路はSQLトリガーで、元の書き込みと一緒に確定する。
- 再送、結果の再表示、回答更新だけでは加算しない。元の書き込みのロールバック時は集計も戻る。
- LIVEリアルタイム経路は既存の回答保存トランザクションで数値だけを加算する。
  既存AlarmでD1に累積値を送る。単調増加UPSERTと差分トリガーで再送を二重計上しない。
- `play_daily_live_streams` は再送用の一時的カーソル。ランダムなシャード単位キー、
  日付、件数、期限だけを持ち、部屋・参加者・回答との対応を持たない。
  元の部屋期限の7日後から既存Cronで削除する。日別合計は削除しない。
- D1障害がゲームの元データ保持期限を延ばさないよう、期限時には数値だけを残して再送する。
  ただし7日以上の長期障害では再送カーソル保持期限を超える可能性があり、
  完全性を断定せず障害期間を併記する。

## 月次診断での読み取り

```powershell
$dailyPlayQuery = (Get-Content -Encoding UTF8 tools/query-play-daily.sql | Where-Object { $_ -notmatch '^\s*--' }) -join ' '
pnpm dlx wrangler@latest d1 execute streetboardgame-remote --remote --command "$dailyPlayQuery" --json
```

`--file` はリモート一括実行の概要だけが返る場合があるため、集計結果の取得には `--command` を使う。

指定期間（1日実行は暦月、16日実行は前月16日〜当月15日）で `day` を絞る。

```sql
SELECT mode, metric, SUM(count) AS count
FROM play_daily_counts
WHERE day >= '2026-10-16' AND day <= '2026-11-15'
GROUP BY mode, metric ORDER BY mode, metric;
```

`play_daily_meta` の `d1_started_at` / `realtime_started_at` と取得日時を必ず添える。
導入日、未完了の当日、導入前、障害期間は完全な1日として扱わない。
集計開始後の正常な完了日で行がなければ、その指標の保存済み件数は0。
導入前の行がないことを0件や「利用者なし」と解釈しない。
削除済みデータの復元や、不明な初回回答日時の推定バックフィルはしない。
本番でCodexが作成した検証データも、このカウンターでは自動除外できない。
検証はローカルで行い、本番に模擬プレイを作らない。

## 反映と復旧

既存の全マイグレーションは一括適用せず、この追加SQLだけを対象にする。
DBの既存行や他の設定は変更しない。先にローカル検証し、既存スキーマ・Workerバージョンを控える。
旧Workerはトリガーを含む保存件数に対応していないため、反映順序は
集計テーブル・ランダムカーソル用トリガー → 対応済みWorker → 残りのゲーム用トリガー。
戻す場合は先に `play_daily_%` のトリガーだけを削除し、Workerを直前のバージョンへ戻す。
保存済みの集計テーブルは削除しない。再適用時は開始時刻・停止期間を明記する。
