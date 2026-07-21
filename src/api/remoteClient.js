const DEFAULT_MESSAGES = Object.freeze({
  'rate-limit-exceeded': '操作が続いたため少し待っています。1分ほどしてからもう一度お試しください。',
  'room-update-forbidden': 'この端末ではルームを更新できません。参加時に届いた最新URLを開き直してください。',
});

export async function requestJson(path, options = {}, fetchRef = globalThis.fetch) {
  const response = await fetchRef(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(DEFAULT_MESSAGES[json.error] || json.error || '通信に失敗しました');
  }
  return json;
}

export function createRemoteClient({
  baseUrl = '/api/remote',
  fetchRef = globalThis.fetch,
} = {}) {
  const roomPath = (code, suffix = '') => (
    `${baseUrl}/rooms/${encodeURIComponent(String(code || ''))}${suffix}`
  );
  const postJson = (path, body) => requestJson(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }, fetchRef);

  return Object.freeze({
    createRoom(payload) {
      return postJson(`${baseUrl}/rooms`, payload);
    },
    getRoom(code, query = '') {
      const normalizedQuery = query ? `?${String(query).replace(/^\?/, '')}` : '';
      return requestJson(roomPath(code, normalizedQuery), {}, fetchRef);
    },
    updateRoom(code, patch, manageToken = '') {
      return postJson(roomPath(code), { patch, manageToken });
    },
    chooseAnswer(code, payload) {
      return postJson(roomPath(code, '/choose'), payload);
    },
  });
}
