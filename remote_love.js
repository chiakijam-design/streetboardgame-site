(function () {
  const ROOM_STORAGE_KEY = 'watachan-remote-love-role-v3';
  const ROOM_SWAP_STORAGE_KEY = 'watachan-remote-love-role-swap-v1';
  const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];
  const RESULT_GIRL_IMAGE_SRC = '/assets/character/girl-default.webp';
  const RESULT_QR_IMAGE_SRC = '/assets/qr-site.png?v=20260710-qr-1';
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

  const $ = (id) => document.getElementById(id);

  let state = null;
  let roomCode = '';
  let role = '';
  let turnToken = '';
  let handoffMode = false;
  let handoffRole = '';
  let busy = false;
  let sendingChoice = false;
  let pendingChoice = null;
  let latestResult = null;
  let lastPlayViewKey = '';
  let resultReturnMode = false;

  function cleanName(value, fallback) {
    const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 6);
    return text || fallback;
  }

  function normalizeCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
  }

  function normalizeTurnToken(value) {
    const token = String(value || '').trim();
    return /^[a-f0-9]{36}$/i.test(token) ? token : '';
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
    ['createRoom', 'joinRoom', 'replaySameRoom', 'replaySwapRoles'].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = busy;
    });
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
      throw new Error(json.error || '通信に失敗しました');
    }
    return json;
  }

  function pickCards() {
    if (window.pickRandomCards) return window.pickRandomCards(5);
    const cards = Array.isArray(window.ALL_CARDS) ? window.ALL_CARDS.slice() : [];
    for (let i = cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards.slice(0, 5);
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
    return loveMode === 'boyTarget' ? 'girlTarget' : 'boyTarget';
  }

  function isDefaultNames(names) {
    return names.target === '彼女' && names.guesser === '彼氏';
  }

  function loveResultHeaderLabel(names) {
    return '2人の理解度判定';
  }

  function loveScoreLabel(names) {
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
    return RESULT_TIERS[safeScore] || RESULT_TIERS[0];
  }

  function resultPublicUrl() {
    if (roomCode && state && state.phase === 'result') {
      return resultRoomUrl(oppositeRole(role));
    }
    return `${window.location.origin}/remote`;
  }

  function resultShareText(data, platform = 'x') {
    const hashTag = '#2人の理解度判定';
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
    const encoded = encodeURIComponent(message);
    if (isMobileLike()) {
      window.location.href = `line://msg/text/${encoded}`;
      return;
    }
    window.location.href = `https://line.me/R/msg/text/?${encoded}`;
  }

  function openXShare(message) {
    const encoded = encodeURIComponent(message);
    const webUrl = `https://x.com/intent/post?text=${encoded}`;
    const ua = navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua)
      || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);

    if (isIos) {
      let appOpened = false;
      const detectAppOpen = () => {
        if (document.hidden) appOpened = true;
      };
      document.addEventListener('visibilitychange', detectAppOpen);
      window.location.href = `twitter://post?message=${encoded}`;
      window.setTimeout(() => {
        document.removeEventListener('visibilitychange', detectAppOpen);
        if (!appOpened && !document.hidden) window.location.href = webUrl;
      }, 1400);
      return;
    }

    if (/Android/i.test(ua)) {
      const fallback = encodeURIComponent(webUrl);
      window.location.href = `intent://post?message=${encoded}#Intent;scheme=twitter;package=com.twitter.android;S.browser_fallback_url=${fallback};end`;
      return;
    }

    window.open(webUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
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

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function shouldUseNativeShare() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const hasCoarsePointer = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(pointer: coarse)').matches;
    return Boolean(navigator.share && (isMobileUa || hasCoarsePointer));
  }

  async function saveImageBlob(blob, filename, title) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (shouldUseNativeShare() && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return 'shared-save-sheet';
    }
    downloadBlob(blob, filename);
    return 'downloaded';
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
    const url = new URL('/remote', window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', nextRole);
    url.searchParams.set('turn', nextToken);
    return url.toString();
  }

  function senderStateUrl(viewerRole = role, nextRole = handoffRole, nextToken = turnToken) {
    const url = new URL('/remote', window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', viewerRole);
    url.searchParams.set('next', nextRole);
    url.searchParams.set('turn', nextToken);
    url.searchParams.set('handoff', '1');
    return url.toString();
  }

  function replaceRemoteUrl() {
    if (!roomCode) return;
    if (state && state.phase === 'result') {
      const resultSuffix = resultReturnMode ? '&result=1' : '';
      window.history.replaceState(null, '', `/remote?room=${roomCode}&role=${role}${resultSuffix}`);
      return;
    }
    if (handoffMode && handoffRole && turnToken) {
      window.history.replaceState(null, '', senderStateUrl());
      return;
    }
    if (role && turnToken) {
      window.history.replaceState(null, '', roomInviteUrl(role, turnToken));
      return;
    }
    window.history.replaceState(null, '', `/remote?room=${roomCode}&role=${role}`);
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

  function resultRoomUrl(recipientRole = oppositeRole(role)) {
    const url = new URL('/remote', window.location.origin);
    url.searchParams.set('room', roomCode);
    url.searchParams.set('role', recipientRole);
    url.searchParams.set('result', '1');
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
    button.textContent = 'コピーしました';
    window.setTimeout(() => {
      button.textContent = original;
    }, 1800);
  }

  async function shareRoomByLine() {
    const text = buildInviteText();
    if (!text) return;
    await copyInviteText(text);
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
    setBusy(true);
    try {
      const creatorRole = $('creatorRole').value === 'guesser' ? 'guesser' : 'target';
      const creatorSide = 'boy';
      const loveMode = creatorRole === 'target' ? 'boyTarget' : 'girlTarget';
      const players = {
        girl: cleanName($('otherName').value, '相手'),
        boy: cleanName($('selfName').value, '私'),
      };
      const cards = pickCards();
      const created = await api('/api/remote/rooms', {
        method: 'POST',
        body: JSON.stringify({ loveMode, players, creatorSide, cards }),
      });
      roomCode = created.code;
      state = created.room;
      turnToken = normalizeTurnToken(created.nextTurnToken);
      saveRole(roomCode, roleForParticipant(state, 'creator'));
      setFreshTurnAccess();
      markSwapSeen(roomCode, state.roleSwapNonce);
      render();
      replaceRemoteUrl();
    } catch (e) {
      alert(e.message || 'ルーム作成に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(codeValue, participant = '', linkRole = '', handoffToken = '', isSender = false, nextRole = '') {
    if (busy) return;
    const code = normalizeCode(codeValue || $('joinCode').value);
    if (code.length !== 6) {
      alert('6桁のルームコードを入力してください');
      return;
    }
    setBusy(true);
    try {
      const accessParams = new URLSearchParams();
      if (linkRole === 'target' || linkRole === 'guesser') accessParams.set('role', linkRole);
      if (handoffToken) accessParams.set('turn', handoffToken);
      if (isSender) {
        accessParams.set('handoff', '1');
        if (nextRole === 'target' || nextRole === 'guesser') accessParams.set('next', nextRole);
      }
      const accessQuery = accessParams.toString();
      const loaded = await api(`/api/remote/rooms/${code}${accessQuery ? `?${accessQuery}` : ''}`);
      roomCode = code;
      state = loaded.room;
      if (Number(state && state.version || 0) < 4) {
        throw new Error('このルームは旧方式です。新しいルームを作り直してください。');
      }
      const linkedRole = linkRole === 'target' || linkRole === 'guesser' ? linkRole : '';
      if (linkedRole) {
        saveRole(roomCode, linkedRole);
      } else if (participant === 'creator' || participant === 'joiner') {
        saveRole(roomCode, roleForParticipant(state, participant));
      } else {
        loadRole(roomCode);
        if (!role) saveRole(roomCode, roleForParticipant(state, 'joiner'));
      }
      turnToken = normalizeTurnToken(handoffToken);
      handoffMode = Boolean(isSender && turnToken);
      handoffRole = handoffMode && (nextRole === 'target' || nextRole === 'guesser') ? nextRole : '';
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
      body: JSON.stringify({ patch }),
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
    const selectedChoice = selectedChoiceForCurrentView(qIdx, state.phase);
    if (!selectedChoice) {
      sendingChoice = false;
      pendingChoice = null;
    } else if (selectedChoice.mode === 'locked') {
      sendingChoice = false;
    }
    const currentPlayer = turnPlayerName(state);
    $('turnTitle').textContent = `Q${q}/${total} ${canChoose ? 'あなたの番' : canHandOff ? `次は${currentPlayer}の番` : '相手の番'}`;
    if (isTargetTurn) {
      $('turnNote').textContent = canChoose
        ? `${names.guesser}に見せずに、${names.target}が自分の答えを選んでください。5問続けて回答します。`
        : canHandOff
          ? `${currentPlayer}に、5問まとめて回答できるURLを送ってください。`
          : `${names.target}が答えを選んでいます。LINEで届くURLを待ってね。`;
    } else {
      $('turnNote').textContent = canChoose
        ? state.targetComplete
          ? `${names.target}が何を選んだか予想してください。5問続けて回答します。`
          : `${names.target}が何を選びそうか予想してください。相手はこのあと5問回答します。`
        : canHandOff
          ? `${currentPlayer}に、5問まとめて回答できるURLを送ってください。`
          : `${names.guesser}が予想しています。LINEで届くURLを待ってね。`;
    }
    $('questionWrap').innerHTML = `<img class="question-img" src="${card.image}" alt="${escapeHtml(card.title || 'お題カード')}">`;
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
    const score = answers.filter((a) => a.match).length;
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
    const recipientRole = oppositeRole(role);
    const recipientName = recipientRole === 'target' ? names.target : names.guesser;
    setHidden('resultReturn', resultReturnMode || !role);
    $('resultReturnTitle').textContent = `${recipientName}に判定結果を返す`;
    $('resultReturnLine').textContent = `LINEで${recipientName}に結果を返す`;
  }

  function shareResultLine() {
    if (!latestResult) return;
    openLineShare(resultShareText(latestResult, 'line'));
  }

  function shareResultX() {
    if (!latestResult) return;
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
        `watachan-love-result-${latestResult.score}-${latestResult.total}.png`,
        'わたちゃん 判定画像'
      );
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
      const isSender = params.get('handoff') === '1';
      joinRoom(code, participant, linkRole, handoffToken, isSender, nextRole);
    } else {
      render();
    }
  }

  init();
})();
