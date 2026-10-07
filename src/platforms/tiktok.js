// TikTok LIVE adapter (read-only, unofficial) — SPEC.md §4.
// TikTok has no public LIVE API: chat and events come from the reverse-engineered Webcast feed through
// tiktok-live-connector (AGPL-3.0), whose WebSocket URL is signed by Euler Stream (free tier ≈ 2,500
// requests/day; optional key in TIKTOK_SIGN_API_KEY). Budget: one cheap live check every 2 min while offline
// (TikTok page first, Euler only as the library's last fallback), the WebSocket only while live (1 sign
// request per connect), capped backoff on drops. Nothing is ever sent as the user.
import { randomId } from '../crypto.js';
import { HttpError } from '../http.js';

const CHECK_EVERY = 120_000; // live check while offline
const MAX_BACKOFF = 300_000; // reconnect cap
const LIKE_EVERY = 30_000;   // like aggregation window
const OFFLINE = { live: false, viewers: 0, startedAt: null, title: '', category: '', likes: 0 };
const states = new Map();    // accountId -> last known stats (written by connect(), read by stats())

/** Test seam: loaded lazily so a broken install only fails TikTok accounts, not the adapter metadata. */
export const deps = { load: () => import('tiktok-live-connector') };

const english = (fr, en) => en;
const httpUrl = s => (typeof s === 'string' && /^https?:\/\//i.test(s) ? s : '');
const img = m => httpUrl(m?.urlList?.[0]);
const backoff = n => Math.min(MAX_BACKOFF, 5_000 * 2 ** n);

/** "@Name" → "Name"; HttpError 400 for anything that is not a TikTok username. `t` = ctx.t (dashboard language). */
export function cleanUsername(input, t = english) {
  const name = String(input ?? '').trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9._]{2,24}$/.test(name)) {
    throw new HttpError(400, t(
      'Nom d’utilisateur TikTok invalide (2 à 24 caractères : lettres, chiffres, « . » et « _ »).',
      'Invalid TikTok username (2–24 characters: letters, digits, "." and "_").'), 'invalid_username');
  }
  return name;
}

/** Webcast User (tiktok-live-proto v3) → {id, login, name, avatar} or null. id = numeric user id, else the @handle. */
export function who(u) {
  if (!u) return null;
  const login = u.displayId || '';
  const id = [u.idStr, u.id].find(v => v && v !== '0') || login;
  return { id: String(id), login, name: u.nickname || login, avatar: img(u.avatarThumb) };
}

// Emotes (Super Fan stickers) carry their insertion offset in the comment text.
function fragments(text, emotes) {
  const out = [];
  let pos = 0;
  for (const { index = 0, emote } of [...emotes].sort((a, b) => (a.index || 0) - (b.index || 0))) {
    const url = img(emote?.image);
    if (!url) continue;
    const at = Math.min(Math.max(index, pos), text.length);
    if (at > pos) out.push({ t: 'text', v: text.slice(pos, at) });
    out.push({ t: 'emote', name: 'emote', url });
    pos = at;
  }
  if (pos < text.length) out.push({ t: 'text', v: text.slice(pos) });
  return out;
}

/** WebcastChatMessage → SPEC §5 chat message (null when empty). `top` = user ids of the current top gifters. */
export function toChat(ctx, account, data, top = new Set()) {
  const u = data.user || {};
  const author = who(u);
  const text = data.content || '';
  const frags = fragments(text, data.emotes || []);
  if (!frags.length) return null;
  const self = Boolean(author.login) && author.login.toLowerCase() === account.login.toLowerCase();
  const ident = data.userIdentity || {};
  const roles = [
    (ident.isAnchor || self) && 'broadcaster',
    (ident.isModeratorOfAnchor || u.userAttr?.isAdmin) && 'moderator',
    top.has(author.id) && 'vip', // TikTok "top gifter" of this LIVE
    ident.isSubscriberOfAnchor && 'subscriber',
    u.verified && 'verified',
  ].filter(Boolean);
  const badges = (u.badgeList || [])
    .map(b => ({ id: b.privilegeLogExtra?.privilegeId || 'badge', title: b.combine?.str || '', url: img(b.image?.image) || img(b.combine?.icon) }))
    .filter(b => b.url).slice(0, 3);
  const msgId = data.common?.msgId;
  return {
    id: msgId && msgId !== '0' ? String(msgId) : randomId(8), platform: 'tiktok', accountId: account.id,
    channel: account.login, ts: Date.now(),
    author: { ...author, color: '', badges, roles },
    text, tokens: ctx.tokenize({ platform: 'tiktok', channelId: account.platformUserId, fragments: frags }),
    reply: null, flags: { action: false, highlight: false, self }, deleted: false,
  };
}

/** WebcastGiftMessage → 'gift' event fields (amount in diamonds), or null while a streak is running (gift type 1 until repeatEnd). */
export function giftEvent(data) {
  const g = data.gift || {};
  if (g.type === 1 && !data.repeatEnd) return null;
  const count = data.repeatCount || 1;
  return {
    type: 'gift', user: who(data.user), label: g.name || `#${data.giftId}`, count,
    amount: (g.diamondCount || 0) * count, unit: 'diamonds', image: img(g.image) || undefined,
  };
}

/** Sums likes and calls emit(count, user) at most once per `every` ms (user = null when several people liked). */
export function likeBatcher(emit, every = LIKE_EVERY, now = () => Date.now()) {
  let count = 0, user, last = -Infinity, timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (!count) return;
    emit(count, user || null);
    count = 0;
    user = undefined;
    last = now();
  };
  return {
    add(n, u) {
      count += n;
      user = user === undefined || user?.id === u?.id ? u : null;
      const wait = last + every - now();
      if (wait <= 0) flush();
      else timer ??= setTimeout(flush, wait);
    },
    stop() { clearTimeout(timer); timer = null; },
  };
}

export default {
  id: 'tiktok',
  name: 'TikTok',
  color: '#FE2C55',
  auth: 'username',
  app: null,
  notes: { unofficial: true },
  capabilities: {
    chatRead: true, chatSend: false, deleteMessage: false, timeout: false, ban: false,
    chatters: false, activeChatters: true, viewers: true, events: true, editInfo: false, unofficial: true,
    limits: {}, // read-only: no chat length or timeout range
  },
  infoFields: {},

  async resolveUsername(ctx, username) {
    const login = cleanUsername(username, ctx.t);
    return { platformUserId: login.toLowerCase(), login, displayName: login, avatar: '', scopes: [], tokens: null };
  },

  async connect(ctx, account) {
    const lib = await deps.load();
    const key = process.env.TIKTOK_SIGN_API_KEY || undefined;
    // processInitialData off: the sign response replays recent chat, which would duplicate it on every reconnect.
    const conn = new lib.TikTokLiveConnection(account.platformUserId, { signApiKey: key, processInitialData: false });
    const st = states.get(account.id) || { ...OFFLINE };
    states.set(account.id, st);
    let stopped = false, timer = null, failures = 0, checkFails = 0, ended = false, top = new Set(), openedAt = 0;

    const safe = err => {
      const m = String(err?.message || err).slice(0, 300);
      return key ? m.split(key).join('***') : m;
    };
    // No local de-dup: the manager only publishes changes, and a cache seeded at connect() hides errors after it resets the status.
    const setStatus = (s, msg = '') => ctx.accounts.setStatus(account.id, s, msg);
    const update = patch => {
      if (Object.entries(patch).every(([k, v]) => st[k] === v)) return;
      Object.assign(st, patch);
      ctx.accounts.pushStats(account, patch);
    };
    const later = (fn, ms) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(fn, ms);
    };
    const event = fields => ctx.emitEvent({
      id: randomId(8), platform: 'tiktok', accountId: account.id, channel: account.login, ts: Date.now(), ...fields,
    });
    const likes = likeBatcher((count, user) => event({ type: 'like', user, count }));
    const offline = { live: false, viewers: 0, startedAt: null, likes: 0 };

    async function check() {
      try {
        const live = await conn.fetchIsLive();
        if (stopped) return;
        checkFails = 0;
        setStatus('ok');
        if (live) return open();
        update(offline);
      } catch (err) {
        if (stopped) return;
        checkFails++; // every source failed (each try may cost an Euler request): slow down to 10 min max
        const notFound = (err?.config?.requestErrs || []).some(e => /user_not_found/.test(e?.message));
        setStatus('error', notFound
          ? ctx.t(`Compte TikTok @${account.login} introuvable : vérifie le nom d’utilisateur`, `TikTok account @${account.login} not found: check the username`)
          : ctx.t('Impossible de vérifier si le LIVE TikTok est en cours', 'Could not check whether the TikTok LIVE is on') + ` (${safe(err)})`);
      }
      later(check, Math.min(CHECK_EVERY * 2 ** checkFails, 600_000));
    }

    async function open() {
      try {
        await conn.connect();
        if (stopped) return conn.disconnect().catch(() => {});
        openedAt = Date.now(); // failures reset only once the socket has stayed up (see 'disconnected')
        ended = false;
        const room = conn.roomInfo?.data || {};
        setStatus('ok');
        update({ live: true, viewers: Number(room.user_count) || 0, startedAt: Number(room.create_time) * 1000 || null, title: room.title || '' });
        ctx.log.info(`[tiktok] ${account.login}: LIVE, chat connected`);
      } catch (err) {
        if (stopped) return;
        if (err instanceof lib.UserOfflineError) {
          update(offline);
          return later(check, CHECK_EVERY);
        }
        const limited = err instanceof lib.SignatureRateLimitError;
        const wait = limited ? Math.min(Math.max(err.retryAfter || 0, MAX_BACKOFF), 3_600_000) : backoff(++failures);
        setStatus('error', limited
          ? ctx.t('Quota du serveur de signature Euler Stream atteint (gratuit : ~2 500 requêtes/jour)', 'Euler Stream sign server quota reached (free tier: ~2,500 requests/day)')
          : ctx.t('Connexion au chat TikTok impossible', 'Could not connect to TikTok chat') + ` (${safe(err)})`);
        ctx.log.warn(`[tiktok] ${account.login}: connection failed (${safe(err)}); retry in ${Math.round(wait / 1000)}s`);
        later(open, wait);
      }
    }

    // Event names are the library's WebcastEvent / ControlEvent string values.
    const on = (name, fn) => conn.on(name, data => {
      try { fn(data || {}); } catch (err) { ctx.log.warn(`[tiktok] ${name} event skipped: ${safe(err)}`); }
    });
    on('chat', d => { const m = toChat(ctx, account, d, top); if (m) ctx.emitChat(m); });
    on('emote', d => {
      const m = toChat(ctx, account, { ...d, content: '', emotes: (d.emoteList || []).map(emote => ({ index: 0, emote })) }, top);
      if (m) ctx.emitChat(m);
    });
    on('gift', d => { const e = giftEvent(d); if (e) event(e); });
    on('follow', d => event({ type: 'follow', user: who(d.user) }));
    on('share', d => event({ type: 'share', user: who(d.user) }));
    on('subNotify', d => event({ type: 'sub', user: who(d.user), months: Number(d.subMonth) || undefined }));
    on('superFan', d => event({ type: 'sub', user: who(d.user), label: 'Super Fan' }));
    on('like', d => {
      st.likes = Number(d.total) || st.likes; // room total, reported with the next stats poll
      likes.add(d.count || 1, who(d.user));
    });
    on('roomUser', d => {
      top = new Set((d.ranks || []).map(r => who(r.user)?.id).filter(Boolean));
      update({ live: true, viewers: Number(d.total) || 0 });
    });
    on('imDelete', d => {
      for (const messageId of d.deleteMsgIds || []) ctx.emitDelete({ accountId: account.id, messageId: String(messageId) });
      for (const userId of d.deleteUserIds || []) ctx.emitDelete({ accountId: account.id, userId: String(userId) });
    });
    on('streamEnd', () => {
      ended = true;
      update(offline);
    });
    on('disconnected', () => {
      if (stopped) return;
      // Each reconnect costs an Euler sign request: a socket that drops within a minute keeps backing off (10 s → 5 min).
      if (Date.now() - openedAt > 60_000) failures = 0;
      if (ended) { ended = false; return later(check, CHECK_EVERY); } // stream over: back to waiting
      later(open, backoff(++failures));                                // dropped: reconnect
    });

    check();
    return {
      stop() {
        stopped = true;
        clearTimeout(timer);
        likes.stop();
        conn.removeAllListeners();
        conn.disconnect().catch(() => {});
      },
    };
  },

  statsInterval: 30_000,
  /** Last known state from the connect loop (which already does the 2-min live checks): no network here. */
  async stats(ctx, account) {
    return { ...OFFLINE, ...states.get(account.id) };
  },
};
