// Tiny router + request guard + static files on node:http. No framework.
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
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
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2',
};

/** Serve a file from `root`, refusing path traversal. Returns false when not found. */
export async function serveStatic(res, root, path) {
  const base = resolve(root);
  const file = resolve(join(base, path));
  if (file !== base && !file.startsWith(base + sep)) return false;
  let data;
  try { data = await readFile(file); } catch { return false; }
  const type = TYPES[extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache' });
  res.end(data);
  return true;
}

export const accessLevel = LEVEL;
