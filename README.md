# streetboardgame.com

「わたし理解度診断」（英語名 Know Me Quiz）の Web サイトです。友だちに自分の答えを当ててもらうクイズを作って、URL で送ります。

## 公開している画面

- トップ `/`・遊び方 `/challenge-guide`・About `/about`・製品版 `/product`
- クイズ `/challenge`（作る・答える・結果・理解度ボード）
- 10問パックのページ `/challenge/library/<パック>`（日本語・英語・スペイン語・ポルトガル語の9パック×4言語）。トップ・`/challenge`・パックのページの読みものは `src/content/` に言語ごとに書き下ろし、翻訳データを通しません（2026-11-16）
- 法務：利用規約 `/terms`・プライバシー `/privacy`・運営者情報 `/legal`・肖像権ガイド `/content-guidelines`・未成年者規定 `/minor-policy`
- 33言語で表示します。検索に出すのは日本語・英語・スペイン語・ポルトガル語で、ほかの言語は `noindex`、hreflang もこの4言語だけです（`src/i18n/locales.js` の `SEARCH_INDEXED_LOCALES`）。

LIVE 版は 2026-10-23 に終了し、2026-11-15 にプログラムと本番 DB の表を削除しました（購入は0件、表の控えは AI-HANDOFF/records/backup/wata-live-20261115/）。旧 URL は 410 を返します。

お題は共通のお題ライブラリ（既定のお題 `prototype_common_data.js` と、D1 の `question_catalog`）を使います。採用・無効化・編集・類似比較は `/question-ops`（Cloudflare Access ＋合言葉・二段階認証）で行います。

広告を導入する場合の表示位置は [docs/ADVERTISING_PLACEMENT_POLICY.md](./docs/ADVERTISING_PLACEMENT_POLICY.md) の4場面だけに限定します（AdSense は `ADSENSE_ENABLED` で切り替え）。

## 画面の作り方の方針（2026-11-15）

画面の作り方が2種類あります。

- React（`prototype_app.jsx`）：トップ・About・遊び方・製品版。組み立て時に HTML を先に作り、検索と表示の速さに効かせています。
- 文字列を組み立てる作り（`challenge_game.js`）：クイズの画面。

**新しい画面は React 側に作ります。** クイズの画面は直すときだけ今の作りのまま手を入れ、作り替えはしません。文言の翻訳は翻訳データ（`src/i18n/catalogs/*.json`）に一本化し、プログラムの中に英語だけの分岐（`isEnglish` など）を新しく増やさないでください。

## 開発

```powershell
pnpm install
node tools/build-translation-assets.mjs   # 翻訳データの作り直し（文言を変えたとき）
pnpm run build                            # 生成物（dist・locale-pages など）の作り直し
pnpm test                                 # 単体テスト＋画面テスト
```

- 生成物はリポジトリに保存し、そのまま本番に出ます。自動テストは作り直して差分が出ないことを確かめます。
- Worker の振り分けを含むローカル確認には `tools/test-server.mjs` を使います。
- 運用・プライバシーの設定は [docs/PRIVACY_OPERATIONS.md](./docs/PRIVACY_OPERATIONS.md)、公開の手順は [DEPLOY_CLOUDFLARE.md](./DEPLOY_CLOUDFLARE.md)、資料の一覧は [docs/README.md](./docs/README.md)。
