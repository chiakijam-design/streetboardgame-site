import { pickRandomItems } from './src/core/random.js';
import { countMatches } from './src/core/scoring.js';
import { oppositeLoveMode as oppositeLoveModeCore } from './src/core/roles.js';
import {
  openLineShare as openLineSharePlatform,
  openXShare as openXSharePlatform,
} from './src/platform/share.js';
import { saveImageBlob as saveImageBlobPlatform } from './src/platform/imageSave.js';
import { BOARD_GAME_PRODUCT } from './src/product/config.js';

(function () {
  const INITIAL_GAME_TYPE = window.location.pathname === '/remote-boardgame' ? 'boardgame' : 'love';
  const ROOM_STORAGE_KEY = `watachan-remote-${INITIAL_GAME_TYPE}-role-v3`;
  const ROOM_SWAP_STORAGE_KEY = `watachan-remote-${INITIAL_GAME_TYPE}-role-swap-v1`;
  const ROOM_RECOVERY_STORAGE_KEY = `watachan-remote-${INITIAL_GAME_TYPE}-recovery-v1`;
  const ROOM_RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;
  const REMOTE_BOARDGAME_RESULT_SHARE_VERSION = 'result-20260724-1';
  const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
  const RESULT_GIRL_IMAGE_SRC = '/assets/character/girl-default.webp';
  const RESULT_QR_IMAGE_SRC = '/assets/qr-site.png?v=20260710-qr-1';

  function trackRemoteEvent(name, params = {}) {
    if (typeof window.trackEvent !== 'function') return;
    try {
      window.trackEvent(name, params);
    } catch (e) {
      // Analytics must never interrupt the remote game flow.
    }
  }

  function trackRemoteShare(method, contentType = 'result') {
    trackRemoteEvent('share', {
      method,
      content_type: contentType,
      item_id: `${INITIAL_GAME_TYPE === 'boardgame' ? 'remote_boardgame' : 'remote'}_${contentType}`,
      game_type: INITIAL_GAME_TYPE === 'boardgame' ? 'boardgame' : 'remote',
      play_mode: 'remote',
    });
  }
  const RESULT_TIERS = [
    {
      title: '彼女理解は初期設定中',
      tag: '初期設定',
      tagBg: '#1a1a1a',
      tagColor: '#fff',
      emoji: '💔',
      msg: '0問正解は逆にレア。\nここから覚えることが多すぎて、デートの話題には困らない。\n今日の答え合わせから始めよ ♡',
    },
    {
      title: '彼女クイズ見習い中',
      tag: '見習い',
      tagBg: '#f4a261',
      tagColor: '#fff',
      emoji: '🌱',
      msg: '1問当てたのはえらい。\nでもまだ「分かってる風」ゾーン。\n次のデートで一気にアップデート希望 ✦',
    },
    {
      title: '彼女データ更新中',
      tag: 'UPDATE中',
      tagBg: '#5bd4e8',
      tagColor: '#1a1a1a',
      emoji: '🌷',
      msg: 'まだ知らない一面、多め。\nでもそれって、これから知れる余白がある。\n外した答えほど、ふたりのネタになる ♡',
    },
    {
      title: 'ドヤ顔まであと一歩',
      tag: '惜しい',
      tagBg: '#ec7b98',
      tagColor: '#fff',
      emoji: '💞',
      msg: '半分以上わかってるのはちゃんと強い。\nただし満点彼氏を名乗るには、あと少し。\n外した問題、次回までに要復習 ♡',
    },
    {
      title: '彼女マスターまであと1問',
      tag: 'あと1問',
      tagBg: '#ec4f88',
      tagColor: '#fff',
      emoji: '🌹',
      msg: 'これはかなり分かってる。\nあと1問で満点なのがいちばん悔しいやつ。\nもう一回やったら伝説、ある ♡',
    },
    {
      title: '彼女公認・理解王',
      tag: '♡ PERFECT ♡',
      tagBg: '#ffe26b',
      tagColor: '#1a1a1a',
      emoji: '💕',
      msg: '全問正解はさすがに強すぎ。\n好みも迷いどころも、ちゃんと見てる彼氏。\nこれは堂々と自慢していいやつ ♡',
    },
  ];
  const BOARDGAME_RESULT_TIERS = [
    { title: '好みのルール確認中', tag: '初見卓', tagBg: '#1a1a1a', tagColor: '#fff', emoji: '🎲', msg: 'まだ知らないゲームの好みがたくさん。\n答え合わせを、次のボドゲ会のインストにしよう。' },
    { title: '同卓したての仲間', tag: '1 HIT', tagBg: '#f4a261', tagColor: '#fff', emoji: '🃏', msg: '1問正解から絆チェック開始。\n遊ぶ回数が増えるほど、好みも読めるようになるはず。' },
    { title: '次のボドゲ会で更新予定', tag: '2 HIT', tagBg: '#5bd4e8', tagColor: '#1a1a1a', emoji: '♟️', msg: '知っている好みと意外な答えが半々。\nズレたお題こそ、次のゲーム選びのヒント。' },
    { title: 'ボドゲの好みは半分把握', tag: 'GOOD', tagBg: '#ec7b98', tagColor: '#fff', emoji: '🎯', msg: '3問正解なら観察力はかなり高め。\nあと少しで、安心してゲーム選びを任せられる仲間。' },
    { title: 'ボドゲ棚の好みほぼ把握', tag: 'あと1問', tagBg: '#ec4f88', tagColor: '#fff', emoji: '🏆', msg: '4問正解は同卓経験の強さ。\nあと1問で、ボドゲ仲間マスター。' },
    { title: '公認・ボドゲ仲間マスター', tag: 'PERFECT', tagBg: '#ffe26b', tagColor: '#1a1a1a', emoji: '👑', msg: '全問正解は、好みもプレイスタイルも完全把握。\n次のゲーム選びも安心して任せられる仲間です。' },
  ];

  const REVIEW_CATEGORY_LABELS = {
    food: '食べ物・日常の好み',
    outing: 'おでかけ・遊びの感覚',
    lifestyle: '暮らし方・生活リズム',
    personality: '性格・価値観',
    memory: '思い出・過去のツボ',
    fantasy: 'もしも話・妄想力',
    entertainment: '推し・エンタメ感性',
    challenge: '苦手なこと・挑戦のクセ',
  };

  const REMOTE_REVIEW_VARIANTS = {
    opening: [
      '{guesser}から見た{target}理解度は、{level}。',
      '{guesser}の読みは、{target}に対して{level}です。',
      'ふたりの答え合わせには、{level}の空気が出ています。',
      '{target}と{guesser}は、{level}でじわっと個性が出る組み合わせ。',
    ],
    title: [
      '今日の称号「{title}」は、正解数よりもズレ方に味があるタイプ。',
      '「{title}」という結果どおり、近い部分と読めない部分が混ざっています。',
      '称号は「{title}」。分かっているところの強さがちゃんと出ています。',
      '今日のふたりは「{title}」寄り。答え合わせで距離が縮まる組み合わせ。',
    ],
    hit: [
      '{hit}では、ふたりの感覚が自然に重なりやすい流れ。',
      '{hit}まわりは強め。{guesser}の観察力がちゃんと働いています。',
      '{hit}の答えは近め。普段の会話から、好みを拾えている印象。',
      '{hit}では、{target}の本音にかなり近いところまで届いています。',
    ],
    insight: [
      '何気ない選択や普段の好みほど、{guesser}の観察力が出やすいタイプ。',
      '言葉にしていない小さなクセほど、ふたりの関係性がにじみます。',
      '当たった答えには、いつもの会話で拾ったヒントが残っています。',
      '正解した部分は、偶然というより「ちゃんと見てる」が出たところ。',
    ],
    miss: [
      '一方で{miss}では、{target}の中にまだ読めない余白が残っています。',
      '{miss}のズレは、知らないというより「まだ聞いたことがない」系の余白。',
      '{miss}では、{target}の意外な一面が少しだけ顔を出しています。',
      '{miss}まわりは、次に話すと盛り上がりそうな未回収ゾーン。',
    ],
    score: {
      high: [
        '全体的には、言葉にしなくても伝わる部分が多い安心シンクロ型。',
        'かなり分かっているけれど、完璧すぎない余白が楽しいタイプ。',
        '正解数は強め。あとは細かい好みのアップデートでさらに近づきます。',
      ],
      mid: [
        'ズレもあるけど、そのズレが会話のネタになって距離を縮める組み合わせ。',
        '分かるところと意外なところのバランスが、いちばん盛り上がるタイプ。',
        '半分以上読めている空気感。まだ知らない部分があるから面白い状態。',
      ],
      low: [
        '今はまだ予想外れも多め。でも知るほど急に伸びるポテンシャル型。',
        '未知数が多いぶん、答え合わせで新しい発見が出やすいタイプ。',
        'まだ読み切れていないけれど、ここから会話が増える余地はかなりあります。',
      ],
    },
    close: [
      '総合すると、ふたりは答え合わせでじわじわ仲が深まるタイプです。',
      '正解数よりも「理由を聞いた時の盛り上がり」が強みです。',
      'ふたりの距離は、当たり外れより答え合わせの会話で近づくタイプ。',
      'まとめると、ズレまで含めてネタになる、会話強めの相性です。',
    ],
  };

  const $ = (id) => document.getElementById(id);

  let state = null;
  let roomCode = '';
  let role = '';
  let turnToken = '';
  let manageToken = '';
  let handoffMode = false;
  let handoffRole = '';
  let busy = false;
  let sendingChoice = false;
  let pendingChoice = null;
  let latestResult = null;
  let lastPlayViewKey = '';
  let resultReturnMode = false;

  function currentGameType(room = state) {
    return room && room.type === 'boardgame' ? 'boardgame' : INITIAL_GAME_TYPE;
  }

  function isBoardgame(room = state) {
    return currentGameType(room) === 'boardgame';
  }

  function remotePath(room = state) {
    return isBoardgame(room) ? '/remote-boardgame' : '/remote';
  }

  function cleanName(value, fallback) {
    const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 6);
    return text || fallback;
  }

  function requiredName(input, label) {
    const value = cleanName(input.value, '');
    input.value = value;
    input.setCustomValidity(value ? '' : `${label}を6文字以内で入力してください`);
    if (!value) {
      input.reportValidity();
      input.focus();
    }
    return value;
  }

  function updateCreateButtonState() {
    const button = $('createRoom');
    if (!button) return;
    const hasSelfName = Boolean(cleanName($('selfName').value, ''));
    const hasOtherName = Boolean(cleanName($('otherName').value, ''));
    button.disabled = busy || !hasSelfName || !hasOtherName;
  }

  function normalizeCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
  }

  function normalizeTurnToken(value) {
    const token = String(value || '').trim();
    return /^[a-f0-9]{36}$/i.test(token) ? token : '';
  }

  function normalizeManageToken(value) {
    const token = String(value || '').trim();
    return /^[a-f0-9]{48}$/i.test(token) ? token : '';
  }

  function getRoleMap() {
    try {
      return JSON.parse(sessionStorage.getItem(ROOM_STORAGE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveRole(code, nextRole) {
    const map = getRoleMap();
    map[code] = nextRole;
    sessionStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(map));
    role = nextRole;
  }

  function loadRole(code) {
    role = getRoleMap()[code] || '';
  }

  function getRecoveryMap() {
    try {
      const map = JSON.parse(localStorage.getItem(ROOM_RECOVERY_STORAGE_KEY) || '{}') || {};
      const now = Date.now();
      let changed = false;
      Object.keys(map).forEach((code) => {
        const entry = map[code];
        if (!entry || Number(entry.expiresAt || 0) <= now) {
          delete map[code];
          changed = true;
        }
      });
      if (changed) localStorage.setItem(ROOM_RECOVERY_STORAGE_KEY, JSON.stringify(map));
      return map;
    } catch (e) {
      return {};
    }
  }

  function loadRecovery(code) {
    const entry = getRecoveryMap()[code];
    if (!entry) return null;
    const savedRole = entry.role === 'target' || entry.role === 'guesser' ? entry.role : '';
    const savedToken = normalizeTurnToken(entry.turnToken);
    const savedHandoffRole = entry.handoffRole === 'target' || entry.handoffRole === 'guesser'
      ? entry.handoffRole
      : '';
    return {
      role: savedRole,
      turnToken: savedToken,
      manageToken: normalizeManageToken(entry.manageToken),
      handoffMode: Boolean(entry.handoffMode && savedToken && savedHandoffRole),
      handoffRole: savedHandoffRole,
    };
  }

  function saveRecovery() {
    if (!roomCode || !role || !state) return;
    try {
      const map = getRecoveryMap();
      map[roomCode] = {
        role,
        turnToken,
        manageToken,
        handoffMode,
        handoffRole,
        expiresAt: Math.min(
          Number(state.expiresAt || Date.now() + ROOM_RECOVERY_TTL_MS),
          Date.now() + ROOM_RECOVERY_TTL_MS,
        ),
      };
      localStorage.setItem(ROOM_RECOVERY_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      // Storage may be unavailable in private/in-app browsers. The URL remains the fallback.
    }
  }

  function getSwapMap() {
    try {
      return JSON.parse(sessionStorage.getItem(ROOM_SWAP_STORAGE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function markSwapSeen(code, nonce) {
    if (!code || !nonce) return;
    const map = getSwapMap();
    map[code] = nonce;
    sessionStorage.setItem(ROOM_SWAP_STORAGE_KEY, JSON.stringify(map));
  }

  function oppositeRole(nextRole) {
    return nextRole === 'target' ? 'guesser' : 'target';
  }

  function syncRoleSwap() {
    if (!roomCode || !state || !state.roleSwapNonce || !role) return;
    const map = getSwapMap();
    if (map[roomCode] === state.roleSwapNonce) return;
    saveRole(roomCode, oppositeRole(role));
    map[roomCode] = state.roleSwapNonce;
    sessionStorage.setItem(ROOM_SWAP_STORAGE_KEY, JSON.stringify(map));
  }

  function setHidden(id, hidden) {
    $(id).classList.toggle('hidden', Boolean(hidden));
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    ['joinRoom', 'replaySameRoom', 'replaySwapRoles'].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = busy;
    });
    updateCreateButtonState();
  }

  async function api(path, options) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (json.error === 'rate-limit-exceeded') {
        throw new Error('操作が続いたため少し待っています。1分ほどしてからもう一度お試しください。');
      }
      if (json.error === 'room-update-forbidden') {
        throw new Error('この端末ではルームを更新できません。参加時に届いた最新URLを開き直してください。');
      }
      throw new Error(json.error || '通信に失敗しました');
    }
    return json;
  }

  function pickCards() {
    if (isBoardgame() && window.pickRandomBoardgameCards) return window.pickRandomBoardgameCards(5);
    if (window.pickRandomCards) return window.pickRandomCards(5);
    return pickRandomItems(Array.isArray(window.ALL_CARDS) ? window.ALL_CARDS : [], 5);
  }

  function targetAndGuesser(room) {
    const girl = room.players && room.players.girl ? room.players.girl : '相手';
    const boy = room.players && room.players.boy ? room.players.boy : '私';
    if (room.loveMode === 'boyTarget') {
      return { target: boy, guesser: girl, targetSide: 'boy', guesserSide: 'girl' };
    }
    return { target: girl, guesser: boy, targetSide: 'girl', guesserSide: 'boy' };
  }

  function oppositeLoveMode(loveMode) {
    return oppositeLoveModeCore(loveMode);
  }

  function isDefaultNames(names) {
    return names.target === '彼女' && names.guesser === '彼氏';
  }

  function loveResultHeaderLabel(names) {
    if (isBoardgame()) return 'ボドゲ仲間の絆判定';
    return '2人の理解度判定';
  }

  function loveScoreLabel(names) {
    if (isBoardgame()) return `${names.guesser}の${names.target}理解度`;
    if (names.targetSide === 'girl' && names.guesserSide === 'boy' && isDefaultNames(names)) {
      return '彼氏の彼女理解度';
    }
    if (names.targetSide === 'boy' && names.guesserSide === 'girl' && names.target === '彼氏' && names.guesser === '彼女') {
      return '彼女の彼氏理解度';
    }
    return `${names.guesser}の${names.target}理解度`;
  }

  function personalizeLoveText(text, names) {
    return String(text || '')
      .replace(/満点彼氏/g, `満点${names.guesser}`)
      .replace(/彼女/g, names.target)
      .replace(/彼氏/g, names.guesser);
  }

  function getTier(score) {
    const safeScore = Math.max(0, Math.min(5, Number(score) || 0));
    const tiers = isBoardgame() ? BOARDGAME_RESULT_TIERS : RESULT_TIERS;
    return tiers[safeScore] || tiers[0];
  }

  function inferReviewCategory(card = {}) {
    const source = `${card.category || ''} ${card.title || ''}`;
    if (/食|飲|ご飯|朝食|夜食|お菓子|コンビニ|味|料理|差し入れ|給食|祭り/.test(source)) return 'food';
    if (/旅行|行きたい|場所|デート|都道府県|地域|遊び|休日|パーティー|イベント/.test(source)) return 'outing';
    if (/家|部屋|暮らし|寝る前|お風呂|朝|支度|持ち物|常備/.test(source)) return 'lifestyle';
    if (/性格|価値観|自分|基準|信じ|人生|言葉|親友|属性/.test(source)) return 'personality';
    if (/昔|思い出|過去|子ども|学校|仕事|教科|アルバイト/.test(source)) return 'memory';
    if (/もし|能力|願い|無人島|宇宙|未来|生まれ変わる|一生/.test(source)) return 'fantasy';
    if (/SNS|映画|推し|本|漫画|音楽|アニメ|ゲーム/.test(source)) return 'entertainment';
    if (/苦手|怖い|挑戦|NG|イライラ|決断/.test(source)) return 'challenge';
    return 'personality';
  }

  function getRemoteReviewLines(answers, cards, names, title = '') {
    const total = Math.max(1, answers.length);
    const score = countMatches(answers);
    const hits = {};
    const misses = {};
    answers.forEach((answer, index) => {
      const category = inferReviewCategory(cards[index]);
      const bucket = answer.match ? hits : misses;
      bucket[category] = (bucket[category] || 0) + 1;
    });
    const topCategory = (bucket, fallback) => Object.entries(bucket)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
    const hit = REVIEW_CATEGORY_LABELS[topCategory(hits, 'personality')];
    const miss = REVIEW_CATEGORY_LABELS[topCategory(misses, 'fantasy')];
    const level = score >= 4 ? 'かなり近い波長' : score >= 2 ? '半分シンクロ型' : '未知数多めの開拓型';
    const scoreBand = score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
    const questionSeed = cards.reduce((sum, card, index) => {
      const text = `${card && card.category || ''}${card && card.title || ''}`;
      return sum + Array.from(text).reduce((value, char) => value + char.charCodeAt(0), 0) + (answers[index] && answers[index].match ? 17 : 3);
    }, 0);
    const values = {
      target: names.target,
      guesser: names.guesser,
      title,
      level,
      hit,
      miss,
    };
    const fillTemplate = (template) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] || '');
    const pickVariant = (list, offset = 0) => {
      const seed = questionSeed + (score * 13) + (hit.length * 5) + (miss.length * 7) + offset;
      return list[Math.abs(seed) % list.length];
    };
    const hitLine = score > 0
      ? `${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.hit, 3))} ${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.insight, 4))}`
      : `${names.guesser}にとって、${names.target}の答えはまだ意外性多め。普段のイメージだけでは読みきれない、発見が多い回です。`;
    const missLine = score < total
      ? fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.miss, 5))
      : `今回は外した問題なし。${names.target}の好みや迷いどころまで、${names.guesser}の読みがかなり届いています。`;
    return [
      `${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.opening, 1))} ${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.title, 2))}`,
      hitLine,
      missLine,
      `${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.score[scoreBand], 6))} ${fillTemplate(pickVariant(REMOTE_REVIEW_VARIANTS.close, 7))}`,
    ];
  }

  function resultPublicUrl() {
    if (roomCode && state && state.phase === 'result') {
      return resultRoomUrl(oppositeRole(role), false);
    }
    return `${window.location.origin}${remotePath()}`;
  }

  function resultShareText(data, platform = 'x') {
    const hashTag = isBoardgame() ? '#ボドゲ仲間の絆判定' : '#2人の理解度判定';
    if (platform === 'line') {
      return `わたちゃんで${data.headerLabel}をやってみた！${data.names.guesser}は${data.names.target}の答えを${data.score}/${data.total}問正解。称号は「${data.title}」でした。あなたなら何問当てられる？\n${resultPublicUrl()}`;
    }
    return [
      `わたちゃんで${data.headerLabel}をやってみた！`,
      `${data.names.guesser}は${data.names.target}の答えを${data.score}/${data.total}問正解。`,
      `称号は「${data.title}」。`,
      '',
      'みんなは何問当たる？👇',
      `#わたちゃん ${hashTag}`,
      resultPublicUrl(),
    ].join('\n');
  }

  function isMobileLike() {
    const ua = navigator.userAgent || '';
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || coarse;
  }

  function openLineShare(message) {
    return openLineSharePlatform(message);
  }

  function openXShare(message) {
    return openXSharePlatform(message);
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {}
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function splitCanvasText(text, maxLength = 14) {
    const value = String(text || '');
    if (value.length <= maxLength) return [value];
    const lines = [];
    for (let i = 0; i < value.length; i += maxLength) lines.push(value.slice(i, i + maxLength));
    return lines.slice(0, 3);
  }

  function drawCanvasLines(ctx, lines, x, y, lineHeight) {
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function saveImageBlob(blob, filename, title) {
    return saveImageBlobPlatform(blob, filename, title);
  }

  async function createResultCanvas(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const girlImg = await loadImage(RESULT_GIRL_IMAGE_SRC);
    const qrImg = await loadImage(RESULT_QR_IMAGE_SRC);

    ctx.fillStyle = '#ec4f88';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 70, 80, 940, 1210, 38);
    ctx.fill();

    ctx.fillStyle = '#fff';
    roundRect(ctx, 88, 98, 904, 1172, 30);
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 88, 98, 904, 120, 30);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 32px "DotGothic16", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(data.headerLabel, 132, 170);

    ctx.fillStyle = data.tier.tagBg;
    roundRect(ctx, 742, 126, 190, 54, 27);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    roundRect(ctx, 742, 126, 190, 54, 27);
    ctx.stroke();
    ctx.fillStyle = data.tier.tagColor;
    ctx.font = '900 23px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.tier.tag, 837, 161);

    ctx.fillStyle = '#fff8f1';
    roundRect(ctx, 142, 265, 796, 330, 30);
    ctx.fill();
    ctx.strokeStyle = '#ec4f88';
    ctx.setLineDash([18, 16]);
    ctx.lineWidth = 6;
    roundRect(ctx, 142, 265, 796, 330, 30);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ec4f88';
    ctx.font = `900 ${data.scoreLabel.length >= 13 ? 27 : 32}px "Zen Maru Gothic", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(data.scoreLabel, 205, 350);
    ctx.font = '900 122px "RocknRoll One", sans-serif';
    ctx.shadowColor = '#1a1a1a';
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;
    ctx.fillText(`${data.score}/${data.total}`, 205, 486);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#ffe26b';
    roundRect(ctx, 212, 505, 140, 48, 24);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    roundRect(ctx, 212, 505, 140, 48, 24);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '900 24px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('問正解', 282, 537);

    ctx.fillStyle = '#5bd4e8';
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(760, 416, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (girlImg) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.18)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(girlImg, 638, 286, 238, 284);
      ctx.restore();
    } else {
      ctx.font = '900 82px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.fillText(data.tier.emoji || '♡', 760, 450);
    }

    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, 408, 632, 264, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffe26b';
    ctx.font = '900 26px "Zen Maru Gothic", sans-serif';
    ctx.fillText('今日の称号', 540, 662);

    ctx.fillStyle = '#ec4f88';
    const titleLines = splitCanvasText(data.title, 11);
    ctx.font = `900 ${titleLines.length > 1 ? 48 : 54}px "RocknRoll One", sans-serif`;
    drawCanvasLines(ctx, titleLines, 540, 740, 58);

    ctx.fillStyle = '#fff';
    roundRect(ctx, 150, 815, 780, 250, 26);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 6;
    roundRect(ctx, 150, 815, 780, 250, 26);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '900 32px "Zen Maru Gothic", sans-serif';
    const messageLines = String(data.message || '').split('\n').flatMap((line) => splitCanvasText(line, 20)).slice(0, 4);
    drawCanvasLines(ctx, messageLines, 540, 875, 46);

    ctx.fillStyle = '#ffe26b';
    roundRect(ctx, 156, 1094, 768, 132, 26);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    roundRect(ctx, 156, 1094, 768, 132, 26);
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '900 28px "Zen Maru Gothic", sans-serif';
    ctx.fillText('この結果、友達に伝えよう', 448, 1134);
    ctx.fillStyle = '#d63a75';
    ctx.font = '900 22px "Zen Maru Gothic", sans-serif';
    ctx.fillText('あなたなら何問当てられる？', 448, 1168);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '900 22px "DotGothic16", monospace';
    ctx.fillText('streetboardgame.com  /  #わたちゃん', 448, 1202);
    if (qrImg) {
      ctx.fillStyle = '#fff';
      roundRect(ctx, 776, 1106, 108, 108, 18);
      ctx.fill();
      ctx.drawImage(qrImg, 784, 1114, 92, 92);
    }

    return canvas;
  }

  function oppositeSide(side) {
    return side === 'girl' ? 'boy' : 'girl';
  }

  function roleFromSide(room, side) {
    const names = targetAndGuesser(room);
    return side === names.targetSide ? 'target' : 'guesser';
  }

  function roleForParticipant(room, participant) {
    const creatorSide = room && room.creatorSide === 'girl' ? 'girl' : 'boy';
    const side = participant === 'creator' ? creatorSide : oppositeSide(creatorSide);
    return roleFromSide(room, side);
  }

  function activeRole(room = state) {
    if (!room) return '';
    if (room.phase === 'target') return 'target';
    if (room.phase === 'guess') return 'guesser';
    return '';
  }

  function turnPlayerName(room = state) {
    const names = targetAndGuesser(room);
    return activeRole(room) === 'target' ? names.target : names.guesser;
  }

  function roomInviteUrl(nextRole = activeRole(), nextToken = turnToken) {
    const url = new URL(remotePath(), window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', nextRole);
    url.searchParams.set('turn', nextToken);
    if (manageToken) url.searchParams.set('manage', manageToken);
    return url.toString();
  }

  function senderStateUrl(viewerRole = role, nextRole = handoffRole, nextToken = turnToken) {
    const url = new URL(remotePath(), window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', viewerRole);
    url.searchParams.set('next', nextRole);
    url.searchParams.set('turn', nextToken);
    url.searchParams.set('handoff', '1');
    if (manageToken) url.searchParams.set('manage', manageToken);
    return url.toString();
  }

  function remoteAccessQuery(accessRole, accessToken, isSender, nextRole) {
    const params = new URLSearchParams();
    if (accessRole === 'target' || accessRole === 'guesser') params.set('role', accessRole);
    if (accessToken) params.set('turn', accessToken);
    if (isSender) {
      params.set('handoff', '1');
      if (nextRole === 'target' || nextRole === 'guesser') params.set('next', nextRole);
    }
    return params.toString();
  }

  function replaceRemoteUrl() {
    if (!roomCode) return;
    if (state && state.phase === 'result') {
      const resultSuffix = resultReturnMode ? '&result=1' : '';
      const manageSuffix = manageToken ? `&manage=${manageToken}` : '';
      window.history.replaceState(null, '', `${remotePath()}?room=${roomCode}&role=${role}${resultSuffix}${manageSuffix}`);
      saveRecovery();
      return;
    }
    if (handoffMode && handoffRole && turnToken) {
      window.history.replaceState(null, '', senderStateUrl());
      saveRecovery();
      return;
    }
    if (role && turnToken) {
      window.history.replaceState(null, '', roomInviteUrl(role, turnToken));
      saveRecovery();
      return;
    }
    window.history.replaceState(null, '', `${remotePath()}?room=${roomCode}&role=${role}`);
    saveRecovery();
  }

  function setFreshTurnAccess() {
    const nextRole = activeRole(state);
    if (!nextRole || !turnToken) {
      handoffMode = false;
      handoffRole = '';
      return;
    }
    handoffMode = role !== nextRole;
    handoffRole = handoffMode ? nextRole : '';
  }

  function discardStaleTurnAccess() {
    const nextRole = activeRole(state);
    const validHandoff = handoffMode && handoffRole === nextRole;
    const validAnswer = !handoffMode && role === nextRole;
    if (turnToken && !validHandoff && !validAnswer) {
      turnToken = '';
      handoffMode = false;
      handoffRole = '';
      replaceRemoteUrl();
    }
  }

  async function copyInviteText(text) {
    return copyText(text);
  }

  function buildInviteText() {
    if (!roomCode || !state) return;
    const names = targetAndGuesser(state);
    if (isBoardgame()) {
      if (state.phase === 'guess') {
        return [
          `${names.guesser}へ。${names.target}との「ボドゲ仲間の絆判定」に挑戦してね🎲`,
          '',
          `${names.target}は、ボドゲのお題5問に自分の答えを選び終えました。`,
          `あなたは、${names.target}が何と答えたかを予想して5問に回答してください。`,
          '何問当てられるかで、ボドゲ仲間としての理解度を判定します。',
          '',
          roomInviteUrl(),
        ].join('\n');
      }
      return [
        `${names.target}へ。${names.guesser}は、あなたがボドゲのお題に何と答えるか5問の予想を終えました。`,
        '',
        'URLで表示されるボドゲのお題5問に、あなた自身の答えを選んでください。',
        `5問終わると、その場で${names.guesser}があなたのボドゲの好みをどれだけ理解しているか判定します。`,
        '',
        roomInviteUrl(),
      ].join('\n');
    }
    if (state.phase === 'guess') {
      return [
        `${names.guesser}へ。${names.target}との2人の理解度判定に挑戦してね！`,
        '',
        `${names.target}は、URLで表示される5問に自分の答えを選び終えました。`,
        `あなたは、${names.target}が何と答えたかを予想して5問に回答してください。`,
        `何問当てられるかで、あなたが${names.target}をどれだけ理解しているか判定します。`,
        '',
        roomInviteUrl(),
      ].join('\n');
    }
    return [
      `${names.target}へ。${names.guesser}は、あなたが何と答えるか5問の予想を終えました。`,
      '',
      'URLで表示される5問に、あなた自身の答えを選んでください。',
      `5問終わると、その場で${names.guesser}があなたをどれだけ理解しているか判定します。`,
      '',
      roomInviteUrl(),
    ].join('\n');
  }

  function resultRoomUrl(recipientRole = oppositeRole(role), includeManage = true) {
    const url = new URL(remotePath(), window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', recipientRole);
    url.searchParams.set('result', '1');
    if (isBoardgame()) url.searchParams.set('share', REMOTE_BOARDGAME_RESULT_SHARE_VERSION);
    if (includeManage && manageToken) url.searchParams.set('manage', manageToken);
    return url.toString();
  }

  function buildResultReturnText() {
    if (!latestResult || !roomCode) return '';
    const recipientRole = oppositeRole(role);
    const recipientName = recipientRole === 'target' ? latestResult.names.target : latestResult.names.guesser;
    return [
      `${recipientName}へ。遠隔プレイの判定結果が出ました。`,
      `${latestResult.names.guesser}が${latestResult.names.target}の答えを${latestResult.score}/${latestResult.total}問当てました。`,
      `称号は「${latestResult.title}」です。`,
      '判定結果と答え合わせはこちら',
      resultRoomUrl(recipientRole),
    ].join('\n');
  }

  async function sendResultBackByLine() {
    const text = buildResultReturnText();
    if (!text) return;
    await copyInviteText(text);
    trackRemoteShare('line', 'result_return');
    openLineShare(text);
  }

  async function copyResultReturnText(button) {
    const text = buildResultReturnText();
    if (!text) return;
    const original = button.textContent;
    const copied = await copyInviteText(text);
    if (!copied) {
      window.prompt('この結果文とURLを相手に送ってください', text);
      return;
    }
    trackRemoteShare('copy', 'result_return');
    button.textContent = 'コピーしました';
    window.setTimeout(() => {
      button.textContent = original;
    }, 1800);
  }

  async function shareRoomByLine() {
    const text = buildInviteText();
    if (!text) return;
    await copyInviteText(text);
    trackRemoteShare('line', 'room_invite');
    window.location.href = `line://msg/text/${encodeURIComponent(text)}`;
  }

  async function copyRoomInviteUrl(button) {
    const text = buildInviteText();
    if (!text) return;
    const targetButton = button || $('copyRoomUrl');
    const original = targetButton.textContent;
    const copied = await copyInviteText(text);
    if (!copied) {
      window.prompt('このルームをコピーして相手に送ってください', roomInviteUrl());
      return;
    }
    trackRemoteShare('copy', 'room_invite');
    targetButton.textContent = 'コピーしました';
    window.setTimeout(() => {
      targetButton.textContent = original;
    }, 1800);
  }

  function sideLabel(room, side) {
    const players = room && room.players ? room.players : {};
    if (side === 'girl') return players.girl || '相手';
    return players.boy || '私';
  }

  async function createRoom() {
    if (busy) return;
    const selfName = requiredName($('selfName'), '私の名前');
    if (!selfName) return;
    const otherName = requiredName($('otherName'), '相手の名前');
    if (!otherName) return;
    setBusy(true);
    try {
      const creatorRole = $('creatorRole').value === 'guesser' ? 'guesser' : 'target';
      const creatorSide = 'boy';
      const loveMode = creatorRole === 'target' ? 'boyTarget' : 'girlTarget';
      const players = {
        girl: otherName,
        boy: selfName,
      };
      const cards = pickCards();
      const created = await api('/api/remote/rooms', {
        method: 'POST',
        body: JSON.stringify({ type: currentGameType(), loveMode, players, creatorSide, cards }),
      });
      roomCode = created.code;
      state = created.room;
      turnToken = normalizeTurnToken(created.nextTurnToken);
      manageToken = normalizeManageToken(created.manageToken);
      saveRole(roomCode, roleForParticipant(state, 'creator'));
      setFreshTurnAccess();
      markSwapSeen(roomCode, state.roleSwapNonce);
      trackRemoteEvent('game_start', {
        game_type: isBoardgame() ? 'boardgame' : 'remote',
        play_mode: 'remote',
        player_count: 2,
        question_count: cards.length,
        role_mode: creatorRole,
      });
      render();
      replaceRemoteUrl();
    } catch (e) {
      alert(e.message || 'ルーム作成に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(codeValue, participant = '', linkRole = '', handoffToken = '', isSender = false, nextRole = '', linkManageToken = '') {
    if (busy) return;
    const code = normalizeCode(codeValue || $('joinCode').value);
    if (code.length !== 6) {
      alert('6桁のルームコードを入力してください');
      return;
    }
    setBusy(true);
    try {
      const recovery = loadRecovery(code);
      manageToken = normalizeManageToken(linkManageToken)
        || normalizeManageToken(recovery && recovery.manageToken);
      const recoveredRole = recovery && recovery.role ? recovery.role : '';
      let effectiveRole = linkRole || recoveredRole;
      let effectiveToken = handoffToken || (recovery && recovery.turnToken ? recovery.turnToken : '');
      let effectiveIsSender = handoffToken ? isSender : Boolean(recovery && recovery.handoffMode);
      let effectiveNextRole = handoffToken
        ? nextRole
        : recovery && recovery.handoffRole ? recovery.handoffRole : '';
      let accessQuery = remoteAccessQuery(effectiveRole, effectiveToken, effectiveIsSender, effectiveNextRole);
      let loaded = await api(`/api/remote/rooms/${code}${accessQuery ? `?${accessQuery}` : ''}`);
      const canRetryRecovery = handoffToken
        && loaded.turnAccess !== true
        && recovery
        && recovery.turnToken
        && recovery.turnToken !== handoffToken;
      if (canRetryRecovery) {
        effectiveRole = recoveredRole;
        effectiveToken = recovery.turnToken;
        effectiveIsSender = recovery.handoffMode;
        effectiveNextRole = recovery.handoffRole;
        accessQuery = remoteAccessQuery(effectiveRole, effectiveToken, effectiveIsSender, effectiveNextRole);
        loaded = await api(`/api/remote/rooms/${code}${accessQuery ? `?${accessQuery}` : ''}`);
      }
      roomCode = code;
      state = loaded.room;
      if (Number(state && state.version || 0) < 4) {
        throw new Error('このルームは旧方式です。新しいルームを作り直してください。');
      }
      const linkedRole = effectiveRole === 'target' || effectiveRole === 'guesser' ? effectiveRole : '';
      if (linkedRole) {
        saveRole(roomCode, linkedRole);
      } else if (participant === 'creator' || participant === 'joiner') {
        saveRole(roomCode, roleForParticipant(state, participant));
      } else {
        loadRole(roomCode);
        if (!role) saveRole(roomCode, roleForParticipant(state, 'joiner'));
      }
      turnToken = normalizeTurnToken(effectiveToken);
      handoffMode = Boolean(effectiveIsSender && turnToken);
      handoffRole = handoffMode && (effectiveNextRole === 'target' || effectiveNextRole === 'guesser')
        ? effectiveNextRole
        : '';
      if (turnToken && loaded.turnAccess !== true) {
        turnToken = '';
        handoffMode = false;
        handoffRole = '';
      }
      discardStaleTurnAccess();
      markSwapSeen(roomCode, state.roleSwapNonce);
      render();
      replaceRemoteUrl();
    } catch (e) {
      alert(e.message || 'ルームが見つかりません');
    } finally {
      setBusy(false);
    }
  }

  async function updateRoom(patch) {
    if (!roomCode || !state) return;
    const updated = await api(`/api/remote/rooms/${roomCode}`, {
      method: 'POST',
      body: JSON.stringify({ patch, manageToken }),
    });
    state = updated.room;
    if (Object.prototype.hasOwnProperty.call(updated, 'nextTurnToken')) {
      turnToken = normalizeTurnToken(updated.nextTurnToken);
    }
    syncRoleSwap();
    setFreshTurnAccess();
    replaceRemoteUrl();
    render();
    return updated;
  }

  async function chooseAnswer(index) {
    if (!state || !roomCode || sendingChoice) return;
    const room = state;
    const expectedRole = activeRole(room);
    if (role !== expectedRole || !turnToken) return;

    markChoiceSending(index);
    try {
      const updated = await api(`/api/remote/rooms/${roomCode}/choose`, {
        method: 'POST',
        body: JSON.stringify({
          choice: Number(index),
          role,
          turnToken,
        }),
      });
      state = updated.room;
      turnToken = normalizeTurnToken(updated.nextTurnToken);
      if (state && state.phase === 'result') {
        const resultAnswers = Array.isArray(state.answers) ? state.answers : [];
        trackRemoteEvent('game_result', {
          game_type: isBoardgame() ? 'boardgame' : 'remote',
          play_mode: 'remote',
          player_count: 2,
          question_count: resultAnswers.length || 5,
          score: countMatches(resultAnswers),
          role_mode: state.loveMode || '',
        });
      }
      setFreshTurnAccess();
      replaceRemoteUrl();
      sendingChoice = false;
      render();
    } catch (e) {
      sendingChoice = false;
      pendingChoice = null;
      render();
      alert(e.message || '送信に失敗しました。もう一度選んでください。');
    }
  }

  function markChoiceSending(index) {
    sendingChoice = true;
    pendingChoice = {
      roomCode,
      qIdx: Number(state && state.qIdx || 0),
      phase: state && state.phase,
      choice: Number(index),
    };
    document.querySelectorAll('[data-choice]').forEach((button) => {
      const selected = Number(button.dataset.choice) === Number(index);
      button.disabled = true;
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-waiting', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function selectedChoiceForCurrentView(qIdx, phase) {
    if (!state) return null;
    if (sendingChoice && pendingChoice && pendingChoice.roomCode === roomCode && pendingChoice.qIdx === qIdx) {
      return {
        choice: pendingChoice.choice,
        mode: pendingChoice.phase === phase ? 'waiting' : 'locked',
      };
    }
    return null;
  }

  function currentCard() {
    if (!state || !Array.isArray(state.cards)) return null;
    return state.cards[state.qIdx || 0] || null;
  }

  function renderRoomCard() {
    if (!state || !roomCode) return;
    const names = targetAndGuesser(state);
    $('roomCode').textContent = roomCode;
    $('roomNames').textContent = `${names.target}の答えを、${names.guesser}が当てるルーム`;
    $('targetRoleName').textContent = names.target;
    $('guesserRoleName').textContent = names.guesser;
    const creatorSide = state.creatorSide || 'boy';
    const joinerSide = oppositeSide(creatorSide);
    const yourSide = role === roleFromSide(state, creatorSide) ? creatorSide : joinerSide;
    $('roleStatus').textContent = role
      ? `あなたは「${sideLabel(state, yourSide)}」として参加中です。相手は「${sideLabel(state, oppositeSide(yourSide))}」です。`
      : 'ルーム設定を読み込み中です。';
  }

  function renderBoardgameQuestionCard(card) {
    const choices = Array.isArray(card && card.choices) ? card.choices : [];
    const title = String(card && card.title ? card.title : 'お題');
    const titleLines = title.length <= 9
      ? [title]
      : [title.slice(0, Math.ceil(title.length / 2)), title.slice(Math.ceil(title.length / 2))];
    const lineYs = [40, 113, 186, 260, 333, 407, 480, 553, 627, 701, 773, 848, 922, 996, 1068];
    const choiceRows = [3, 5, 7, 9, 11];
    const choiceYs = choiceRows.map((row) => Math.round((lineYs[row] + lineYs[row + 1]) / 2));
    const holes = [36, 120, 204, 288, 372, 456, 540, 624, 708];
    return `
      <div class="boardgame-question-card" role="group" aria-label="${escapeHtml(title)}">
        <svg viewBox="0 0 756 1122" width="756" height="1122" role="img" aria-hidden="true">
          <rect width="756" height="1122" fill="#FFFFFF"></rect>
          ${holes.map((x) => `<circle cx="${x}" cy="-12" r="31" fill="#EC4F88" opacity="0.96"></circle>`).join('')}
          <line x1="134" y1="0" x2="134" y2="1122" stroke="rgba(236,79,136,0.18)" stroke-width="2.5"></line>
          ${lineYs.map((y) => `<line x1="0" y1="${y}" x2="756" y2="${y}" stroke="rgba(91,212,232,0.34)" stroke-width="4"></line>`).join('')}
          <rect x="68" y="57" width="620" height="150" fill="rgba(91,212,232,0.68)"></rect>
          <rect x="68" y="57" width="620" height="150" fill="#5BD4E8" opacity="0.34"></rect>
          <g class="boardgame-question-title" fill="#1A1A1A" text-anchor="middle">
            ${titleLines.map((line, index) => `
              <text
                x="378"
                y="${titleLines.length === 1 ? 150 : 126 + index * 48}"
                font-size="${titleLines.length === 1 ? 44 : 40}"
                dominant-baseline="middle"
              >${escapeHtml(line)}</text>
            `).join('')}
          </g>
          ${choices.map((choice, index) => {
            const color = window.COLOR_OPTIONS && window.COLOR_OPTIONS[index] ? window.COLOR_OPTIONS[index].color : '#ccc';
            const text = String(choice || '');
            const fontSize = text.length >= 12 ? 32 : text.length >= 8 ? 36 : 40;
            return `
              <g class="boardgame-card-choice">
                <circle cx="77" cy="${choiceYs[index]}" r="41" fill="${color}" filter="url(#remoteBoardgameDotShadow)"></circle>
                <text
                  x="406"
                  y="${choiceYs[index] + 2}"
                  font-size="${fontSize}"
                  fill="#1A1A1A"
                  dominant-baseline="middle"
                  text-anchor="middle"
                >${escapeHtml(text)}</text>
              </g>
            `;
          }).join('')}
          <defs>
            <filter id="remoteBoardgameDotShadow" x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000000" flood-opacity="0.24"></feDropShadow>
            </filter>
            <linearGradient id="remoteBoardgameCurl" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#DDDDDD"></stop>
              <stop offset="0.45" stop-color="#FFFFFF"></stop>
              <stop offset="1" stop-color="#CFCFCF"></stop>
            </linearGradient>
          </defs>
          <path d="M690 920 C725 930 746 1004 736 1122 L652 1122 C668 1055 676 982 690 920 Z" fill="url(#remoteBoardgameCurl)" opacity="0.9"></path>
          <path d="M680 932 C715 952 730 1014 724 1122" stroke="rgba(0,0,0,0.10)" stroke-width="4" fill="none"></path>
        </svg>
      </div>
    `;
  }

  function renderPlay() {
    if (!state) return;
    const names = targetAndGuesser(state);
    const card = currentCard();
    if (!card) return;
    const qIdx = Number(state.qIdx || 0);
    const q = qIdx + 1;
    const total = (state.cards || []).length;
    const isTargetTurn = state.phase === 'target';
    const isGuesserTurn = state.phase === 'guess';
    const yourRoleTurn = (isTargetTurn && role === 'target') || (isGuesserTurn && role === 'guesser');
    const canChoose = yourRoleTurn && !handoffMode && Boolean(turnToken);
    const canHandOff = handoffMode && handoffRole === activeRole(state) && Boolean(turnToken);
    const missingTurnAccess = yourRoleTurn && !handoffMode && !turnToken;
    const selectedChoice = selectedChoiceForCurrentView(qIdx, state.phase);
    if (!selectedChoice) {
      sendingChoice = false;
      pendingChoice = null;
    } else if (selectedChoice.mode === 'locked') {
      sendingChoice = false;
    }
    const currentPlayer = turnPlayerName(state);
    $('turnTitle').textContent = `Q${q}/${total} ${canChoose ? 'あなたの番' : canHandOff ? `次は${currentPlayer}の番` : missingTurnAccess ? '回答用URLを確認' : '相手の番'}`;
    if (isTargetTurn) {
      $('turnNote').textContent = canChoose
        ? `${names.guesser}に見せずに、${names.target}が自分の答えを選んでください。5問続けて回答します。`
        : canHandOff
          ? `${currentPlayer}に、5問まとめて回答できるURLを送ってください。`
          : missingTurnAccess
            ? '回答権を確認できませんでした。LINEで届いた最新のURLを開き直してください。'
          : `${names.target}が答えを選んでいます。LINEで届くURLを待ってね。`;
    } else {
      $('turnNote').textContent = canChoose
        ? state.targetComplete
          ? `${names.target}が何を選んだか予想してください。5問続けて回答します。`
          : `${names.target}が何を選びそうか予想してください。相手はこのあと5問回答します。`
        : canHandOff
          ? `${currentPlayer}に、5問まとめて回答できるURLを送ってください。`
          : missingTurnAccess
            ? '回答権を確認できませんでした。LINEで届いた最新のURLを開き直してください。'
          : `${names.guesser}が予想しています。LINEで届くURLを待ってね。`;
    }
    $('questionWrap').innerHTML = isBoardgame()
      ? renderBoardgameQuestionCard(card)
      : `<img class="question-img" src="${card.image}" alt="${escapeHtml(card.title || 'お題カード')}">`;
    setHidden('questionWrap', !canChoose);
    const choices = Array.isArray(card.choices) ? card.choices : [];
    const choicesEl = $('choices');
    const choicesEnabled = canChoose && !selectedChoice;
    choicesEl.classList.toggle('is-guess', isGuesserTurn);
    choicesEl.classList.toggle('is-waiting', !canChoose);
    choicesEl.classList.toggle('has-selection', Boolean(selectedChoice));
    choicesEl.classList.toggle('can-choose', choicesEnabled);
    setHidden('choices', !choicesEnabled);
    setHidden('handoff', !canHandOff);
    $('play').classList.toggle('has-choices', choicesEnabled);
    if (canHandOff) {
      $('handoffTitle').textContent = `5問回答できました。次は${currentPlayer}の番です`;
      $('handoffLine').textContent = `LINEで${currentPlayer}に送る`;
    }
    choicesEl.innerHTML = choices.map((choice, index) => {
      const color = window.COLOR_OPTIONS && window.COLOR_OPTIONS[index] ? window.COLOR_OPTIONS[index].color : '#ccc';
      const selected = selectedChoice && Number(selectedChoice.choice) === Number(index);
      const selectedClass = selected ? (selectedChoice.mode === 'waiting' ? ' is-selected is-waiting' : ' is-locked') : '';
      const disabled = choicesEnabled ? '' : 'disabled';
      const colorName = COLOR_NAMES[index] || choice || '';
      return `
        <button class="choice${selectedClass}" data-choice="${index}" ${disabled} aria-pressed="${selected ? 'true' : 'false'}" aria-label="${escapeHtml(`${colorName}：${choice || ''}`)}">
          <span class="dot" style="background:${color}"></span>
          <span>${escapeHtml(colorName)}</span>
        </button>
      `;
    }).join('');
    if (choicesEnabled) {
      document.querySelectorAll('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => chooseAnswer(Number(button.dataset.choice)));
      });
    }
  }

  function shouldShowRoomCard() {
    return false;
  }

  function scrollPlayIntoViewIfNeeded() {
    if (!state || state.phase === 'result' || !role) return;
    const qIdx = Number(state.qIdx || 0);
    const key = `${roomCode}:${qIdx}:${state.phase}:${role}`;
    if (key === lastPlayViewKey) return;
    lastPlayViewKey = key;
    window.requestAnimationFrame(() => {
      const play = $('play');
      if (!play || play.classList.contains('hidden')) return;
      const rect = play.getBoundingClientRect();
      const top = Math.max(0, window.scrollY + rect.top - 12);
      window.scrollTo({ top, left: 0, behavior: 'smooth' });
    });
  }

  function renderResult() {
    if (!state) return;
    sendingChoice = false;
    turnToken = '';
    handoffMode = false;
    handoffRole = '';
    replaceRemoteUrl();
    const names = targetAndGuesser(state);
    const answers = Array.isArray(state.answers) ? state.answers : [];
    const total = answers.length || 5;
    const score = countMatches(answers);
    const tier = getTier(score);
    const title = personalizeLoveText(tier.title, names);
    const message = personalizeLoveText(tier.msg, names);
    const headerLabel = loveResultHeaderLabel(names);
    const scoreLabel = loveScoreLabel(names);
    latestResult = { names, answers, total, score, tier, title, message, headerLabel, scoreLabel };

    $('resultGameTitle').textContent = headerLabel;
    $('resultTag').textContent = tier.tag;
    $('resultTag').style.background = tier.tagBg;
    $('resultTag').style.color = tier.tagColor;
    $('scoreLabel').textContent = scoreLabel;
    $('score').textContent = `${score}/${total}`;
    $('resultTitle').textContent = title;
    $('scoreText').textContent = message;
    $('answerSummary').innerHTML = answers.map((answer, index) => `
      <div class="answer-chip ${answer.match ? 'hit' : ''}">
        <span>Q${index + 1}</span>
        <span>${answer.match ? '♡' : '×'}</span>
      </div>
    `).join('');
    $('answerDetails').innerHTML = answers.map((answer, index) => {
      const card = state.cards[index] || {};
      const targetChoice = card.choices && card.choices[answer.target] ? card.choices[answer.target] : COLOR_NAMES[answer.target];
      const guessChoice = card.choices && card.choices[answer.guess] ? card.choices[answer.guess] : COLOR_NAMES[answer.guess];
      const targetColor = window.COLOR_OPTIONS && window.COLOR_OPTIONS[answer.target] ? window.COLOR_OPTIONS[answer.target].color : '#ccc';
      const guessColor = window.COLOR_OPTIONS && window.COLOR_OPTIONS[answer.guess] ? window.COLOR_OPTIONS[answer.guess].color : '#ccc';
      return `
        <div class="answer-row ${answer.match ? 'is-hit' : ''}">
          <div class="answer-head">
            <span class="answer-q">Q${index + 1}</span>
            <span class="answer-title">${escapeHtml(card.title || 'お題')}</span>
            <span class="answer-badge">${answer.match ? '当たり' : 'ハズレ'}</span>
          </div>
          <div class="answer-body">
            <div class="answer-pick target">
              <div class="answer-name">${escapeHtml(names.target)}</div>
              <div class="answer-choice">
                <span class="answer-mini-dot" style="background:${targetColor}"></span>
                <span>${escapeHtml(targetChoice || '')}</span>
              </div>
            </div>
            <div class="answer-pick guesser">
              <div class="answer-name">${escapeHtml(names.guesser)}</div>
              <div class="answer-choice">
                <span class="answer-mini-dot" style="background:${guessColor}"></span>
                <span>${escapeHtml(guessChoice || '')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    const reviewLines = getRemoteReviewLines(answers, state.cards || [], names, title);
    $('resultReviewLines').innerHTML = reviewLines
      .map((line) => `<div>${escapeHtml(line)}</div>`)
      .join('');
    const recipientRole = oppositeRole(role);
    const recipientName = recipientRole === 'target' ? names.target : names.guesser;
    setHidden('resultReturn', resultReturnMode || !role);
    setHidden('replaySameRoom', !manageToken);
    setHidden('replaySwapRoles', !manageToken);
    $('resultReturnTitle').textContent = `${recipientName}に判定結果を返す`;
    $('resultReturnLine').textContent = `LINEで${recipientName}に結果を返す`;
    $('amazonProductCard').href = BOARD_GAME_PRODUCT.amazonUrl;
    $('amazonProductBadge').textContent = BOARD_GAME_PRODUCT.badge;
    $('amazonProductTitle').textContent = BOARD_GAME_PRODUCT.title;
    $('amazonProductDescription').textContent = BOARD_GAME_PRODUCT.description;
    $('amazonProductCta').textContent = BOARD_GAME_PRODUCT.cta;
    $('amazonProductDisclosure').textContent = BOARD_GAME_PRODUCT.disclosure;
  }

  function shareResultLine() {
    if (!latestResult) return;
    trackRemoteShare('line');
    openLineShare(resultShareText(latestResult, 'line'));
  }

  function shareResultX() {
    if (!latestResult) return;
    trackRemoteShare('x');
    openXShare(resultShareText(latestResult, 'x'));
  }

  async function saveResultImage() {
    if (!latestResult || busy) return;
    setBusy(true);
    const button = $('saveResultImage');
    const originalText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = '画像を準備中...';
    }
    try {
      const canvas = await createResultCanvas(latestResult);
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error('画像の作成に失敗しました');
      await saveImageBlob(
        blob,
        `watachan-${isBoardgame() ? 'boardgame-remote' : 'love'}-result-${latestResult.score}-${latestResult.total}.png`,
        isBoardgame() ? 'わたちゃん ボドゲ仲間の絆判定画像' : 'わたちゃん 判定画像'
      );
      trackRemoteShare('image');
    } catch (e) {
      alert(e.message || '画像の保存に失敗しました。もう一度試してください。');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
      setBusy(false);
    }
  }

  function replayPatch(swapRoles) {
    const nextRole = swapRoles ? oppositeRole(role) : role;
    const patch = {
      cards: pickCards(),
      qIdx: 0,
      phase: nextRole === 'guesser' ? 'guess' : 'target',
      targetAnswers: [],
      guessAnswers: [],
      answers: [],
      updatedBy: role,
    };
    if (swapRoles) {
      patch.loveMode = oppositeLoveMode(state && state.loveMode);
      patch.roleSwapNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return patch;
  }

  async function replayRoom(swapRoles) {
    if (!state || !roomCode || busy) return;
    setBusy(true);
    sendingChoice = false;
    pendingChoice = null;
    latestResult = null;
    resultReturnMode = false;
    try {
      await updateRoom(replayPatch(Boolean(swapRoles)));
      trackRemoteEvent('game_start', {
        game_type: isBoardgame() ? 'boardgame' : 'remote',
        play_mode: 'remote',
        player_count: 2,
        question_count: Array.isArray(state && state.cards) ? state.cards.length : 5,
        replay_mode: swapRoles ? 'swap_roles' : 'same_roles',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      alert(e.message || 'もう一度プレイする準備に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  function render() {
    const hasRoom = Boolean(state && roomCode);
    const canPlay = hasRoom && Boolean(role);
    setHidden('setup', hasRoom);
    setHidden('joinPanel', true);
    setHidden('room', !hasRoom || !shouldShowRoomCard());
    setHidden('play', !canPlay || state.phase === 'result');
    setHidden('result', !hasRoom || state.phase !== 'result');
    if (!hasRoom) return;
    renderRoomCard();
    if (state.phase === 'result') renderResult();
    else {
      renderPlay();
      scrollPlayIntoViewIfNeeded();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function init() {
    if (INITIAL_GAME_TYPE === 'boardgame') {
      document.title = '遠隔でボドゲ仲間の絆判定 | わたちゃん';
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = 'https://www.streetboardgame.com/remote-boardgame';
      const description = '離れているボドゲ仲間と2人で遊べる無料の絆判定ゲーム。5問のボードゲームのお題にそれぞれ回答し、相手の好みをどれだけ理解しているかチェックできます。';
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.content = description;
      $('remoteHeroTitle').innerHTML = '遠隔で<br>ボドゲ仲間の絆判定';
      $('remoteHeroLead').textContent = '離れているボドゲ仲間と2人で、LINEを使って遊べます。';
      $('remoteGuideTitle').textContent = 'ボドゲ仲間の絆判定とは？';
      $('remoteGuideLead').textContent = '5問のボードゲームのお題を出題し、どちらか1人が選ぶ答えを、もう1人がどれだけ当てられるかで理解度を判定するゲームです。2人が同じ場所にいなくても、それぞれのスマホから回答できます。';
      $('resultGameTitle').textContent = 'ボドゲ仲間の絆判定';
    }
    ['selfName', 'otherName'].forEach((id) => {
      $(id).addEventListener('input', (event) => {
        event.currentTarget.setCustomValidity('');
        updateCreateButtonState();
      });
    });
    updateCreateButtonState();
    $('createRoom').addEventListener('click', createRoom);
    $('joinRoom').addEventListener('click', () => joinRoom(null, 'joiner'));
    $('shareRoomLine').addEventListener('click', shareRoomByLine);
    $('copyRoomUrl').addEventListener('click', (event) => copyRoomInviteUrl(event.currentTarget));
    $('handoffLine').addEventListener('click', shareRoomByLine);
    $('copyTurnUrl').addEventListener('click', (event) => copyRoomInviteUrl(event.currentTarget));
    $('resultReturnLine').addEventListener('click', sendResultBackByLine);
    $('copyResultReturn').addEventListener('click', (event) => copyResultReturnText(event.currentTarget));
    $('shareResultLine').addEventListener('click', shareResultLine);
    $('shareResultX').addEventListener('click', shareResultX);
    $('saveResultImage').addEventListener('click', saveResultImage);
    $('replaySameRoom').addEventListener('click', () => replayRoom(false));
    $('replaySwapRoles').addEventListener('click', () => replayRoom(true));
    $('remoteTop').addEventListener('click', () => {
      window.location.href = '/';
    });
    $('joinCode').addEventListener('input', (e) => {
      e.target.value = normalizeCode(e.target.value);
    });
    const params = new URLSearchParams(location.search);
    resultReturnMode = params.get('result') === '1';
    const code = normalizeCode(params.get('room'));
    if (code) {
      $('joinCode').value = code;
      const participant = params.get('p') === 'creator' ? 'creator' : params.get('p') === 'joiner' ? 'joiner' : '';
      const linkRole = params.get('role') === 'target' || params.get('role') === 'guesser' ? params.get('role') : '';
      const nextRole = params.get('next') === 'target' || params.get('next') === 'guesser' ? params.get('next') : '';
      const handoffToken = normalizeTurnToken(params.get('turn'));
      const linkManageToken = normalizeManageToken(params.get('manage'));
      const isSender = params.get('handoff') === '1';
      joinRoom(code, participant, linkRole, handoffToken, isSender, nextRole, linkManageToken);
    } else {
      render();
    }
  }

  init();
})();
