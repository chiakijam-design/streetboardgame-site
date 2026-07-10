(function () {
  const ROOM_STORAGE_KEY = 'watachan-remote-love-role-v1';
  const POLL_MS = 1400;
  const COLOR_NAMES = ['緑', '青', '黄', '赤', '橙'];

  const $ = (id) => document.getElementById(id);

  let state = null;
  let roomCode = '';
  let role = '';
  let pollTimer = null;
  let busy = false;

  function cleanName(value, fallback) {
    const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 6);
    return text || fallback;
  }

  function normalizeCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 5);
  }

  function getRoleMap() {
    try {
      return JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function saveRole(code, nextRole) {
    const map = getRoleMap();
    map[code] = nextRole;
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(map));
    role = nextRole;
  }

  function loadRole(code) {
    role = getRoleMap()[code] || '';
  }

  function setHidden(id, hidden) {
    $(id).classList.toggle('hidden', Boolean(hidden));
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    ['createRoom', 'joinRoom'].forEach((id) => {
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
    const girl = room.players && room.players.girl ? room.players.girl : '彼女';
    const boy = room.players && room.players.boy ? room.players.boy : '彼氏';
    if (room.loveMode === 'boyTarget') {
      return { target: boy, guesser: girl };
    }
    return { target: girl, guesser: boy };
  }

  async function createRoom() {
    if (busy) return;
    setBusy(true);
    try {
      const loveMode = $('direction').value;
      const players = {
        girl: cleanName($('girlName').value, '彼女'),
        boy: cleanName($('boyName').value, '彼氏'),
      };
      const cards = pickCards();
      const created = await api('/api/remote/rooms', {
        method: 'POST',
        body: JSON.stringify({ loveMode, players, cards }),
      });
      roomCode = created.code;
      state = created.room;
      saveRole(roomCode, 'target');
      render();
      startPolling();
      window.history.replaceState(null, '', `/remote?room=${roomCode}`);
    } catch (e) {
      alert(e.message || 'ルーム作成に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(codeValue) {
    if (busy) return;
    const code = normalizeCode(codeValue || $('joinCode').value);
    if (code.length !== 5) {
      alert('5桁のルームコードを入力してください');
      return;
    }
    setBusy(true);
    try {
      const loaded = await api(`/api/remote/rooms/${code}`);
      roomCode = code;
      state = loaded.room;
      loadRole(roomCode);
      render();
      startPolling();
      window.history.replaceState(null, '', `/remote?room=${roomCode}`);
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
    render();
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!roomCode) return;
      try {
        const loaded = await api(`/api/remote/rooms/${roomCode}`);
        state = loaded.room;
        render();
      } catch (e) {
        $('roleStatus').textContent = '通信が切れています。少し待ってから再読み込みしてください。';
      }
    }, POLL_MS);
  }

  function chooseRole(nextRole) {
    if (!roomCode) return;
    saveRole(roomCode, nextRole);
    render();
  }

  async function chooseAnswer(index) {
    if (!state || !roomCode) return;
    const room = state;
    if (room.phase === 'target' && role === 'target') {
      await updateRoom({ targetPick: index, phase: 'guess', updatedBy: role });
      return;
    }
    if (room.phase === 'guess' && role === 'guesser') {
      const answers = Array.isArray(room.answers) ? room.answers.slice() : [];
      answers.push({
        target: room.targetPick,
        guess: index,
        match: Number(room.targetPick) === Number(index),
      });
      const nextIndex = Number(room.qIdx || 0) + 1;
      const done = nextIndex >= (room.cards || []).length;
      await updateRoom({
        answers,
        qIdx: done ? room.qIdx : nextIndex,
        targetPick: null,
        phase: done ? 'result' : 'target',
        updatedBy: role,
      });
    }
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
    $('beTarget').textContent = `私は${names.target}`;
    $('beGuesser').textContent = `私は${names.guesser}`;
    $('roleStatus').textContent = role
      ? `あなたは「${role === 'target' ? names.target : names.guesser}」として参加中です。`
      : '自分の役割を選んでください。';
    $('beTarget').className = role === 'target' ? 'btn yellow small' : 'btn white small';
    $('beGuesser').className = role === 'guesser' ? 'btn yellow small' : 'btn white small';
  }

  function renderPlay() {
    if (!state) return;
    const names = targetAndGuesser(state);
    const card = currentCard();
    if (!card) return;
    const q = Number(state.qIdx || 0) + 1;
    const total = (state.cards || []).length;
    const isTargetTurn = state.phase === 'target';
    const isGuesserTurn = state.phase === 'guess';
    const yourTurn = (isTargetTurn && role === 'target') || (isGuesserTurn && role === 'guesser');
    $('turnTitle').textContent = `Q${q}/${total} ${yourTurn ? 'あなたの番' : '相手の番'}`;
    if (isTargetTurn) {
      $('turnNote').textContent = yourTurn
        ? `${names.guesser}に見せずに、${names.target}が自分の答えを選んでください。`
        : `${names.target}が答えを選んでいます。少し待ってね。`;
    } else {
      $('turnNote').textContent = yourTurn
        ? `${names.target}が何を選んだか予想してください。`
        : `${names.guesser}が予想しています。少し待ってね。`;
    }
    $('questionWrap').innerHTML = `<img class="question-img" src="${card.image}" alt="${escapeHtml(card.title || 'お題カード')}">`;
    const choices = Array.isArray(card.choices) ? card.choices : [];
    $('choices').innerHTML = choices.map((choice, index) => {
      const color = window.COLOR_OPTIONS && window.COLOR_OPTIONS[index] ? window.COLOR_OPTIONS[index].color : '#ccc';
      return `
        <button class="choice" data-choice="${index}" ${yourTurn ? '' : 'disabled'}>
          <span class="dot" style="background:${color}"></span>
          <span>${escapeHtml(choice || COLOR_NAMES[index] || '')}</span>
        </button>
      `;
    }).join('');
    document.querySelectorAll('[data-choice]').forEach((button) => {
      button.addEventListener('click', () => chooseAnswer(Number(button.dataset.choice)));
    });
  }

  function renderResult() {
    if (!state) return;
    const names = targetAndGuesser(state);
    const answers = Array.isArray(state.answers) ? state.answers : [];
    const total = answers.length || 5;
    const score = answers.filter((a) => a.match).length;
    $('score').textContent = `${score}/${total}`;
    $('scoreText').textContent = `${names.guesser}は${names.target}の答えを${score}問当てました。`;
    $('answerDetails').innerHTML = answers.map((answer, index) => {
      const card = state.cards[index] || {};
      const targetChoice = card.choices && card.choices[answer.target] ? card.choices[answer.target] : COLOR_NAMES[answer.target];
      const guessChoice = card.choices && card.choices[answer.guess] ? card.choices[answer.guess] : COLOR_NAMES[answer.guess];
      return `
        <div class="answer-row">
          <div class="answer-head">
            <span>Q${index + 1} ${escapeHtml(card.title || '')}</span>
            <span>${answer.match ? '当たり' : 'ハズレ'}</span>
          </div>
          <div class="answer-body">
            <div>${escapeHtml(names.target)}<br>${escapeHtml(targetChoice || '')}</div>
            <div>${escapeHtml(names.guesser)}<br>${escapeHtml(guessChoice || '')}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function render() {
    const hasRoom = Boolean(state && roomCode);
    setHidden('setup', hasRoom);
    setHidden('joinPanel', hasRoom);
    setHidden('room', !hasRoom);
    setHidden('play', !hasRoom || state.phase === 'result');
    setHidden('result', !hasRoom || state.phase !== 'result');
    if (!hasRoom) return;
    renderRoomCard();
    if (state.phase === 'result') renderResult();
    else renderPlay();
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
    $('joinRoom').addEventListener('click', () => joinRoom());
    $('beTarget').addEventListener('click', () => chooseRole('target'));
    $('beGuesser').addEventListener('click', () => chooseRole('guesser'));
    $('newRoom').addEventListener('click', () => {
      window.location.href = '/remote';
    });
    $('joinCode').addEventListener('input', (e) => {
      e.target.value = normalizeCode(e.target.value);
    });
    const params = new URLSearchParams(location.search);
    const code = normalizeCode(params.get('room'));
    if (code) {
      $('joinCode').value = code;
      joinRoom(code);
    } else {
      createRoom();
    }
  }

  init();
})();
