# 34ロケール化の監査・引継ぎ（2026-10-10）

## 基準と保全

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

`src/i18n/locales.js`は対象一覧・母語名・RTL・安定URL・文脈を維持する切替とcanonical用のクエリ除外の土台。現在の公開日英ルートやゲーム動作への接続はまだ行っていない。対象一覧と公開済み一覧は分離している。追加32ロケールは**未翻訳・未公開**。既存英語も今回の全画面棚卸し/母語校閲済みとはしていない。

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
