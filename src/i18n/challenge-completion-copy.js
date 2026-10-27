// Fixed UI copy only; native-language review remains unverified.
const rows = `ja|クイズを作成|この{count}問でクイズを作成|この{count}問でクイズを作成|1問から作れます。最大{max}問まで追加できます。
en|Create a quiz|Create a quiz with {count} question|Create a quiz with {count} questions|You can start with 1 question and add up to {max} questions.
es|Crear un cuestionario|Crear un cuestionario con {count} pregunta|Crear un cuestionario con {count} preguntas|Puedes crearlo con 1 pregunta y añadir hasta {max} preguntas.
fr|Créer un quiz|Créer un quiz avec {count} question|Créer un quiz avec {count} questions|Vous pouvez créer un quiz dès 1 question et en ajouter jusqu’à {max}.
de|Quiz erstellen|Quiz mit {count} Frage erstellen|Quiz mit {count} Fragen erstellen|Du kannst mit 1 Frage beginnen und bis zu {max} Fragen hinzufügen.
it|Crea un quiz|Crea un quiz con {count} domanda|Crea un quiz con {count} domande|Puoi iniziare con 1 domanda e aggiungerne fino a {max}.
pt|Criar um quiz|Criar um quiz com {count} pergunta|Criar um quiz com {count} perguntas|Podes criar com 1 pergunta e adicionar até {max} perguntas.
ru|Создать тест|Создать тест из {count} вопроса|Создать тест из {count} вопросов|Можно создать тест из 1 вопроса и добавить до {max} вопросов.
uk|Створити тест|Створити тест з {count} запитання|Створити тест з {count} запитань|Можна створити тест з 1 запитання та додати до {max} запитань.
pl|Utwórz quiz|Utwórz quiz z {count} pytania|Utwórz quiz z {count} pytań|Możesz zacząć od 1 pytania i dodać maksymalnie {max} pytań.
nl|Een quiz maken|Quiz met {count} vraag maken|Quiz met {count} vragen maken|Je kunt met 1 vraag beginnen en tot {max} vragen toevoegen.
sv|Skapa ett quiz|Skapa ett quiz med {count} fråga|Skapa ett quiz med {count} frågor|Du kan börja med 1 fråga och lägga till upp till {max} frågor.
da|Opret en quiz|Opret en quiz med {count} spørgsmål|Opret en quiz med {count} spørgsmål|Du kan starte med 1 spørgsmål og tilføje op til {max} spørgsmål.
no|Lag en quiz|Lag en quiz med {count} spørsmål|Lag en quiz med {count} spørsmål|Du kan begynne med 1 spørsmål og legge til opptil {max} spørsmål.
fi|Luo visa|Luo visa yhdestä kysymyksestä|Luo visa {count} kysymyksestä|Voit aloittaa yhdestä kysymyksestä ja lisätä enintään {max} kysymystä.
cs|Vytvořit kvíz|Vytvořit kvíz s {count} otázkou|Vytvořit kvíz s {count} otázkami|Můžete začít s 1 otázkou a přidat až {max} otázek.
el|Δημιουργία κουίζ|Δημιουργία κουίζ με {count} ερώτηση|Δημιουργία κουίζ με {count} ερωτήσεις|Μπορείτε να ξεκινήσετε με 1 ερώτηση και να προσθέσετε έως {max} ερωτήσεις.
ro|Creează un quiz|Creează un quiz cu {count} întrebare|Creează un quiz cu {count} întrebări|Poți începe cu 1 întrebare și adăuga până la {max} întrebări.
hu|Kvíz létrehozása|Kvíz készítése {count} kérdésből|Kvíz készítése {count} kérdésből|Már 1 kérdésből is készíthetsz kvízt, legfeljebb {max} kérdésig.
bg|Създай тест|Създай тест с {count} въпрос|Създай тест с {count} въпроса|Можеш да започнеш с 1 въпрос и да добавиш до {max} въпроса.
hr|Izradi kviz|Izradi kviz s {count} pitanjem|Izradi kviz s {count} pitanja|Možeš početi s 1 pitanjem i dodati najviše {max} pitanja.
sk|Vytvoriť kvíz|Vytvoriť kvíz s {count} otázkou|Vytvoriť kvíz s {count} otázkami|Môžete začať s 1 otázkou a pridať až {max} otázok.
tr|Test oluştur|{count} soruyla test oluştur|{count} soruyla test oluştur|1 soruyla başlayabilir, en fazla {max} soru ekleyebilirsin.
ar|إنشاء اختبار|إنشاء اختبار من سؤال واحد|إنشاء اختبار من {count} أسئلة|يمكنك البدء بسؤال واحد وإضافة أسئلة حتى {max} أسئلة.
he|יצירת חידון|יצירת חידון עם שאלה אחת|יצירת חידון עם {count} שאלות|אפשר להתחיל משאלה אחת ולהוסיף עד {max} שאלות.
hi|क्विज़ बनाएँ|इस {count} सवाल से क्विज़ बनाएँ|इन {count} सवालों से क्विज़ बनाएँ|1 सवाल से शुरू कर सकते हैं। अधिकतम {max} सवाल जोड़ सकते हैं।
bn|কুইজ তৈরি করুন|এই {count}টি প্রশ্ন দিয়ে কুইজ তৈরি করুন|এই {count}টি প্রশ্ন দিয়ে কুইজ তৈরি করুন|1টি প্রশ্ন দিয়েই শুরু করতে পারেন। সর্বোচ্চ {max}টি প্রশ্ন যোগ করা যায়।
id|Buat kuis|Buat kuis dengan {count} pertanyaan|Buat kuis dengan {count} pertanyaan|Kamu bisa mulai dengan 1 pertanyaan dan menambahkan hingga {max} pertanyaan.
ms|Cipta kuiz|Cipta kuiz dengan {count} soalan|Cipta kuiz dengan {count} soalan|Anda boleh bermula dengan 1 soalan dan menambah sehingga {max} soalan.
th|สร้างควิซ|สร้างควิซด้วยคำถาม {count} ข้อ|สร้างควิซด้วยคำถาม {count} ข้อ|เริ่มได้ตั้งแต่ 1 ข้อ และเพิ่มได้สูงสุด {max} ข้อ
vi|Tạo câu đố|Tạo câu đố với {count} câu hỏi|Tạo câu đố với {count} câu hỏi|Bạn có thể bắt đầu với 1 câu hỏi và thêm tối đa {max} câu hỏi.
ko|퀴즈 만들기|이 {count}문제로 퀴즈 만들기|이 {count}문제로 퀴즈 만들기|1문제부터 만들 수 있어요. 최대 {max}문제까지 추가할 수 있어요.
zh-Hans|创建测验|用这{count}道题创建测验|用这{count}道题创建测验|1道题就能创建，最多可添加到{max}道题。
zh-Hant|建立測驗|用這{count}道題建立測驗|用這{count}道題建立測驗|1道題就能建立，最多可新增到{max}道題。`;

export const CHALLENGE_COMPLETION_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map(row => {
  const [locale, zero, one, other, help] = row.split('|');
  return [locale, Object.freeze({zero, one, other, help})];
})));

export function challengeCompletionCopy(locale, count, maximum = 10) {
  if (!Number.isInteger(count) || !Number.isInteger(maximum) || maximum < 1 || maximum > 10 || count < 0 || count > maximum) throw new RangeError('Invalid quiz length');
  const copy = CHALLENGE_COMPLETION_COPY[locale] || CHALLENGE_COMPLETION_COPY.en;
  let label = count === 0 ? copy.zero : count === 1 ? copy.one : copy.other;
  if (locale === 'ar' && count === 2) label = 'إنشاء اختبار من سؤالين';
  let help = copy.help.replaceAll('{max}', String(maximum));
  // A role swap can have a one-question ceiling; do not promise more questions.
  if (maximum === 1 && !['ja', 'ko', 'zh-Hans', 'zh-Hant'].includes(locale)) help = copy.one.replaceAll('{count}', '1') + '.';
  if (locale === 'ar' && maximum === 2) help = 'يمكنك البدء بسؤال واحد وإضافة سؤال آخر.';
  return {label: label.replaceAll('{count}', String(count)), help};
}
