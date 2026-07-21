export function createStorageAdapter(storage) {
  return {
    get(key, fallback = null) {
      if (!storage) return fallback;
      try {
        const value = storage.getItem(key);
        return value === null ? fallback : value;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      if (!storage) return false;
      try {
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
    getJson(key, fallback = null) {
      const value = this.get(key, null);
      if (value === null) return fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    setJson(key, value) {
      return this.set(key, JSON.stringify(value));
    },
  };
}

export function getBrowserStorage(kind = 'local', windowRef = globalThis.window) {
  const storage = kind === 'session' ? windowRef?.sessionStorage : windowRef?.localStorage;
  return createStorageAdapter(storage);
}

export function readExpiringMap(adapter, key, now = Date.now()) {
  const source = adapter?.getJson(key, {}) || {};
  const active = {};
  Object.entries(source).forEach(([entryKey, entry]) => {
    if (!entry?.expiresAt || Number(entry.expiresAt) > now) active[entryKey] = entry;
  });
  if (Object.keys(active).length !== Object.keys(source).length) adapter?.setJson(key, active);
  return active;
}
