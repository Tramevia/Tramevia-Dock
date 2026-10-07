import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { createRouter, HttpError } from '../src/http.js';
import { register } from '../src/chat/routes.js';

const ACCOUNTS = {
  tw: { id: 'tw', platform: 'twitch', login: 'streamer', caps: { chatSend: true, reply: true, deleteMessage: true, timeout: true, ban: true, markers: true, clips: true } },
  yt: { id: 'yt', platform: 'youtube', login: 'yt', caps: { chatSend: true, deleteMessage: true, limits: { chatMaxLength: 200 } } },
  kk: { id: 'kk', platform: 'kick', login: 'kk', caps: { chatSend: true, timeout: true, limits: { chatMaxLength: 500, timeoutMin: 60, timeoutMax: 604800 } } },
  tt: { id: 'tt', platform: 'tiktok', login: 'tt', caps: { chatSend: false } },
};

function setup(adapter = {}) {
  const ctx = fakeCtx();
  const calls = [];
  const base = {
    async send(c, account, msg) { calls.push(['send', account.id, msg]); return account.id === 'yt' ? { ok: false, error: 'quota' } : { ok: true, id: 'm1' }; },
    async moderate(c, account, action) { calls.push(['moderate', account.id, action]); return { ok: true }; },
    async marker(c, account, opts) { calls.push(['marker', account.id, opts]); return { ok: true }; },
    async clip() { return { ok: true, url: 'https://clips.twitch.tv/x' }; },
    ...adapter,
  };
  ctx.accounts.get = id => ACCOUNTS[id] || null;
  ctx.accounts.describe = a => ({ ...a, caps: a.caps });
  ctx.adapterFor = () => base;
  ctx.requireAccount = id => { if (!ACCOUNTS[id]) throw new HttpError(404, 'Unknown account', 'unknown_account'); return ACCOUNTS[id]; };
  const router = createRouter();
  register(router, ctx);
  const call = async (method, path, body = {}, query = {}) => router.match(method, path).route.handler({ body, query, params: {} });
  return { ctx, calls, call };
}

const rejects = (p, status) => assert.rejects(p, err => err instanceof HttpError && err.status === status);

test('send: parallel per-account results, caps and reply routing', async () => {
  const { calls, call } = setup();
  const { results } = await call('POST', '/api/chat/send', { text: '  hello\n world ', targets: ['tw', 'yt', 'tt', 'nope'], replyTo: { accountId: 'tw', messageId: 'abc' } });
  assert.deepEqual(results.tw, { ok: true, id: 'm1' });
  assert.deepEqual(results.yt, { ok: false, error: 'quota', code: 'rejected' });
  assert.equal(results.tt.code, 'unsupported');
  assert.equal(results.nope.code, 'unknown_account');
  const sends = calls.filter(c => c[0] === 'send');
  assert.deepEqual(sends.find(c => c[1] === 'tw')[2], { text: 'hello world', replyTo: 'abc' });
  assert.equal(sends.find(c => c[1] === 'yt')[2].replyTo, undefined); // reply only on its own account
});

test('send: validation', async () => {
  const { call } = setup();
  await rejects(call('POST', '/api/chat/send', { text: '   ', targets: ['tw'] }), 400);
  await rejects(call('POST', '/api/chat/send', { text: 'x'.repeat(501), targets: ['tw'] }), 400);
  await rejects(call('POST', '/api/chat/send', { text: 'ok', targets: [] }), 400);
  await rejects(call('POST', '/api/chat/send', { text: 'ok', targets: [{}] }), 400);
  await rejects(call('POST', '/api/chat/send', null), 400);
  const { results } = await call('POST', '/api/chat/send', { text: '😀'.repeat(500), targets: ['tw'] });
  assert.equal(results.tw.ok, true); // 500 code points, not UTF-16 units
});

test('send: adapter throw becomes a per-account error', async () => {
  const { call } = setup({ async send() { throw new Error('boom'); } });
  const { results } = await call('POST', '/api/chat/send', { text: 'hi', targets: ['tw'] });
  assert.deepEqual(results.tw, { ok: false, error: 'boom', code: 'platform_error' });
});

test('moderate: caps, validation, duration bounds', async () => {
  const { calls, call } = setup();
  assert.deepEqual(await call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'timeout', userId: 'u1', userLogin: 'bob', duration: 600 }), { ok: true });
  assert.equal(calls.at(-1)[2].duration, 600);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'timeout', userId: 'u1', duration: 0 }), 400);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'timeout', userId: 'u1', duration: 1_209_601 }), 400);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'delete', userId: 'u1' }), 400); // messageId required
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'nuke', userId: 'u1' }), 400);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'yt', action: 'ban', userId: 'u1' }), 400); // no ban cap
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'zz', action: 'ban', userId: 'u1' }), 404);
  await call('POST', '/api/chat/moderate', { accountId: 'yt', action: 'delete', messageId: 'm9' });
  assert.equal(calls.at(-1)[2].messageId, 'm9');
});

test('moderate: adapter {ok:false} becomes a 502', async () => {
  const { call } = setup({ async moderate() { return { ok: false, error: 'nope' }; } });
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'tw', action: 'ban', userId: 'u1' }), 502);
});

test('user card: backlog messages for that platform user + userInfo', async () => {
  const { ctx, call } = setup({ async userInfo(c, a, id) { return { createdAt: '2020-01-01', id }; } });
  const msg = (id, platform, authorId) => ({ t: 'chat', d: { id, platform, accountId: 'tw', author: { id: authorId, name: authorId }, text: id } });
  ctx.published.push(msg('1', 'twitch', 'u1'), msg('2', 'twitch', 'u2'), msg('3', 'kick', 'u1'), msg('4', 'twitch', 'u1'));
  const out = await call('GET', '/api/chat/user', {}, { accountId: 'tw', userId: 'u1' });
  assert.deepEqual(out.messages.map(m => m.id), ['1', '4']);
  assert.equal(out.user.id, 'u1');
  assert.equal(out.info.createdAt, '2020-01-01');
  await rejects(call('GET', '/api/chat/user', {}, { accountId: 'tw' }), 400);
});

test('feature: publishes the backlog copy (stamped), a sanitized copy, or null; refuses deleted messages', async () => {
  const { ctx, call } = setup();
  ctx.published.push({ t: 'chat', d: { id: 'k', accountId: 'tw', text: 'server copy', deleted: false } });
  await call('POST', '/api/chat/feature', { message: { id: 'k', accountId: 'tw', text: 'client copy' } });
  assert.equal(ctx.published.at(-1).t, 'feature');
  assert.equal(ctx.published.at(-1).d.text, 'server copy');
  assert.ok(Math.abs(ctx.published.at(-1).d.featuredAt - Date.now()) < 1000);
  await call('POST', '/api/chat/feature', { message: { id: 'other', accountId: 'tw', text: 'hi', evil: 1 } });
  assert.equal(ctx.published.at(-1).d.text, 'hi');
  assert.equal(ctx.published.at(-1).d.evil, undefined);
  await call('POST', '/api/chat/feature', { message: null });
  assert.equal(ctx.published.at(-1).d, null);
  await rejects(call('POST', '/api/chat/feature', { message: { id: 5 } }), 400);
  // A deleted message never goes (back) on stream: no publish, and no deleted:false copy.
  ctx.published.push({ t: 'chat', d: { id: 'gone', accountId: 'tw', text: 'troll', deleted: true } });
  const before = ctx.published.length;
  await rejects(call('POST', '/api/chat/feature', { message: { id: 'gone', accountId: 'tw', text: 'troll' } }), 409);
  await rejects(call('POST', '/api/chat/feature', { message: { id: 'unknown', accountId: 'tw', text: 'x', deleted: true } }), 409);
  assert.equal(ctx.published.length, before);
});

test('limits: per-platform chatMaxLength and timeout bounds', async () => {
  const { calls, call } = setup();
  const { results } = await call('POST', '/api/chat/send', { text: 'x'.repeat(300), targets: ['tw', 'yt'] });
  assert.equal(results.tw.ok, true);
  assert.equal(results.yt.code, 'too_long');
  assert.match(results.yt.error, /200/);
  assert.equal(calls.filter(c => c[0] === 'send' && c[1] === 'yt').length, 0);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'kk', action: 'timeout', userId: 'u1', duration: 10 }), 400);
  await rejects(call('POST', '/api/chat/moderate', { accountId: 'kk', action: 'timeout', userId: 'u1', duration: 604801 }), 400);
  await call('POST', '/api/chat/moderate', { accountId: 'kk', action: 'timeout', userId: 'u1', duration: 60 });
  assert.equal(calls.at(-1)[2].duration, 60);
});

test('errors are localized through ctx.t', async () => {
  const { ctx, call } = setup();
  ctx.t = fr => fr;
  await assert.rejects(call('POST', '/api/chat/send', { text: 'ok', targets: [] }), err => err.message === 'Choisis au moins un compte.');
  const { results } = await call('POST', '/api/chat/send', { text: 'ok', targets: ['tt', 'nope'] });
  assert.equal(results.tt.error, 'Ce compte ne peut pas envoyer de message.');
  assert.equal(results.nope.error, 'Compte inconnu');
  await assert.rejects(call('POST', '/api/chat/moderate', { accountId: 'yt', action: 'ban', userId: 'u1' }), err => err.message === 'Ce compte ne permet pas cette action.');
});

test('marker / clip: capability gated', async () => {
  const { calls, call } = setup();
  assert.deepEqual(await call('POST', '/api/actions/marker', { accountId: 'tw', description: 'boss' }), { ok: true });
  assert.deepEqual(calls.at(-1)[2], { description: 'boss' });
  assert.equal((await call('POST', '/api/actions/clip', { accountId: 'tw' })).url, 'https://clips.twitch.tv/x');
  await rejects(call('POST', '/api/actions/clip', { accountId: 'yt' }), 400);
  await rejects(call('POST', '/api/actions/marker', { accountId: 'tw', description: 'x'.repeat(141) }), 400);
});
