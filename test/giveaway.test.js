// 1.6 live tools: giveaway (src/giveaway.js), alert history and control (src/alerts.js), credits of a live session (src/live.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account } from './helpers.js';
import { validate, createGiveaway } from '../src/giveaway.js';
import { createAlerts } from '../src/alerts.js';
import { createLive } from '../src/live.js';
import { cleanOverlay, overlayFromQuery, DEFAULTS } from '../public/assets/overlay-settings.js';

const chat = (over = {}) => ({ id: 'm1', platform: 'twitch', accountId: 'tw', text: '!participer', author: { id: 'u1', login: 'pixel', name: 'Pixel', roles: [] }, flags: {}, deleted: false, ...over });
const frames = (ctx, t) => ctx.published.filter(f => f.t === t);

test('giveaway settings: keyword cleaned, invalid ones refused', () => {
  assert.deepEqual(validate({ keyword: '  !Participer ', title: '  Une   clé ' }).giveaway, { keyword: 'participer', title: 'Une clé', announce: true });
  assert.ok(validate({ keyword: 'deux mots' }).error);
  assert.ok(validate({ keyword: '' }).error);
  assert.ok(validate({ keyword: 'ok', title: 'x'.repeat(61) }).error);
});

test('giveaway: one entry per person and platform, flagged, bots and own messages out', async () => {
  const ctx = fakeCtx();
  const g = createGiveaway(ctx);
  g.start({ keyword: 'participer', title: '', announce: false });
  const a = chat();
  g.enter(a);
  assert.equal(a.flags.entry, true);
  g.enter(chat({ text: '!PARTICIPER' }));
  g.enter(chat({ platform: 'youtube', accountId: 'yt' }));
  g.enter(chat({ author: { id: 'b', name: 'Nightbot', roles: ['bot'] } }));
  g.enter(chat({ author: { id: 'me', name: 'Me', roles: [] }, flags: { self: true } }));
  g.enter(chat({ author: { id: 'u3', name: 'Del', roles: [] }, deleted: true }));
  const other = chat({ text: '!participer maintenant', author: { id: 'u4', name: 'Too', roles: [] } });
  g.enter(other);
  assert.equal(other.flags.entry, undefined, 'only the keyword alone');
  g.enter(chat({ text: '!participér', author: { id: 'u5', name: 'Accent', roles: [] } }));
  assert.equal(g.get().count, 3, 'Pixel on Twitch, Pixel on YouTube, the accented spelling');
  assert.equal(g.get().recent[0].name, 'Accent');
  assert.equal(JSON.stringify(g.get()).includes('u1'), false, 'no user ids in the public view');
});

test('giveaway: a draw closes the entries, never picks a winner twice, then refuses', () => {
  const ctx = fakeCtx();
  let i = 0;
  const g = createGiveaway(ctx, { pick: n => (i++ % n) });
  g.start({ keyword: 'go', title: 'Clé', announce: false });
  assert.equal(g.draw(), null, 'nobody entered');
  g.enter(chat({ text: '!go' }));
  g.enter(chat({ text: '!go', author: { id: 'u2', name: 'Kaori', roles: [] } }));
  const first = g.draw();
  assert.equal(first.open, false);
  assert.equal(first.winners.length, 1);
  assert.equal(first.draw.reel.at(-1).name, first.winners[0].name, 'the reel lands on the winner');
  g.enter(chat({ text: '!go', author: { id: 'u9', name: 'Late', roles: [] } }));
  assert.equal(g.get().count, 2, 'closed: no more entries');
  const second = g.draw();
  assert.notEqual(second.winners[1].name, second.winners[0].name);
  assert.equal(g.draw(), null, 'everyone has won');
  g.clear();
  assert.equal(g.get(), null);
  assert.equal(frames(ctx, 'giveaway').at(-1).d, null);
});

test('giveaway: announcements go to the live chats', async () => {
  const ctx = fakeCtx();
  const said = [];
  ctx.bot = { sayLive: async text => { said.push(text); } };
  const g = createGiveaway(ctx, { pick: () => 0 });
  g.start({ keyword: 'join', title: 'A key', announce: true });
  g.enter(chat({ text: '!join' }));
  g.draw();
  assert.deepEqual(said, ['🎁 Giveaway: A key! Type !join to enter.', '🎁 Entries closed: 1 entry.', '🎉 Congrats Pixel (Twitch)!']);
});

test('alerts: history keeps the last 30 alerting events, newest first, likes and tests out', () => {
  const ctx = fakeCtx();
  const alerts = createAlerts(ctx);
  for (let i = 0; i < 35; i++) alerts.onEvent({ id: `e${i}`, accountId: 'tw', platform: 'twitch', type: 'follow', user: { name: `u${i}` } });
  alerts.onEvent({ id: 'l', accountId: 'tt', platform: 'tiktok', type: 'like', count: 20 });
  alerts.onEvent({ id: 't', accountId: 'tw', platform: 'twitch', type: 'sub', test: true });
  alerts.onEvent({ id: 'x', accountId: 'tw', platform: 'twitch', type: 'stream_online' });
  const { history } = alerts.state();
  assert.equal(history.length, 30);
  assert.equal(history[0].id, 'e34');
  alerts.onEvent({ id: 'e20', accountId: 'tw', platform: 'twitch', type: 'follow', user: { name: 'again' } });
  assert.equal(alerts.state().history[0].user.name, 'again', 'the same id again takes the newest place');
  assert.equal(alerts.state().history.filter(e => e.id === 'e20').length, 1);
});

test('alerts: replay, skip and pause go to the overlays as alert:control', () => {
  const ctx = fakeCtx();
  const alerts = createAlerts(ctx);
  alerts.onEvent({ id: 'r1', accountId: 'tw', platform: 'twitch', type: 'raid', count: 12, user: { name: 'Ourse' } });
  assert.equal(alerts.replay('tw:nope'), false);
  assert.equal(alerts.replay('tw:r1'), true);
  alerts.skip();
  alerts.setPaused(true);
  assert.equal(alerts.paused(), true);
  const control = frames(ctx, 'alert:control').map(f => f.d);
  assert.equal(control[0].action, 'replay');
  assert.equal(control[0].event.replay, true);
  assert.deepEqual(control.slice(1), [{ action: 'skip' }, { action: 'pause' }]);
  assert.equal(frames(ctx, 'event').length, 0, 'a replay is never an event again (goals, recap)');
});

test('credits: names per list, amounts added up, duplicates and tests out, stored with the last stream', () => {
  const ctx = fakeCtx();
  const accounts = [account({ id: 'tw' })];
  const stats = { tw: { live: true, viewers: 10, startedAt: Date.now() - 120_000 } };
  Object.assign(ctx.accounts, { list: () => accounts, get: () => accounts[0], stats: id => stats[id] });
  ctx.liveState = () => (stats.tw.live ? 'live' : 'off');
  ctx.hub.clear = () => {};
  const live = createLive(ctx);
  live.onStats();
  const ev = (id, over) => live.onEvent({ id, accountId: 'tw', platform: 'twitch', ...over });
  ev('1', { type: 'follow', user: { id: 'a', name: 'Alpha' } });
  ev('1', { type: 'follow', user: { id: 'a', name: 'Alpha' } });
  ev('2', { type: 'cheer', amount: 100, user: { id: 'b', name: 'Beta' } });
  ev('3', { type: 'cheer', amount: 250, user: { id: 'b', name: 'Beta' } });
  ev('4', { type: 'giftsub', count: 5, user: { id: 'c', name: 'Gamma' } });
  ev('5', { type: 'raid', count: 42, user: { id: 'd', name: 'Delta' } });
  ev('6', { type: 'superchat', amount: 5, currency: 'EUR', platform: 'youtube', user: { id: 'e', name: 'Eps' } });
  ev('7', { type: 'follow', user: { id: 'z', name: 'Test' }, test: true });
  ev('8', { type: 'cheer', amount: 50 }); // anonymous
  live.onChat({ platform: 'twitch', author: { id: 'a', name: 'Alpha' }, flags: {} });
  const c = live.credits();
  assert.equal(c.live, true);
  assert.deepEqual(c.follows.map(x => x.name), ['Alpha']);
  assert.deepEqual(c.tips.map(x => [x.name, x.amount]), [['Beta', 350], ['Eps', 5]]);
  assert.equal(c.tips[1].currency, 'EUR');
  assert.deepEqual(c.gifts, [{ name: 'Gamma', platform: 'twitch', n: 5 }]);
  assert.deepEqual(c.raids, [{ name: 'Delta', platform: 'twitch', n: 42 }]);
  assert.equal(c.top[0].name, 'Alpha');
  assert.equal(live.state().current.platforms[0].follows, 1, 'goals and recap counts unchanged');
  assert.equal('credits' in live.state().current, false, 'the dashboard never gets the lists');
  live.end();
  assert.equal(live.credits().live, false);
  assert.deepEqual(live.credits().follows.map(x => x.name), ['Alpha'], 'kept with the last stream');
  assert.equal('credits' in live.state().last, false);
});

test('overlay settings: giveaway and credits ids, roll duration, loop, motion, font, effects', () => {
  assert.equal(DEFAULTS.credits.rollSeconds, 45);
  assert.deepEqual([DEFAULTS.credits.motion, DEFAULTS.credits.font, DEFAULTS.credits.fx, DEFAULTS.credits.emoji], ['scenes', 'auto', 'confetti', true]);
  assert.deepEqual([DEFAULTS.chat.motion, DEFAULTS.chat.fx, DEFAULTS.chat.emoji], ['roll', 'none', false]);
  const c = cleanOverlay({ motion: 'arcade', font: 'hand', fx: 'bokeh', emoji: false }, DEFAULTS.credits);
  assert.deepEqual([c.motion, c.font, c.fx, c.emoji], ['arcade', 'hand', 'bokeh', false]);
  const bad = cleanOverlay({ motion: 'spin', font: 'Comic', fx: 'fire' }, DEFAULTS.credits);
  assert.deepEqual([bad.motion, bad.font, bad.fx], ['scenes', 'auto', 'confetti']);
  const w = overlayFromQuery(new URLSearchParams('id=credits&motion=warp&font=display&fx=sparkles&emoji=0&color=ff8800'), null).settings;
  assert.deepEqual([w.motion, w.font, w.fx, w.emoji, w.color], ['warp', 'display', 'sparkles', false, '#ff8800']);
  assert.equal(cleanOverlay({ rollSeconds: 5, loop: 'yes' }, DEFAULTS.credits).rollSeconds, 10);
  assert.equal(cleanOverlay({ loop: true }, DEFAULTS.credits).loop, true);
  const q = overlayFromQuery(new URLSearchParams('id=credits&rollSeconds=90&loop=1'), null);
  assert.equal(q.credits, true);
  assert.equal(q.featured, false);
  assert.equal(q.settings.rollSeconds, 90);
  assert.equal(q.settings.loop, true);
  assert.equal(overlayFromQuery(new URLSearchParams('id=giveaway'), null).giveaway, true);
});
