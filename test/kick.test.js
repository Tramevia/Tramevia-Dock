import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { fakeCtx, account, mockFetch } from './helpers.js';
import kick, { chatMode, timeoutMinutes, fragments, infoPatch, handleWebhook, onPusher, setPublicKey } from '../src/platforms/kick.js';

const acc = (over = {}) => account({ platform: 'kick', platformUserId: '42', login: 'tramevia', displayName: 'Tramevia', ...over });
const keys = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const { publicKey, privateKey } = keys();
const frames = (ctx, t) => ctx.published.filter(f => f.t === t).map(f => f.d);

let n = 0;
function delivery(type, payload, { key = privateKey, ts = new Date().toISOString(), id = `01TEST${++n}` } = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = sign('sha256', Buffer.concat([Buffer.from(`${id}.${ts}.`), body]), key).toString('base64');
  return [{ 'kick-event-message-id': id, 'kick-event-message-timestamp': ts, 'kick-event-signature': signature, 'kick-event-type': type, 'kick-event-version': '1' }, body];
}
function webhookCtx(over = {}) {
  const ctx = fakeCtx();
  const a = acc({ options: { chatMode: 'webhook' }, ...over });
  ctx.accounts.list = () => [a];
  return { ctx, a };
}

test('authorize: PKCE S256 + state + scopes, verifier kept server-side', () => {
  const { url, pending } = kick.authorize(fakeCtx(), { state: 'st4te', redirectUri: 'http://localhost:8787/auth/kick/callback', app: { clientId: 'cid' }, pkce: { verifier: 'v'.repeat(64), challenge: 'chal' } });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://id.kick.com/oauth/authorize');
  assert.equal(u.searchParams.get('code_challenge'), 'chal');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('state'), 'st4te');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.ok(u.searchParams.get('scope').split(' ').includes('events:subscribe'));
  assert.ok(!url.includes('streamkey'));
  assert.ok(!url.includes('v'.repeat(64)));
  assert.deepEqual(pending, { verifier: 'v'.repeat(64) });
  // 127.0.0.1 workaround: a sacrificial param must come before redirect_uri
  const loop = kick.authorize(fakeCtx(), { state: 's', redirectUri: 'http://127.0.0.1:8787/auth/kick/callback', app: { clientId: 'cid' }, pkce: { verifier: 'v', challenge: 'c' } }).url;
  assert.ok(loop.indexOf('redirect=127.0.0.1') < loop.indexOf('redirect_uri='));
});

test('callback: exchanges code with code_verifier, reads user + channel', async () => {
  const m = mockFetch(url => {
    if (url.href === 'https://id.kick.com/oauth/token') return { body: { access_token: 'AT', refresh_token: 'RT', expires_in: 7200, scope: 'user:read chat:write' } };
    if (url.pathname === '/public/v1/users') return { body: { data: [{ user_id: 42, name: 'Tramevia', profile_picture: 'https://files.kick.com/a.png', email: 'x@y.z' }] } };
    if (url.pathname === '/public/v1/channels') return { body: { data: [{ broadcaster_user_id: 42, slug: 'tramevia' }] } };
    return { status: 404 };
  });
  try {
    const r = await kick.callback(fakeCtx(), { code: 'CODE', redirectUri: 'http://localhost:8787/auth/kick/callback', app: { clientId: 'cid', clientSecret: 'sec' }, pending: { verifier: 'VERIFIER' } });
    const form = new URLSearchParams(m.calls[0].body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('code_verifier'), 'VERIFIER');
    assert.equal(form.get('client_secret'), 'sec');
    assert.equal(form.get('code'), 'CODE');
    assert.equal(m.calls[1].init.headers.Authorization, 'Bearer AT');
    assert.equal(r.platformUserId, '42');
    assert.equal(r.login, 'tramevia');
    assert.equal(r.displayName, 'Tramevia');
    assert.equal(r.avatar, 'https://files.kick.com/a.png');
    assert.deepEqual(r.scopes, ['user:read', 'chat:write']);
    assert.equal(r.tokens.access, 'AT');
    assert.equal(r.tokens.refresh, 'RT');
    assert.ok(Math.abs(r.tokens.expiresAt - Date.now() - 7200_000) < 5000);
    assert.ok(!JSON.stringify(r).includes('x@y.z'));
    await assert.rejects(kick.callback(fakeCtx(), { code: 'C', redirectUri: 'x', app: {}, pending: {} }));
  } finally { m.restore(); }
});

test('refresh retries once and keeps the old refresh token if none returned; testApp uses client_credentials', async () => {
  let tries = 0;
  const m = mockFetch((url, init) => {
    const form = new URLSearchParams(init.body);
    if (form.get('grant_type') === 'client_credentials') return { body: { access_token: 'APP', expires_in: 3600 } };
    return ++tries === 1 ? { status: 500, body: { error: 'temporary' } } : { body: { access_token: 'NEW', expires_in: 60 } };
  });
  try {
    const t = await kick.refresh(fakeCtx(), acc(), { access: 'OLD', refresh: 'R1' });
    assert.equal(tries, 2);
    assert.deepEqual([t.access, t.refresh], ['NEW', 'R1']);
    assert.equal(new URLSearchParams(m.calls[1].body).get('refresh_token'), 'R1');
    assert.equal((await kick.testApp(fakeCtx(), { clientId: 'cid', clientSecret: 'sec' })).ok, true);
  } finally { m.restore(); }
});

test('capabilities follow the chat mode', () => {
  const local = fakeCtx();
  const cloud = fakeCtx({ config: { secure: true, publicUrl: 'https://dock.example.com' } });
  assert.equal(chatMode(acc(), local), 'pusher');
  assert.equal(chatMode(acc(), cloud), 'webhook');
  assert.equal(chatMode(acc({ options: { chatMode: 'evil' } }), cloud), 'webhook');
  assert.equal(chatMode(null), 'pusher');
  const p = kick.capabilities(acc(), local);
  assert.equal(p.chatRead && p.unofficial && !p.needsPublicUrl, true);
  const w = kick.capabilities(acc({ options: { chatMode: 'auto' } }), cloud);
  assert.equal(w.chatRead && !w.unofficial && w.needsPublicUrl, true);
  const off = kick.capabilities(acc({ options: { chatMode: 'off' } }), cloud);
  assert.equal(off.chatRead || off.unofficial || off.needsPublicUrl || off.events, false);
  assert.equal(off.chatSend, true);
  // docs.kick.com: 500 chars; timeout 1–10080 whole minutes
  assert.deepEqual(p.limits, { chatMaxLength: 500, timeoutMin: 60, timeoutMax: 10080 * 60 });
});

test('webhook subscriptions are deleted on revoke (webhook target only) and when a public install stops using webhooks', async () => {
  const m = mockFetch((url, init) => {
    if (url.pathname === '/public/v1/events/subscriptions' && init.method === 'GET') return { body: { data: [
      { id: 's1', event: 'chat.message.sent', broadcaster_user_id: 42 }, { id: 's2', event: 'chat.message.sent', broadcaster_user_id: 99 },
      { id: 's3', event: 'channel.followed', broadcaster_user_id: 42 }] } };
    return { status: init.method === 'DELETE' ? 204 : 200, body: init.method === 'DELETE' ? null : {} };
  });
  try {
    // Local install in Pusher mode (default): revoke must not touch the app's subscriptions (a cloud install may share it).
    await kick.revoke(fakeCtx(), acc(), { access: 'AT', refresh: 'RT' });
    assert.ok(!m.calls.some(c => c.url.pathname === '/public/v1/events/subscriptions'));
    assert.ok(m.calls.some(c => c.url.href.startsWith('https://id.kick.com/oauth/revoke')));
    m.calls.length = 0;
    await kick.revoke(fakeCtx({ config: { secure: true } }), acc(), { access: 'AT', refresh: 'RT' });
    const del = m.calls.findIndex(c => c.init.method === 'DELETE');
    assert.deepEqual(m.calls[del].url.searchParams.getAll('id'), ['s1', 's3']);
    assert.ok(m.calls.slice(del + 1).some(c => c.url.href.startsWith('https://id.kick.com/oauth/revoke')));
    // Local install: never touches subscriptions (a cloud install may share the app). Public install, mode off: deletes.
    m.calls.length = 0;
    await kick.connect(fakeCtx(), acc({ options: { chatMode: 'off' } }));
    await kick.connect(fakeCtx({ config: { secure: true } }), acc({ options: { chatMode: 'off' } }));
    await new Promise(r => setTimeout(r, 20));
    assert.deepEqual(m.calls.map(c => c.init.method), ['GET', 'DELETE']);
  } finally { m.restore(); }
  const down = mockFetch(url => (url.hostname === 'api.kick.com' ? { status: 500 } : { body: {} }));
  try {
    await kick.revoke(fakeCtx(), acc({ options: { chatMode: 'webhook' } }), { access: 'AT' }); // unsubscribe failure does not block token revocation
    assert.ok(down.calls.some(c => c.url.pathname === '/public/v1/events/subscriptions'));
    assert.ok(down.calls.some(c => c.url.pathname === '/oauth/revoke'));
  } finally { down.restore(); }
});

test('emote placeholders become emote fragments', () => {
  assert.deepEqual(fragments('hi [emote:37226:KEKW]!'), [
    { t: 'text', v: 'hi ' }, { t: 'emote', name: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' }, { t: 'text', v: '!' },
  ]);
  assert.deepEqual(fragments('<img src=x onerror=alert(1)>'), [{ t: 'text', v: '<img src=x onerror=alert(1)>' }]);
  assert.deepEqual(fragments(''), []);
});

test('webhook: valid signature → normalized chat with emotes, reply, roles', async () => {
  setPublicKey(publicKey);
  const { ctx } = webhookCtx();
  const [headers, body] = delivery('chat.message.sent', {
    message_id: 'm-1', broadcaster: { user_id: 42 }, created_at: '2025-01-14T16:08:06Z',
    replies_to: { message_id: 'm-0', content: 'parent [emote:1:Wave]', sender: { username: 'Parent' } },
    sender: { user_id: 7, username: 'Viewer', channel_slug: 'viewer', profile_picture: 'javascript:alert(1)',
      identity: { username_color: '#FF5733', badges: [{ type: 'moderator', text: 'Moderator' }, { type: 'subscriber', text: 'Subscriber', count: 3 }] } },
    content: 'Hello [emote:4148074:HYPERCLAP]',
  });
  assert.equal(await handleWebhook(ctx, headers, body), 200);
  const [msg] = frames(ctx, 'chat');
  assert.equal(msg.id, 'm-1');
  assert.equal(msg.accountId, 'acc1');
  assert.equal(msg.text, 'Hello HYPERCLAP');
  assert.deepEqual(msg.tokens[1], { t: 'emote', name: 'HYPERCLAP', url: 'https://files.kick.com/emotes/4148074/fullsize' });
  assert.deepEqual(msg.reply, { id: 'm-0', author: 'Parent', text: 'parent Wave' });
  assert.deepEqual(msg.author.roles, ['moderator', 'subscriber']);
  assert.equal(msg.author.color, '#FF5733');
  assert.equal(msg.author.avatar, '');
  assert.equal(msg.author.id, '7');
  assert.equal(msg.flags.self, false);
  assert.equal(msg.flags.first, undefined); // filled by ctx.emitChat
});

test('webhook: bad signature 403, stale dropped, duplicates dropped, other broadcasters ignored', async () => {
  setPublicKey(publicKey);
  const { ctx } = webhookCtx();
  const payload = { message_id: 'm-2', broadcaster: { user_id: 42 }, sender: { user_id: 8, username: 'x' }, content: 'yo' };
  const other = keys();
  const [forged, body] = delivery('chat.message.sent', payload, { key: other.privateKey });
  const m = mockFetch(() => ({ status: 500 })); // refetch on failure does not rescue a forged signature
  try { assert.equal(await handleWebhook(ctx, forged, body), 403); } finally { m.restore(); }
  assert.equal(await handleWebhook(ctx, { ...forged, 'kick-event-signature': '' }, body), 400);
  const [tampered] = delivery('chat.message.sent', payload);
  assert.equal(await handleWebhook(ctx, tampered, Buffer.from(JSON.stringify({ ...payload, content: 'evil' }))), 403);

  const [stale, staleBody] = delivery('chat.message.sent', payload, { ts: new Date(Date.now() - 3600_000).toISOString() });
  assert.equal(await handleWebhook(ctx, stale, staleBody), 200);
  assert.equal(frames(ctx, 'chat').length, 0);

  const ok = delivery('chat.message.sent', payload);
  assert.equal(await handleWebhook(ctx, ...ok), 200);
  assert.equal(await handleWebhook(ctx, ...ok), 200);
  assert.equal(frames(ctx, 'chat').length, 1);

  assert.equal(await handleWebhook(ctx, ...delivery('chat.message.sent', { ...payload, message_id: 'm-3', broadcaster: { user_id: 99 } })), 200);
  const pusherMode = webhookCtx({ options: { chatMode: 'pusher' } });
  assert.equal(await handleWebhook(pusherMode.ctx, ...delivery('chat.message.sent', payload)), 200);
  assert.equal(frames(ctx, 'chat').length + frames(pusherMode.ctx, 'chat').length, 1);
});

test('webhook: rotated key is refetched once from /public-key', async () => {
  const old = keys();
  setPublicKey(old.publicKey);
  const { ctx } = webhookCtx();
  const m = mockFetch(url => (url.pathname === '/public/v1/public-key' ? { body: { data: { public_key: publicKey } } } : { status: 404 }));
  try {
    assert.equal(await handleWebhook(ctx, ...delivery('channel.followed', { broadcaster: { user_id: 42 }, follower: { user_id: 5, username: 'Fan' } })), 200);
    assert.equal(m.calls.length, 1);
    assert.deepEqual(frames(ctx, 'event')[0].user, { id: '5', name: 'Fan', avatar: '' });
  } finally { m.restore(); }
});

test('webhook events: subs, anonymous gifts, kicks, redemptions, live status, bans', async () => {
  setPublicKey(publicKey);
  const { ctx } = webhookCtx();
  const b = { user_id: 42 };
  const send = (type, p) => handleWebhook(ctx, ...delivery(type, { broadcaster: b, ...p }));
  await send('channel.subscription.renewal', { subscriber: { user_id: 3, username: 'Sub' }, duration: 5, created_at: '2025-01-14T16:08:06Z' });
  await send('channel.subscription.gifts', { gifter: { is_anonymous: true, user_id: null }, giftees: [{ user_id: 1 }, { user_id: 2 }] });
  await send('kicks.gifted', { sender: { user_id: 9, username: 'Rich' }, gift: { amount: 500, name: 'Rage Quit', message: 'gg [emote:1:Wave]' } });
  const redemption = { id: 'r-1', status: 'pending', reward: { title: 'Hydrate', cost: 100 }, redeemer: { user_id: 4, username: 'Thirsty' }, user_input: 'now' };
  await send('channel.reward.redemption.updated', redemption);
  await send('channel.reward.redemption.updated', { ...redemption, status: 'accepted' });
  await send('livestream.status.updated', { is_live: true, title: 'Live!', started_at: '2025-01-01T11:00:00+11:00' });
  await send('livestream.metadata.updated', { metadata: { title: 'New title', category: { id: 1, name: 'Just Chatting' } } });
  await send('moderation.banned', { banned_user: { user_id: 13 }, metadata: { expires_at: null } });

  const events = frames(ctx, 'event');
  assert.deepEqual(events.map(e => e.type), ['resub', 'giftsub', 'kicks', 'redemption', 'stream_online']);
  assert.equal(events[0].months, 5);
  assert.deepEqual([events[1].user, events[1].count], [null, 2]);
  assert.deepEqual([events[2].amount, events[2].label, events[2].text], [500, 'Rage Quit', 'gg Wave']);
  assert.equal(events[2].tokens[1].t, 'emote');
  assert.deepEqual([events[3].id, events[3].label, events[3].amount, events[3].text], ['r-1', 'Hydrate', 100, 'now']);
  assert.deepEqual(ctx.stats.map(s => s.live ?? s.title), [true, 'New title']);
  assert.equal(ctx.stats[1].category, 'Just Chatting');
  assert.deepEqual(frames(ctx, 'chat:delete'), [{ accountId: 'acc1', userId: '13' }]);
});

test('pusher events: chat with reply + badges_v2, deletes, bans, clear, subs, kicks', () => {
  const ctx = fakeCtx();
  const a = acc();
  onPusher(ctx, a, 'App\\Events\\ChatMessageEvent', {
    id: 'p-1', chatroom_id: 9, content: 'reply [emote:37226:KEKW]', type: 'reply', created_at: '2025-01-14T16:08:06Z',
    // identity shape as observed live on 2026-10-07
    sender: { id: 42, username: 'Tramevia', slug: 'tramevia', identity: { color: '#53FC18', badges: [{ type: 'subscriber', text: 'Subscriber', count: 4, sort_order: 9 }],
      badges_v2: [
        { name: 'level', badge_type: 'global', image_url: 'https://ext.cdn.kick.com/chat/badges/35.png', metadata: { level: 35 }, selected: true, sort_order: 1 },
        { name: 'hidden', badge_type: 'global', image_url: 'https://ext.cdn.kick.com/chat/badges/h.png', selected: false },
        { name: 'evil', badge_type: 'global', image_url: 'javascript:alert(1)' },
      ] } },
    metadata: { original_sender: { id: '7', username: 'Viewer' }, original_message: { id: 'p-0', content: 'hello' } },
  });
  onPusher(ctx, a, 'App\\Events\\MessageDeletedEvent', { id: 'x', message: { id: 'p-1' } });
  onPusher(ctx, a, 'App\\Events\\UserBannedEvent', { id: 'y', user: { id: 7, username: 'Viewer' }, permanent: true });
  onPusher(ctx, a, 'App\\Events\\ChatroomClearEvent', { id: 'z' });
  onPusher(ctx, a, 'SubscriptionEvent', { chatroom_id: 9, username: 'Sub', months: 3 });
  onPusher(ctx, a, 'App\\Events\\GiftedSubscriptionsEvent', { gifted_usernames: ['a', 'b', 'c'], gifter_username: 'Santa' });
  onPusher(ctx, a, 'KicksGifted', { message: 'hi', sender: { id: 5, username: 'Rich' }, gift: { amount: 100, name: 'Hype' } });
  onPusher(ctx, a, 'App\\Events\\UnknownThing', {});

  const [msg] = frames(ctx, 'chat');
  assert.equal(msg.text, 'reply KEKW');
  assert.deepEqual(msg.reply, { id: 'p-0', author: 'Viewer', text: 'hello' });
  assert.deepEqual(msg.author.badges, [
    { id: 'subscriber', title: 'Subscriber', url: '' },
    { id: 'level', title: 'level 35', url: 'https://ext.cdn.kick.com/chat/badges/35.png' },
    { id: 'evil', title: 'evil', url: '' },
  ]);
  assert.deepEqual(msg.author.roles, ['subscriber', 'broadcaster']);
  assert.equal(msg.author.color, '#53FC18');
  assert.equal(msg.flags.self, true);
  assert.deepEqual(frames(ctx, 'chat:delete'), [{ accountId: 'acc1', messageId: 'p-1' }, { accountId: 'acc1', userId: '7' }, { accountId: 'acc1' }]);
  const events = frames(ctx, 'event');
  assert.deepEqual(events.map(e => e.type), ['resub', 'giftsub', 'kicks']);
  assert.equal(events[1].count, 3);
  assert.deepEqual(events[2].user, { id: '5', name: 'Rich' });
});

test('pusher connect: chatroom lookup cached, subscribe, pong, double-encoded data, dedupe, clean stop', async () => {
  const sockets = [];
  const Original = globalThis.WebSocket;
  globalThis.WebSocket = class {
    constructor(url) { this.url = url; this.sent = []; this.readyState = 1; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() { this.closed = true; }
    emit(event, data, channel) { this.onmessage({ data: JSON.stringify({ event, channel, data: JSON.stringify(data) }) }); }
  };
  const m = mockFetch(url => (url.href === 'https://kick.com/api/v2/channels/tramevia' ? { body: { id: 7, chatroom: { id: 9 } } } : { status: 404 }));
  const ctx = fakeCtx();
  try {
    const handle = await kick.connect(ctx, acc());
    assert.deepEqual(ctx.settings.get('kick:chatroom:tramevia'), { chatroomId: '9', channelId: '7' });
    const ws = sockets[0];
    assert.match(ws.url, /^wss:\/\/ws-us2\.pusher\.com\/app\/32cbd69e4b950bf97679\?protocol=7/);
    ws.emit('pusher:connection_established', { socket_id: '1.2', activity_timeout: 120 });
    // RewardRedeemedEvent only arrives on chatroom_{id}; StreamHostedEvent on chatrooms.{id} (v1)
    assert.deepEqual(ws.sent.map(f => f.data.channel), ['chatrooms.9.v2', 'chatroom_9', 'chatrooms.9', 'channel.7']);
    ws.onmessage({ data: JSON.stringify({ event: 'pusher:ping', data: {} }) });
    assert.equal(ws.sent.at(-1).event, 'pusher:pong');
    const chat = { id: 'dup-1', content: 'hey', created_at: new Date().toISOString(), sender: { id: 3, username: 'A', slug: 'a', identity: { badges: [] } } };
    ws.emit('App\\Events\\ChatMessageEvent', chat);
    ws.emit('App\\Events\\ChatMessageEvent', chat);
    ws.onmessage({ data: 'not json' });
    assert.equal(frames(ctx, 'chat').length, 1);
    const reward = { reward_title: 'Hydrate', user_id: 5, username: 'A', user_input: '' };
    // No id in RewardRedeemedEvent: the same viewer redeeming the same reward twice gives identical frames.
    ws.emit('RewardRedeemedEvent', reward, 'chatroom_9');
    ws.emit('RewardRedeemedEvent', reward, 'chatroom_9');
    const relayed = { ...reward, user_input: 'again' };
    ws.emit('RewardRedeemedEvent', relayed, 'chatroom_9');
    ws.emit('RewardRedeemedEvent', relayed, 'chatrooms.9.v2'); // same frame relayed on another channel → once
    const redemptions = frames(ctx, 'event').filter(e => e.type === 'redemption');
    assert.equal(redemptions.length, 3);
    assert.equal(redemptions[0].label, 'Hydrate');
    assert.deepEqual(redemptions[0].user, { id: '5', name: 'A' });
    handle.stop();
    assert.equal(ws.closed, true);
    assert.equal(ws.onclose, null);
    // Manual chatroom id wins over lookup; failed lookup gives a readable error.
    const manual = await kick.connect(ctx, acc({ login: 'other', options: { chatroomId: '123' } }));
    sockets[1].emit('pusher:connection_established', {});
    assert.deepEqual(sockets[1].sent.map(f => f.data.channel), ['chatrooms.123.v2', 'chatroom_123', 'chatrooms.123']);
    manual.stop();
    // Manual chatroom id keeps channel.{id}: from the channelId option, else from the cached lookup.
    for (const [options, channel] of [[{ chatroomId: '123', channelId: '77' }, 'channel.77'], [{ chatroomId: '123' }, 'channel.7']]) {
      const h = await kick.connect(ctx, acc({ options }));
      sockets.at(-1).emit('pusher:connection_established', {});
      assert.equal(sockets.at(-1).sent.at(-1).data.channel, channel);
      h.stop();
    }
    await assert.rejects(kick.connect(ctx, acc({ login: 'blocked' })), /chat room|salon/);
  } finally { m.restore(); globalThis.WebSocket = Original; }
});

test('webhook connect: subscribes only the missing events', async () => {
  const m = mockFetch((url, init) => {
    if (url.pathname === '/public/v1/events/subscriptions' && init.method === 'GET') return { body: { data: [{ event: 'chat.message.sent', broadcaster_user_id: 42, method: 'webhook', version: 1 }] } };
    if (url.pathname === '/public/v1/events/subscriptions') return { body: { data: JSON.parse(init.body).events.map(e => ({ name: e.name, version: 1, subscription_id: 'x' })) } };
    return { body: { data: { public_key: publicKey } } };
  });
  try {
    const handle = await kick.connect(fakeCtx(), acc({ options: { chatMode: 'webhook' } }));
    const post = m.calls.find(c => c.init.method === 'POST');
    const body = JSON.parse(post.body);
    assert.equal(body.method, 'webhook');
    assert.ok(!body.events.some(e => e.name === 'chat.message.sent'));
    assert.ok(body.events.some(e => e.name === 'kicks.gifted'));
    handle.stop();
  } finally { m.restore(); }
  const refused = mockFetch((url, init) => init.method === 'POST'
    ? { body: { data: [{ name: 'chat.message.sent', error: 'webhooks disabled' }] } } : { body: { data: [] } });
  try {
    await assert.rejects(kick.connect(fakeCtx(), acc({ options: { chatMode: 'webhook' } })), /Enable Webhooks/);
  } finally { refused.restore(); }
});

test('stats / getInfo map GET channels; setInfo sends only present keys', async () => {
  const channel = { broadcaster_user_id: 42, slug: 'tramevia', stream_title: 'Hello', active_subscribers_count: 12,
    category: { id: 15, name: 'Just Chatting', thumbnail: 'https://files.kick.com/cat.webp' },
    stream: { is_live: true, viewer_count: 321, start_time: '2025-01-01T10:00:00Z', custom_tags: ['French', 'Chill'] } };
  const m = mockFetch((url, init) => (init.method === 'PATCH' ? { status: 204, body: null } : { body: { data: [channel] } }));
  try {
    const ctx = fakeCtx();
    const s = await kick.stats(ctx, acc());
    assert.deepEqual(s, { live: true, viewers: 321, startedAt: Date.parse('2025-01-01T10:00:00Z'), title: 'Hello', category: 'Just Chatting', subscribers: 12 });
    assert.equal(m.calls[0].url.searchParams.get('broadcaster_user_id'), '42');
    assert.deepEqual(await kick.getInfo(ctx, acc()), { title: 'Hello', category: { id: '15', name: 'Just Chatting', image: 'https://files.kick.com/cat.webp' }, tags: ['French', 'Chill'] });
    await kick.setInfo(ctx, acc(), { title: '  New  ', tags: ['A', ' ', 'B'] });
    const patch = m.calls.at(-1);
    assert.equal(patch.init.method, 'PATCH');
    assert.equal(patch.url.href, 'https://api.kick.com/public/v1/channels');
    assert.deepEqual(JSON.parse(patch.body), { stream_title: 'New', custom_tags: ['A', 'B'] });
    const calls = m.calls.length;
    await kick.setInfo(ctx, acc(), {});
    assert.equal(m.calls.length, calls);
  } finally { m.restore(); }
  const ctx = fakeCtx();
  assert.deepEqual(infoPatch(ctx, { category: { id: '15', name: 'x' } }), { category_id: 15 });
  assert.throws(() => infoPatch(ctx, { category: { id: 'abc' } }), { message: 'Invalid Kick category.' });
  // ctx.t picks one language: never a combined "FR / EN" string
  assert.throws(() => infoPatch({ ...ctx, t: fr => fr }, { title: '   ' }), { message: 'Le titre ne peut pas être vide.' });
});

test('searchCategories: v2 by name, v1 fallback for short queries or empty results', async () => {
  const m = mockFetch(url => url.pathname === '/public/v2/categories'
    ? { body: { data: url.searchParams.get('name') === 'minecraft' ? [{ id: 2, name: 'Minecraft', thumbnail: 'https://files.kick.com/mc.webp' }] : [], pagination: {} } }
    : { body: { data: [{ id: 3, name: 'GTA V', thumbnail: '' }] } });
  try {
    assert.deepEqual(await kick.searchCategories(fakeCtx(), acc(), 'minecraft'), [{ id: '2', name: 'Minecraft', image: 'https://files.kick.com/mc.webp' }]);
    assert.deepEqual(await kick.searchCategories(fakeCtx(), acc(), 'gt'), [{ id: '3', name: 'GTA V', image: '' }]);
    assert.equal(m.calls.at(-1).url.searchParams.get('q'), 'gt');
    assert.equal((await kick.searchCategories(fakeCtx(), acc(), 'nothing')).length, 1);
  } finally { m.restore(); }
});

test('send and moderate: bodies, timeout seconds → minutes', async () => {
  assert.deepEqual([timeoutMinutes(1), timeoutMinutes(60), timeoutMinutes(61), timeoutMinutes(600), timeoutMinutes(1_209_600), timeoutMinutes()], [1, 1, 2, 10, 10080, 1]);
  const m = mockFetch((url, init) => (url.pathname === '/public/v1/chat' ? { body: { data: { is_sent: true, message_id: 'new-id' } } } : { status: init.method === 'DELETE' && url.pathname.startsWith('/public/v1/chat/') ? 204 : 200, body: init.method === 'DELETE' && url.pathname.startsWith('/public/v1/chat/') ? null : { data: {} } }));
  try {
    const ctx = fakeCtx();
    assert.deepEqual(await kick.send(ctx, acc(), { text: 'hi', replyTo: 'm-0' }), { ok: true, id: 'new-id' });
    assert.deepEqual(JSON.parse(m.calls[0].body), { type: 'user', broadcaster_user_id: 42, content: 'hi', reply_to_message_id: 'm-0' });
    await kick.moderate(ctx, acc(), { action: 'timeout', userId: '7', duration: 90, reason: 'r'.repeat(150) });
    assert.deepEqual(JSON.parse(m.calls[1].body), { broadcaster_user_id: 42, user_id: 7, duration: 2, reason: 'r'.repeat(100) });
    await kick.moderate(ctx, acc(), { action: 'ban', userId: '7' });
    assert.deepEqual(JSON.parse(m.calls[2].body), { broadcaster_user_id: 42, user_id: 7 });
    await kick.moderate(ctx, acc(), { action: 'unban', userId: '7' });
    assert.equal(m.calls[3].init.method, 'DELETE');
    assert.equal(m.calls[3].url.pathname, '/public/v1/moderation/bans');
    await kick.moderate(ctx, acc(), { action: 'delete', messageId: 'abc-123' });
    assert.equal(m.calls[4].url.pathname, '/public/v1/chat/abc-123');
    assert.deepEqual(frames(ctx, 'chat:delete').at(-1), { accountId: 'acc1', messageId: 'abc-123' });
    await assert.rejects(kick.moderate(ctx, acc(), { action: 'ban', userId: '../x' }));
  } finally { m.restore(); }
  const down = mockFetch(() => ({ status: 429, body: { message: 'Too Many Requests' } }));
  try {
    assert.deepEqual(await kick.send(fakeCtx(), acc(), { text: 'hi' }), { ok: false, error: 'Too Many Requests' });
  } finally { down.restore(); }
});

test('webhook route is public, raw and CSRF-exempt', () => {
  const routes = [];
  kick.routes({ post: (path, handler, opts) => routes.push({ path, opts }) }, fakeCtx());
  assert.deepEqual(routes, [{ path: '/webhooks/kick', opts: { access: 'public', raw: true, csrf: false } }]);
});
