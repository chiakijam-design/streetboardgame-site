import QRCode from 'qrcode';
import { buildChallengeInviteText } from './share.js';
import { LOCALE_DETAILS } from '../i18n/locales.js';
import { challengeCopy } from '../i18n/challenge-copy.js';

// Machine-generated UI translations; native review has not been performed.
export const INVITE_SHARE_LABELS = Object.freeze({
  "ja": ["友達にクイズを出す","招待画像を保存","あなたが作った問題を友達に解いてもらおう"],
  "en": ["Challenge your friends","Save invitation image","Let your friends answer the questions you created"],
  "es": ["Reta a tus amigos","Guardar imagen de invitación","Invita a tus amigos a responder las preguntas que creaste"],
  "fr": ["Défiez vos amis","Enregistrer l’image d’invitation","Invitez vos amis à répondre aux questions que vous avez créées"],
  "de": ["Fordere deine Freunde heraus","Einladungsbild speichern","Lass deine Freunde deine selbst erstellten Fragen beantworten"],
  "it": ["Sfida i tuoi amici","Salva l’immagine di invito","Invita i tuoi amici a rispondere alle domande che hai creato"],
  "pt": ["Desafie seus amigos","Salvar imagem de convite","Convide seus amigos a responder às perguntas que você criou"],
  "ru": ["Бросить вызов друзьям","Сохранить изображение приглашения","Предложите друзьям ответить на созданные вами вопросы"],
  "uk": ["Кинути виклик друзям","Зберегти зображення запрошення","Запропонуйте друзям відповісти на створені вами запитання"],
  "pl": ["Rzuć wyzwanie znajomym","Zapisz obraz zaproszenia","Zaproś znajomych do odpowiedzi na ułożone przez Ciebie pytania"],
  "nl": ["Daag je vrienden uit","Uitnodigingsafbeelding opslaan","Laat je vrienden de vragen beantwoorden die jij hebt gemaakt"],
  "sv": ["Utmana dina vänner","Spara inbjudningsbild","Låt dina vänner svara på frågorna du har skapat"],
  "da": ["Udfordr dine venner","Gem invitationsbillede","Lad dine venner svare på de spørgsmål, du har lavet"],
  "no": ["Utfordre vennene dine","Lagre invitasjonsbilde","La vennene dine svare på spørsmålene du har laget"],
  "fi": ["Haasta ystäväsi","Tallenna kutsukuva","Pyydä ystäviäsi vastaamaan laatimiisi kysymyksiin"],
  "cs": ["Vyzvěte své přátele","Uložit obrázek pozvánky","Pozvěte přátele, aby odpověděli na otázky, které jste vytvořili"],
  "el": ["Προκαλέστε τους φίλους σας","Αποθήκευση εικόνας πρόσκλησης","Ζητήστε από τους φίλους σας να απαντήσουν στις ερωτήσεις που φτιάξατε"],
  "ro": ["Provoacă-ți prietenii","Salvează imaginea invitației","Invită-ți prietenii să răspundă la întrebările create de tine"],
  "hu": ["Hívd ki a barátaidat","Meghívókép mentése","Kérd meg barátaidat, hogy válaszoljanak az általad készített kérdésekre"],
  "bg": ["Предизвикайте приятелите си","Запазване на изображението за покана","Поканете приятелите си да отговорят на създадените от вас въпроси"],
  "hr": ["Izazovi prijatelje","Spremi sliku pozivnice","Pozovi prijatelje da odgovore na pitanja koja si sastavio"],
  "sk": ["Vyzvite svojich priateľov","Uložiť obrázok pozvánky","Pozvite priateľov, aby odpovedali na otázky, ktoré ste vytvorili"],
  "tr": ["Arkadaşlarına meydan oku","Davet görselini kaydet","Hazırladığın soruları arkadaşların yanıtlasın"],
  "ar": ["تحدَّ أصدقاءك","حفظ صورة الدعوة","دع أصدقاءك يجيبون عن الأسئلة التي أنشأتها"],
  "he": ["אתגרו את החברים","שמירת תמונת ההזמנה","הזמינו את החברים לענות על השאלות שיצרתם"],
  "hi": ["दोस्तों को चुनौती दें","निमंत्रण की तस्वीर सहेजें","अपने बनाए सवालों के जवाब दोस्तों से पूछें"],
  "bn": ["বন্ধুদের চ্যালেঞ্জ করুন","আমন্ত্রণের ছবি সংরক্ষণ করুন","আপনার তৈরি প্রশ্নগুলোর উত্তর দিতে বন্ধুদের আমন্ত্রণ জানান"],
  "id": ["Tantang temanmu","Simpan gambar undangan","Ajak teman menjawab pertanyaan yang kamu buat"],
  "ms": ["Cabar rakan anda","Simpan imej jemputan","Ajak rakan menjawab soalan yang anda cipta"],
  "th": ["ท้าเพื่อนทำควิซ","บันทึกภาพคำเชิญ","ชวนเพื่อนมาตอบคำถามที่คุณสร้างขึ้น"],
  "vi": ["Thách đố bạn bè","Lưu ảnh lời mời","Mời bạn bè trả lời những câu hỏi bạn đã tạo"],
  "ko": ["친구에게 퀴즈 내기","초대 이미지 저장","내가 만든 문제를 친구들이 풀어 보게 해요"],
  "zh-Hans": ["向朋友出题","保存邀请图片","让朋友来回答你创建的问题"],
  "zh-Hant": ["向朋友出題","儲存邀請圖片","讓朋友來回答你建立的問題"],
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
