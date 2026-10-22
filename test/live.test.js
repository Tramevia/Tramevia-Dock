// Live tools: chat commands and reminders (src/chat/bot.js), poll (src/poll.js), goals (src/goals.js), live summary and
// Discord (src/live.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account } from './helpers.js';
import { validate as validateBot, createBot } from '../src/chat/bot.js';
import { validate as validatePoll, createPoll } from '../src/poll.js';
import { gains, validate as validateGoals, createGoals, DEFAULTS as GOALS } from '../src/goals.js';
import { createLive, register as registerLive } from '../src/live.js';
import { seal } from '../src/crypto.js';

const tick = () => new Promise(r => setImmediate(r));
const chat = (over = {}) => ({ id: 'm1', platform: 'twitch', accountId: 'tw', text: 'salut', author: { id: 'u1', login: 'pixel', name: 'Pixel', roles: [] }, flags: {}, deleted: false, ...over });

/** ctx with live accounts tw (Twitch, 500), yt (YouTube, 200) and tt (TikTok, can't send); sent messages in ctx.sent. */
function liveCtx({ live = true } = {}) {
  const ctx = fakeCtx();
  const accounts = [account({ id: 'tw' }), account({ id: 'yt', platform: 'youtube', platformUserId: 'UC' + 'x'.repeat(22), login: 'chaine' }), account({ id: 'tt', platform: 'tiktok', login: 'tok' })];
  const stats = { tw: { live, viewers: 40, startedAt: Date.now() - 60_000, title: 'Ranked @everyone', category: 'VALORANT' }, yt: { live, viewers: 12 }, tt: { live, viewers: 5 } };
  const caps = { tw: { chatSend: true, limits: { chatMaxLength: 500 } }, yt: { chatSend: true, limits: { chatMaxLength: 200 } }, tt: { chatSend: false } };
  ctx.sent = [];
  Object.assign(ctx.accounts, { list: () => accounts, get: id => accounts.find(a => a.id === id) || null, stats: id => stats[id] || null, describe: a => ({ ...a, caps: caps[a.id] }) });
  ctx.adapterFor = () => ({ send: async (c, a, { text }) => { ctx.sent.push([a.id, text]); return { ok: true }; } });
  ctx.statsOf = stats;
  return ctx;
}

test('bot settings: names cleaned, ! and / refused, duplicates refused', () => {
  const { settings } = validateBot({ commands: [{ name: '!Discord', text: '  Rejoins   le Discord  ' }], timers: [{ text: 'Pense au follow', minutes: 15 }] });
  assert.deepEqual(settings.commands, [{ name: 'discord', text: 'Rejoins le Discord' }]);
  assert.equal(settings.timers[0].minutes, 15);
  assert.ok(validateBot({ commands: [{ name: 'a', text: '!ban moi' }] }).error);
  assert.ok(validateBot({ commands: [{ name: 'a', text: '/clear' }] }).error);
  assert.ok(validateBot({ commands: [{ name: 'réseaux', text: 'x' }, { name: 'RESEAUX', text: 'y' }] }).error, 'accents and case fold');
  assert.ok(validateBot({ commands: [{ name: 'a b', text: 'x' }] }).error);
  assert.ok(validateBot({ timers: [{ text: 'x', minutes: 2 }] }).error, 'every 5 minutes at least');
});

test('bot: a command is answered in its own chat, after the question, with a cooldown', async () => {
  let t = 1_000_000;
  const ctx = liveCtx();
  const bot = createBot(ctx, () => t);
  bot.set({ commands: [{ name: 'réseaux', text: 'Salut {user}, tout est sur tramevia.com' }], timers: [], offAccounts: [] });
  bot.onChat(chat({ text: '!RESEAUX' }));
  assert.deepEqual(ctx.sent, [], 'not inside the publish of the question');
  await tick();
  assert.deepEqual(ctx.sent, [['tw', 'Salut Pixel, tout est sur tramevia.com']]);
  bot.onChat(chat({ text: '!reseaux' }));
  t += 10_000;
  bot.onChat(chat({ text: '!reseaux', accountId: 'yt', platform: 'youtube' }));
  await tick();
  assert.equal(ctx.sent.length, 2, 'cooldown per channel: Twitch waits, YouTube answers');
  bot.onChat(chat({ text: '!reseaux', accountId: 'tw', deleted: true }));
  bot.set({ ...bot.get(), offAccounts: ['tw'] });
  t += 60_000;
  bot.onChat(chat({ text: '!reseaux' }));
  await tick();
  assert.equal(ctx.sent.length, 2, 'filtered message or muted channel: no answer');
  bot.stop();
});

test('bot: reminders go to every live channel that can send, only after viewers wrote, cut to the platform length', async () => {
  let t = 0;
  const ctx = liveCtx();
  const bot = createBot(ctx, () => t);
  bot.set({ commands: [], timers: [{ text: 'x'.repeat(300), minutes: 15 }], offAccounts: [] });
  bot.tick();
  assert.equal(ctx.sent.length, 0, 'first one an interval after the stream starts');
  t = 15 * 60_000;
  bot.tick();
  await tick();
  assert.deepEqual(ctx.sent.map(([id, text]) => [id, [...text].length]), [['tw', 300], ['yt', 200]], 'TikTok cannot send; YouTube cut to 200');
  assert.ok(ctx.sent[1][1].endsWith('…'));
  t = 30 * 60_000;
  bot.tick();
  await tick();
  assert.equal(ctx.sent.length, 2, 'nobody wrote since: nothing');
  bot.onChat(chat({ accountId: 'yt', platform: 'youtube' }));
  bot.onChat(chat({ accountId: 'tw', flags: { self: true } }));
  t = 45 * 60_000;
  bot.tick();
  await tick();
  assert.deepEqual(ctx.sent.slice(2).map(([id]) => id), ['yt'], 'our own message does not count as chat activity');
  for (const s of Object.values(ctx.statsOf)) s.live = false;
  t = 60 * 60_000;
  bot.tick();
  await tick();
  assert.equal(ctx.sent.length, 3, 'off: nothing');
  bot.stop();
});

test('poll: validation, one vote per person, votes flagged, result announced', async () => {
  assert.ok(validatePoll({ question: 'Q', options: ['a'], seconds: 60 }).error);
  assert.ok(validatePoll({ question: 'Q', options: ['a', 'b'], seconds: 5 }).error);
  const { poll } = validatePoll({ question: ' On joue à quoi ? ', options: ['Minecraft', ' ', 'VALORANT'], seconds: 60 });
  assert.deepEqual(poll, { question: 'On joue à quoi ?', options: ['Minecraft', 'VALORANT'], seconds: 60, announce: true });

  const ctx = fakeCtx();
  const said = [];
  ctx.bot = { sayLive: async text => { said.push(text); } };
  const p = createPoll(ctx);
  p.start(poll);
  assert.match(said[0], /1 for Minecraft, 2 for VALORANT/);
  const votes = [chat({ text: '2' }), chat({ text: ' 2 ' }), chat({ text: '1', author: { id: 'u2' } }), chat({ text: '2', platform: 'tiktok', author: { id: 'u1' } }),
    chat({ text: '3', author: { id: 'u3' } }), chat({ text: '12', author: { id: 'u4' } }), chat({ text: '1', author: { id: 'u5' }, deleted: true })];
  for (const m of votes) p.vote(m);
  assert.deepEqual(p.get().options.map(o => o.votes), [1, 2], 'same person twice counts once; same id on another platform is another person');
  assert.deepEqual(votes.map(m => m.flags.vote), [2, 2, 1, 2, undefined, undefined, undefined]);
  p.close();
  assert.ok(p.get().closedAt);
  p.vote(chat({ text: '1', author: { id: 'u9' } }));
  assert.equal(p.get().total, 3, 'closed: no more votes');
  assert.match(said[1], /VALORANT \(67%\) out of 3 votes/);
  p.clear();
  assert.equal(p.get(), null);
});

test('goals: follows and subs over every platform, an event counted once', () => {
  assert.deepEqual([gains({ type: 'follow' }), gains({ type: 'resub' }), gains({ type: 'giftmembership', count: 5 }), gains({ type: 'cheer' }), gains({ type: 'sub', test: true })],
    [{ follows: 1 }, { subs: 1 }, { subs: 5 }, null, null]);
  const ctx = fakeCtx();
  const g = createGoals(ctx);
  assert.deepEqual(g.get(), GOALS);
  for (const e of [{ id: 'a', accountId: 'tw', type: 'sub' }, { id: 'a', accountId: 'tw', type: 'sub' }, { id: 'a', accountId: 'kick', type: 'giftsub', count: 3 }, { id: 'b', accountId: 'yt', type: 'membership' }, { id: 'c', accountId: 'tt', type: 'follow' }]) g.onEvent(e);
  assert.equal(g.get().subs.count, 5);
  assert.equal(g.get().follows.count, 1);
  assert.deepEqual(ctx.settings.get('goals'), g.get(), 'saved');
  assert.equal(ctx.published.at(-1).t, 'goal');
  assert.ok(validateGoals({ subs: { label: '', target: 0, count: 0 } }).error);
  assert.deepEqual(validateGoals({ subs: { label: ' 50  abonnés ', target: 50, count: 12 } }, g.get()).goals.subs, { label: '50 abonnés', target: 50, count: 12 });
});

test('live summary: duration, peaks, follows and subs per platform, top chatters; Discord announcement and recap', async () => {
  let t = Date.now();
  const ctx = liveCtx();
  let state = 'live';
  ctx.liveState = () => state;
  ctx.settings.set('discord', { webhook: seal('https://discord.com/api/webhooks/1/x', 'discord') });
  const posts = [];
  const live = createLive(ctx, { now: () => t, post: async body => { posts.push(body); } });
  live.onStats();
  assert.equal(live.state().current.startedAt, ctx.statsOf.tw.startedAt, 'starts at the platform start time');
  ctx.statsOf.tw.viewers = 100;
  live.onStats();
  ctx.statsOf.tw.viewers = 60;
  live.onStats();
  for (const e of [{ id: 'f1', accountId: 'tw', platform: 'twitch', type: 'follow' }, { id: 'f1', accountId: 'tw', platform: 'twitch', type: 'follow' }, { id: 'g', accountId: 'yt', platform: 'youtube', type: 'giftmembership', count: 4 }]) live.onEvent(e);
  for (const [who, n] of [['a', 3], ['b', 1]]) for (let i = 0; i < n; i++) live.onChat(chat({ author: { id: who, name: who.toUpperCase(), roles: [] } }));
  live.onChat(chat({ flags: { self: true } }));
  live.onChat(chat({ author: { id: 'nb', name: 'Nightbot', roles: ['bot'] } }));
  state = 'off';
  t += 3_600_000;
  live.onStats();
  state = 'live';
  t += 60_000;
  live.onStats();
  assert.ok(live.state().current, 'back within 5 minutes: same stream');
  state = 'off';
  live.onStats();
  const offAt = t;
  t += 5 * 60_000;
  live.end();
  const s = live.state();
  assert.equal(s.current, null);
  assert.equal(s.last.endedAt, offAt, 'ends when it went off, not after the grace period');
  assert.equal(s.last.peak, 117);
  assert.deepEqual(s.last.platforms.find(p => p.platform === 'twitch'), { platform: 'twitch', follows: 1, subs: 0, messages: 4, peak: 100 });
  assert.equal(s.last.platforms.find(p => p.platform === 'youtube').subs, 4);
  assert.deepEqual([s.last.messages, s.last.chatters, s.last.top[0]], [4, 2, { name: 'A', platform: 'twitch', n: 3 }]);
  assert.deepEqual(ctx.settings.get('live:last'), s.last);

  const recap = posts[0].embeds[0];
  assert.match(recap.description, /^1 h 02 · peak of 117 viewers · 4 messages from 2 people$/);
  assert.match(recap.fields.at(-1).value, /^1\. A \(Twitch\) · 3/);
  state = 'live';
  live.onStats();
  const a = live.announceMessage();
  assert.equal(a.content, '🔴 Streamer is live: Ranked @​everyone', 'a title never pings');
  assert.match(a.embeds[0].description, /\*\*Twitch\*\* · https:\/\/www\.twitch\.tv\/streamer\n\*\*YouTube\*\* · https:\/\/www\.youtube\.com\/channel\/UCx+\/live\n\*\*TikTok\*\*/);
});

test('discord settings: webhook checked, sealed, never sent back', async () => {
  const ctx = liveCtx();
  ctx.liveState = () => 'off';
  const routes = {};
  const router = Object.fromEntries(['get', 'put', 'post', 'delete'].map(m => [m, (p, h) => { routes[`${m.toUpperCase()} ${p}`] = h; }]));
  registerLive(router, ctx);
  const put = body => routes['PUT /api/discord']({ body });
  assert.throws(() => put({ webhook: 'https://evil.example/api/webhooks/1/x' }), /not a Discord webhook/);
  await assert.rejects(routes['POST /api/discord/test'](), /webhook address first/);
  const url = 'https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz_-123';
  const r = put({ webhook: url, announce: false, message: ' 🔴 {name} en live ! @everyone ' });
  assert.deepEqual(r, { announce: false, summary: true, message: '🔴 {name} en live ! @everyone', webhook: true, hint: '…/6789' });
  assert.ok(!JSON.stringify(ctx.settings.get('discord')).includes('abcdefghij'), 'sealed at rest');
  assert.equal(put({ webhook: '' }).webhook, false);
  ctx.live.end();
});
