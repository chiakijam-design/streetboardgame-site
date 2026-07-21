import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';

const DIST_ENTRIES = {
  viewport_recovery: 'viewport_recovery.js',
  prototype_quiz_data: 'prototype_quiz_data.js',
  prototype_friend_data: 'prototype_friend_data.js',
  prototype_family_data: 'prototype_family_data.js',
  remote_love: 'remote_love.js',
  prototype_character: 'prototype_character.jsx',
  prototype_app: 'prototype_app.jsx',
};

const HTML_ENTRY_MAP = {
  'index.html': [
    'react',
    'react_dom',
    'viewport_recovery',
    'prototype_quiz_data',
    'prototype_friend_data',
    'prototype_family_data',
    'prototype_character',
    'prototype_app',
  ],
  'remote.html': [
    'viewport_recovery',
    'prototype_quiz_data',
    'remote_love',
  ],
};

await mkdir('dist', { recursive: true });
await mkdir('assets/vendor', { recursive: true });

await removeGeneratedFiles('dist', /^(viewport_recovery|prototype_quiz_data|prototype_friend_data|prototype_family_data|remote_love|prototype_character|prototype_app)(?:-[A-Z0-9]+)?\.js(?:\.map)?$/i);
await removeGeneratedFiles('assets/vendor', /^react(?:-dom)?\.production\.min(?:-[a-f0-9]+)?\.js$/i);

const runtimeSources = {
  react: await readFile('node_modules/react/umd/react.production.min.js'),
  react_dom: await readFile('node_modules/react-dom/umd/react-dom.production.min.js'),
};
const scriptPaths = {};

for (const [entryName, source] of Object.entries(runtimeSources)) {
  const baseName = entryName === 'react_dom' ? 'react-dom.production.min' : 'react.production.min';
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const outputPath = `assets/vendor/${baseName}-${hash}.js`;
  await writeFile(outputPath, source);
  scriptPaths[entryName] = `/${outputPath.replace(/\\/g, '/')}`;
}

await Promise.all([
  copyFile('node_modules/react/LICENSE', 'assets/vendor/react.LICENSE.txt'),
  copyFile('node_modules/react-dom/LICENSE', 'assets/vendor/react-dom.LICENSE.txt'),
]);

const result = await build({
  entryPoints: DIST_ENTRIES,
  outdir: 'dist',
  entryNames: '[name]-[hash]',
  bundle: true,
  format: 'iife',
  target: ['es2018'],
  minify: true,
  sourcemap: false,
  metafile: true,
  legalComments: 'none',
  logLevel: 'info',
});

for (const [outputPath, outputMeta] of Object.entries(result.metafile.outputs)) {
  if (!outputMeta.entryPoint || extname(outputPath) !== '.js') continue;
  const entryName = basename(outputMeta.entryPoint, extname(outputMeta.entryPoint));
  scriptPaths[entryName] = `/${outputPath.replace(/\\/g, '/')}`;
}

for (const [htmlPath, entryNames] of Object.entries(HTML_ENTRY_MAP)) {
  let html = await readFile(htmlPath, 'utf8');
  for (const entryName of entryNames) {
    const scriptPath = scriptPaths[entryName];
    if (!scriptPath) throw new Error(`Missing generated script for ${entryName}`);
    html = replaceTaggedAsset(html, 'script', 'data-build-entry', entryName, 'src', scriptPath);
    html = replaceTaggedAsset(html, 'link', 'data-build-preload', entryName, 'href', scriptPath, false);
  }
  await writeFile(htmlPath, html);
}

async function removeGeneratedFiles(directory, pattern) {
  const files = await readdir(directory);
  await Promise.all(files.filter((file) => pattern.test(file)).map((file) => unlink(`${directory}/${file}`)));
}

function replaceTaggedAsset(html, tagName, markerName, markerValue, attributeName, value, required = true) {
  const pattern = new RegExp(`(<${tagName}[^>]*${markerName}=["']${markerValue}["'][^>]*${attributeName}=["'])[^"']+(["'])`, 'i');
  if (!pattern.test(html)) {
    if (required) throw new Error(`Missing ${tagName} marker for ${markerValue}`);
    return html;
  }
  return html.replace(pattern, `$1${value}$2`);
}
