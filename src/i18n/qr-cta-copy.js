// 2026-11-22（Gemini 見直し13・22）：招待画像・結果画像の QR の横の文は、画像を見た友達に向けた呼びかけにする。
// Machine translated; native-language review remains unverified, as for existing catalogs.
const table = (rows) => Object.freeze(Object.fromEntries(rows.split('\n').map((row) => { const [locale, text] = row.split('|'); return [locale, text]; })));
const INVITE = table(`ja|QRコードから挑戦してね！
en|Scan the QR code to play!
es|¡Escanea el código QR para jugar!
fr|Scanne le QR code pour jouer !
de|Scanne den QR-Code und spiel mit!
it|Scansiona il QR code per giocare!
pt|Escaneie o QR code para jogar!
ru|Сканируйте QR-код, чтобы сыграть!
uk|Скануйте QR-код, щоб зіграти!
pl|Zeskanuj kod QR i zagraj!
nl|Scan de QR-code om mee te spelen!
sv|Skanna QR-koden för att spela!
da|Scan QR-koden for at spille!
no|Skann QR-koden for å spille!
fi|Skannaa QR-koodi ja pelaa!
cs|Naskenujte QR kód a hrajte!
el|Σαρώστε τον κωδικό QR για να παίξετε!
ro|Scanează codul QR ca să joci!
hu|Olvasd be a QR-kódot, és játssz!
bg|Сканирайте QR кода, за да играете!
hr|Skeniraj QR kod i igraj!
sk|Naskenujte QR kód a hrajte!
tr|Oynamak için QR kodu tara!
ar|امسح رمز QR للعب!
he|סרקו את קוד ה-QR כדי לשחק!
hi|खेलने के लिए QR कोड स्कैन करें!
bn|খেলতে QR কোড স্ক্যান করুন!
id|Pindai kode QR untuk bermain!
ms|Imbas kod QR untuk bermain!
th|สแกน QR โค้ดเพื่อเล่น!
vi|Quét mã QR để chơi!
ko|QR 코드로 도전해 보세요!
zh-Hans|扫描二维码来挑战！
zh-Hant|掃描 QR 碼來挑戰！`);
const RESULT = table(`ja|QRから同じクイズに挑戦！
en|Scan to take the same quiz!
es|¡Escanea y haz el mismo quiz!
fr|Scanne pour faire le même quiz !
de|Scannen und dasselbe Quiz spielen!
it|Scansiona e fai lo stesso quiz!
pt|Escaneie e faça o mesmo quiz!
ru|Сканируйте и пройдите тот же тест!
uk|Скануйте й пройдіть той самий тест!
pl|Zeskanuj i rozwiąż ten sam quiz!
nl|Scan en speel dezelfde quiz!
sv|Skanna och gör samma quiz!
da|Scan og tag den samme quiz!
no|Skann og ta den samme quizen!
fi|Skannaa ja tee sama visa!
cs|Naskenujte a zahrajte si stejný kvíz!
el|Σαρώστε και παίξτε το ίδιο κουίζ!
ro|Scanează și fă același quiz!
hu|Olvasd be, és töltsd ki ugyanezt a kvízt!
bg|Сканирайте и решете същия тест!
hr|Skeniraj i riješi isti kviz!
sk|Naskenujte a zahrajte si rovnaký kvíz!
tr|Tara ve aynı testi çöz!
ar|امسح الرمز وجرّب الاختبار نفسه!
he|סרקו ונסו את אותו חידון!
hi|स्कैन करें और यही क्विज़ खेलें!
bn|স্ক্যান করে একই কুইজ খেলুন!
id|Pindai dan coba kuis yang sama!
ms|Imbas dan cuba kuiz yang sama!
th|สแกนแล้วลองทำควิซเดียวกัน!
vi|Quét mã và thử cùng câu đố!
ko|QR로 같은 퀴즈에 도전!
zh-Hans|扫码挑战同一个测验！
zh-Hant|掃碼挑戰同一個測驗！`);
export const inviteQrCta = (locale) => INVITE[locale] || INVITE.en;
export const resultQrCta = (locale) => RESULT[locale] || RESULT.en;
// 2026-11-22（Gemini 見直し23）：海外のシェアのハッシュタグは、その言語のサイト名に（日本語は #わたちゃん のまま）
const TAGS = Object.freeze({ ja: '#わたちゃん', es: '#CuantoMeConoces', pt: '#QuantoVoceMeConhece' });
export const shareHashtag = (locale) => TAGS[locale] || '#KnowMeQuiz';
