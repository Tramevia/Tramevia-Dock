import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fakeCtx, account as makeAccount } from './helpers.js';
import tiktok, { cleanUsername, toChat, giftEvent, likeBatcher, who, deps } from '../src/platforms/tiktok.js';
import { HttpError } from '../src/http.js';

// Payloads are shaped after tiktok-live-proto v3 (what tiktok-live-connector 2.5.0 emits).
const user = (over = {}) => ({
  id: '6800000000000000001', idStr: '6800000000000000001', displayId: 'pixel_panda', nickname: 'Pixel Panda 🐼',
  avatarThumb: { urlList: ['https://p16-sign.tiktokcdn.com/a.webp', 'https://p77/a.jpeg'] }, verified: false,
  userAttr: { isAdmin: false }, badgeList: [], ...over,
});
const account = makeAccount({ id: 'tt1', platform: 'tiktok', platformUserId: 'tramevia', login: 'Tramevia', displayName: 'Tramevia' });
const tick = () => new Promise(r => setImmediate(r));

test('resolveUsername / cleanUsername', async () => {
  assert.deepEqual(await tiktok.resolveUsername({}, '  @Tramevia.Live_1 '), {
    platformUserId: 'tramevia.live_1', login: 'Tramevia.Live_1', displayName: 'Tramevia.Live_1', avatar: '', scopes: [], tokens: null,
  });
  assert.equal(cleanUsername('ab'), 'ab');
  for (const bad of ['', '@', 'a', 'x'.repeat(25), 'bad name', 'émile', 'https://www.tiktok.com/@x', '@@double', null]) {
    assert.throws(() => cleanUsername(bad), e => e instanceof HttpError && e.status === 400 && e.code === 'invalid_username' && /TikTok/.test(e.message), String(bad));
  }
  // One language at a time, picked by ctx.t (never a combined "FR / EN" string).
  await assert.rejects(tiktok.resolveUsername({ t: fr => fr }, 'a'), e => /^Nom d’utilisateur TikTok invalide/.test(e.message) && !/Invalid/.test(e.message));
  assert.throws(() => cleanUsername('a'), e => /^Invalid TikTok username/.test(e.message) && !/Nom/.test(e.message));
});

test('who: numeric id first, handle fallback, safe avatar', () => {
  assert.deepEqual(who(user()), { id: '6800000000000000001', login: 'pixel_panda', name: 'Pixel Panda 🐼', avatar: 'https://p16-sign.tiktokcdn.com/a.webp' });
  assert.deepEqual(who({ id: '0', idStr: '', displayId: 'solo', avatarThumb: { urlList: ['javascript:alert(1)'] } }), { id: 'solo', login: 'solo', name: 'solo', avatar: '' });
  assert.equal(who(undefined), null);
});

test('chat normalization', () => {
  const ctx = fakeCtx();
  const calls = [];
  ctx.tokenize = args => { calls.push(args); return args.fragments; };
  const msg = toChat(ctx, account, {
    common: { msgId: '7300000000000000042', createTime: '1759800000000' },
    user: user({
      verified: true,
      badgeList: [
        { image: { image: { urlList: ['https://p16-webcast.tiktokcdn.com/level.png'] } }, privilegeLogExtra: { privilegeId: '7138381' } },
        { combine: { icon: { urlList: ['https://p16-webcast.tiktokcdn.com/fan.png'] }, str: 'Fans 12' } },
        { image: { image: { urlList: ['data:image/png;base64,xx'] } } },
      ],
    }),
    content: 'salut  !',
    emotes: [{ index: 6, emote: { emoteId: '1', image: { urlList: ['https://p16-webcast.tiktokcdn.com/e.png'] } } }],
    userIdentity: { isModeratorOfAnchor: true, isSubscriberOfAnchor: true, isAnchor: false },
  }, new Set(['6800000000000000001']));
  assert.equal(msg.id, '7300000000000000042');
  assert.equal(msg.platform, 'tiktok');
  assert.equal(msg.accountId, 'tt1');
  assert.equal(msg.channel, 'Tramevia');
  assert.equal(msg.text, 'salut  !');
  assert.deepEqual(msg.author.roles, ['moderator', 'vip', 'subscriber', 'verified']);
  assert.equal(msg.author.login, 'pixel_panda');
  assert.equal(msg.author.name, 'Pixel Panda 🐼');
  assert.equal(msg.author.color, '');
  assert.deepEqual(msg.author.badges, [
    { id: '7138381', title: '', url: 'https://p16-webcast.tiktokcdn.com/level.png' },
    { id: 'badge', title: 'Fans 12', url: 'https://p16-webcast.tiktokcdn.com/fan.png' },
  ]);
  assert.deepEqual(msg.tokens, [
    { t: 'text', v: 'salut ' }, { t: 'emote', name: 'emote', url: 'https://p16-webcast.tiktokcdn.com/e.png' }, { t: 'text', v: ' !' },
  ]);
  assert.deepEqual(calls[0].platform, 'tiktok');
  assert.deepEqual(calls[0].channelId, 'tramevia');
  assert.deepEqual(msg.flags, { action: false, highlight: false, self: false });
  assert.equal(msg.reply, null);
  assert.equal(msg.deleted, false);
  assert.ok(Math.abs(msg.ts - Date.now()) < 1000);

  // The streamer's own message: broadcaster + self; missing msgId gets a random id.
  const own = toChat(ctx, account, { user: user({ displayId: 'tramevia', idStr: '1' }), content: 'merci' });
  assert.deepEqual(own.author.roles, ['broadcaster']);
  assert.equal(own.flags.self, true);
  assert.ok(own.id.length > 5);
  // Empty comment → nothing.
  assert.equal(toChat(ctx, account, { user: user(), content: '' }), null);
});

test('gift streaks: only the final event counts', () => {
  const rose = { id: '5655', name: 'Rose', type: 1, diamondCount: 1, image: { urlList: ['https://p16-webcast.tiktokcdn.com/rose.png'] } };
  assert.equal(giftEvent({ giftId: '5655', gift: rose, repeatCount: 3, repeatEnd: 0, user: user() }), null);
  assert.deepEqual(giftEvent({ giftId: '5655', gift: rose, repeatCount: 7, repeatEnd: 1, user: user() }), {
    type: 'gift', user: who(user()), label: 'Rose', count: 7, amount: 7, unit: 'diamonds', image: 'https://p16-webcast.tiktokcdn.com/rose.png',
  });
  // Non-streakable gift (type ≠ 1): emitted at once, amount = diamonds × count.
  const lion = giftEvent({ giftId: '6369', gift: { name: 'Lion', type: 2, diamondCount: 29999 }, repeatCount: 1, repeatEnd: 0, user: user() });
  assert.equal(lion.amount, 29999);
  assert.equal(lion.image, undefined);
  assert.equal(giftEvent({ giftId: '42', gift: { type: 2 }, user: null }).label, '#42');
});

test('like aggregation: at most one event per 30 s, summed', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 1_000_000;
  const out = [];
  const b = likeBatcher((count, u) => out.push({ count, user: u?.id ?? null }), 30_000, () => now);
  const a = who(user()), c = who(user({ idStr: '2', displayId: 'other' }));

  b.add(5, a);                       // leading edge: immediate
  assert.deepEqual(out, [{ count: 5, user: a.id }]);
  now += 10_000; b.add(3, a);
  now += 5_000; b.add(15, c);        // several likers → user null
  assert.equal(out.length, 1);
  now += 15_000; t.mock.timers.tick(20_000); // window ends 30 s after the first emit
  assert.deepEqual(out[1], { count: 18, user: null });
  now += 1_000; b.add(2, a);
  assert.equal(out.length, 2);
  now += 29_000; t.mock.timers.tick(29_000);
  assert.deepEqual(out[2], { count: 2, user: a.id });
  now += 31_000; b.add(1, c);        // idle > window: immediate again
  assert.deepEqual(out[3], { count: 1, user: c.id });
  now += 1_000; b.add(1, c);
  b.stop(); t.mock.timers.tick(60_000);
  assert.equal(out.length, 4);       // stop() drops the pending tail timer
});

test('capabilities are read-only and no write methods exist', () => {
  assert.equal(tiktok.capabilities.chatSend, false);
  assert.equal(tiktok.capabilities.editInfo, false);
  assert.equal(tiktok.capabilities.unofficial, true);
  assert.deepEqual(tiktok.capabilities.limits, {});
  for (const m of ['getInfo', 'setInfo', 'searchCategories', 'send', 'moderate']) assert.equal(tiktok[m], undefined);
});

test('connect loop: polls every 2 min offline, connects when live, backoff, streamEnd, stop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class UserOfflineError extends Error {}
  class SignatureRateLimitError extends Error {}
  class FakeConn extends EventEmitter {
    static last;
    live = false; checks = 0; connects = 0; disconnects = 0; roomInfo = null; failCheck = null; failConnect = null;
    constructor(id, opts) { super(); this.uniqueId = id; this.opts = opts; FakeConn.last = this; }
    async fetchIsLive() { this.checks++; if (this.failCheck) throw this.failCheck; return this.live; }
    async connect() {
      this.connects++;
      if (this.failConnect) throw this.failConnect;
      if (!this.live) throw new UserOfflineError('offline');
      this.roomInfo = { data: { title: 'Soirée chill', create_time: 1_759_800_000, user_count: 12 } };
    }
    async disconnect() { this.disconnects++; }
  }
  const load = deps.load;
  deps.load = async () => ({ TikTokLiveConnection: FakeConn, UserOfflineError, SignatureRateLimitError });
  process.env.TIKTOK_SIGN_API_KEY = 'sk-secret-123';
  t.after(() => { deps.load = load; delete process.env.TIKTOK_SIGN_API_KEY; });

  const ctx = fakeCtx();
  const acc = { ...account, id: 'tt-loop' };
  const handle = await tiktok.connect(ctx, acc);
  const conn = FakeConn.last;
  assert.equal(conn.uniqueId, 'tramevia');
  assert.equal(conn.opts.signApiKey, 'sk-secret-123');
  assert.equal(conn.opts.processInitialData, false);
  await tick();
  assert.equal(conn.checks, 1);
  assert.equal(conn.connects, 0, 'no websocket while offline');

  t.mock.timers.tick(119_000); await tick();
  assert.equal(conn.checks, 1);
  t.mock.timers.tick(1_000); await tick();
  assert.equal(conn.checks, 2);

  // Check failure: readable status, secret masked, slower retries (4 min after one failure).
  conn.failCheck = new Error('all sources failed sk-secret-123');
  t.mock.timers.tick(120_000); await tick();
  assert.equal(conn.checks, 3);
  const err = ctx.statuses.at(-1);
  assert.equal(err.status, 'error');
  assert.ok(!err.error.includes('sk-secret-123') && err.error.includes('***'));
  conn.failCheck = null;
  t.mock.timers.tick(120_000); await tick();
  assert.equal(conn.checks, 3);
  t.mock.timers.tick(120_000); await tick();
  assert.equal(conn.checks, 4);
  assert.equal(ctx.statuses.at(-1).status, 'ok');
  // Unknown username (TikTok API code user_not_found): explicit message.
  conn.failCheck = Object.assign(new Error('Failed to retrieve live status from all sources.'), {
    config: { requestErrs: [new Error('[fetchRoomInfoApiLiveRoute] API Error 19881007 (user_not_found)')] },
  });
  t.mock.timers.tick(120_000); await tick();
  assert.equal(ctx.statuses.at(-1).error, 'TikTok account @Tramevia not found: check the username');
  conn.failCheck = null;
  t.mock.timers.tick(240_000); await tick();
  assert.equal(conn.checks, 6);

  // Goes live → one connect, status ok, stats pushed.
  conn.live = true;
  t.mock.timers.tick(120_000); await tick(); await tick();
  assert.equal(conn.connects, 1);
  assert.equal(ctx.statuses.at(-1).status, 'ok');
  assert.deepEqual(ctx.stats.at(-1), { id: 'tt-loop', live: true, viewers: 12, startedAt: 1_759_800_000_000, title: 'Soirée chill' });

  // Realtime events.
  conn.emit('roomUser', { total: '34', ranks: [{ user: user() }] });
  assert.deepEqual(ctx.stats.at(-1), { id: 'tt-loop', live: true, viewers: 34 });
  conn.emit('roomUser', { total: '34', ranks: [{ user: user() }] });
  assert.equal(ctx.stats.length, 2, 'unchanged viewers are not re-pushed');
  conn.emit('chat', { user: user(), content: 'hello', common: { msgId: '9' } });
  conn.emit('member', { user: user() });
  conn.emit('gift', { gift: { name: 'Rose', type: 1, diamondCount: 1 }, repeatCount: 2, repeatEnd: 0, user: user() });
  conn.emit('gift', { gift: { name: 'Rose', type: 1, diamondCount: 1 }, repeatCount: 2, repeatEnd: 1, user: user() });
  conn.emit('follow', { user: user() });
  conn.emit('share', { user: user() });
  conn.emit('subNotify', { user: user(), subMonth: '3' });
  conn.emit('like', { count: 4, total: '1500', user: user() });
  conn.emit('imDelete', { deleteMsgIds: ['9'], deleteUserIds: [] });
  conn.emit('chat', null); // malformed payload must not throw
  const frames = ctx.published.map(f => f.t === 'event' ? `event:${f.d.type}` : f.t);
  assert.deepEqual(frames, ['chat', 'event:gift', 'event:follow', 'event:share', 'event:sub', 'event:like', 'chat:delete']);
  const chat = ctx.published[0].d;
  assert.deepEqual(chat.author.roles, ['vip']);
  assert.equal(ctx.published.find(f => f.d.type === 'sub').d.months, 3);
  assert.deepEqual(ctx.published.at(-1).d, { accountId: 'tt-loop', messageId: '9' });
  const stats = await tiktok.stats(ctx, acc);
  assert.equal(stats.live, true);
  assert.equal(stats.viewers, 34);
  assert.equal(stats.likes, 1500);

  // Drop → reconnect after backoff (10 s), no extra live checks.
  const checks = conn.checks;
  conn.emit('disconnected', { code: 1006 });
  t.mock.timers.tick(9_000); await tick();
  assert.equal(conn.connects, 1);
  t.mock.timers.tick(1_000); await tick(); await tick();
  assert.equal(conn.connects, 2);
  assert.equal(conn.checks, checks);

  // Stream end → offline stats, back to 2-min checks.
  conn.live = false;
  conn.emit('streamEnd', { action: 3 });
  conn.emit('disconnected', { code: 1000 });
  assert.deepEqual(ctx.stats.at(-1), { id: 'tt-loop', live: false, viewers: 0, startedAt: null, likes: 0 });
  t.mock.timers.tick(120_000); await tick();
  assert.equal(conn.checks, checks + 1);
  assert.equal(conn.connects, 2);
  assert.equal((await tiktok.stats(ctx, acc)).live, false);
  assert.equal((await tiktok.stats(ctx, acc)).likes, 0, 'likes of the previous LIVE are not carried over');

  // Euler rate limit: readable status and a long wait (≥ 5 min).
  conn.live = true;
  conn.failConnect = Object.assign(new SignatureRateLimitError('429'), { retryAfter: 0 });
  t.mock.timers.tick(120_000); await tick(); await tick();
  assert.equal(conn.connects, 3);
  assert.match(ctx.statuses.at(-1).error, /Euler Stream/);
  t.mock.timers.tick(299_000); await tick();
  assert.equal(conn.connects, 3);
  conn.failConnect = null;
  t.mock.timers.tick(1_000); await tick(); await tick();
  assert.equal(conn.connects, 4);

  // stop(): disconnects, clears timers and listeners.
  handle.stop();
  assert.equal(conn.disconnects, 1);
  assert.equal(conn.listenerCount('chat'), 0);
  conn.emit('disconnected', {});
  t.mock.timers.tick(3_600_000); await tick();
  assert.equal(conn.connects, 4);
});

test('stats without a running loop: offline default, no network', async () => {
  const s = await tiktok.stats(fakeCtx(), { ...account, id: 'never-connected' });
  assert.deepEqual(s, { live: false, viewers: 0, startedAt: null, title: '', category: '', likes: 0 });
});

/** Swaps the library for `Conn` (a fake TikTokLiveConnection) for the duration of the test. */
function fakeLib(t, Conn) {
  const load = deps.load;
  deps.load = async () => ({ TikTokLiveConnection: Conn, UserOfflineError: class extends Error {}, SignatureRateLimitError: class extends Error {} });
  t.after(() => { deps.load = load; });
}

test('status: a stored error is re-reported after the manager resets it (no stale de-dup)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const notFound = Object.assign(new Error('Failed to retrieve live status from all sources.'), {
    config: { requestErrs: [new Error('[fetchRoomInfoApiLiveRoute] API Error 19881007 (user_not_found)')] },
  });
  fakeLib(t, class extends EventEmitter {
    async fetchIsLive() { await tick(); throw notFound; } // network-bound: settles after connect() has returned
    async connect() {}
    async disconnect() {}
  });
  const ctx = fakeCtx();
  const msg = 'TikTok account @Tramevia not found: check the username';
  // Persisted from the previous run; accounts.start() resets it to 'ok' right after connect() returns.
  const handle = await tiktok.connect(ctx, { ...account, id: 'tt-restart', status: 'error', error: msg });
  ctx.accounts.setStatus('tt-restart', 'ok', '');
  await tick();
  assert.deepEqual(ctx.statuses.at(-1), { id: 'tt-restart', status: 'error', error: msg });
  handle.stop();
});

test('reconnects back off when the socket keeps dropping right after it opens (Euler budget)', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  class DropConn extends EventEmitter {
    static last;
    at = []; stay = false; roomInfo = { data: {} };
    constructor() { super(); DropConn.last = this; }
    async fetchIsLive() { return true; }
    async connect() {
      this.at.push(Date.now());
      if (!this.stay) setTimeout(() => this.emit('disconnected', { code: 1006 }), 1_000); // TikTok closes it after the handshake
    }
    async disconnect() {}
  }
  fakeLib(t, DropConn);
  const handle = await tiktok.connect(fakeCtx(), { ...account, id: 'tt-drop' });
  const conn = DropConn.last;
  for (let s = 0; s < 3600; s++) { t.mock.timers.tick(1_000); await tick(); }
  const gaps = conn.at.slice(1).map((v, i) => (v - conn.at[i]) / 1000);
  assert.ok(conn.at.length <= 20, `${conn.at.length} connects (sign requests) in an hour`);
  assert.deepEqual(gaps.slice(0, 6), [11, 21, 41, 81, 161, 301]);
  assert.ok(gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), 'gaps never shrink');

  // A connection that stayed up more than a minute reconnects quickly again (10 s).
  conn.stay = true;
  for (let s = 0; s < 400; s++) { t.mock.timers.tick(1_000); await tick(); } // next reconnect, then 1+ min up
  const n = conn.at.length;
  conn.emit('disconnected', { code: 1006 });
  t.mock.timers.tick(10_000); await tick();
  assert.equal(conn.at.length, n + 1);
  handle.stop();
});
