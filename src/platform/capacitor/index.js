function requirePlugin(plugin, name) {
  if (!plugin) throw new Error(`${name} plugin is not configured`);
  return plugin;
}

function createCapacitorStorage(Preferences) {
  return {
    async get(key, fallback = null) {
      const result = await requirePlugin(Preferences, 'Preferences').get({ key });
      return result.value ?? fallback;
    },
    async set(key, value) {
      await requirePlugin(Preferences, 'Preferences').set({ key, value: String(value) });
    },
    async remove(key) {
      await requirePlugin(Preferences, 'Preferences').remove({ key });
    },
    async getJson(key, fallback = null) {
      const value = await this.get(key);
      if (value == null) return fallback;
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    },
    async setJson(key, value) {
      await this.set(key, JSON.stringify(value));
    },
  };
}

export function createCapacitorPlatform({
  Preferences,
  Share,
  Filesystem,
  Haptics,
  Browser,
} = {}) {
  const storage = createCapacitorStorage(Preferences);
  return {
    storage,
    asyncStorage: storage,
    share: (options) => requirePlugin(Share, 'Share').share(options),
    imageSave: (options) => requirePlugin(Filesystem, 'Filesystem').writeFile(options),
    haptics: (options) => requirePlugin(Haptics, 'Haptics').impact(options),
    navigation: (options) => requirePlugin(Browser, 'Browser').open(options),
  };
}
