import QRCode from 'qrcode';
import { buildChallengeInviteText } from './share.js';
import { LOCALE_DETAILS } from '../i18n/locales.js';
import { challengeCopy } from '../i18n/challenge-copy.js';

// Machine-generated UI translations; native review has not been performed.
export const INVITE_SHARE_LABELS = Object.freeze({
  ja: ['診断を共有', '招待画像を保存'],
  en: ['Share quiz', 'Save invitation image'],
  es: ['Compartir cuestionario', 'Guardar imagen de invitación'],
  fr: ['Partager le quiz', 'Enregistrer l’image d’invitation'],
  de: ['Quiz teilen', 'Einladungsbild speichern'],
  it: ['Condividi il quiz', 'Salva l’immagine di invito'],
  pt: ['Compartilhar o quiz', 'Salvar imagem de convite'],
  ru: ['Поделиться викториной', 'Сохранить изображение приглашения'],
  uk: ['Поділитися вікториною', 'Зберегти зображення запрошення'],
  pl: ['Udostępnij quiz', 'Zapisz obraz zaproszenia'],
  nl: ['Quiz delen', 'Uitnodigingsafbeelding opslaan'],
  sv: ['Dela quizet', 'Spara inbjudningsbild'],
  da: ['Del quizzen', 'Gem invitationsbillede'],
  no: ['Del quizen', 'Lagre invitasjonsbilde'],
  fi: ['Jaa tietovisa', 'Tallenna kutsukuva'],
  cs: ['Sdílet kvíz', 'Uložit obrázek pozvánky'],
  el: ['Κοινοποίηση κουίζ', 'Αποθήκευση εικόνας πρόσκλησης'],
  ro: ['Distribuie quizul', 'Salvează imaginea invitației'],
  hu: ['Kvíz megosztása', 'Meghívókép mentése'],
  bg: ['Споделяне на теста', 'Запазване на изображението за покана'],
  hr: ['Podijeli kviz', 'Spremi sliku pozivnice'],
  sk: ['Zdieľať kvíz', 'Uložiť obrázok pozvánky'],
  tr: ['Testi paylaş', 'Davet görselini kaydet'],
  ar: ['مشاركة الاختبار', 'حفظ صورة الدعوة'],
  he: ['שיתוף החידון', 'שמירת תמונת ההזמנה'],
  hi: ['क्विज़ साझा करें', 'निमंत्रण की तस्वीर सहेजें'],
  bn: ['কুইজ শেয়ার করুন', 'আমন্ত্রণের ছবি সংরক্ষণ করুন'],
  id: ['Bagikan kuis', 'Simpan gambar undangan'],
  ms: ['Kongsi kuiz', 'Simpan imej jemputan'],
  th: ['แชร์แบบทดสอบ', 'บันทึกภาพคำเชิญ'],
  vi: ['Chia sẻ bài trắc nghiệm', 'Lưu ảnh lời mời'],
  ko: ['퀴즈 공유', '초대 이미지 저장'],
  'zh-Hans': ['分享测验', '保存邀请图片'],
  'zh-Hant': ['分享測驗', '儲存邀請圖片'],
});

// Reconstruct the public invitation from an allowlist. Never accept the current
// management URL, room answers, participant details or a caller-provided caption.
export function challengeInvitePayload({ origin, locale, room, src = '', translate = value => value }) {
  const details = LOCALE_DETAILS[locale];
  if (!details || !/^[A-Z0-9]{8}$/.test(room?.code || '')) throw new TypeError('Invalid invitation');
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol)) throw new TypeError('Invalid origin');
  const url = `${base.origin}${details.prefix}/challenge?room=${room.code}`;
  const creatorName = String(room.creatorName || '').slice(0, 12);
  const count = Array.isArray(room.cards) ? room.cards.length : 10;
  const text = count > 0 && count < 10
    ? `${creatorName} · ${challengeCopy(locale, 'swap')} (${count})\n${url}`
    : translate(buildChallengeInviteText({ creatorName, url, isEnglish: locale === 'en' }));
  return { src, filename: 'watachan-challenge-invitation.png', title: translate('わたし理解度診断'), text, caption: text, url };
}

export async function createChallengeInviteCanvas({ payload, creatorName, locale, translate, girlImage, questionCount = 10, documentRef = document }) {
  const canvas = documentRef.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ec4683';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#191919';
  ctx.fillRect(64, 48, 952, 1254);
  ctx.fillStyle = '#fff8f1';
  ctx.fillRect(84, 68, 912, 1214);
  ctx.fillStyle = '#191919';
  ctx.fillRect(84, 68, 912, 150);
  ctx.textAlign = 'center';
  ctx.direction = LOCALE_DETAILS[locale].direction;
  ctx.fillStyle = '#fff';
  ctx.font = '900 48px "Noto Sans JP", sans-serif';
  ctx.fillText(payload.title, 540, 162, 840);
  ctx.fillStyle = '#ec4683';
  ctx.font = '900 64px "Noto Sans JP", sans-serif';
  ctx.fillText(String(creatorName || '').slice(0, 12), 540, 326, 840);
  if (girlImage) ctx.drawImage(girlImage, 435, 380, 210, 252);
  ctx.fillStyle = '#191919';
  ctx.font = '700 38px "Noto Sans JP", sans-serif';
  ctx.fillText(translate('私のこと、ちゃんと分かってるよね？'), 540, 700, 840);
  ctx.font = '700 30px "Noto Sans JP", sans-serif';
  ctx.fillText(translate('当てるより、話すための10問。').replaceAll('10', String(questionCount)), 540, 754, 840);
  const qr = documentRef.createElement('canvas');
  await QRCode.toCanvas(qr, payload.url, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
  ctx.drawImage(qr, 360, 810, 360, 360);
  ctx.font = '700 30px "Noto Sans JP", sans-serif';
  ctx.fillText(translate('参加URL・QRコードを友達へ送る'), 540, 1238, 840);
  return canvas;
}
