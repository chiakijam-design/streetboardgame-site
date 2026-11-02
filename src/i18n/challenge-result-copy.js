// Game-only fixed UI copy. Native-language review remains unverified.
const rows = `ja|次は私が出題する|同じ問題で作る|新しい問題で作る|詳しく見る|閉じる
en|My turn to create a quiz|Use the same questions|Use new questions|View details|Close details
es|Ahora me toca crear un cuestionario|Usar las mismas preguntas|Usar preguntas nuevas|Ver detalles|Cerrar detalles
fr|À mon tour de créer un quiz|Utiliser les mêmes questions|Utiliser de nouvelles questions|Voir les détails|Fermer les détails
de|Jetzt erstelle ich ein Quiz|Dieselben Fragen verwenden|Neue Fragen verwenden|Details ansehen|Details schließen
it|Ora creo io un quiz|Usa le stesse domande|Usa nuove domande|Mostra dettagli|Chiudi dettagli
pt|Agora é a minha vez de criar um quiz|Usar as mesmas perguntas|Usar novas perguntas|Ver detalhes|Fechar detalhes
ru|Теперь я создам тест|Использовать те же вопросы|Использовать новые вопросы|Подробнее|Скрыть подробности
uk|Тепер я створю тест|Використати ті самі запитання|Використати нові запитання|Докладніше|Приховати подробиці
pl|Teraz ja tworzę quiz|Użyj tych samych pytań|Użyj nowych pytań|Zobacz szczegóły|Ukryj szczegóły
nl|Nu maak ik een quiz|Dezelfde vragen gebruiken|Nieuwe vragen gebruiken|Details bekijken|Details sluiten
sv|Nu skapar jag ett quiz|Använd samma frågor|Använd nya frågor|Visa detaljer|Dölj detaljer
da|Nu laver jeg en quiz|Brug de samme spørgsmål|Brug nye spørgsmål|Se detaljer|Skjul detaljer
no|Nå lager jeg en quiz|Bruk de samme spørsmålene|Bruk nye spørsmål|Vis detaljer|Skjul detaljer
fi|Nyt minä teen visan|Käytä samoja kysymyksiä|Käytä uusia kysymyksiä|Näytä tiedot|Piilota tiedot
cs|Teď vytvořím kvíz já|Použít stejné otázky|Použít nové otázky|Zobrazit podrobnosti|Skrýt podrobnosti
el|Τώρα φτιάχνω εγώ ένα κουίζ|Χρήση των ίδιων ερωτήσεων|Χρήση νέων ερωτήσεων|Προβολή λεπτομερειών|Απόκρυψη λεπτομερειών
ro|Acum creez eu un quiz|Folosește aceleași întrebări|Folosește întrebări noi|Vezi detalii|Ascunde detaliile
hu|Most én készítek kvízt|Ugyanazok a kérdések|Új kérdések|Részletek megtekintése|Részletek bezárása
bg|Сега аз създавам тест|Използвай същите въпроси|Използвай нови въпроси|Виж подробности|Скрий подробностите
hr|Sada ja izrađujem kviz|Upotrijebi ista pitanja|Upotrijebi nova pitanja|Prikaži pojedinosti|Sakrij pojedinosti
sk|Teraz vytvorím kvíz ja|Použiť rovnaké otázky|Použiť nové otázky|Zobraziť podrobnosti|Skryť podrobnosti
tr|Şimdi ben test hazırlıyorum|Aynı soruları kullan|Yeni sorular kullan|Ayrıntıları gör|Ayrıntıları gizle
ar|الآن دوري لإنشاء اختبار|استخدام الأسئلة نفسها|استخدام أسئلة جديدة|عرض التفاصيل|إخفاء التفاصيل
he|עכשיו תורי ליצור חידון|שימוש באותן שאלות|שימוש בשאלות חדשות|הצגת פרטים|הסתרת פרטים
hi|अब मेरी बारी क्विज़ बनाने की|यही सवाल इस्तेमाल करें|नए सवाल इस्तेमाल करें|विवरण देखें|विवरण बंद करें
bn|এবার আমার কুইজ তৈরির পালা|একই প্রশ্ন ব্যবহার করুন|নতুন প্রশ্ন ব্যবহার করুন|বিস্তারিত দেখুন|বিস্তারিত বন্ধ করুন
id|Sekarang giliranku membuat kuis|Gunakan pertanyaan yang sama|Gunakan pertanyaan baru|Lihat detail|Tutup detail
ms|Sekarang giliran saya mencipta kuiz|Guna soalan yang sama|Guna soalan baharu|Lihat butiran|Tutup butiran
th|ถึงตาฉันสร้างควิซแล้ว|ใช้คำถามเดิม|ใช้คำถามใหม่|ดูรายละเอียด|ซ่อนรายละเอียด
vi|Đến lượt tôi tạo câu đố|Dùng cùng câu hỏi|Dùng câu hỏi mới|Xem chi tiết|Ẩn chi tiết
ko|이제 내가 퀴즈를 낼 차례|같은 문제로 만들기|새 문제로 만들기|자세히 보기|접기
zh-Hans|这次由我来出题|用相同题目创建|用新题目创建|查看详情|收起详情
zh-Hant|這次由我來出題|用相同題目建立|用新題目建立|查看詳情|收起詳情`;
export const CHALLENGE_RESULT_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map(row => {
  const [locale, heading, same, fresh, details, close] = row.split('|');
  return [locale, Object.freeze({heading, same, fresh, details, close})];
})));
export function challengeResultCopy(locale, key) {
  return (CHALLENGE_RESULT_COPY[locale] || CHALLENGE_RESULT_COPY.en)[key];
}
