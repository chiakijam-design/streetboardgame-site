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
  { id: 2,  image: 'assets/cards/2.png',  title: 'イライラした時の行動',     choices: ['無言になる','甘い物を食べる','散歩する','SNSに愚痴','泣く'] },
  { id: 3,  image: 'assets/cards/3.png',  title: '無人島に持っていくなら',   choices: ['ナイフ','スマホ','友達','ライター','水の濾過器'] },
  { id: 4,  image: 'assets/cards/4.png',  title: '一緒に行きたい場所',       choices: ['テーマパーク','サウナ','水族館','美術館','居酒屋'] },
  { id: 5,  image: 'assets/cards/5.png',  title: 'デート中のNG行動',         choices: ['スマホばかり見る','時間にルーズ','愚痴を言う','無言','店員に偉そう'] },
  { id: 6,  image: 'assets/cards/6.png',  title: '1週間これしか食べられないどれ？', choices: ['ハンバーガー','寿司','ラーメン','パスタ','カレー'] },
  { id: 7,  image: 'assets/cards/7.png',  title: '1番かわいいのは',          choices: ['ちいかわ','シナモロール','ピカチュウ','クロミ','スヌーピー'] },
  { id: 8,  image: 'assets/cards/8.png',  title: '1番怖いのは',              choices: ['おばけ','ジェットコースター','高いところ','動物','人間'] },
  { id: 9,  image: 'assets/cards/9.png',  title: 'お風呂で最初に洗う場所',   choices: ['髪','顔','腕','胸','首'] },
  { id: 10, image: 'assets/cards/10.png', title: 'ドラえもんの道具でほしいのは', choices: ['タケコプター','どこでもドア','ほんやくコンニャク','暗記パン','もしもボックス'] },
  { id: 11, image: 'assets/cards/11.png', title: 'どれか1つやらないといけないなら', choices: ['バンジージャンプ','激痛足つぼマッサージ','ゴキブリを食べる','一発芸','1日スマホなし'] },
  { id: 12, image: 'assets/cards/12.png', title: 'どれかに行けるなら',       choices: ['ゲームの世界','深海','宇宙','未来','過去'] },
  { id: 13, image: 'assets/cards/13.png', title: 'ファミレスの好きなメニュー', choices: ['ハンバーグ','カレー','とんかつ','パスタ','ステーキ'] },
  { id: 14, image: 'assets/cards/14.png', title: 'ポテトチップの好きな味',   choices: ['うすしお','のりしお','コンソメ','ガーリック','バター醤油'] },
  { id: 15, image: 'assets/cards/15.png', title: 'もし願いがかなうなら',     choices: ['玉の輿にのりたい','スポーツ選手になりたい','社長になりたい','Youtuberになりたい','ダイエットに成功したい'] },
  { id: 16, image: 'assets/cards/16.png', title: 'よく使うSNS',              choices: ['X','instagram','Tiktok','Threads','Youtube'] },
  { id: 17, image: 'assets/cards/17.png', title: '一生に一度できるなら',     choices: ['オーロラを見る','南極探検','日本一周','世界一周','富士山にのぼる'] },
  { id: 18, image: 'assets/cards/18.png', title: '家で飼いたい動物',         choices: ['犬','猫','鳥','魚','爬虫類'] },
  { id: 19, image: 'assets/cards/19.png', title: '過去に戻れるなら',         choices: ['幼稚園','小学校','中学校','高校','20歳'] },
  { id: 20, image: 'assets/cards/20.png', title: '海外の行きたい所',         choices: ['フランス','アメリカ','タイ','エジプト','韓国'] },
  { id: 21, image: 'assets/cards/21.png', title: '苦手なこと',               choices: ['人前で話す','計画をたてる','継続する','片づける','じっとしている'] },
  { id: 22, image: 'assets/cards/22.png', title: '苦手なのは',               choices: ['ゴキブリ','カエル','ハエ','ハト','ヘビ'] },
  { id: 23, image: 'assets/cards/23.png', title: '好きなイベント',           choices: ['クリスマス','ハロウィン','エイプリルフール','バレンタインデー','ホワイトデー'] },
  { id: 24, image: 'assets/cards/24.png', title: '好きなお菓子',             choices: ['チョコレート','焼き菓子','駄菓子','スナック菓子','グミ'] },
  { id: 25, image: 'assets/cards/25.png', title: '好きなご飯のお供',         choices: ['納豆','鮭フレーク','辛子明太子','味付け海苔','生卵'] },
  { id: 26, image: 'assets/cards/26.png', title: '好きな映画のジャンル',     choices: ['ホラー','コメディ','アクション','恋愛','アニメ'] },
  { id: 27, image: 'assets/cards/27.png', title: '好きな食べもの',           choices: ['お寿司','焼き肉','とんかつ','ラーメン','パンケーキ'] },
  { id: 28, image: 'assets/cards/28.png', title: '行ってみたい都道府県',     choices: ['京都','沖縄','北海道','大阪','福岡'] },
  { id: 29, image: 'assets/cards/29.png', title: '国内旅行でしたいこと',     choices: ['寺・神社めぐり','世界遺産めぐり','ご当地グルメ','温泉めぐり','自然体験'] },
  { id: 30, image: 'assets/cards/30.png', title: '子どものころ好きだったこと', choices: ['体を動かす遊び','絵本','おままごと','お絵描き','パズル'] },
  { id: 31, image: 'assets/cards/31.png', title: '1番の推し',                choices: ['アイドル','アニメキャラ','俳優','アーティスト','恋人'] },
  { id: 32, image: 'assets/cards/32.png', title: '自分を色で例えると',       choices: ['ピンク','青','黄','赤','紫'] },
  { id: 33, image: 'assets/cards/33.png', title: '自分を動物に例えると',     choices: ['猫','犬','オオカミ','なまけもの','ゴリラ'] },
  { id: 34, image: 'assets/cards/34.png', title: '手に入るならどの能力',     choices: ['他人の心を読み取る','未来を透視する','瞬間移動','時間を止める','透明人間になる'] },
  { id: 35, image: 'assets/cards/35.png', title: '将来住みたい地域',         choices: ['都会','田舎','海外','地元','海の近く'] },
  { id: 36, image: 'assets/cards/36.png', title: '寝る前にすること',         choices: ['スマホを見る','ストレッチ','ゲーム','音楽を聴く','何も考えない'] },
  { id: 37, image: 'assets/cards/37.png', title: '人生を漢字1文字で表すと',  choices: ['楽','幸','金','無','苦'] },
  { id: 38, image: 'assets/cards/38.png', title: '生まれ変わるなら',         choices: ['犬','猫','魚','鳥','人'] },
  { id: 39, image: 'assets/cards/39.png', title: '大切な決断の基準',         choices: ['直感','信念','人のため','時間','お金'] },
  { id: 40, image: 'assets/cards/40.png', title: '定番の朝食',               choices: ['パン','ごはん','フルーツ','シリアル','食べない'] },
  { id: 41, image: 'assets/cards/41.png', title: '得意なこと',               choices: ['料理','人の話を聞く','記憶力','芸術的センス','空気を読む'] },
  { id: 42, image: 'assets/cards/42.png', title: '癒される瞬間',             choices: ['動物と触れ合う','音楽を聴く','寝る','甘える','美味しいものを食べる'] },
].map((card) => ({
  ...card,
  image: card.image.replace(/\.png$/, '.webp'),
}));

// Fisher-Yates シャッフルで N 枚抽出
window.pickRandomCards = function(n) {
  const arr = window.ALL_CARDS.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
};
