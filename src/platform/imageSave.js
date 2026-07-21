import { shareFiles, shouldUseNativeShare } from './share.js';

export function downloadBlob(blob, filename, { documentRef = globalThis.document, urlRef = globalThis.URL } = {}) {
  if (!documentRef?.createElement || !urlRef?.createObjectURL) return false;
  const url = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  documentRef.body.removeChild(anchor);
  urlRef.revokeObjectURL(url);
  return true;
}

export async function fetchImageBlob(src, fetchRef = globalThis.fetch) {
  const response = await fetchRef(src, src?.startsWith('data:') ? undefined : { cache: 'force-cache' });
  if (!response.ok) throw new Error('image-fetch-failed');
  return response.blob();
}

export async function saveImageBlob(blob, filename, title, env = {}) {
  const navigatorRef = env.navigatorRef || globalThis.navigator;
  const windowRef = env.windowRef || globalThis.window;
  const FileRef = env.FileRef || globalThis.File;
  if (FileRef && shouldUseNativeShare(navigatorRef, windowRef)) {
    const file = new FileRef([blob], filename, { type: blob.type || 'image/png' });
    if (await shareFiles({ files: [file], title }, navigatorRef)) return 'shared-save-sheet';
  }
  downloadBlob(blob, filename, env);
  return 'downloaded';
}

export async function savePreparedImage({ src, filename, title }, env = {}) {
  const blob = await fetchImageBlob(src, env.fetchRef || globalThis.fetch);
  return saveImageBlob(blob, filename, title, env);
}

export async function sharePreparedImage({ src, filename, title, text, url }, env = {}) {
  const navigatorRef = env.navigatorRef || globalThis.navigator;
  const windowRef = env.windowRef || globalThis.window;
  const FileRef = env.FileRef || globalThis.File;
  const blob = await fetchImageBlob(src, env.fetchRef || globalThis.fetch);
  if (FileRef && shouldUseNativeShare(navigatorRef, windowRef)) {
    const file = new FileRef([blob], filename, { type: blob.type || 'image/png' });
    if (await shareFiles({ files: [file], title, text, url }, navigatorRef)) return 'shared';
  }
  if (shouldUseNativeShare(navigatorRef, windowRef) && navigatorRef?.share) {
    await navigatorRef.share({ title, text, url });
    downloadBlob(blob, filename, env);
    return 'shared-download';
  }
  downloadBlob(blob, filename, env);
  return 'downloaded';
}
