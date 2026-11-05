// Local automatic retention; no publication or analytics operation.
const rows = `ja|編集を完了|編集を確定すると、問題文と選択肢をこのブラウザに自動保存します。最新30問を残し、超えた分は古い問題とその履歴から置き換えます。
en|Finish editing|Confirming an edit automatically saves the question and choices in this browser. The latest 30 questions are kept; older questions and their versions are replaced when the limit is exceeded.
es|Terminar edición|Al confirmar, la pregunta y sus opciones se guardan automáticamente en este navegador. Se conservan las 30 más recientes; las más antiguas y sus versiones se reemplazan al superar el límite.
fr|Terminer la modification|Confirmer une modification enregistre automatiquement la question et les choix dans ce navigateur. Les 30 questions les plus récentes sont conservées ; les plus anciennes et leurs versions sont remplacées au-delà.
de|Bearbeitung abschließen|Beim Bestätigen werden Frage und Antworten automatisch in diesem Browser gespeichert. Die letzten 30 Fragen bleiben erhalten; ältere Fragen samt Versionen werden bei Überschreitung ersetzt.
it|Termina modifica|Confermando la modifica, domanda e opzioni vengono salvate automaticamente in questo browser. Restano le 30 domande più recenti; le più vecchie e le loro versioni vengono sostituite oltre il limite.
pt|Concluir edição|Confirmar a edição guarda automaticamente a pergunta e as opções neste navegador. Ficam as 30 mais recentes; as antigas e as suas versões são substituídas quando o limite é excedido.
ru|Завершить редактирование|При подтверждении вопрос и варианты автоматически сохраняются в браузере. Хранятся последние 30 вопросов; при превышении старые вопросы и их версии заменяются.
uk|Завершити редагування|Після підтвердження запитання й варіанти автоматично зберігаються в браузері. Залишаються останні 30; старіші запитання та їхні версії замінюються понад ліміт.
pl|Zakończ edycję|Po potwierdzeniu pytanie i opcje zapisują się automatycznie w tej przeglądarce. Zostaje 30 najnowszych pytań; starsze wraz z wersjami są zastępowane po przekroczeniu limitu.
nl|Bewerken afronden|Na bevestigen worden vraag en keuzes automatisch in deze browser opgeslagen. De nieuwste 30 vragen blijven; oudere vragen en hun versies worden boven de limiet vervangen.
sv|Slutför redigering|När du bekräftar sparas frågan och alternativen automatiskt i webbläsaren. De senaste 30 frågorna behålls; äldre frågor och versioner ersätts när gränsen överskrids.
da|Afslut redigering|Når du bekræfter, gemmes spørgsmålet og valgene automatisk i browseren. De seneste 30 beholdes; ældre spørgsmål og versioner erstattes, når grænsen overskrides.
no|Fullfør redigering|Når du bekrefter, lagres spørsmål og valg automatisk i nettleseren. De siste 30 beholdes; eldre spørsmål og versjoner erstattes når grensen overskrides.
fi|Viimeistele muokkaus|Vahvistaminen tallentaa kysymyksen ja vaihtoehdot automaattisesti selaimeen. Uusimmat 30 säilyvät; vanhemmat kysymykset ja versiot korvataan rajan ylittyessä.
cs|Dokončit úpravu|Potvrzení automaticky uloží otázku a možnosti v tomto prohlížeči. Zůstane posledních 30 otázek; starší otázky a verze se po překročení limitu nahrazují.
el|Ολοκλήρωση επεξεργασίας|Η επιβεβαίωση αποθηκεύει αυτόματα την ερώτηση και τις επιλογές στον περιηγητή. Διατηρούνται οι 30 πιο πρόσφατες· οι παλαιότερες και οι εκδόσεις τους αντικαθίστανται πάνω από το όριο.
ro|Termină editarea|Confirmarea salvează automat întrebarea și opțiunile în browser. Rămân cele mai recente 30; întrebările vechi și versiunile lor sunt înlocuite peste limită.
hu|Szerkesztés befejezése|Jóváhagyáskor a kérdés és a lehetőségek automatikusan mentődnek a böngészőben. A legutóbbi 30 marad meg; a régebbiek és változataik a korlát fölött lecserélődnek.
bg|Завърши редакцията|Потвърждението автоматично запазва въпроса и вариантите в браузъра. Пазят се последните 30; по-старите въпроси и версии се заменят над лимита.
hr|Završi uređivanje|Potvrdom se pitanje i opcije automatski spremaju u preglednik. Čuva se najnovijih 30; starija pitanja i verzije zamjenjuju se iznad ograničenja.
sk|Dokončiť úpravu|Potvrdenie automaticky uloží otázku a možnosti v prehliadači. Zostane posledných 30; staršie otázky a verzie sa nad limit nahradia.
tr|Düzenlemeyi bitir|Onayladığınızda soru ve seçenekler tarayıcıya otomatik kaydedilir. En son 30 soru tutulur; sınır aşılınca eskiler ve sürümleri değiştirilir.
ar|إنهاء التعديل|يؤدي تأكيد التعديل إلى حفظ السؤال والخيارات تلقائيًا في المتصفح. يُحتفظ بأحدث 30 سؤالًا؛ وتُستبدل الأسئلة الأقدم وإصداراتها عند تجاوز الحد.
he|סיום עריכה|אישור העריכה שומר אוטומטית את השאלה והאפשרויות בדפדפן. 30 השאלות האחרונות נשמרות; ישנות וגרסאותיהן מוחלפות מעבר למגבלה.
hi|संपादन पूरा करें|पुष्टि करने पर सवाल और विकल्प इस ब्राउज़र में अपने आप सहेजे जाते हैं। नवीनतम 30 सवाल रहते हैं; सीमा पार होने पर पुराने सवाल और उनके संस्करण बदल दिए जाते हैं।
bn|সম্পাদনা শেষ|নিশ্চিত করলে প্রশ্ন ও বিকল্প এই ব্রাউজারে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়। সর্বশেষ 30টি থাকে; সীমা ছাড়ালে পুরোনো প্রশ্ন ও সংস্করণ বদলে যায়।
id|Selesai mengedit|Mengonfirmasi edit otomatis menyimpan pertanyaan dan pilihan di browser ini. Sebanyak 30 pertanyaan terbaru disimpan; yang lama beserta versinya diganti saat batas terlampaui.
ms|Selesai menyunting|Pengesahan menyimpan soalan dan pilihan secara automatik dalam pelayar. 30 soalan terkini dikekalkan; yang lama dan versinya diganti apabila had dilepasi.
th|แก้ไขเสร็จ|เมื่อยืนยัน ระบบจะบันทึกคำถามและตัวเลือกในเบราว์เซอร์นี้อัตโนมัติ เก็บ 30 คำถามล่าสุด หากเกินขีดจำกัดจะนำคำถามเก่าและประวัติออกเพื่อแทนที่
vi|Hoàn tất chỉnh sửa|Xác nhận sẽ tự động lưu câu hỏi và lựa chọn trong trình duyệt. Giữ 30 câu mới nhất; câu cũ và các phiên bản bị thay thế khi vượt giới hạn.
ko|편집 완료|편집을 확정하면 질문과 선택지가 이 브라우저에 자동 저장됩니다. 최근 30문제를 보관하며, 초과하면 오래된 문제와 그 이력이 교체됩니다.
zh-Hans|完成编辑|确认编辑后，题目和选项会自动保存在此浏览器。保留最新30题，超过时替换较旧的题目及其历史版本。
zh-Hant|完成編輯|確認編輯後，題目與選項會自動儲存在此瀏覽器。保留最新30題，超過時替換較舊的題目及其歷史版本。`;
export const PERSONAL_AUTOSAVE_COPY=Object.freeze(Object.fromEntries(rows.split('\n').map(row=>{const[locale,done,notice]=row.split('|');if(!notice)throw Error('Missing autosave copy '+locale);return[locale,{done,notice}];})));
export const personalAutosaveCopy=(locale,key)=>(PERSONAL_AUTOSAVE_COPY[locale]||PERSONAL_AUTOSAVE_COPY.en)[key];
