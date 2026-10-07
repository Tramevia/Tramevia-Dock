import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account } from './helpers.js';
import { register } from '../src/community.js';

/** Community module wired to a fake ctx with a real listener hub, accounts, stats and adapters. */
function setup({ accounts, stats = {}, adapters = {}, caps = {} }) {
  const ctx = fakeCtx();
  const listeners = new Set();
  ctx.hub = { on: fn => { listeners.add(fn); return () => listeners.delete(fn); }, publish: (t, d) => listeners.forEach(fn => fn(t, d)) };
  ctx.accounts.list = () => accounts;
  ctx.accounts.stats = id => stats[id] || null;
  ctx.accounts.describe = a => ({ ...a, caps: caps[a.platform] || {} });
  ctx.adapterFor = a => adapters[a.platform] || {};
  const routes = {};
  register({ get: (path, handler) => { routes[path] = handler; } }, ctx);
  const chat = (accountId, id, extra = {}) => ctx.hub.publish('chat', {
    accountId, ts: Date.now(), author: { id, login: id.toLowerCase(), name: id, roles: [] }, flags: {}, ...extra,
  });
  return { get: (query = {}) => routes['/api/community']({ query }), chat };
}

function withClock(start) {
  const real = Date.now;
  let now = start;
  Date.now = () => now;
  return { set: v => { now = v; }, restore: () => { Date.now = real; } };
}

test('active chatters: window, ordering, counts, self ignored, 4 h pruning', async () => {
  const clock = withClock(1_000_000_000);
  try {
    const kick = account({ id: 'k1', platform: 'kick' });
    const { get, chat } = setup({ accounts: [kick], stats: { k1: { live: true, viewers: 42 } }, caps: { kick: { activeChatters: true } } });
    chat('k1', 'Alice');
    clock.set(1_000_000_000 + 20 * 60_000);
    chat('k1', 'Bob');
    chat('k1', 'Alice');
    chat('k1', 'Owner', { flags: { self: true } });
    clock.set(1_000_000_000 + 21 * 60_000);
    chat('k1', 'Carol');

    let res = await get({ window: '5' });
    assert.equal(res.totalViewers, 42);
    const [a] = res.accounts;
    assert.equal(a.kind, 'active');
    assert.equal(a.unavailable, undefined);
    assert.equal(a.live, true);
    assert.deepEqual(a.chatters.map(u => u.name), ['Carol', 'Alice', 'Bob']);
    assert.equal(a.chatters.find(u => u.name === 'Alice').count, 2);

    clock.set(1_000_000_000 + 21 * 60_000 + 4 * 3600_000 + 1);
    res = await get({ window: '240' });
    assert.deepEqual(res.accounts[0].chatters, []);
  } finally { clock.restore(); }
});

test('window validation', async () => {
  const { get } = setup({ accounts: [] });
  for (const window of ['0', '241', '1.5', 'abc', '']) await assert.rejects(get({ window }), { status: 400 });
  assert.equal((await get()).window, 15);
});

test('chatters capability: cached 60 s, errors keep the last good list, fallback without one', async () => {
  const clock = withClock(5_000_000);
  try {
    let calls = 0;
    let fail = false;
    const twitch = { chatters: async () => { calls++; if (fail) throw new Error('boom'); return [{ id: '1', login: 'a', name: 'A', roles: ['moderator'] }]; } };
    const tw = account({ id: 't1', platform: 'twitch' });
    const { get, chat } = setup({ accounts: [tw], adapters: { twitch }, caps: { twitch: { chatters: true } }, stats: { t1: { live: false, viewers: 10 } } });

    let res = await get();
    assert.equal(res.accounts[0].kind, 'chatters');
    assert.equal(res.accounts[0].chatters.length, 1);
    assert.equal(res.totalViewers, 0, 'offline accounts do not count');
    await get();
    assert.equal(calls, 1, 'cached');

    fail = true;
    clock.set(5_000_000 + 61_000);
    await get(); // stale: refresh starts in the background, stale list served
    await new Promise(r => setImmediate(r));
    res = await get();
    assert.equal(calls, 2);
    assert.equal(res.accounts[0].kind, 'chatters');
    assert.equal(res.accounts[0].chatters.length, 1, 'last good list kept');
    assert.equal(res.accounts[0].error, 'boom');

    // A fresh account whose first fetch fails falls back to active chatters, with the error.
    const tw2 = account({ id: 't2', platform: 'twitch' });
    const second = setup({ accounts: [tw2], adapters: { twitch }, caps: { twitch: { chatters: true } } });
    second.chat('t2', 'Dave');
    res = await second.get();
    assert.equal(res.accounts[0].kind, 'active');
    assert.equal(res.accounts[0].error, 'boom');
    assert.deepEqual(res.accounts[0].chatters.map(u => u.name), ['Dave']);
    chat('t1', 'x'); // unrelated account traffic is harmless
  } finally { clock.restore(); }
});

test('accounts needing reconnection do not call the platform', async () => {
  let calls = 0;
  const twitch = { chatters: async () => { calls++; return []; } };
  const { get } = setup({ accounts: [account({ status: 'needs_reconnect' })], adapters: { twitch }, caps: { twitch: { chatters: true } } });
  const res = await get();
  assert.equal(calls, 0);
  assert.equal(res.accounts[0].kind, 'active');
  assert.equal(res.accounts[0].status, 'needs_reconnect');
});

test('accounts without any way to list people are flagged unavailable', async () => {
  const { get } = setup({ accounts: [account({ platform: 'kick' })], caps: { kick: { activeChatters: false } } });
  assert.equal((await get()).accounts[0].unavailable, true);
});

test('stats freshness: stale values flagged, unknown viewers never summed (partial total)', async () => {
  const accounts = [account({ id: 'a', platform: 'kick' }), account({ id: 'b', platform: 'kick' }), account({ id: 'c', platform: 'kick' })];
  const stats = {
    a: { live: true, viewers: 100, error: 'timeout', fails: 1 },   // last poll failed, values kept
    b: { live: undefined, viewers: null, error: 'HTTP 500', fails: 3 }, // unknown
    c: { live: true, viewers: 7, error: '', fails: 0 },
  };
  const { get } = setup({ accounts, stats, caps: { kick: { activeChatters: true } } });
  let res = await get();
  const [a, b, c] = res.accounts;
  assert.deepEqual([a.live, a.viewers, a.statsError, a.statsFails], [true, 100, 'timeout', 1]);
  assert.deepEqual([b.live, b.viewers, b.statsError], [null, null, 'HTTP 500']);
  assert.deepEqual([c.live, c.statsError, c.statsFails], [true, undefined, undefined]);
  assert.equal(res.totalViewers, 107);
  assert.equal(res.partial, true, 'b is unknown');

  stats.b = { live: false, viewers: 0, error: '', fails: 0 };
  res = await get();
  assert.equal(res.partial, false);
  assert.equal(res.accounts[1].live, false);
  stats.c = { live: true, viewers: null };
  assert.equal((await get()).partial, true, 'live without a viewer count');
  assert.equal((await setup({ accounts: [account()] }).get()).accounts[0].live, false, 'no stats yet = offline, not unknown');
});
