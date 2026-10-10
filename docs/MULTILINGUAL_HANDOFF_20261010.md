# 34ロケール化の監査・引継ぎ（2026-10-10）

## R2保全対象の更新（本人最新指示）

2026-10-10、本人判断で非公開バケット `streetboardgame-live-private` の素材取得・バックアップ調査・追加権限設定を中止し、今回はバックアップ対象外とした。バケット・既存素材は削除していない。Chrome調査待ちは解除。保存済みZIPとD1バックアップは保持する。この対象外素材を含むサイト全体の復元はGitHub・ZIP・D1だけで保証しない。

## 基準と保全

### 多言語実装の追加保存地点

- GitHub作業ブランチ `codex/multilingual-foundation-20261010` は `1f61b02b07d4240b8fe26a5f2978265a588d7c4f` へ実Push済み。Desktopのpush completeと `git ls-remote` の一致を確認。mainは引き続き `7d7840841a273cc290680f8e839f94b69aa88e93`。本番公開はまだ行っていない。
- 前の保存地点 `28f5dd8` では31カタログの固定文章55,607件を保存。その後も完成・草稿を継続保全。日本語・英語以外は公開対象に加えていない。翻訳は内部モデルによる機械生成で、母語校閲は未実施。
- 固定公開20ページを外部通信・D1なしでWorkerからローカル描画し、未収録の本文・SEO・構造化データ66件を検出。台帳 `data/translation-supplement-public-html.json` に固定文章のみ保存。この時点の台帳は3,157件。現在は後述の動的文章追加により3,161件を要求する。
- 実装段階の全unit257件成功。PC/スマホの既存日本語・英語E2Eは再実行して15件成功・3件想定skip。初回CI指定の起動は未導入のPlaywright headless_shellで失敗し、既存Chromeの専用ヘッドレス試験プロファイルに切り替えて成功した。使用中のChromeプロファイルは操作していない。
- 動的な表示復元ボタン・復元中表示・読み上げ文言4件も補足台帳へ追加。現在の必須台帳は基底3,091件＋補足70件＝3,161件。英語・スペイン語・フランス語・ドイツ語・イタリア語・ポルトガル語・オランダ語・スウェーデン語・ルーマニア語・フィンランド語の10カタログが各3,161件完成。母語校閲は未実施。残りは草稿で、実repoの公開一覧は日英のみを維持。
- 隔離した公開コード複製とローカルtest serverでスペイン語9ページをPC/320px/390px幅で検証。通常版10問作成、旧日本語質問snapshotへの10問回答、結果PNG、LINE/X用言語付きURL、LIVE作成・参加・開始も成功。仮名のみを使い、D1/本番データを参照せず、SNSへの実送信は行っていない。全34ロケールの完成・公開の証明ではない。
- その後スペイン語15公開ページの日本語残存・既訳原文残存を確認し、表示復元ボタンを翻訳。通常版の編集選択肢を翻訳表示し、無変更で保存すると原文snapshotを維持、実際の自作変更は保持するローカルフローも成功。LIVE10問の完走とPNG生成を確認し、長文画像ラベルの枠幅を修正し、生成PNGを再確認済み。
- 関連する通常版・LIVE・共有・SEO・計測除外E2EはPC/スマホ101件成功・19件想定skip。新しい編集保護・共有画像メタデータを含むunitは261件成功。ゲームとシェルの別bundleで個人入力保護を共有し、後処理後の独自選択肢保持も確認済み。各言語の固定共有プレビュー画像を既存色・キャラクター素材で描画するツールを追加し、スペイン語のみ一時フォルダへ試作。全32追加ロケールの画像生成・目視・本番SNS previewは未完了。
- 既存analyticsは本人除外、自動ブラウザー除外、クエリ・フラグメントを送らない設定を確認。追加言語の地域別同意方針・GTM外部設定は未確認のため、追加言語で外部計測を勝手に開始しない保留ガードを実装。海外セッション蓄積の有効化とGA4直近完了30日の国別・PV・mobile集計は未完了。新しい広告申請・配信設定は行っていない。
- 全34ロケールの実画面・作成/回答/結果/PNG/共有と本番検証、母語校閲、Cloudflare公開は残る。未完了を対応済みとは扱わない。

- 正規origin: `https://github.com/chiakijam-design/streetboardgame-site.git`。
- 実際に`ls-remote`、`fetch`したmain: `7d7840841a273cc290680f8e839f94b69aa88e93`。
- 同期前Mac: `dbe32acd1b436cad50b5fd7e7bb694aa7e413681`。未commitテスト1行修正は最新版GitHubと完全一致。別patchで保全後fast-forward。
- 旧Mac担当`01a0ffee-6947-7f72-9353-acff26468824`は`notLoaded`、DAIV担当`01a11605-da1f-70de-a8f5-60b3828bd023`は`idle`。旧Macの最終完了turnも読取確認。実行中の同repo担当はこの作業のみ（確認時点）。
- 公開トップHTMLはCSP nonceを除いてGitHub基準の`index.html`と完全一致。Worker全コード・全公開素材の同一性は未検証。
- デスクトップへ変更前コードのZIPを新規保存し、Git履歴bundle・ZIP CRC・別フォルダ展開・全ファイルSHA256を確認。秘密実値・利用者データをコードZIPへ含めていない。
- 変更前コードのunit 238件成功。既存依存を一時参照したオフラインbuild成功（依存再installは未検証）。PC/スマホの既存i18n E2Eは15件成功・3件想定skip。
- GitHub mainへ到達可能な3,642個のblobに秘密鍵、主要APIキー形式のheuristic検査を実施し一致なし。完全な秘密不在証明ではない。
- ゲーム用/購入用D1は既存権限で読み取りexportに成功し、非公開ローカルへ分離保全。R2は既存OAuth権限不足で未取得。新OAuth scopeやS3 keyは作成していない。
- D1/R2/KV/DO、Secrets、DNS、外部サービス、GA4/GTMを含む全体復元をGitHubやコードZIPだけで保証しない。本番書戻し/巻戻し試験は行っていない。

### ローカル保管の証拠

- 最終コードZIP: `/Users/apple/Desktop/streetboardgame-20261010T064746Z-pre-i18n-7d784084-verified.zip`。
- 56,314,544 bytes / 327 files / SHA256 `bcb1f548062b929d35a21e4f0246517d0ecdfee3a33b5235a75885cf01ea9d98`。作成時刻2026-10-10 06:47:46 UTC。先に作ったZIPも上書きせず残した。
- 別フォルダ展開後の全checksum、build、unit 238件も成功。buildは既存node_modulesを一時symlinkで参照したため、ZIP単独の依存installまでは保証しない。
- D1別保管: `/Users/apple/Streetboardgame-private-backups/20261010-7d784084/`。フォルダ700、SQLとmanifestは600。Desktop/Documents同期範囲へ利用者データを置いていない。実外部同期設定は未確定。
- ゲームSQL: 39,324,398 bytes / SHA256 `5b8377c384aa7b3ea03b5e8fd23ddd145f9014a9348507a71ea268d049fd0672`。購入SQL: 5,587 bytes / SHA256 `51828edea1fb30febd6a4786f31325a0d8a067616adf160cfeca7ca9fa0e4e52`。
- 各SQLのローカルSQLite importとintegrity_check=okを確認。2DBの同一時刻snapshot/DB間整合性や本番復元は未検証。R2、DO/KV、Secrets/外部設定は別途必要。

## Mac/DAIVの編集担当

当面Mac一本化。DAIV未Push差分は取得不能。DAIV復帰時は同期前にgit status/diff、未Push commit、未追跡/無視ファイルを保全し、Mac/GitHub最新版と比較する。強制reset/pushは行わない。

## 翻訳の実状態

参照先`/Users/apple/Documents/Codex/2026-10-10/task/minna-web-shindan/content/build-locales.json`を読取参照し、別repoは編集していない。

対象は`ja,en,es,fr,de,it,pt,ru,uk,pl,nl,sv,da,no,fi,cs,el,ro,hu,bg,hr,sk,tr,ar,he,hi,bn,id,ms,th,vi,ko,zh-Hans,zh-Hant`。34ロケール、中国語の2字体を1言語として33言語。

`src/i18n/locales.js`は対象一覧・母語名・RTL・安定URL・文脈を維持する切替とcanonical用のクエリ除外の土台。WorkerのHTML翻訳、ゲーム表示、画像/共有、公開カタログの厳格検証へ接続中。対象一覧と公開済み一覧は分離している。追加32ロケールは**未公開**で、翻訳完成と草稿が混在する。機械生成・母語未校閲を区別し、全画面の対応済みとはしていない。

`node tools/export-localization-source.mjs`で原文棚卸しを再生成できる。固定UI429件、日158問・英60問、HTML15ページと動的文言/PNG/共有/結果/同意等の原文を含む。文字列抽出はcoverage証明ではなく、全画面とAPIエラーの追加棚卸しが必要。生成物は`data/i18n-source-inventory.json`。

## 次の実装と公開条件

1. 32ロケールの翻訳catalogを作り、機械翻訳・母語未校閲を明記。固定文だけでなく動的template、設問/選択肢/カテゴリ/パック、称号/総評、PNG、LINE/X共有、エラー、法務/同意のcoverageを確認する。
2. 日英の既存お題ID/選択肢順序と保存データを維持して共通ライブラリへ翻訳を付与。過去roomの質問snapshotを勝手に差し替えず、名前/自作問題/回答/招待tokenを外部翻訳へ送らない。
3. 現`isEnglish`二択の処理と正規表現置換を明示locale/templateへ接続。ゲーム共通仕様は10問・通常版50人などを維持し、旧ゲームは復活させない。
4. Worker/Assetsのlocale安定ルート、SSRのHTML本文/title/description、canonical/hreflang/sitemapを実装。未翻訳localeはインデックス/対応済みに含めない。room/管理/ランキングはnoindex、管理tokenをメタデータ/計測へ出さない。
5. 言語切替でquery/hashの文脈とローカルdraftを保持。RTL（ar/he）、字体（hi/bn/th/ko/中国語）、長文、320pxを含むスマホとPCで主要導線を検証する。
6. 全画面・設問・共有・PNGの未翻訳検出、過去招待/回答互換テスト、build、関連unit/E2E、git diff確認後にGitHub保存と既存Cloudflare経路公開。本番は`analytics=exclude`で検証。

## 計測/Journey

現`analytics.js`は本番hostname限定、webdriverと`analytics=exclude`を除外し、page URLはquery/hashを除いて送る。`src/analytics/events.js`の定型イベント値には回答/名前/room/tokenを含めない。GA4 `540993260`、測定ID `G-X07PVDQWYX`、GTM `GTM-5VMKFTGP`は既存記録とコードで確認。

現コードに地域別同意判定は見当たらない。GTM内部の同意設定・実地域動作は未確認。海外計測を新規有効化/同意不要と断定していない。対応方針確認前にタグの対象地域や同意動作を変更しない。

直近完了30日の国別session/全PV/mobile割合は未取得。GA4接続APIが見つからず、他担当Chromeと競合を避けてブラウザー操作はしていない。取得時はproperty timezoneで完了した30日、missing/test除外の範囲を示す。米英加豪の合計を全対象国総数と扱わない。広告申請/配信はこの作業では行わない。

## 接続復旧後の差分保全

2026-10-10 21:24 UTC、実コマンドの起動と正規originのremote SHAを再確認。HEAD/remote作業ブランチは1f61b02、mainは7d784084。同repo作業プロセスは検出なし、旧MacタスクはnotLoaded。差分37ファイルを `/tmp/streetboardgame-resume-20261010T212423Z/` のZIP・binary patch・SHA256 manifestへ保存し、既存ファイルを上書きしていない。ZIP SHA256:786fbad3f309a9b3d93fce373e31fa6da8d0eac8ee9c57324d6729824432423c。patch SHA256:ece8b604180160debc48a86ff50f5241a7b942aa9d6839bca52e2bdefd390dcc。これは追加の一時保全で、公開素材へ含めない。

## モデル変更の保存境界（21:24 UTC復旧後）

通常コード修正はローカルcommit `7eaca47`。復旧後unit261件成功。E2E起動はsandboxのlisten EPERMで未実行（以前の成功と混同しない）。次回既存承認範囲で昇格して起動する。CLI Pushは通常権限でDNS制限、昇格後はUsername未設定で失敗。新しい認証は追加していない。GitHub Desktopの既存認証経路を利用する場合は本人のAdSense Chrome作業と競合を避ける。リモート確認済みは1f61b02、公開main7d784084、今回のCloudflare公開はなし。

現在のcatalog検証はすべてplaceholder/unknownエラー0。公開一覧は日英のみ。保存件数/残数：
- en: 3161/3161、残り0。
- es: 3161/3161、残り0。
- fr: 3161/3161、残り0。
- de: 3161/3161、残り0。
- it: 3161/3161、残り0。
- pt: 3161/3161、残り0。
- ru: 2800/3161、残り361。
- uk: 2800/3161、残り361。
- pl: 2800/3161、残り361。
- nl: 3161/3161、残り0。
- sv: 3161/3161、残り0。
- da: 2970/3161、残り191。
- no: 2970/3161、残り191。
- fi: 3161/3161、残り0。
- cs: 2800/3161、残り361。
- el: 2749/3161、残り412。
- ro: 3161/3161、残り0。
- hu: 2812/3161、残り349。
- bg: 2800/3161、残り361。
- hr: 2800/3161、残り361。
- sk: 2800/3161、残り361。
- tr: 2749/3161、残り412。
- ar: 2749/3161、残り412。
- he: 2749/3161、残り412。
- hi: 2749/3161、残り412。
- bn: 2749/3161、残り412。
- id: 2961/3161、残り200。
- ms: 2961/3161、残り200。
- th: 2961/3161、残り200。
- vi: 2961/3161、残り200。
- ko: 3091/3161、残り70。
- zh-Hans: 3091/3161、残り70。
- zh-Hant: 3091/3161、残り70。

全件未完了のカタログを公開対象へ加えない。次回は残件翻訳後、tools/build-locale-share-images.mjs、tools/build-translation-assets.mjs、build、unit、multilingual/i18n/関連E2Eを最終成果で実行し、既存GitHub経路保存・CI・Cloudflare通常公開・本番PCスマホ確認へ進む。母語校閲未実施、追加言語計測同意・GA30日集計未確認。現在の専用ヘッドレスE2Eは使用中Chromeプロファイルを操作しないが、親最新指示に従いChrome利用前に調整する。

## 2026-10-10 完成カタログ・検証中の追記

上記の残件件数は過去の保存境界です。現在、33非日本語カタログは各3,161件（計104,313件）完成。欠落・未知ID・数値/名前付き置換文字不一致0、予期しない日本語・長い英語pivot残の読取監査0。機械生成、母語未校閲。strict packで34ロケール、510安定URL、32共有PNGを生成しました。PC/スマホ全34ロケールE2Eと510ページSSR、関連テストを最終確認中で、翻訳版の本番公開はまだです。

別件の本人承認済みAdSense所有タグのみPR #15を先にmerge・公開しました。main SHA c8b0d67f27383a235c01dad99fe86aa219292003。CI成功、2026-10-10T21:58:40Z本番6公開URLでHTTP200・指定タグ一つを確認。広告配信スクリプトは追加していません。翻訳branchへmainを統合するときはこの指定タグも保持します。

GA4 property540993260を既存Chromeで読取確認できました。集計エビデンスは非公開/tmpへ保存（リポジトリには集計値を公開しません）。日本時間の直近完了30日、国別セッション・全PV・mobile表示割合を読み、一時レポート変更は破棄、保存していません。過去の本人/テスト除外完全性と地域同意は未確認。追加32ロケールは同意方針確認まで外部解析タグを停止したままです。Journeyの申請・Grow導入は実施していません。

復元範囲は先述の検証済みコードZIPと別管理D1エクスポートのみ。R2は本人指示で対象外、取得/権限追加/削除なし。DAIV未Push差分は取得不能、編集担当Mac一本化、復帰時に差分と未追跡/無視ファイルを保全してから同期、強制reset/push禁止を維持します。

## 最終ビルドの保存境界

動的人数の具体的な文を汎用人数テンプレートより先に翻訳する修正と、アクセス解析除外通知2文を追加しました。33カタログは各3,163件（計104,379件）、strict検査と生成成功、unit265件成功。34ロケール・510公開URL・32共有PNGを維持しています。機械生成・母語未校閲です。最新ビルドのPC/スマホ34ロケールE2E、RTL/字体/長文の通常作成とLIVE回答・結果PNGを専用ヘッドレス環境で実行中。使用中Chromeプロファイルは親へ返却済みです。最終CI・本番公開・本番検証の確定結果はPR #16と完了報告を参照してください。旧検証結果を最新公開済みとは扱いません。
