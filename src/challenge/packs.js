const PACKS = Object.freeze([
  {
    slug: 'easy-first-meeting',
    title: { ja: '初対面でも答えやすい10問', en: '10 easy questions for new friends' },
    description: {
      ja: '回答に迷いにくく、相手をあまり知らなくても予想できます。',
      en: 'Simple choices that are easy to predict even when you have just met.',
    },
    image: '/assets/question-packs/easy-first-meeting.svg',
    featured: true,
    ids: {
      ja: [
        'Q001', 'Q215', 'HLD087', 'HLD002', 'Q428',
        'HLD086', 'Q427', 'HLD176', 'HLD046', 'HLD198',
        'Q007', 'Q045', 'Q424', 'Q426', 'Q440',
        'Q418', 'Q423', 'Q509', 'Q091', 'Q013',
      ],
      en: ['ENF001', 'ENF025', 'ENF011', 'ENF014', 'ENF021', 'ENFA002', 'ENFA003', 'ENQ418', 'ENQ426', 'ENQ440'],
    },
  },
  {
    slug: 'school-after-school',
    title: { ja: '学校・放課後の10問', en: '10 school and after-school questions' },
    description: {
      ja: '授業や放課後の過ごし方を予想して、学校の思い出を話せます。',
      en: 'School life, after-school moments, and everyday student choices.',
    },
    image: '/assets/question-packs/live-party.svg',
    featured: true,
    ids: {
      ja: [
        'HLD032', 'Q209', 'HLD028', 'HLD200', 'HLD119',
        'Q214', 'HLD214', 'HLD213', 'HLD228', 'HLD496',
        'Q215', 'Q202', 'Q106', 'Q111', 'Q119', 'Q267', 'Q256', 'Q057',
      ],
      en: ['ENF008', 'ENF009', 'ENF040', 'ENQ214', 'ENQ202', 'ENQ267', 'ENQ111', 'ENQ276', 'ENQ545', 'ENQ018'],
    },
  },
  {
    slug: 'food-preferences',
    title: { ja: '食べものの好み10問', en: '10 questions about food preferences' },
    description: {
      ja: '答えやすく、答え合わせ後の会話が発生しやすいパックです。',
      en: 'Easy food choices that naturally lead to conversation after the answers are revealed.',
    },
    image: '/assets/question-packs/summer-vacation.svg',
    featured: true,
    ids: {
      ja: [
        'Q401', 'Q414', 'HLD014', 'Q007', 'HLD079',
        'HLD181', 'Q018', 'Q507', 'HLD199', 'HLD184',
        'Q001', 'Q013', 'Q012', 'Q003', 'Q002',
      ],
      en: ['ENF002', 'ENF003', 'ENF004', 'ENF005', 'ENF006', 'ENF007', 'ENQ401', 'ENQ414', 'ENQ425', 'ENQ507'],
    },
  },
  {
    slug: 'my-manual',
    title: { ja: 'わたしのトリセツ10問', en: '10 questions for my personal manual' },
    description: {
      ja: '元気が出ることや助けてほしいときを予想して、自分との付き合い方を伝えられます。',
      en: 'A personal guide to my energy, habits, support needs, and communication style.',
    },
    image: '/assets/question-packs/know-me-deeper.svg',
    featured: true,
    ids: {
      ja: [
        'HLD101', 'HLD292', 'HLD353', 'HLD133', 'HLD008',
        'Q302', 'HLD060', 'HLD158', 'HLD162', 'HLD297',
        'Q141', 'Q144', 'Q108', 'Q130', 'Q191', 'Q228', 'Q159', 'Q153', 'Q303',
      ],
      en: ['ENF010', 'ENF031', 'ENF039', 'ENFA012', 'ENFA013', 'ENF024', 'ENQ302', 'ENQ402', 'ENQ436', 'ENQ442'],
    },
  },
  {
    slug: 'unexpected-side',
    title: { ja: '意外な一面が分かる10問', en: '10 questions that reveal a surprising side' },
    description: {
      ja: 'いつもと違う選択や意外な好みを予想して、第一印象との違いを話せます。',
      en: 'Reveal personality, quirks, and choices that may not match a first impression.',
    },
    image: '/assets/question-packs/unexpected-side.svg',
    featured: true,
    ids: {
      ja: [
        'Q307', 'HLD134', 'Q305', 'Q547', 'HLD071',
        'HLD381', 'HLD382', 'HLD384', 'HLD385', 'HLD388',
        'Q421', 'Q441', 'Q433', 'Q293', 'Q159', 'Q289', 'Q298',
      ],
      en: ['ENF037', 'ENF038', 'ENF035', 'ENF036', 'ENQ441', 'ENQ179', 'ENQ432', 'ENQ433', 'ENQ434', 'ENQ417'],
    },
  },
  {
    slug: 'holiday-outings',
    title: { ja: '休日とおでかけの10問', en: '10 questions about days off and outings' },
    description: {
      ja: '一緒に遊ぶ計画や、次の会話につながりやすい構成です。',
      en: 'Questions that make it easy to plan an outing or start the next conversation.',
    },
    image: '/assets/question-packs/oshi-life.svg',
    featured: false,
    ids: {
      ja: [
        'HLD055', 'HLD006', 'HLD145', 'HLD146', 'HLD188',
        'HLD189', 'Q519', 'HLD111', 'HLD149', 'HLD113',
        'Q022', 'Q034', 'Q039', 'Q012', 'Q420', 'Q524', 'Q525', 'Q418', 'Q423',
      ],
      en: ['ENF016', 'ENF017', 'ENF018', 'ENF019', 'ENF020', 'ENFA009', 'ENFA010', 'ENQ429', 'ENQ522', 'ENQ306'],
    },
  },
  {
    slug: 'smartphone-social-fandom',
    title: { ja: 'スマホ・SNS・推しの10問', en: '10 questions about phones, social media, and fandoms' },
    description: {
      ja: 'よく開くアプリや推しの楽しみ方を予想して、普段は話さない好みを知れます。',
      en: 'Everyday phone, social, video, and fandom choices that are easy to share.',
    },
    image: '/assets/question-packs/fandom-social.svg',
    featured: false,
    ids: {
      ja: [
        'Q416', 'Q045', 'Q067', 'Q079', 'HLD253',
        'HLD255', 'HLD127', 'HLD132', 'HLD442', 'HLD141',
        'Q549', 'Q099', 'Q091', 'Q150', 'Q137', 'Q208',
      ],
      en: ['ENF015', 'ENF027', 'ENF028', 'ENQ416', 'ENQ549', 'ENQ431', 'ENQ301', 'ENQ544', 'ENQ523', 'ENQ137'],
    },
  },
  {
    slug: 'values-future',
    title: { ja: '価値観と未来の10問', en: '10 questions about values and the future' },
    description: {
      ja: '少し深く理解したい利用者向けです。初回より2回目以降に適しています。',
      en: 'A deeper pack about priorities, decisions, skills, and the future.',
    },
    image: '/assets/question-packs/live-small-stream.svg',
    featured: false,
    ids: {
      ja: [
        'Q150', 'HLD057', 'HLD168', 'HLD056', 'HLD341',
        'HLD063', 'HLD152', 'HLD336', 'HLD174', 'Q435',
        'Q141', 'Q144', 'Q159', 'Q130', 'Q153', 'Q302', 'Q303', 'Q439',
      ],
      en: ['ENF012', 'ENF029', 'ENF030', 'ENF032', 'ENF033', 'ENF034', 'ENF023', 'ENQ435', 'ENQ308', 'ENQ439'],
    },
  },
  {
    slug: 'memories-past',
    title: { ja: '思い出と昔の自分10問', en: '10 questions about memories and my younger self' },
    description: {
      ja: '正解・不正解に関係なく、その後にエピソードを話しやすいパックです。',
      en: 'Memory prompts that naturally lead to stories after the answers are revealed.',
    },
    image: '/assets/question-packs/live-streamer-surprises.svg',
    featured: false,
    ids: {
      ja: [
        'HLD120', 'HLD026', 'HLD117', 'HLD118', 'Q208',
        'HLD277', 'HLD124', 'HLD271', 'HLD275', 'HLD397',
        'Q206', 'Q202', 'Q209', 'Q215', 'Q219', 'Q214', 'Q137', 'Q099', 'Q013',
      ],
      en: ['ENF026', 'ENFA006', 'ENFA007', 'ENQ206', 'ENQ219', 'ENQ430', 'ENQ419', 'ENQ423', 'ENQ543', 'ENQ516'],
    },
  },
]);

function localizePacks(packs, isEnglish = false) {
  const language = isEnglish ? 'en' : 'ja';
  return packs.map((pack) => ({
    slug: pack.slug,
    title: pack.title[language],
    description: pack.description[language],
    image: pack.image,
    featured: pack.featured === true,
    questionIds: pack.ids[language].slice(),
  }));
}

export function questionPacks(isEnglish = false) {
  return localizePacks(PACKS, isEnglish);
}

// A deterministic Monday-to-Sunday rotation in JST, using only approved packs.
// This is editorial selection, not a popularity or usage claim.
export function weeklyQuestionPacks(isEnglish = false, now = Date.now()) {
  const dayMs = 86400000;
  const shifted = new Date(Number(now) + 9 * 3600000);
  if (!Number.isFinite(shifted.getTime())) throw new RangeError('Invalid weekly date');
  const day = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const monday = day - ((shifted.getUTCDay() + 6) % 7) * dayMs;
  const week = Math.floor((monday - Date.UTC(2026, 0, 5)) / (7 * dayMs));
  const packs = questionPacks(isEnglish);
  const start = ((week * 3) % packs.length + packs.length) % packs.length;
  return { weekStart: new Date(monday).toISOString().slice(0, 10),
    packs: Array.from({ length: Math.min(3, packs.length) }, (_, index) => packs[(start + index) % packs.length]) };
}

export function questionPackBySlug(slug, isEnglish = false) {
  return questionPacks(isEnglish).find((pack) => pack.slug === String(slug || '')) || null;
}

export function questionPackCards(cards, slug, isEnglish = false, count = 10) {
  const pack = questionPackBySlug(slug, isEnglish);
  if (!pack) return [];
  const byId = new Map((cards || []).map((card) => [String(card.id), card]));
  return pack.questionIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .slice(0, count);
}
