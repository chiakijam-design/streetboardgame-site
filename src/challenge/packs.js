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
      en: ['ENF001', 'ENF008', 'ENF025', 'ENF005', 'ENF015', 'ENF020', 'ENF014', 'ENF026', 'ENF027', 'ENF010'],
    },
  },
  {
    slug: 'school-after-school',
    title: { ja: '学校・放課後の10問', en: '10 school and after-school questions' },
    description: {
      ja: '13〜18歳のメインターゲットに最も直接的に合います。',
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
      en: ['ENF008', 'ENF040', 'ENF009', 'ENF010', 'ENF011', 'ENF018', 'ENF026', 'ENF017', 'ENF029', 'ENF030'],
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
      en: ['ENF001', 'ENF002', 'ENF003', 'ENF004', 'ENF005', 'ENF006', 'ENF007', 'ENF013', 'ENF014', 'ENF032'],
    },
  },
  {
    slug: 'my-manual',
    title: { ja: 'わたしのトリセツ10問', en: '10 questions for my personal manual' },
    description: {
      ja: 'サイトの「理解度診断」という位置づけに最も合う主力候補です。',
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
      en: ['ENF029', 'ENF030', 'ENF031', 'ENF039', 'ENF010', 'ENF012', 'ENF023', 'ENF024', 'ENF011', 'ENF021'],
    },
  },
  {
    slug: 'unexpected-side',
    title: { ja: '意外な一面が分かる10問', en: '10 questions that reveal a surprising side' },
    description: {
      ja: '結果画面の答え合わせレポートと特に相性がよい構成です。',
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
      en: ['ENF037', 'ENF038', 'ENF039', 'ENF029', 'ENF031', 'ENF035', 'ENF036', 'ENF026', 'ENF034', 'ENF017'],
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
      en: ['ENF015', 'ENF016', 'ENF017', 'ENF018', 'ENF019', 'ENF020', 'ENF025', 'ENF004', 'ENF034', 'ENF036'],
    },
  },
  {
    slug: 'smartphone-social-fandom',
    title: { ja: 'スマホ・SNS・推しの10問', en: '10 questions about phones, social media, and fandoms' },
    description: {
      ja: '中高生の日常に近く、共有時の訴求にも使いやすいパックです。',
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
      en: ['ENF015', 'ENF027', 'ENF028', 'ENF014', 'ENF025', 'ENF026', 'ENF013', 'ENF017', 'ENF020', 'ENF001'],
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
      en: ['ENF012', 'ENF013', 'ENF029', 'ENF030', 'ENF031', 'ENF032', 'ENF033', 'ENF034', 'ENF023', 'ENF010'],
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
      en: ['ENF026', 'ENF040', 'ENF014', 'ENF005', 'ENF004', 'ENF008', 'ENF017', 'ENF018', 'ENF027', 'ENF029'],
    },
  },
]);

const LIVE_PACKS = Object.freeze([
  {
    slug: 'live-comment-split',
    title: { ja: 'LIVEで答えが割れる10問', en: '10 live questions that split the answers' },
    description: {
      ja: '選択人数を表示した時に、回答の偏りや分散を楽しみやすい構成です。',
      en: 'Five-way choices designed to make divided answers and live reactions fun.',
    },
    image: '/assets/question-packs/live-comment-split.svg',
    featured: true,
    ids: {
      ja: [
        'Q406', 'Q410', 'Q412', 'HLD144', 'Q434',
        'HLD143', 'HLD313', 'HLD315', 'Q433', 'Q438',
        'Q401', 'Q407', 'Q414', 'Q425', 'Q427',
      ],
      en: ['ENF035', 'ENF033', 'ENF034', 'ENF036', 'ENF037', 'ENF038', 'ENF039', 'ENF016', 'ENF019', 'ENF032'],
    },
  },
  {
    slug: 'live-first-viewers',
    title: { ja: 'LIVE初見でも即答できる10問', en: '10 instant-answer questions for first-time viewers' },
    description: {
      ja: '配信者を詳しく知らない初見視聴者も参加しやすいパックです。',
      en: 'Quick, visual choices that brand-new viewers can answer immediately.',
    },
    image: '/assets/question-packs/live-first-viewers.svg',
    featured: false,
    ids: {
      ja: [
        'HLD096', 'Q423', 'Q407', 'Q422', 'Q418',
        'HLD085', 'Q293', 'Q432', 'HLD159', 'Q442',
        'Q001', 'Q007', 'Q424', 'Q426', 'Q440',
      ],
      en: ['ENF001', 'ENF005', 'ENF006', 'ENF008', 'ENF015', 'ENF016', 'ENF025', 'ENF031', 'ENF038', 'ENF010'],
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

export function liveExclusiveQuestionPacks(isEnglish = false) {
  return localizePacks(LIVE_PACKS, isEnglish);
}

export function questionPackBySlug(slug, isEnglish = false) {
  return questionPacks(isEnglish).find((pack) => pack.slug === String(slug || '')) || null;
}

export function liveQuestionPackBySlug(slug, isEnglish = false) {
  return [...questionPacks(isEnglish), ...liveExclusiveQuestionPacks(isEnglish)]
    .find((pack) => pack.slug === String(slug || '')) || null;
}

export function questionPackCards(cards, slug, isEnglish = false, count = 10, options = {}) {
  const pack = options.includeLive
    ? liveQuestionPackBySlug(slug, isEnglish)
    : questionPackBySlug(slug, isEnglish);
  if (!pack) return [];
  const byId = new Map((cards || []).map((card) => [String(card.id), card]));
  return pack.questionIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .slice(0, count);
}
