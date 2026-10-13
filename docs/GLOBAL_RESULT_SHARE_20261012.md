# ワタちゃん・世界向け結果共有（2026-10-12、ローカル保存）

対象はこのrepoの通常版とLIVE視聴者の結果画面。みんなのWeb診断repoは変更していない。

## 実装と承認対象

- 主ボタン「結果を共有」は端末・国を推測せずWeb Shareの機能判定で呼ぶ。結果PNGを事前準備し、ユーザー押下からHTTP通信や字体待ちを挟まない。通常版で任意のボード掲載設定を変更した場合は設定更新後に再押下を案内する。
- 常設「リンクをコピー」「結果画像を保存」。コピー失敗時も既存の言語付き参加URLを読み取り専用欄から手動コピーできる。
- X／LINE／WhatsAppは本文とURLのHTTPS共有先。インストール済みアプリや選択アプリ、投稿成功は判定しない。WhatsAppは `https://wa.me/?text=`、画像添付は別操作と明記。
- Instagramは補助欄で画像保存と文章コピーを維持。既存の結果カード描画と通常版・LIVEの参加URLを再利用し、名前・回答・room・管理tokenを解析へ渡さない。
- secure contextとWeb Share APIを確認し、`canShare({files})` と画像＋本文＋URLの判定を行う。非対応／エラー時はリンク共有かコピー・保存へ案内。AbortErrorで成功表示しない。連打を抑止し、ページ離脱時に操作ロックを解除。古い共有Promiseが戻ってきても新しい操作を解除しない。
- 定型 `result_share_action` のaction／outcomeのみを既存計測ガード経由で記録。押下、引渡し、キャンセル、コピー完了、保存要求、外部画面を開く要求を投稿完了と呼ばない。既存の同意・本人除外・`analytics=exclude`・追加32ロケールの計測OFFは変更していない。
- 新規固定文6件を全33翻訳カタログに収録（日本語を含め34ロケール）。機械生成、母語校閲なし。既存ゲーム仕様、人数、回答保存、点数、課金・広告・DNS・権限は変更していない。
- ハッシュ付きJS、翻訳配信カタログ、561の静的ローカライズHTMLとmanifestは既存ビルド経路で再生成。大きな生成差分は各HTMLが参照するカタログのハッシュ更新を含む。

## 基準・保全・作業競合

- 初期checkout：`codex/localized-pack-image-labels-20261011` / `97a3c90e56662387eb70468f0bc375eb67232260`、差分なし。
- 正規origin：`https://github.com/chiakijam-design/streetboardgame-site.git`。
- 読取後fetchしたmain：`dff149721a458cbec12483bb74c058b0b832aac9`。初期HEADとファイル内容は同一、追加はmerge commit。
- 作業ブランチ：`codex/global-result-share-20261012`。push／公開は承認対象差分と検証結果を返した後の別工程。
- 変更前Git履歴：`/tmp/wata-pre-global-share-20261012.bundle`、61,770,901 bytes、SHA256 `bbbd0148b1d2a195b3bf4416afd141a7009cb005ffbf08dd09e01a936c1c2253`。初期checkoutの履歴保全でありD1/R2/Secrets/外部設定のバックアップではない。既存RESTORE_GUIDEとDAIV同期時差分確認・強制reset/push禁止の引継ぎを維持。
- repo AGENTSを再読。repoと確認した上位フォルダに追加 `.agents/skills` は見つからなかった。旧Mac担当notLoaded、DAIV担当idle、コテージ復旧は別DAIV作業。同repoの他処理を停止・上書きしていない。Nodeプロセス名とcwdも読取確認。
- 正式なブラウザー操作ツールはこのターン未提供。本人ChromeとStripeタブを操作せず、専用自動Chromeプロファイルで検証。実機OS共有、実SNS投稿、Cloudflare／D1の本番変更と本番動作は未確認。

## 検証

- 翻訳検査：33カタログ各3,169件、欠落・placeholderエラー・未知IDは0。
- 最終unit：274件成功。HTTPS／activation／desktop対応、ファイル非対応、組合せ非対応、キャンセル、拒否、WhatsApp URL、全locale文言を含む。
- 全34ロケール×PC／スマホChrome：旧日本語招待、私的文章保護、10問回答、PNG、OS共有payload、URLコピー、WhatsApp本文URL、横はみ出し検査の68件成功（13.3分、worker 1）。このmatrixは共通文言と画像／URL経路を検証。その後の離脱ロック補強とHTTPS SNS補助変更も最終回帰試験で確認した。
- 最終回帰：PC／スマホ各6件、合計12件成功（2.8分）。OS共有のcancel／連打／離脱復帰／古いPromise、copy失敗と手動URL取得、通常版・LIVEの10問完走とPNG共有、理解度ボード、英語UI、既存計測除外とイベントを確認。初回英語試験は旧配信カタログ参照で1件失敗。翻訳assetsをpackaging後にbuildし直した。失敗を成功として数えていない。
- PC／スマホの日本語・ドイツ語・アラビア語・ヒンディー語共有パネルを `/tmp/wata-global-share-{ja,de,ar,hi}-{pc,mobile}.png` に保存。機械翻訳の自然さの母語評価ではない。
- package.jsonに独立したlint／typecheckスクリプトはない。構文検査、esbuild、unit／E2Eを実行。既存React `fetchPriority` 警告あり。

## 実行した保全・検証コマンド

診断用の `rg`、`cat`、`sed`、`ls`、`stat`、`tail`、`git status/diff` と、toolによるパッチ／Python編集も実施。以下は実行した保全・構文・ビルド・テストコマンド全文。`node`／`pnpm` は標準PATHにないため既存同梱Nodeを使用した。依存の新規installなし。

```sh
git remote -v
git branch --show-current
git rev-parse HEAD
git status --short
git ls-remote origin refs/heads/main
git bundle create /tmp/wata-pre-global-share-20261012.bundle --all
git bundle verify /tmp/wata-pre-global-share-20261012.bundle
git fetch origin main
git log --oneline HEAD..origin/main
git diff --stat HEAD origin/main
git switch -c codex/global-result-share-20261012 origin/main
shasum -a 256 /tmp/wata-pre-global-share-20261012.bundle
ps -axo pid,comm | rg 'node|wrangler|playwright|Codex|ChatGPT'
lsof -a -c node -d cwd -Fn
export PATH='/Applications/ChatGPT.app/Contents/Resources/cua_node/bin:/usr/bin:/bin:/usr/sbin:/sbin'
node --check challenge_game.js
node --check live_challenge.js
node --check src/platform/resultShare.js
node tools/check-translation-catalogs.mjs
node tools/check-translation-catalogs.mjs --json > /tmp/wata-global-share-translations-final.json
node tools/build-translation-assets.mjs
node tools/build-js.mjs
node --test tests/unit/result-share.test.mjs
node --test tests/unit/*.test.mjs
node node_modules/@playwright/test/cli.js test tests/e2e/global-result-share.spec.mjs tests/e2e/i18n.spec.mjs --project=desktop-chrome --workers=1
node node_modules/@playwright/test/cli.js test tests/e2e/multilingual.spec.mjs --grep 'old Japanese invitation' --project=desktop-chrome --project=mobile-chrome --workers=1
node node_modules/@playwright/test/cli.js test tests/e2e/global-result-share.spec.mjs tests/e2e/i18n.spec.mjs tests/e2e/two-modes.spec.mjs tests/e2e/live-stream-challenge.spec.mjs tests/e2e/analytics.spec.mjs tests/e2e/analytics-game-events.spec.mjs --grep 'OS share|英語参加者は10問|出題者10問→|streamer and viewer answer|計測除外|通常版の実プレイ' --project=desktop-chrome --project=mobile-chrome --workers=1
for f in src/platform/resultShare.js src/platform/share.js challenge_game.js live_challenge.js tests/unit/result-share.test.mjs tests/e2e/global-result-share.spec.mjs tests/e2e/multilingual.spec.mjs tests/e2e/two-modes.spec.mjs tests/e2e/i18n.spec.mjs tests/e2e/live-stream-challenge.spec.mjs; do node --check "$f" || exit; done
git diff --check
git branch --unset-upstream
git add -A -- challenge.html challenge_game.js live_challenge.html live_challenge.js data/translation-supplement-public-html.json data/result-share-translations.json src/i18n/catalogs src/generated/public-locale-pages.js src/platform/resultShare.js src/platform/share.js dist locale-assets locale-pages tests/e2e/global-result-share.spec.mjs tests/e2e/i18n.spec.mjs tests/e2e/live-stream-challenge.spec.mjs tests/e2e/multilingual.spec.mjs tests/e2e/two-modes.spec.mjs tests/unit/result-share.test.mjs docs/GLOBAL_RESULT_SHARE_20261012.md
git diff --cached --check
git diff --cached --stat
git commit -m "Unify result sharing across all supported locales"
git status --short
git rev-parse HEAD
lsof -i :4173 -sTCP:LISTEN -Fn
```

buildは初回・UI更新後・translation packaging後・最終差分で計4回、unit全体は初期273件と最終274件などで実施。E2Eの直列workerを重複起動せず完了を回収した。全ログは `/tmp/wata-global-share-{unit-final,build-final,e2e-locales,e2e-final}.log` にある。

最終試験は全て終了コード0で回収。ローカル試験サーバー4173のLISTENなしも確認。新規子エージェントは起動していない。

## 参考

- https://web.dev/articles/web-share （HTTPS／押下条件／filesの機能判定）
- https://faq.whatsapp.com/5913398998672934 （公式click to chat。本文取得は制限あり、公式指定のwa.me方式を採用）
