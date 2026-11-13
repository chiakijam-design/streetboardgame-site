// Perfect-score celebration for the friend quiz result: a gold card title
// ("<creator>王"), confetti, a short synthesized fanfare and a share prompt.
// Everything runs on the device; nothing is sent to a server.

const PERFECT_TITLE_TEMPLATES = Object.freeze({
  ja: '{name}王',
  en: 'King of {name}',
  ar: 'ملك {name}',
  bg: 'Цар на {name}',
  bn: '{name}-এর রাজা',
  cs: 'Král {name}',
  da: 'Konge af {name}',
  de: 'König von {name}',
  el: 'Βασιλιάς του {name}',
  es: 'Rey de {name}',
  fi: '{name}-kuningas',
  fr: 'Roi de {name}',
  he: 'המלך של {name}',
  hi: '{name} का राजा',
  hr: 'Kralj {name}',
  hu: '{name} királya',
  id: 'Raja {name}',
  it: 'Re di {name}',
  ko: '{name} 왕',
  ms: 'Raja {name}',
  nl: 'Koning van {name}',
  no: 'Konge av {name}',
  pl: 'Król {name}',
  pt: 'Rei de {name}',
  ro: 'Regele lui {name}',
  ru: 'Король {name}',
  sk: 'Kráľ {name}',
  sv: 'Kung av {name}',
  th: 'ราชาแห่ง {name}',
  tr: '{name} Kralı',
  uk: 'Король {name}',
  vi: 'Vua của {name}',
  'zh-Hans': '{name}之王',
  'zh-Hant': '{name}之王',
});

// Popup shown a few seconds after a perfect score: [heading, lead, share, close].
const PERFECT_POPUP_COPY = Object.freeze({
  ja: ['満点でした！', 'この結果をみんなに伝えましょう', '結果を共有', '閉じる'],
  en: ['Perfect score!', 'Tell everyone about this result', 'Share result', 'Close'],
  ar: ['علامة كاملة!', 'شارك هذه النتيجة مع الجميع', 'مشاركة النتيجة', 'إغلاق'],
  bg: ['Пълен резултат!', 'Сподели този резултат с всички', 'Сподели резултата', 'Затвори'],
  bn: ['পূর্ণ নম্বর!', 'এই ফলাফল সবাইকে জানাও', 'ফলাফল শেয়ার করুন', 'বন্ধ করুন'],
  cs: ['Plný počet bodů!', 'Pochlub se tímto výsledkem všem', 'Sdílet výsledek', 'Zavřít'],
  da: ['Fuld pott!', 'Fortæl alle om dette resultat', 'Del resultatet', 'Luk'],
  de: ['Volle Punktzahl!', 'Teile dieses Ergebnis mit allen', 'Ergebnis teilen', 'Schließen'],
  el: ['Τέλεια βαθμολογία!', 'Πες σε όλους αυτό το αποτέλεσμα', 'Κοινοποίηση αποτελέσματος', 'Κλείσιμο'],
  es: ['¡Puntuación perfecta!', 'Cuéntale a todos este resultado', 'Compartir resultado', 'Cerrar'],
  fi: ['Täydet pisteet!', 'Kerro tästä tuloksesta kaikille', 'Jaa tulos', 'Sulje'],
  fr: ['Score parfait !', 'Partagez ce résultat avec tout le monde', 'Partager le résultat', 'Fermer'],
  he: ['ציון מושלם!', 'ספרו לכולם על התוצאה הזו', 'שיתוף התוצאה', 'סגירה'],
  hi: ['पूरे अंक!', 'यह नतीजा सबको बताइए', 'नतीजा साझा करें', 'बंद करें'],
  hr: ['Svi bodovi!', 'Podijeli ovaj rezultat sa svima', 'Podijeli rezultat', 'Zatvori'],
  hu: ['Hibátlan eredmény!', 'Oszd meg ezt az eredményt mindenkivel', 'Eredmény megosztása', 'Bezárás'],
  id: ['Nilai sempurna!', 'Ceritakan hasil ini ke semua orang', 'Bagikan hasil', 'Tutup'],
  it: ['Punteggio perfetto!', 'Fai sapere a tutti questo risultato', 'Condividi il risultato', 'Chiudi'],
  ko: ['만점이에요!', '이 결과를 모두에게 알려 보세요', '결과 공유', '닫기'],
  ms: ['Markah penuh!', 'Kongsi keputusan ini dengan semua orang', 'Kongsi keputusan', 'Tutup'],
  nl: ['Perfecte score!', 'Vertel iedereen over dit resultaat', 'Resultaat delen', 'Sluiten'],
  no: ['Full pott!', 'Fortell alle om dette resultatet', 'Del resultatet', 'Lukk'],
  pl: ['Komplet punktów!', 'Pochwal się tym wynikiem wszystkim', 'Udostępnij wynik', 'Zamknij'],
  pt: ['Pontuação perfeita!', 'Conte para todo mundo esse resultado', 'Compartilhar resultado', 'Fechar'],
  ro: ['Punctaj maxim!', 'Spune-le tuturor despre acest rezultat', 'Distribuie rezultatul', 'Închide'],
  ru: ['Идеальный результат!', 'Расскажите всем об этом результате', 'Поделиться результатом', 'Закрыть'],
  sk: ['Plný počet bodov!', 'Pochváľ sa týmto výsledkom všetkým', 'Zdieľať výsledok', 'Zavrieť'],
  sv: ['Full pott!', 'Berätta för alla om det här resultatet', 'Dela resultatet', 'Stäng'],
  th: ['ได้คะแนนเต็ม!', 'บอกผลนี้ให้ทุกคนรู้', 'แชร์ผลลัพธ์', 'ปิด'],
  tr: ['Tam puan!', 'Bu sonucu herkese anlat', 'Sonucu paylaş', 'Kapat'],
  uk: ['Ідеальний результат!', 'Розкажіть усім про цей результат', 'Поділитися результатом', 'Закрити'],
  vi: ['Điểm tuyệt đối!', 'Hãy kể cho mọi người về kết quả này', 'Chia sẻ kết quả', 'Đóng'],
  'zh-Hans': ['满分！', '把这个结果告诉大家吧', '分享结果', '关闭'],
  'zh-Hant': ['滿分！', '把這個結果告訴大家吧', '分享結果', '關閉'],
});

export const PERFECT_LOCALES = Object.freeze(Object.keys(PERFECT_TITLE_TEMPLATES));

export function perfectPopupCopy(locale = 'ja') {
  const [heading, lead, share, close] = PERFECT_POPUP_COPY[locale] || PERFECT_POPUP_COPY.en;
  return { heading, lead, share, close };
}

// A small non-blocking sheet (no full-screen backdrop) so the result page stays
// usable. `onShare` runs inside the click so the OS share sheet keeps the
// user activation it needs.
export function showPerfectSharePopup(doc = globalThis.document, { locale = 'ja', dir = 'ltr', onShare = () => {}, onClose = () => {} } = {}) {
  if (!doc?.body) return () => {};
  doc.querySelector('[data-testid="challenge-perfect-popup"]')?.remove();
  const copy = perfectPopupCopy(locale);
  const popup = doc.createElement('section');
  popup.className = 'challenge-perfect-popup';
  popup.dataset.testid = 'challenge-perfect-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'false');
  popup.setAttribute('aria-labelledby', 'challenge-perfect-popup-title');
  popup.setAttribute('dir', dir);
  const heading = doc.createElement('h2');
  heading.id = 'challenge-perfect-popup-title';
  heading.textContent = `👑 ${copy.heading}`;
  const lead = doc.createElement('p');
  lead.textContent = copy.lead;
  const share = doc.createElement('button');
  share.type = 'button';
  share.className = 'challenge-primary';
  share.dataset.action = 'perfect-share';
  share.textContent = copy.share;
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'challenge-perfect-popup-close';
  close.dataset.action = 'perfect-close';
  close.textContent = copy.close;
  popup.append(heading, lead, share, close);
  let closed = false;
  const onKey = (event) => { if (event.key === 'Escape') closePopup(); };
  function closePopup() {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', onKey);
    popup.remove();
    onClose();
  }
  share.addEventListener('click', async () => {
    share.disabled = true;
    try { await onShare(); } finally { closePopup(); }
  });
  close.addEventListener('click', closePopup);
  doc.addEventListener('keydown', onKey);
  doc.body.appendChild(popup);
  share.focus?.({ preventScroll: true });
  return closePopup;
}

export function isPerfectResult(result) {
  const total = Array.isArray(result?.answers) ? result.answers.length : 0;
  return total > 0 && Number(result?.score) === total;
}

export function perfectTitle(creatorName, locale = 'ja') {
  const name = String(creatorName || '').replace(/\s+/g, ' ').trim().slice(0, 24) || (locale === 'ja' ? '出題者' : 'Creator');
  const template = PERFECT_TITLE_TEMPLATES[locale] || PERFECT_TITLE_TEMPLATES.en;
  return template.replace('{name}', name);
}

export function prefersReducedMotion() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// Gold confetti over the whole screen for about 4 seconds. Never blocks input.
export function launchConfetti(doc = globalThis.document, { durationMs = 4200, count = 160 } = {}) {
  if (!doc?.body || prefersReducedMotion()) return () => {};
  const canvas = doc.createElement('canvas');
  canvas.className = 'challenge-confetti';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.testid = 'challenge-confetti';
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60' });
  doc.body.appendChild(canvas);
  const win = doc.defaultView || globalThis;
  const ratio = Math.min(2, win.devicePixelRatio || 1);
  const resize = () => { canvas.width = win.innerWidth * ratio; canvas.height = win.innerHeight * ratio; };
  resize();
  const ctx = canvas.getContext?.('2d');
  if (!ctx) { canvas.remove(); return () => {}; }
  const colors = ['#ffd84d', '#f7b500', '#fff3a8', '#ec4683', '#55c9dd', '#ffffff'];
  const pieces = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.6,
    w: (6 + Math.random() * 8) * ratio,
    h: (8 + Math.random() * 10) * ratio,
    vy: (2 + Math.random() * 3.5) * ratio,
    vx: (Math.random() - 0.5) * 2.2 * ratio,
    spin: Math.random() * Math.PI,
    vs: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = Date.now();
  let frame = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame) win.cancelAnimationFrame?.(frame);
    win.removeEventListener?.('resize', resize);
    canvas.remove();
  };
  const draw = () => {
    const elapsed = Date.now() - start;
    if (elapsed > durationMs) { stop(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = elapsed > durationMs - 800 ? (durationMs - elapsed) / 800 : 1;
    ctx.globalAlpha = Math.max(0, fade);
    for (const piece of pieces) {
      piece.x += piece.vx; piece.y += piece.vy; piece.spin += piece.vs;
      if (piece.y > canvas.height + 20) piece.y = -20;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.spin);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, Math.abs(Math.cos(piece.spin)) * piece.h + 1);
      ctx.restore();
    }
    frame = win.requestAnimationFrame?.(draw) || 0;
  };
  win.addEventListener?.('resize', resize);
  frame = win.requestAnimationFrame?.(draw) || 0;
  return stop;
}

// A short brass-like fanfare synthesized with Web Audio (no audio file).
// Browsers may block sound until the page has been touched; that is fine.
export function playFanfare(win = globalThis) {
  const AudioContextClass = win.AudioContext || win.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    const audio = new AudioContextClass();
    const master = audio.createGain();
    master.gain.value = 0.18;
    master.connect(audio.destination);
    const notes = [
      [523.25, 0.00, 0.14], [523.25, 0.16, 0.14], [523.25, 0.32, 0.14],
      [659.25, 0.48, 0.30], [587.33, 0.80, 0.16], [659.25, 0.98, 0.16], [783.99, 1.16, 0.70],
    ];
    const now = audio.currentTime + 0.05;
    for (const [frequency, at, length] of notes) {
      for (const [type, detune, level] of [['sawtooth', 0, 0.5], ['triangle', 7, 0.6]]) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0, now + at);
        gain.gain.linearRampToValueAtTime(level, now + at + 0.02);
        gain.gain.setValueAtTime(level, now + at + length * 0.7);
        gain.gain.linearRampToValueAtTime(0, now + at + length);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + at);
        osc.stop(now + at + length + 0.05);
      }
    }
    audio.resume?.().catch(() => {});
    win.setTimeout?.(() => audio.close?.().catch(() => {}), 3000);
    return true;
  } catch {
    return false;
  }
}
