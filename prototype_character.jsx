// パッケージキャラクター描画コンポーネント
// 実画像 3 種を場面に応じて使い分ける:
//   - girl-full.png    : 全身ポーズ (トップヒーロー)
//   - girl-default.png : 上半身、カード + 青チップ (結果画面、メインフォーカス)
//   - girl-upper.png   : 上半身、カードのみ (装飾、ヘッダー)

(function() {

const IMAGE_BASE = 'assets/character/';

// 各バリアントの画像と自然なアスペクト比 (height / width)
const VARIANTS = {
  full:    {
    file: 'girl-full.png',
    webp: 'girl-full.webp',
    webpSrcSet: 'girl-full-480.webp 326w, girl-full-960.webp 653w, girl-full.webp 2088w',
    aspect: 3072/2088,
  },
  default: { file: 'girl-default.png', webp: 'girl-default.webp', aspect: 297/244 },
  upper:   { file: 'girl-upper.png',   webp: 'girl-upper.webp',   aspect: 297/244 },

  // 結果画面用エイリアス。素材が増えたら差し替え
  happy:   { file: 'girl-default.png', webp: 'girl-default.webp', aspect: 297/244 },
  smile:   { file: 'girl-default.png', webp: 'girl-default.webp', aspect: 297/244 },
  wink:    { file: 'girl-upper.png',   webp: 'girl-upper.webp',   aspect: 297/244 },
  pout:    { file: 'girl-upper.png',   webp: 'girl-upper.webp',   aspect: 297/244 },
};

function Girl({
  variant = 'default',
  width = 'auto',
  height = 200,
  style = {},
  flip = false,
  alt = 'わたちゃん 彼氏の愛情判定ゲームの女の子',
  loading = 'lazy',
  fetchPriority = 'auto',
}) {
  const conf = VARIANTS[variant] || VARIANTS.default;

  let w = width, h = height;
  if (width === 'auto' && typeof height === 'number') {
    w = Math.round(height / conf.aspect);
  } else if (height === 'auto' && typeof width === 'number') {
    h = Math.round(width * conf.aspect);
  }

  const imageStyle = {
    width: w,
    height: h,
    display: 'block',
    transform: flip ? 'scaleX(-1)' : 'none',
    pointerEvents: 'none',
    userSelect: 'none',
    ...style,
  };
  const responsiveSizes = typeof w === 'number' ? `${w}px` : undefined;

  return (
    <picture style={{ display: 'block' }}>
      {conf.webp && (
        <source
          srcSet={conf.webpSrcSet
            ? conf.webpSrcSet.split(', ').map((candidate) => IMAGE_BASE + candidate).join(', ')
            : IMAGE_BASE + conf.webp}
          sizes={conf.webpSrcSet ? responsiveSizes : undefined}
          type="image/webp"
        />
      )}
      <img
        src={IMAGE_BASE + conf.file}
        alt={alt}
        width={typeof w === 'number' ? w : undefined}
        height={typeof h === 'number' ? h : undefined}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        style={imageStyle}
        draggable={false}
      />
    </picture>
  );
}

function girlVariantForScore(score, total = 5) {
  const pct = score / total;
  if (pct >= 1)    return 'happy';
  if (pct >= 0.6)  return 'smile';
  if (pct >= 0.4)  return 'wink';
  return 'pout';
}

Object.assign(window, {
  Girl, girlVariantForScore,
});

})();
