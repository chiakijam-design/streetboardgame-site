// Fixed UI copy only; native-language review remains unverified.
const rows = `ja|クイズを完成|この{count}問でクイズを完成|この{count}問でクイズを完成|1問から作れます。最大{max}問まで追加できます。
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

// 2026-11-22（Gemini 見直し6）：途中の問題を飛ばした・直したあと、後ろに答えた問題が残っているときの案内（後ろを黙って消さない）
const gapRows = `ja|Q{n}の答えを選ぶと、後ろの問題も含めて完成できます。
en|Choose an answer for Q{n} to keep the questions after it.
es|Elige la respuesta de Q{n} para incluir también las preguntas siguientes.
fr|Choisissez la réponse de Q{n} pour inclure aussi les questions suivantes.
de|Wähle die Antwort für Q{n}, um auch die folgenden Fragen einzuschließen.
it|Scegli la risposta di Q{n} per includere anche le domande successive.
pt|Escolha a resposta da Q{n} para incluir também as perguntas seguintes.
ru|Выберите ответ на Q{n}, чтобы включить и следующие вопросы.
uk|Виберіть відповідь на Q{n}, щоб додати й наступні запитання.
pl|Wybierz odpowiedź na Q{n}, aby uwzględnić także kolejne pytania.
nl|Kies het antwoord op Q{n} om ook de volgende vragen mee te nemen.
sv|Välj svaret på Q{n} för att även ta med de följande frågorna.
da|Vælg svaret på Q{n} for også at tage de følgende spørgsmål med.
no|Velg svaret på Q{n} for å ta med de neste spørsmålene også.
fi|Valitse vastaus kohtaan Q{n}, niin myös seuraavat kysymykset tulevat mukaan.
cs|Vyberte odpověď na Q{n}, aby se zahrnuly i další otázky.
el|Επιλέξτε απάντηση για την Q{n} ώστε να συμπεριληφθούν και οι επόμενες ερωτήσεις.
ro|Alege răspunsul la Q{n} ca să incluzi și întrebările următoare.
hu|Válaszd ki a Q{n} válaszát, hogy a következő kérdések is bekerüljenek.
bg|Изберете отговор на Q{n}, за да включите и следващите въпроси.
hr|Odaberi odgovor na Q{n} kako bi uključio i sljedeća pitanja.
sk|Vyberte odpoveď na Q{n}, aby sa zahrnuli aj ďalšie otázky.
tr|Sonraki soruları da eklemek için Q{n} sorusunun cevabını seç.
ar|اختر إجابة Q{n} لتضمين الأسئلة التالية أيضًا.
he|בחרו תשובה ל-Q{n} כדי לכלול גם את השאלות הבאות.
hi|आगे के सवाल भी शामिल करने के लिए Q{n} का जवाब चुनें।
bn|পরের প্রশ্নগুলোও রাখতে Q{n}-এর উত্তর বেছে নিন।
id|Pilih jawaban untuk Q{n} agar pertanyaan berikutnya ikut disertakan.
ms|Pilih jawapan untuk Q{n} supaya soalan seterusnya turut disertakan.
th|เลือกคำตอบของ Q{n} เพื่อรวมคำถามถัดไปด้วย
vi|Chọn đáp án cho Q{n} để giữ cả các câu hỏi phía sau.
ko|Q{n}의 답을 고르면 뒤의 문제까지 포함해 완성할 수 있어요.
zh-Hans|选择Q{n}的答案后，可连同后面的题目一起完成。
zh-Hant|選擇Q{n}的答案後，可連同後面的題目一起完成。`;
export const CHALLENGE_GAP_COPY = Object.freeze(Object.fromEntries(gapRows.split(String.fromCharCode(10)).map(row => { const [locale, text] = row.split('|'); return [locale, text]; })));
export function challengeGapCopy(locale, questionNumber) {
  return (CHALLENGE_GAP_COPY[locale] || CHALLENGE_GAP_COPY.en).replaceAll('{n}', String(questionNumber));
}
