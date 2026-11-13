// Vertical 1080x1920 image for Instagram/LINE stories (request 5).
// The existing 1080x1350 card is drawn on the upper part; the bottom ~300px is
// left empty for the Instagram link sticker, with one small hint line.

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_STICKER_SPACE = 300;

const STORY_NOTE = Object.freeze({
  ja: 'リンクはスタンプで貼ってね',
  en: 'Add the link with a sticker',
  ar: 'أضف الرابط باستخدام ملصق',
  bg: 'Добави линка със стикер',
  bn: 'স্টিকার দিয়ে লিংক যোগ করো',
  cs: 'Odkaz přidej pomocí nálepky',
  da: 'Tilføj linket med et klistermærke',
  de: 'Füge den Link mit einem Sticker hinzu',
  el: 'Πρόσθεσε τον σύνδεσμο με αυτοκόλλητο',
  es: 'Agrega el enlace con un sticker',
  fi: 'Lisää linkki tarralla',
  fr: 'Ajoutez le lien avec un sticker',
  he: 'הוסיפו את הקישור עם מדבקה',
  hi: 'लिंक स्टिकर से जोड़ें',
  hr: 'Dodaj poveznicu naljepnicom',
  hu: 'A linket matricával add hozzá',
  id: 'Tambahkan tautan dengan stiker',
  it: 'Aggiungi il link con uno sticker',
  ko: '링크는 스티커로 붙여 주세요',
  ms: 'Tambah pautan dengan pelekat',
  nl: 'Voeg de link toe met een sticker',
  no: 'Legg til lenken med et klistremerke',
  pl: 'Dodaj link za pomocą naklejki',
  pt: 'Adicione o link com uma figurinha',
  ro: 'Adaugă linkul cu un sticker',
  ru: 'Добавьте ссылку с помощью стикера',
  sk: 'Odkaz pridaj pomocou nálepky',
  sv: 'Lägg till länken med ett klistermärke',
  th: 'แปะลิงก์ด้วยสติกเกอร์นะ',
  tr: 'Bağlantıyı çıkartmayla ekle',
  uk: 'Додайте посилання за допомогою стікера',
  vi: 'Dán liên kết bằng nhãn dán nhé',
  'zh-Hans': '用贴纸添加链接',
  'zh-Hant': '用貼紙加入連結',
});

export const STORY_LOCALES = Object.freeze(Object.keys(STORY_NOTE));

export function storyNote(locale = 'ja') {
  return STORY_NOTE[locale] || STORY_NOTE.en;
}

// Where the 1080x1350 card goes inside the story frame.
export function storyCardRect(sourceWidth = 1080, sourceHeight = 1350) {
  const areaHeight = STORY_HEIGHT - STORY_STICKER_SPACE;
  const scale = Math.min((STORY_WIDTH - 72) / sourceWidth, (areaHeight - 96) / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  return { x: Math.round((STORY_WIDTH - width) / 2), y: Math.round((areaHeight - height) / 2), width, height };
}

// background: a CSS colour, or 'gold' for the perfect-score card.
// crop: the card's framed area inside the source (drops the source's own outer margin so
// its background never shows as a box on the story background).
export function createStoryCanvas(source, { locale = 'ja', direction = 'ltr', background = '#ec4683', crop = null, documentRef = globalThis.document } = {}) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (background === 'gold') {
    const gold = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
    gold.addColorStop(0, '#fff3a8');
    gold.addColorStop(0.45, '#f7b500');
    gold.addColorStop(1, '#b8860b');
    ctx.fillStyle = gold;
  } else ctx.fillStyle = background;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  const area = crop || { x: 0, y: 0, width: source.width, height: source.height };
  const rect = storyCardRect(area.width, area.height);
  ctx.save();
  if (area.radius) {
    // Clip to the card's rounded frame so its own background corners do not show.
    const r = area.radius * rect.width / area.width, { x, y, width: w, height: h } = rect;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(source, area.x, area.y, area.width, area.height, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
  ctx.direction = direction;
  ctx.textAlign = 'center';
  ctx.fillStyle = background === 'gold' ? '#191919' : '#ffffff';
  ctx.font = '800 34px "Noto Sans JP", sans-serif';
  ctx.fillText(`↓ ${storyNote(locale)}`, STORY_WIDTH / 2, STORY_HEIGHT - STORY_STICKER_SPACE + 46, STORY_WIDTH - 96);
  return canvas;
}
