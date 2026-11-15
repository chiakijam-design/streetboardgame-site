# streetboardgame.com

広告を導入する場合の表示位置は [docs/ADVERTISING_PLACEMENT_POLICY.md](./docs/ADVERTISING_PLACEMENT_POLICY.md) の4場面だけに限定します。

「わたし理解度診断｜私のこと、ちゃんと分かってるよね？」のWebサイトです。

## 現行モード

- 通常版 `/challenge`

LIVE版は2026-10-23に終了し、2026-11-15にプログラムと本番DBの表を削除しました（表の控えは AI-HANDOFF/records/backup/wata-live-20261115/）。旧URLは 410 を返します。

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
