# streetboardgame.com 完全バックアップ 復元方法ガイド

**バックアップ作成日**: 2026年7月6日
**対象**: `streetboardgame.com` サイト一式 (Cloudflare Pages / Workers上で動作)

---

## このバックアップの中身

```
backup_2026-07-06/
├── RESTORE_GUIDE.md          ← このファイル
└── site/                     ← サイト全ファイル (GitHubリポジトリの完全ミラー)
    ├── index.html            ← エントリポイント (GA計測ID・OGP・ルーティング含む)
    ├── 404.html              ← index.html のコピー (SPAフォールバック用)
    ├── prototype_app.jsx     ← Reactアプリ本体 (画面全部)
    ├── prototype_character.jsx  ← キャラクター描画コンポーネント
    ├── prototype_quiz_data.js   ← 42問のお題カードデータ
    ├── favicon.svg           ← ファビコン
    ├── _headers              ← Cloudflare HTTPヘッダー設定
    ├── _redirects            ← Cloudflareリダイレクト設定
    ├── _worker.js            ← Cloudflare Worker (ルーティング用)
    ├── wrangler.jsonc        ← Cloudflare Worker 設定
    ├── .gitignore            ← Git除外設定
    ├── README.md             ← リポジトリのREADME
    └── assets/
        ├── ogp.jpg           ← SNSシェア用画像 (1200×630)
        ├── character/
        │   ├── girl-default.png  ← 上半身、青チップ持ち
        │   ├── girl-upper.png    ← 上半身、カードのみ
        │   └── girl-full.png     ← 全身
        └── cards/
            ├── 1.png 〜 42.png   ← お題カード42枚
```

---

## サイトの構成

```
ユーザー
   ↓
https://streetboardgame.com
   ↓ (DNS: Cloudflare が管理)
Cloudflare Pages/Workers
   ├─ streetboardgame.chiaki-jam.workers.dev (Worker URL)
   └─ GitHub リポジトリと連携して自動デプロイ
   ↓
GitHub: chiakijam-design/streetboardgame-site
   ↓ (このバックアップの内容と同一)
Xserver Domain (ドメイン管理のみ)
```

**関連サービス**:
- Google Analytics 4 (計測ID: `G-X07PVDQWYX`)
- Google Search Console (認証済み)
- Formspree お問い合わせ受信 (`https://formspree.io/f/xrevejjr`)

---

## 復元シナリオ別ガイド

### シナリオA: GitHubリポジトリ上のファイルを間違えて壊した

1. https://github.com/chiakijam-design/streetboardgame-site を開く
2. 壊れているファイルを特定
3. GitHub Web UIで編集: ファイルクリック → 鉛筆アイコン → 中身削除 → バックアップの同ファイル内容を貼り付け → Commit
4. Cloudflare Pagesが自動再デプロイ (1〜2分)

**画像ファイルの場合**: GitHubで該当ファイル削除 → 「Add file」→「Upload files」でバックアップからアップロード → Commit

---

### シナリオB: リポジトリ全体を作り直す

1. GitHubで新規リポジトリ作成
   - Repository name: `streetboardgame-site` (元と同じ推奨)
   - README/`.gitignore`/License は **入れない**
2. 「uploading an existing file」をクリック
3. **`site/` フォルダの中身**をドラッグ&ドロップ (フォルダ自体ではなく中身)
4. Commit
5. Cloudflare Pages で新しいリポジトリを連携
6. 動作確認

---

### シナリオC: サイトが完全に落ちた場合の緊急復旧

**確認順**:

1. **Cloudflare Pagesの状態確認**
   - https://dash.cloudflare.com → Workers & Pages → `streetboardgame`
   - 最新デプロイが Success か
2. **ドメインDNSの状態確認**
   - Cloudflare ダッシュボード → Domains → `streetboardgame.com`
   - ステータスが「Active」か
   - DNS Recordsで `streetboardgame.com` と `www` のCNAMEが `streetboardgame.chiaki-jam.workers.dev` を指しているか
3. **カスタムドメイン紐付け確認**
   - Workers & Pages → `streetboardgame` → Domains タブ
   - `streetboardgame.com` と `www.streetboardgame.com` が Production として並んでいるか
4. **Xserver Domain のネームサーバー確認**
   - `evangeline.ns.cloudflare.com` / `zod.ns.cloudflare.com` になっているか

原因不明ならシナリオBで作り直すのが確実。

---

### シナリオD: 特定ファイルを誤編集した (rollback)

**GitHub履歴から**: GitHub → 該当ファイル → 「History」→ 動いていたコミットを選ぶ → 中身をコピー → 現在のファイルに貼り付け → Commit

**バックアップから**: `site/` の該当ファイルを開いて中身コピー → GitHubで該当ファイル編集 → 全削除 → 貼り付け → Commit

---

## Codex や別のエディタで編集する場合

このバックアップフォルダをローカル作業ディレクトリとして使えます。

### セットアップ

1. `backup_2026-07-06/site/` を任意の場所にコピー
   - 例: `~/Documents/streetboardgame-site/`
2. VSCode などで開く
3. Codex や別のAIに以下の情報を伝える:

```
このフォルダは streetboardgame.com のソースコード完全ミラーです。
本番は Cloudflare Pages + GitHub 自動デプロイで運用しています。

- ホスティング: Cloudflare Pages/Workers (chiaki-jam アカウント)
- GitHub: chiakijam-design/streetboardgame-site
- ドメイン管理: Xserver Domain
- DNS: Cloudflare
- お問い合わせ: Formspree (https://formspree.io/f/xrevejjr)
- 計測: GA4 (G-X07PVDQWYX)

編集後は GitHub にプッシュすることで本番デプロイされます。
```

### 変更 → 本番反映の流れ

1. ローカルで編集
2. GitHub にpush (git CLI / GitHub Desktop / Web UI に手動アップロードのいずれか)
3. Cloudflare Pages が自動で再デプロイ (1〜2分)
4. `https://streetboardgame.com` で確認

### ローカルでプレビューする方法

`index.html` をブラウザで直接開いても動きません(CDN読み込みのCORS制約)。簡易HTTPサーバーが必要:

```bash
# Python 3
cd site/
python3 -m http.server 8000
# → http://localhost:8000 でアクセス

# Node
npx serve site/
```

---

## 主要ファイルの役割

### `index.html`
エントリポイント。以下を含む:
- OGP メタタグ (SNSシェア時の見た目)
- Google Analytics 4 スニペット (`G-X07PVDQWYX`)
- URL ルーティング用 JS (`?screen=intro` などのクエリで初期画面切替)
- React + Babel の CDN 読み込み

### `prototype_app.jsx`
アプリ本体。以下の画面を含む(1ファイル完結):
- TopScreen (トップ)
- IntroScreen (遊び方)
- PlayScreen (クイズプレイ、girl/boy/reveal 3フェーズ)
- ResultScreen (結果、スコア別6段階)
- AboutScreen (About + Formspree お問い合わせフォーム)
- ProductScreen (商品紹介、Amazon誘導)

### `prototype_character.jsx`
女の子キャラクターの描画コンポーネント (`<Girl variant="full|default|upper|happy|smile|wink|pout" />`)

### `prototype_quiz_data.js`
- `window.COLOR_OPTIONS`: 5色チップ定義 (緑/青/黄/赤/橙)
- `window.ALL_CARDS`: 42問のお題カード配列
- `window.pickRandomCards(n)`: Fisher-Yatesシャッフルでランダム抽出

### `_worker.js`
Cloudflare Worker のルーティングコード。現在は基本的な処理のみ。

### `wrangler.jsonc`
Worker設定。`assets.directory` で静的ファイル配信、`not_found_handling: "single-page-application"` でSPAフォールバック。

---

## 重要な認証情報一覧

| 項目 | 値 |
|---|---|
| ドメイン | `streetboardgame.com` |
| GitHub アカウント | `chiakijam-design` |
| GitHub リポジトリ | `streetboardgame-site` |
| Cloudflare アカウント | `Chiaki.jam@gmail.com` |
| Cloudflare Worker URL | `streetboardgame.chiaki-jam.workers.dev` |
| Cloudflare ネームサーバー | `evangeline.ns.cloudflare.com` / `zod.ns.cloudflare.com` |
| Xserver Domain アカウント | (別途管理) |
| GA4 計測ID | `G-X07PVDQWYX` |
| Formspree エンドポイント | `https://formspree.io/f/xrevejjr` |

パスワードは各サービスに別途保管してください。

---

## よくある更新パターン

### お題カード追加
1. `site/assets/cards/43.png` を追加
2. `site/prototype_quiz_data.js` の `ALL_CARDS` 配列に追記:
   ```js
   { id: 43, image: 'assets/cards/43.png', title: '...', choices: ['...', '...', '...', '...', '...'] },
   ```

### テキスト・レイアウト変更
`site/prototype_app.jsx` の該当箇所を編集

### キャラクター差し替え
`site/assets/character/` 内の画像を上書き

### 新シリーズ追加 (友達の友情判定 など)
1. カード画像を `site/assets/cards/friend/` などに分けて配置
2. `prototype_quiz_data.js` にシリーズ選択機構を追加
3. TopScreen の "COMING SOON" 部分を書き換え

---

## 更新履歴

- **2026-07-06**: 初回バックアップ作成
  - サイト状態: Cloudflare Pages + カスタムドメイン `streetboardgame.com` で運用中
  - 全機能実装済み(お題カード42枚 / キャラクター3種 / GA4 / Formspree / SNSシェア)

---

## 何か問題があったら

このガイドで解決できない状態になった場合、以下を用意して対応可能な人に相談:

1. 症状の詳細(いつから、何をしたら、何が表示されるか)
2. `https://streetboardgame.com` にアクセスした時のブラウザ画面のスクショ
3. Cloudflare ダッシュボードの該当プロジェクト画面のスクショ
4. F12 → Console と Network タブのスクショ
