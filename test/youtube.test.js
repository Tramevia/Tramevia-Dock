import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account as makeAccount, mockFetch } from './helpers.js';
import yt, { quotaDay, jsonArrayStream, normalizeMessage, applyInfo, testAppResult, QUOTA_LIMIT } from '../src/platforms/youtube.js';

const account = (id = 'yt1') => makeAccount({ id, platform: 'youtube', platformUserId: 'UCowner', login: 'tramevia', displayName: 'Tramevia' });
const err = (status, reason, message = reason) => ({ status, body: { error: { code: status, message, errors: [{ reason }] } } });
const until = async (fn, ms = 2000) => { for (const end = performance.now() + ms; performance.now() < end; await new Promise(r => setTimeout(r, 10))) if (fn()) return; assert.fail('timeout'); };
/** Date.now() skew: clock.add(ms) jumps the adapter's clock forward without waiting. Always restore(). */
function clock() {
  const real = Date.now;
  let skew = 0;
  Date.now = () => real() + skew;
  return { add: ms => { skew += ms; }, restore: () => { Date.now = real; } };
}
const page = items => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('[' + items.map(i => JSON.stringify(i)).join(','))); } }), { headers: { 'content-type': 'application/json' } });

/** Mocked YouTube API: one live broadcast `vid1` with chat `chat1`, plus overrides by pathname. */
function youtubeApi(over = {}) {
  return mockFetch((url, init) => {
    const key = `${init.method || 'GET'} ${url.pathname}`;
    if (over[key]) return over[key](url, init);
    if (key === 'GET /youtube/v3/liveBroadcasts') return { body: { items: url.searchParams.get('broadcastStatus') === 'active' ? [{ id: 'vid1', snippet: { liveChatId: 'chat1' } }] : [] } };
    if (key === 'GET /youtube/v3/videos' && url.searchParams.get('part') === 'snippet') {
      return { body: { items: [{ id: 'vid1', snippet: { title: 'Old', description: 'Desc', tags: ['a', 'b c'], categoryId: '20', defaultLanguage: 'fr', channelId: 'UCowner', thumbnails: {} } }] } };
    }
    if (key === 'GET /youtube/v3/videos') return { body: { items: [{ id: 'vid1', snippet: { title: 'Live!', categoryId: '20' }, liveStreamingDetails: { activeLiveChatId: 'chat1', concurrentViewers: '42', actualStartTime: '2026-10-07T18:00:00Z' } }] } };
    if (key === 'GET /youtube/v3/videoCategories') {
      const fr = url.searchParams.get('hl') === 'fr';
      assert.equal(url.searchParams.get('regionCode'), fr ? 'FR' : 'US');
      return { body: { items: [{ id: '20', snippet: { title: fr ? 'Jeux vidéo' : 'Gaming', assignable: true } }, { id: '18', snippet: { title: 'Short Movies', assignable: false } }] } };
    }
    return { status: 404, body: { error: { code: 404, message: `unmocked ${key}` } } };
  });
}

test('quota day follows America/Los_Angeles (DST and standard time)', () => {
  assert.equal(quotaDay(Date.parse('2026-10-07T06:59:59Z')), '2026-10-06'); // PDT, UTC-7
  assert.equal(quotaDay(Date.parse('2026-10-07T07:00:00Z')), '2026-10-07');
  assert.equal(quotaDay(Date.parse('2026-12-01T07:59:59Z')), '2026-11-30'); // PST, UTC-8
  assert.equal(quotaDay(Date.parse('2026-12-01T08:00:00Z')), '2026-12-01');
});

test('quota meter: counts calls, resets on a new Pacific day, refuses writes near the cap', async () => {
  const ctx = fakeCtx();
  const mock = youtubeApi();
  try {
    ctx.settings.set('youtube:quota', { day: '2000-01-01', used: 9999 }); // yesterday's usage is ignored
    const s = await yt.stats(ctx, account('q1'));
    assert.equal(s.live, true);
    assert.equal(s.viewers, 42);
    assert.equal(s.category, 'Gaming');
    assert.deepEqual(s.quota, { used: 3, limit: QUOTA_LIMIT }); // liveBroadcasts + videos + videoCategories
    assert.deepEqual(ctx.settings.get('youtube:quota'), { day: quotaDay(), used: 3 });

    ctx.settings.set('youtube:quota', { day: quotaDay(), used: 9451 }); // 9451 + 50 > 95 % of 10 000
    const before = mock.calls.length;
    const sent = await yt.send(ctx, account('q1'), { text: 'hello' });
    assert.equal(sent.ok, false);
    assert.match(sent.error, /quota/i);
    await assert.rejects(yt.moderate(ctx, account('q1'), { action: 'delete', messageId: 'm1' }), /quota/i);
    await assert.rejects(yt.setInfo(ctx, account('q1'), { title: 'x' }), /quota/i);
    assert.equal(mock.calls.length, before, 'nothing sent to YouTube');

    ctx.settings.set('youtube:quota', { day: quotaDay(), used: 9450 }); // exactly at the guard: allowed
    let body;
    const mock2 = youtubeApi({ 'POST /youtube/v3/liveChat/messages': (url, init) => { body = JSON.parse(init.body); return { body: { id: 'sent1' } }; } });
    try {
      assert.deepEqual(await yt.send(ctx, account('q1'), { text: '  hello  ' }), { ok: true, id: 'sent1' });
    } finally { mock2.restore(); }
    assert.deepEqual(body, { snippet: { liveChatId: 'chat1', type: 'textMessageEvent', textMessageDetails: { messageText: 'hello' } } });
    assert.equal(ctx.settings.get('youtube:quota').used, 9500);
    assert.match((await yt.send(ctx, account('q1'), { text: 'x'.repeat(201) })).error, /200/);
    assert.equal((await yt.send({ ...ctx, t: fr => fr }, account('q1'), { text: ' ' })).error, 'Message vide.', 'dashboard language');
  } finally { mock.restore(); }
});

test('Google quotaExceeded fills the local meter, so writes are refused before reaching Google', async () => {
  const ctx = fakeCtx();
  const mock = youtubeApi({ 'GET /youtube/v3/liveBroadcasts': () => err(403, 'quotaExceeded', 'You have exceeded your <a href="/q">quota</a>.') });
  try {
    ctx.settings.set('youtube:quota', { day: quotaDay(), used: 4000 }); // local meter far below the real usage
    await assert.rejects(yt.stats(ctx, account('x1')), /YouTube API daily quota exhausted: it resets/);
    assert.equal(ctx.settings.get('youtube:quota').used, QUOTA_LIMIT);
    const before = mock.calls.length;
    assert.match((await yt.send(ctx, account('x1'), { text: 'hi' })).error, /10000\/10000/);
    assert.equal(mock.calls.length, before);
  } finally { mock.restore(); }
});

test('stream parser handles any chunk split, strings with braces, escapes and a bare error object', () => {
  const items = [
    { items: [{ id: 'a', snippet: { displayMessage: 'brace } { and "quotes" \\ back' } }], nextPageToken: 'p1' },
    { items: [], nextPageToken: 'p2', offlineAt: null, nested: [{ x: [1, { y: '}]' }] }] },
    { items: [{ id: 'b', snippet: { displayMessage: 'émoji 🎉 é' } }] },
  ];
  const text = '[' + items.map(i => JSON.stringify(i, null, 1)).join(',\r\n') + ']';
  const run = chunks => { const out = []; const feed = jsonArrayStream(o => out.push(o)); chunks.forEach(feed); return out; };
  for (let i = 0; i <= text.length; i++) assert.deepEqual(run([text.slice(0, i), text.slice(i)]), items, `split at ${i}`);
  for (let n = 0; n < 50; n++) {
    const chunks = [];
    for (let i = 0; i < text.length;) { const len = 1 + Math.floor(Math.random() * 7); chunks.push(text.slice(i, i + len)); i += len; }
    assert.deepEqual(run(chunks), items);
  }
  assert.deepEqual(run(['{"error":{"code":403,', '"message":"x"}}']), [{ error: { code: 403, message: 'x' } }]);
});

test('message normalization: text, superchat, membership, gifting, deletions', () => {
  const acc = account();
  const author = { channelId: 'UCviewer', displayName: '@Viewer', profileImageUrl: 'https://yt3.ggpht.com/a.jpg', isChatModerator: true, isChatSponsor: true, isVerified: false, isChatOwner: false };
  const msg = (type, details) => ({ id: `id-${type}`, snippet: { type, publishedAt: '2026-10-07T20:00:00Z', authorChannelId: 'UCviewer', ...details }, authorDetails: author });

  const { chat } = normalizeMessage(msg('textMessageEvent', { displayMessage: 'Salut', textMessageDetails: { messageText: 'Salut :yt:' } }), acc);
  assert.equal(chat.id, 'id-textMessageEvent');
  assert.equal(chat.text, 'Salut :yt:');
  assert.deepEqual(chat.tokens, [{ t: 'text', v: 'Salut :yt:' }]);
  assert.deepEqual(chat.author, { id: 'UCviewer', login: 'Viewer', name: '@Viewer', color: '', avatar: 'https://yt3.ggpht.com/a.jpg', badges: [], roles: ['moderator', 'member'] });
  assert.equal(chat.ts, Date.parse('2026-10-07T20:00:00Z'));
  assert.equal(chat.flags.self, false);
  assert.equal(chat.flags.first, undefined, 'left to emitChat');
  const own = normalizeMessage({ ...msg('textMessageEvent', { textMessageDetails: { messageText: 'yo' } }), authorDetails: { channelId: 'UCowner', displayName: 'Tramevia', isChatOwner: true, profileImageUrl: 'javascript:alert(1)' } }, acc).chat;
  assert.equal(own.flags.self, true);
  assert.deepEqual(own.author.roles, ['broadcaster']);
  assert.equal(own.author.avatar, '', 'non-https avatar dropped');

  const sc = normalizeMessage(msg('superChatEvent', { superChatDetails: { amountMicros: '5000000', currency: 'EUR', amountDisplayString: '5,00 €', userComment: 'Merci !', tier: 2 } }), acc).event;
  assert.equal(sc.type, 'superchat');
  assert.equal(sc.amount, 5);
  assert.equal(sc.currency, 'EUR');
  assert.equal(sc.text, 'Merci !');
  assert.deepEqual(sc.tokens, [{ t: 'text', v: 'Merci !' }]);
  assert.deepEqual(sc.user, { id: 'UCviewer', name: '@Viewer', avatar: 'https://yt3.ggpht.com/a.jpg' });
  assert.equal(sc.accountId, 'yt1');

  const st = normalizeMessage(msg('superStickerEvent', { superStickerDetails: { amountMicros: 2000000, currency: 'USD', superStickerMetadata: { altText: 'Happy cat' } } }), acc).event;
  assert.deepEqual([st.type, st.amount, st.currency, st.label, st.text], ['supersticker', 2, 'USD', 'Happy cat', undefined]);

  assert.deepEqual(normalizeMessage(msg('newSponsorEvent', { newSponsorDetails: { memberLevelName: 'Fan' } }), acc).event.label, 'Fan');
  const ms = normalizeMessage(msg('memberMilestoneChatEvent', { memberMilestoneChatDetails: { memberMonth: 14, memberLevelName: 'Fan', userComment: 'Toujours là' } }), acc).event;
  assert.deepEqual([ms.type, ms.months, ms.text], ['membership', 14, 'Toujours là']);

  const gift = normalizeMessage(msg('membershipGiftingEvent', { membershipGiftingDetails: { giftMembershipsCount: 5, giftMembershipsLevelName: 'Fan' } }), acc).event;
  assert.deepEqual([gift.type, gift.count, gift.label], ['giftmembership', 5, 'Fan']);
  const jewels = normalizeMessage(msg('giftEvent', { giftEventDetails: { giftMetadata: { giftName: 'Rose', jewelsAmount: 10, comboCount: 3, giftUrl: 'https://yt3.ggpht.com/rose.webp' } } }), acc).event;
  assert.deepEqual([jewels.id, jewels.type, jewels.label, jewels.count, jewels.amount, jewels.unit, jewels.currency, jewels.image], ['id-giftEvent', 'gift', 'Rose', 3, 30, 'jewels', undefined, 'https://yt3.ggpht.com/rose.webp']);
  const single = normalizeMessage(msg('giftEvent', { giftEventDetails: { giftMetadata: { altText: 'A rose', jewelsAmount: 10, comboCount: 0, giftUrl: 'http://x/y' } } }), acc).event;
  assert.deepEqual([single.label, single.count, single.amount, 'image' in single], ['A rose', 1, 10, false]);

  assert.deepEqual(normalizeMessage(msg('messageDeletedEvent', { messageDeletedDetails: { deletedMessageId: 'm9' } }), acc), { delete: { accountId: 'yt1', messageId: 'm9' } });
  assert.deepEqual(normalizeMessage(msg('userBannedEvent', { userBannedDetails: { banType: 'temporary', banDurationSeconds: '300', bannedUserDetails: { channelId: 'UCbad' } } }), acc), { delete: { accountId: 'yt1', userId: 'UCbad' } });
  for (const type of ['pollEvent', 'tombstone', 'giftMembershipReceivedEvent', 'sponsorOnlyModeStartedEvent', 'chatEndedEvent']) assert.equal(normalizeMessage(msg(type, {}), acc), null, type);
});

test('setInfo: read-modify-write keeps untouched snippet fields and only sends mutable ones', async () => {
  const ctx = fakeCtx();
  let put;
  const mock = youtubeApi({ 'PUT /youtube/v3/videos': (url, init) => { put = { part: url.searchParams.get('part'), body: JSON.parse(init.body) }; return { body: {} }; } });
  try {
    await yt.setInfo(ctx, account('s1'), { title: '  Nouveau titre  ', tags: ['fr', 'gaming'] });
    assert.deepEqual(put, { part: 'snippet', body: { id: 'vid1', snippet: { title: 'Nouveau titre', description: 'Desc', tags: ['fr', 'gaming'], categoryId: '20', defaultLanguage: 'fr' } } });
    await yt.setInfo(ctx, account('s1'), { ytCategoryId: '24', description: '' });
    assert.deepEqual(put.body.snippet, { title: 'Old', tags: ['a', 'b c'], categoryId: '24', defaultLanguage: 'fr' });
    assert.ok(ctx.settings.get('youtube:quota').used >= 100, 'both updates counted at 50 units');

    const info = await yt.getInfo(ctx, account('s1'));
    assert.deepEqual(info, { title: 'Old', description: 'Desc', tags: ['a', 'b c'], ytCategoryId: '20', category: null });
    assert.deepEqual(await yt.infoOptions(ctx, account('s1')), { ytCategories: [{ id: '20', title: 'Gaming' }] });
    assert.deepEqual(await yt.infoOptions({ ...ctx, t: fr => fr }, account('s1')), { ytCategories: [{ id: '20', title: 'Jeux vidéo' }] }, 'cached per language');
    const n = mock.calls.length;
    await yt.infoOptions(ctx, account('s1'));
    assert.equal(mock.calls.length, n, 'English list still cached');
    await assert.rejects(yt.setInfo({ ...ctx, t: fr => fr }, account('s1'), { title: '<b>' }), /Titre/);
    await assert.rejects(yt.searchCategories(ctx, account('s1'), 'mine'), /category/);
  } finally { mock.restore(); }

  const base = { title: 'T', categoryId: '20' };
  assert.throws(() => applyInfo(base, { title: 'a <b>' }), /Title/);
  assert.throws(() => applyInfo(base, { title: 'x'.repeat(101) }), /Title/);
  assert.throws(() => applyInfo(base, { tags: Array(60).fill('tag tag') }), /Tags/);
  assert.throws(() => applyInfo({ title: 'T' }, {}), /category/);
  assert.deepEqual(applyInfo(base, { tags: Array(50).fill('abcdefghi') }).tags.length, 50); // 50×9 + 49 commas = 499
});

test('getInfo: falls back to the upcoming broadcast, readable error when none', async () => {
  const ctx = fakeCtx();
  const upcoming = [
    { id: 'old', snippet: { scheduledStartTime: '2024-01-01T00:00:00Z' } },
    { id: 'next', snippet: { scheduledStartTime: new Date(Date.now() + 3600_000).toISOString() } },
  ];
  let videoId;
  const mock = youtubeApi({
    'GET /youtube/v3/liveBroadcasts': url => ({ body: { items: url.searchParams.get('broadcastStatus') === 'upcoming' ? upcoming : [] } }),
    'GET /youtube/v3/videos': url => { videoId = url.searchParams.get('id'); return { body: { items: [{ id: videoId, snippet: { title: 'Prévu', categoryId: '20' } }] } }; },
  });
  try {
    assert.equal((await yt.getInfo(ctx, account('u1'))).title, 'Prévu');
    assert.equal(videoId, 'next');
    const s = await yt.stats(ctx, account('u2'));
    assert.deepEqual([s.live, s.viewers, s.startedAt], [false, 0, null]);
    assert.ok(mock.calls.every(c => !c.url.searchParams.has('mine') || !c.url.searchParams.has('broadcastStatus')), 'mine and broadcastStatus never combined');
  } finally { mock.restore(); }
  const none = mockFetch(() => ({ body: { items: [] } }));
  try {
    await assert.rejects(yt.getInfo(ctx, account('u3')), /schedule one in YouTube Studio/);
  } finally { none.restore(); }
});

test('testApp maps Google token errors', async () => {
  assert.deepEqual(testAppResult('invalid_grant').ok, true);
  assert.match(testAppResult('deleted_client', '', fr => fr).message, /30 jours/);
  for (const [code, re] of [['invalid_client', /Client ID or Client Secret/], ['deleted_client', /deleted.*30 days/], ['unauthorized_client', /Web application/], ['redirect_uri_mismatch', /http:\/\/localhost:8787\/auth\/youtube\/callback/]]) {
    const ctx = fakeCtx();
    let form;
    const mock = mockFetch((url, init) => { form = new URLSearchParams(init.body); return { status: code === 'invalid_client' ? 401 : 400, body: { error: code, error_description: 'x' } }; });
    try {
      await assert.rejects(yt.testApp(ctx, { clientId: 'id.apps.googleusercontent.com', clientSecret: 'sec' }), re);
    } finally { mock.restore(); }
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('redirect_uri'), 'http://localhost:8787/auth/youtube/callback');
  }
  const mock = mockFetch(() => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Malformed auth code.' } }));
  try {
    const r = await yt.testApp(fakeCtx(), { clientId: 'id', clientSecret: 'sec' });
    assert.equal(r.ok, true);
  } finally { mock.restore(); }
});

test('OAuth: authorize URL, callback profile, refresh keeps the old refresh token', async () => {
  const ctx = fakeCtx();
  const { url, pending } = yt.authorize(ctx, { state: 'st', redirectUri: 'http://localhost:8787/auth/youtube/callback', app: { clientId: 'cid' }, pkce: { verifier: 'ver', challenge: 'chal' } });
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  for (const [k, v] of Object.entries({ client_id: 'cid', scope: 'https://www.googleapis.com/auth/youtube', access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state: 'st', code_challenge: 'chal', code_challenge_method: 'S256', response_type: 'code' })) assert.equal(u.searchParams.get(k), v, k);
  assert.deepEqual(pending, { verifier: 'ver' });

  const forms = [];
  const mock = mockFetch((url, init) => {
    if (url.hostname === 'oauth2.googleapis.com') {
      forms.push(new URLSearchParams(init.body));
      return { body: { access_token: 'at', expires_in: 3599, scope: 'https://www.googleapis.com/auth/youtube', ...(forms.length === 1 && { refresh_token: 'rt' }) } };
    }
    assert.equal(init.headers.Authorization, 'Bearer at');
    return { body: { items: [{ id: 'UCme', snippet: { title: 'Tramevia', customUrl: '@tramevia', thumbnails: { default: { url: 'https://yt3.ggpht.com/me.jpg' } } } }] } };
  });
  try {
    const r = await yt.callback(ctx, { code: 'c0de', redirectUri: 'http://localhost:8787/auth/youtube/callback', app: { clientId: 'cid', clientSecret: 'sec' }, pending });
    assert.deepEqual([r.platformUserId, r.login, r.displayName, r.avatar, r.tokens.access, r.tokens.refresh], ['UCme', 'tramevia', 'Tramevia', 'https://yt3.ggpht.com/me.jpg', 'at', 'rt']);
    assert.ok(r.tokens.expiresAt > Date.now() + 3500_000);
    assert.equal(forms[0].get('code_verifier'), 'ver');
    const next = await yt.refresh(ctx, account(), { access: 'old', refresh: 'rt', expiresAt: 0 });
    assert.deepEqual([next.access, next.refresh], ['at', 'rt']);
    assert.equal(forms[1].get('grant_type'), 'refresh_token');
  } finally { mock.restore(); }
});

test('moderation: delete, timeout, ban stores the id, unban uses it', async () => {
  const ctx = fakeCtx();
  const seen = [];
  const mock = youtubeApi({
    'DELETE /youtube/v3/liveChat/messages': url => { seen.push(['delmsg', url.searchParams.get('id')]); return { status: 204, body: null }; },
    'POST /youtube/v3/liveChat/bans': (url, init) => { const b = JSON.parse(init.body).snippet; seen.push(['ban', b.type, b.banDurationSeconds, b.bannedUserDetails.channelId, b.liveChatId]); return { body: { id: `ban-${b.type}` } }; },
    'DELETE /youtube/v3/liveChat/bans': url => { seen.push(['unban', url.searchParams.get('id')]); return { status: 204, body: null }; },
  });
  try {
    const acc = account('m1');
    await yt.moderate(ctx, acc, { action: 'delete', messageId: 'msg1' });
    await yt.moderate(ctx, acc, { action: 'timeout', userId: 'UCbad', duration: 600 });
    await yt.moderate(ctx, acc, { action: 'ban', userId: 'UCbad' });
    assert.equal(ctx.settings.get('youtube:ban:m1:UCbad'), 'ban-permanent');
    await yt.moderate(ctx, acc, { action: 'unban', userId: 'UCbad' });
    assert.equal(ctx.settings.get('youtube:ban:m1:UCbad'), null);
    await assert.rejects(yt.moderate(ctx, acc, { action: 'unban', userId: 'UCother' }), /YouTube Studio/);
    await assert.rejects(yt.moderate(ctx, acc, { action: 'timeout', userId: 'bad id/../' }), /invalid/i);
    assert.deepEqual(seen, [['delmsg', 'msg1'], ['ban', 'temporary', 600, 'UCbad', 'chat1'], ['ban', 'permanent', undefined, 'UCbad', 'chat1'], ['unban', 'ban-permanent']]);
    assert.deepEqual(ctx.published.filter(f => f.t === 'chat:delete').map(f => f.d), [{ accountId: 'm1', messageId: 'msg1' }, { accountId: 'm1', userId: 'UCbad' }, { accountId: 'm1', userId: 'UCbad' }]);
    assert.deepEqual(yt.capabilities.limits, { chatMaxLength: 200, timeoutMin: 1, timeoutMax: 86400 });
    await yt.moderate(ctx, acc, { action: 'timeout', userId: 'UCbad', duration: 7 * 86400 });
    assert.deepEqual(seen.at(-1).slice(0, 3), ['ban', 'temporary', 86400], 'clamped to limits.timeoutMax');
  } finally { mock.restore(); }
});

test('connect: streams chat (byte chunks split mid-character), skips history events, stops on chat end', async () => {
  const ctx = fakeCtx();
  const acc = account('c1');
  const old = new Date(Date.now() - 3600_000).toISOString();
  const now = new Date().toISOString();
  const author = { channelId: 'UCv', displayName: '@V' };
  const pages = [
    { nextPageToken: 'p1', items: [
      { id: 'h1', snippet: { type: 'textMessageEvent', publishedAt: old, textMessageDetails: { messageText: 'history 🎉' } }, authorDetails: author },
      { id: 'h2', snippet: { type: 'superChatEvent', publishedAt: old, superChatDetails: { amountMicros: '1000000', currency: 'EUR' } }, authorDetails: author },
    ] },
    { nextPageToken: 'p2', items: [
      { id: 'n1', snippet: { type: 'superChatEvent', publishedAt: now, superChatDetails: { amountMicros: '2000000', currency: 'EUR', userComment: 'gg' } }, authorDetails: author },
      { id: 'n2', snippet: { type: 'chatEndedEvent', publishedAt: now } },
    ] },
  ];
  const bytes = new TextEncoder().encode('[' + pages.map(p => JSON.stringify(p)).join(',\n'));
  let streamUrl;
  const mock = youtubeApi({
    'GET /youtube/v3/liveChat/messages/stream': (url, init) => {
      streamUrl = url;
      assert.equal(init.headers.Authorization, 'Bearer tok');
      const body = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); } }); // left open, like a live stream
      return new Response(body, { headers: { 'content-type': 'application/json' } });
    },
  });
  const handle = await yt.connect(ctx, acc);
  try {
    await until(() => ctx.published.some(f => f.t === 'event'));
    assert.equal(streamUrl.searchParams.get('liveChatId'), 'chat1');
    assert.equal(streamUrl.searchParams.get('part'), 'id,snippet,authorDetails');
    const chats = ctx.published.filter(f => f.t === 'chat').map(f => f.d);
    const events = ctx.published.filter(f => f.t === 'event').map(f => f.d);
    assert.deepEqual(chats.map(m => m.text), ['history 🎉']);
    assert.deepEqual(events.map(e => [e.id, e.amount, e.text]), [['n1', 2, 'gg']]);
  } finally {
    handle.stop();
    mock.restore();
  }
});

test('connect: falls back to list polling when streaming keeps failing', async () => {
  const ctx = fakeCtx();
  let streams = 0;
  let polls = 0;
  const mock = youtubeApi({
    'GET /youtube/v3/liveChat/messages/stream': () => { streams++; return err(403, 'forbidden', 'stream not allowed'); },
    'GET /youtube/v3/liveChat/messages': () => {
      polls++;
      return { body: { pollingIntervalMillis: 1000, nextPageToken: 'x', items: [{ id: `p${polls}`, snippet: { type: 'textMessageEvent', publishedAt: new Date().toISOString(), textMessageDetails: { messageText: 'polled' } }, authorDetails: { channelId: 'UCv', displayName: 'V' } }] } };
    },
  });
  const handle = await yt.connect(ctx, account('c2'));
  try {
    await until(() => ctx.published.some(f => f.t === 'chat'), 5000);
    assert.equal(streams, 1);
    assert.equal(polls, 1);
    assert.equal(ctx.published.find(f => f.t === 'chat').d.text, 'polled');
  } finally {
    handle.stop();
    mock.restore();
  }
});

test('connect: a stream that drops after running a while reconnects at once instead of falling back to polling', async () => {
  const ctx = fakeCtx();
  const c = clock();
  let streams = 0;
  let polls = 0;
  const mock = youtubeApi({
    'GET /youtube/v3/liveChat/messages/stream': () => {
      const n = ++streams;
      const body = new ReadableStream({ start(ctl) {
        ctl.enqueue(new TextEncoder().encode('[' + JSON.stringify({ nextPageToken: `p${n}`, items: [{ id: `s${n}`, snippet: { type: 'textMessageEvent', publishedAt: new Date(Date.now()).toISOString(), textMessageDetails: { messageText: `hi ${n}` } }, authorDetails: { channelId: 'UCv', displayName: 'V' } }] })));
        setTimeout(() => { c.add(11_000); ctl.error(new Error('read ECONNRESET')); }, 20); // "11 s" of healthy streaming, then a reset
      } });
      return new Response(body, { headers: { 'content-type': 'application/json' } });
    },
    'GET /youtube/v3/liveChat/messages': () => { polls++; return { body: { items: [] } }; },
  });
  const handle = await yt.connect(ctx, account('r1'));
  try {
    await until(() => streams >= 4);
    assert.equal(polls, 0);
    assert.ok(!ctx.statuses.some(s => s.status === 'error'), 'healthy streams do not flag the account');
    assert.equal(mock.calls.find(x => x.url.pathname.endsWith('/stream') && x.url.searchParams.get('pageToken') === 'p3') !== undefined, true, 'resumes from the last page');
    assert.deepEqual(ctx.published.filter(f => f.t === 'chat').slice(0, 3).map(f => f.d.text), ['hi 1', 'hi 2', 'hi 3']);
  } finally {
    handle.stop();
    mock.restore();
    c.restore();
  }
});

test('connect: a slow stream failure that delivered nothing backs off instead of retrying at once', async () => {
  const c = clock();
  try {
    // 'throw': a blackholed route fails after undici's 10 s connect timeout; 'empty': a 200 that closes after 11 s with no data.
    for (const mode of ['throw', 'empty']) {
      const ctx = fakeCtx();
      let streams = 0;
      const mock = youtubeApi({
        'GET /youtube/v3/liveChat/messages/stream': async () => {
          streams++;
          c.add(10_050);
          await new Promise(r => setTimeout(r, 5)); // yield, so a regression to a tight retry loop fails instead of hanging
          if (mode === 'throw') throw new TypeError('fetch failed');
          return new Response('[', { headers: { 'content-type': 'application/json' } });
        },
      });
      const handle = await yt.connect(ctx, account(`slow-${mode}`));
      try {
        await until(() => streams >= 1);
        await new Promise(r => setTimeout(r, 800)); // the old duration-only check retried ~60 times in this window
        assert.equal(streams, 1, `${mode}: backs off (>= 2 s) after an attempt that delivered nothing`);
      } finally {
        handle.stop();
        mock.restore();
      }
    }
  } finally {
    c.restore();
  }
});

test('connect: a paid event posted between two chat sessions is emitted exactly once', async () => {
  const ctx = fakeCtx();
  const c = clock();
  const acc = account('h1');
  const t0 = Date.now();
  const sc = (id, ts) => ({ id, snippet: { type: 'superChatEvent', publishedAt: new Date(ts).toISOString(), superChatDetails: { amountMicros: '50000000', currency: 'EUR' } }, authorDetails: { channelId: 'UCv', displayName: 'V' } });
  const replay = { nextPageToken: 'p', items: [sc('before-start', t0 - 3600_000), sc('gap', t0 + 15_000)] };
  let streams = 0;
  const mock = youtubeApi({
    'GET /youtube/v3/liveChat/messages/stream': () => (++streams === 1 ? err(404, 'liveChatNotFound') : page([replay, replay])),
  });
  try {
    let handle = await yt.connect(ctx, acc); // session 1 ends at once (liveChatNotFound)
    await until(() => streams === 1);
    handle.stop();
    c.add(60_000); // session 2 a minute later: the 50 € Super Chat (t0 + 15 s) is 45 s old and was never emitted
    handle = await yt.connect(ctx, acc);
    try {
      await until(() => ctx.published.some(f => f.t === 'event'));
      await new Promise(r => setTimeout(r, 50));
      assert.deepEqual(ctx.published.filter(f => f.t === 'event').map(f => [f.d.id, f.d.amount]), [['gap', 50]]);
    } finally { handle.stop(); }
  } finally {
    mock.restore();
    c.restore();
  }
});

test('live-state cadence: 5 min when idle, 45 s when awake or another account is live, videos.list alone while live', async () => {
  const ctx = fakeCtx();
  const c = clock();
  let live = false;
  let ended = false;
  const mock = youtubeApi({
    'GET /youtube/v3/liveBroadcasts': () => ({ body: { items: live ? [{ id: 'vid1', snippet: { liveChatId: 'chat1' } }] : [] } }),
    'GET /youtube/v3/videos': () => ({ body: { items: [{ id: 'vid1', snippet: { title: 'Live!', categoryId: '20', liveBroadcastContent: ended ? 'none' : 'live' }, liveStreamingDetails: { activeLiveChatId: 'chat1', concurrentViewers: '7', ...(ended && { actualEndTime: '2026-10-07T22:00:00Z' }) } }] } }),
  });
  const calls = () => mock.calls.map(x => x.url.pathname.split('/').pop()).filter(p => p !== 'videoCategories');
  const acc = account('t1');
  const stats = async ms => { c.add(ms); return yt.stats(ctx, acc); };
  try {
    await stats(0);
    await stats(60_000);
    assert.deepEqual(calls(), ['liveBroadcasts'], 'idle: 1 min old state reused');
    await stats(241_000);
    assert.deepEqual(calls(), ['liveBroadcasts', 'liveBroadcasts'], 'idle: refreshed after 5 min');

    ctx.accounts.list = () => [acc, account('tw')];
    ctx.accounts.stats = id => (id === 'tw' ? { live: true } : null);
    live = true;
    const s = await stats(46_000);
    assert.deepEqual([s.live, s.viewers, s.title], [true, 7, 'Live!']);
    assert.deepEqual(calls().slice(2), ['liveBroadcasts', 'videos'], 'another account live: 45 s');

    ctx.accounts.list = () => [];
    await stats(46_000);
    assert.deepEqual(calls().slice(4), ['videos'], 'live: videos.list only');
    ended = true;
    live = false;
    assert.equal((await stats(46_000)).live, false, 'actualEndTime = offline');
    await stats(46_000);
    assert.deepEqual(calls().slice(5), ['videos', 'liveBroadcasts'], 'awake for 2 h after the last live');
    await stats(2 * 3600_000);
    await stats(46_000);
    assert.equal(calls().length, 8, 'idle again after 2 h');
  } finally {
    mock.restore();
    c.restore();
  }
});
