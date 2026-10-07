// Test helpers: a minimal fake kernel ctx and a fetch mock. No network, no files.
import { openDb, settings as settingsStore } from '../src/db.js';
import { initKeys } from '../src/crypto.js';
import { request, ApiError } from '../src/net.js';

initKeys('test-key-material-that-is-long-enough-123456', '.');

/** fakeCtx({ app: {clientId, clientSecret}, tokens }) → ctx with recorded hub frames in ctx.published */
export function fakeCtx({ app = { clientId: 'cid', clientSecret: 'csecret' }, tokens = { access: 'tok', refresh: 'ref', expiresAt: Date.now() + 3600_000 }, config = {} } = {}) {
  const db = openDb(':memory:');
  const published = [];
  const statuses = [];
  const stats = [];
  const ctx = {
    config: { publicUrl: 'http://localhost:8787', secure: false, loopbackOnly: true, demo: false, ...config },
    db, settings: settingsStore(db), published, statuses, stats,
    hub: { publish: (t, d) => published.push({ t, d }), on: () => () => {}, backlog: () => published.filter(f => f.t === 'chat' || f.t === 'event') },
    log: { info() {}, warn() {}, error() {} },
    request, ApiError,
    app: () => app,
    redirectUri: p => `http://localhost:8787/auth/${p}/callback`,
    tokenize: ({ fragments }) => fragments,
    t: (fr, en) => en,
    emotes: { load: async () => {} },
    emitChat: m => published.push({ t: 'chat', d: m }),
    emitEvent: e => published.push({ t: 'event', d: e }),
    emitDelete: d => published.push({ t: 'chat:delete', d }),
    accounts: {
      tokens: async () => tokens,
      withToken: async (account, fn) => fn(tokens.access, tokens),
      saveTokens: () => {},
      setStatus: (id, status, error) => statuses.push({ id, status, error }),
      setOptions: () => {},
      pushStats: (account, patch) => stats.push({ id: account.id, ...patch }),
      stats: () => null,
      get: () => null,
      list: () => [],
      describe: a => ({ ...a, caps: {} }),
    },
  };
  ctx.adapterFor = () => null;
  ctx.requireAccount = id => { throw Object.assign(new Error('Unknown account ' + id), { status: 404 }); };
  return ctx;
}

export const account = (over = {}) => ({ id: 'acc1', platform: 'twitch', platformUserId: '1234', login: 'streamer', displayName: 'Streamer', scopes: [], status: 'ok', options: {}, demo: false, ...over });

/**
 * mockFetch(handler) — handler(url: URL, init) returns {status?, body?, headers?} or a Response.
 * Returns { calls, restore() }.
 */
export function mockFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init, body: init.body });
    const out = await handler(url, init);
    if (out instanceof Response) return out;
    const { status = 200, body = {}, headers = {} } = out || {};
    return new Response(body === null ? null : typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}
