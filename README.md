# streetboardgame.com

『私のこと、ちゃんと分かってるよね？』彼氏の愛情判定ゲームの公式サイト。

## 構成

純粋な静的サイト (HTML + JS + 画像) で、Cloudflare Pages 等の静的ホスティングにそのままデプロイできます。

| ファイル | 役割 |
|---|---|
| `index.html` | エントリポイント。OGP / GA / ルーティングロジック含む |
| `prototype_app.jsx` | メインアプリの編集元 |
| `prototype_character.jsx` | キャラクター画像コンポーネント |
| `dist/` | 事前変換済みの本番配信用JavaScript |
| `prototype_quiz_data.js` | 全42問のお題カードデータ |
| `favicon.svg` | favicon |
| `assets/cards/` | お題カード画像 42 枚 |
| `assets/character/` | キャラクター画像 3 枚 |
| `assets/ogp.jpg` | SNSシェア用OGP画像 |
| `_redirects` | Cloudflare Pages のリライト設定 |
| `_headers` | Cloudflare Pages のHTTPヘッダー設定 |

## ローカル動作確認

初回のみNode.jsとpnpmを用意し、依存関係をインストールします。

```bash
pnpm install
```

`prototype_app.jsx`または`prototype_character.jsx`を変更したら、本番配信用JavaScriptを再生成します。

```bash
pnpm run build
```

`index.html`を直接ブラウザで開いても動きません。代わりに簡易HTTPサーバーで配信してください。

```bash
cd streetboardgame-site
python -m http.server 8000
# http://localhost:8000 で開く
```

## デプロイ

`DEPLOY_CLOUDFLARE.md` を参照。

## 更新の流れ

1. JSXを編集した場合は`pnpm run build`を実行
2. 編集元と`dist/`を一緒にコミットしてgit push
3. Cloudflare Pagesが静的ファイルを配信し、1〜2分で本番反映

Codexで作業するときは `CODEX_PROJECT.md` も参照してください。

## ライセンス / クレジット

- フォント: Google Fonts (Klee One, Zen Maru Gothic, RocknRoll One, DotGothic16, Noto Sans JP)
- イラスト: パッケージオリジナル

© 2026 streetboardgame.com
