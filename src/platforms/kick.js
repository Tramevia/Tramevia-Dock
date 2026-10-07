// Kick adapter — SPEC.md §4. Official Public API (api.kick.com) + OAuth 2.1 with mandatory PKCE (id.kick.com).
// Chat transport per account (options.chatMode): official signed webhooks (needs a public HTTPS URL) or the
// unofficial, read-only Pusher socket used by kick.com itself (works on localhost). Docs: https://docs.kick.com
import { createPublicKey, verify } from 'node:crypto';
import { randomId } from '../crypto.js';

const API = 'https://api.kick.com/public/v1';
const ID = 'https://id.kick.com';
// Never request streamkey:read (GET channels would then return the stream key).
const SCOPES = 'user:read channel:read channel:write chat:write events:subscribe moderation:ban moderation:chat_message:manage kicks:read';
// Unofficial: the key kick.com's own web client uses (verified 2026-10-07; the old key is rejected with 4001).
const PUSHER = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false';
const EVENTS = ['chat.message.sent', 'channel.followed', 'channel.subscription.new', 'channel.subscription.renewal',
  'channel.subscription.gifts', 'kicks.gifted', 'livestream.status.updated', 'livestream.metadata.updated',
  'moderation.banned', 'channel.reward.redemption.updated'];
const MODES = ['auto', 'webhook', 'pusher', 'off'];
const MAX_AGE = 10 * 60_000; // webhook timestamp tolerance; dedupe memory below covers it
const ROLES = { broadcaster: 'broadcaster', moderator: 'moderator', vip: 'vip', subscriber: 'subscriber', founder: 'subscriber', verified: 'verified', staff: 'staff', bot: 'bot' };
// Used only when https://api.kick.com/public/v1/public-key is unreachable. Fetched from that endpoint on
// 2026-10-07: the key embedded in the legacy app had already been rotated, so a stale copy is expected over time.
const FALLBACK_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0C0tthITvk/EjIxCGCko
YrxM7eqP4GDnUyP4BnfgJ9yaHqniNfraxTKeRv7TGkOOZviow2zcx/YP9waURfHd
cZOHU+EKA3lSFdMpezLiDGaym+FxR0iXAFZXE9VBdCCOyBeK81/m3mGScGVBNumt
6pGCZYU9DCn5oqnC6RC5pUnlHnJp+TOXW6z8Silr4Y81a/66b0FAJ6EGUVXmXXgP
FXQRTmJcLM4EgCXfNXLwExzr2MtowBwp5PYD6Usl7uZcnMIPutPdXJ0JnvqrztFC
QTvrGMxzKLKLcKQTG159jfHGJ4wKSeenvwXN8jaVJAtW7wRAooRRT8Kho7Axe8jp
qQIDAQAB
-----END PUBLIC KEY-----`;

const https = u => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');
const color = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
const time = s => { const t = Date.parse(s); return Number.isFinite(t) ? Math.min(t, Date.now()) : Date.now(); };
const defined = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const category = c => ({ id: String(c.id), name: String(c.name || ''), image: https(c.thumbnail) });

/** Bounded "seen" memory: true the first time a key is seen. */
function once(map, key, max = 10_000) {
  if (map.has(key)) return false;
  map.set(key, true);
  if (map.size > max) map.delete(map.keys().next().value);
  return true;
}
const seen = new Map(); // webhook message ids + redemption ids

/** Effective chat transport: 'auto' → official webhooks on a public HTTPS install, unofficial Pusher otherwise. */
export function chatMode(account, ctx) {
  const mode = account?.options?.chatMode;
  return MODES.includes(mode) && mode !== 'auto' ? mode : ctx?.config?.secure ? 'webhook' : 'pusher';
}

/** Kick timeouts are in minutes (1–10080); the dock speaks seconds. */
export const timeoutMinutes = seconds => Math.min(10080, Math.max(1, Math.ceil((Number(seconds) || 0) / 60)));

/** "[emote:ID:name]" placeholders → tokenizer fragments. */
export function fragments(content) {
  const text = String(content ?? '').slice(0, 4000);
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\[emote:(\d+):([^\]]*)\]/g)) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    out.push({ t: 'emote', name: m[2] || 'emote', url: `https://files.kick.com/emotes/${m[1]}/fullsize` });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}
const plain = content => fragments(content).map(f => (f.t === 'text' ? f.v : f.name)).join('');

/** PATCH /channels body: only the keys present in `changes`. */
export function infoPatch(ctx, changes = {}) {
  const body = {};
  if (changes.title != null) {
    body.stream_title = String(changes.title).trim();
    if (!body.stream_title) throw new Error(ctx.t('Le titre ne peut pas être vide.', 'The title cannot be empty.'));
  }
  if (changes.category) {
    body.category_id = Number(changes.category.id);
    if (!Number.isInteger(body.category_id) || body.category_id < 1) throw new Error(ctx.t('Catégorie Kick invalide.', 'Invalid Kick category.'));
  }
  // Kick no longer shows custom tags (only its default ones, confirmed by Kick support): tags are not editable.
  if (changes.tags !== undefined) throw new Error(ctx.t('Kick ne permet plus de modifier les tags.', 'Kick no longer lets you change tags.'));
  return body;
}

// --- Normalization (both transports feed the same models) ---------------------------------------------
const list = v => (Array.isArray(v) ? v : []);
function author(account, { id, username, slug, avatar, identity }) {
  // badges = role badges (type, no image: webhook + Pusher); badges_v2 = cosmetic badges with images (Pusher only,
  // seen live 2026-10-07: {name: 'level'|'kick_founder22'|…, badge_type: 'global', image_url, metadata.level, selected}).
  const roles = new Set();
  const badges = [];
  for (const b of list(identity?.badges)) {
    if (ROLES[b.type]) roles.add(ROLES[b.type]);
    badges.push({ id: String(b.type || ''), title: String(b.text || b.type || ''), url: '' });
  }
  for (const b of list(identity?.badges_v2)) {
    if (b.selected === false) continue;
    badges.push({ id: String(b.name || ''), title: [b.name, b.metadata?.level].filter(Boolean).join(' '), url: https(b.image_url) });
  }
  if (String(id) === account.platformUserId) roles.add('broadcaster');
  return {
    id: String(id ?? ''), login: String(slug || username || '').toLowerCase(), name: String(username || ''),
    color: color(identity?.username_color || identity?.color), avatar: https(avatar), badges, roles: [...roles],
  };
}

function message(ctx, account, { id, ts, sender, content, reply }) {
  const frags = fragments(content);
  return {
    id: String(id), platform: 'kick', accountId: account.id, channel: account.login, ts,
    author: author(account, sender), text: frags.map(f => (f.t === 'text' ? f.v : f.name)).join(''),
    tokens: ctx.tokenize({ platform: 'kick', channelId: account.platformUserId, fragments: frags }),
    reply, flags: { action: false, highlight: false, self: String(sender.id) === account.platformUserId }, deleted: false,
  };
}

function event(ctx, account, type, user, extra = {}) {
  const evt = defined({ id: randomId(8), platform: 'kick', accountId: account.id, channel: account.login, ts: Date.now(), type, user, ...extra });
  if (evt.text) {
    evt.text = plain(evt.text);
    evt.tokens = ctx.tokenize({ platform: 'kick', channelId: account.platformUserId, fragments: fragments(extra.text) });
  } else delete evt.text;
  ctx.emitEvent(evt);
}

function streamStatus(ctx, account, live, title, startedAt) {
  ctx.accounts.pushStats(account, live ? defined({ live, title, startedAt }) : { live, viewers: 0, startedAt: null });
  event(ctx, account, live ? 'stream_online' : 'stream_offline', null);
}

/** Official webhook payload (already verified) → hub. */
export function onWebhook(ctx, account, type, p, eventId) {
  const user = u => (u && !u.is_anonymous && u.user_id != null ? { id: String(u.user_id), name: String(u.username || ''), avatar: https(u.profile_picture) } : null);
  const base = { id: eventId, ts: time(p.created_at) };
  switch (type) {
    case 'chat.message.sent': {
      const s = p.sender || {};
      const r = p.replies_to;
      return ctx.emitChat(message(ctx, account, {
        id: p.message_id || eventId, ts: base.ts, content: p.content,
        sender: { id: s.user_id, username: s.username, slug: s.channel_slug, avatar: s.profile_picture, identity: s.identity },
        reply: r?.message_id ? { id: String(r.message_id), author: String(r.sender?.username || ''), text: plain(r.content) } : null,
      }));
    }
    case 'channel.followed': return event(ctx, account, 'follow', user(p.follower), { id: eventId });
    case 'channel.subscription.new': return event(ctx, account, 'sub', user(p.subscriber), { ...base, months: p.duration });
    case 'channel.subscription.renewal': return event(ctx, account, 'resub', user(p.subscriber), { ...base, months: p.duration });
    case 'channel.subscription.gifts': return event(ctx, account, 'giftsub', user(p.gifter), { ...base, count: p.giftees?.length || 1 });
    case 'kicks.gifted':
      return event(ctx, account, 'kicks', user(p.sender), { ...base, amount: Number(p.gift?.amount) || 0, label: p.gift?.name, text: p.gift?.message });
    case 'channel.reward.redemption.updated': // fires again on accept/reject: one feed item per redemption
      if (!p.id || !once(seen, `redemption:${p.id}`)) return;
      return event(ctx, account, 'redemption', user(p.redeemer), {
        id: String(p.id), ts: time(p.redeemed_at), label: p.reward?.title, amount: p.reward?.cost, text: p.user_input,
      });
    case 'livestream.status.updated': return streamStatus(ctx, account, Boolean(p.is_live), p.title, p.is_live ? time(p.started_at) : null);
    case 'livestream.metadata.updated':
      return ctx.accounts.pushStats(account, defined({ title: p.metadata?.title, category: p.metadata?.category?.name }));
    case 'moderation.banned':
      if (p.banned_user?.user_id != null) ctx.emitDelete({ accountId: account.id, userId: String(p.banned_user.user_id) });
  }
}

/** Unofficial Pusher app event → hub. Names may come with or without the "App\Events\" prefix. */
export function onPusher(ctx, account, name, d) {
  const named = n => (n ? { id: '', name: String(n) } : null);
  const user = u => (u?.id != null ? { id: String(u.id), name: String(u.username || '') } : null);
  switch (String(name).replace(/^App\\Events\\/, '')) {
    case 'ChatMessageEvent': {
      const o = d.metadata?.original_message;
      return ctx.emitChat(message(ctx, account, {
        id: d.id, ts: time(d.created_at), content: d.content,
        sender: { id: d.sender?.id, username: d.sender?.username, slug: d.sender?.slug, identity: d.sender?.identity },
        reply: o?.id ? { id: String(o.id), author: String(d.metadata.original_sender?.username || ''), text: plain(o.content) } : null,
      }));
    }
    case 'MessageDeletedEvent': return d.message?.id && ctx.emitDelete({ accountId: account.id, messageId: String(d.message.id) });
    case 'UserBannedEvent': return d.user?.id != null && ctx.emitDelete({ accountId: account.id, userId: String(d.user.id) });
    case 'ChatroomClearEvent': return ctx.emitDelete({ accountId: account.id });
    case 'SubscriptionEvent': return event(ctx, account, d.months > 1 ? 'resub' : 'sub', named(d.username), { months: d.months });
    case 'GiftedSubscriptionsEvent': return event(ctx, account, 'giftsub', named(d.gifter_username), { count: d.gifted_usernames?.length || 1 });
    case 'StreamHostEvent': case 'StreamHostedEvent':
      return event(ctx, account, 'raid', named(d.host_username ?? d.user?.username), {
        count: d.number_viewers ?? d.message?.numberOfViewers, text: d.optional_message ?? d.message?.optionalMessage ?? undefined,
      });
    case 'RewardRedeemedEvent':
      return event(ctx, account, 'redemption', user({ id: d.user_id, username: d.username }), { label: d.reward_title, text: d.user_input ?? undefined });
    case 'KicksGifted':
      return event(ctx, account, 'kicks', user(d.sender), { amount: Number(d.gift?.amount) || 0, label: d.gift?.name, text: d.message });
    case 'FollowersUpdated': return d.followed && d.username && event(ctx, account, 'follow', named(d.username));
    case 'StreamerIsLive': return streamStatus(ctx, account, true, d.livestream?.session_title, time(d.livestream?.created_at));
    case 'StopStreamBroadcast': return streamStatus(ctx, account, false);
  }
}

// --- Webhooks (official) ----------------------------------------------------------------------------------
let key = null;
let keyAt = 0;
/** Inject or clear the cached Kick public key (tests). */
export function setPublicKey(pem) { key = pem ? createPublicKey(pem) : null; keyAt = 0; }

async function publicKey(ctx, refresh = false) {
  if (key && !refresh) return key;
  if (key && Date.now() - keyAt < 60_000) return key; // ponytail: one refetch per minute, so forged requests can't hammer Kick
  keyAt = Date.now();
  try {
    key = createPublicKey((await ctx.request(`${API}/public-key`, { platform: 'kick' }))?.data?.public_key);
  } catch (err) {
    ctx.log.warn(`[kick] public key fetch failed (${err.message}); using the cached or embedded key`);
    key ||= createPublicKey(FALLBACK_KEY);
  }
  return key;
}

let staleLogAt = 0;
/** Verify, dedupe and dispatch one webhook delivery. Returns the HTTP status to answer. */
export async function handleWebhook(ctx, headers, raw) {
  const id = headers['kick-event-message-id'];
  const ts = headers['kick-event-message-timestamp'];
  const sig = headers['kick-event-signature'];
  if (!id || !ts || !sig || !Buffer.isBuffer(raw)) return 400;
  const signed = Buffer.concat([Buffer.from(`${id}.${ts}.`), raw]);
  const signature = Buffer.from(String(sig), 'base64');
  const valid = k => { try { return verify('sha256', signed, k, signature); } catch { return false; } };
  if (!valid(await publicKey(ctx)) && !valid(await publicKey(ctx, true))) return 403;
  // Signed but stale (replay, or a very late retry): drop it, yet answer 2xx so Kick does not unsubscribe us.
  if (!(Math.abs(Date.now() - Date.parse(ts)) <= MAX_AGE)) {
    if (Date.now() - staleLogAt > 60_000) { staleLogAt = Date.now(); ctx.log.warn('[kick] stale webhook dropped (check the server clock)'); }
    return 200;
  }
  if (!once(seen, `msg:${id}`)) return 200; // duplicate delivery
  try {
    const payload = JSON.parse(raw.toString('utf8'));
    const broadcaster = String(payload?.broadcaster?.user_id ?? '');
    const account = ctx.accounts.list().find(a => a.platform === 'kick' && !a.demo && a.platformUserId === broadcaster
      && a.status !== 'disabled' && chatMode(a, ctx) === 'webhook');
    if (account && headers['kick-event-version'] === '1') onWebhook(ctx, account, String(headers['kick-event-type'] || ''), payload, String(id));
  } catch (err) {
    ctx.log.warn(`[kick] webhook ignored: ${err.message}`);
  }
  return 200;
}

// --- API helpers --------------------------------------------------------------------------------------------
const call = (ctx, account, url, opts = {}) =>
  ctx.accounts.withToken(account, token => ctx.request(url.startsWith('https://') ? url : API + url, { platform: 'kick', token, ...opts }));

async function channel(ctx, account) {
  const c = (await call(ctx, account, `/channels?broadcaster_user_id=${encodeURIComponent(account.platformUserId)}`))?.data?.[0];
  if (!c) throw new Error(ctx.t('Chaîne Kick introuvable.', 'Kick channel not found.'));
  return c;
}

async function oauthToken(ctx, app, form) {
  const r = await ctx.request(`${ID}/oauth/token`, { platform: 'kick', method: 'POST', form: { client_id: app.clientId, client_secret: app.clientSecret, ...form } });
  if (!r?.access_token) throw new ctx.ApiError('kick', 502, null, ctx.t('Kick n’a renvoyé aucun jeton.', 'Kick returned no token.'));
  return r;
}

/** This account's webhook subscriptions (GET /events/subscriptions). */
const subscriptions = async (ctx, account) =>
  ((await call(ctx, account, `/events/subscriptions?broadcaster_user_id=${encodeURIComponent(account.platformUserId)}`))?.data || [])
    .filter(s => s.broadcaster_user_id == null || String(s.broadcaster_user_id) === account.platformUserId);

/** Delete this account's webhook subscriptions, or Kick keeps POSTing (and we keep acking) its chat forever. */
async function unsubscribe(ctx, account) {
  const ids = (await subscriptions(ctx, account)).map(s => s.id).filter(Boolean);
  if (ids.length) await call(ctx, account, `/events/subscriptions?${new URLSearchParams(ids.map(id => ['id', String(id)]))}`, { method: 'DELETE' });
}

async function ensureSubscriptions(ctx, account) {
  const have = new Set((await subscriptions(ctx, account)).map(s => s.event));
  const missing = EVENTS.filter(e => !have.has(e));
  if (!missing.length) return;
  const res = await call(ctx, account, '/events/subscriptions', { method: 'POST', json: { events: missing.map(name => ({ name, version: 1 })), method: 'webhook' } });
  const errors = (res?.data || []).filter(r => r.error);
  const failed = errors.map(r => `${r.name}: ${r.error}`);
  const url = `${ctx.config.publicUrl}/webhooks/kick`;
  if (errors.length && (errors.length >= missing.length || errors.some(r => r.name === 'chat.message.sent'))) {
    throw new Error(ctx.t(`Kick a refusé les abonnements webhook (${failed.join(', ')}). Active « Enable Webhooks » dans ton app Kick avec l’URL ${url}.`,
      `Kick refused the webhook subscriptions (${failed.join(', ')}). Turn on "Enable Webhooks" in your Kick app with the URL ${url}.`));
  }
  if (failed.length) ctx.log.warn(`[kick] ${account.login}: some webhook subscriptions failed: ${failed.join(', ')}`);
}

/** Pusher needs Kick's internal chatroom (+ channel) ids: manual options, cached lookup, or the (Cloudflare-fronted) site API. */
async function chatroom(ctx, account) {
  const opt = k => { const v = String(account.options?.[k] ?? '').trim(); return /^\d{1,12}$/.test(v) ? v : ''; };
  const cacheKey = `kick:chatroom:${account.login}`;
  const cached = ctx.settings.get(cacheKey);
  // Without a channel id, channel.{id} (live/offline, follows, KICKs) is not subscribed: keep the cached one if any.
  if (opt('chatroomId')) return { chatroomId: opt('chatroomId'), channelId: opt('channelId') || cached?.channelId || '' };
  if (cached?.chatroomId) return cached;
  try {
    const c = await ctx.request(`https://kick.com/api/v2/channels/${encodeURIComponent(account.login)}`, { platform: 'kick', timeout: 10_000 });
    const ids = { chatroomId: String(c?.chatroom?.id ?? ''), channelId: String(c?.id ?? '') };
    if (!/^\d+$/.test(ids.chatroomId)) throw new Error('no chatroom id');
    ctx.settings.set(cacheKey, ids);
    return ids;
  } catch (err) {
    throw new Error(ctx.t(`Impossible de trouver le salon de chat Kick (${err.message}). Saisis son ID à la main dans les options du compte ou passe en mode webhook.`,
      `Could not find the Kick chat room (${err.message}). Enter its ID by hand in the account options or switch to webhook mode.`));
  }
}

/** Unofficial, read-only Pusher connection with ping/pong, activity watchdog and backoff reconnect. */
function pusher(ctx, account, { chatroomId, channelId }) {
  // .v2 = chat, deletes, bans, subs, gifts; chatroom_{id} = RewardRedeemedEvent (seen live 2026-10-07);
  // chatrooms.{id} (v1) = StreamHostedEvent per KickLib; channel.{id} = live/offline, follows, KICKs.
  const channels = [`chatrooms.${chatroomId}.v2`, `chatroom_${chatroomId}`, `chatrooms.${chatroomId}`,
    ...(/^\d+$/.test(channelId || '') ? [`channel.${channelId}`] : [])];
  const ids = new Map(), relay = new Map();
  let ws = null, retry = null, attempt = 0, last = 0, timeout = 120, stopped = false, failing = false;
  const send = (event, data = {}) => { try { ws?.send(JSON.stringify({ event, data })); } catch { /* reconnect handles it */ } };
  const parse = d => { if (typeof d !== 'string') return d; try { return JSON.parse(d); } catch { return null; } };
  // Never mask needs_reconnect/disabled (set by the token manager) with our transport status.
  const status = (s, msg) => { if (!['needs_reconnect', 'disabled'].includes(ctx.accounts.get(account.id)?.status)) ctx.accounts.setStatus(account.id, s, msg); };
  const fail = msg => { if (!failing) { failing = true; status('error', msg); } };

  function drop() {
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch { /* already closed */ }
    ws = null;
  }
  function reconnect(delay) {
    drop();
    if (stopped) return;
    clearTimeout(retry);
    if (++attempt >= 4) fail(ctx.t('Chat Kick (non officiel) injoignable, nouvelle tentative…', 'Kick chat (unofficial) unreachable, retrying…'));
    retry = setTimeout(open, delay ?? Math.min(60_000, 1000 * 2 ** attempt) + Math.random() * 1000);
  }
  function onFrame(text) {
    let f;
    try { f = JSON.parse(text); } catch { return; }
    const data = parse(f?.data);
    if (f?.event === 'pusher:connection_established') {
      timeout = Number(data?.activity_timeout) || 120;
      attempt = 0;
      for (const channel of channels) send('pusher:subscribe', { auth: '', channel });
      if (failing) { failing = false; status('ok'); }
    } else if (f?.event === 'pusher:ping') send('pusher:pong');
    else if (typeof f?.event === 'string' && !f.event.startsWith('pusher') && data && typeof data === 'object') {
      // Chat: once per id. Other events have no id (RewardRedeemedEvent, SubscriptionEvent), so an identical
      // payload is a real repeat (same viewer, same reward) unless it just came in on ANOTHER of our channels.
      if (f.event.endsWith('ChatMessageEvent') && data.id) {
        if (!once(ids, `chat:${data.id}`, 2000)) return;
      } else {
        const k = `${f.event}:${typeof f.data === 'string' ? f.data : JSON.stringify(f.data)}`;
        const p = relay.get(k), now = Date.now();
        relay.set(k, { ch: f.channel, at: now });
        if (relay.size > 500) relay.delete(relay.keys().next().value);
        if (p && p.ch !== f.channel && now - p.at < 5000) return;
      }
      try { onPusher(ctx, account, f.event, data); } catch (err) { ctx.log.warn(`[kick] ${account.login}: bad ${f.event}: ${err.message}`); }
    }
  }
  function open() {
    last = Date.now();
    try { ws = new WebSocket(PUSHER); } catch { return reconnect(); }
    ws.onmessage = e => { last = Date.now(); onFrame(String(e.data)); };
    ws.onerror = () => {}; // a close event follows
    ws.onclose = e => {
      // Pusher 4000–4099: do not retry unchanged (e.g. app key rejected) → slow retry + visible error.
      if (e?.code >= 4000 && e.code < 4100) {
        fail(ctx.t(`Kick a refusé le socket de chat non officiel (code ${e.code}). Mets Tramevia Dock à jour ou passe en mode webhook.`,
          `Kick rejected the unofficial chat socket (code ${e.code}). Update Tramevia Dock or switch to webhook mode.`));
        return reconnect(300_000);
      }
      reconnect(e?.code >= 4200 && e.code < 4300 ? 1000 : undefined);
    };
  }
  const watchdog = setInterval(() => {
    if (!ws) return;
    const idle = Date.now() - last;
    if (idle > (timeout + 30) * 1000) reconnect(0);
    else if (idle > timeout * 1000 && ws.readyState === 1) send('pusher:ping');
  }, 15_000);
  watchdog.unref?.();
  open();
  return { stop() { stopped = true; clearInterval(watchdog); clearTimeout(retry); drop(); } };
}

// --- Adapter ----------------------------------------------------------------------------------------------
export default {
  id: 'kick',
  name: 'Kick',
  color: '#53FC18',
  auth: 'oauth',
  app: { consoleUrl: 'https://kick.com/settings/developer', docsUrl: 'https://docs.kick.com/getting-started/kick-apps-setup', localhost: true },

  capabilities(account, ctx) {
    const mode = chatMode(account, ctx);
    const chat = mode !== 'off';
    return {
      chatRead: chat, chatSend: true, reply: true, deleteMessage: true, timeout: true, ban: true, unban: true,
      chatters: false, activeChatters: chat, viewers: true, events: chat, editInfo: true, categorySearch: true,
      unofficial: mode === 'pusher', needsPublicUrl: mode === 'webhook',
      // docs.kick.com: chat content ≤ 500; ban duration 1–10080 minutes (whole minutes, so no 10 s preset).
      limits: { chatMaxLength: 500, timeoutMin: 60, timeoutMax: 604800 },
    };
  },

  infoFields: {
    title: { max: 140 },            // ponytail: Kick documents only minLength 1; 140 is a UX guess (verify live)
    category: { search: true },
    // No `tags`: Kick only displays its default tags now; custom tags can no longer be changed.
  },

  // Per-account options for the dashboard (PATCH /api/accounts/:id {options}).
  notes: {
    webhookPath: '/webhooks/kick',
    options: {
      chatMode: { values: MODES, default: 'auto' },
      chatroomId: { pattern: '^\\d{1,12}$' },
      channelId: { pattern: '^\\d{1,12}$' },
    },
    fr: {
      auto: 'Auto : webhooks officiels si l’installation est publique en HTTPS, sinon socket non officiel.',
      webhook: 'Webhooks officiels : URL publique HTTPS requise, à coller dans « Enable Webhooks » de ton app Kick.',
      pusher: 'Socket non officiel (lecture seule) : marche en local, peut casser sans préavis.',
      off: 'Chat Kick désactivé (titre, catégorie, envoi et modération restent disponibles).',
      chatroomId: 'ID du salon de chat (si la détection automatique est bloquée).',
      channelId: 'ID de la chaîne (« id » sur la même page) : sans lui, live/hors ligne, follows et KICKs n’arrivent pas.',
    },
    en: {
      auto: 'Auto: official webhooks on a public HTTPS install, otherwise the unofficial socket.',
      webhook: 'Official webhooks: needs a public HTTPS URL, pasted into "Enable Webhooks" in your Kick app.',
      pusher: 'Unofficial socket (read-only): works locally, may break without notice.',
      off: 'Kick chat disabled (title, category, sending and moderation still work).',
      chatroomId: 'Chat room ID (when automatic lookup is blocked).',
      channelId: 'Channel ID ("id" on the same page): without it, live/offline, follows and KICKs are not received.',
    },
  },

  async testApp(ctx, app) {
    await oauthToken(ctx, app, { grant_type: 'client_credentials' });
    return { ok: true, message: ctx.t('Identifiants Kick valides.', 'Kick credentials are valid.') };
  },

  authorize(ctx, { state, redirectUri, app, pkce }) {
    const params = new URLSearchParams({ response_type: 'code', client_id: app.clientId });
    // id.kick.com rewrites the first "127.0.0.1" in the URL: documented workaround = a sacrificial param first.
    if (redirectUri.includes('127.0.0.1')) params.set('redirect', '127.0.0.1');
    params.set('redirect_uri', redirectUri);
    params.set('scope', SCOPES);
    params.set('state', state);
    params.set('code_challenge', pkce.challenge);
    params.set('code_challenge_method', 'S256');
    return { url: `${ID}/oauth/authorize?${params}`, pending: { verifier: pkce.verifier } };
  },

  async callback(ctx, { code, redirectUri, app, pending }) {
    if (!pending?.verifier) throw new Error(ctx.t('Vérificateur PKCE manquant, relance la connexion.', 'Missing PKCE verifier, start the login again.'));
    const r = await oauthToken(ctx, app, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: pending.verifier });
    const get = path => ctx.request(API + path, { platform: 'kick', token: r.access_token });
    const [users, channels] = await Promise.all([get('/users'), get('/channels')]);
    const user = users?.data?.[0];
    const ch = channels?.data?.[0];
    const id = user?.user_id ?? ch?.broadcaster_user_id;
    if (id == null || !ch?.slug) throw new Error(ctx.t('Kick n’a pas renvoyé le compte connecté.', 'Kick did not return the connected account.'));
    return {
      platformUserId: String(id), login: String(ch.slug), displayName: String(user?.name || ch.slug), avatar: https(user?.profile_picture),
      scopes: String(r.scope || '').split(' ').filter(Boolean),
      tokens: { access: r.access_token, refresh: r.refresh_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 },
    };
  },

  async refresh(ctx, account, tokens) {
    const app = ctx.app('kick');
    if (!app) throw new Error(ctx.t('App Kick non configurée.', 'Kick app not configured.'));
    const form = { grant_type: 'refresh_token', refresh_token: tokens.refresh };
    let r;
    try { r = await oauthToken(ctx, app, form); } catch {
      // Kick refreshes fail intermittently (#359) and refresh tokens are reusable: retry once.
      await new Promise(done => setTimeout(done, 1000));
      r = await oauthToken(ctx, app, form);
    }
    return { access: r.access_token, refresh: r.refresh_token || tokens.refresh, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
  },

  async revoke(ctx, account, tokens) {
    // Best effort, while the token still works. Only the webhook target may delete the app's subscriptions
    // (same rule as connect(): a local install must not wipe those of a cloud install sharing the Kick app).
    if (chatMode(account, ctx) === 'webhook') await unsubscribe(ctx, account).catch(err => ctx.log.warn(`[kick] ${account.login}: webhook unsubscribe failed (${err.message})`));
    await Promise.allSettled([['refresh_token', tokens?.refresh], ['access_token', tokens?.access]].filter(([, t]) => t).map(([hint, token]) =>
      ctx.request(`${ID}/oauth/revoke?${new URLSearchParams({ token, token_hint_type: hint })}`, { platform: 'kick', method: 'POST', form: {} })));
  },

  async connect(ctx, account) {
    const mode = chatMode(account, ctx);
    // Only a public HTTPS install can be the app's webhook target: a local install must not delete the
    // subscriptions of a cloud install sharing the same Kick app.
    if (mode !== 'webhook' && ctx.config.secure) unsubscribe(ctx, account).catch(() => {});
    if (mode === 'off') return { stop() {} };
    Promise.resolve(ctx.emotes?.load('kick', account.platformUserId)).catch(() => {});
    let handle;
    if (mode === 'webhook') {
      publicKey(ctx).catch(() => {});
      await ensureSubscriptions(ctx, account);
      // Kick drops subscriptions after a day of failed deliveries: re-check hourly, not only at connect.
      const timer = setInterval(() => ensureSubscriptions(ctx, account).catch(err => ctx.log.warn(`[kick] ${account.login}: ${err.message}`)), 3600_000);
      timer.unref?.();
      handle = { stop: () => clearInterval(timer) };
    } else {
      handle = pusher(ctx, account, await chatroom(ctx, account));
    }
    if (account.status === 'error') ctx.accounts.setStatus(account.id, 'ok'); // recovered after a failed attempt
    return handle;
  },

  routes(router, ctx) {
    router.post('/webhooks/kick', async ({ req, res, body }) => {
      res.writeHead(await handleWebhook(ctx, req.headers, body)).end();
    }, { access: 'public', raw: true, csrf: false });
  },

  async stats(ctx, account) {
    const c = await channel(ctx, account);
    const s = c.stream || {};
    const live = Boolean(s.is_live);
    return {
      live, viewers: live ? Number(s.viewer_count) || 0 : 0, startedAt: live ? Date.parse(s.start_time) || null : null,
      title: String(c.stream_title || ''), category: String(c.category?.name || ''), subscribers: c.active_subscribers_count ?? null,
    };
  },

  async getInfo(ctx, account) {
    const c = await channel(ctx, account);
    return {
      title: String(c.stream_title || ''),
      category: c.category?.id ? category(c.category) : null,
    };
  },

  async setInfo(ctx, account, changes) {
    const json = infoPatch(ctx, changes);
    if (Object.keys(json).length) await call(ctx, account, '/channels', { method: 'PATCH', json });
  },

  async searchCategories(ctx, account, query) {
    const q = String(query || '').trim().slice(0, 100);
    let rows = [];
    if (q.length >= 3) {
      // v2 (name ≥ 3 chars, comma = list separator); v1 ?q= is deprecated but kept as fallback.
      rows = await call(ctx, account, `https://api.kick.com/public/v2/categories?${new URLSearchParams({ name: q.replace(/,/g, ' '), limit: '20' })}`)
        .then(r => r?.data || [], err => { if (err?.status === 401) throw err; return []; });
    }
    if (!rows.length && q) rows = (await call(ctx, account, `/categories?${new URLSearchParams({ q })}`))?.data || [];
    return rows.slice(0, 20).map(category);
  },

  async send(ctx, account, { text, replyTo }) {
    const reply = typeof replyTo === 'object' ? replyTo?.messageId : replyTo;
    const json = { type: 'user', broadcaster_user_id: Number(account.platformUserId), content: String(text) };
    if (reply) json.reply_to_message_id = String(reply);
    try {
      const r = (await call(ctx, account, '/chat', { method: 'POST', json }))?.data;
      return r?.is_sent === false ? { ok: false, error: ctx.t('Message refusé par Kick.', 'Message rejected by Kick.') } : { ok: true, id: r?.message_id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async moderate(ctx, account, { action, messageId, userId, duration, reason }) {
    if (action === 'delete') {
      if (!messageId) throw new Error(ctx.t('Message manquant.', 'Missing message.'));
      await call(ctx, account, `/chat/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
      ctx.emitDelete({ accountId: account.id, messageId: String(messageId) }); // Kick sends no official delete event
      return { ok: true };
    }
    if (!/^\d{1,20}$/.test(String(userId ?? ''))) throw new Error(ctx.t('Utilisateur Kick invalide.', 'Invalid Kick user.'));
    const json = { broadcaster_user_id: Number(account.platformUserId), user_id: Number(userId) };
    if (action === 'unban') {
      await call(ctx, account, '/moderation/bans', { method: 'DELETE', json });
      return { ok: true };
    }
    if (action !== 'ban' && action !== 'timeout') throw new Error(ctx.t(`Action non prise en charge : ${action}`, `Unsupported action: ${action}`));
    if (action === 'timeout') json.duration = timeoutMinutes(duration);
    if (reason) json.reason = String(reason).slice(0, 100);
    await call(ctx, account, '/moderation/bans', { method: 'POST', json });
    ctx.emitDelete({ accountId: account.id, userId: String(userId) });
    return { ok: true };
  },
};
