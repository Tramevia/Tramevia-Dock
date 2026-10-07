// Connected accounts: storage (tokens sealed), single-flight token refresh,
// realtime connection lifecycle and periodic stats polling.
import { randomId, seal, unseal } from './crypto.js';
import { ApiError } from './net.js';
import { HttpError } from './http.js';

const STATS_TICK = 10_000;

export function createAccounts(ctx) {
  const { db, hub, log } = ctx;
  const q = {
    all: db.prepare('select * from accounts order by position, created_at'),
    one: db.prepare('select * from accounts where id = ?'),
    find: db.prepare('select id from accounts where platform = ? and platform_user_id = ?'),
    insert: db.prepare(`insert into accounts (id, platform, platform_user_id, login, display_name, avatar, scopes, secret, status, error, options, position, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, 'ok', null, ?, (select coalesce(max(position), 0) + 1 from accounts), ?, ?)`),
    update: db.prepare(`update accounts set login = ?, display_name = ?, avatar = ?, scopes = ?, secret = ?, status = 'ok', error = null, updated_at = ? where id = ?`),
    secret: db.prepare('update accounts set secret = ?, updated_at = ? where id = ?'),
    status: db.prepare('update accounts set status = ?, error = ?, updated_at = ? where id = ?'),
    options: db.prepare('update accounts set options = ?, updated_at = ? where id = ?'),
    remove: db.prepare('delete from accounts where id = ?'),
  };
  const running = new Map();   // id -> { stop() }
  const retries = new Map();   // id -> timeout
  const refreshing = new Map(); // id -> Promise<tokens>
  const starting = new Map();   // id -> token of the newest start() (stop() cancels in-flight starts)
  const stats = new Map();     // id -> { ...stats, at }
  const demo = new Map();      // id -> demo account (not persisted)

  const adapterOf = account => ctx.adapters.get(account.demo ? 'demo' : account.platform);

  function view(row) {
    return {
      id: row.id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      login: row.login,
      displayName: row.display_name || row.login,
      avatar: row.avatar || '',
      scopes: row.scopes ? row.scopes.split(' ') : [],
      status: row.status,
      error: row.error || '',
      options: JSON.parse(row.options || '{}'),
      demo: false,
    };
  }

  function list() {
    return [...q.all.all().map(view), ...demo.values()];
  }

  function get(id) {
    if (demo.has(id)) return demo.get(id);
    const row = q.one.get(id);
    return row ? view(row) : null;
  }

  /** Public description sent to the UI (no secrets), with per-account capabilities. */
  function describe(account) {
    const platform = ctx.adapters.get(account.platform);
    const caps = typeof platform?.capabilities === 'function' ? platform.capabilities(account, ctx) : platform?.capabilities;
    return { ...account, caps: caps || {}, stats: stats.get(account.id) || null };
  }

  function publishList() {
    hub.publish('accounts', list().map(describe));
  }

  /** Create or update an account after OAuth (or username entry for TikTok). */
  function upsert({ platform, platformUserId, login, displayName, avatar, scopes = [], tokens = null, options = {} }) {
    const now = Date.now();
    const existing = q.find.get(platform, String(platformUserId));
    const id = existing?.id || randomId(9);
    const secret = tokens ? seal(tokens, `account:${id}`) : null;
    const scopeText = Array.isArray(scopes) ? scopes.join(' ') : String(scopes || '');
    if (existing) q.update.run(login, displayName || login, avatar || '', scopeText, secret, now, id);
    else q.insert.run(id, platform, String(platformUserId), login, displayName || login, avatar || '', scopeText, secret, JSON.stringify(options), now, now);
    const account = get(id);
    restart(account);
    publishList();
    return account;
  }

  function remove(id) {
    stop(id);
    stats.delete(id);
    q.remove.run(id);
    publishList();
  }

  function setStatus(id, status, error = '') {
    if (demo.has(id)) return;
    const before = get(id);
    q.status.run(status, error || null, Date.now(), id);
    if (!before || before.status !== status || before.error !== (error || '')) publishList();
  }

  function setOptions(id, patch) {
    const account = get(id);
    if (!account || account.demo) return account;
    const options = { ...account.options, ...patch };
    for (const [k, v] of Object.entries(options)) if (v === null) delete options[k];
    if (JSON.stringify(options).length > 2048) throw new HttpError(400, 'options too large (max 2 KB)');
    q.options.run(JSON.stringify(options), Date.now(), id);
    const updated = get(id);
    restart(updated);
    publishList();
    return updated;
  }

  function readTokens(account) {
    const row = q.one.get(account.id);
    if (!row?.secret) return null;
    try {
      return unseal(row.secret, `account:${account.id}`);
    } catch {
      setStatus(account.id, 'needs_reconnect', ctx.t('Identifiants enregistrés illisibles (TOKEN_KEY a changé ?). Reconnecte ce compte.', 'Stored credentials cannot be decrypted (TOKEN_KEY changed?). Reconnect this account.'));
      return null;
    }
  }

  function saveTokens(account, tokens) {
    q.secret.run(seal(tokens, `account:${account.id}`), Date.now(), account.id);
  }

  function refresh(account, tokens) {
    if (refreshing.has(account.id)) return refreshing.get(account.id);
    const adapter = adapterOf(account);
    const job = (async () => {
      try {
        const next = { ...tokens, ...(await adapter.refresh(ctx, account, tokens)) };
        saveTokens(account, next); // persist rotated refresh token before using the access token
        // Only clear the token problem; an 'error' belongs to the transport that set it.
        if (get(account.id)?.status === 'needs_reconnect') {
          setStatus(account.id, 'ok');
          // The transport stopped while credentials were rejected: bring it back.
          if (!running.has(account.id) && !starting.has(account.id)) start(get(account.id));
        }
        return next;
      } catch (err) {
        if (err instanceof ApiError && [400, 401, 403].includes(err.status)) {
          setStatus(account.id, 'needs_reconnect', ctx.t('La plateforme refuse de renouveler l’accès. Reconnecte ce compte.', 'The platform refused to renew access. Reconnect this account.'));
        }
        throw err;
      } finally {
        refreshing.delete(account.id);
      }
    })();
    refreshing.set(account.id, job);
    return job;
  }

  /** Fresh token set for an account (refreshing when it expires within 2 minutes). */
  async function tokens(account) {
    const current = readTokens(account);
    if (!current) throw new ApiError(account.platform, 401, null, ctx.t('Compte non connecté. Reconnecte-le.', 'Account not connected. Reconnect it.'));
    if (current.expiresAt && current.expiresAt - Date.now() < 120_000 && current.refresh) return refresh(account, current);
    return current;
  }

  /** Run fn(accessToken, tokens); on HTTP 401, refresh once and retry. */
  async function withToken(account, fn) {
    if (account.demo) return fn('demo', {});
    const current = await tokens(account);
    try {
      return await fn(current.access, current);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401 || !current.refresh) throw err;
      const next = await refresh(account, current);
      return fn(next.access, next);
    }
  }

  function stop(id) {
    starting.delete(id);
    clearTimeout(retries.get(id));
    retries.delete(id);
    const handle = running.get(id);
    running.delete(id);
    try { handle?.stop?.(); } catch (err) { log.warn('stop failed', id, err.message); }
  }

  async function start(account, attempt = 0) {
    const adapter = adapterOf(account);
    if (!adapter?.connect || ['disabled', 'needs_reconnect'].includes(account.status)) return;
    const token = {};
    starting.set(account.id, token);
    if (!account.demo) ctx.emotes?.load(account.platform, account.platformUserId); // fire and forget, never rejects
    try {
      const handle = await adapter.connect(ctx, account);
      // Superseded by stop()/restart() while connecting, or the account was removed: drop this connection.
      if (starting.get(account.id) !== token || running.has(account.id) || !get(account.id)) { handle?.stop?.(); return; }
      starting.delete(account.id);
      running.set(account.id, handle || {});
      if (get(account.id)?.status === 'error') setStatus(account.id, 'ok'); // clear a previous failed attempt
    } catch (err) {
      if (starting.get(account.id) !== token) return;
      starting.delete(account.id);
      // Credentials rejected (refresh failed / undecryptable): wait for the user to reconnect, no retry loop.
      if (['needs_reconnect', 'disabled'].includes(get(account.id)?.status)) {
        log.warn(`[${account.platform}] ${account.login}: ${err.message}; waiting for reconnect`);
        return;
      }
      const delay = Math.min(300_000, 15_000 * 2 ** attempt);
      log.warn(`[${account.platform}] ${account.login}: connection failed (${err.message}); retry in ${delay / 1000}s`);
      if (!(err instanceof ApiError && err.status === 401)) setStatus(account.id, 'error', err.message);
      retries.set(account.id, setTimeout(() => {
        const fresh = get(account.id);
        if (fresh) start(fresh, attempt + 1);
      }, delay));
    }
  }

  function restart(account) {
    stop(account.id);
    if (account) start(account);
  }

  /** Poll due accounts in parallel (a slow platform never delays the others). Failures are published as stale data. */
  async function pollStats() {
    const now = Date.now();
    await Promise.all(list().map(async account => {
      const adapter = adapterOf(account);
      if (!adapter?.stats) return;
      if (['needs_reconnect', 'disabled'].includes(account.status)) {
        const frozen = stats.get(account.id);
        if (frozen && frozen.live !== undefined) { // once: last values become 'unknown' (SPEC §5 freshness)
          const next = { ...frozen, live: undefined, viewers: null, error: account.error || ctx.t('Compte à reconnecter.', 'Account needs reconnecting.'), fails: Math.max(3, frozen.fails || 0), at: now };
          stats.set(account.id, next);
          hub.publish('stats', { accountId: account.id, platform: account.platform, ...next });
        }
        return;
      }
      const prev = stats.get(account.id);
      if (prev && now - prev.at < (adapter.statsInterval || 30_000)) return;
      stats.set(account.id, { ...prev, at: now }); // claim the slot (no overlap)
      let next;
      try {
        next = { ...(await adapter.stats(ctx, account)), at: Date.now(), error: '', fails: 0 };
      } catch (err) {
        const current = stats.get(account.id) || {}; // includes stats pushed during the poll (EventSub, webhooks)
        const fails = (current.fails || 0) + 1;
        next = { ...current, at: Date.now(), error: err.message, fails };
        if (fails >= 3) { next.live = undefined; next.viewers = null; } // ~3 intervals without data: unknown
      }
      if (!get(account.id)) return; // removed meanwhile
      stats.set(account.id, next);
      hub.publish('stats', { accountId: account.id, platform: account.platform, ...next });
    }));
  }

  /** Adapters that receive pushed stats (EventSub stream.online, webhooks…) call this. */
  function pushStats(account, patch) {
    const next = { ...stats.get(account.id), ...patch, at: Date.now() };
    stats.set(account.id, next);
    hub.publish('stats', { accountId: account.id, platform: account.platform, ...next });
  }

  function startAll() {
    for (const account of list()) start(account);
    const timer = setInterval(() => pollStats().catch(err => log.warn('stats', err.message)), STATS_TICK);
    timer.unref();
    pollStats().catch(() => {});
  }

  function addDemo(account) {
    demo.set(account.id, { scopes: [], status: 'ok', error: '', options: {}, avatar: '', ...account, demo: true });
  }

  return {
    list, get, describe, publishList, upsert, remove, setStatus, setOptions,
    tokens, withToken, saveTokens, start, stop, restart, startAll, pushStats,
    stats: id => stats.get(id) || null,
    addDemo,
  };
}
