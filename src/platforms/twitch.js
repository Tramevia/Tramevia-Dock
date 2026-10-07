// Twitch adapter — SPEC.md §4. OAuth authorization code (confidential client), EventSub WebSocket
// (one socket per account) for chat + events, Helix REST for everything else.
const ID = 'https://id.twitch.tv/oauth2';
const API = 'https://api.twitch.tv/helix';
const EVENTSUB = 'wss://eventsub.wss.twitch.tv/ws';

/**
 * Only what the adapter calls (add a scope in the same change as the feature that needs it; existing users
 * re-consent through needs_reconnect):
 * channel:manage:broadcast  PATCH /channels, POST /streams/markers
 * clips:edit                POST /clips
 * user:read:chat            EventSub channel.chat.message / message_delete / clear_user_messages / clear / notification
 *                           (subs, resubs, gifts and raids come from channel.chat.notification)
 * user:write:chat           POST /chat/messages
 * moderator:manage:chat_messages  DELETE /moderation/chat
 * moderator:manage:banned_users   POST + DELETE /moderation/bans (timeout, ban, unban)
 * moderator:read:chatters   GET /chat/chatters
 * moderator:read:followers  EventSub channel.follow v2, GET /channels/followers?user_id (user card)
 * bits:read                 EventSub channel.bits.use
 * channel:read:redemptions  EventSub channel.channel_points_custom_reward_redemption.add
 * moderation:read           GET /moderation/moderators (chatter roles)
 * channel:read:vips         GET /channels/vips (chatter roles)
 * channel.raid, stream.online/offline, channel.update and the badge/cheermote/user/game/search reads need none.
 */
export const SCOPES = [
  'channel:manage:broadcast', 'clips:edit', 'user:read:chat', 'user:write:chat', 'moderator:manage:chat_messages',
  'moderator:manage:banned_users', 'moderator:read:chatters', 'moderator:read:followers', 'bits:read',
  'channel:read:redemptions', 'moderation:read', 'channel:read:vips',
];
/** Content classification labels a broadcaster may set (MatureGame is automatic). */
export const LABELS = ['DebatedSocialIssuesAndPolitics', 'DrugsIntoxication', 'Gambling', 'ProfanityVulgarity', 'SexualThemes', 'ViolentGraphic'];
// ponytail: static list of well-known chat bots; make it a setting if users ask for their own.
const BOTS = new Set(['nightbot', 'streamelements', 'moobot', 'fossabot', 'wizebot', 'streamlabs', 'sery_bot', 'soundalerts',
  'commanderroot', 'kofistreambot', 'botrixoficial', 'blerp', 'pokemoncommunitygame', 'streamlootsbot', 'tangiabot',
  'lumiastream', 'own3d', 'creatisbot', 'frostytoolsdotcom', 'streamstickers', 'restreambot', 'deepbot', 'phantombot']);
const ROLE_BY_BADGE = {
  broadcaster: 'broadcaster', moderator: 'moderator', lead_moderator: 'moderator', vip: 'vip', subscriber: 'subscriber',
  founder: 'subscriber', staff: 'staff', admin: 'staff', global_mod: 'staff', partner: 'verified',
};

const qs = params => new URLSearchParams(params).toString();
const emoteUrl = e => `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(e.id)}/${e.format?.includes('animated') ? 'animated' : 'static'}/dark/2.0`;
/** Box art at 144x192 from a search result (fixed -52x72) or a Get Games template ({width}x{height}). */
export const boxArt = url => /^https:\/\//.test(url || '') ? url.replace('{width}x{height}', '144x192').replace(/-\d+x\d+(\.\w+)$/, '-144x192$1') : '';
const tokenSet = (t, previous = {}) => ({
  access: t.access_token, refresh: t.refresh_token || previous.refresh, expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : null,
});

function appOf(ctx) {
  const app = ctx.app('twitch');
  if (!app) throw new ctx.ApiError('twitch', 400, null, ctx.t('Application Twitch non configurée.', 'Twitch app not configured.'));
  return app;
}
const oauth = (ctx, path, form) => ctx.request(`${ID}/${path}`, { platform: 'twitch', method: 'POST', form });
const validate = (ctx, token) => ctx.request(`${ID}/validate`, { platform: 'twitch', headers: { Authorization: `OAuth ${token}` } });

/** Helix call with the account's user token (auto refresh + one retry on 401). */
function helix(ctx, account, path, opts = {}) {
  const { clientId } = appOf(ctx);
  return ctx.accounts.withToken(account, token => ctx.request(`${API}/${path}`, { platform: 'twitch', token, clientId, ...opts }));
}

// ponytail: capped at 10 pages (10k chatters with first=1000); raise if huge channels need the full list.
async function pages(ctx, account, path, params) {
  const out = [];
  let after;
  for (let i = 0; i < 10; i++) {
    const r = await helix(ctx, account, `${path}?${qs({ ...params, ...(after && { after }) })}`);
    out.push(...(r?.data || []));
    after = r?.pagination?.cursor;
    if (!after) break;
  }
  return out;
}

// ---------------------------------------------------------------- Normalization (pure)
/** EventSub message fragments → tokenizer fragments (SPEC §5). */
function fragments(list = [], assets = {}) {
  return list.map(f => {
    if (f.type === 'emote' && f.emote?.id) return { t: 'emote', name: f.text, url: emoteUrl(f.emote) };
    if (f.type === 'mention') return { t: 'mention', v: f.text };
    if (f.type === 'cheermote' && f.cheermote) {
      const c = assets.cheermotes?.get(String(f.cheermote.prefix).toLowerCase());
      const tier = (c?.tiers || []).reduce((best, t) => t.min_bits <= f.cheermote.bits && (!best || t.min_bits > best.min_bits) ? t : best, null);
      return { t: 'cheer', name: c?.prefix || f.cheermote.prefix, amount: f.cheermote.bits, url: tier?.images?.dark?.animated?.['2'] || '', ...(tier?.color && { color: tier.color }) };
    }
    return { t: 'text', v: f.text ?? '' };
  });
}

const tokensOf = (ctx, account, frags) => ctx.tokenize({ platform: 'twitch', channelId: account.platformUserId, fragments: frags });

/** channel.chat.message event → chat message (SPEC §5). `assets` = {badges: Map('set/id' → {title, url}), cheermotes: Map(prefix → cheermote)}. */
export function normalizeChatMessage(ctx, account, e, assets = {}, ts = Date.now()) {
  let frags = [...(e.message?.fragments || [])];
  const edit = (i, fn) => { if (frags[i]?.type === 'text') frags[i] = { ...frags[i], text: fn(frags[i].text) }; };
  // ponytail: /me arrives as IRC-style "\u0001ACTION …\u0001" text (community-reported, not documented).
  const action = (e.message?.text || '').startsWith('\u0001ACTION ');
  if (action) { edit(0, s => s.replace(/^\u0001ACTION /, '')); edit(frags.length - 1, s => s.replace(/\u0001$/, '')); }
  // Replies start with "@parent "; Twitch's own UI hides it.
  if (e.reply && frags[0]?.type === 'mention' && frags[0].mention?.user_id === e.reply.parent_user_id) {
    frags.shift();
    edit(0, s => s.replace(/^ /, ''));
  }
  frags = frags.filter(f => f.type !== 'text' || f.text);
  const login = e.chatter_user_login || '';
  const roles = [...new Set((e.badges || []).map(b => ROLE_BY_BADGE[b.set_id]).filter(Boolean))];
  if (BOTS.has(login)) roles.push('bot');
  const badges = (e.badges || []).map(b => {
    const hit = assets.badges?.get(`${b.set_id}/${b.id}`);
    return hit?.url ? { id: b.set_id, title: hit.title || b.set_id, url: hit.url } : null;
  }).filter(Boolean);
  return {
    id: e.message_id, platform: 'twitch', accountId: account.id, channel: account.login, ts,
    author: { id: e.chatter_user_id, login, name: e.chatter_user_name || login, color: (e.color || '').toLowerCase(), avatar: '', badges, roles },
    text: frags.map(f => f.text).join(''),
    tokens: tokensOf(ctx, account, fragments(frags, assets)),
    reply: e.reply ? { id: e.reply.parent_message_id, author: e.reply.parent_user_name || e.reply.parent_user_login, text: e.reply.parent_message_body || '' } : null,
    flags: {
      ...(e.message_type === 'user_intro' && { first: true }), // otherwise ctx.emitChat decides
      action,
      highlight: Boolean(e.cheer) || ['channel_points_highlighted', 'power_ups_message_effect', 'power_ups_gigantified_emote'].includes(e.message_type),
      self: e.chatter_user_id === account.platformUserId,
    },
    deleted: false,
  };
}

/** EventSub notification (subscription type + event) → feed event (SPEC §5), or null when not shown. */
export function normalizeEvent(ctx, account, type, e, { id, ts = Date.now(), assets = {} } = {}) {
  const base = { id, platform: 'twitch', accountId: account.id, channel: account.login, ts };
  const who = (uid, name, avatar) => (uid ? { id: uid, name, ...(avatar && { avatar }) } : null);
  const say = (text, frags) => (text ? { text, tokens: tokensOf(ctx, account, frags ? fragments(frags, assets) : [{ t: 'text', v: text }]) } : {});
  switch (type) {
    case 'channel.follow': return { ...base, type: 'follow', user: who(e.user_id, e.user_name) };
    case 'channel.bits.use': return {
      ...base, type: 'cheer', user: who(e.user_id, e.user_name), amount: e.bits,
      ...(e.type !== 'cheer' && { label: e.custom_power_up?.title || e.power_up?.type || e.type }), ...say(e.message?.text, e.message?.fragments),
    };
    case 'channel.raid': return { ...base, type: 'raid', user: who(e.from_broadcaster_user_id, e.from_broadcaster_user_name), count: e.viewers };
    case 'channel.channel_points_custom_reward_redemption.add': return {
      ...base, type: 'redemption', user: who(e.user_id, e.user_name), label: e.reward?.title, amount: e.reward?.cost, ...say(e.user_input),
    };
    case 'stream.online': return { ...base, type: 'stream_online', user: null };
    case 'stream.offline': return { ...base, type: 'stream_offline', user: null };
    case 'channel.chat.notification': break;
    default: return null;
  }
  const user = e.chatter_is_anonymous ? null : who(e.chatter_user_id, e.chatter_user_name);
  const msg = say(e.message?.text, e.message?.fragments);
  const sub = e[e.notice_type] || {};
  switch (e.notice_type) { // shared_chat_* (other channels of a shared session) and the rest are not shown
    case 'sub': return { ...base, type: 'sub', user, tier: sub.sub_tier, ...(sub.is_prime && { label: 'Prime' }), ...msg };
    case 'resub': return { ...base, type: 'resub', user, tier: sub.sub_tier, months: sub.cumulative_months, ...(sub.is_prime && { label: 'Prime' }), ...msg };
    case 'gift_paid_upgrade': return { ...base, type: 'sub', user, ...msg };
    case 'prime_paid_upgrade': return { ...base, type: 'sub', user, tier: sub.sub_tier, ...msg };
    case 'community_sub_gift': return { ...base, type: 'giftsub', user, count: sub.total, tier: sub.sub_tier };
    case 'sub_gift': // gifts that belong to a community gift are already counted by community_sub_gift
      return sub.community_gift_id ? null : { ...base, type: 'giftsub', user, count: 1, tier: sub.sub_tier, label: sub.recipient_user_name };
    case 'raid': return { ...base, type: 'raid', user: who(sub.user_id, sub.user_name, sub.profile_image_url), count: sub.viewer_count };
    case 'announcement': return { ...base, type: 'announcement', user, label: sub.color, ...msg };
    default: return null;
  }
}

/** Chat badges (global, cached 24 h + channel) and cheermotes for a channel. */
const globalBadges = { at: 0, map: new Map() };
const badgeMap = sets => new Map(sets.flatMap(s => (s.versions || []).map(v => [`${s.set_id}/${v.id}`, { title: v.title, url: v.image_url_2x }])));
async function loadAssets(ctx, account, assets) {
  const data = path => helix(ctx, account, path).then(r => r?.data || []);
  const me = account.platformUserId;
  if (Date.now() - globalBadges.at > 86_400_000) Object.assign(globalBadges, { map: badgeMap(await data('chat/badges/global')), at: Date.now() });
  const [channel, cheers] = await Promise.all([data(`chat/badges?${qs({ broadcaster_id: me })}`), data(`bits/cheermotes?${qs({ broadcaster_id: me })}`)]);
  assets.badges = new Map([...globalBadges.map, ...badgeMap(channel)]);
  assets.cheermotes = new Map(cheers.map(c => [String(c.prefix).toLowerCase(), c]));
}
/** Twitch rejects 4xx subscription requests for good; 429, 5xx, timeouts and network errors may pass on a retry. */
const transient = err => !err?.status || err.status === 429 || err.status >= 500;

/** EventSub subscriptions for the account's own channel (all cost 0 when the broadcaster authorized the app). */
const subscriptions = b => [
  ['channel.chat.message', '1', { broadcaster_user_id: b, user_id: b }],
  ['channel.chat.message_delete', '1', { broadcaster_user_id: b, user_id: b }],
  ['channel.chat.clear_user_messages', '1', { broadcaster_user_id: b, user_id: b }],
  ['channel.chat.clear', '1', { broadcaster_user_id: b, user_id: b }],
  ['channel.chat.notification', '1', { broadcaster_user_id: b, user_id: b }],
  ['channel.follow', '2', { broadcaster_user_id: b, moderator_user_id: b }],
  ['channel.bits.use', '1', { broadcaster_user_id: b }], // cheers + Power-ups (channel.cheer covers cheers only)
  ['channel.raid', '1', { to_broadcaster_user_id: b }],
  ['channel.channel_points_custom_reward_redemption.add', '1', { broadcaster_user_id: b }],
  ['stream.online', '1', { broadcaster_user_id: b }],
  ['stream.offline', '1', { broadcaster_user_id: b }],
  ['channel.update', '2', { broadcaster_user_id: b }],
];

export default {
  id: 'twitch',
  name: 'Twitch',
  color: '#9146FF',
  auth: 'oauth',
  app: { consoleUrl: 'https://dev.twitch.tv/console/apps/create', docsUrl: 'https://dev.twitch.tv/docs/authentication/register-app/', localhost: true },
  capabilities: {
    chatRead: true, chatSend: true, reply: true, deleteMessage: true, timeout: true, ban: true, unban: true,
    chatters: true, viewers: true, events: true, editInfo: true, categorySearch: true, markers: true, clips: true,
    limits: { chatMaxLength: 500, timeoutMin: 1, timeoutMax: 1_209_600 },
  },
  infoFields: {
    title: { max: 140 },
    category: { search: true },
    tags: { max: 10, maxLength: 25, pattern: '^[\\p{L}\\p{N}]+$', replaceAll: true },
    language: {},
    labels: { options: LABELS },
    brandedContent: {},
  },
  statsInterval: 30_000,

  // ---------------------------------------------------------------- OAuth
  async testApp(ctx, app) {
    const t = await oauth(ctx, 'token', { client_id: app.clientId, client_secret: app.clientSecret, grant_type: 'client_credentials' });
    oauth(ctx, 'revoke', { client_id: app.clientId, token: t.access_token }).catch(() => {});
    return { ok: true, message: ctx.t('Client ID et secret acceptés par Twitch.', 'Client ID and secret accepted by Twitch.') };
  },

  authorize(ctx, { state, redirectUri, app }) {
    // force_verify: otherwise Twitch silently re-grants whichever account is logged in on twitch.tv.
    return { url: `${ID}/authorize?${qs({ response_type: 'code', client_id: app.clientId, redirect_uri: redirectUri, scope: SCOPES.join(' '), state, force_verify: 'true' })}` };
  },

  async callback(ctx, { code, redirectUri, app }) {
    const t = await oauth(ctx, 'token', { client_id: app.clientId, client_secret: app.clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    const v = await validate(ctx, t.access_token);
    const user = (await ctx.request(`${API}/users?${qs({ id: v.user_id })}`, { platform: 'twitch', token: t.access_token, clientId: app.clientId }))?.data?.[0] || {};
    return {
      platformUserId: String(v.user_id), login: v.login, displayName: user.display_name || v.login, avatar: user.profile_image_url || '',
      scopes: v.scopes || [], tokens: tokenSet(t),
    };
  },

  async refresh(ctx, account, tokens) {
    const app = appOf(ctx);
    return tokenSet(await oauth(ctx, 'token', { grant_type: 'refresh_token', refresh_token: tokens.refresh, client_id: app.clientId, client_secret: app.clientSecret }), tokens);
  },

  async revoke(ctx, account, tokens) {
    await oauth(ctx, 'revoke', { client_id: appOf(ctx).clientId, token: tokens.access });
  },

  // ---------------------------------------------------------------- Realtime (EventSub WebSocket)
  async connect(ctx, account) {
    const me = account.platformUserId;
    const assets = {};
    const seen = new Set();
    const lastRaid = new Map(); // raider id → ts of the last raid event shown
    let ws = null, next = null, stopped = false, attempt = 0, keepalive = 10, watchdog, retry;
    const rejected = () => ctx.t('Twitch a refusé l’accès : reconnecte ce compte.', 'Twitch rejected the token: reconnect this account.');
    const reloadAssets = () => loadAssets(ctx, account, assets).catch(err => ctx.log.warn(`[twitch] ${account.login}: badges/cheermotes: ${err.message}`));

    // Twitch requires validating every token at startup and hourly. A rejected token at startup is a setup failure.
    const check = () => ctx.accounts.withToken(account, token => validate(ctx, token));
    await check();
    const hourly = setInterval(() => {
      reloadAssets(); // retries a failed load, picks up new channel badges and cheermotes
      check().catch(err => {
        if (stopped || !(err instanceof ctx.ApiError) || ![400, 401, 403].includes(err.status)) return; // transient: next hour
        ctx.accounts.setStatus(account.id, 'needs_reconnect', rejected());
        stop();
      });
    }, 3_600_000);
    hourly.unref?.();

    try { ctx.emotes.load('twitch', me)?.catch?.(() => {}); } catch { /* fire and forget */ }
    reloadAssets();

    const remember = key => {
      if (seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 2000) seen.delete(seen.values().next().value);
      return true;
    };

    function bump() {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        const dead = ws;
        ws = null;
        try { dead?.close(); } catch { /* already closed */ }
        schedule('keepalive timeout');
      }, (keepalive + 5) * 1000);
      watchdog.unref?.();
    }

    function schedule(reason) {
      clearTimeout(watchdog);
      clearTimeout(retry);
      try { next?.close(); } catch { /* ignore */ }
      next = null;
      const delay = Math.min(60_000, 1000 * 2 ** attempt++) + Math.floor(Math.random() * 1000);
      ctx.log.warn(`[twitch] ${account.login}: EventSub ${reason}; reconnecting in ${Math.round(delay / 1000)}s`);
      retry = setTimeout(() => { if (!stopped) fresh(); }, delay);
      retry.unref?.();
    }

    /** New session (watchdog armed until the welcome sets the real keepalive). */
    function fresh() {
      keepalive = 10;
      ws = open(EVENTSUB);
      bump();
    }

    function open(url) {
      const sock = new WebSocket(url);
      sock.onmessage = ev => {
        try { onFrame(sock, JSON.parse(ev.data)); } catch (err) { ctx.log.warn(`[twitch] ${account.login}: EventSub frame: ${err.message}`); }
      };
      sock.onclose = ev => {
        if (sock === next) next = null;
        if (sock !== ws || stopped) return;
        ws = null;
        schedule(`closed (${ev.code})`);
      };
      sock.onerror = () => {}; // a close event follows
      return sock;
    }

    function onFrame(sock, { metadata: meta = {}, payload = {} }) {
      if (stopped || (sock !== ws && sock !== next)) return;
      const type = meta.message_type;
      if (type === 'session_welcome') {
        keepalive = payload.session?.keepalive_timeout_seconds || 10;
        if (sock === next) { // reconnect: swap sockets, subscriptions carry over
          const old = ws;
          ws = sock;
          next = null;
          try { old?.close(); } catch { /* ignore */ }
          bump();
          return;
        }
        bump();
        subscribe(sock, payload.session.id).catch(err => ctx.log.warn(`[twitch] ${account.login}: subscribe: ${err.message}`));
        return;
      }
      if (sock !== ws) return; // nothing but the welcome is expected on a reconnect socket
      bump();
      if (type === 'session_reconnect' && payload.session?.reconnect_url) {
        try { next?.close(); } catch { /* ignore */ }
        next = open(payload.session.reconnect_url); // use as-is
      } else if (type === 'revocation') {
        const s = payload.subscription || {};
        ctx.log.warn(`[twitch] ${account.login}: subscription ${s.type} revoked (${s.status})`);
        if (s.status === 'authorization_revoked' || s.status === 'user_removed') {
          ctx.accounts.setStatus(account.id, 'needs_reconnect', rejected());
          stop();
        }
      } else if (type === 'notification' && remember(meta.message_id)) {
        handle(meta.subscription_type, payload.event || {}, meta);
      }
    }

    /** POST the subscriptions on a session → [[subscription, error]] for those that failed (409 = already exists), logged. */
    async function post(subs, sock, sessionId) {
      const results = await Promise.allSettled(subs.map(([type, version, condition]) => helix(ctx, account, 'eventsub/subscriptions', {
        method: 'POST', json: { type, version, condition, transport: { method: 'websocket', session_id: sessionId } },
      })));
      if (stopped || sock !== ws) return null;
      const failed = subs.map((s, i) => [s, results[i].reason]).filter(([, err]) => err && err.status !== 409);
      if (failed.length) ctx.log.warn(`[twitch] ${account.login}: EventSub subscriptions failed: ${failed.map(([s, err]) => `${s[0]}: ${err.message}`).join('; ')}`);
      return failed;
    }

    async function subscribe(sock, sessionId) {
      const failed = await post(subscriptions(me), sock, sessionId);
      if (!failed) return;
      const chatError = failed.find(([s]) => s[0] === 'channel.chat.message')?.[1];
      const status = ctx.accounts.get(account.id)?.status;
      if (chatError && (status === 'needs_reconnect' || [401, 403].includes(chatError.status))) {
        // token rejected, scopes missing (older grant) or the manager could not renew the token
        if (status !== 'needs_reconnect') ctx.accounts.setStatus(account.id, 'needs_reconnect', rejected());
        return stop();
      }
      if (chatError) { // no chat on this session: open a new one with backoff (it subscribes everything again)
        ctx.accounts.setStatus(account.id, 'error', ctx.t(`Chat Twitch indisponible : ${chatError.message}`, `Twitch chat unavailable: ${chatError.message}`));
        const dead = ws;
        ws = null; // so its close event is ignored
        try { dead?.close(); } catch { /* ignore */ }
        return schedule('chat subscription failed');
      }
      attempt = 0;
      if (status === 'error') ctx.accounts.setStatus(account.id, 'ok');
      if (!assets.badges) reloadAssets(); // the load at connect failed
      // One retry on this session for transient failures; a permanent one must not make the session loop.
      const again = failed.filter(([, err]) => transient(err)).map(([s]) => s);
      if (again.length) setTimeout(() => { if (!stopped && sock === ws) post(again, sock, sessionId).catch(() => {}); }, 15_000).unref?.();
    }

    function handle(type, e, meta) {
      const ts = Date.parse(meta.message_timestamp) || Date.now();
      const accountId = account.id;
      switch (type) {
        case 'channel.chat.message': return ctx.emitChat(normalizeChatMessage(ctx, account, e, assets, ts));
        case 'channel.chat.message_delete': return ctx.emitDelete({ accountId, messageId: e.message_id });
        case 'channel.chat.clear_user_messages': return ctx.emitDelete({ accountId, userId: e.target_user_id });
        case 'channel.chat.clear': return ctx.emitDelete({ accountId });
        case 'channel.update': return ctx.accounts.pushStats(account, { title: e.title || '', category: e.category_name || '' });
        case 'stream.online': ctx.accounts.pushStats(account, { live: true, startedAt: Date.parse(e.started_at) || ts }); break;
        case 'stream.offline': ctx.accounts.pushStats(account, { live: false, viewers: 0, startedAt: null }); break;
      }
      const evt = normalizeEvent(ctx, account, type, e, { id: meta.message_id, ts, assets });
      // A raid arrives both as channel.raid and as a chat notification: show it once, but a later raid from the same channel again.
      if (evt?.type === 'raid') {
        const prev = lastRaid.get(evt.user?.id);
        lastRaid.set(evt.user?.id, ts);
        if (prev !== undefined && Math.abs(ts - prev) < 120_000) return;
      }
      if (evt) ctx.emitEvent(evt);
    }

    function stop() {
      stopped = true;
      clearInterval(hourly);
      clearTimeout(watchdog);
      clearTimeout(retry);
      for (const s of [ws, next]) { try { s?.close(); } catch { /* ignore */ } }
      ws = next = null;
    }

    fresh();
    return { stop };
  },

  // ---------------------------------------------------------------- Helix
  async stats(ctx, account) {
    const me = account.platformUserId;
    const s = (await helix(ctx, account, `streams?${qs({ user_id: me })}`))?.data?.[0];
    if (s) return { live: true, viewers: s.viewer_count || 0, startedAt: Date.parse(s.started_at) || null, title: s.title || '', category: s.game_name || '' };
    const c = (await helix(ctx, account, `channels?${qs({ broadcaster_id: me })}`))?.data?.[0] || {};
    return { live: false, viewers: 0, startedAt: null, title: c.title || '', category: c.game_name || '' };
  },

  async chatters(ctx, account) {
    const me = account.platformUserId;
    const [list, mods, vips] = await Promise.all([
      pages(ctx, account, 'chat/chatters', { broadcaster_id: me, moderator_id: me, first: 1000 }),
      pages(ctx, account, 'moderation/moderators', { broadcaster_id: me, first: 100 }).catch(() => []), // roles are best effort
      pages(ctx, account, 'channels/vips', { broadcaster_id: me, first: 100 }).catch(() => []),
    ]);
    const modIds = new Set(mods.map(m => m.user_id));
    const vipIds = new Set(vips.map(v => v.user_id));
    return list.map(c => ({
      id: c.user_id, login: c.user_login, name: c.user_name || c.user_login,
      roles: [
        c.user_id === me && 'broadcaster', modIds.has(c.user_id) && 'moderator', vipIds.has(c.user_id) && 'vip', BOTS.has(c.user_login) && 'bot',
      ].filter(Boolean),
    }));
  },

  async getInfo(ctx, account) {
    const c = (await helix(ctx, account, `channels?${qs({ broadcaster_id: account.platformUserId })}`))?.data?.[0];
    if (!c) throw new ctx.ApiError('twitch', 404, null, ctx.t('Chaîne Twitch introuvable.', 'Twitch channel not found.'));
    const game = c.game_id ? (await helix(ctx, account, `games?${qs({ id: c.game_id })}`).catch(() => null))?.data?.[0] : null;
    return {
      title: c.title || '',
      category: c.game_id ? { id: c.game_id, name: c.game_name, image: boxArt(game?.box_art_url) } : null,
      tags: c.tags || [],
      language: c.broadcaster_language || '',
      labels: (c.content_classification_labels || []).filter(l => LABELS.includes(l)),
      brandedContent: Boolean(c.is_branded_content),
    };
  },

  async setInfo(ctx, account, changes) {
    const body = {};
    if (changes.title !== undefined) body.title = String(changes.title);
    if (changes.category !== undefined) body.game_id = changes.category?.id ? String(changes.category.id) : '0'; // '0' unsets
    if (changes.tags !== undefined) body.tags = (changes.tags || []).map(String);
    if (changes.language !== undefined) body.broadcaster_language = String(changes.language);
    if (changes.labels !== undefined) body.content_classification_labels = LABELS.map(id => ({ id, is_enabled: (changes.labels || []).includes(id) }));
    if (changes.brandedContent !== undefined) body.is_branded_content = Boolean(changes.brandedContent);
    if (Object.keys(body).length) await helix(ctx, account, `channels?${qs({ broadcaster_id: account.platformUserId })}`, { method: 'PATCH', json: body });
    return { ok: true };
  },

  async searchCategories(ctx, account, query) {
    const r = await helix(ctx, account, `search/categories?${qs({ query, first: 20 })}`);
    return (r?.data || []).map(c => ({ id: c.id, name: c.name, image: boxArt(c.box_art_url) }));
  },

  async send(ctx, account, { text, replyTo }) {
    const me = account.platformUserId;
    const r = await helix(ctx, account, 'chat/messages', {
      method: 'POST', json: { broadcaster_id: me, sender_id: me, message: text, ...(replyTo && { reply_parent_message_id: replyTo }) },
    });
    const d = r?.data?.[0] || {};
    return d.is_sent ? { ok: true, id: d.message_id } : { ok: false, error: d.drop_reason?.message || ctx.t('Message refusé par Twitch.', 'Message rejected by Twitch.') };
  },

  async moderate(ctx, account, { action, messageId, userId, duration, reason }) {
    const ids = { broadcaster_id: account.platformUserId, moderator_id: account.platformUserId };
    if (action === 'delete') {
      if (!messageId) throw new Error('messageId required'); // without it Twitch clears the whole chat
      await helix(ctx, account, `moderation/chat?${qs({ ...ids, message_id: messageId })}`, { method: 'DELETE' });
    } else if (action === 'timeout' || action === 'ban') {
      const data = { user_id: userId, ...(action === 'timeout' && { duration }), ...(reason && { reason }) };
      await helix(ctx, account, `moderation/bans?${qs(ids)}`, { method: 'POST', json: { data } });
    } else if (action === 'unban') {
      await helix(ctx, account, `moderation/bans?${qs({ ...ids, user_id: userId })}`, { method: 'DELETE' });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
    return { ok: true };
  },

  async userInfo(ctx, account, userId) {
    const [u, f] = await Promise.all([
      helix(ctx, account, `users?${qs({ id: userId })}`),
      helix(ctx, account, `channels/followers?${qs({ broadcaster_id: account.platformUserId, user_id: userId })}`).catch(() => null),
    ]);
    const user = u?.data?.[0] || {};
    return {
      createdAt: Date.parse(user.created_at) || null, avatar: user.profile_image_url || '', description: user.description || '',
      followedAt: Date.parse(f?.data?.[0]?.followed_at) || null,
    };
  },

  async marker(ctx, account, { description } = {}) {
    await helix(ctx, account, 'streams/markers', { method: 'POST', json: { user_id: account.platformUserId, ...(description && { description: String(description).slice(0, 140) }) } });
    return { ok: true };
  },

  async clip(ctx, account) {
    const d = (await helix(ctx, account, `clips?${qs({ broadcaster_id: account.platformUserId })}`, { method: 'POST' }))?.data?.[0];
    if (!d?.id) throw new ctx.ApiError('twitch', 502, null, ctx.t('Clip non créé.', 'Clip not created.'));
    return { ok: true, url: `https://clips.twitch.tv/${encodeURIComponent(d.id)}` };
  },
};
