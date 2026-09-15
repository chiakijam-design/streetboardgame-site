# インデックス・操作障害の是正（2026-09-16）

## 調査対象と確認事実

- Streetboardgameのみ。作業開始時は `main` / `b7c08be`、未コミット変更なし。
- Search Consoleは `chiaki.jam@gmail.com` の `sc-domain:streetboardgame.com` をChromeで確認。
  - レポート最終更新2026-09-04。404は `/play`（最終クロール8/2）、`/ボードゲームをプレイ`（8/14）の2件。
  - 本番で両方404。現行コードの内部リンク・sitemapには該当URLなし。Bing履歴では `/play` は旧Wixからの送信URL。
  - 廃止ページを復活・無関係なトップへ転送せず404を維持する。正しい404を「修正済み200」として検証申請しない。
- Bing Site Scan `Streetboardgame 2026-09-01`（ID `6947d030-fa6b-4117-8c3e-bbc856fb774d`）でH1なし5ページを確認。
  - `/`、`/challenge`、`/challenge-guide`、`/about`、`/product`。
  - 修正前の本番HTML：トップは既にH1あり、通常版はnoscript外にH1なし、紹介3ページはトップのH1を返しJSで差し替えていた。
- Clarity `y40ha6gkld` の「過去3日間」画面：47セッション、デッドクリック21セッション（44.68%）、JSエラー0。
  - 9/14 18:43のMobileSafari / iOS 18 / 393×695の録画を再生。00:55・00:58のデッドクリック前後に、問題カード面へのタップと下部の色ボタンへの押し直しを確認。
  - 当時のカードはSVG表示のみで、回答イベントは下部5色ボタンにしか付いていないことを現行コードでも確認。
  - サンプル1録画による特定であり、21セッション全件が同一原因だとは断定しない。文字列は録画でマスクされており、選択肢の文言は推測しない。
  - 個人名、位置情報、ユーザーID、部屋コード、管理トークン、録画の生データはこの記録へ保存しない。
- Bing IndexNowは旧Wix送信履歴のみで、直近22時間0件。現行サイト用の送信手段を追加。

## 修正

1. 紹介3ページは既存Reactコンポーネントをビルド時に静的描画し、Workerが初期HTMLへ挿入。別文面のSEO専用コピーは作らない。
2. 通常版の初期プレースホルダーに可視H1を追加。JS描画後は置き換わり、H1は1つだけ。
3. 通常版の作成・回答カードで、5つの選択肢行をタップ可能にした。下部5色ボタン・ブランド・ふい字は維持。既存回答関数を共用し、送信中は両操作面を無効化。
4. 変更したページのsitemap更新日を更新。
5. IndexNow所有確認用テキストファイルと `tools/submit-indexnow.mjs` を追加。送信前に本番sitemapの全URLが200・自己canonical・noindexでないことを確認し、クエリ付き部屋URLは送信しない。既定はdry-run、`--submit`指定時のみ送信。
6. PlaywrightにiPhone 13相当のWebKitプロジェクト `mobile-safari` を追加。実機iPhoneそのものではない。

## 検証・公開

- 単体テスト203件成功。新規のH1/404/カードタップ完走テストは3環境9件成功。
- 旧レイアウトテストは、先のLCP修正前の「API待ちの間ずっとplaceholder」という前提だったため、JS読込前の領域確保とAPI待ちの開始フォーム安定性を検証する内容へ更新。
- 既存回帰を含む189件の実行は166成功・19対象外・4失敗。失敗は旧レイアウト期待値3件とnoscript内の重複H1 1件で、いずれも修正後に再検証した。通常版・LIVE版の10問完走はWebKit／PC Chrome／モバイルChromeで成功。
- 最終の関連テスト再実行は16成功・2対象外（モバイルで重複するサイトマップ／英語LCPの検証をスキップ）。初期HTML、5ページのH1、旧404、カードタップ完走、二重送信防止、掲載初期OFF、レイアウト安定性を確認。
- build、構文確認、git diff --check成功。レイアウトテストは外部Google Fonts CSSを隔離し、アプリ内の相対位置でカタログ取得前後を比較する。
- `pnpm dlx wrangler deploy --keep-vars` で本番反映。バージョン `a2c524a7-9237-4056-b832-f38a7bc786e1`。既存ダッシュボード変数を保持。
- 本番の対象5ページすべてが200・ページ固有H1。旧2URL、および `/src/generated/info-pages.js`、`/tools/submit-indexnow.mjs`、`/package.json` は404を維持。
- IndexNowへ現行sitemapの20URLを送信。初回202（キー検証待ち）後、再確認送信でHTTP 200を確認。結果はローカルの `build/indexnow/2026-09-15T23-01-03-741Z.json` に保存。全20URLの200・自己canonical・index可能と所有確認ファイルを送信前に検証済み。200は受付成功であり検索掲載完了ではない。
- Bingで対象5URLの再スキャン `Streetboardgame H1 recheck 2026-09-16` を実行しCompletedまで確認。ID `95000add-658b-4af0-87e2-770a7273528c`。5ページ、Errors 0、Warnings 0、All Issuesは `No issues found`（0行）。H1なしの指摘は今回の再スキャンで解消。メール通知はOFF。

## 影響・復旧

- 公開先・DNS・DB構造・権限・CSP・料金設定の変更なし。通常の既存Workerへの修正デプロイのみ。
- 反映前の最新本番バージョンは `4ecffe83-b568-4851-8019-1d663293f930`（2026-09-15T22:20:33Z）。
- 復旧：このバージョンへWorkerをロールバック、または今回コミットをrevertして既存経路で再デプロイする。DBマイグレーションはない。
- IndexNowの受付は検索掲載の保証ではない。GSCの古い診断表示は再クロール・再集計待ちになる。廃止URLの正しい404は表示が残っても現行ページの障害ではない。Bingの9/1の旧スキャンは履歴として残る。
- 実機iPhoneのSafari、OS共有シート、実決済は今回のローカルWebKit検証の対象外。

## 公式資料

- Google 404: https://support.google.com/webmasters/answer/2445990
- Bing H1と構造: https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a
- IndexNow送信・HTTP結果: https://www.indexnow.org/documentation
