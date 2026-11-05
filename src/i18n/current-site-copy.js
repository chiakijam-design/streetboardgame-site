import { personalQuestionCopy } from './personal-question-copy.js';
import { personalAutosaveCopy } from './personal-question-autosave-copy.js';
import { boardCopy, BOARD_COPY } from './challenge-board-copy.js';
import { FREE_QUIZ_COPY } from './commerce-copy.js';

// Reuse the already translated facts; do not alter historical catalog entries.
export function translateCurrentSiteCopy(value, locale, translate) {
  const text = value.trim();
  if(text===FREE_QUIZ_COPY.ja)return FREE_QUIZ_COPY[locale];
  const guide='みんなに挑戦してもらう｜1〜10問クイズの遊び方・作り方';
  if(text===guide+'。'+BOARD_COPY.ja.notice)return translate(guide.replace('1〜10問','10問')).replace(/10/g,'1–10')+'. '+boardCopy(locale,'notice');
  if (text.includes('1〜10問')) {
    const old=text.replaceAll('1〜10問','10問');
    const translated=translate(old);
    if(translated!==old)return translated.replace(/10/g,'1–10');
  }
  if (text.includes('過去の取引と既存データ')) {
    if(text==='過去の取引と既存データ｜収益分配規約')return translate('過去のLIVE取引と既存データ').replace(/LIVE\s*/g,'')+'｜'+translate('収益分配規約');
    return translate(text.replace('過去の取引と既存データ','過去のLIVE取引と既存データ')).replace(/LIVE\s*/g,'');
  }
  if (text === '収益分配規約' || text === '収益分配規約｜Streetboardgame') {
    return translate('収益分配規約') + (text.includes('｜') ? '｜Streetboardgame' : '');
  }
  for (const key of ['title','privacy','server']) {
    if (text === personalQuestionCopy('ja',key)) return personalQuestionCopy(locale,key);
  }
  if (text === personalAutosaveCopy('ja','notice')) return personalAutosaveCopy(locale,'notice');
}
