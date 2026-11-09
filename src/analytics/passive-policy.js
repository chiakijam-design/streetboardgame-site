import {japanGA4Mode} from './jp-ga4-policy.js';
// Only the purpose-limited Japan direct-GA4 configuration has been cleared.
// Do not infer it from Cloudflare's country decision or from an old Allow record.
export const GOOGLE_NO_CONSENT_COUNTRIES = Object.freeze(['JP']);
export function injectGooglePolicy(html, cf) {
  if (!/src=["']\/analytics\.js(?:[?"'])/.test(html) || html.includes('__WATACHAN_GOOGLE_ANALYTICS_POLICY__')) return html;
  const mode = japanGA4Mode(cf);
  return html.replace(/<head\b[^>]*>/i, '$&<script>window.__WATACHAN_GOOGLE_ANALYTICS_POLICY__='+JSON.stringify(mode)+';</script>')
    .replace(/src=(["'])\/analytics\.js\1/g, 'src=$1/analytics.js?v=20261109-jp-operator-observation-1$1');
}
// Plain privacy-page text only. No banner, dialog, notice bar or play-page UI.
export const PASSIVE_SCOPE = {
 ja:'同意操作なしの集計は、日本からの接続に限り{date}以降に行います。他の地域と地域不明の接続では集計しません。',
 en:'Measurement without a consent action is limited to connections from Japan from {date}. Other and unknown regions are not measured.',
 es:'La medición sin solicitar consentimiento se limita a conexiones de Japón desde {date}. No se miden otras regiones ni las desconocidas.',
 fr:'La mesure sans demande de consentement se limite aux connexions du Japon à partir du {date}. Les autres régions et les régions inconnues ne sont pas mesurées.',
 de:'Die Messung ohne Einwilligungsabfrage gilt nur für Verbindungen aus Japan ab {date}. Andere und unbekannte Regionen werden nicht gemessen.',
 it:'La misurazione senza richiesta di consenso è limitata alle connessioni dal Giappone dal {date}. Le altre regioni e quelle sconosciute non sono misurate.',
 pt:'A medição sem pedido de consentimento limita-se às ligações do Japão a partir de {date}. Outras regiões e regiões desconhecidas não são medidas.',
 ru:'Измерение без запроса согласия действует только для подключений из Японии с {date}. Другие и неизвестные регионы не измеряются.',
 uk:'Вимірювання без запиту згоди діє лише для підключень із Японії з {date}. Інші та невідомі регіони не вимірюються.',
 pl:'Pomiar bez pytania o zgodę obejmuje tylko połączenia z Japonii od {date}. Inne i nieznane regiony nie są mierzone.',
 nl:'Meting zonder toestemmingsvraag geldt alleen voor verbindingen uit Japan vanaf {date}. Andere en onbekende regio’s worden niet gemeten.',
 sv:'Mätning utan samtyckesfråga gäller bara anslutningar från Japan från {date}. Andra och okända regioner mäts inte.',
 da:'Måling uden samtykkeforespørgsel gælder kun forbindelser fra Japan fra {date}. Andre og ukendte regioner måles ikke.',
 no:'Måling uten samtykkeforespørsel gjelder bare forbindelser fra Japan fra {date}. Andre og ukjente regioner måles ikke.',
 fi:'Mittaus ilman suostumuspyyntöä koskee vain Japanista tulevia yhteyksiä alkaen {date}. Muita ja tuntemattomia alueita ei mitata.',
 cs:'Měření bez žádosti o souhlas se týká pouze připojení z Japonska od {date}. Jiné a neznámé oblasti se neměří.',
 el:'Η μέτρηση χωρίς αίτημα συγκατάθεσης περιορίζεται σε συνδέσεις από την Ιαπωνία από {date}. Άλλες και άγνωστες περιοχές δεν μετρώνται.',
 ro:'Măsurarea fără cerere de consimțământ se limitează la conexiunile din Japonia de la {date}. Alte regiuni și cele necunoscute nu sunt măsurate.',
 hu:'A hozzájáruláskérés nélküli mérés csak a Japánból érkező kapcsolatokra vonatkozik ettől: {date}. Más és ismeretlen régiókat nem mérünk.',
 bg:'Измерване без искане за съгласие се извършва само за връзки от Япония от {date}. Други и неизвестни региони не се измерват.',
 hr:'Mjerenje bez zahtjeva za privolu odnosi se samo na veze iz Japana od {date}. Druge i nepoznate regije ne mjere se.',
 sk:'Meranie bez žiadosti o súhlas sa týka iba pripojení z Japonska od {date}. Iné a neznáme oblasti sa nemerajú.',
 tr:'Onay sorulmadan ölçüm yalnızca {date} tarihinden itibaren Japonya bağlantıları için yapılır. Diğer ve bilinmeyen bölgeler ölçülmez.',
 ar:'يقتصر القياس دون طلب موافقة على الاتصالات من اليابان بدءًا من {date}. لا تُقاس المناطق الأخرى أو غير المعروفة.',
 he:'מדידה ללא בקשת הסכמה מוגבלת לחיבורים מיפן החל מ־{date}. אזורים אחרים או לא ידועים אינם נמדדים.',
 hi:'सहमति माँगे बिना मापन केवल {date} से जापान के कनेक्शन के लिए है। अन्य और अज्ञात क्षेत्रों को नहीं मापा जाता।',
 bn:'সম্মতি না চেয়ে পরিমাপ শুধু {date} থেকে জাপানের সংযোগের জন্য। অন্য ও অজানা অঞ্চলে পরিমাপ হয় না।',
 id:'Pengukuran tanpa permintaan persetujuan hanya berlaku untuk koneksi dari Jepang mulai {date}. Wilayah lain dan yang tidak diketahui tidak diukur.',
 ms:'Pengukuran tanpa permintaan persetujuan hanya untuk sambungan dari Jepun mulai {date}. Wilayah lain dan yang tidak diketahui tidak diukur.',
 th:'การวัดโดยไม่ขอความยินยอมจำกัดเฉพาะการเชื่อมต่อจากญี่ปุ่นตั้งแต่ {date} พื้นที่อื่นและพื้นที่ที่ไม่ทราบจะไม่ถูกวัด',
 vi:'Đo lường không yêu cầu đồng ý chỉ áp dụng cho kết nối từ Nhật Bản từ {date}. Các khu vực khác hoặc không xác định không được đo.',
 ko:'동의 요청 없는 측정은 {date}부터 일본에서 접속한 경우에만 적용됩니다. 다른 지역과 알 수 없는 지역은 측정하지 않습니다.',
 'zh-Hans':'无需征求同意的统计仅适用于自{date}起来自日本的连接。其他及未知地区不进行统计。',
 'zh-Hant':'無須徵求同意的統計僅適用於自{date}起來自日本的連線。其他及未知地區不進行統計。',
};
export const GOOGLE_OFF = {
 ja:'Google AnalyticsとMicrosoft Clarityへの新しい解析データ送信は現在停止しています。',en:'New analytics transmission to Google Analytics and Microsoft Clarity is currently disabled.',
 es:'El envío de nuevos datos a Google Analytics y Microsoft Clarity está desactivado.',fr:'L’envoi de nouvelles données à Google Analytics et Microsoft Clarity est désactivé.',de:'Neue Datenübertragungen an Google Analytics und Microsoft Clarity sind deaktiviert.',it:'L’invio di nuovi dati a Google Analytics e Microsoft Clarity è disattivato.',pt:'O envio de novos dados para Google Analytics e Microsoft Clarity está desativado.',ru:'Передача новых данных в Google Analytics и Microsoft Clarity отключена.',uk:'Передавання нових даних у Google Analytics і Microsoft Clarity вимкнено.',pl:'Wysyłanie nowych danych do Google Analytics i Microsoft Clarity jest wyłączone.',nl:'Nieuwe gegevens worden niet naar Google Analytics en Microsoft Clarity verzonden.',sv:'Överföring av nya data till Google Analytics och Microsoft Clarity är avstängd.',da:'Overførsel af nye data til Google Analytics og Microsoft Clarity er slået fra.',no:'Overføring av nye data til Google Analytics og Microsoft Clarity er slått av.',fi:'Uusien tietojen lähetys Google Analyticsiin ja Microsoft Clarityyn on pois käytöstä.',cs:'Odesílání nových dat do Google Analytics a Microsoft Clarity je vypnuté.',el:'Η αποστολή νέων δεδομένων στο Google Analytics και το Microsoft Clarity είναι απενεργοποιημένη.',ro:'Trimiterea de date noi către Google Analytics și Microsoft Clarity este dezactivată.',hu:'Az új adatok továbbítása a Google Analytics és a Microsoft Clarity felé ki van kapcsolva.',bg:'Изпращането на нови данни към Google Analytics и Microsoft Clarity е изключено.',hr:'Slanje novih podataka u Google Analytics i Microsoft Clarity je isključeno.',sk:'Odosielanie nových údajov do Google Analytics a Microsoft Clarity je vypnuté.',tr:'Google Analytics ve Microsoft Clarity’ye yeni veri gönderimi kapalıdır.',ar:'إرسال بيانات جديدة إلى Google Analytics وMicrosoft Clarity متوقف حاليًا.',he:'שליחת נתונים חדשים אל Google Analytics ו־Microsoft Clarity מושבתת.',hi:'Google Analytics और Microsoft Clarity को नया डेटा भेजना बंद है।',bn:'Google Analytics ও Microsoft Clarity-তে নতুন তথ্য পাঠানো বন্ধ আছে।',id:'Pengiriman data baru ke Google Analytics dan Microsoft Clarity dinonaktifkan.',ms:'Penghantaran data baharu ke Google Analytics dan Microsoft Clarity dimatikan.',th:'ปิดการส่งข้อมูลใหม่ไปยัง Google Analytics และ Microsoft Clarity',vi:'Đã tắt gửi dữ liệu mới đến Google Analytics và Microsoft Clarity.',ko:'Google Analytics와 Microsoft Clarity로 새 분석 데이터를 보내지 않습니다.','zh-Hans':'目前已停止向Google Analytics和Microsoft Clarity发送新的分析数据。','zh-Hant':'目前已停止向Google Analytics和Microsoft Clarity傳送新的分析資料。',
};
