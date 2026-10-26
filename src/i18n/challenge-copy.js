// New fixed UI copy. Names, answers and management capabilities never enter this table.
// Machine translated; native-language review remains unverified, as for existing catalogs.
const rows = `ja|ここまでで作成を完了|回答済みの問題だけで完成しますか？|この問数で完成する|友達に送る|まだ回答はありません。まず1人にクイズのURLを送ってみよう。|今週のお題|今週のお題は準備中です。下のライブラリから選べます。|私のことも当ててみて
en|Finish with these answers|Create a quiz with only the answered questions?|Create this quiz|Send to a friend|No answers yet. Send the quiz URL to one friend first.|This week's themes|This week's themes are not ready. Choose from the library below.|Guess my answers too
es|Terminar con estas respuestas|¿Crear un cuestionario solo con las preguntas respondidas?|Crear este cuestionario|Enviar a un amigo|Aún no hay respuestas. Envía primero el enlace a un amigo.|Temas de esta semana|Los temas aún no están listos. Elige en la biblioteca de abajo.|Adivina también mis respuestas
fr|Terminer avec ces réponses|Créer un quiz avec seulement les questions répondues ?|Créer ce quiz|Envoyer à un ami|Aucune réponse. Envoie d'abord le lien du quiz à un ami.|Thèmes de la semaine|Les thèmes ne sont pas prêts. Choisis dans la bibliothèque ci-dessous.|Devine aussi mes réponses
de|Mit diesen Antworten abschließen|Quiz nur mit den beantworteten Fragen erstellen?|Dieses Quiz erstellen|An Freunde senden|Noch keine Antworten. Sende den Quiz-Link zuerst an eine Person.|Themen dieser Woche|Die Themen sind noch nicht bereit. Wähle unten aus der Bibliothek.|Errate auch meine Antworten
it|Termina con queste risposte|Creare un quiz solo con le domande già risposte?|Crea questo quiz|Invia a un amico|Nessuna risposta. Invia prima il link del quiz a un amico.|Temi della settimana|I temi non sono ancora pronti. Scegli dalla raccolta qui sotto.|Indovina anche le mie risposte
pt|Concluir com estas respostas|Criar um quiz só com as perguntas respondidas?|Criar este quiz|Enviar a um amigo|Ainda não há respostas. Envia primeiro o link a um amigo.|Temas desta semana|Os temas ainda não estão prontos. Escolhe na biblioteca abaixo.|Adivinha também as minhas respostas
ru|Завершить с этими ответами|Создать тест только из отвеченных вопросов?|Создать этот тест|Отправить другу|Ответов пока нет. Сначала отправьте ссылку одному другу.|Темы этой недели|Темы пока не готовы. Выберите в библиотеке ниже.|Угадай и мои ответы
uk|Завершити з цими відповідями|Створити тест лише з питань із відповідями?|Створити цей тест|Надіслати другу|Відповідей ще немає. Спочатку надішліть посилання одному другу.|Теми цього тижня|Теми ще не готові. Виберіть у бібліотеці нижче.|Вгадай і мої відповіді
pl|Zakończ z tymi odpowiedziami|Utworzyć quiz tylko z pytań z odpowiedziami?|Utwórz ten quiz|Wyślij znajomemu|Brak odpowiedzi. Najpierw wyślij link jednej osobie.|Tematy tego tygodnia|Tematy nie są gotowe. Wybierz z biblioteki poniżej.|Zgadnij też moje odpowiedzi
nl|Afronden met deze antwoorden|Een quiz maken met alleen beantwoorde vragen?|Deze quiz maken|Naar een vriend sturen|Nog geen antwoorden. Stuur de quizlink eerst naar één vriend.|Thema's van deze week|De thema's zijn nog niet klaar. Kies uit de bibliotheek hieronder.|Raad ook mijn antwoorden
sv|Avsluta med dessa svar|Skapa ett quiz med bara besvarade frågor?|Skapa detta quiz|Skicka till en vän|Inga svar än. Skicka först quizlänken till en vän.|Veckans teman|Temana är inte klara. Välj i biblioteket nedan.|Gissa mina svar också
da|Afslut med disse svar|Opret en quiz kun med besvarede spørgsmål?|Opret denne quiz|Send til en ven|Ingen svar endnu. Send først quizlinket til en ven.|Ugens temaer|Temaerne er ikke klar. Vælg fra biblioteket nedenfor.|Gæt også mine svar
no|Avslutt med disse svarene|Lage en quiz med bare besvarte spørsmål?|Lag denne quizen|Send til en venn|Ingen svar ennå. Send først quizlenken til én venn.|Ukens temaer|Temaene er ikke klare. Velg fra biblioteket nedenfor.|Gjett svarene mine også
fi|Valmis näillä vastauksilla|Luodaanko visa vain vastatuista kysymyksistä?|Luo tämä visa|Lähetä ystävälle|Ei vielä vastauksia. Lähetä ensin visan linkki yhdelle ystävälle.|Viikon aiheet|Aiheet eivät ole valmiita. Valitse alla olevasta kirjastosta.|Arvaa myös minun vastaukseni
cs|Dokončit s těmito odpověďmi|Vytvořit kvíz jen ze zodpovězených otázek?|Vytvořit tento kvíz|Poslat příteli|Zatím žádné odpovědi. Nejprve pošlete odkaz jednomu příteli.|Témata tohoto týdne|Témata nejsou připravena. Vyberte z knihovny níže.|Hádej také moje odpovědi
el|Ολοκλήρωση με αυτές τις απαντήσεις|Δημιουργία κουίζ μόνο με τις απαντημένες ερωτήσεις;|Δημιουργία αυτού του κουίζ|Αποστολή σε φίλο|Δεν υπάρχουν απαντήσεις. Στείλε πρώτα τον σύνδεσμο σε έναν φίλο.|Θέματα της εβδομάδας|Τα θέματα δεν είναι έτοιμα. Διάλεξε από τη βιβλιοθήκη παρακάτω.|Μάντεψε και τις δικές μου απαντήσεις
ro|Finalizează cu aceste răspunsuri|Creezi un test doar cu întrebările la care ai răspuns?|Creează acest test|Trimite unui prieten|Încă nu sunt răspunsuri. Trimite mai întâi linkul unui prieten.|Temele săptămânii|Temele nu sunt pregătite. Alege din biblioteca de mai jos.|Ghicește și răspunsurile mele
hu|Befejezés ezekkel a válaszokkal|Kvíz készítése csak a megválaszolt kérdésekből?|Kvíz létrehozása|Küldés egy barátnak|Még nincs válasz. Először küldd el a kvíz linkjét egy barátnak.|A hét témái|A témák még nem érhetők el. Válassz az alábbi könyvtárból.|Találd ki az én válaszaimat is
bg|Завърши с тези отговори|Да се създаде тест само с отговорените въпроси?|Създай този тест|Изпрати на приятел|Все още няма отговори. Първо изпрати връзката на един приятел.|Темите на седмицата|Темите още не са готови. Избери от библиотеката по-долу.|Познай и моите отговори
hr|Završi s ovim odgovorima|Izraditi kviz samo s odgovorenim pitanjima?|Izradi ovaj kviz|Pošalji prijatelju|Još nema odgovora. Najprije pošalji poveznicu jednom prijatelju.|Teme ovog tjedna|Teme još nisu spremne. Odaberi iz zbirke u nastavku.|Pogodi i moje odgovore
sk|Dokončiť s týmito odpoveďami|Vytvoriť kvíz len zo zodpovedaných otázok?|Vytvoriť tento kvíz|Poslať priateľovi|Zatiaľ žiadne odpovede. Najprv pošli odkaz jednému priateľovi.|Témy tohto týždňa|Témy ešte nie sú pripravené. Vyber z knižnice nižšie.|Uhádni aj moje odpovede
tr|Bu yanıtlarla tamamla|Yalnızca yanıtlanan sorularla bir test oluşturulsun mu?|Bu testi oluştur|Bir arkadaşına gönder|Henüz yanıt yok. Önce test bağlantısını bir arkadaşına gönder.|Bu haftanın temaları|Temalar henüz hazır değil. Aşağıdaki kitaplıktan seç.|Benim yanıtlarımı da tahmin et
ar|إنهاء بهذه الإجابات|هل تريد إنشاء اختبار بالأسئلة المجاب عنها فقط؟|إنشاء هذا الاختبار|إرسال إلى صديق|لا توجد إجابات بعد. أرسل رابط الاختبار إلى صديق أولاً.|مواضيع هذا الأسبوع|المواضيع غير جاهزة. اختر من المكتبة أدناه.|خمّن إجاباتي أيضاً
he|סיום עם התשובות האלה|ליצור חידון רק מהשאלות שנענו?|יצירת החידון|שליחה לחבר|עדיין אין תשובות. שלחו קודם את קישור החידון לחבר אחד.|נושאי השבוע|הנושאים עדיין לא מוכנים. בחרו מהספרייה למטה.|נחשו גם את התשובות שלי
hi|इन जवाबों के साथ पूरा करें|केवल जवाब दिए गए सवालों से क्विज़ बनाएँ?|यह क्विज़ बनाएँ|दोस्त को भेजें|अभी कोई जवाब नहीं है। पहले एक दोस्त को क्विज़ का लिंक भेजें।|इस सप्ताह के विषय|विषय अभी तैयार नहीं हैं। नीचे की लाइब्रेरी से चुनें।|मेरे जवाब भी अनुमान लगाओ
bn|এই উত্তরগুলি দিয়ে শেষ করুন|শুধু উত্তর দেওয়া প্রশ্নগুলি নিয়ে কুইজ তৈরি করবেন?|এই কুইজ তৈরি করুন|বন্ধুকে পাঠান|এখনও উত্তর নেই। প্রথমে একজন বন্ধুকে কুইজের লিঙ্ক পাঠান।|এই সপ্তাহের বিষয়|বিষয়গুলি এখনও প্রস্তুত নয়। নিচের লাইব্রেরি থেকে বেছে নিন।|আমার উত্তরও অনুমান করো
id|Selesaikan dengan jawaban ini|Buat kuis hanya dari pertanyaan yang sudah dijawab?|Buat kuis ini|Kirim ke teman|Belum ada jawaban. Kirim tautan kuis ke satu teman dulu.|Tema minggu ini|Tema belum siap. Pilih dari pustaka di bawah.|Tebak jawabanku juga
ms|Selesai dengan jawapan ini|Cipta kuiz hanya daripada soalan yang telah dijawab?|Cipta kuiz ini|Hantar kepada rakan|Belum ada jawapan. Hantar pautan kuiz kepada seorang rakan dahulu.|Tema minggu ini|Tema belum tersedia. Pilih daripada pustaka di bawah.|Teka jawapan saya juga
th|จบด้วยคำตอบเหล่านี้|สร้างควิซจากคำถามที่ตอบแล้วเท่านั้นหรือไม่?|สร้างควิซนี้|ส่งให้เพื่อน|ยังไม่มีคำตอบ ส่งลิงก์ควิซให้เพื่อนหนึ่งคนก่อน|หัวข้อประจำสัปดาห์|หัวข้อยังไม่พร้อม เลือกจากคลังด้านล่าง|ลองทายคำตอบของฉันด้วย
vi|Hoàn tất với các câu trả lời này|Tạo câu đố chỉ với những câu đã trả lời?|Tạo câu đố này|Gửi cho bạn bè|Chưa có câu trả lời. Hãy gửi liên kết cho một người bạn trước.|Chủ đề tuần này|Chủ đề chưa sẵn sàng. Chọn từ thư viện bên dưới.|Đoán cả câu trả lời của tôi nhé
ko|여기까지 답한 내용으로 완료|답한 질문만으로 퀴즈를 만들까요?|이 문항 수로 만들기|친구에게 보내기|아직 답변이 없어요. 먼저 친구 한 명에게 퀴즈 링크를 보내 보세요.|이번 주 주제|주제를 준비 중이에요. 아래 라이브러리에서 선택하세요.|내 답도 맞혀 봐
zh-Hans|用已答题目完成|只用已经回答的题目创建测验吗？|按此题数完成|发给朋友|还没有回答。先把测验链接发给一位朋友吧。|本周题目|本周题目准备中，可以从下方题库选择。|也来猜猜我的答案
zh-Hant|用已答題目完成|只用已經回答的題目建立測驗嗎？|按此題數完成|傳給朋友|還沒有回答。先把測驗連結傳給一位朋友吧。|本週題目|本週題目準備中，可以從下方題庫選擇。|也來猜猜我的答案`;
export const CHALLENGE_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map((row) => {
  const [locale, ...values] = row.split('|');
  return [locale, Object.freeze(Object.fromEntries(['finish','confirm','create','send','first','weekly','empty','swap'].map((key,i) => [key, values[i]])))];
})));
export const CHALLENGE_CONVERSATION_COPY = Object.freeze({
  ja:'理由を聞いて、もっと話そう。',en:'Ask why and keep the conversation going.',
  es:'Pregunta por qué y sigue conversando.',fr:'Demande pourquoi et continue la conversation.',
  de:'Frag nach dem Warum und redet weiter.',it:'Chiedi perché e continuate a parlare.',
  pt:'Pergunta por quê e continua a conversa.',ru:'Спроси почему и продолжай разговор.',
  uk:'Запитай чому й продовжуй розмову.',pl:'Zapytaj dlaczego i rozmawiajcie dalej.',
  nl:'Vraag waarom en praat verder.',sv:'Fråga varför och fortsätt prata.',
  da:'Spørg hvorfor, og tal videre.',no:'Spør hvorfor og fortsett samtalen.',
  fi:'Kysy miksi ja jatka keskustelua.',cs:'Zeptej se proč a pokračujte v rozhovoru.',
  el:'Ρώτα γιατί και συνεχίστε τη συζήτηση.',ro:'Întreabă de ce și continuă conversația.',
  hu:'Kérdezd meg, miért, és beszélgessetek tovább.',bg:'Попитай защо и продължете разговора.',
  hr:'Pitaj zašto i nastavite razgovor.',sk:'Spýtaj sa prečo a pokračujte v rozhovore.',
  tr:'Nedenini sor ve sohbete devam et.',ar:'اسأل عن السبب وواصل الحديث.',
  he:'שאלו למה והמשיכו לדבר.',hi:'वजह पूछें और बातचीत जारी रखें।',
  bn:'কারণ জিজ্ঞেস করুন আর কথা চালিয়ে যান।',id:'Tanyakan alasannya dan lanjutkan obrolan.',
  ms:'Tanya sebabnya dan teruskan berbual.',th:'ลองถามเหตุผลแล้วคุยกันต่อ',
  vi:'Hỏi lý do và tiếp tục trò chuyện.',ko:'이유를 물어보고 대화를 이어 가요.',
  'zh-Hans':'问问原因，继续聊聊吧。','zh-Hant':'問問原因，繼續聊聊吧。',
});
export function challengeCopy(locale, key) {
  if(key==='talk') return CHALLENGE_CONVERSATION_COPY[locale] || CHALLENGE_CONVERSATION_COPY.en;
  return CHALLENGE_COPY[locale]?.[key] || CHALLENGE_COPY.en[key];
}
