// Fixed unavailable-page headings; no user data. Translations await native review.
const rows=`ja|このページはありません
en|This page is no longer available
es|Esta página ya no está disponible
fr|Cette page n’est plus disponible
de|Diese Seite ist nicht mehr verfügbar
it|Questa pagina non è più disponibile
pt|Esta página já não está disponível
ru|Эта страница больше недоступна
uk|Ця сторінка більше недоступна
pl|Ta strona nie jest już dostępna
nl|Deze pagina is niet meer beschikbaar
sv|Den här sidan är inte längre tillgänglig
da|Denne side er ikke længere tilgængelig
no|Denne siden er ikke lenger tilgjengelig
fi|Tämä sivu ei ole enää saatavilla
el|Αυτή η σελίδα δεν είναι πλέον διαθέσιμη
cs|Tato stránka již není dostupná
ro|Această pagină nu mai este disponibilă
hu|Ez az oldal már nem érhető el
bg|Тази страница вече не е достъпна
hr|Ova stranica više nije dostupna
sk|Táto stránka už nie je dostupná
tr|Bu sayfa artık kullanılamıyor
ar|هذه الصفحة لم تعد متاحة
he|הדף הזה אינו זמין עוד
hi|यह पेज अब उपलब्ध नहीं है
bn|এই পৃষ্ঠাটি আর উপলব্ধ নেই
id|Halaman ini tidak lagi tersedia
ms|Halaman ini tidak lagi tersedia
th|หน้านี้ไม่พร้อมใช้งานแล้ว
vi|Trang này không còn khả dụng
ko|이 페이지는 더 이상 이용할 수 없습니다
zh-Hans|此页面已不可用
zh-Hant|此頁面已無法使用`;
export const REMOVED_PAGE_COPY=Object.freeze(Object.fromEntries(rows.split('\n').map(row=>row.split('|'))));
export const removedPageHeading=locale=>REMOVED_PAGE_COPY[locale]||REMOVED_PAGE_COPY.en;
