# 復元ガイド

## 2026-10-10の保全範囲更新

本人の最新判断により、`streetboardgame-live-private` のR2素材は今回のバックアップ対象外。素材取得・バックアップ調査・追加権限設定を中止し、バケットや既存素材は削除していない。保存済みコードZIPとD1バックアップは保持する。R2素材はGitHub、コードZIP、D1 SQLだけで復元できる保証はない。検証済み保全先とDAIV同期時の注意は `docs/history/MULTILINGUAL_HANDOFF_20261010.md` を参照。

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

現行の公開ゲームはクイズ `/challenge` だけです（LIVE版は2026-10-23に終了し、2026-11-15にコードと本番DBの表を削除。表の控えは AI-HANDOFF/records/backup/wata-live-20261115/）。
