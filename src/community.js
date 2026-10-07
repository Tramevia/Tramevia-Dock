// Community API (SPEC.md §7.2): real chatter lists where the platform offers one (capability `chatters`),
// otherwise "active chatters" collected from the hub `chat` topic.
import { HttpError } from './http.js';

const KEEP_MS = 4 * 3600_000;   // forget active chatters after 4 h
const MAX_USERS = 5000;         // per account (oldest dropped first)
const CACHE_MS = 60_000;        // adapter.chatters() at most once a minute per account

/**
 * Live state from a stats object (SPEC §5 freshness). live: null = unknown (polls failing with no
 * usable value); statsError/statsFails = the values shown are kept from an earlier poll.
 * Same rule as the dock (public/assets/community.js applyStats) and the dashboard (viewersUnknown).
 */
export function freshness(stats = {}) {
  return {
    live: stats.live === undefined && stats.error ? null : Boolean(stats.live),
    viewers: Number.isFinite(stats.viewers) ? stats.viewers : null,
    statsError: stats.error || undefined,
    statsFails: stats.fails || undefined,
  };
}

export function register(router, ctx) {
  const active = new Map(); // accountId -> Map(userId -> {id, login, name, roles, lastSeen, count}), oldest first
  const cache = new Map();  // accountId -> {list, listAt, at, error, job}

  /** Drop entries older than KEEP_MS or beyond MAX_USERS (the Map is ordered by lastSeen). */
  function prune(users, now) {
    for (const [id, u] of users) {
      if (users.size > MAX_USERS || now - u.lastSeen > KEEP_MS) users.delete(id);
      else break;
    }
  }

  ctx.hub.on((topic, m) => {
    if (topic !== 'chat' || !m?.accountId || !m.author?.id || m.flags?.self) return;
    let users = active.get(m.accountId);
    if (!users) active.set(m.accountId, users = new Map());
    const id = String(m.author.id);
    const count = (users.get(id)?.count || 0) + 1;
    users.delete(id); // re-insert at the end: keeps the Map sorted by lastSeen
    const now = Date.now();
    users.set(id, { id, login: m.author.login || '', name: m.author.name || m.author.login || '', roles: m.author.roles || [], lastSeen: now, count });
    prune(users, now);
  });

  /** Cached chatter list; refreshes in the background when stale, waits only when nothing is cached yet. */
  function chatters(account, adapter) {
    let c = cache.get(account.id);
    if (!c) cache.set(account.id, c = { list: null, listAt: 0, at: 0, error: '', job: null });
    if (!c.job && Date.now() - c.at >= CACHE_MS) {
      c.job = (async () => adapter.chatters(ctx, account))()
        .then(list => { c.list = Array.isArray(list) ? list : []; c.listAt = Date.now(); c.error = ''; },
          err => { c.error = String(err?.message || err).slice(0, 300); })
        .finally(() => { c.at = Date.now(); c.job = null; });
    }
    return c.list || !c.job ? c : c.job.then(() => c);
  }

  router.get('/api/community', async ({ query }) => {
    const minutes = query.window === undefined ? 15 : Number(query.window);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      throw new HttpError(400, 'window must be a whole number of minutes between 1 and 240', 'invalid');
    }
    const now = Date.now();
    const since = now - minutes * 60_000;
    const list = ctx.accounts.list();
    const ids = new Set(list.map(a => a.id));
    for (const [id, users] of active) { prune(users, now); if (!ids.has(id) || !users.size) active.delete(id); }
    for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);

    const accounts = await Promise.all(list.map(async account => {
      const stats = ctx.accounts.stats(account.id) || {};
      const adapter = ctx.adapterFor(account);
      const out = {
        accountId: account.id, platform: account.platform, login: account.login, displayName: account.displayName,
        avatar: account.avatar || '', status: account.status, ...freshness(stats),
      };
      const caps = ctx.accounts.describe(account).caps || {};
      if (!caps.chatters && !caps.activeChatters) out.unavailable = true; // e.g. Kick with chat reading off
      const usable = !['needs_reconnect', 'disabled'].includes(account.status);
      if (usable && caps.chatters && adapter?.chatters) {
        const c = await chatters(account, adapter);
        if (c.list) return { ...out, kind: 'chatters', chatters: c.list, updatedAt: c.listAt, error: c.error || undefined };
        out.error = c.error || undefined; // no list yet: fall back to active chatters, with the reason
      }
      const users = active.get(account.id)?.values() || [];
      return { ...out, kind: 'active', chatters: [...users].filter(u => u.lastSeen >= since).reverse(), updatedAt: now };
    }));
    // Unknown counts are never summed as 0 silently: the total is then flagged partial.
    const totalViewers = accounts.reduce((sum, a) => sum + (a.live && a.viewers !== null ? a.viewers : 0), 0);
    const partial = accounts.some(a => a.live === null || (a.live && a.viewers === null));
    return { totalViewers, partial, window: minutes, accounts };
  });
}
