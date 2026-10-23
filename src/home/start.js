import { localizedPath, translateText } from '../i18n/runtime.js';

export function startCreatorGame(mode, rawName) {
  const name = String(rawName || '').trim().slice(0, 12);
  if (!name) return translateText('名前を入力してください。');
  try {
    sessionStorage.setItem('watachan:creator-quick-start:v1', JSON.stringify({ mode, name, createdAt: Date.now() }));
  } catch {
    return translateText('ブラウザの一時保存を利用できません。設定を確認してください。');
  }
  location.assign(localizedPath('/challenge'));
  return '';
}
