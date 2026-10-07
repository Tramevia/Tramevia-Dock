import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account, mockFetch } from './helpers.js';
import twitch, { normalizeChatMessage, normalizeEvent, boxArt, LABELS } from '../src/platforms/twitch.js';

const json = init => JSON.parse(init.body);
const form = init => Object.fromEntries(new URLSearchParams(init.body));

test('authorize URL: code flow, force_verify, state, scopes', () => {
  const { url } = twitch.authorize(fakeCtx(), { state: 'st4te', redirectUri: 'http://localhost:8787/auth/twitch/callback', app: { clientId: 'cid' } });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://id.twitch.tv/oauth2/authorize');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:8787/auth/twitch/callback');
  assert.equal(u.searchParams.get('state'), 'st4te');
  assert.equal(u.searchParams.get('force_verify'), 'true');
  // Only scopes the adapter uses (no user:edit, warnings, ads, hype train, subscriptions, chat settings).
  assert.deepEqual(u.searchParams.get('scope').split(' ').sort(), [
    'bits:read', 'channel:manage:broadcast', 'channel:read:redemptions', 'channel:read:vips', 'clips:edit', 'moderation:read',
    'moderator:manage:banned_users', 'moderator:manage:chat_messages', 'moderator:read:chatters', 'moderator:read:followers',
    'user:read:chat', 'user:write:chat',
  ]);
  assert.deepEqual(twitch.capabilities.limits, { chatMaxLength: 500, timeoutMin: 1, timeoutMax: 1209600 });
});

test('callback: token exchange → validate → users', async () => {
  const m = mockFetch(url => {
    if (url.pathname === '/oauth2/token') return { body: { access_token: 'AT', refresh_token: 'RT', expires_in: 14000, scope: [], token_type: 'bearer' } };
    if (url.pathname === '/oauth2/validate') return { body: { client_id: 'cid', login: 'streamer', user_id: '1234', scopes: ['user:read:chat'], expires_in: 14000 } };
    if (url.pathname === '/helix/users') return { body: { data: [{ id: '1234', login: 'streamer', display_name: 'Streamer', profile_image_url: 'https://static-cdn.jtvnw.net/a.png' }] } };
  });
  try {
    const r = await twitch.callback(fakeCtx(), { code: 'CODE', redirectUri: 'http://localhost:8787/auth/twitch/callback', app: { clientId: 'cid', clientSecret: 'sec' } });
    assert.deepEqual(form(m.calls[0].init), { client_id: 'cid', client_secret: 'sec', code: 'CODE', grant_type: 'authorization_code', redirect_uri: 'http://localhost:8787/auth/twitch/callback' });
    assert.equal(m.calls[1].init.headers.Authorization, 'OAuth AT');
    assert.equal(m.calls[2].url.searchParams.get('id'), '1234');
    assert.equal(m.calls[2].init.headers['Client-Id'], 'cid');
    assert.equal(r.platformUserId, '1234');
    assert.equal(r.login, 'streamer');
    assert.equal(r.displayName, 'Streamer');
    assert.equal(r.avatar, 'https://static-cdn.jtvnw.net/a.png');
    assert.deepEqual(r.scopes, ['user:read:chat']);
    assert.equal(r.tokens.access, 'AT');
    assert.equal(r.tokens.refresh, 'RT');
    assert.ok(r.tokens.expiresAt > Date.now() + 13_000_000);
  } finally { m.restore(); }
});

test('refresh keeps the old refresh token when none is returned; testApp uses client_credentials', async () => {
  const m = mockFetch(url => url.pathname === '/oauth2/token' ? { body: { access_token: 'NEW', expires_in: 100 } } : { status: 200, body: null });
  try {
    const t = await twitch.refresh(fakeCtx(), account(), { access: 'old', refresh: 'R1' });
    assert.equal(form(m.calls[0].init).grant_type, 'refresh_token');
    assert.equal(form(m.calls[0].init).refresh_token, 'R1');
    assert.equal(t.access, 'NEW');
    assert.equal(t.refresh, 'R1');
    const r = await twitch.testApp(fakeCtx(), { clientId: 'cid', clientSecret: 'sec' });
    assert.equal(r.ok, true);
    assert.equal(form(m.calls[1].init).grant_type, 'client_credentials');
  } finally { m.restore(); }
});

test('setInfo maps changes to PATCH /channels (only present keys, CCL for all labels)', async () => {
  const m = mockFetch(() => ({ status: 204, body: null }));
  try {
    const ctx = fakeCtx();
    await twitch.setInfo(ctx, account(), {
      title: 'Hello', category: { id: '33214', name: 'Fortnite' }, tags: ['FR', 'Chill'], language: 'fr', labels: ['Gambling'], brandedContent: true,
    });
    assert.equal(m.calls[0].init.method, 'PATCH');
    assert.equal(m.calls[0].url.pathname, '/helix/channels');
    assert.equal(m.calls[0].url.searchParams.get('broadcaster_id'), '1234');
    assert.deepEqual(json(m.calls[0].init), {
      title: 'Hello', game_id: '33214', tags: ['FR', 'Chill'], broadcaster_language: 'fr', is_branded_content: true,
      content_classification_labels: LABELS.map(id => ({ id, is_enabled: id === 'Gambling' })),
    });
    await twitch.setInfo(ctx, account(), { title: 'Only title' });
    assert.deepEqual(json(m.calls[1].init), { title: 'Only title' });
    await twitch.setInfo(ctx, account(), { category: null, labels: [] });
    assert.deepEqual(json(m.calls[2].init), { game_id: '0', content_classification_labels: LABELS.map(id => ({ id, is_enabled: false })) });
    await twitch.setInfo(ctx, account(), {});
    assert.equal(m.calls.length, 3);
  } finally { m.restore(); }
});

test('searchCategories + getInfo resize box art to 144x192', async () => {
  assert.equal(boxArt('https://static-cdn.jtvnw.net/ttv-boxart/33214-52x72.jpg'), 'https://static-cdn.jtvnw.net/ttv-boxart/33214-144x192.jpg');
  assert.equal(boxArt('https://static-cdn.jtvnw.net/ttv-boxart/33214_IGDB-{width}x{height}.jpg'), 'https://static-cdn.jtvnw.net/ttv-boxart/33214_IGDB-144x192.jpg');
  assert.equal(boxArt('javascript:alert(1)'), '');
  const m = mockFetch(url => {
    if (url.pathname === '/helix/search/categories') return { body: { data: [{ id: '33214', name: 'Fortnite', box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-52x72.jpg' }] } };
    if (url.pathname === '/helix/channels') return { body: { data: [{ title: 'T', game_id: '509658', game_name: 'Just Chatting', tags: ['FR'], broadcaster_language: 'fr', content_classification_labels: ['MatureGame', 'Gambling'], is_branded_content: false }] } };
    if (url.pathname === '/helix/games') return { body: { data: [{ id: '509658', box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg' }] } };
  });
  try {
    const cats = await twitch.searchCategories(fakeCtx(), account(), 'fort nite');
    assert.equal(m.calls[0].url.searchParams.get('query'), 'fort nite');
    assert.equal(m.calls[0].url.searchParams.get('first'), '20');
    assert.deepEqual(cats, [{ id: '33214', name: 'Fortnite', image: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-144x192.jpg' }]);
    const info = await twitch.getInfo(fakeCtx(), account());
    assert.deepEqual(info, {
      title: 'T', category: { id: '509658', name: 'Just Chatting', image: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-144x192.jpg' },
      tags: ['FR'], language: 'fr', labels: ['Gambling'], brandedContent: false,
    });
  } finally { m.restore(); }
});

const ASSETS = {
  badges: new Map([['moderator/1', { title: 'Moderator', url: 'https://static-cdn.jtvnw.net/badges/v1/mod/2' }], ['subscriber/12', { title: '1-Year Subscriber', url: 'https://static-cdn.jtvnw.net/badges/v1/sub/2' }]]),
  cheermotes: new Map([['cheer', { prefix: 'Cheer', tiers: [
    { min_bits: 1, color: '#979797', images: { dark: { animated: { 2: 'https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/1/2.gif' } } } },
    { min_bits: 100, color: '#9c3ee8', images: { dark: { animated: { 2: 'https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/100/2.gif' } } } },
  ] }]]),
};
const chatEvent = (over = {}) => ({
  broadcaster_user_id: '1234', broadcaster_user_login: 'streamer', broadcaster_user_name: 'Streamer',
  chatter_user_id: '42', chatter_user_login: 'pixelpanda', chatter_user_name: 'PixelPanda', message_id: 'm1',
  message: { text: 'hi Kappa Cheer150 @Streamer', fragments: [
    { type: 'text', text: 'hi ' },
    { type: 'emote', text: 'Kappa', emote: { id: '25', emote_set_id: '0', format: ['static'] } },
    { type: 'text', text: ' ' },
    { type: 'cheermote', text: 'Cheer150', cheermote: { prefix: 'cheer', bits: 150, tier: 100 } },
    { type: 'text', text: ' ' },
    { type: 'mention', text: '@Streamer', mention: { user_id: '1234', user_login: 'streamer', user_name: 'Streamer' } },
  ] },
  message_type: 'text', color: '#FF7EB6', cheer: { bits: 150 }, reply: null,
  badges: [{ set_id: 'moderator', id: '1', info: '' }, { set_id: 'subscriber', id: '12', info: '14' }],
  ...over,
});

test('chat normalization: emote, cheermote, mention, badges, roles', () => {
  const msg = normalizeChatMessage(fakeCtx(), account(), chatEvent(), ASSETS, 1000);
  assert.equal(msg.id, 'm1');
  assert.equal(msg.platform, 'twitch');
  assert.equal(msg.accountId, 'acc1');
  assert.equal(msg.channel, 'streamer');
  assert.equal(msg.ts, 1000);
  assert.equal(msg.text, 'hi Kappa Cheer150 @Streamer');
  assert.deepEqual(msg.tokens, [
    { t: 'text', v: 'hi ' },
    { t: 'emote', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/static/dark/2.0' },
    { t: 'text', v: ' ' },
    { t: 'cheer', name: 'Cheer', amount: 150, url: 'https://d3aqoihi2n8ty8.cloudfront.net/actions/cheer/dark/animated/100/2.gif', color: '#9c3ee8' },
    { t: 'text', v: ' ' },
    { t: 'mention', v: '@Streamer' },
  ]);
  assert.deepEqual(msg.author, {
    id: '42', login: 'pixelpanda', name: 'PixelPanda', color: '#ff7eb6', avatar: '',
    badges: [{ id: 'moderator', title: 'Moderator', url: 'https://static-cdn.jtvnw.net/badges/v1/mod/2' }, { id: 'subscriber', title: '1-Year Subscriber', url: 'https://static-cdn.jtvnw.net/badges/v1/sub/2' }],
    roles: ['moderator', 'subscriber'],
  });
  assert.deepEqual(msg.flags, { action: false, highlight: true, self: false });
  assert.equal('first' in msg.flags, false, 'first is left to ctx.emitChat');
  assert.equal(msg.reply, null);
  assert.equal(msg.deleted, false);
});

test('chat normalization: animated emote, reply prefix stripped, user_intro, self, bot, /me', () => {
  const ctx = fakeCtx();
  const reply = normalizeChatMessage(ctx, account(), chatEvent({
    chatter_user_id: '1234', chatter_user_login: 'streamer', chatter_user_name: 'Streamer', cheer: null, badges: [{ set_id: 'broadcaster', id: '1' }],
    message_type: 'user_intro',
    message: { text: '@PixelPanda yes catJAM', fragments: [
      { type: 'mention', text: '@PixelPanda', mention: { user_id: '42', user_login: 'pixelpanda', user_name: 'PixelPanda' } },
      { type: 'text', text: ' yes ' },
      { type: 'emote', text: 'catJAM', emote: { id: 'emotesv2_abc', format: ['static', 'animated'] } },
    ] },
    reply: { parent_message_id: 'p1', parent_message_body: 'is the stream on?', parent_user_id: '42', parent_user_login: 'pixelpanda', parent_user_name: 'PixelPanda' },
  }), {});
  assert.equal(reply.text, 'yes catJAM');
  assert.deepEqual(reply.tokens, [{ t: 'text', v: 'yes ' }, { t: 'emote', name: 'catJAM', url: 'https://static-cdn.jtvnw.net/emoticons/v2/emotesv2_abc/animated/dark/2.0' }]);
  assert.deepEqual(reply.reply, { id: 'p1', author: 'PixelPanda', text: 'is the stream on?' });
  assert.deepEqual(reply.flags, { first: true, action: false, highlight: false, self: true });
  assert.deepEqual(reply.author.roles, ['broadcaster']);
  assert.deepEqual(reply.author.badges, [], 'badges without a known image are dropped');

  const bot = normalizeChatMessage(ctx, account(), chatEvent({ chatter_user_login: 'nightbot', badges: [{ set_id: 'moderator', id: '1' }], cheer: null,
    message_type: 'channel_points_highlighted', message: { text: '\u0001ACTION waves\u0001', fragments: [{ type: 'text', text: '\u0001ACTION waves\u0001' }] } }), ASSETS);
  assert.deepEqual(bot.author.roles, ['moderator', 'bot']);
  assert.equal(bot.text, 'waves');
  assert.equal(bot.flags.action, true);
  assert.equal(bot.flags.highlight, true);
});

test('notification → event mapping', () => {
  const ctx = fakeCtx();
  const acc = account();
  const note = (notice_type, extra = {}) => normalizeEvent(ctx, acc, 'channel.chat.notification', {
    chatter_user_id: '42', chatter_user_name: 'PixelPanda', chatter_is_anonymous: false, notice_type, message: { text: '', fragments: [] }, ...extra,
  }, { id: 'e1', ts: 5 });
  const base = { id: 'e1', platform: 'twitch', accountId: 'acc1', channel: 'streamer', ts: 5 };
  const user = { id: '42', name: 'PixelPanda' };

  assert.deepEqual(note('sub', { sub: { sub_tier: '1000', is_prime: true, duration_months: 1 } }), { ...base, type: 'sub', user, tier: '1000', label: 'Prime' });
  assert.deepEqual(note('resub', { resub: { cumulative_months: 14, sub_tier: '2000' }, message: { text: 'Toujours là', fragments: [{ type: 'text', text: 'Toujours là' }] } }),
    { ...base, type: 'resub', user, tier: '2000', months: 14, text: 'Toujours là', tokens: [{ t: 'text', v: 'Toujours là' }] });
  assert.deepEqual(note('community_sub_gift', { community_sub_gift: { id: 'g', total: 5, sub_tier: '1000' } }), { ...base, type: 'giftsub', user, count: 5, tier: '1000' });
  assert.equal(note('sub_gift', { sub_gift: { community_gift_id: 'g', sub_tier: '1000', recipient_user_name: 'Kaori' } }), null);
  assert.deepEqual(note('sub_gift', { chatter_is_anonymous: true, sub_gift: { sub_tier: '1000', recipient_user_name: 'Kaori' } }),
    { ...base, type: 'giftsub', user: null, count: 1, tier: '1000', label: 'Kaori' });
  assert.deepEqual(note('raid', { raid: { user_id: '7', user_name: 'Raider', viewer_count: 42, profile_image_url: 'https://static-cdn.jtvnw.net/r.png' } }),
    { ...base, type: 'raid', user: { id: '7', name: 'Raider', avatar: 'https://static-cdn.jtvnw.net/r.png' }, count: 42 });
  assert.deepEqual(note('announcement', { announcement: { color: 'PURPLE' }, message: { text: 'Hello', fragments: [{ type: 'text', text: 'Hello' }] } }),
    { ...base, type: 'announcement', user, label: 'PURPLE', text: 'Hello', tokens: [{ t: 'text', v: 'Hello' }] });
  assert.equal(note('shared_chat_sub', { shared_chat_sub: { sub_tier: '1000' } }), null);
  assert.equal(note('bits_badge_tier'), null);

  const ev = (type, e) => normalizeEvent(ctx, acc, type, e, { id: 'e2', ts: 6, assets: ASSETS });
  assert.deepEqual(ev('channel.follow', { user_id: '9', user_name: 'Fan' }), { ...base, id: 'e2', ts: 6, type: 'follow', user: { id: '9', name: 'Fan' } });
  const cheer = ev('channel.bits.use', { user_id: '9', user_name: 'Fan', bits: 100, type: 'cheer', message: { text: 'Cheer100 gg', fragments: [{ type: 'cheermote', text: 'Cheer100', cheermote: { prefix: 'cheer', bits: 100, tier: 100 } }, { type: 'text', text: ' gg' }] } });
  assert.equal(cheer.type, 'cheer');
  assert.equal(cheer.amount, 100);
  assert.equal(cheer.text, 'Cheer100 gg');
  assert.equal(cheer.tokens[0].t, 'cheer');
  assert.equal('label' in cheer, false);
  assert.equal(ev('channel.bits.use', { user_id: '9', user_name: 'Fan', bits: 50, type: 'power_up', power_up: { type: 'celebration' } }).label, 'celebration');
  assert.deepEqual(ev('channel.raid', { from_broadcaster_user_id: '7', from_broadcaster_user_name: 'Raider', viewers: 12 }), { ...base, id: 'e2', ts: 6, type: 'raid', user: { id: '7', name: 'Raider' }, count: 12 });
  const red = ev('channel.channel_points_custom_reward_redemption.add', { user_id: '9', user_name: 'Fan', user_input: 'eau', reward: { title: 'Hydrate-toi', cost: 300 } });
  assert.deepEqual([red.type, red.label, red.amount, red.text], ['redemption', 'Hydrate-toi', 300, 'eau']);
  assert.equal(ev('stream.online', { started_at: '2026-10-07T10:00:00Z' }).type, 'stream_online');
  assert.equal(ev('channel.update', { title: 'x' }), null);
});

test('send: reply parent, is_sent false → drop_reason', async () => {
  let sent = false;
  const m = mockFetch(() => ({ body: { data: [sent ? { message_id: 'mid', is_sent: true } : { message_id: '', is_sent: false, drop_reason: { code: 'msg_duplicate', message: 'Your message is identical to the previous one.' } }] } }));
  try {
    const ctx = fakeCtx();
    assert.deepEqual(await twitch.send(ctx, account(), { text: 'hello' }), { ok: false, error: 'Your message is identical to the previous one.' });
    assert.deepEqual(json(m.calls[0].init), { broadcaster_id: '1234', sender_id: '1234', message: 'hello' });
    sent = true;
    assert.deepEqual(await twitch.send(ctx, account(), { text: 'yo', replyTo: 'p1' }), { ok: true, id: 'mid' });
    assert.equal(json(m.calls[1].init).reply_parent_message_id, 'p1');
    assert.equal(m.calls[1].init.headers.Authorization, 'Bearer tok');
  } finally { m.restore(); }
});

test('moderate: timeout/ban body, unban/delete queries, delete needs a message id', async () => {
  const m = mockFetch(() => ({ status: 204, body: null }));
  try {
    const ctx = fakeCtx();
    await twitch.moderate(ctx, account(), { action: 'timeout', userId: '42', duration: 600, reason: 'spam' });
    assert.equal(m.calls[0].url.pathname, '/helix/moderation/bans');
    assert.equal(m.calls[0].url.searchParams.get('moderator_id'), '1234');
    assert.deepEqual(json(m.calls[0].init), { data: { user_id: '42', duration: 600, reason: 'spam' } });
    await twitch.moderate(ctx, account(), { action: 'ban', userId: '42' });
    assert.deepEqual(json(m.calls[1].init), { data: { user_id: '42' } });
    await twitch.moderate(ctx, account(), { action: 'unban', userId: '42' });
    assert.equal(m.calls[2].init.method, 'DELETE');
    assert.equal(m.calls[2].url.searchParams.get('user_id'), '42');
    await twitch.moderate(ctx, account(), { action: 'delete', messageId: 'm1' });
    assert.equal(m.calls[3].url.pathname, '/helix/moderation/chat');
    assert.equal(m.calls[3].url.searchParams.get('message_id'), 'm1');
    await assert.rejects(twitch.moderate(ctx, account(), { action: 'delete' }));
    assert.equal(m.calls.length, 4);
  } finally { m.restore(); }
});

test('chatters: pagination + moderator/vip/broadcaster/bot roles', async () => {
  const m = mockFetch(url => {
    if (url.pathname === '/helix/chat/chatters') {
      return url.searchParams.get('after')
        ? { body: { data: [{ user_id: '3', user_login: 'nightbot', user_name: 'Nightbot' }], pagination: {} } }
        : { body: { data: [{ user_id: '1234', user_login: 'streamer', user_name: 'Streamer' }, { user_id: '2', user_login: 'nox', user_name: 'Nox' }], pagination: { cursor: 'c1' } } };
    }
    if (url.pathname === '/helix/moderation/moderators') return { body: { data: [{ user_id: '2' }, { user_id: '3' }] } };
    if (url.pathname === '/helix/channels/vips') return { status: 403, body: { message: 'Missing scope: channel:read:vips' } };
  });
  try {
    const list = await twitch.chatters(fakeCtx(), account());
    assert.deepEqual(list, [
      { id: '1234', login: 'streamer', name: 'Streamer', roles: ['broadcaster'] },
      { id: '2', login: 'nox', name: 'Nox', roles: ['moderator'] },
      { id: '3', login: 'nightbot', name: 'Nightbot', roles: ['moderator', 'bot'] },
    ]);
    const first = m.calls.find(c => c.url.pathname === '/helix/chat/chatters');
    assert.equal(first.url.searchParams.get('moderator_id'), '1234');
    assert.equal(first.url.searchParams.get('first'), '1000');
  } finally { m.restore(); }
});

test('stats: live and offline', async () => {
  let live = true;
  const m = mockFetch(url => {
    if (url.pathname === '/helix/streams') return { body: { data: live ? [{ viewer_count: 77, started_at: '2026-10-07T10:00:00Z', title: 'Live!', game_name: 'Art' }] : [] } };
    if (url.pathname === '/helix/channels') return { body: { data: [{ title: 'Off', game_name: 'Music' }] } };
  });
  try {
    assert.deepEqual(await twitch.stats(fakeCtx(), account()), { live: true, viewers: 77, startedAt: Date.parse('2026-10-07T10:00:00Z'), title: 'Live!', category: 'Art' });
    live = false;
    assert.deepEqual(await twitch.stats(fakeCtx(), account()), { live: false, viewers: 0, startedAt: null, title: 'Off', category: 'Music' });
  } finally { m.restore(); }
});

test('connect: validate, subscribe on welcome, dedupe, deletes, reconnect swap, stop', async () => {
  const sockets = [];
  const original = globalThis.WebSocket;
  globalThis.WebSocket = class {
    constructor(url) { this.url = url; this.closed = false; sockets.push(this); }
    close() { this.closed = true; }
    emit(message_type, payload = {}, extra = {}) { this.onmessage({ data: JSON.stringify({ metadata: { message_id: `${message_type}-${Math.random()}`, message_type, message_timestamp: '2026-10-07T10:00:00Z', ...extra }, payload }) }); }
  };
  const m = mockFetch(url => {
    if (url.pathname === '/oauth2/validate') return { body: { user_id: '1234', login: 'streamer', scopes: [] } };
    if (url.pathname === '/helix/eventsub/subscriptions') return { status: 202, body: { data: [{}] } };
    return { body: { data: [] } };
  });
  const ctx = fakeCtx();
  const loaded = [];
  ctx.emotes.load = (p, id) => { loaded.push([p, id]); return Promise.resolve(); };
  const handle = await twitch.connect(ctx, account());
  try {
    assert.equal(m.calls[0].url.pathname, '/oauth2/validate');
    assert.deepEqual(loaded, [['twitch', '1234']]);
    assert.equal(sockets.length, 1);
    assert.equal(sockets[0].url, 'wss://eventsub.wss.twitch.tv/ws');

    sockets[0].emit('session_welcome', { session: { id: 'S1', keepalive_timeout_seconds: 10 } });
    await new Promise(r => setTimeout(r, 20));
    const subs = m.calls.filter(c => c.url.pathname === '/helix/eventsub/subscriptions').map(c => json(c.init));
    assert.equal(subs.length, 12);
    assert.ok(subs.every(s => s.transport.method === 'websocket' && s.transport.session_id === 'S1'));
    assert.deepEqual(subs.find(s => s.type === 'channel.chat.message').condition, { broadcaster_user_id: '1234', user_id: '1234' });
    assert.deepEqual(subs.find(s => s.type === 'channel.follow'), { type: 'channel.follow', version: '2', condition: { broadcaster_user_id: '1234', moderator_user_id: '1234' }, transport: { method: 'websocket', session_id: 'S1' } });
    assert.deepEqual(subs.find(s => s.type === 'channel.raid').condition, { to_broadcaster_user_id: '1234' });

    const chat = { subscription_type: 'channel.chat.message', message_id: 'dup-1' };
    sockets[0].emit('notification', { event: chatEvent({ cheer: null }) }, chat);
    sockets[0].emit('notification', { event: chatEvent({ cheer: null }) }, chat); // redelivery
    assert.equal(ctx.published.filter(f => f.t === 'chat').length, 1);

    sockets[0].emit('notification', { event: { message_id: 'm1' } }, { subscription_type: 'channel.chat.message_delete' });
    sockets[0].emit('notification', { event: { target_user_id: '42' } }, { subscription_type: 'channel.chat.clear_user_messages' });
    sockets[0].emit('notification', { event: {} }, { subscription_type: 'channel.chat.clear' });
    assert.deepEqual(ctx.published.filter(f => f.t === 'chat:delete').map(f => f.d), [
      { accountId: 'acc1', messageId: 'm1' }, { accountId: 'acc1', userId: '42' }, { accountId: 'acc1' },
    ]);

    sockets[0].emit('notification', { event: { started_at: '2026-10-07T10:00:00Z' } }, { subscription_type: 'stream.online' });
    assert.deepEqual(ctx.stats.at(-1), { id: 'acc1', live: true, startedAt: Date.parse('2026-10-07T10:00:00Z') });
    assert.equal(ctx.published.filter(f => f.t === 'event').at(-1).d.type, 'stream_online');

    // A raid seen through both channel.raid and the chat notification is shown once.
    sockets[0].emit('notification', { event: { from_broadcaster_user_id: '7', from_broadcaster_user_name: 'Raider', viewers: 3 } }, { subscription_type: 'channel.raid' });
    sockets[0].emit('notification', { event: { notice_type: 'raid', raid: { user_id: '7', user_name: 'Raider', viewer_count: 3 } } }, { subscription_type: 'channel.chat.notification' });
    assert.equal(ctx.published.filter(f => f.t === 'event' && f.d.type === 'raid').length, 1);
    // A later raid from the same channel is a new raid.
    sockets[0].emit('notification', { event: { from_broadcaster_user_id: '7', from_broadcaster_user_name: 'Raider', viewers: 40 } },
      { subscription_type: 'channel.raid', message_timestamp: '2026-10-07T12:00:00Z' });
    assert.deepEqual(ctx.published.filter(f => f.t === 'event' && f.d.type === 'raid').map(f => f.d.count), [3, 40]);

    // session_reconnect: open the new URL as-is, swap after its welcome, no resubscription.
    sockets[0].emit('session_reconnect', { session: { id: 'S1', reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect=abc' } });
    assert.equal(sockets[1].url, 'wss://eventsub.wss.twitch.tv/ws?reconnect=abc');
    assert.equal(sockets[0].closed, false);
    sockets[1].emit('session_welcome', { session: { id: 'S2', keepalive_timeout_seconds: 10 } });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(sockets[0].closed, true);
    assert.equal(m.calls.filter(c => c.url.pathname === '/helix/eventsub/subscriptions').length, 12);
    sockets[0].onclose({ code: 1000 }); // old socket closing must not trigger a reconnect
    assert.equal(sockets.length, 2);

    sockets[1].emit('notification', { event: { user_id: '9', user_name: 'Fan' } }, { subscription_type: 'channel.follow' });
    assert.equal(ctx.published.filter(f => f.t === 'event').at(-1).d.type, 'follow');

    // Revoked authorization → needs_reconnect and everything stops.
    sockets[1].emit('revocation', { subscription: { type: 'channel.chat.message', status: 'authorization_revoked' } });
    assert.equal(ctx.statuses.at(-1).status, 'needs_reconnect');
    assert.equal(sockets[1].closed, true);
  } finally {
    handle.stop();
    m.restore();
    globalThis.WebSocket = original;
  }
});

test('connect: rejected chat subscription scope → needs_reconnect', async () => {
  const sockets = [];
  const original = globalThis.WebSocket;
  globalThis.WebSocket = class {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; }
  };
  const m = mockFetch(url => {
    if (url.pathname === '/oauth2/validate') return { body: { user_id: '1234' } };
    if (url.pathname === '/helix/eventsub/subscriptions') return { status: 403, body: { message: 'subscription missing proper authorization' } };
    return { body: { data: [] } };
  });
  const ctx = fakeCtx();
  const handle = await twitch.connect(ctx, account());
  try {
    sockets[0].onmessage({ data: JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'S1', keepalive_timeout_seconds: 10 } } }) });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(ctx.statuses.at(-1).status, 'needs_reconnect');
    assert.equal(sockets[0].closed, true);
  } finally {
    handle.stop();
    m.restore();
    globalThis.WebSocket = original;
  }
});

test('connect: unexpected close → reconnects with backoff and resubscribes', async () => {
  const sockets = [];
  const original = globalThis.WebSocket;
  globalThis.WebSocket = class {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; }
  };
  const m = mockFetch(url => url.pathname === '/oauth2/validate' ? { body: { user_id: '1234' } } : { status: 202, body: { data: [] } });
  const welcome = (sock, id) => sock.onmessage({ data: JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 10 } } }) });
  const ctx = fakeCtx();
  const handle = await twitch.connect(ctx, account());
  try {
    welcome(sockets[0], 'S1');
    await new Promise(r => setTimeout(r, 20));
    sockets[0].onclose({ code: 4005 });
    await new Promise(r => setTimeout(r, 2100)); // first retry: 1 s + jitter < 1 s
    assert.equal(sockets.length, 2);
    assert.equal(sockets[1].url, 'wss://eventsub.wss.twitch.tv/ws');
    welcome(sockets[1], 'S2');
    await new Promise(r => setTimeout(r, 20));
    const sessions = m.calls.filter(c => c.url.pathname === '/helix/eventsub/subscriptions').map(c => json(c.init).transport.session_id);
    assert.deepEqual([...new Set(sessions)], ['S1', 'S2']);
    assert.equal(sessions.length, 24);
  } finally {
    handle.stop();
    m.restore();
    globalThis.WebSocket = original;
  }
});

test('connect: transient failures — chat subscription → new session, other subscription → one retry, badges reloaded', async t => {
  const sockets = [];
  const original = globalThis.WebSocket;
  globalThis.WebSocket = class {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; }
  };
  let badgeCalls = 0, followFailed = false;
  const m = mockFetch((url, init) => {
    if (url.pathname === '/oauth2/validate') return { body: { user_id: '1234' } };
    if (url.pathname === '/helix/chat/badges') {
      return badgeCalls++ ? { body: { data: [{ set_id: 'moderator', versions: [{ id: '1', title: 'Moderator', image_url_2x: 'https://static-cdn.jtvnw.net/badges/v1/mod/2' }] }] } }
        : { status: 500, body: { message: 'Internal Server Error' } };
    }
    if (url.pathname === '/helix/eventsub/subscriptions') {
      const { type, transport } = json(init);
      if (type === 'channel.chat.message' && transport.session_id === 'S1') return { status: 503, body: { message: 'Service Unavailable' } };
      if (type === 'channel.follow' && transport.session_id === 'S2' && !followFailed) { followFailed = true; return { status: 503, body: { message: 'Service Unavailable' } }; }
      return { status: 202, body: { data: [{}] } };
    }
    return { body: { data: [] } };
  });
  const ctx = fakeCtx();
  ctx.accounts.get = () => ({ status: ctx.statuses.at(-1)?.status || 'ok' });
  const flush = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
  const welcome = (sock, id) => sock.onmessage({ data: JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 30 } } }) });
  const posts = (type, session) => m.calls.filter(c => c.url.pathname === '/helix/eventsub/subscriptions' && json(c.init).type === type && json(c.init).transport.session_id === session).length;
  const handle = await twitch.connect(ctx, account());
  await flush();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    welcome(sockets[0], 'S1');
    await flush();
    assert.deepEqual(ctx.statuses.at(-1), { id: 'acc1', status: 'error', error: 'Twitch chat unavailable: Service Unavailable' });
    assert.equal(sockets[0].closed, true, 'the session without chat is dropped');
    assert.equal(badgeCalls, 1, 'no badge reload on a failed session');
    t.mock.timers.tick(2000); // first backoff: 1 s + jitter < 1 s
    assert.equal(sockets.length, 2);

    welcome(sockets[1], 'S2');
    await flush();
    assert.equal(posts('channel.chat.message', 'S2'), 1);
    assert.equal(ctx.statuses.at(-1).status, 'ok');
    assert.equal(badgeCalls, 2, 'badges reloaded once a session works');
    assert.equal(posts('channel.follow', 'S2'), 1);
    t.mock.timers.tick(15_000);
    await flush();
    assert.equal(posts('channel.follow', 'S2'), 2, 'transient failure retried once on the same session');
    assert.equal(posts('channel.chat.message', 'S2'), 1, 'successful subscriptions are not repeated');
    assert.equal(sockets.length, 2);

    sockets[1].onmessage({ data: JSON.stringify({ metadata: { message_id: 'c1', message_type: 'notification', subscription_type: 'channel.chat.message', message_timestamp: '2026-10-07T10:00:00Z' },
      payload: { event: chatEvent({ cheer: null, badges: [{ set_id: 'moderator', id: '1' }] }) } }) });
    assert.deepEqual(ctx.published.filter(f => f.t === 'chat').at(-1).d.author.badges, [{ id: 'moderator', title: 'Moderator', url: 'https://static-cdn.jtvnw.net/badges/v1/mod/2' }]);
  } finally {
    handle.stop();
    m.restore();
    globalThis.WebSocket = original;
  }
});

test('connect: a rejected token at startup throws (manager retries / marks needs_reconnect)', async () => {
  const m = mockFetch(() => ({ status: 401, body: { status: 401, message: 'invalid access token' } }));
  try {
    await assert.rejects(twitch.connect(fakeCtx(), account()), err => err.status === 401);
  } finally { m.restore(); }
});
