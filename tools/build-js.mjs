import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { copyFile, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';

const DIST_ENTRIES = {
  viewport_recovery: 'viewport_recovery.js',
  prototype_common_data: 'prototype_common_data.js',
  prototype_english_common_data: 'prototype_english_common_data.js',
  challenge_game: 'challenge_game.js',
  live_challenge: 'live_challenge.js',
  live_ops: 'live_ops.js',
  question_ops: 'question_ops.js',
  prototype_character: 'prototype_character.jsx',
  prototype_app: 'prototype_app.jsx',
  home_entry: 'home_entry.js',
};

const STYLE_ENTRIES = {
  accessibility: 'accessibility.css',
  question_card: 'question-card.css',
  legal: 'legal.css',
};

const HTML_ENTRY_MAP = {
  'index.html': [
    'react',
    'react_dom',
    'viewport_recovery',
    'prototype_character',
    'prototype_app',
    'home_entry',
  ],
  'challenge.html': [
    'prototype_common_data',
    'prototype_english_common_data',
    'challenge_game',
  ],
  'live_challenge.html': [
    'prototype_common_data',
    'prototype_english_common_data',
    'live_challenge',
  ],
  'live_ops.html': [
    'live_ops',
  ],
  'question_ops.html': [
    'prototype_common_data',
    'question_ops',
  ],
};

const HTML_STYLE_MAP = {
  'index.html': [
    'accessibility',
    'question_card',
  ],
  'challenge.html': [
    'question_card',
    'accessibility',
  ],
  'live_challenge.html': [
    'question_card',
    'accessibility',
  ],
  '404.html': [
    'accessibility',
  ],
  'content-guidelines.html': [
    'legal',
  ],
  'creator-terms.html': [
    'legal',
  ],
  'legal.html': [
    'legal',
  ],
  'pricing.html': [
    'legal',
  ],
  'minor-policy.html': [
    'legal',
  ],
  'privacy.html': [
    'legal',
  ],
  'refund-policy.html': [
    'legal',
  ],
  'terms.html': [
    'legal',
  ],
};

await mkdir('dist', { recursive: true });
await mkdir('assets/vendor', { recursive: true });

await removeGeneratedFiles('dist', /^(viewport_recovery|prototype_common_data|prototype_english_common_data|challenge_game|live_challenge|live_ops|question_ops|prototype_character|prototype_app|home_entry)(?:-[A-Z0-9]+)?\.js(?:\.map)?$/i);
await removeGeneratedFiles('dist', /^(accessibility|question-card|legal)-[a-f0-9]+\.css$/i);
await removeGeneratedFiles('assets/vendor', /^react(?:-dom)?\.production\.min(?:-[a-f0-9]+)?\.js$/i);

const runtimeSources = {
  react: await readFile('node_modules/react/umd/react.production.min.js'),
  react_dom: await readFile('node_modules/react-dom/umd/react-dom.production.min.js'),
};
const scriptPaths = {};
const stylePaths = {};

for (const [entryName, sourcePath] of Object.entries(STYLE_ENTRIES)) {
  const source = await readFile(sourcePath);
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const baseName = basename(sourcePath, extname(sourcePath));
  const outputPath = `dist/${baseName}-${hash}.css`;
  await writeFile(outputPath, source);
  stylePaths[entryName] = `/${outputPath.replace(/\\/g, '/')}`;
}

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
  copyFile('node_modules/qrcode/license', 'assets/vendor/qrcode.LICENSE.txt'),
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

for (const [htmlPath, entryNames] of Object.entries(HTML_STYLE_MAP)) {
  let html = await readFile(htmlPath, 'utf8');
  for (const entryName of entryNames) {
    const stylePath = stylePaths[entryName];
    if (!stylePath) throw new Error(`Missing generated stylesheet for ${entryName}`);
    if (['index.html', 'challenge.html', 'live_challenge.html'].includes(htmlPath)) {
      const { code } = await transform(await readFile(STYLE_ENTRIES[entryName], 'utf8'), { loader: 'css', minify: true });
      const styleMarker = new RegExp(`<link[^>]*data-build-style="${entryName}"[^>]*>|<style data-build-style="${entryName}">[\\s\\S]*?<\\/style>`);
      if (!styleMarker.test(html)) throw new Error(`Missing inline style marker for ${entryName}`);
      html = html.replace(styleMarker, `<style data-build-style="${entryName}">${code}</style>`);
    } else {
      html = replaceTaggedAsset(html, 'link', 'data-build-style', entryName, 'href', stylePath);
    }
  }
  await writeFile(htmlPath, html);
}

// Render the existing homepage component at build time, so its LCP image and
// text can paint before React and analytics finish loading on a slow phone.
const prerenderBundle = await build({
  stdin: {
    contents: "import './prototype_character.jsx'; export { TopPage } from './prototype_app.jsx';",
    resolveDir: process.cwd(),
    loader: 'jsx',
  },
  bundle: true,
  format: 'iife',
  globalName: 'HomePrerender',
  write: false,
  platform: 'node',
});
const renderContext = vm.createContext({ React });
renderContext.window = renderContext;
vm.runInContext(prerenderBundle.outputFiles[0].text, renderContext);
const homeMarkup = renderToString(React.createElement(renderContext.HomePrerender.TopPage));
let homeHtml = await readFile('index.html', 'utf8');
homeHtml = homeHtml.replace(
  /<div id="root"[^>]*>[\s\S]*?<\/div>(?:<!-- \/home-prerender -->)?\s*(?=<script data-build-entry="viewport_recovery")/,
  `<div id="root" aria-live="polite" data-prerendered="top">${homeMarkup}</div><!-- /home-prerender -->\n\n`,
);
const homeText = homeMarkup.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
const fontText = [...new Set([...homeText, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'])].sort().join('');
const homeFontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400..900&display=swap&text=' + encodeURIComponent(fontText);
const fontKey = createHash('sha256').update(homeFontUrl).digest('hex').slice(0, 12);
const fontPath = `assets/fonts/NotoSansJP-home-${fontKey}.woff2`;
try {
  await readFile(fontPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const cssResponse = await fetch(homeFontUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' },
  });
  if (!cssResponse.ok) throw new Error(`Home font CSS: ${cssResponse.status}`);
  const fontCss = await cssResponse.text();
  const fontUrl = fontCss.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!fontUrl) throw new Error('Home font source missing');
  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) throw new Error(`Home font: ${fontResponse.status}`);
  const fontBytes = Buffer.from(await fontResponse.arrayBuffer());
  if (fontBytes.subarray(0, 4).toString() !== 'wOF2') throw new Error('Home font must be WOFF2');
  await writeFile(fontPath, fontBytes);
}
const homeFontCss = `@font-face{font-family:"Noto Sans JP";font-style:normal;font-weight:400 900;font-display:swap;src:url("/${fontPath}") format("woff2")}\n`;
const homeFontCssHash = createHash('sha256').update(homeFontCss).digest('hex').slice(0, 12);
const homeFontCssPath = `dist/home-font-${homeFontCssHash}.css`;
await writeFile(homeFontCssPath, homeFontCss);
homeHtml = homeHtml.replace(/(<link id="brand-font-styles" href=")[^"]+/, `$1/${homeFontCssPath}`);
homeHtml = homeHtml.replace(/(<noscript id="brand-font-fallback"><link href=")[^"]+/, `$1/${homeFontCssPath}`);
await writeFile('index.html', homeHtml);

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
