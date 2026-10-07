// YouTube Live adapter — SPEC.md §4. YouTube Data API v3 (Live Streaming): OAuth "Web application" client,
// chat via liveChatMessages.streamList (chunked JSON array over HTTPS) with list polling as fallback,
// a local quota meter (10 000 units/day per Google Cloud project, reset at midnight Pacific time).
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError } from '../net.js';

const API = 'https://youtube.googleapis.com/youtube/v3';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPE = 'https://www.googleapis.com/auth/youtube';
const PARTS = 'id,snippet,authorDetails';
// chatMaxLength: YouTube's chat box limit (not in the API docs). banDurationSeconds: the docs only give the default
// (300 s), no range; 86 400 s (24 h) is the longest timeout YouTube offers — verify live before raising it.
const LIMITS = { chatMaxLength: 200, timeoutMin: 1, timeoutMax: 86_400 };

/**
 * Quota units per call (https://developers.google.com/youtube/v3/determine_quota_cost, table of 2026-09-15). Edit freely:
 * liveChatMessages.list is listed at 1 unit but older docs say 5; streamList is undocumented (counted 1 per connection).
 */
export const COST = { list: 1, stream: 1, write: 50, search: 100 };
export const QUOTA_LIMIT = 10_000;
const QUOTA_GUARD = 0.95; // writes are refused beyond 95 % of the daily limit

/**
 * Live-state refresh cadence. stats() (every ~50 s: statsInterval + the 10 s accounts tick) and run() (every 45 s)
 * share one cache and only refresh it when it is older than maxAge(), so the cost per channel is 1 unit per refresh:
 * - idle (offline, nothing else live, no recent activity): liveBroadcasts.list every ~5 min ≈ 290 units/day (was ≈ 1 730);
 * - awake (2 h after connect/restart, the last live or stream-manager use, or while another account is live):
 *   every ~45–50 s ≈ 80 units/hour;
 * - live: videos.list only (viewers + end detection) every ~45–50 s ≈ 80 units/hour.
 * Typical 24/7 day with one 4 h stream: 16 h idle ≈ 190 + 4 h awake ≈ 320 + 4 h live ≈ 320 → ≈ 830 units (was ≈ 2 000).
 * ponytail: go-live with no other signal is seen within ~5 min; poll near an upcoming scheduledStartTime if users need faster.
 */
const FAST = 45_000;
const SLOW = 300_000;
const AWAKE = 2 * 3600_000;

const lives = new Map();         // accountId -> { at, data, pending } live-state cache shared by stats(), run() and actions
const awake = new Map();         // accountId -> ms of the last sign the channel may go live (see maxAge)
const seen = new Map();          // accountId -> Set of message keys (dedupes history replayed on reconnect)
const historyCutoff = new Map(); // accountId -> ms of the first connect() in this process (older paid events = history)
const categoryCache = new Map(); // hl -> { at, list }

// ------------------------------------------------------------------ pure helpers (exported for tests)
/** Quota day (YYYY-MM-DD) in America/Los_Angeles, the timezone YouTube resets quotas in. */
export const quotaDay = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(now);

/**
 * Incremental parser for a streamed JSON array `[{…},{…}…]` (streamList REST framing). Feed it decoded text chunks
 * split anywhere; it calls onItem(object) for each complete top-level object. A bare `{…}` (error body) works too.
 */
export function jsonArrayStream(onItem) {
  let buf = '', depth = 0, inStr = false, esc = false;
  return chunk => {
    for (const c of chunk) {
      if (depth === 0) { if (c === '{') { depth = 1; buf = c; } continue; } // skip `[`, `,`, `]`, whitespace
      buf += c;
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) onItem(JSON.parse(buf));
    }
  };
}

const https = url => (typeof url === 'string' && url.startsWith('https://') ? url : '');
const clean = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const qs = obj => new URLSearchParams(clean(obj)).toString();
const english = (fr, en) => en;

function author(a) {
  const name = a.displayName || '';
  return {
    id: a.channelId || '', login: name.replace(/^@/, ''), name, color: '', avatar: https(a.profileImageUrl), badges: [],
    roles: [a.isChatOwner && 'broadcaster', a.isChatModerator && 'moderator', a.isChatSponsor && 'member', a.isVerified && 'verified'].filter(Boolean),
  };
}

/**
 * liveChatMessage → { chat } | { event } | { delete } | null (ignored types: polls, tombstones, gift recipients,
 * members-only mode, chat end — the reader handles chatEndedEvent itself).
 */
export function normalizeMessage(m, account, tokenize = ({ fragments }) => fragments) {
  const s = m.snippet || {};
  const a = m.authorDetails || {};
  const tokens = v => tokenize({ platform: 'youtube', channelId: account.platformUserId, fragments: [{ t: 'text', v }] });
  const base = { id: m.id, platform: 'youtube', accountId: account.id, channel: account.login, ts: Date.parse(s.publishedAt) || Date.now() };
  const event = (type, extra, text) => ({
    event: { ...base, type, user: { id: a.channelId || s.authorChannelId || '', name: a.displayName || '', avatar: https(a.profileImageUrl) }, ...extra, ...(text ? { text, tokens: tokens(text) } : {}) },
  });
  const money = d => ({ amount: Number(d.amountMicros || 0) / 1e6, currency: d.currency || '' });
  const del = d => (Object.values(d).some(Boolean) ? { delete: { accountId: account.id, ...d } } : null);
  switch (s.type) {
    case 'textMessageEvent': {
      const text = s.textMessageDetails?.messageText ?? s.displayMessage ?? '';
      return { chat: { ...base, author: author(a), text, tokens: tokens(text), reply: null,
        flags: { action: false, highlight: false, self: Boolean(a.channelId) && a.channelId === account.platformUserId }, deleted: false } };
    }
    case 'superChatEvent': { const d = s.superChatDetails || {}; return event('superchat', money(d), d.userComment); }
    case 'superStickerEvent': { const d = s.superStickerDetails || {}; return event('supersticker', { ...money(d), label: d.superStickerMetadata?.altText || '' }); }
    case 'newSponsorEvent': return event('membership', { label: s.newSponsorDetails?.memberLevelName || '' });
    case 'memberMilestoneChatEvent': {
      const d = s.memberMilestoneChatDetails || {};
      return event('membership', { label: d.memberLevelName || '', months: d.memberMonth || 0 }, d.userComment);
    }
    case 'membershipGiftingEvent': {
      const d = s.membershipGiftingDetails || {};
      return event('giftmembership', { count: d.giftMembershipsCount || 1, label: d.giftMembershipsLevelName || '' });
    }
    // Jewels gifts: the same id is re-sent as comboCount grows (0 = no combo) — consumers upsert events by id.
    // ponytail: jewelsAmount read as the price of one gift ("amount of Jewels redeemed for the gift"), so the total is
    // × count like TikTok diamonds; verify live on a combo.
    case 'giftEvent': {
      const d = s.giftEventDetails?.giftMetadata || {};
      const count = d.comboCount || 1;
      return event('gift', { label: d.giftName || d.altText || '', count, amount: (Number(d.jewelsAmount) || 0) * count, unit: 'jewels', ...(https(d.giftUrl) && { image: d.giftUrl }) });
    }
    case 'messageDeletedEvent': return del({ messageId: s.messageDeletedDetails?.deletedMessageId });
    case 'messageRetractedEvent': return del({ messageId: s.messageRetractedDetails?.retractedMessageId });
    case 'userBannedEvent': return del({ userId: s.userBannedDetails?.bannedUserDetails?.channelId });
    default: return null;
  }
}

// Same rule as src/stream-info.js: commas count, a tag with a space counts its quotes.
const tagsLength = tags => tags.reduce((n, t) => n + [...t].length + (t.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1);

/** Read-modify-write: the current video snippet with only the provided StreamInfo keys changed (videos.update wipes omitted fields). */
export function applyInfo(current, changes, t = english) {
  const next = { title: current.title, description: current.description, tags: current.tags, categoryId: current.categoryId, defaultLanguage: current.defaultLanguage };
  if (changes.title !== undefined) next.title = String(changes.title).trim();
  if (changes.description !== undefined) next.description = String(changes.description);
  if (changes.tags !== undefined) next.tags = (Array.isArray(changes.tags) ? changes.tags : []).map(x => String(x).trim()).filter(Boolean);
  if (changes.ytCategoryId !== undefined) next.categoryId = String(changes.ytCategoryId);
  const errors = [];
  if (!next.title || [...next.title].length > 100 || /[<>]/.test(next.title)) errors.push(t('Titre : 1 à 100 caractères, sans < ni >.', 'Title: 1–100 characters, no < or >.'));
  if (next.description && (Buffer.byteLength(next.description) > 5000 || /[<>]/.test(next.description))) errors.push(t('Description : 5000 octets maximum, sans < ni >.', 'Description: max 5000 bytes, no < or >.'));
  if (next.tags && tagsLength(next.tags) > 500) errors.push(t('Tags : 500 caractères au total maximum.', 'Tags: 500 characters in total at most.'));
  if (!/^\d{1,4}$/.test(next.categoryId || '')) errors.push(t('Une catégorie YouTube est obligatoire.', 'A YouTube category is required.'));
  if (errors.length) throw fail(errors.join(' '));
  return clean(next);
}

/** OAuth error code from the token endpoint → testApp result (ok) or a readable message. */
export function testAppResult(code, redirectUri, t = english) {
  if (code === 'invalid_grant') return { ok: true, message: t('Client ID et secret acceptés par Google.', 'Client ID and secret accepted by Google.') };
  if (code === 'invalid_client') return { ok: false, message: t('Google refuse le Client ID ou le Client Secret (invalid_client). Recopie-les tous les deux depuis Google Cloud → Clients.', 'Google rejected the Client ID or Client Secret (invalid_client). Copy both again from Google Cloud → Clients.') };
  if (code === 'deleted_client') {
    return { ok: false, message: t('Ce client OAuth a été supprimé dans Google Cloud (deleted_client), par exemple après 6 mois sans utilisation. Restaure-le dans Google Cloud → Clients → Clients supprimés (possible pendant 30 jours) ou crée un nouveau client « Application Web ».',
      'This OAuth client was deleted in Google Cloud (deleted_client), for example after 6 months unused. Restore it from Google Cloud → Clients → Deleted clients (possible for 30 days) or create a new "Web application" client.') };
  }
  if (code === 'unauthorized_client') return { ok: false, message: t('Ce client OAuth ne peut pas être utilisé ici (unauthorized_client) : crée un client de type « Application Web ».', 'This OAuth client cannot be used here (unauthorized_client): create a client of type "Web application".') };
  if (code === 'redirect_uri_mismatch') return { ok: false, message: t(`Ajoute exactement cette URI de redirection autorisée au client OAuth dans Google Cloud : ${redirectUri}`, `Add this exact authorized redirect URI to the OAuth client in Google Cloud: ${redirectUri}`) };
  return { ok: false, message: t(`Réponse de Google : ${code || 'erreur inconnue'}`, `Google answered: ${code || 'unknown error'}`) };
}

// ------------------------------------------------------------------ quota meter (shared by every account of the project)
function quota(ctx) {
  const day = quotaDay();
  const q = ctx.settings.get('youtube:quota');
  return { day, used: q?.day === day ? q.used : 0, limit: ctx.settings.get('youtube:quotaLimit', QUOTA_LIMIT) };
}
function spend(ctx, cost) {
  const q = quota(ctx);
  ctx.settings.set('youtube:quota', { day: q.day, used: q.used + cost });
}
function budget(ctx, cost) {
  const q = quota(ctx);
  if (q.used + cost > q.limit * QUOTA_GUARD) {
    throw fail(ctx.t(`Quota de l’API YouTube presque épuisé (${q.used}/${q.limit} unités aujourd’hui) : les actions sont en pause jusqu’à minuit, heure du Pacifique.`,
      `YouTube API quota almost used up (${q.used}/${q.limit} units today): actions are paused until midnight Pacific time.`), 429);
  }
}

// ------------------------------------------------------------------ API plumbing
function fail(message, status = 400) { return new ApiError('youtube', status, null, message); }

const reason = err => err?.body?.error?.errors?.[0]?.reason || '';
const EXHAUSTED = ['Quota quotidien de l’API YouTube épuisé : il repart à zéro à minuit, heure du Pacifique.', 'YouTube API daily quota exhausted: it resets at midnight Pacific time.'];
const MESSAGES = {
  quotaExceeded: EXHAUSTED,
  dailyLimitExceeded: EXHAUSTED,
  liveStreamingNotEnabled: ['Le direct n’est pas activé sur cette chaîne YouTube (active-le dans YouTube Studio).', 'Live streaming is not enabled on this YouTube channel (enable it in YouTube Studio).'],
  liveChatEnded: ['Le chat du direct YouTube est terminé.', 'The YouTube live chat has ended.'],
  liveChatDisabled: ['Le chat est désactivé sur ce direct YouTube.', 'Live chat is disabled on this YouTube broadcast.'],
  liveChatNotFound: ['Chat du direct YouTube introuvable (le direct est probablement terminé).', 'YouTube live chat not found (the stream is probably over).'],
  rateLimitExceeded: ['YouTube trouve que tu vas trop vite : attends un moment.', 'YouTube says you are going too fast: wait a moment.'],
  insufficientPermissions: ['Permission YouTube manquante : reconnecte le compte.', 'Missing YouTube permission: reconnect the account.'],
};
/**
 * Friendlier message for known API reasons; strips the HTML Google puts in some messages. Keeps status/body.
 * Google's own quota verdict wins over the local meter (other apps may share the project, streamList cost is a guess).
 */
function readable(ctx, err) {
  if (!(err instanceof ApiError)) return err;
  const why = reason(err);
  if (MESSAGES[why] === EXHAUSTED) {
    const q = quota(ctx);
    ctx.settings.set('youtube:quota', { day: q.day, used: Math.max(q.used, q.limit) });
  }
  err.message = MESSAGES[why] ? ctx.t(...MESSAGES[why]) : String(err.message).replace(/<[^>]*>/g, '');
  return err;
}

async function yt(ctx, token, path, { cost = COST.list, ...opts } = {}) {
  spend(ctx, cost); // failed calls cost quota too
  try { return await ctx.request(API + path, { platform: 'youtube', token, ...opts }); } catch (err) { throw readable(ctx, err); }
}
const api = (ctx, account, path, opts) => ctx.accounts.withToken(account, token => yt(ctx, token, path, opts));

const token = (ctx, app, form) => ctx.request(TOKEN_URL, { platform: 'youtube', method: 'POST', form: clean({ client_id: app.clientId, client_secret: app.clientSecret, ...form }) });
const tokenSet = (t, prev) => ({ access: t.access_token, refresh: t.refresh_token || prev?.refresh, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 });

// ------------------------------------------------------------------ live state
/** Active broadcast via liveBroadcasts.list + videos.list; once live, videos.list alone (1 unit) until it ends. */
async function fetchLive(ctx, account) {
  const prev = lives.get(account.id)?.data;
  let b = null;
  let id = prev?.live && prev.videoId;
  if (!id) {
    b = (await api(ctx, account, '/liveBroadcasts?' + qs({ part: 'id,snippet,status', broadcastStatus: 'active', broadcastType: 'all', maxResults: 5 }))).items?.[0];
    if (!b) return { live: false };
    id = b.id;
  }
  const v = (await api(ctx, account, '/videos?' + qs({ part: 'liveStreamingDetails,snippet', id }))).items?.[0];
  const d = v?.liveStreamingDetails || {};
  if (!b && (!v || d.actualEndTime || v.snippet?.liveBroadcastContent !== 'live')) return { live: false };
  awake.set(account.id, Date.now());
  return {
    live: true, videoId: id, liveChatId: d.activeLiveChatId || b?.snippet?.liveChatId || prev?.liveChatId || '',
    viewers: d.concurrentViewers == null ? null : Number(d.concurrentViewers), // absent when hidden by the owner
    startedAt: Date.parse(d.actualStartTime || b?.snippet?.actualStartTime) || prev?.startedAt || null,
    title: v?.snippet?.title || b?.snippet?.title || '', categoryId: v?.snippet?.categoryId || '',
  };
}

/** Cached live state (single flight). maxAge 0 = always refresh. */
function liveState(ctx, account, maxAge = 0) {
  const c = lives.get(account.id) || {};
  if (c.pending) return c.pending;
  if (c.data && Date.now() - c.at < maxAge) return Promise.resolve(c.data);
  c.pending = fetchLive(ctx, account).then(data => Object.assign(c, { at: Date.now(), data }).data).finally(() => { c.pending = null; });
  lives.set(account.id, c);
  return c.pending;
}

/** How old the cached live state may be: FAST while live, awake or while another account is live, SLOW otherwise. */
function maxAge(ctx, account) {
  if (lives.get(account.id)?.data?.live || Date.now() - (awake.get(account.id) || 0) < AWAKE) return FAST;
  return ctx.accounts.list().some(a => a.id !== account.id && ctx.accounts.stats(a.id)?.live) ? FAST : SLOW; // multistream: going live together
}

async function liveChatId(ctx, account) {
  const s = await liveState(ctx, account, 60_000);
  if (!s.liveChatId) throw fail(ctx.t('Pas de chat YouTube en direct pour le moment (aucun direct actif).', 'No YouTube live chat right now (no active broadcast).'), 409);
  return s.liveChatId;
}

/** Assignable video categories in the dashboard language (cached 24 h per language). */
async function categories(ctx, account) {
  const hl = ctx.t('fr', 'en');
  const hit = categoryCache.get(hl);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.list;
  const r = await api(ctx, account, '/videoCategories?' + qs({ part: 'snippet', regionCode: ctx.t('FR', 'US'), hl }));
  const list = (r.items || []).filter(c => c.snippet?.assignable).map(c => ({ id: c.id, title: c.snippet.title }));
  categoryCache.set(hl, { at: Date.now(), list });
  return list;
}

/** The live broadcast's video, else the upcoming one scheduled closest to now (broadcast id = video id). */
async function targetVideo(ctx, account) {
  awake.set(account.id, Date.now()); // the streamer is preparing a stream: watch for go-live closely
  const s = await liveState(ctx, account, 30_000);
  let id = s.live && s.videoId;
  if (!id) {
    const now = Date.now();
    const gap = b => Math.abs((Date.parse(b.snippet?.scheduledStartTime) || 0) - now);
    const items = (await api(ctx, account, '/liveBroadcasts?' + qs({ part: 'id,snippet', broadcastStatus: 'upcoming', broadcastType: 'all', maxResults: 50 }))).items || [];
    id = items.sort((x, y) => gap(x) - gap(y))[0]?.id;
  }
  const video = id && (await api(ctx, account, '/videos?' + qs({ part: 'snippet', id }))).items?.[0];
  if (!video) throw fail(ctx.t('Aucun direct en cours ou programmé sur YouTube : programmes-en un dans YouTube Studio d’abord.', 'No live or scheduled broadcast on YouTube — schedule one in YouTube Studio first.'), 404);
  return video;
}

// ------------------------------------------------------------------ realtime chat
function firstSeen(accountId, key) {
  let set = seen.get(accountId);
  if (!set) seen.set(accountId, set = new Set());
  if (set.has(key)) return false;
  set.add(key);
  if (set.size > 2000) set.delete(set.values().next().value);
  return true;
}

/** Process one LiveChatMessageListResponse. Paid events older than the first connect are history: not re-alerted. */
function handle(ctx, account, session, r) {
  if (r.nextPageToken) session.pageToken = r.nextPageToken;
  if (session.degraded) { session.degraded = false; ctx.accounts.setStatus(account.id, 'ok'); }
  for (const m of r.items || []) {
    if (m.snippet?.type === 'chatEndedEvent') { session.ended = true; continue; }
    if (!firstSeen(account.id, m.snippet?.type === 'giftEvent' ? `${m.id}:${m.snippet.giftEventDetails?.giftMetadata?.comboCount}` : m.id)) continue;
    const out = normalizeMessage(m, account, ctx.tokenize);
    if (out?.chat) ctx.emitChat(out.chat);
    else if (out?.event && out.event.ts >= session.since - 10_000) ctx.emitEvent(out.event);
    else if (out?.delete) ctx.emitDelete(out.delete);
  }
}

/**
 * One streamList connection; resolves when the server closes it, or when the watchdog ends it (chat changed, or
 * 5 min of silence: a normal end, not a failure). Throws on errors; aborted on stop.
 */
async function streamOnce(ctx, account, session, signal) {
  const ac = new AbortController();
  const abort = () => ac.abort();
  signal.addEventListener('abort', abort);
  let last = Date.now();
  let idle = false;
  session.delivered = false; // only a stream that delivered data can count as healthy
  const watchdog = setInterval(() => {
    const c = lives.get(account.id);
    if (c?.data && Date.now() - c.at < 90_000 && c.data.liveChatId !== session.chatId) session.ended = true;
    if (session.ended || Date.now() - last > 300_000) { idle = true; ac.abort(); }
  }, 30_000);
  watchdog.unref();
  try {
    spend(ctx, COST.stream);
    const res = await ctx.accounts.withToken(account, async accessToken => {
      const r = await fetch(`${API}/liveChat/messages/stream?${qs({ liveChatId: session.chatId, part: PARTS, pageToken: session.pageToken })}`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: ac.signal });
      if (r.ok) return r;
      const body = await r.json().catch(() => null);
      throw readable(ctx, new ApiError('youtube', r.status, body, body?.error?.message || `youtube HTTP ${r.status}`));
    });
    const feed = jsonArrayStream(item => {
      last = Date.now();
      if (item.error) throw readable(ctx, new ApiError('youtube', item.error.code || 500, item, item.error.message));
      session.delivered = true;
      handle(ctx, account, session, item);
    });
    const decoder = new TextDecoder();
    for await (const chunk of res.body) {
      feed(decoder.decode(chunk, { stream: true }));
      if (session.ended) break;
    }
  } catch (err) {
    if (!idle) throw err;
  } finally {
    clearInterval(watchdog);
    signal.removeEventListener('abort', abort);
    ac.abort();
  }
}

const GONE = new Set(['liveChatEnded', 'liveChatDisabled', 'liveChatNotFound', 'quotaExceeded', 'dailyLimitExceeded']);
const STREAM_HEALTHY = 10_000; // a stream that delivered data and stayed up this long was healthy, however it ended
const POLL_RETRY = 600_000;    // list polling retries streamList after this long
const healthy = (session, started) => session.delivered && Date.now() - started >= STREAM_HEALTHY;

/** Read one live chat until it ends: streamList with backoff, list polling (for 10 min at a time) after repeated quick failures. */
async function readChat(ctx, account, chatId, signal) {
  const session = { chatId, pageToken: '', since: historyCutoff.get(account.id) ?? Date.now(), ended: false };
  let fails = 0;
  let poll = 0; // ms when list polling started, 0 = streaming
  while (!signal.aborted && !session.ended) {
    if (poll && Date.now() - poll > POLL_RETRY) { poll = 0; fails = 0; }
    const started = Date.now();
    try {
      if (poll) {
        const r = await api(ctx, account, '/liveChat/messages?' + qs({ liveChatId: chatId, part: PARTS, pageToken: session.pageToken }));
        handle(ctx, account, session, r);
        fails = 0;
        await delay(Math.max(5000, Number(r.pollingIntervalMillis) || 0), null, { signal, ref: false });
        continue;
      }
      await streamOnce(ctx, account, session, signal);
      fails = healthy(session, started) ? 0 : fails + 1; // closing at once, or with nothing delivered, counts as a failure
    } catch (err) {
      if (signal.aborted || session.ended) break;
      const why = reason(err);
      const forbidden = err.status === 403 && why !== 'rateLimitExceeded';
      if (GONE.has(why) || err.status === 404 || err.status === 401 || (poll && forbidden)) {
        if (!GONE.has(why)) ctx.log.warn(`[youtube] ${account.login}: chat stopped: ${err.message}`);
        break;
      }
      // A drop after a healthy stream reconnects at once, like a clean close. A slow failure that delivered nothing
      // (e.g. a 10 s connect timeout on a blackholed route) still backs off, then falls back to polling.
      fails = !poll && healthy(session, started) ? 0 : fails + 1;
      if (!poll && (forbidden || fails >= 3)) {
        poll = Date.now();
        ctx.log.warn(`[youtube] ${account.login}: streamList failing (${err.message}); polling for 10 min`);
      }
      if (fails >= 3 && !session.degraded) { session.degraded = true; ctx.accounts.setStatus(account.id, 'error', err.message); }
    }
    if (fails) await delay(Math.min(60_000, 1000 * 2 ** fails) + Math.random() * 500, null, { signal, ref: false }).catch(() => {});
  }
  if (session.degraded && !signal.aborted) ctx.accounts.setStatus(account.id, 'ok');
  lives.delete(account.id); // force a fresh live check
}

async function run(ctx, account, signal) {
  let failing = false;
  while (!signal.aborted) {
    let chatId = '';
    try {
      chatId = (await liveState(ctx, account, maxAge(ctx, account))).liveChatId;
      failing = false;
    } catch (err) {
      if (err.status === 401 || ctx.accounts.get(account.id)?.status === 'needs_reconnect') return; // reconnect restarts us
      if (!failing) ctx.log.warn(`[youtube] ${account.login}: live check failed: ${err.message}`);
      failing = true;
    }
    if (chatId) await readChat(ctx, account, chatId, signal);
    await delay(FAST, null, { signal, ref: false }).catch(() => {}); // cheap: liveState only refreshes past maxAge
  }
}

// ------------------------------------------------------------------ adapter
export default {
  id: 'youtube',
  name: 'YouTube',
  color: '#FF0033',
  auth: 'oauth',
  app: { consoleUrl: 'https://console.cloud.google.com/apis/credentials', docsUrl: 'https://developers.google.com/youtube/v3/live/getting-started', localhost: true },
  capabilities: {
    chatRead: true, chatSend: true, reply: false, deleteMessage: true, timeout: true, ban: true, unban: true,
    chatters: false, activeChatters: true, viewers: true, events: true, editInfo: true, categorySearch: false, quota: true,
    markers: false, clips: false,
    limits: LIMITS,
  },
  infoFields: {
    title: { max: 100, forbid: '<>' },
    description: { max: 5000, forbid: '<>' },
    ytCategory: {},
    tags: { totalLength: 500, replaceAll: true },
  },
  statsInterval: FAST,

  async testApp(ctx, app) {
    const redirectUri = ctx.redirectUri('youtube');
    try {
      await token(ctx, app, { grant_type: 'authorization_code', code: 'invalid', redirect_uri: redirectUri });
    } catch (err) {
      if (!(err instanceof ApiError)) throw fail(ctx.t(`Impossible de joindre Google : ${err.message}`, `Cannot reach Google: ${err.message}`), 502);
      const result = testAppResult(typeof err.body?.error === 'string' ? err.body.error : '', redirectUri, ctx.t);
      if (result.ok) return result;
      throw fail(result.message, err.status);
    }
    return testAppResult('invalid_grant', redirectUri, ctx.t);
  },

  authorize(ctx, { state, redirectUri, app, pkce }) {
    const url = `${AUTH_URL}?${qs({
      client_id: app.clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE, access_type: 'offline',
      prompt: 'consent select_account', include_granted_scopes: 'true', state, code_challenge: pkce.challenge, code_challenge_method: 'S256',
    })}`;
    return { url, pending: { verifier: pkce.verifier } };
  },

  async callback(ctx, { code, redirectUri, app, pending }) {
    const t = await token(ctx, app, { grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: pending?.verifier });
    const me = (await yt(ctx, t.access_token, '/channels?' + qs({ part: 'snippet', mine: 'true' }))).items?.[0];
    if (!me) {
      throw fail(ctx.t('Ce compte Google n’a pas de chaîne YouTube. Crée-en une, ou choisis le bon compte de marque, puis réessaie.',
        'This Google account has no YouTube channel. Create one, or pick the right brand account, then try again.'));
    }
    const s = me.snippet || {};
    const thumbs = s.thumbnails || {};
    return {
      platformUserId: me.id, login: (s.customUrl || '').replace(/^@/, '') || s.title || me.id, displayName: s.title || me.id,
      avatar: https((thumbs.medium || thumbs.default)?.url), scopes: (t.scope || SCOPE).split(' '), tokens: tokenSet(t),
    };
  },

  async refresh(ctx, account, tokens) {
    const app = ctx.app('youtube');
    if (!app) throw new Error(ctx.t('Identifiants de l’app YouTube (Client ID / Secret) manquants.', 'YouTube app credentials (Client ID / Secret) are missing.'));
    return tokenSet(await token(ctx, app, { grant_type: 'refresh_token', refresh_token: tokens.refresh }), tokens); // Google usually keeps the refresh token
  },

  async revoke(ctx, account, tokens) {
    const value = tokens?.refresh || tokens?.access;
    if (value) await ctx.request(REVOKE_URL, { platform: 'youtube', method: 'POST', form: { token: value } });
  },

  async connect(ctx, account) {
    await ctx.accounts.tokens(account); // setup check: throws when the account has no usable token
    if (!historyCutoff.has(account.id)) historyCutoff.set(account.id, Date.now());
    awake.set(account.id, Date.now()); // (re)connect = the streamer is around: check for go-live often for a while
    ctx.emotes.load('youtube', account.platformUserId)?.catch?.(() => {});
    const ac = new AbortController();
    run(ctx, account, ac.signal).catch(err => ctx.log.warn(`[youtube] ${account.login}: ${err.message}`));
    return { stop: () => ac.abort() };
  },

  async stats(ctx, account) {
    const s = await liveState(ctx, account, maxAge(ctx, account));
    const cats = s.categoryId ? await categories(ctx, account).catch(() => []) : [];
    const { used, limit } = quota(ctx);
    return {
      live: s.live, viewers: s.live ? s.viewers : 0, startedAt: s.live ? s.startedAt : null, title: s.title || '',
      category: cats.find(c => c.id === s.categoryId)?.title || '', quota: { used, limit },
    };
  },

  async getInfo(ctx, account) {
    const { snippet: s = {} } = await targetVideo(ctx, account);
    return { title: s.title || '', description: s.description || '', tags: s.tags || [], ytCategoryId: s.categoryId || '', category: null };
  },

  async setInfo(ctx, account, changes = {}) {
    budget(ctx, COST.write);
    const video = await targetVideo(ctx, account);
    const snippet = applyInfo(video.snippet || {}, changes, ctx.t);
    await api(ctx, account, '/videos?part=snippet', { method: 'PUT', json: { id: video.id, snippet }, cost: COST.write });
    const c = lives.get(account.id);
    if (c?.data?.videoId === video.id) Object.assign(c.data, { title: snippet.title, categoryId: snippet.categoryId });
    return { ok: true };
  },

  async infoOptions(ctx, account) {
    return { ytCategories: await categories(ctx, account) };
  },

  async searchCategories(ctx) {
    throw fail(ctx.t('YouTube n’a pas de recherche de catégorie : choisis une catégorie dans la liste (le titre du jeu se règle uniquement dans YouTube Studio).',
      'YouTube has no category search: pick a category from the list (the game title can only be set in YouTube Studio).'));
  },

  async send(ctx, account, { text }) {
    const messageText = String(text ?? '').trim();
    if (!messageText) return { ok: false, error: ctx.t('Message vide.', 'Empty message.') };
    if ([...messageText].length > LIMITS.chatMaxLength) {
      return { ok: false, error: ctx.t(`Les messages du chat YouTube sont limités à ${LIMITS.chatMaxLength} caractères.`, `YouTube chat messages are limited to ${LIMITS.chatMaxLength} characters.`) };
    }
    try {
      budget(ctx, COST.write);
      const id = await liveChatId(ctx, account);
      const r = await api(ctx, account, '/liveChat/messages?part=snippet', {
        method: 'POST', cost: COST.write,
        json: { snippet: { liveChatId: id, type: 'textMessageEvent', textMessageDetails: { messageText } } },
      });
      return { ok: true, id: r?.id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async moderate(ctx, account, { action, messageId, userId, duration }) {
    if (!['delete', 'timeout', 'ban', 'unban'].includes(action)) throw fail(ctx.t(`Action non prise en charge sur YouTube : ${action}`, `Action not supported on YouTube: ${action}`));
    if (action === 'delete' ? !messageId : !/^[\w-]{1,64}$/.test(String(userId || ''))) throw fail(ctx.t('Identifiant de message ou de chaîne manquant ou invalide.', 'Missing or invalid message / channel id.'));
    budget(ctx, COST.write);
    const banKey = `youtube:ban:${account.id}:${userId}`;
    if (action === 'delete') {
      await api(ctx, account, '/liveChat/messages?' + qs({ id: messageId }), { method: 'DELETE', cost: COST.write });
      ctx.emitDelete({ accountId: account.id, messageId }); // YouTube no longer pushes deletions
    } else if (action === 'unban') {
      const banId = ctx.settings.get(banKey);
      if (!banId) {
        throw fail(ctx.t('YouTube ne permet pas de lister les bannissements : seuls ceux faits depuis Tramevia Dock peuvent être levés ici. Passe par YouTube Studio → Paramètres → Communauté.',
          'YouTube cannot list bans: only bans made from Tramevia Dock can be lifted here. Use YouTube Studio → Settings → Community instead.'), 404);
      }
      await api(ctx, account, '/liveChat/bans?' + qs({ id: banId }), { method: 'DELETE', cost: COST.write });
      ctx.settings.set(banKey, null);
    } else {
      const seconds = Math.min(LIMITS.timeoutMax, Math.max(LIMITS.timeoutMin, Math.round(Number(duration) || 300)));
      const ban = await api(ctx, account, '/liveChat/bans?part=snippet', {
        method: 'POST', cost: COST.write,
        json: { snippet: clean({
          liveChatId: await liveChatId(ctx, account), type: action === 'ban' ? 'permanent' : 'temporary',
          banDurationSeconds: action === 'timeout' ? seconds : undefined, bannedUserDetails: { channelId: userId },
        }) },
      });
      if (ban?.id) ctx.settings.set(banKey, ban.id); // no liveChatBans.list: keep the id to be able to unban
      ctx.emitDelete({ accountId: account.id, userId });
    }
    return { ok: true };
  },
};
