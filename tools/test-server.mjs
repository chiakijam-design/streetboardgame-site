import http from 'node:http';
import path from 'node:path';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.TEST_PORT || 4173);
const HASHED_JS_PATH = /^\/(?:dist\/[a-z0-9_]+-[a-z0-9]{8}|assets\/vendor\/react(?:-dom)?\.production\.min-[a-f0-9]{12})\.js$/i;

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

class MemoryR2 {
  constructor() { this.values = new Map(); }
  async put(key, value, options = {}) {
    const bytes = value instanceof ReadableStream
      ? new Uint8Array(await new Response(value).arrayBuffer())
      : new Uint8Array(await new Response(value).arrayBuffer());
    this.values.set(key, { bytes, httpMetadata: options.httpMetadata || {} });
  }
  async get(key) {
    const item = this.values.get(key);
    if (!item) return null;
    return {
      body: new Blob([item.bytes]).stream(),
      arrayBuffer: async () => item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength),
      writeHttpMetadata(headers) {
        if (item.httpMetadata.contentType) headers.set('content-type', item.httpMetadata.contentType);
      },
    };
  }
  async delete(keys) { (Array.isArray(keys) ? keys : [keys]).forEach((key) => this.values.delete(key)); }
}

class PassthroughImages {
  async info() { return { width: 512, height: 512, format: 'image/png' }; }
  input(stream) {
    const bytes = new Response(stream).arrayBuffer();
    return {
      transform() { return this; },
      async output() { return { body: new Uint8Array(await bytes) }; },
    };
  }
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
const media = new MemoryR2();
const images = new PassthroughImages();

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
  if (urlPath === '/live') return 'live.html';
  if (urlPath === '/live-ops') return 'live_ops.html';
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

async function fetchStaticAsset(request) {
  const parsed = new URL(request.url);
  const relative = staticPath(parsed.pathname);
  const absolute = path.resolve(root, relative);
  const relativeToRoot = path.relative(root, absolute);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const data = await readFile(absolute);
    return new Response(request.method === 'HEAD' ? null : data, {
      status: 200,
      headers: {
        'content-type': mime[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
        'cache-control': HASHED_JS_PATH.test(parsed.pathname)
          ? 'public, max-age=31536000, immutable'
          : 'no-store',
      },
    });
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
      return new Response('Not found', { status: 404 });
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${host}:${port}`);
    if (parsed.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    const response = await worker.fetch(await toRequest(req), {
      REMOTE_KV: kv,
      LIVE_MEDIA: media,
      IMAGES: images,
      LIVE_CREATOR_INVITE_BYPASS_TOKEN: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      ASSETS: { fetch: fetchStaticAsset },
    });
    await sendWebResponse(res, response);
  } catch (error) {
    const status = error && error.code === 'ENOENT' ? 404 : 500;
    if (status === 404) {
      const data = await readFile(path.join(root, '404.html'));
      res.writeHead(404, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, follow',
      });
      res.end(data);
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(error && error.stack || error));
  }
});

server.listen(port, host, () => process.stdout.write(`test server: http://${host}:${port}\n`));
const close = () => server.close(() => unlink(workerPath).catch(() => {}));
process.on('SIGINT', close);
process.on('SIGTERM', close);
