# streetboardgame.com

広告を導入する場合の表示位置は [docs/ADVERTISING_PLACEMENT_POLICY.md](./docs/ADVERTISING_PLACEMENT_POLICY.md) の4場面だけに限定します。

「わたし理解度診断｜私のこと、ちゃんと分かってるよね？」のWebサイトです。

## 現行モード

- 通常版 `/challenge`

LIVE版 `/live-challenge` は2026-10-23の本人指示で終了しました。新規作成・参加・購入は復活させず、過去取引の照会・受取・返金と認証済み会計管理だけを維持します。

通常版は共通お題ライブラリを使います。お題の採用・無効化・編集・類似比較は
`/question-ops` で管理します。

## 開発

```powershell
pnpm install
pnpm run build
pnpm test
pnpm run test:e2e
```

Workerルーティングを含むローカル確認には `tools/test-server.mjs` を使います。
