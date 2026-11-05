// Local version history; separate from quiz answer/results history.
const rows = `ja|保存した過去版（最大10版）|問題文と選択肢を戻す|選択肢だけ戻す|保存した過去版はまだありません。
en|Saved versions (up to 10)|Restore question and choices|Restore choices only|No previous saved versions yet.
es|Versiones guardadas (hasta 10)|Restaurar pregunta y opciones|Restaurar solo opciones|Todavía no hay versiones anteriores.
fr|Versions enregistrées (10 maximum)|Rétablir question et choix|Rétablir les choix seuls|Aucune version précédente.
de|Gespeicherte Versionen (bis zu 10)|Frage und Antworten wiederherstellen|Nur Antworten wiederherstellen|Noch keine frühere Version.
it|Versioni salvate (fino a 10)|Ripristina domanda e opzioni|Ripristina solo le opzioni|Nessuna versione precedente.
pt|Versões guardadas (até 10)|Restaurar pergunta e opções|Restaurar só as opções|Ainda não há versões anteriores.
ru|Сохранённые версии (до 10)|Вернуть вопрос и варианты|Вернуть только варианты|Предыдущих версий пока нет.
uk|Збережені версії (до 10)|Відновити запитання й варіанти|Відновити лише варіанти|Попередніх версій ще немає.
pl|Zapisane wersje (do 10)|Przywróć pytanie i opcje|Przywróć tylko opcje|Brak wcześniejszych wersji.
nl|Opgeslagen versies (maximaal 10)|Vraag en keuzes herstellen|Alleen keuzes herstellen|Nog geen eerdere versies.
sv|Sparade versioner (högst 10)|Återställ fråga och alternativ|Återställ bara alternativ|Inga tidigare versioner ännu.
da|Gemte versioner (op til 10)|Gendan spørgsmål og valg|Gendan kun valg|Ingen tidligere versioner endnu.
no|Lagrede versjoner (opptil 10)|Gjenopprett spørsmål og valg|Gjenopprett bare valg|Ingen tidligere versjoner ennå.
fi|Tallennetut versiot (enintään 10)|Palauta kysymys ja vaihtoehdot|Palauta vain vaihtoehdot|Ei vielä aiempia versioita.
cs|Uložené verze (až 10)|Obnovit otázku i možnosti|Obnovit pouze možnosti|Zatím žádné předchozí verze.
el|Αποθηκευμένες εκδόσεις (έως 10)|Επαναφορά ερώτησης και επιλογών|Επαναφορά μόνο επιλογών|Δεν υπάρχουν προηγούμενες εκδόσεις.
ro|Versiuni salvate (până la 10)|Restabilește întrebarea și opțiunile|Restabilește doar opțiunile|Încă nu există versiuni anterioare.
hu|Mentett változatok (legfeljebb 10)|Kérdés és lehetőségek visszaállítása|Csak lehetőségek visszaállítása|Még nincs korábbi változat.
bg|Запазени версии (до 10)|Върни въпроса и вариантите|Върни само вариантите|Още няма предишни версии.
hr|Spremljene verzije (do 10)|Vrati pitanje i opcije|Vrati samo opcije|Još nema prethodnih verzija.
sk|Uložené verzie (až 10)|Obnoviť otázku aj možnosti|Obnoviť len možnosti|Zatiaľ žiadne predchádzajúce verzie.
tr|Kaydedilen sürümler (en çok 10)|Soruyu ve seçenekleri geri yükle|Yalnızca seçenekleri geri yükle|Henüz önceki sürüm yok.
ar|الإصدارات المحفوظة (حتى 10)|استعادة السؤال والخيارات|استعادة الخيارات فقط|لا توجد إصدارات سابقة بعد.
he|גרסאות שמורות (עד 10)|שחזור השאלה והאפשרויות|שחזור אפשרויות בלבד|אין עדיין גרסאות קודמות.
hi|सहेजे संस्करण (अधिकतम 10)|सवाल और विकल्प वापस लाएँ|सिर्फ विकल्प वापस लाएँ|अभी कोई पिछला संस्करण नहीं है।
bn|সংরক্ষিত সংস্করণ (সর্বোচ্চ 10)|প্রশ্ন ও বিকল্প ফেরান|শুধু বিকল্প ফেরান|এখনও আগের সংস্করণ নেই।
id|Versi tersimpan (hingga 10)|Pulihkan pertanyaan dan pilihan|Pulihkan pilihan saja|Belum ada versi sebelumnya.
ms|Versi disimpan (hingga 10)|Pulihkan soalan dan pilihan|Pulihkan pilihan sahaja|Belum ada versi terdahulu.
th|เวอร์ชันที่บันทึก (สูงสุด 10)|คืนค่าคำถามและตัวเลือก|คืนค่าเฉพาะตัวเลือก|ยังไม่มีเวอร์ชันก่อนหน้า
vi|Phiên bản đã lưu (tối đa 10)|Khôi phục câu hỏi và lựa chọn|Chỉ khôi phục lựa chọn|Chưa có phiên bản trước.
ko|저장한 이전 버전 (최대 10개)|질문과 선택지 복원|선택지만 복원|아직 이전 버전이 없습니다.
zh-Hans|保存的历史版本（最多10版）|恢复题目和选项|仅恢复选项|还没有保存的历史版本。
zh-Hant|儲存的歷史版本（最多10版）|還原題目和選項|只還原選項|還沒有儲存的歷史版本。`;
export const PERSONAL_HISTORY_COPY = Object.freeze(Object.fromEntries(rows.split('\n').map(row => {
  const [locale,title,all,choices,empty]=row.split('|');
  if(!empty)throw new Error(`Missing history copy ${locale}`);
  return [locale,Object.freeze({title,all,choices,empty})];
})));
export const personalHistoryCopy = (locale,key) => (PERSONAL_HISTORY_COPY[locale] || PERSONAL_HISTORY_COPY.en)[key];
const compact = Object.fromEntries(`ja|履歴|選択肢
en|History|Choices
es|Historial|Opciones
fr|Historique|Choix
de|Verlauf|Antworten
it|Cronologia|Opzioni
pt|Histórico|Opções
ru|История|Варианты
uk|Історія|Варіанти
pl|Historia|Opcje
nl|Geschiedenis|Keuzes
sv|Historik|Alternativ
da|Historik|Valg
no|Historikk|Valg
fi|Historia|Vaihtoehdot
cs|Historie|Možnosti
el|Ιστορικό|Επιλογές
ro|Istoric|Opțiuni
hu|Előzmények|Lehetőségek
bg|История|Варианти
hr|Povijest|Opcije
sk|História|Možnosti
tr|Geçmiş|Seçenekler
ar|السجل|الخيارات
he|היסטוריה|אפשרויות
hi|इतिहास|विकल्प
bn|ইতিহাস|বিকল্প
id|Riwayat|Pilihan
ms|Sejarah|Pilihan
th|ประวัติ|ตัวเลือก
vi|Lịch sử|Lựa chọn
ko|이력|선택지
zh-Hans|历史|选项
zh-Hant|歷史|選項`.split('\n').map(row=>{const[locale,history,choices]=row.split('|');return[locale,{history,choices}];}));
export const personalCompactCopy=(locale,key)=>(compact[locale] || compact.en)[key];
