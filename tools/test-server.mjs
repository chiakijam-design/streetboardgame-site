import http from 'node:http';
import path from 'node:path';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.TEST_PORT || 4173);

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key, options = {}) {
    const item = this.values.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return options && options.type === 'json' ? JSON.parse(item.value) : item.value;
  }
  async put(key, value, options = {}) {
    const ttl = Number(options.expirationTtl || 0);
    this.values.set(key, { value: String(value), expiresAt: ttl ? Date.now() + ttl * 1000 : 0 });
  }
  async delete(key) { this.values.delete(key); }
}

const bundle = await build({
  entryPoints: [path.join(root, '_worker.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
  logLevel: 'silent',
});
const workerPath = path.join(root, '.test-worker.mjs');
await writeFile(workerPath, bundle.outputFiles[0].text);
const worker = (await import(`${pathToFileURL(workerPath).href}?v=${Date.now()}`)).default;
const kv = new MemoryKV();

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function staticPath(urlPath) {
  if (['/', '/love', '/friends', '/family', '/about', '/product'].includes(urlPath)) return 'index.html';
  if (urlPath === '/remote') return 'remote.html';
  return urlPath.replace(/^\/+/, '');
}

async function toRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(`http://${host}:${port}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
}

async function sendWebResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${host}:${port}`);
    if (parsed.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (parsed.pathname.startsWith('/api/remote/')) {
      const response = await worker.fetch(await toRequest(req), {
        REMOTE_KV: kv,
        ASSETS: { fetch: () => new Response('Not found', { status: 404 }) },
      });
      await sendWebResponse(res, response);
      return;
    }

    const relative = staticPath(parsed.pathname);
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep) && absolute !== path.join(root, 'index.html')) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const data = await readFile(absolute);
    res.writeHead(200, {
      'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500;
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not found' : String(error && error.stack || error));
  }
});

server.listen(port, host, () => process.stdout.write(`test server: http://${host}:${port}\n`));
const close = () => server.close(() => unlink(workerPath).catch(() => {}));
process.on('SIGINT', close);
process.on('SIGTERM', close);
