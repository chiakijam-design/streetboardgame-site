# 復元ガイド

## ソース

- GitHub: `chiakijam-design/streetboardgame-site`
- 本番Worker: `streetboardgame`
- 本番URL: `https://www.streetboardgame.com`

## 復元手順

1. GitHubからリポジトリを取得する。
2. `pnpm install --frozen-lockfile` を実行する。
3. `pnpm run build` とテストを実行する。
4. CloudflareのD1・R2・Secrets・カスタムドメインを確認する。
5. `pnpm exec wrangler deploy` でWorkerを再配置する。

現行の公開ゲームは通常版 `/challenge` とLIVE版 `/live-challenge` の2つです。
