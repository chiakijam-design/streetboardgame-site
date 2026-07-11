import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: {
    prototype_character: 'prototype_character.jsx',
    prototype_app: 'prototype_app.jsx',
  },
  outdir: 'dist',
  bundle: false,
  format: 'iife',
  target: ['es2018'],
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
});
