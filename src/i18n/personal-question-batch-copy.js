const rows = `ja|選んだ{count}問で続ける|あと{max}問までまとめて選べます。選んだ問題の正解を順番に選ぶと、クイズが完成します。
en|Continue with {count} selected questions|Select up to {max} questions. Choose each answer in order to finish the quiz.
es|Continuar con {count} preguntas|Elige hasta {max} preguntas. Selecciona cada respuesta en orden para completar el cuestionario.
fr|Continuer avec {count} questions|Choisissez jusqu’à {max} questions, puis chaque réponse dans l’ordre pour terminer le quiz.
de|Mit {count} Fragen fortfahren|Wähle bis zu {max} Fragen. Wähle dann jede Antwort der Reihe nach, um das Quiz abzuschließen.
it|Continua con {count} domande|Scegli fino a {max} domande, poi ogni risposta in ordine per completare il quiz.
pt|Continuar com {count} perguntas|Escolha até {max} perguntas e depois cada resposta por ordem para concluir o quiz.
ru|Продолжить с {count} вопросами|Выберите до {max} вопросов, затем ответы по порядку, чтобы завершить викторину.
uk|Продовжити з {count} запитаннями|Виберіть до {max} запитань, потім відповіді по черзі, щоб завершити тест.
pl|Kontynuuj z {count} pytaniami|Wybierz do {max} pytań, a następnie odpowiedzi po kolei, aby ukończyć quiz.
nl|Verder met {count} vragen|Kies maximaal {max} vragen en daarna elk antwoord op volgorde om de quiz te voltooien.
sv|Fortsätt med {count} frågor|Välj högst {max} frågor och sedan varje svar i ordning för att slutföra quizet.
da|Fortsæt med {count} spørgsmål|Vælg op til {max} spørgsmål og derefter hvert svar i rækkefølge for at afslutte quizzen.
no|Fortsett med {count} spørsmål|Velg opptil {max} spørsmål, og deretter hvert svar i rekkefølge for å fullføre quizen.
fi|Jatka {count} kysymyksellä|Valitse enintään {max} kysymystä ja sitten vastaukset järjestyksessä viimeistelläksesi visan.
cs|Pokračovat s {count} otázkami|Vyberte až {max} otázek a pak postupně odpovědi pro dokončení kvízu.
el|Συνέχεια με {count} ερωτήσεις|Επιλέξτε έως {max} ερωτήσεις και μετά κάθε απάντηση με τη σειρά για να ολοκληρώσετε το κουίζ.
ro|Continuă cu {count} întrebări|Alege până la {max} întrebări, apoi răspunsurile în ordine pentru a termina quizul.
hu|Folytatás {count} kérdéssel|Válassz legfeljebb {max} kérdést, majd sorban a válaszokat a kvíz befejezéséhez.
bg|Продължи с {count} въпроса|Изберете до {max} въпроса, после отговорите по ред, за да завършите теста.
hr|Nastavi s {count} pitanja|Odaberite do {max} pitanja pa svaki odgovor redom da dovršite kviz.
sk|Pokračovať s {count} otázkami|Vyberte až {max} otázok a potom odpovede v poradí na dokončenie kvízu.
tr|{count} soruyla devam et|En fazla {max} soru seçin, ardından testi bitirmek için yanıtları sırayla seçin.
ar|المتابعة مع {count} أسئلة|اختر حتى {max} أسئلة، ثم اختر إجابة كل سؤال بالترتيب لإكمال الاختبار.
he|המשך עם {count} שאלות|בחרו עד {max} שאלות, ואז תשובה לכל שאלה לפי הסדר כדי להשלים את החידון.
hi|{count} चुने सवालों से आगे बढ़ें|अधिकतम {max} सवाल चुनें। फिर क्रम से जवाब चुनकर क्विज़ पूरा करें।
bn|বাছা {count} প্রশ্ন নিয়ে এগোন|সর্বোচ্চ {max} প্রশ্ন বাছুন। তারপর ক্রমে উত্তর বেছে কুইজ সম্পূর্ণ করুন।
id|Lanjutkan dengan {count} pertanyaan|Pilih hingga {max} pertanyaan, lalu setiap jawaban berurutan untuk menyelesaikan kuis.
ms|Teruskan dengan {count} soalan|Pilih hingga {max} soalan, kemudian setiap jawapan mengikut turutan untuk melengkapkan kuiz.
th|ทำต่อด้วย {count} คำถาม|เลือกได้สูงสุด {max} คำถาม แล้วเลือกคำตอบตามลำดับเพื่อสร้างควิซให้เสร็จ
vi|Tiếp tục với {count} câu hỏi|Chọn tối đa {max} câu hỏi, sau đó chọn từng đáp án theo thứ tự để hoàn tất câu đố.
ko|선택한 {count}문제로 계속|최대 {max}문제를 고르세요. 정답을 차례로 고르면 퀴즈가 완성됩니다.
zh-Hans|使用选中的{count}题继续|最多选择{max}题，随后按顺序选择正确答案即可完成测验。
zh-Hant|使用選取的{count}題繼續|最多選擇{max}題，隨後依序選擇正確答案即可完成測驗。`;
export const PERSONAL_BATCH_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map(row => {
  const [locale,apply,help]=row.split('|');if(!help)throw new Error('Missing batch copy '+locale);return [locale,{apply,help}];
})));
export const personalBatchCopy = (locale,key,values={}) => Object.entries(values).reduce((text,[key,value])=>text.replaceAll('{'+key+'}',String(value)),(PERSONAL_BATCH_COPY[locale] || PERSONAL_BATCH_COPY.en)[key]);
