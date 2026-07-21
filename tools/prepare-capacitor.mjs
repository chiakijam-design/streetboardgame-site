import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const output = 'ios-web';
const files = [
  'index.html',
  'remote.html',
  '404.html',
  'manifest.webmanifest',
  'favicon.ico',
  'favicon.svg',
];
const directories = ['assets', 'dist'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(files.map((file) => cp(file, `${output}/${file}`)));
await Promise.all(directories.map((directory) => cp(directory, `${output}/${directory}`, { recursive: true })));

const appHtmlFiles = ['index.html', 'remote.html'];
const automaticNetworkTags = [
  /\s*<link[^>]+href=["']https:\/\/(?:www\.googletagmanager\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)[^"']*["'][^>]*>\s*/gi,
  /\s*<script[^>]+src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["'][^>]*><\/script>\s*/gi,
  /\s*<script>\s*window\.dataLayer = window\.dataLayer \|\| \[\];[\s\S]*?window\.trackEvent = function\(name, params\) \{[\s\S]*?<\/script>\s*/gi,
];

for (const file of appHtmlFiles) {
  const path = `${output}/${file}`;
  let html = await readFile(path, 'utf8');
  for (const pattern of automaticNetworkTags) {
    html = html.replace(pattern, '\n');
  }
  html = html.replace(
    /<\/head>/i,
    '  <script>window.trackEvent = window.trackEvent || function() {};</script>\n</head>',
  );
  await writeFile(path, html, 'utf8');
}

process.stdout.write(`Capacitor web assets prepared in ${output}/\n`);
