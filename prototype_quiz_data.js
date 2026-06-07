// お題カード42枚分のメタデータ。 image / title / choices(5色順) を保持。
// プレイ時はこの中からランダムに5枚を抽出する。
// 色順は全カード共通: 緑 → 青 → 黄 → 赤 → 橙

window.COLOR_OPTIONS = [
  { id: 'green',  color: '#7BB661', name: '緑' },
  { id: 'blue',   color: '#3B6FB5', name: '青' },
  { id: 'yellow', color: '#F0C53D', name: '黄' },
  { id: 'red',    color: '#C8323C', name: '赤' },
  { id: 'orange', color: '#E88A3C', name: '橙' },
];

// 全42枚のお題カード。choices はビジュアル確認用 (画像のテキストと一致)。
// プレイ時はカード画像をそのまま表示するため必須ではないが、結果表示で活用。
window.ALL_CARDS = [
  { id: 1,  image: 'assets/cards/1.png',  title: '目玉焼きにかけるのは',     choices: ['醤油','塩','ケチャップ','ソース','マヨネーズ'] },
  { id: 2,  image: 'assets/cards/2.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 3,  image: 'assets/cards/3.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 4,  image: 'assets/cards/4.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 5,  image: 'assets/cards/5.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 6,  image: 'assets/cards/6.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 7,  image: 'assets/cards/7.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 8,  image: 'assets/cards/8.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 9,  image: 'assets/cards/9.png',  title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 10, image: 'assets/cards/10.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 11, image: 'assets/cards/11.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 12, image: 'assets/cards/12.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 13, image: 'assets/cards/13.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 14, image: 'assets/cards/14.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 15, image: 'assets/cards/15.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 16, image: 'assets/cards/16.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 17, image: 'assets/cards/17.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 18, image: 'assets/cards/18.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 19, image: 'assets/cards/19.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 20, image: 'assets/cards/20.png', title: '海外の行きたい所',         choices: ['フランス','アメリカ','タイ','エジプト','韓国'] },
  { id: 21, image: 'assets/cards/21.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 22, image: 'assets/cards/22.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 23, image: 'assets/cards/23.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 24, image: 'assets/cards/24.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 25, image: 'assets/cards/25.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 26, image: 'assets/cards/26.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 27, image: 'assets/cards/27.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 28, image: 'assets/cards/28.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 29, image: 'assets/cards/29.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 30, image: 'assets/cards/30.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 31, image: 'assets/cards/31.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 32, image: 'assets/cards/32.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 33, image: 'assets/cards/33.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 34, image: 'assets/cards/34.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 35, image: 'assets/cards/35.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 36, image: 'assets/cards/36.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 37, image: 'assets/cards/37.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 38, image: 'assets/cards/38.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 39, image: 'assets/cards/39.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 40, image: 'assets/cards/40.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 41, image: 'assets/cards/41.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
  { id: 42, image: 'assets/cards/42.png', title: 'カード未確認',             choices: ['緑の選択肢','青の選択肢','黄の選択肢','赤の選択肢','橙の選択肢'] },
];

// Fisher-Yates シャッフルで N 枚抽出
window.pickRandomCards = function(n) {
  const arr = window.ALL_CARDS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
};
