const PACKS = Object.freeze([
  {
    slug: 'unexpected-side',
    title: { ja: '意外な一面が分かる10問', en: '10 questions that reveal a surprising side' },
    description: {
      ja: '第一印象だけでは分からない、得意・過去・一人時間の自分。',
      en: 'Personality, quirks, and choices people may not expect.',
    },
    image: '/assets/question-packs/unexpected-side.svg',
    ids: {
      ja: [
        'Q307', 'HLD134', 'HLD070', 'HLD071', 'HLD072',
        'HLD075', 'HLD123', 'HLD129', 'HLD141', 'HLD112',
        'HLD117', 'HLD118', 'HLD124', 'HLD125', 'HLD130',
        'Q298', 'Q289', 'Q433', 'Q421', 'Q441',
        'Q547', 'Q159', 'Q293', 'Q141',
      ],
      en: ['ENF031', 'ENF039', 'ENF037', 'ENF038', 'ENF035', 'ENF036', 'ENF029', 'ENF030', 'ENF034', 'ENF032'],
    },
  },
  {
    slug: 'easy-first-meeting',
    title: { ja: '初対面でも答えやすい10問', en: '10 easy questions for new friends' },
    description: {
      ja: '食べ物・休日・エンタメ中心。まだ詳しく知らなくても予想しやすい。',
      en: 'Easy picks about food, free time, and entertainment.',
    },
    image: '/assets/question-packs/easy-first-meeting.svg',
    ids: {
      ja: [
        'HLD014', 'HLD079', 'HLD087', 'HLD090', 'HLD181',
        'HLD182', 'HLD183', 'HLD188', 'HLD194', 'HLD197',
        'HLD109', 'HLD176', 'HLD185', 'HLD186', 'HLD187',
        'Q001', 'Q007', 'Q045', 'Q424', 'Q426',
        'Q440', 'Q418', 'Q423', 'Q505', 'Q509',
      ],
      en: ['ENF001', 'ENF006', 'ENF005', 'ENF015', 'ENF025', 'ENF026', 'ENF004', 'ENF007', 'ENF008', 'ENF020'],
    },
  },
  {
    slug: 'fandom-social',
    title: { ja: '推し・SNSについて話す10問', en: '10 questions about fandoms and social media' },
    description: {
      ja: '好きになったきっかけ・保存・スクショ・イベントまで、推しとSNSの楽しみ方。',
      en: 'Saving, screenshots, messages, entertainment, and online habits.',
    },
    image: '/assets/question-packs/fandom-social.svg',
    ids: {
      ja: [
        'HLD127', 'HLD128', 'HLD132', 'HLD136', 'HLD046',
        'Q067', 'HLD048', 'HLD112', 'HLD193', 'HLD194',
        'HLD130', 'HLD141', 'HLD145', 'HLD180', 'HLD086',
        'Q431', 'Q304', 'Q099', 'Q079', 'Q301',
        'Q416', 'Q208', 'Q150', 'Q137',
      ],
      en: ['ENF014', 'ENF015', 'ENF026', 'ENF027', 'ENF028', 'ENF032', 'ENF013', 'ENF017', 'ENF025', 'ENF006'],
    },
  },
  {
    slug: 'know-me-deeper',
    title: { ja: 'もっと深く知る10問', en: '10 questions to know me better' },
    description: {
      ja: '大切にしていることや、落ち込んだ時にしてほしいことを答え合わせ。',
      en: 'Values, support, trust, decisions, and what matters most.',
    },
    image: '/assets/question-packs/know-me-deeper.svg',
    ids: {
      ja: [
        'HLD162', 'HLD168', 'HLD167', 'HLD158', 'HLD157',
        'HLD159', 'HLD150', 'HLD152', 'HLD147', 'HLD133',
        'HLD056', 'HLD057', 'HLD059', 'HLD060', 'HLD063',
        'Q302', 'Q303', 'Q130', 'Q144',
        'Q159', 'Q141', 'Q439', 'Q527', 'Q528',
        'Q529',
      ],
      en: ['ENF012', 'ENF013', 'ENF010', 'ENF029', 'ENF030', 'ENF031', 'ENF032', 'ENF039', 'ENF023', 'ENF024'],
    },
  },
  {
    slug: 'live-party',
    title: { ja: 'LIVEで盛り上がる10問', en: '10 questions for a lively stream' },
    description: {
      ja: '答えが割れやすく、配信者と視聴者が理由まで話したくなる10問。',
      en: 'Fast, visual choices that invite reactions and conversation.',
    },
    image: '/assets/question-packs/live-party.svg',
    ids: {
      ja: [
        'HLD143', 'HLD144', 'HLD148', 'HLD149', 'HLD154',
        'HLD155', 'HLD172', 'HLD174', 'HLD175', 'HLD188',
        'HLD171', 'HLD169', 'HLD189', 'HLD194', 'HLD180',
        'Q267', 'Q403', 'Q408', 'Q412', 'Q434',
        'Q057', 'Q289', 'Q293', 'Q276', 'Q169',
      ],
      en: ['ENF016', 'ENF019', 'ENF035', 'ENF036', 'ENF037', 'ENF038', 'ENF033', 'ENF034', 'ENF026', 'ENF040'],
    },
  },
  {
    slug: 'summer-vacation',
    title: { ja: '夏休みの10問', en: '10 summer vacation questions' },
    description: {
      ja: 'お祭り・旅行・自由時間。夏休みに一緒にしたいことが見えてくる。',
      en: 'Festivals, trips, free time, and summer adventures.',
    },
    image: '/assets/question-packs/summer-vacation.svg',
    ids: {
      ja: [
        'HLD140', 'HLD139', 'HLD120', 'HLD189', 'HLD195',
        'HLD111', 'HLD018', 'Q428', 'HLD149', 'HLD171',
        'HLD119', 'HLD113', 'HLD116', 'HLD138', 'HLD188',
        'Q012', 'Q022', 'Q429', 'Q519', 'Q522',
        'Q417', 'Q420', 'Q524', 'Q525',
      ],
      en: ['ENF004', 'ENF018', 'ENF019', 'ENF020', 'ENF036', 'ENF033', 'ENF034', 'ENF014', 'ENF027', 'ENF017'],
    },
  },
  {
    slug: 'oshi-life',
    title: { ja: '推し活の10問', en: '10 questions about fan life' },
    description: {
      ja: '推しの魅力、使いたいお金、友達と共有したい瞬間を答え合わせ。',
      en: 'Favorites, fandom spending, memories, and what fans love to share.',
    },
    image: '/assets/question-packs/oshi-life.svg',
    ids: {
      ja: [
        'HLD127', 'HLD128', 'HLD132', 'HLD112', 'HLD130',
        'HLD136', 'HLD141', 'HLD145', 'HLD193', 'HLD194',
        'HLD046', 'Q067', 'HLD180', 'HLD178', 'HLD174',
        'Q431', 'Q304', 'Q150', 'Q099', 'Q079',
        'Q208', 'Q416', 'Q301', 'Q137',
      ],
      en: ['ENF014', 'ENF026', 'ENF027', 'ENF028', 'ENF032', 'ENF013', 'ENF015', 'ENF017', 'ENF029', 'ENF006'],
    },
  },
]);

const LIVE_PACKS = Object.freeze([
  {
    slug: 'live-comment-split',
    title: { ja: 'コメント欄が割れそうな10問', en: '10 questions that split the chat' },
    description: {
      ja: '好みが分かれやすい5択で、理由やツッコミまでコメントしたくなる。',
      en: 'Five-way choices designed to spark opinions, reactions, and debate.',
    },
    image: '/assets/question-packs/live-comment-split.svg',
    ids: {
      ja: [
        'HLD181', 'HLD182', 'HLD183', 'HLD184', 'HLD186',
        'HLD187', 'HLD188', 'HLD192', 'HLD177', 'HLD176',
        'HLD197', 'HLD199', 'HLD200', 'HLD079', 'HLD090',
        'Q401', 'Q406', 'Q407', 'Q414',
        'Q410', 'Q413', 'Q427', 'Q425', 'Q507',
        'Q402',
      ],
      en: ['ENF001', 'ENF002', 'ENF006', 'ENF007', 'ENF016', 'ENF019', 'ENF025', 'ENF037', 'ENF038', 'ENF040'],
    },
  },
  {
    slug: 'live-first-viewers',
    title: { ja: '初見視聴者も答えやすい10問', en: '10 easy questions for first-time viewers' },
    description: {
      ja: '食べ物・休日・エンタメ中心で、配信を初めて見る人もすぐ参加できる。',
      en: 'Easy food, free-time, and entertainment picks for brand-new viewers.',
    },
    image: '/assets/question-packs/live-first-viewers.svg',
    ids: {
      ja: [
        'HLD101', 'HLD103', 'HLD105', 'HLD108', 'HLD109',
        'HLD110', 'HLD111', 'HLD114', 'HLD176', 'HLD197',
        'HLD014', 'HLD079', 'HLD087', 'HLD090', 'HLD188',
        'Q418', 'Q423',
        'Q001', 'Q007', 'Q424', 'Q426', 'Q440',
        'Q505', 'Q509', 'Q549',
      ],
      en: ['ENF001', 'ENF004', 'ENF005', 'ENF006', 'ENF008', 'ENF015', 'ENF020', 'ENF025', 'ENF026', 'ENF017'],
    },
  },
  {
    slug: 'live-streamer-surprises',
    title: { ja: '配信者の意外な一面が分かる10問', en: '10 questions that reveal the streamer' },
    description: {
      ja: '第一印象、弱点、もしもの選択から、配信だけでは見えない一面を答え合わせ。',
      en: 'First impressions, weaknesses, and unexpected choices reveal another side.',
    },
    image: '/assets/question-packs/live-streamer-surprises.svg',
    ids: {
      ja: [
        'Q307', 'HLD134', 'HLD123', 'HLD117', 'HLD118',
        'HLD124', 'HLD125', 'HLD130', 'HLD138', 'HLD174',
        'HLD070', 'HLD071', 'HLD072', 'HLD075', 'HLD112',
        'Q298', 'Q421', 'Q441', 'Q547',
        'Q289', 'Q293', 'Q159', 'Q304', 'Q306',
      ],
      en: ['ENF031', 'ENF039', 'ENF037', 'ENF038', 'ENF035', 'ENF036', 'ENF029', 'ENF030', 'ENF034', 'ENF032'],
    },
  },
  {
    slug: 'live-small-stream',
    title: { ja: '30人以下の配信向け10問', en: '10 questions for streams under 30 viewers' },
    description: {
      ja: '少人数だからこそ一人ずつの反応を拾いやすく、会話を広げやすい10問。',
      en: 'Conversation-friendly questions where every viewer reaction can be noticed.',
    },
    image: '/assets/question-packs/live-small-stream.svg',
    ids: {
      ja: [
        'HLD156', 'HLD160', 'HLD161', 'HLD162', 'HLD165',
        'HLD166', 'HLD167', 'HLD168', 'HLD169', 'HLD170',
        'HLD157', 'HLD158', 'HLD159', 'HLD141', 'HLD164',
        'Q111', 'Q305', 'Q137', 'Q130', 'Q141',
        'Q150', 'Q153', 'Q256', 'Q301', 'Q302',
      ],
      en: ['ENF009', 'ENF010', 'ENF011', 'ENF012', 'ENF013', 'ENF014', 'ENF029', 'ENF030', 'ENF031', 'ENF039'],
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
