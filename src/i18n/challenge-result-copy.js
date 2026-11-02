// Game-only fixed UI copy. Native-language review remains unverified.
const rows = `ja|次は私が出題する|同じ問題で作る|新しい問題で作る|1問ごとの正解・不正解を見る|1問ごとの結果を閉じる
en|My turn to create a quiz|Use the same questions|Use new questions|See which answers were right or wrong|Hide question-by-question results
es|Ahora me toca crear un cuestionario|Usar las mismas preguntas|Usar preguntas nuevas|Ver aciertos y errores de cada pregunta|Ocultar resultados por pregunta
fr|À mon tour de créer un quiz|Utiliser les mêmes questions|Utiliser de nouvelles questions|Voir les réponses justes et fausses par question|Masquer les résultats par question
de|Jetzt erstelle ich ein Quiz|Dieselben Fragen verwenden|Neue Fragen verwenden|Richtige und falsche Antworten je Frage ansehen|Ergebnisse je Frage ausblenden
it|Ora creo io un quiz|Usa le stesse domande|Usa nuove domande|Vedi risposte corrette ed errate per domanda|Nascondi i risultati per domanda
pt|Agora é a minha vez de criar um quiz|Usar as mesmas perguntas|Usar novas perguntas|Ver acertos e erros de cada pergunta|Ocultar resultados por pergunta
ru|Теперь я создам тест|Использовать те же вопросы|Использовать новые вопросы|Посмотреть правильные и ошибочные ответы на каждый вопрос|Скрыть результаты по вопросам
uk|Тепер я створю тест|Використати ті самі запитання|Використати нові запитання|Переглянути правильні й помилкові відповіді на кожне запитання|Приховати результати за запитаннями
pl|Teraz ja tworzę quiz|Użyj tych samych pytań|Użyj nowych pytań|Zobacz poprawne i błędne odpowiedzi na każde pytanie|Ukryj wyniki poszczególnych pytań
nl|Nu maak ik een quiz|Dezelfde vragen gebruiken|Nieuwe vragen gebruiken|Bekijk goede en foute antwoorden per vraag|Verberg resultaten per vraag
sv|Nu skapar jag ett quiz|Använd samma frågor|Använd nya frågor|Se rätt och fel svar för varje fråga|Dölj resultaten per fråga
da|Nu laver jeg en quiz|Brug de samme spørgsmål|Brug nye spørgsmål|Se rigtige og forkerte svar for hvert spørgsmål|Skjul resultaterne for hvert spørgsmål
no|Nå lager jeg en quiz|Bruk de samme spørsmålene|Bruk nye spørsmål|Se riktige og gale svar på hvert spørsmål|Skjul resultatene for hvert spørsmål
fi|Nyt minä teen visan|Käytä samoja kysymyksiä|Käytä uusia kysymyksiä|Katso jokaisen kysymyksen oikeat ja väärät vastaukset|Piilota kysymyskohtaiset tulokset
cs|Teď vytvořím kvíz já|Použít stejné otázky|Použít nové otázky|Zobrazit správné a chybné odpovědi u každé otázky|Skrýt výsledky jednotlivých otázek
el|Τώρα φτιάχνω εγώ ένα κουίζ|Χρήση των ίδιων ερωτήσεων|Χρήση νέων ερωτήσεων|Δείτε σωστές και λανθασμένες απαντήσεις ανά ερώτηση|Απόκρυψη αποτελεσμάτων ανά ερώτηση
ro|Acum creez eu un quiz|Folosește aceleași întrebări|Folosește întrebări noi|Vezi răspunsurile corecte și greșite la fiecare întrebare|Ascunde rezultatele pe întrebări
hu|Most én készítek kvízt|Ugyanazok a kérdések|Új kérdések|Helyes és hibás válaszok megtekintése kérdésenként|Kérdésenkénti eredmények elrejtése
bg|Сега аз създавам тест|Използвай същите въпроси|Използвай нови въпроси|Виж верните и грешните отговори на всеки въпрос|Скрий резултатите по въпроси
hr|Sada ja izrađujem kviz|Upotrijebi ista pitanja|Upotrijebi nova pitanja|Prikaži točne i netočne odgovore za svako pitanje|Sakrij rezultate po pitanjima
sk|Teraz vytvorím kvíz ja|Použiť rovnaké otázky|Použiť nové otázky|Zobraziť správne a nesprávne odpovede na každú otázku|Skryť výsledky jednotlivých otázok
tr|Şimdi ben test hazırlıyorum|Aynı soruları kullan|Yeni sorular kullan|Her sorunun doğru ve yanlış yanıtlarını gör|Soru bazındaki sonuçları gizle
ar|الآن دوري لإنشاء اختبار|استخدام الأسئلة نفسها|استخدام أسئلة جديدة|عرض الإجابات الصحيحة والخاطئة لكل سؤال|إخفاء نتائج كل سؤال
he|עכשיו תורי ליצור חידון|שימוש באותן שאלות|שימוש בשאלות חדשות|לראות בכל שאלה מה נכון ומה שגוי|הסתרת התוצאות לכל שאלה
hi|अब मेरी बारी क्विज़ बनाने की|यही सवाल इस्तेमाल करें|नए सवाल इस्तेमाल करें|हर सवाल के सही और गलत जवाब देखें|हर सवाल के नतीजे छिपाएँ
bn|এবার আমার কুইজ তৈরির পালা|একই প্রশ্ন ব্যবহার করুন|নতুন প্রশ্ন ব্যবহার করুন|প্রতিটি প্রশ্নের সঠিক ও ভুল উত্তর দেখুন|প্রশ্নভিত্তিক ফলাফল লুকান
id|Sekarang giliranku membuat kuis|Gunakan pertanyaan yang sama|Gunakan pertanyaan baru|Lihat jawaban benar dan salah tiap pertanyaan|Sembunyikan hasil tiap pertanyaan
ms|Sekarang giliran saya mencipta kuiz|Guna soalan yang sama|Guna soalan baharu|Lihat jawapan betul dan salah bagi setiap soalan|Sembunyikan keputusan setiap soalan
th|ถึงตาฉันสร้างควิซแล้ว|ใช้คำถามเดิม|ใช้คำถามใหม่|ดูคำตอบที่ถูกและผิดของแต่ละข้อ|ซ่อนผลของแต่ละข้อ
vi|Đến lượt tôi tạo câu đố|Dùng cùng câu hỏi|Dùng câu hỏi mới|Xem câu trả lời đúng và sai của từng câu hỏi|Ẩn kết quả từng câu hỏi
ko|이제 내가 퀴즈를 낼 차례|같은 문제로 만들기|새 문제로 만들기|문제별 정답과 오답 보기|문제별 결과 접기
zh-Hans|这次由我来出题|用相同题目创建|用新题目创建|查看每道题答对或答错|收起每道题的结果
zh-Hant|這次由我來出題|用相同題目建立|用新題目建立|查看每道題答對或答錯|收起每道題的結果`;
export const CHALLENGE_RESULT_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map(row => {
  const [locale, heading, same, fresh, details, close] = row.split('|');
  return [locale, Object.freeze({heading, same, fresh, details, close})];
})));
export function challengeResultCopy(locale, key) {
  return (CHALLENGE_RESULT_COPY[locale] || CHALLENGE_RESULT_COPY.en)[key];
}
