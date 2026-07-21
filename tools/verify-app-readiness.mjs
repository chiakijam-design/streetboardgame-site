import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
const expected = {
  appId: 'com.streetboardgame.watachan',
  appName: 'わたちゃん',
  webDir: 'ios-web',
};

for (const [key, value] of Object.entries(expected)) {
  if (config[key] !== value) {
    throw new Error(`capacitor.config.json: ${key} must be ${value}`);
  }
}

const icon = await readFile('assets/app-icon-1024.png');
if (icon.toString('ascii', 1, 4) !== 'PNG') {
  throw new Error('assets/app-icon-1024.png is not a PNG file');
}
const width = icon.readUInt32BE(16);
const height = icon.readUInt32BE(20);
const colorType = icon[25];
if (width !== 1024 || height !== 1024 || colorType !== 2) {
  throw new Error(`App icon must be 1024x1024 RGB without alpha; got ${width}x${height}, colorType=${colorType}`);
}

for (const file of ['ios-web/index.html', 'ios-web/remote.html']) {
  const html = await readFile(file, 'utf8');
  for (const host of ['googletagmanager.com', 'fonts.googleapis.com', 'fonts.gstatic.com']) {
    if (html.includes(host)) {
      throw new Error(`${file} still contains automatic network dependency: ${host}`);
    }
  }
}

const indexHtml = await readFile('ios-web/index.html', 'utf8');
const remoteHtml = await readFile('ios-web/remote.html', 'utf8');
const bundlePattern = /<script[^>]+src=["']([^"']*dist\/[^"']+\.js)["']/g;
const normalBundles = [...indexHtml.matchAll(bundlePattern)].map((match) => `ios-web/${match[1].replace(/^\.\//, '')}`);
const remoteBundles = [...remoteHtml.matchAll(bundlePattern)].map((match) => `ios-web/${match[1].replace(/^\.\//, '')}`);

const normalSource = (await Promise.all(normalBundles.map((file) => readFile(file, 'utf8')))).join('\n');
const remoteSource = (await Promise.all(remoteBundles.map((file) => readFile(file, 'utf8')))).join('\n');
if (normalSource.includes('/api/remote')) {
  throw new Error('Normal game bundle must not depend on the remote API');
}
if (!remoteSource.includes('/api/remote')) {
  throw new Error('Remote game bundle must use the remote API');
}

process.stdout.write([
  'App readiness verified:',
  `- ${config.appName} (${config.appId})`,
  '- 1024x1024 RGB app icon',
  '- normal game bundle has no remote API dependency',
  '- remote game bundle uses /api/remote',
  '- automatic analytics and external font requests removed from app assets',
].join('\n') + '\n');
