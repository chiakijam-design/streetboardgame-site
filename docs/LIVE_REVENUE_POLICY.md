# LIVE Revenue Policy

`Youtuber専用　私のこと、ちゃんと分かってるよねLIVE`の有料結果画像・応援金には、次の収益配分を適用する。

- YouTuber: 売上総額の70%
- Stripeのカード決済手数料基準: 売上総額の3.6%
- Streetboardgame運営: 売上総額の26.4%（3.6%のカード決済手数料だった場合の基準値）

CheckoutはStreetboardgameのプラットフォームアカウントで決済し、注文台帳へYouTuber分70%と運営名目分30%を記録する。14日間の返金・不正利用保留と月次5,000円基準を満たした後、Separate charges and transfersでConnectアカウントへ送金する。Checkout時点では`transfer_data`を指定せず、即時分配しない。

```text
運営実純額 = 売上総額 - YouTuber確定分配額 - Stripeが記録した実決済手数料
```

現段階のCheckout注文台帳は`src/live/revenue.js`を使用し、YouTuber分70%と運営名目分30%を記録する。月次送金を実装する際は、決済完了後のStripe残高取引に記録された実手数料を取得して照合し、3.6%から計算した推定額だけで運営実純額や送金処理を確定してはいけない。

返金、チャージバック、Connect固有料金、税金、海外カードや別決済手段の追加料金は26.4%に含まれない。これらが発生した場合、運営の実純額は26.4%を下回る可能性がある。

## Stripe公式資料

- [日本のStripe料金体系](https://stripe.com/jp/pricing)
- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
