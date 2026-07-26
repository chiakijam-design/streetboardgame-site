# streetboardgame.com

「わたし理解度診断｜私のこと、ちゃんと分かってるよね？」のWebサイトです。

## 現行モード

- 通常版 `/challenge`
- LIVE版 `/live-challenge`

両モードは同じ共通お題ライブラリを使います。お題の採用・無効化・編集・類似比較は
`/question-ops` で管理します。

## 開発

```powershell
pnpm install
pnpm run build
pnpm test
pnpm run test:e2e
```

Workerルーティングを含むローカル確認には `tools/test-server.mjs` を使います。
