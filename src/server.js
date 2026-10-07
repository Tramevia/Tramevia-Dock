#!/usr/bin/env node
// Tramevia Dock — entry point. Wires config, storage, auth, realtime hub, platform adapters and routes.
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backup } from 'node:sqlite';
import { config, checkConfig } from './config.js';
import { openDb, settings as settingsStore } from './db.js';
import { initKeys, randomId, seal, unseal, pkcePair } from './crypto.js';
import { createRouter, hostAllowed, writeAllowed, securityHeaders, sendJson, sendHtml, readJson, readBody, serveStatic, HttpError, accessLevel } from './http.js';
import { createAuth } from './auth.js';
import { createHub } from './hub.js';
import { createAccounts } from './accounts.js';
import { request, ApiError } from './net.js';
import { adapters, platformMeta, PLATFORMS } from './platforms/index.js';
import * as upd from './update.js';

/** Feature modules load independently (a broken one is logged, not fatal). */
async function load(path, fallback) {
  try { return await import(path); } catch (err) { console.error(`[modules] ${path} failed to load: ${err.stack || err.message}`); return fallback; }
}
const { tokenize, loadEmotes } = await load('./chat/emotes.js', {
  tokenize: ({ fragments }) => fragments, loadEmotes: async () => {},
});
const featureModules = await Promise.all(['./chat/routes.js', './community.js', './stream-info.js'].map(p => load(p, {})));

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const PAGES = {
  '/': 'index.html', '/chat': 'chat.html', '/events': 'chat.html', '/community': 'community.html',
  '/stream': 'stream.html', '/overlay/chat': 'overlay.html',
};

const log = {
  info: (...a) => console.log(new Date().toISOString().slice(11, 19), ...a),
  warn: (...a) => console.warn(new Date().toISOString().slice(11, 19), 'WARN', ...a),
  error: (...a) => console.error(new Date().toISOString().slice(11, 19), 'ERROR', ...a),
};

const problems = checkConfig();
if (problems.length) {
  console.error('\nConfiguration error / Erreur de configuration:\n - ' + problems.join('\n - ') + '\n');
  process.exit(1);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
if (upd.interrupted(ROOT)) { // an update stopped halfway (window closed, power cut): put the previous version back first
  upd.restore(ROOT);
  console.error('\n[FR] Mise à jour interrompue : version précédente restaurée. / [EN] Update interrupted: previous version restored.\n');
  process.exit(upd.RESTART); // the launcher starts the restored version
}

mkdirSync(config.dataDir, { recursive: true });
initKeys(config.tokenKey, config.dataDir);
const DB_FILE = resolve(config.dataDir, 'tramevia-dock.db');
const db = (() => { try { return openDb(DB_FILE); } catch (err) { console.error(`\n${err.message}\n`); process.exit(1); } })();
const settings = settingsStore(db);
if (!settings.get('seenSince')) settings.set('seenSince', Date.now());
const hub = createHub();
const auth = createAuth({ config, settings, log, t: (fr, en) => (settings.get('ui', {}).lang === 'fr' ? fr : en) });
const router = createRouter();
const pendingAuth = new Map(); // state -> { platform, reconnect, pending, at }

// ---------------------------------------------------------------------------
// Kernel context handed to every adapter and module (SPEC.md §Context).
const seenInsert = db.prepare('insert or ignore into seen_users (platform, user_id, first_seen) values (?, ?, ?)');
const ctx = {
  config, db, settings, hub, log, router, adapters, request, ApiError, tokenize,
  emotes: { load: loadEmotes },
  redirectUri: platform => `${config.publicUrl}/auth/${platform}/callback`,
  /** App credentials for a platform: env first, then wizard (sealed in settings). */
  app(platform) {
    const env = config.apps[platform];
    if (env?.clientId && env?.clientSecret) return { clientId: env.clientId.trim(), clientSecret: env.clientSecret.trim(), source: 'env' };
    const stored = settings.get(`app:${platform}`);
    if (!stored) return null;
    try { return { ...unseal(stored, `app:${platform}`), source: 'wizard' }; } catch { return null; }
  },
  /** True the first time a chatter is ever seen (after a 3-day warm-up so a fresh install doesn't flag everyone). */
  isFirstChatter(platform, userId) {
    const inserted = seenInsert.run(platform, String(userId), Date.now()).changes === 1;
    return inserted && Date.now() - settings.get('seenSince') > 3 * 86400_000;
  },
  emitChat(msg) {
    if (msg.flags.first === undefined && msg.author?.id && !msg.flags.self) msg.flags.first = ctx.isFirstChatter(msg.platform, msg.author.id);
    hub.publish('chat', msg);
  },
  emitEvent: evt => hub.publish('event', evt),
  /** Server-side text in the dashboard language: ctx.t('Texte FR', 'English text'). */
  t: (fr, en) => (settings.get('ui', {}).lang === 'fr' ? fr : en),
  emitDelete: d => hub.publish('chat:delete', d),
};
ctx.accounts = createAccounts(ctx);

function adapterFor(account) {
  return adapters.get(account.demo ? 'demo' : account.platform);
}
ctx.adapterFor = adapterFor;

/** Look up an account by id or throw 404. */
ctx.requireAccount = id => {
  const account = ctx.accounts.get(id);
  if (!account) throw new HttpError(404, ctx.t('Compte inconnu.', 'Unknown account.'), 'unknown_account');
  return account;
};

function openSystemBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// Core routes. Feature modules register theirs below.
router.get('/healthz', () => ({ ok: true, version: config.version }), { access: 'public' });

router.get('/api/session', ({ access }) => ({
  access, passwordRequired: auth.passwordRequired(), demo: config.demo, version: config.version,
}), { access: 'public' });

router.post('/api/login', ({ req, res, body }) => { auth.login(req, res, body.password); return { ok: true }; }, { access: 'public' });
router.post('/api/logout', ({ res }) => { auth.logout(res); return { ok: true }; }, { access: 'public' });

router.get('/api/state', ({ access }) => {
  const accounts = ctx.accounts.list().map(ctx.accounts.describe);
  return {
    access, version: config.version, demo: config.demo, publicUrl: config.publicUrl,
    platforms: platformMeta(ctx),
    accounts: access === 'admin' ? accounts
      : accounts.map(({ id, platform, login, displayName, avatar, stats }) => ({ id, platform, login, displayName, avatar, stats })),
    ui: settings.get('ui', {}),
  };
}, { access: 'read' });

router.get('/api/settings', () => settings.get('ui', {}));
// Shallow merge: pages send only what they change; a null value removes the key.
router.put('/api/settings', ({ body }) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid settings');
  if ('lang' in body && body.lang !== null && !['fr', 'en'].includes(body.lang)) throw new HttpError(400, 'lang must be fr or en');
  if ('theme' in body && body.theme !== null && !['dark', 'light', 'auto'].includes(body.theme)) throw new HttpError(400, 'theme must be dark, light or auto');
  for (const k of ['updateCheck', 'updateAuto']) if (k in body && body[k] !== null && typeof body[k] !== 'boolean') throw new HttpError(400, `${k} must be true, false or null`);
  const merged = { ...settings.get('ui', {}), ...body };
  for (const [k, v] of Object.entries(merged)) if (v === null) delete merged[k];
  if (JSON.stringify(merged).length > 32_000) throw new HttpError(413, 'Settings too large');
  settings.set('ui', merged);
  hub.publish('settings', merged);
  if ('updateCheck' in body || 'updateAuto' in body) publishUpdate();
  return merged;
});

// --- Platform apps (client id / secret) -------------------------------------
router.get('/api/apps', () => PLATFORMS.filter(p => p.auth === 'oauth').map(p => {
  const app = ctx.app(p.id);
  return { platform: p.id, configured: Boolean(app), source: app?.source || null, clientId: app?.clientId || '', redirectUri: ctx.redirectUri(p.id) };
}));

router.put('/api/apps/:platform', ({ params, body }) => {
  const p = adapters.get(params.platform);
  if (!p || p.auth !== 'oauth') throw new HttpError(404, 'Unknown platform');
  if (ctx.app(p.id)?.source === 'env') throw new HttpError(409, ctx.t('Ces identifiants viennent des variables d’environnement : modifie-les là-bas.', 'Credentials come from environment variables; edit them there.'), 'env_locked');
  const clientId = String(body.clientId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim() || ctx.app(p.id)?.clientSecret || '';
  if (!/^[\w.\-]{6,200}$/.test(clientId) || clientSecret.length < 6 || clientSecret.length > 400) throw new HttpError(400, ctx.t('Le Client ID ou le secret semble invalide.', 'Client ID or secret looks invalid.'), 'invalid_app');
  settings.set(`app:${p.id}`, seal({ clientId, clientSecret }, `app:${p.id}`));
  return { ok: true };
});

router.delete('/api/apps/:platform', ({ params }) => {
  settings.set(`app:${params.platform}`, null);
  return { ok: true };
});

router.post('/api/apps/:platform/test', async ({ params }) => {
  const p = adapters.get(params.platform);
  const app = ctx.app(params.platform);
  if (!p?.testApp) throw new HttpError(404, 'Unknown platform');
  if (!app) throw new HttpError(400, ctx.t('Enregistre d’abord le Client ID et le Client Secret.', 'Save the Client ID and Client Secret first.'), 'missing_app');
  return p.testApp(ctx, app);
});

// --- Accounts ---------------------------------------------------------------
router.post('/api/accounts/:platform/connect', async ({ params, body }) => {
  const p = adapters.get(params.platform);
  if (!p || !p.authorize) throw new HttpError(404, 'Unknown platform');
  const app = ctx.app(p.id);
  if (!app) throw new HttpError(400, ctx.t('Configure d’abord l’app de cette plateforme (Client ID / Secret).', 'Configure this platform app first (Client ID / Secret).'), 'missing_app');
  const now = Date.now();
  for (const [k, v] of pendingAuth) if (now - v.at > 600_000) pendingAuth.delete(k);
  const state = randomId(24);
  const { url, pending } = await p.authorize(ctx, { state, redirectUri: ctx.redirectUri(p.id), app, pkce: pkcePair(), reconnect: body.reconnect || null });
  pendingAuth.set(state, { platform: p.id, reconnect: body.reconnect || null, pending: pending || {}, at: now });
  const opened = body.openOnServer && config.loopbackOnly ? openSystemBrowser(url) : false;
  return { url, opened };
});

router.get('/auth/:platform/callback', async ({ params, url, req, res }) => {
  // Same language as the adapter errors embedded in the page (dashboard setting), else the browser's.
  const lang = settings.get('ui', {}).lang || (String(req.headers['accept-language'] || '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  const page = (ok, detail) => sendHtml(res, ok ? 200 : 400, callbackPage(lang, ok, detail));
  const state = url.searchParams.get('state') || '';
  const entry = pendingAuth.get(state);
  pendingAuth.delete(state);
  if (!entry || entry.platform !== params.platform || Date.now() - entry.at > 600_000) return page(false, lang === 'fr' ? 'Lien de connexion expiré ou déjà utilisé. Relance la connexion depuis le dock.' : 'Login link expired or already used. Start again from the dock.');
  if (url.searchParams.get('error') || !url.searchParams.get('code')) return page(false, url.searchParams.get('error_description') || url.searchParams.get('error') || 'Authorization denied.');
  const p = adapters.get(entry.platform);
  try {
    const result = await p.callback(ctx, { code: url.searchParams.get('code'), redirectUri: ctx.redirectUri(p.id), app: ctx.app(p.id), pending: entry.pending, query: Object.fromEntries(url.searchParams) });
    if (entry.reconnect) {
      const previous = ctx.accounts.get(entry.reconnect);
      if (previous && previous.platformUserId !== String(result.platformUserId)) {
        return page(false, (lang === 'fr' ? 'Ce n’est pas le même compte (attendu : ' : 'Wrong account (expected: ') + previous.login + '). ' + (lang === 'fr' ? 'Déconnecte-toi de la plateforme dans ce navigateur puis recommence.' : 'Log out of the platform in this browser and try again.'));
      }
    }
    const account = ctx.accounts.upsert({ platform: p.id, ...result });
    log.info(`[${p.id}] connected ${account.login}`);
    return page(true, `${p.name} · ${account.displayName}`);
  } catch (err) {
    log.warn(`[${p.id}] OAuth callback failed: ${err.message}`);
    return page(false, err.message);
  }
}, { access: 'public' });

router.post('/api/accounts/username/:platform', async ({ params, body }) => {
  const p = adapters.get(params.platform);
  if (!p || p.auth !== 'username' || !p.resolveUsername) throw new HttpError(404, 'Unknown platform');
  const result = await p.resolveUsername(ctx, String(body.username || ''));
  return ctx.accounts.upsert({ platform: p.id, ...result });
});

router.patch('/api/accounts/:id', ({ params, body }) => {
  ctx.requireAccount(params.id);
  if (!body.options || typeof body.options !== 'object' || Array.isArray(body.options) || JSON.stringify(body.options).length > 2048) throw new HttpError(400, 'options object expected (max 2 KB)');
  return ctx.accounts.setOptions(params.id, body.options);
});

router.post('/api/accounts/:id/restart', ({ params }) => {
  const account = ctx.requireAccount(params.id);
  if (account.status !== 'ok') ctx.accounts.setStatus(account.id, 'ok');
  ctx.accounts.restart(ctx.accounts.get(account.id));
  return { ok: true };
});

router.delete('/api/accounts/:id', async ({ params }) => {
  const account = ctx.requireAccount(params.id);
  const p = adapterFor(account);
  if (p.revoke && !account.demo) {
    try { await p.revoke(ctx, account, await ctx.accounts.tokens(account)); } catch { /* best effort */ }
  }
  ctx.accounts.remove(account.id);
  return { ok: true };
});

// --- Updates (SPEC.md §11) ----------------------------------------------------
// Every install type checks GitHub once a day and shows a notice; only zip installs (start.bat / start.sh) install.
const SNAPSHOT = resolve(config.dataDir, 'pre-update.db');
const justUpdated = existsSync(join(ROOT, '.update', 'unconfirmed')); // first start of a freshly installed version
const lastFailure = upd.failed(ROOT); // a rolled-back version; stale once this install is already past it (zip extracted over)
const update = { type: upd.installType(ROOT), latest: null, checkedAt: 0, state: 'idle', error: null,
  failed: lastFailure && upd.newer(lastFailure.version, config.version) ? lastFailure : null };
const checksOn = () => process.env.UPDATE_CHECK !== '0' && settings.get('ui', {}).updateCheck !== false; // default ON
const autoOn = () => update.type === 'zip' && settings.get('ui', {}).updateAuto === true;                   // default OFF
/** 'live' | 'off' | 'unknown' over enabled accounts ('error' ones may be live while their chat reconnects). */
function liveState() {
  const v = ctx.accounts.list().filter(a => a.status !== 'disabled').map(a => ctx.accounts.stats(a.id)?.live);
  return v.includes(true) ? 'live' : v.every(x => x === false) ? 'off' : 'unknown';
}
const updateStatus = () => ({
  type: update.type, current: config.version,
  latest: update.latest && { version: update.latest.version, notesUrl: update.latest.notesUrl },
  checkedAt: update.checkedAt, state: update.state, error: update.error, failed: update.failed,
  live: liveState(), checks: checksOn(), auto: autoOn(), image: 'ghcr.io/tramevia/tramevia-dock',
});
const publishUpdate = () => hub.publish('update', updateStatus());
let lastLive = null;
hub.on(t => { if ((t === 'stats' || t === 'accounts') && liveState() !== lastLive) { lastLive = liveState(); publishUpdate(); } });

let checking = null, lastCheck = 0, checkFailed = false;
/** GitHub releases/latest (UPDATE_CHECK=0 = no network call at all). One request at a time. */
function checkUpdate() {
  if (process.env.UPDATE_CHECK === '0') return Promise.resolve();
  lastCheck = Date.now();
  return checking ??= upd.checkLatest(config.version).then(latest => {
    checkFailed = false;
    Object.assign(update, { latest, checkedAt: Date.now() });
    if (update.state === 'error') Object.assign(update, { state: 'idle', error: null }); // auto install retries once per check
  }, err => { checkFailed = true; log.warn(`[update] check failed: ${err.message}`); }) // keeps the last known result
    .finally(() => { checking = null; publishUpdate(); autoInstall(); });
}

function autoInstall() {
  if (!autoOn() || config.demo || update.state !== 'idle' || !update.latest || update.latest.version === update.failed?.version || liveState() !== 'off') return;
  log.info(`[update] automatic install of ${update.latest.version}`);
  install();
}

const updateError = err => (err.update === 'download' ? ctx.t(`téléchargement impossible (HTTP ${err.status})`, `download failed (HTTP ${err.status})`)
  : err.update === 'corrupt' ? ctx.t('téléchargement corrompu (taille ou SHA-256 différents)', 'download corrupted (size or SHA-256 mismatch)')
  : err.update === 'bundle' ? ctx.t('contenu de la mise à jour inattendu', 'unexpected update content')
  : err.update === 'node' ? ctx.t(`installe d’abord Node.js ${err.need}`, `install Node.js ${err.need} first`)
  : err.name === 'TimeoutError' || err.message === 'fetch failed' ? ctx.t('GitHub injoignable', 'GitHub unreachable')
  : err.message);

/** Stage + verify while running, snapshot the DB, then stop, swap the files and exit 75 (the launcher restarts us). */
async function install() {
  const target = update.latest;
  Object.assign(update, { state: 'installing', error: null });
  publishUpdate();
  try {
    await upd.stage(ROOT, target);
    await backup(db, SNAPSHOT);
  } catch (err) {
    log.warn(`[update] ${target.version} not installed: ${err.message}`);
    Object.assign(update, { state: 'error', error: updateError(err) });
    return publishUpdate();
  }
  log.info(`[update] installing ${target.version}, restarting…`);
  shutdown(() => {
    try { upd.swap(ROOT, { from: config.version, to: target.version, db: DB_FILE, snapshot: SNAPSHOT }); } catch (err) {
      log.error(`[update] swap failed, previous version restored: ${err.message}`); // restore() already ran: exit 75 restarts the old version
    }
    process.exit(upd.RESTART);
  });
}

router.get('/api/update', () => updateStatus());
router.post('/api/update/check', async () => { // manual "Check now": at most one GitHub request per minute
  await (Date.now() - lastCheck >= 60_000 ? checkUpdate() : checking);
  if (checkFailed) throw new HttpError(502, ctx.t('GitHub ne répond pas pour le moment : réessaie plus tard.', 'GitHub is not answering right now: try again later.'), 'check_failed');
  return updateStatus();
});
router.post('/api/update/install', ({ body }) => {
  const no = (code, fr, en) => { throw new HttpError(409, ctx.t(fr, en), code); };
  if (config.demo) no('demo', 'Les mises à jour sont désactivées en mode démo.', 'Updates are disabled in demo mode.');
  if (update.type !== 'zip') no('not_zip', 'Cette installation ne peut pas se mettre à jour toute seule : suis les instructions affichées.', 'This install can’t update itself: follow the instructions shown.');
  if (update.state === 'installing') no('busy', 'Une mise à jour est déjà en cours.', 'An update is already running.');
  if (!update.latest) no('no_update', 'Aucune mise à jour disponible.', 'No update available.');
  if (body.version !== update.latest.version) no('version_mismatch', `La version disponible est ${update.latest.version}.`, `The available version is ${update.latest.version}.`);
  const live = liveState();
  if (live === 'live') no('live', 'Un compte est en live : installe la mise à jour après ton live.', 'An account is live: install the update after your live.');
  if (live === 'unknown' && body.force !== true) no('live_unknown', 'Statut du live inconnu : confirme pour installer quand même.', 'Live status unknown: confirm to install anyway.');
  install();
  return { ok: true };
});

// --- Security ---------------------------------------------------------------
router.get('/api/keys', () => auth.keys());
router.post('/api/security/rotate', ({ body }) => { auth.rotate(body.what); hub.revalidate(); return auth.keys(); });

for (const mod of featureModules) mod.register?.(router, ctx);
for (const p of PLATFORMS) p.routes?.(router, ctx);

// ---------------------------------------------------------------------------
function callbackPage(lang, ok, detail) {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const title = ok ? (lang === 'fr' ? 'Compte connecté' : 'Account connected') : (lang === 'fr' ? 'Connexion impossible' : 'Connection failed');
  const hint = ok ? (lang === 'fr' ? 'Tu peux fermer cet onglet et revenir dans OBS : le dock se met à jour tout seul.' : 'You can close this tab and go back to OBS: the dock updates by itself.') : '';
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Tramevia Dock</title><link rel="stylesheet" href="/assets/ui.css"><link rel="icon" href="/assets/logo.svg"><body class="center-page"><main class="card callback ${ok ? 'ok' : 'fail'}"><img src="/assets/logo.svg" alt="" width="48" height="48"><h1>${ok ? '✓ ' : '⚠ '}${esc(title)}</h1><p>${esc(detail)}</p><p class="muted">${esc(hint)}</p><a class="btn" href="/">${lang === 'fr' ? 'Ouvrir le tableau de bord' : 'Open dashboard'}</a></main></body></html>`;
}

async function handle(req, res) {
  securityHeaders(res);
  let url;
  try { url = new URL(req.url, 'http://local'); } catch { return sendJson(res, 400, { error: 'Bad request', code: 'bad_request' }); }
  if (url.pathname !== '/healthz' && !hostAllowed(req.headers.host, config)) {
    return sendJson(res, 421, { error: 'Host not allowed. Set PUBLIC_URL or ALLOWED_HOSTS.', code: 'bad_host' });
  }
  try {
    const access = auth.access(req, url);
    const found = router.match(req.method, url.pathname);
    if (found) {
      const { route, params } = found;
      if (accessLevel[access] < accessLevel[route.access]) {
        throw new HttpError(access === 'public' ? 401 : 403, access === 'public' ? 'Login required' : 'Not allowed with this key', 'unauthorized');
      }
      if (!['GET', 'HEAD'].includes(req.method) && route.csrf && !writeAllowed(req)) throw new HttpError(403, 'Cross-site request refused', 'bad_origin');
      const body = route.raw ? await readBody(req) : ['GET', 'HEAD', 'DELETE'].includes(req.method) ? {} : await readJson(req);
      const result = await route.handler({ req, res, url, params, query: Object.fromEntries(url.searchParams), body, access });
      if (!res.headersSent && !res.writableEnded) sendJson(res, 200, result ?? { ok: true });
      return;
    }
    if (req.method === 'GET') {
      if (PAGES[url.pathname] && await serveStatic(res, PUBLIC_DIR, PAGES[url.pathname])) return;
      if (url.pathname.startsWith('/assets/') && await serveStatic(res, PUBLIC_DIR, url.pathname.slice(1))) return;
      if (url.pathname === '/favicon.ico' && await serveStatic(res, PUBLIC_DIR, 'assets/logo.svg')) return;
    }
    throw new HttpError(404, 'Not found', 'not_found');
  } catch (err) {
    if (res.headersSent) { res.end(); return; }
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message, code: err.code });
    if (err instanceof ApiError) {
      log.warn(`[${err.platform}] ${req.method} ${url.pathname}: ${err.status} ${err.message}`);
      return sendJson(res, 502, { error: err.message, code: 'platform_error', platform: err.platform, status: err.status });
    }
    log.error(req.method, url.pathname, err);
    return sendJson(res, 500, { error: 'Internal error', code: 'internal' });
  }
}

// Backstop: a request must never take the process down.
const server = createServer((req, res) => {
  handle(req, res).catch(err => {
    log.error('request failed', req.method, err);
    if (!res.headersSent) sendJson(res, 400, { error: 'Bad request', code: 'bad_request' }); else res.end();
  });
});
server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url, 'http://local');
    const origin = req.headers.origin;
    const sameOrigin = !origin || (() => { try { return new URL(origin).host.toLowerCase() === String(req.headers.host).toLowerCase(); } catch { return false; } })();
    const access = auth.access(req, url);
    if (url.pathname !== '/ws' || !hostAllowed(req.headers.host, config) || !sameOrigin || access === 'public') {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return socket.destroy();
    }
    hub.upgrade(req, socket, head, access, level => ({
      access: level, version: config.version, // pages reload when it changes (update installed)
      accounts: level === 'admin' ? ctx.accounts.list().map(ctx.accounts.describe)
        : ctx.accounts.list().map(a => ({ id: a.id, platform: a.platform, login: a.login, displayName: a.displayName, avatar: a.avatar, stats: ctx.accounts.stats(a.id) })),
      ui: settings.get('ui', {}),
    }), () => auth.access(req, url));
  } catch {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
  }
});
server.on('error', err => {
  console.error(err.code === 'EADDRINUSE'
    ? `\nLe port ${config.port} est déjà utilisé : Tramevia Dock tourne probablement déjà (${config.publicUrl}).\nPort ${config.port} is already in use: Tramevia Dock is probably already running (${config.publicUrl}).\n`
    : err.message);
  process.exit(err.code === 'EADDRINUSE' ? 98 : 1); // 98: another instance runs, the launchers must not roll back
});
// Last-resort guard: a stray promise rejection in a platform adapter must not kill the dock (Node exits by default).
process.on('unhandledRejection', err => log.error('Unhandled rejection (kept running):', err?.stack || err));

server.listen(config.port, config.host, () => {
  const dashboard = config.publicUrl;
  log.info(`Tramevia Dock ${config.version} — ${dashboard}${config.demo ? ' (DEMO MODE)' : ''}`);
  if (!config.adminPassword) log.info('No ADMIN_PASSWORD: dashboard open to this computer only (loopback).');
  if (config.demo) adapters.get('demo').start(ctx);
  ctx.accounts.startAll();
  if (config.openBrowser && process.stdout.isTTY && !process.env.NO_OPEN && !justUpdated) openSystemBrowser(dashboard); // no new tab per update
  if (justUpdated) { // survived 30 s: keep this version (a crash before that makes the launcher roll back)
    log.info(`[update] now running ${config.version}`);
    setTimeout(() => { upd.confirm(ROOT); update.failed = null; publishUpdate(); log.info(`[update] ${config.version} confirmed`); },
      Number(process.env.UPDATE_CONFIRM_MS) || 30_000).unref(); // UPDATE_CONFIRM_MS: tests only
  }
  setTimeout(() => {
    const tick = () => { if (checksOn()) checkUpdate(); };
    tick();
    setInterval(tick, 86_400_000).unref();
  }, 60_000).unref();
  setInterval(autoInstall, 600_000).unref(); // local only: installs a pending update once every account is off-live
});

let stopping = false;
/** Stop accounts, sockets and the server; `then` runs once, after db.close(), when the server has closed or after 3 s. */
function shutdown(then = () => process.exit(0)) {
  if (stopping) return;
  stopping = true;
  log.info('Shutting down…');
  for (const a of ctx.accounts.list()) ctx.accounts.stop(a.id);
  hub.close();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try { db.close(); } catch { /* already closed */ }
    then();
  };
  server.close(finish);
  server.closeAllConnections(); // browsers keep pre-opened sockets that would hold close() until the timeout
  setTimeout(finish, 3000); // NOT unref'd: an update swaps files in `then`; the process must not exit 0 before that
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
