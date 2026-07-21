# iPhoneアプリ移行メモ

## Windowsで準備済み

- 判定処理を `src/core/` に分離し、ブラウザAPIを使わない単体テストを追加
- 端末機能のWeb実装を `src/platform/`、Capacitor向け窓口を `src/platform/capacitor/` に分離
- 遠隔通信を `src/api/`、結果画面用モデルを `src/screens/` と `src/components/` に配置
- `pnpm app:web` で `ios-web/` にアプリ収録用のWebファイルを生成
- `capacitor.config.json` を追加

## Macで行う作業

1. このリポジトリをMacへ移し、Node.jsとpnpmを用意する
2. `pnpm install`
3. `pnpm add @capacitor/core @capacitor/ios @capacitor/cli`
4. 必要な端末機能に応じてPreferences、Share、Filesystem、Haptics、Browserの公式プラグインを追加
5. `pnpm app:web`
6. `npx cap add ios`
7. `npx cap sync ios`
8. `npx cap open ios` でXcodeを開き、実機テストを行う

## App Store申請前に必要な確認

- 通常版がオフラインで5問完了できること
- 画像保存、共有シート、振動、途中再開を実機で確認すること
- LINEとXのアプリ未インストール時のフォールバックを確認すること
- 遠隔版はネット接続必須と明記し、24時間のURL期限切れを確認すること
- Privacy Manifest、プライバシーポリシー、App Store用スクリーンショットを用意すること
