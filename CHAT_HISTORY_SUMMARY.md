# streetboardgame.com リデザイン + 移行プロジェクト 開発ログ

**期間**: 2026年6月頃 〜 7月6日
**成果物**: `https://streetboardgame.com` (Cloudflare Pages 上で動作)

このファイルは、Geneparkチャット上で行った全ての設計判断・実装・トラブル対応の記録です。
Codex や別のエディタで作業を引き継ぐ際、このドキュメントを最初に読ませれば、プロジェクトの意図が理解できます。

---

## プロジェクト背景

- 元サイト: Wixで作られた `streetboardgame.com`
- コンテンツ: 無料で遊べるボードゲーム『私のこと、ちゃんと分かってるよね？』彼氏の愛情判定編
- 現状の問題: クイズが静的画像のみ、Wixの料金がかかる、モバイル体験が微妙
- ゴール: Wixから離脱、モダンなモバイルファーストにリデザイン、実プレイ可能に

---

## 主な設計判断

### デザイン方向性
3つの方向性を検討 → **案A「ピュア・ロマンス」** をベースに開発:
- 案A: ペールピンク+クリーム / Klee One / 少女漫画的
- 案B: ビビッドピンク+黒太線 / メンフィス風 / Z世代向け
- 案C: Y2K / ホログラム / ガラケー雑誌風

最終的に、パッケージイラストを取り込む段階で **案Aから少し変化させ、パッケージ本体寄りのビビッドピンク + 黒縁 (メンフィス調)** に落ち着きました。

### タイポグラフィ
Google Fontsから以下を採用:
- `RocknRoll One` — ロゴ・大見出し (シアン塗り+黒縁+白ドロップシャドウでパッケージ再現)
- `Zen Maru Gothic` — 本文
- `Klee One` — 手書き風
- `DotGothic16` — キャプション・ピル・数字
- `Noto Sans JP` — フォールバック

### カラーパレット
```js
{
  pink:      '#FF3D7F',    // ベース・CTA・タグ
  pinkDeep:  '#E63357',
  black:     '#1A1A1A',    // テキスト・ボーダー・ハードシャドウ
  white:     '#FFFFFF',
  yellow:    '#FFE066',    // 強調・付箋
  cyan:      '#5EE7DF',    // タイトル文字・アクセント
  // クイズカラーチップ (お題カードの5色ドットと一致):
  chipGreen:  '#7BB661',
  chipBlue:   '#3B6FB5',
  chipYellow: '#F0C53D',
  chipRed:    '#C8323C',
  chipOrange: '#E88A3C',
}
```

### ゲームロジック
- **同時発表式**: 彼女が選択 (girl phase) → 彼氏が予想 (boy phase) → カウントダウン → 同時発表 (reveal phase)
- **お題**: 全42枚のカードから **Fisher-Yatesシャッフルでランダム5問** 抽出
- **結果**: スコア0〜5に応じて **6段階の診断** (最強カップル ♡ 〜 まだまだカップル)
- **キャラクター表情**: スコアに応じて happy/smile/wink/pout を出し分け(現状は素材が1種類なので同じ画像だが、コンポーネント側で分岐は用意済み)

### アプリ状態管理
`App()` コンポーネントに集約:
- `screen: 'top' | 'intro' | 'play' | 'result' | 'about' | 'product'`
- `qIdx: number` (0〜4)
- `answers: Array<{girl, boy, match}>`
- `cards: Array<Card>` (このラウンドの5枚)
- **localStorage永続化**: `sbg_quiz_state_v3` キーで保存、途中離脱でも「つづきから」可能

---

## URLルーティング

現在の実装:

| URL | 挙動 |
|---|---|
| `/` | トップ画面 |
| `/?screen=intro` | 遊び方画面 |
| `/?screen=about` | About画面 |
| `/?screen=about&to=contact` | About画面 + お問い合わせ欄まで自動スクロール |

### 旧Wix URL の扱い

Cloudflare の SPA フォールバック仕様により `location.pathname` が `/` に書き換えられるため、`/watachan` や `/contact` に直接アクセスするとトップに飛びます。

これは Cloudflare Workers の制約で解決を試みましたが、`_worker.js` 方式でも `functions/` 方式でも成功しませんでした。実害は軽微 (旧URLからアクセスした人がトップに飛ぶだけ) と判断し、現状はそのまま運用しています。

改善を試みる場合の候補:
- Cloudflare Rules で URL Rewrite ルールを作る
- `_worker.js` の実装を見直す
- Wix時代の内部リンクは既に無いため、実質的にSEO対策のみが目的

---

## トラブル対応記録

### 1. Cloudflareに Wix→他社直接移管不可

**問題**: Wix ドメインは Cloudflare Registrar に直接移管できない (Wix仕様)。
「Xserver Domainに移管 → 60日待機 → Cloudflare Registrarへ再移管」が必要。

**対応**: 60日待機を避けるため、**Xserver Domainで管理継続**、DNSだけCloudflareに向ける構成を採用。

### 2. Cloudflare の "Workers"扱いで `_redirects` が効かない

**問題**: 新規Pagesプロジェクトを作ると "Workers" 形式でデプロイされ、`_redirects` ファイルが機能しない。

**対応**: `wrangler.jsonc` + `not_found_handling: "single-page-application"` を設定してSPAフォールバックを有効化。ただしCloudflareの実装で `location.pathname` が `/` に書き換えられる仕様のため、旧URL別画面表示は諦めた。

### 3. カスタムドメイン追加時「No zones found」

**問題**: Workersのカスタムドメイン機能は Cloudflare DNS 管理下のドメインしか受け付けない。

**対応**: `streetboardgame.com` を Cloudflare のサイトとして追加 → ネームサーバーをXserver DomainでCloudflareのものに切替 → Active状態になってからPagesに接続。

### 4. カスタムドメイン追加で「externally managed DNS records」エラー

**問題**: 既にDNSレコードが手動で設定されていると、Pages が自動で追加できない。

**対応**: 既存のCNAMEを一旦削除 → Pages側から追加し直し → Cloudflareが自動で正しいレコードを作成。

### 5. Formspree で本番からメールが届かない

**問題**: 最初、サンドボックスからは届いたが本番URLからは送信されない。

**対応**: `prototype_app.jsx` の `ContactForm` を Formspree エンドポイントに `POST` する実装に更新し、状態管理 (sending/sent/error) も実装。GitHubで更新後、正しく動作。

### 6. Wix経由の初回ネームサーバー変更ができない

**問題**: Wix標準DNSは NS変更をユーザーが編集不可。

**対応**: Xserver Domain へドメインを移管した後、そちら側でネームサーバーを Cloudflare に変更する経路を選択。

---

## 主要マイルストーン

| 日付 | 内容 |
|---|---|
| 6月頃 | 初期リサーチ・3案デザイン提案 |
| 6月頃 | 案A採用 + インタラクティブプロトタイプ実装 |
| 6月頃 | 5問データ差し替え → ランダム抽出モード化 |
| 6月頃 | パッケージキャラクター取り込み・各画面に配置 |
| 6月頃 | 本番用index.html・OGP・GAスニペット準備 |
| 6月頃 | Cloudflare Pages 仮公開 (`streetboardgame.chiaki-jam.workers.dev`) |
| 6月頃 | Wix→Xserver Domain へドメイン移管申請 |
| 6月8日頃 | 移管完了 |
| 6月頃 | Cloudflare DNS設定 + カスタムドメイン接続 |
| 6月頃 | `https://streetboardgame.com` で本番稼働開始 |
| 6月頃 | Wix解約 |
| 6月10日 | Google Analytics 計測ID (`G-X07PVDQWYX`) を差し替え |
| 7月6日 | このバックアップ作成 |

---

## 使用サービス総まとめ

| サービス | 用途 | 費用 |
|---|---|---|
| Xserver Domain | ドメイン管理 | 約 ¥1,500/年 |
| Cloudflare Pages/Workers | ホスティング | 無料 |
| Cloudflare DNS | DNS管理 | 無料 |
| GitHub | ソースコード管理・CI/CD | 無料 |
| Formspree | お問い合わせフォーム受信 | 無料 (月50通) |
| Google Analytics 4 | アクセス解析 | 無料 |
| Google Search Console | 検索解析 | 無料 |

**月額実質コスト**: 約 ¥125 (ドメイン費のみ)

Wix時代と比較して大幅にコストダウン + 機能アップグレードを達成。

---

## 未着手・将来的な展望

- 「友達の友情判定」「家族の絆判定」シリーズ展開
- 表情違いのキャラクター素材 (現状は1種類、コンポーネント側の分岐は用意済み)
- お題カードの追加 (42問→さらに増やす)
- 動的OGP画像 (結果画面の点数入りシェア画像)
- 60日経過後、ドメインをCloudflare Registrarへ再移管して完全1社集約(任意)

---

## 参照リソース

- 復元ガイド: `RESTORE_GUIDE.md`
- サイト実装: `site/` フォルダ内の各ファイル
