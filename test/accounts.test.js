// Account manager lifecycle: start/stop races, frozen stats of revoked accounts, options cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { createAccounts } from '../src/accounts.js';
import { ApiError } from '../src/net.js';

function setup(adapter) {
  const ctx = fakeCtx();
  ctx.adapters = new Map([['twitch', { id: 'twitch', capabilities: {}, ...adapter }]]);
  ctx.accounts = createAccounts(ctx);
  return ctx;
}
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

test('stop() during an in-flight connect drops the late connection', async () => {
  let release;
  const stopped = [];
  const ctx = setup({ connect: () => new Promise(r => { release = () => r({ stop: () => stopped.push('late') }); }) });
  const account = ctx.accounts.upsert({ platform: 'twitch', platformUserId: '1', login: 'a', tokens: { access: 'x' } });
  await tick();
  ctx.accounts.stop(account.id);
  release();
  await tick();
  assert.deepEqual(stopped, ['late']);
});

test('needs_reconnect: no retry loop, frozen stats become unknown once', async () => {
  let connects = 0;
  const ctx = setup({
    connect: async () => { connects++; throw new ApiError('twitch', 401, null, 'revoked'); },
    stats: async () => ({ live: true, viewers: 42 }),
    statsInterval: 1,
  });
  const account = ctx.accounts.upsert({ platform: 'twitch', platformUserId: '2', login: 'b', tokens: { access: 'x' } });
  ctx.accounts.pushStats(account, { live: true, viewers: 42 });
  ctx.accounts.setStatus(account.id, 'needs_reconnect', 'Reconnect');
  await tick(20);
  ctx.accounts.startAll();
  await tick(50);
  const s = ctx.accounts.stats(account.id);
  assert.equal(s.live, undefined);
  assert.equal(s.viewers, null);
  assert.ok(s.error);
  assert.ok(connects <= 1);
});

test('setOptions caps the merged total and drops null keys', () => {
  const ctx = setup({ connect: async () => ({ stop() {} }) });
  const account = ctx.accounts.upsert({ platform: 'twitch', platformUserId: '3', login: 'c', tokens: { access: 'x' } });
  ctx.accounts.setOptions(account.id, { a: 'x'.repeat(1500) });
  assert.throws(() => ctx.accounts.setOptions(account.id, { b: 'y'.repeat(1500) }), { status: 400 });
  const cleared = ctx.accounts.setOptions(account.id, { a: null, b: 'ok' });
  assert.deepEqual(cleared.options, { b: 'ok' });
  for (const a of ctx.accounts.list()) ctx.accounts.stop(a.id);
});
