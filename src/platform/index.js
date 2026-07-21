import { getBrowserStorage } from './storage.js';
import * as share from './share.js';
import * as imageSave from './imageSave.js';
import * as haptics from './haptics.js';
import * as navigation from './navigation.js';

export function createWebPlatform(windowRef = globalThis.window) {
  return {
    storage: {
      local: getBrowserStorage('local', windowRef),
      session: getBrowserStorage('session', windowRef),
    },
    share,
    imageSave,
    haptics,
    navigation,
  };
}

export function isNativeRuntime(windowRef = globalThis.window) {
  return Boolean(windowRef?.Capacitor?.isNativePlatform?.());
}
