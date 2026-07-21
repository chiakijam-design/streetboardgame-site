import { cp, mkdir, rm } from 'node:fs/promises';

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

process.stdout.write(`Capacitor web assets prepared in ${output}/\n`);
