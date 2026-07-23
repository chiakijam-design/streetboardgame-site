# LIVE Revenue Policy

`YouTuberと視聴者の絆を判定する、私のことちゃんとわかってるよね?Youtubeライブver.`のオリジナル結果画像生成・ダウンロードサービス利用料・応援金には、次の収益配分を適用する。

- YouTuber: 売上総額の70%
- Stripeのカード決済手数料基準: 売上総額の3.6%
- Streetboardgame運営: 売上総額の26.4%（3.6%のカード決済手数料だった場合の基準値）

CheckoutはStreetboardgameのプラットフォームアカウントで決済し、注文台帳へYouTuber分70%と運営名目分30%を記録する。14日間の返金・不正利用保留と月次5,000円基準を満たした後、Separate charges and transfersでConnectアカウントへ送金する。Checkout時点では`transfer_data`を指定せず、即時分配しない。

```text
運営実純額 = 売上総額 - YouTuber確定分配額 - Stripeが記録した実決済手数料
```

Checkout注文台帳と売上台帳は`src/live/revenue.js`・`src/live/revenue-ledger.js`を使用し、YouTuber分70%と運営名目分30%を注文単位で記録する。`charge.succeeded`時にStripe残高取引の実手数料を取得し、運営実純額を記録する。3.6%から計算した推定額だけで運営実純額を確定しない。

月次分配は日本時間の対象月終了から14日後以降に運営コンソールで締める。返金・不正審査中の残高は送金せず、返金確定分を控除したYouTuber残高が5,000円以上の場合だけ分配バッチを作る。運営者がバッチ内容を確認してからStripe Connectへ送金し、5,000円未満は次月以降へ繰り越す。送金後の返金・チャージバックは`offset_due`として次回分配から相殺する。

この月次処理はプラットフォーム残高からConnect残高への`Transfer`であり、Connect残高から銀行口座への`Payout`とは別である。銀行着金日を月1回に固定する場合は、利用するConnectアカウント種別に応じてStripe側の入金スケジュールも設定・確認する。

返金、チャージバック、Connect固有料金、税金、海外カードや別決済手段の追加料金は26.4%に含まれない。これらが発生した場合、運営の実純額は26.4%を下回る可能性がある。

## Stripe公式資料

- [日本のStripe料金体系](https://stripe.com/jp/pricing)
- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Create a transfer](https://docs.stripe.com/api/transfers/create)
