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

export function dataUrlToBlob(src, {
  BlobRef = globalThis.Blob,
  atobRef = globalThis.atob,
} = {}) {
  if (!BlobRef || typeof src !== 'string' || !src.startsWith('data:')) {
    throw new Error('invalid-image-data-url');
  }
  const commaIndex = src.indexOf(',');
  if (commaIndex < 0) throw new Error('invalid-image-data-url');
  const metadata = src.slice(5, commaIndex).split(';');
  const type = metadata[0] || 'application/octet-stream';
  const payload = src.slice(commaIndex + 1);
  if (metadata.includes('base64')) {
    if (!atobRef) throw new Error('base64-decoder-unavailable');
    const binary = atobRef(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new BlobRef([bytes], { type });
  }
  return new BlobRef([decodeURIComponent(payload)], { type });
}

export async function fetchImageBlob(src, fetchRef = globalThis.fetch, env = {}) {
  if (src?.startsWith('data:')) return dataUrlToBlob(src, env);
  const response = await fetchRef(src, { cache: 'force-cache' });
  if (!response.ok) throw new Error('image-fetch-failed');
  return response.blob();
}

export async function saveImageBlob(blob, filename, title, env = {}) {
  const navigatorRef = env.navigatorRef || globalThis.navigator;
  const windowRef = env.windowRef || globalThis.window;
  const FileRef = env.FileRef || globalThis.File;
  if (FileRef && shouldUseNativeShare(navigatorRef, windowRef)) {
    const file = new FileRef([blob], filename, { type: blob.type || 'image/png' });
    try {
      if (await shareFiles({ files: [file], title }, navigatorRef)) return 'shared-save-sheet';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  if (!downloadBlob(blob, filename, env)) throw new Error('image-save-unavailable');
  return 'downloaded';
}

export async function savePreparedImage({ src, filename, title }, env = {}) {
  const blob = await fetchImageBlob(src, env.fetchRef || globalThis.fetch, env);
  return saveImageBlob(blob, filename, title, env);
}

export async function sharePreparedImage({ src, filename, title, text, url }, env = {}) {
  const navigatorRef = env.navigatorRef || globalThis.navigator;
  const windowRef = env.windowRef || globalThis.window;
  const FileRef = env.FileRef || globalThis.File;
  const blob = await fetchImageBlob(src, env.fetchRef || globalThis.fetch, env);
  if (FileRef && shouldUseNativeShare(navigatorRef, windowRef)) {
    const file = new FileRef([blob], filename, { type: blob.type || 'image/png' });
    try {
      if (await shareFiles({ files: [file], title, text, url }, navigatorRef)) return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  if (shouldUseNativeShare(navigatorRef, windowRef) && navigatorRef?.share) {
    try {
      await navigatorRef.share({ title, text, url });
      if (!downloadBlob(blob, filename, env)) throw new Error('image-save-unavailable');
      return 'shared-download';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  if (!downloadBlob(blob, filename, env)) throw new Error('image-save-unavailable');
  return 'downloaded';
}
