// Tiny router + request guard + static files on node:http. No framework.
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants as zlib } from 'node:zlib';
import { LOOPBACK } from './config.js';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const LEVEL = { public: 0, read: 1, admin: 2 };

export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler, opts = {}) =>
    routes.push({ method, parts: pattern.split('/'), handler, access: opts.access || 'admin', raw: Boolean(opts.raw), csrf: opts.csrf !== false });
  return {
    get: (p, h, o) => add('GET', p, h, o),
    post: (p, h, o) => add('POST', p, h, o),
    put: (p, h, o) => add('PUT', p, h, o),
    patch: (p, h, o) => add('PATCH', p, h, o),
    delete: (p, h, o) => add('DELETE', p, h, o),
    match(method, path) {
      const parts = path.split('/');
      for (const route of routes) {
        if (route.method !== method || route.parts.length !== parts.length) continue;
        const params = {};
        let ok = true;
        for (let i = 0; i < parts.length && ok; i++) {
          const p = route.parts[i];
          if (!p.startsWith(':')) ok = p === parts[i];
          else try { params[p.slice(1)] = decodeURIComponent(parts[i]); } catch { ok = false; } // bad escape → no match
        }
        if (ok) return { route, params };
      }
      return null;
    },
  };
}

/** Hosts we answer to (DNS-rebinding defence). Port-aware for loopback names. */
export function hostAllowed(hostHeader, config) {
  const host = String(hostHeader || '').toLowerCase();
  if (!host) return false;
  if (host === config.publicHost || config.allowedHosts.includes(host)) return true;
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const port = host.match(/:(\d+)$/)?.[1];
  return LOOPBACK.has(name) && (!port || Number(port) === config.port);
}

/** Browser-originated writes must come from our own origin (CSRF). Bearer-key calls are not ambient, so allowed. */
export function writeAllowed(req) {
  if (req.headers.authorization?.startsWith('Bearer ')) return true;
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.origin;
  if (!origin) return false;
  try { return new URL(origin).host.toLowerCase() === String(req.headers.host).toLowerCase(); } catch { return false; }
}

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; media-src 'self' data: https:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'");
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

export async function readBody(req, limit = 256 * 1024) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, 'Request body too large');
      chunks.push(chunk);
    }
  } catch (err) {
    throw err instanceof HttpError ? err : new HttpError(400, 'Request aborted', 'aborted');
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, 'JSON body expected');
  let data;
  try { data = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON'); }
  if (data === null || typeof data !== 'object') throw new HttpError(400, 'JSON object expected');
  return data;
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const raw = part.slice(i + 1).trim();
    let value = raw;
    try { value = decodeURIComponent(raw); } catch { /* foreign cookie with a stray %: keep raw */ }
    out[part.slice(0, i).trim()] = value;
  }
  return out;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

/** Fingerprint of root/assets (names, sizes, dates): changes with every update or edit of any asset. */
const stamps = new Map(); // root → { at, value }
async function assetStamp(root) {
  // ponytail: 2 s cache, so a page load (a dozen requests) lists the folder once; an edit shows up 2 s later at most.
  const hit = stamps.get(root);
  if (hit && Date.now() - hit.at < 2000) return hit.value;
  const dir = join(root, 'assets');
  const hash = createHash('sha256');
  for (const name of (await readdir(dir)).sort()) {
    const s = await stat(join(dir, name));
    hash.update(`${name} ${s.size} ${s.mtimeMs}\n`);
  }
  const value = hash.digest('base64url').slice(0, 12);
  stamps.set(root, { at: Date.now(), value });
  return value;
}
const ASSET_REF = /(["'])\/assets\/([\w.-]+\.(?:js|css|svg|png|webp|woff2|wav))\1/g;
const STAMPED = new Set(['.html', '.js', '.css']); // files whose /assets/ references get the stamp
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json']);
const packed = new Map(); // "file encoding" → compressed body, for the current stamp only
let packedStamp = '';
const brotli = promisify(brotliCompress), gz = promisify(gzip);

/** Brotli (or gzip) body of a text file, compressed once per asset version: about 4× fewer bytes for a remote dashboard. */
async function compressed(file, stamp, data, accept) {
  const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (!enc || data.length < 1024) return null;
  if (packedStamp !== stamp) { packed.clear(); packedStamp = stamp; }
  const key = `${file} ${enc}`;
  if (!packed.has(key)) packed.set(key, await (enc === 'br' ? brotli(data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }) : gz(data, { level: 9 })));
  return { enc, body: packed.get(key) };
}

/**
 * Serve a file from `root`, refusing path traversal. Returns false when not found.
 * Pages and scripts get their /assets/ references stamped (?v=): a stamped asset is cached for good (tab switches in
 * a dock load nothing again), and any changed asset changes every stamp, so a browser never mixes old and new files.
 */
export async function serveStatic(res, root, path, v = null) {
  const base = resolve(root);
  const file = resolve(join(base, path));
  if (file !== base && !file.startsWith(base + sep)) return false;
  let data;
  try { data = await readFile(file); } catch { return false; }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  const html = type.startsWith('text/html');
  const stamp = await assetStamp(base);
  const ext = extname(file);
  const headers = { 'Content-Type': type, 'Cache-Control': html ? 'no-store' : v === stamp ? 'public, max-age=31536000, immutable' : 'no-cache' };
  // Unstamped requests (dynamic imports, the chime) revalidate against the stamp, the version of every asset at once.
  if (!html) {
    headers.ETag = `"${stamp}"`;
    if (res.req?.headers['if-none-match'] === headers.ETag) { res.writeHead(304, headers); res.end(); return true; }
  }
  if (STAMPED.has(ext)) data = Buffer.from(String(data).replace(ASSET_REF, (_, q, name) => `${q}/assets/${name}?v=${stamp}${q}`));
  const packedBody = COMPRESSIBLE.has(ext) ? await compressed(file, stamp, data, res.req?.headers['accept-encoding'] || '') : null;
  if (COMPRESSIBLE.has(ext)) headers.Vary = 'Accept-Encoding';
  if (packedBody) headers['Content-Encoding'] = packedBody.enc;
  res.writeHead(200, headers);
  res.end(packedBody ? packedBody.body : data);
  return true;
}

export const accessLevel = LEVEL;
