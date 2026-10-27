// Fixed public home-page copy only; never names, answers or quiz titles.
// Translations have not had native-language review.
const rows = {
  ja: ['出題する問題を選ぶ・作る（1〜10問）', 'わたし理解度診断を作る', '1〜10問・最大50人'],
  en: ['Choose or write questions (1–10)', 'Start creating a quiz', '1–10 questions · up to 50 people'],
  es: ['Elige o escribe preguntas (1–10)', 'Empieza a crear un cuestionario', '1–10 preguntas · hasta 50 personas'],
  fr: ['Choisissez ou créez des questions (1–10)', 'Créer un quiz', '1–10 questions · jusqu’à 50 personnes'],
  de: ['Wähle oder erstelle Fragen (1–10)', 'Quiz erstellen', '1–10 Fragen · bis zu 50 Personen'],
  it: ['Scegli o scrivi le domande (1–10)', 'Crea un quiz', '1–10 domande · fino a 50 persone'],
  pt: ['Escolha ou escreva perguntas (1–10)', 'Comece a criar um quiz', '1–10 perguntas · até 50 pessoas'],
  ru: ['Выберите или создайте вопросы (1–10)', 'Создать викторину', '1–10 вопросов · до 50 участников'],
  uk: ['Виберіть або створіть запитання (1–10)', 'Створити вікторину', '1–10 запитань · до 50 учасників'],
  pl: ['Wybierz lub napisz pytania (1–10)', 'Utwórz quiz', '1–10 pytań · do 50 osób'],
  nl: ['Kies of schrijf vragen (1–10)', 'Maak een quiz', '1–10 vragen · maximaal 50 personen'],
  sv: ['Välj eller skriv frågor (1–10)', 'Skapa ett quiz', '1–10 frågor · upp till 50 personer'],
  da: ['Vælg eller skriv spørgsmål (1–10)', 'Opret en quiz', '1–10 spørgsmål · op til 50 personer'],
  no: ['Velg eller skriv spørsmål (1–10)', 'Lag en quiz', '1–10 spørsmål · opptil 50 personer'],
  fi: ['Valitse tai kirjoita kysymykset (1–10)', 'Luo tietovisa', '1–10 kysymystä · enintään 50 henkilöä'],
  cs: ['Vyberte nebo napište otázky (1–10)', 'Vytvořit kvíz', '1–10 otázek · až 50 osob'],
  el: ['Επιλέξτε ή γράψτε ερωτήσεις (1–10)', 'Δημιουργήστε ένα κουίζ', '1–10 ερωτήσεις · έως 50 άτομα'],
  ro: ['Alege sau scrie întrebări (1–10)', 'Creează un chestionar', '1–10 întrebări · până la 50 de persoane'],
  hu: ['Válassz vagy írj kérdéseket (1–10)', 'Kvíz készítése', '1–10 kérdés · legfeljebb 50 fő'],
  bg: ['Изберете или създайте въпроси (1–10)', 'Създайте викторина', '1–10 въпроса · до 50 души'],
  hr: ['Odaberite ili napišite pitanja (1–10)', 'Izradite kviz', '1–10 pitanja · do 50 osoba'],
  sk: ['Vyberte alebo napíšte otázky (1–10)', 'Vytvoriť kvíz', '1–10 otázok · až 50 osôb'],
  tr: ['Soruları seçin veya yazın (1–10)', 'Quiz oluşturmaya başlayın', '1–10 soru · en fazla 50 kişi'],
  ar: ['اختر الأسئلة أو اكتبها (1–10)', 'ابدأ بإنشاء اختبار', '1–10 أسئلة · حتى 50 شخصًا'],
  he: ['בחרו או כתבו שאלות (1–10)', 'צרו חידון', '1–10 שאלות · עד 50 משתתפים'],
  hi: ['प्रश्न चुनें या लिखें (1–10)', 'क्विज़ बनाना शुरू करें', '1–10 प्रश्न · अधिकतम 50 लोग'],
  bn: ['প্রশ্ন বেছে নিন বা লিখুন (1–10)', 'কুইজ তৈরি শুরু করুন', '1–10টি প্রশ্ন · সর্বোচ্চ 50 জন'],
  id: ['Pilih atau tulis pertanyaan (1–10)', 'Mulai membuat kuis', '1–10 pertanyaan · hingga 50 orang'],
  ms: ['Pilih atau tulis soalan (1–10)', 'Mula mencipta kuiz', '1–10 soalan · sehingga 50 orang'],
  th: ['เลือกหรือเขียนคำถาม (1–10 ข้อ)', 'เริ่มสร้างควิซ', '1–10 ข้อ · สูงสุด 50 คน'],
  vi: ['Chọn hoặc viết câu hỏi (1–10)', 'Bắt đầu tạo câu đố', '1–10 câu hỏi · tối đa 50 người'],
  ko: ['출제할 문제를 선택하거나 만들기 (1~10문제)', '퀴즈 만들기 시작', '1~10문제 · 최대 50명'],
  'zh-Hans': ['选择或编写题目（1～10题）', '开始创建测验', '1～10题 · 最多50人'],
  'zh-Hant': ['選擇或編寫題目（1～10題）', '開始建立測驗', '1～10題 · 最多50人'],
};
export function homeEntryCopy(locale = 'ja') {
  const [step, start, note] = rows[locale] || rows.ja;
  return { step, start, note };
}
export function translateHomeEntryCopy(value, locale) {
  const index = rows.ja.indexOf(value.trim());
  return index < 0 ? undefined : value.replace(value.trim(), (rows[locale] || rows.ja)[index]);
}
