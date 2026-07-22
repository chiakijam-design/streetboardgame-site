import { calculateLiveResult, validateLiveDraft } from './model.js';

const LIVE_TTL_SECONDS = 60 * 60 * 24;
const LIVE_CODE_PATTERN = /^[0-9]{6}$/;
let liveD1ReadyPromise = null;
let liveRateLimitReadyPromise = null;

export async function handleLiveApi(request, env, path) {
  if (request.method === 'OPTIONS') return liveJson({});
  try {
    if (path === '/api/live/youtube-candidates' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'youtube', 15);
      return await createYouTubeCandidatesResponse(request);
    }
    if (!env.REMOTE_DB && !env.LIVE_KV && !env.REMOTE_KV) {
      return liveJson({ error: 'live-storage-not-configured' }, 500);
    }
    if (path === '/api/live/games' && request.method === 'POST') {
      await enforceLiveRateLimit(request, env, 'create', 10);
      return await createLiveGame(request, env);
    }

    const route = path.match(/^\/api\/live\/games\/([0-9]{6})(?:\/(join|start|vote|close|next))?$/);
    if (!route) return liveJson({ error: 'not-found' }, 404);
    const [, code, action = ''] = route;
    if (request.method === 'GET' && !action) return await getLiveGameResponse(request, env, code);
    if (request.method !== 'POST') return liveJson({ error: 'method-not-allowed' }, 405);
    if (action === 'join') {
      await enforceLiveRateLimit(request, env, 'join', 100);
      return await joinLiveGame(request, env, code);
    }
    if (action === 'vote') {
      await enforceLiveRateLimit(request, env, 'vote', 600);
      return await voteLiveGame(request, env, code);
    }
    if (['start', 'close', 'next'].includes(action)) {
      await enforceLiveRateLimit(request, env, 'host', 300);
      return await updateLiveGameAsHost(request, env, code, action);
    }
    return liveJson({ error: 'not-found' }, 404);
  } catch (error) {
    return liveJson({ error: error && error.message ? error.message : 'live-api-error' }, Number(error && error.status) || 500);
  }
}

async function createLiveGame(request, env) {
  const body = await readLiveJson(request);
  const validation = validateLiveDraft(body && body.draft);
  if (!validation.valid) throw liveError(validation.errors[0] || 'invalid-game', 400);
  await cleanupExpiredLiveData(env);
  const now = Date.now();
  const game = {
    version: 1,
    title: validation.draft.title,
    subjectName: validation.draft.subjectName,
    questions: validation.draft.questions,
    hostToken: createLiveToken(24),
    phase: 'lobby',
    currentQuestionIndex: 0,
    participants: [],
    votes: {},
    results: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + LIVE_TTL_SECONDS * 1000,
  };
  let code = createLiveCode();
  for (let attempt = 0; attempt < 8 && await getStoredLiveGame(env, code); attempt += 1) code = createLiveCode();
  await putStoredLiveGame(env, code, game);
  return liveJson({ code, hostToken: game.hostToken, game: publicLiveGame(game, { host: true }) }, 201);
}

async function getLiveGameResponse(request, env, code) {
  const game = await requireLiveGame(env, code);
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  return liveJson({
    code,
    game: publicLiveGame(game, {
      host: Boolean(hostToken && hostToken === game.hostToken),
      participantToken,
    }),
  });
}

async function joinLiveGame(request, env, code) {
  const game = await requireLiveGame(env, code);
  if (game.phase === 'complete') throw liveError('game-finished', 409);
  const body = await readLiveJson(request);
  const name = String(body && body.name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw liveError('name-required', 400);
  const participant = { id: createLiveToken(10), token: createLiveToken(24), name, joinedAt: Date.now() };
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_participants (code, participant_id, participant_token, name, joined_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(code, participant.id, participant.token, participant.name, participant.joinedAt).run();
  } else {
    game.participants.push(participant);
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  const updatedGame = await requireLiveGame(env, code);
  return liveJson({
    code,
    participantId: participant.id,
    participantToken: participant.token,
    game: publicLiveGame(updatedGame, { participantToken: participant.token }),
  }, 201);
}

async function voteLiveGame(request, env, code) {
  const game = await requireLiveGame(env, code);
  if (game.phase !== 'voting') throw liveError('voting-closed', 409);
  const participantToken = normalizeToken(request.headers.get('x-live-participant-token'));
  const participant = game.participants.find((item) => item.token === participantToken);
  if (!participant) throw liveError('participant-forbidden', 403);
  const body = await readLiveJson(request);
  const question = game.questions[game.currentQuestionIndex];
  const optionIndex = Number(body && body.optionIndex);
  if (!question || body.questionId !== question.id) throw liveError('question-changed', 409);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) {
    throw liveError('invalid-option', 400);
  }
  if (Object.prototype.hasOwnProperty.call(game.votes[question.id] || {}, participant.id)) {
    throw liveError('already-voted', 409);
  }
  if (await ensureLiveD1(env)) {
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_votes (code, question_id, participant_id, option_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code, question_id, participant_id) DO UPDATE SET
        option_index = excluded.option_index,
        updated_at = excluded.updated_at
    `).bind(code, question.id, participant.id, optionIndex, Date.now()).run();
  } else {
    game.votes[question.id] = { ...(game.votes[question.id] || {}), [participant.id]: optionIndex };
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  const updatedGame = await requireLiveGame(env, code);
  return liveJson({ code, accepted: true, game: publicLiveGame(updatedGame, { participantToken }) });
}

async function updateLiveGameAsHost(request, env, code, action) {
  const game = await requireLiveGame(env, code);
  const hostToken = normalizeToken(request.headers.get('x-live-host-token'));
  if (!hostToken || hostToken !== game.hostToken) throw liveError('host-forbidden', 403);
  if (action === 'start') {
    if (game.phase !== 'lobby') throw liveError('game-already-started', 409);
    game.phase = 'voting';
  } else if (action === 'close') {
    if (game.phase !== 'voting') throw liveError('voting-not-open', 409);
    const question = game.questions[game.currentQuestionIndex];
    const result = calculateLiveResult(question, game.votes[question.id] || {});
    game.results = [...game.results.filter((item) => item.questionId !== question.id), result];
    game.phase = 'reveal';
  } else if (action === 'next') {
    if (game.phase !== 'reveal') throw liveError('result-not-open', 409);
    if (game.currentQuestionIndex + 1 >= game.questions.length) {
      game.phase = 'complete';
    } else {
      game.currentQuestionIndex += 1;
      game.phase = 'voting';
    }
  }
  touchLiveGame(game);
  await putStoredLiveGame(env, code, game);
  return liveJson({ code, game: publicLiveGame(game, { host: true }) });
}

export function publicLiveGame(game, access = {}) {
  const question = game.questions[game.currentQuestionIndex] || null;
  const currentVotes = question ? game.votes[question.id] || {} : {};
  const participant = access.participantToken
    ? game.participants.find((item) => item.token === access.participantToken)
    : null;
  const revealResult = question && ['reveal', 'complete'].includes(game.phase)
    ? game.results.find((item) => item.questionId === question.id) || null
    : null;
  return {
    title: game.title,
    subjectName: game.subjectName,
    phase: game.phase,
    currentQuestionIndex: game.currentQuestionIndex,
    questionCount: game.questions.length,
    participantCount: game.participants.length,
    participants: game.participants.map(({ id, name }) => ({ id, name })),
    question: question ? {
      id: question.id,
      type: question.type,
      text: question.text,
      options: question.options,
      voteCount: Object.keys(currentVotes).length,
      result: revealResult,
    } : null,
    myVoteIndex: participant && Object.prototype.hasOwnProperty.call(currentVotes, participant.id)
      ? Number(currentVotes[participant.id])
      : null,
    results: game.phase === 'complete' ? game.results : [],
    host: Boolean(access.host),
    questions: access.host ? game.questions.map(({ id, type, text, options }) => ({ id, type, text, options })) : undefined,
  };
}

async function createYouTubeCandidatesResponse(request) {
  const body = await readLiveJson(request);
  const channelUrl = normalizeYouTubeChannelUrl(body && body.channelUrl);
  if (!channelUrl) throw liveError('invalid-youtube-channel-url', 400);
  const questionType = body && body.questionType;
  if (!['guess-person', 'guess-majority'].includes(questionType)) throw liveError('invalid-youtube-question-type', 400);
  const seed = Number(body && body.seed) || 0;
  let profile;
  try {
    profile = await fetchYouTubeChannelProfile(channelUrl);
  } catch (error) {
    const fallbackName = decodeURIComponent(new URL(channelUrl).pathname.split('/').filter(Boolean).pop() || 'YouTubeチャンネル');
    profile = { channelName: fallbackName.replace(/^@/, '') || 'YouTubeチャンネル', description: '', videoTitles: [], source: 'url-fallback' };
  }
  return liveJson({ channelUrl, profile, questionType, questions: generateYouTubeQuestions(profile, seed, questionType) });
}

export function normalizeYouTubeChannelUrl(value) {
  let url;
  try {
    const input = String(value || '').trim();
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch (error) {
    return '';
  }
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com'].includes(hostname)) return '';
  const parts = url.pathname.split('/').filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0];
  const valid = first.startsWith('@')
    || (['channel', 'c', 'user'].includes(first) && Boolean(parts[1]));
  if (!valid) return '';
  const normalizedPath = first.startsWith('@') ? `/${first}` : `/${first}/${parts[1]}`;
  return `https://www.youtube.com${normalizedPath}`;
}

async function fetchYouTubeChannelProfile(channelUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(channelUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; WatachanLive/1.0; +https://www.streetboardgame.com/)',
        'accept-language': 'ja,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error('youtube-channel-fetch-failed');
  const html = await response.text();
  const channelName = extractMeta(html, 'og:title') || extractHtmlTitle(html) || 'YouTubeチャンネル';
  const description = extractMeta(html, 'og:description') || extractNamedMeta(html, 'description') || '';
  const videoTitles = extractYouTubeVideoTitles(html).filter((title) => title !== channelName).slice(0, 20);
  return { channelName: cleanChannelName(channelName), description: decodeHtml(description).slice(0, 500), videoTitles, source: 'youtube-public-page' };
}

export function generateYouTubeQuestions(profile, seed = 0, questionType = 'guess-person') {
  const name = String(profile && profile.channelName || 'このチャンネル').trim() || 'このチャンネル';
  const videos = Array.isArray(profile && profile.videoTitles) ? profile.videoTitles.filter(Boolean).slice(0, 20) : [];
  const videoOptions = (offset) => videos.length >= 2
    ? Array.from({ length: Math.min(4, videos.length) }, (_, index) => videos[(offset + index) % videos.length])
    : ['トーク企画', 'チャレンジ企画', 'コラボ企画', '生配信'];
  const personTemplates = [
    ['本人が初めて見る人に一番おすすめしたい動画は？', videoOptions(0)],
    ['本人が今もう一度見てほしい動画は？', videoOptions(3)],
    ['本人が撮影で一番大切にしていることは？', ['面白さ', '分かりやすさ', '自分らしさ', '視聴者との距離']],
    ['本人が次に一番挑戦したい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['本人が動画作りで一番好きな時間は？', ['企画を考える時', '撮影中', '編集している時', '公開後の反応を見る時']],
    ['本人が撮影前に一番気にすることは？', ['話す内容', '見た目', '撮影場所', '体調']],
    ['本人がチャンネルの強みだと思うものは？', ['企画力', 'トーク', '編集', 'キャラクター']],
    ['本人が一番うれしい視聴者の反応は？', ['笑った', '参考になった', '元気が出た', 'また見たい']],
    ['本人が一緒に動画を作りたい相手は？', ['同ジャンルの人', '違うジャンルの人', '視聴者', '昔からの友達']],
    ['本人が動画で一番見せたい一面は？', ['面白いところ', '真剣なところ', '自然体', '意外な特技']],
    ['本人が一番落ち着く撮影スタイルは？', ['一人撮影', '少人数', '大人数', '屋外ロケ']],
    ['本人がチャンネルで今後増やしたいものは？', ['短い動画', '長い動画', '生配信', 'シリーズ企画']],
    ['本人が企画を決める時に一番頼るものは？', ['自分の直感', 'コメント', '流行', '仲間の意見']],
    ['本人が動画を公開する時の気持ちに近いものは？', ['楽しみ', '緊張', '達成感', 'すぐ次を作りたい']],
    [`本人が「${name}」を一言で表すなら？`, ['挑戦', '笑い', 'つながり', '自分らしさ']],
    ['本人が動画を一本だけ残すならどれを選ぶ？', videoOptions(6)],
    ['本人が一番自分らしく話せたと思う動画は？', videoOptions(9)],
    ['本人が朝起きて最初に確認するものは？', ['コメント', '再生数', '今日の予定', 'SNS']],
    ['本人が編集で一番こだわる部分は？', ['テンポ', '音楽・効果音', 'テロップ', '映像の色']],
    ['本人が撮影で予想外に苦労しやすいことは？', ['準備', '話の流れ', '機材', '時間管理']],
    ['本人が一番伸ばしたいスキルは？', ['トーク', '企画', '撮影', '編集']],
    ['本人が動画のアイデアを思いつきやすい場所は？', ['自宅', '移動中', '人と話している時', 'コメントを見ている時']],
    ['本人が撮影後に最初にすることは？', ['映像を確認する', '休憩する', '編集を始める', 'SNSを更新する']],
    ['本人が一番大切にしたいチャンネルの雰囲気は？', ['楽しい', '落ち着く', '学べる', '驚きがある']],
    ['本人が視聴者と一緒に実現したいことは？', ['記念企画', 'イベント', '商品作り', '社会貢献']],
    ['本人が過去の自分に一つ助言するなら？', ['もっと投稿する', '失敗を恐れない', '得意を伸ばす', '休む時間を作る']],
    ['本人が撮影日に一番欠かせないものは？', ['飲み物', '台本・メモ', 'お気に入りの機材', '応援してくれる仲間']],
    ['本人が一番達成感を感じる瞬間は？', ['撮影が終わった時', '編集が完成した時', '公開した時', '反響が届いた時']],
    ['本人が次の節目でやりたいことは？', ['特別動画', '生配信', 'コラボ', '視聴者参加企画']],
    [`本人が「${name}」を続ける一番の原動力は？`, ['作る楽しさ', '視聴者の反応', '仲間との活動', '目標の実現']],
  ];
  const majorityTemplates = [
    ['視聴者が初めての人に一番すすめたい動画は？', videoOptions(1)],
    ['視聴者が続編を一番見たい動画は？', videoOptions(4)],
    ['視聴者が次に一番見たい企画は？', ['大型企画', 'コラボ', '生配信', '新ジャンル']],
    ['視聴者がチャンネルの一番好きなところは？', ['企画', 'トーク', '編集', '人柄']],
    ['視聴者が動画を見ることが多い時間は？', ['朝', '昼', '夕方', '夜']],
    ['視聴者が一番参加したい企画は？', ['質問コーナー', '投票企画', 'ライブ配信', 'オフラインイベント']],
    ['視聴者がもっと知りたいことは？', ['日常', '制作の裏側', '好きなもの', '今後の目標']],
    ['視聴者が一番うれしい更新は？', ['毎日短く更新', '週1で大作', '不定期ライブ', 'シリーズを継続']],
    ['視聴者がコラボで見たい相手は？', ['同ジャンル', '別ジャンル', '友達', '視聴者']],
    ['視聴者が一番印象に残る要素は？', ['タイトル', 'サムネイル', '最初の1分', 'ラスト']],
    ['視聴者が友達に紹介する時の一言は？', ['笑える', '役に立つ', '親しみやすい', '企画がすごい']],
    ['視聴者が見返したくなる動画は？', ['トーク', 'チャレンジ', 'コラボ', '密着・日常']],
    ['視聴者が一番応援したくなる瞬間は？', ['新しい挑戦', '失敗からの再挑戦', '目標達成', '視聴者への感謝']],
    ['視聴者がグッズにするなら一番ほしいものは？', ['ステッカー', 'Tシャツ', 'アクリルグッズ', '実用品']],
    [`視聴者が「${name}」に今後一番期待することは？`, ['もっと大きな企画', '今の雰囲気を続ける', '更新回数を増やす', '視聴者参加を増やす']],
    ['視聴者が一番人に見せたくなる動画は？', videoOptions(7)],
    ['視聴者がチャンネルを知るきっかけになりそうな動画は？', videoOptions(10)],
    ['視聴者が通知を見てすぐ再生したくなる企画は？', ['新シリーズ', '大型チャレンジ', '人気企画の続編', 'コラボ']],
    ['視聴者が動画で一番聞きたい話は？', ['最近の出来事', '失敗談', '将来の目標', '制作の裏話']],
    ['視聴者が一番まねしてみたいものは？', ['企画', '習慣', '話し方', '使っている道具']],
    ['視聴者が動画を最後まで見る決め手は？', ['展開が気になる', '話が面白い', '役に立つ', '雰囲気が好き']],
    ['視聴者が一番親近感を持つ瞬間は？', ['失敗した時', '日常を見せた時', '本音を話した時', 'コメントに反応した時']],
    ['視聴者が生配信で一番やってほしいことは？', ['質問回答', 'ゲーム・挑戦', '雑談', '一緒に企画を決める']],
    ['視聴者が動画の長さとして一番見やすいのは？', ['1分未満', '5分前後', '10〜20分', '30分以上']],
    ['視聴者が一番保存したくなる動画は？', ['役立つ解説', 'お気に入り企画', '感動する話', '何度も笑える動画']],
    ['視聴者が新しく見てみたい撮影場所は？', ['自宅・スタジオ', '街中', '自然の中', '海外']],
    ['視聴者が一番好きな投稿ペースは？', ['毎日', '週2〜3回', '週1回', '質重視で不定期']],
    ['視聴者がメンバーになったら一番ほしい特典は？', ['限定動画', '限定配信', '制作の裏側', '先行公開']],
    ['視聴者がチャンネルの次の目標にしてほしいことは？', ['登録者の節目', '大型企画', 'イベント開催', '新しい分野への挑戦']],
    [`視聴者が「${name}」を見続ける一番の理由は？`, ['動画が面白い', '本人が好き', '役に立つ', '一緒に成長を感じる']],
  ];
  const rotate = (items) => {
    const offset = Math.abs(Number(seed) || 0) % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };
  const templates = questionType === 'guess-majority' ? majorityTemplates : personTemplates;
  const idPrefix = questionType === 'guess-majority' ? 'yt-majority' : 'yt-person';
  return rotate(templates).map(([text, options], index) => ({
    id: `${idPrefix}-${seed}-${index}`,
    type: questionType === 'guess-majority' ? 'guess-majority' : 'guess-person',
    text,
    options,
    lockedIndex: null,
    selected: index < 5,
    recommended: index < 5,
  }));
}

function extractMeta(html, property) {
  return extractTagContent(html, `property=["']${escapeRegExp(property)}["']`);
}

function extractNamedMeta(html, name) {
  return extractTagContent(html, `name=["']${escapeRegExp(name)}["']`);
}

function extractTagContent(html, marker) {
  const first = new RegExp(`<meta[^>]*${marker}[^>]*content=["']([^"']*)["'][^>]*>`, 'i').exec(html);
  if (first) return decodeHtml(first[1]);
  const second = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${marker}[^>]*>`, 'i').exec(html);
  return second ? decodeHtml(second[1]) : '';
}

function extractHtmlTitle(html) {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? decodeHtml(match[1]).replace(/\s*-\s*YouTube\s*$/i, '') : '';
}

function extractYouTubeVideoTitles(html) {
  const found = [];
  const rendererPatterns = [
    /"videoRenderer":\{"videoId":"[^"]+"[\s\S]{0,2600}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g,
    /"gridVideoRenderer":\{"videoId":"[^"]+"[\s\S]{0,2600}?"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g,
  ];
  for (const pattern of rendererPatterns) {
    for (const match of html.matchAll(pattern)) addYouTubeTitle(found, match[1]);
  }
  if (!found.length) {
    const fallbackPattern = /"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/g;
    for (const match of html.matchAll(fallbackPattern)) addYouTubeTitle(found, match[1]);
  }
  return found;
}

function addYouTubeTitle(found, encodedTitle) {
  let title = '';
  try { title = JSON.parse(`"${encodedTitle}"`); } catch (error) { title = encodedTitle; }
  title = String(title).replace(/\s+/g, ' ').trim();
  const looksLikeNavigation = /^(ショート|ホーム|動画|ライブ|再生リスト|コミュニティ|キーボード ショートカット)$/i.test(title)
    || /のYouTube$/i.test(title);
  if (!looksLikeNavigation && title.length >= 4 && title.length <= 80 && !found.includes(title)) found.push(title);
}

function cleanChannelName(value) {
  return decodeHtml(value).replace(/\s*-\s*YouTube\s*$/i, '').trim().slice(0, 80) || 'YouTubeチャンネル';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireLiveGame(env, code) {
  if (!LIVE_CODE_PATTERN.test(code)) throw liveError('room-not-found', 404);
  const game = await getStoredLiveGame(env, code);
  if (!game) throw liveError('room-not-found', 404);
  return game;
}

async function ensureLiveD1(env) {
  if (!env.REMOTE_DB) return false;
  if (!liveD1ReadyPromise) {
    liveD1ReadyPromise = Promise.all([
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_games (
          code TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_participants (
          code TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          participant_token TEXT NOT NULL,
          name TEXT NOT NULL,
          joined_at INTEGER NOT NULL,
          PRIMARY KEY (code, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_votes (
          code TEXT NOT NULL,
          question_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          option_index INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (code, question_id, participant_id)
        )
      `).run(),
      env.REMOTE_DB.prepare(`
        CREATE TABLE IF NOT EXISTS live_rate_limits (
          rate_key TEXT PRIMARY KEY,
          window_start INTEGER NOT NULL,
          request_count INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `).run(),
    ]).catch((error) => {
      liveD1ReadyPromise = null;
      throw error;
    });
  }
  await liveD1ReadyPromise;
  return true;
}

async function getStoredLiveGame(env, code) {
  if (await ensureLiveD1(env)) {
    const row = await env.REMOTE_DB.prepare('SELECT payload, expires_at FROM live_games WHERE code = ?').bind(code).first();
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) {
      await env.REMOTE_DB.prepare('DELETE FROM live_games WHERE code = ?').bind(code).run();
      return null;
    }
    const game = JSON.parse(row.payload);
    const [participantsResult, votesResult] = await Promise.all([
      env.REMOTE_DB.prepare(`
        SELECT participant_id, participant_token, name, joined_at
        FROM live_participants WHERE code = ? ORDER BY joined_at ASC
      `).bind(code).all(),
      env.REMOTE_DB.prepare(`
        SELECT question_id, participant_id, option_index
        FROM live_votes WHERE code = ?
      `).bind(code).all(),
    ]);
    game.participants = (participantsResult.results || []).map((item) => ({
      id: item.participant_id,
      token: item.participant_token,
      name: item.name,
      joinedAt: Number(item.joined_at),
    }));
    game.votes = {};
    for (const item of votesResult.results || []) {
      game.votes[item.question_id] = {
        ...(game.votes[item.question_id] || {}),
        [item.participant_id]: Number(item.option_index),
      };
    }
    return game;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  return kv ? kv.get(`live:${code}`, { type: 'json' }) : null;
}

async function putStoredLiveGame(env, code, game) {
  if (await ensureLiveD1(env)) {
    const { participants, votes, ...storedGame } = game;
    await env.REMOTE_DB.prepare(`
      INSERT INTO live_games (code, payload, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at, expires_at = excluded.expires_at
    `).bind(code, JSON.stringify(storedGame), game.createdAt, game.updatedAt, game.expiresAt).run();
    return;
  }
  const kv = env.LIVE_KV || env.REMOTE_KV;
  if (!kv) throw liveError('live-storage-not-configured', 500);
  await kv.put(`live:${code}`, JSON.stringify(game), { expirationTtl: LIVE_TTL_SECONDS });
}

async function cleanupExpiredLiveData(env) {
  if (!await ensureLiveD1(env)) return;
  const now = Date.now();
  await env.REMOTE_DB.prepare('DELETE FROM live_votes WHERE code IN (SELECT code FROM live_games WHERE expires_at < ?)').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_participants WHERE code IN (SELECT code FROM live_games WHERE expires_at < ?)').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_games WHERE expires_at < ?').bind(now).run();
  await env.REMOTE_DB.prepare('DELETE FROM live_rate_limits WHERE expires_at < ?').bind(now).run();
}

async function enforceLiveRateLimit(request, env, scope, limit) {
  if (!env.REMOTE_DB) return;
  if (!liveRateLimitReadyPromise) {
    liveRateLimitReadyPromise = env.REMOTE_DB.prepare(`
      CREATE TABLE IF NOT EXISTS live_rate_limits (
        rate_key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run().catch((error) => {
      liveRateLimitReadyPromise = null;
      throw error;
    });
  }
  await liveRateLimitReadyPromise;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const ip = String(request.headers.get('CF-Connecting-IP') || 'unknown');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const ipHash = Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const key = `live:${scope}:${ipHash}`;
  await env.REMOTE_DB.prepare(`
    INSERT INTO live_rate_limits (rate_key, window_start, request_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      window_start = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.window_start ELSE excluded.window_start END,
      request_count = CASE WHEN live_rate_limits.window_start = excluded.window_start THEN live_rate_limits.request_count + 1 ELSE 1 END,
      expires_at = excluded.expires_at
  `).bind(key, windowStart, windowStart + windowMs * 2).run();
  const row = await env.REMOTE_DB.prepare('SELECT request_count FROM live_rate_limits WHERE rate_key = ?').bind(key).first();
  if (Number(row && row.request_count || 0) > limit) throw liveError('rate-limit-exceeded', 429);
}

function touchLiveGame(game) {
  game.updatedAt = Date.now();
  game.expiresAt = game.updatedAt + LIVE_TTL_SECONDS * 1000;
}

function createLiveCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join('');
}

function createLiveToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeToken(value) {
  const token = String(value || '').trim();
  return /^[a-f0-9]{20,96}$/i.test(token) ? token : '';
}

async function readLiveJson(request) {
  try { return await request.json(); } catch (error) { return {}; }
}

function liveError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function liveJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' },
  });
}
