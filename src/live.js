// Live sessions: one stream on every platform together, and its summary (duration, peak viewers, follows and subs per
// platform, most active chatters). Discord webhook: an announcement when the stream starts, the summary when it ends.
// Settings keys 'discord' (webhook sealed) and 'live:last' (last summary). SPEC.md §7.6.
// A session starts when a channel goes live and ends once every channel has been off for GRACE: a stream that drops and
// comes back within 5 minutes stays one session.
import { seal, unseal } from './crypto.js';
import { HttpError } from './http.js';
import { gains } from './goals.js';

const GRACE = 5 * 60_000, ANNOUNCE_DELAY = 60_000, ANNOUNCE_MAX_AGE = 15 * 60_000, TOP = 5, PUBLISH_EVERY = 5_000;
const WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,200}$/;
export const DISCORD_DEFAULTS = { webhook: null, announce: true, summary: true, message: '' }; // message '' = built-in text
const NAMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube', tiktok: 'TikTok' };
const CHANNEL_URL = {
  twitch: a => `https://www.twitch.tv/${encodeURIComponent(a.login)}`,
  kick: a => `https://kick.com/${encodeURIComponent(a.login)}`,
  youtube: a => (/^UC[\w-]{22}$/.test(a.platformUserId) ? `https://www.youtube.com/channel/${a.platformUserId}/live` : null),
  tiktok: a => `https://www.tiktok.com/@${encodeURIComponent(a.login)}/live`,
};
const LAVENDER = 0xb79cff;

/** "2 h 05" / "45 min" */
const duration = ms => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};
/** Values put into a Discord message never ping anyone (an @everyone in a stream title stays text). */
const quiet = s => String(s ?? '').replace(/@/g, '@​');
const cut = (s, n) => ([...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s);

/** A summary as stored and sent to the dashboard (no Map, no Set). */
function snapshot(s, end = null) {
  const top = [...s.chatters.values()].sort((a, b) => b.n - a.n).slice(0, TOP);
  return {
    startedAt: s.startedAt, endedAt: end, peak: s.peak, messages: s.messages, chatters: s.chatters.size, top,
    platforms: Object.entries(s.platforms).map(([platform, p]) => ({ platform, ...p })),
  };
}

export function createLive(ctx, { now = Date.now, post = null } = {}) {
  let session = null; // running stream
  let offSince = 0; // every channel off since (grace period running)
  let endTimer = 0, publishTimer = 0, announceTimer = 0;
  const discord = () => ({ ...DISCORD_DEFAULTS, ...ctx.settings.get('discord', {}) });
  const webhook = () => { const d = discord(); try { return d.webhook ? unseal(d.webhook, 'discord') : null; } catch { return null; } };

  const send = post || (async body => {
    const url = webhook();
    if (!url) throw new Error('no webhook');
    const r = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ allowed_mentions: { parse: ['everyone', 'roles', 'users'] }, ...body }),
    });
    if (!r.ok) throw new Error(`Discord HTTP ${r.status}${r.status === 404 ? ' (webhook deleted?)' : ''}`);
  });

  const live = () => ctx.accounts.list().filter(a => a.status !== 'disabled' && ctx.accounts.stats(a.id)?.live === true);
  const platform = pf => (session.platforms[pf] ||= { follows: 0, subs: 0, messages: 0, peak: 0 });

  function publish() {
    clearTimeout(publishTimer);
    publishTimer = 0;
    ctx.hub.publish('live', state());
  }
  /** Chat and stats change often: the dashboard gets at most one 'live' frame every 5 s. */
  const publishSoon = () => { publishTimer ||= setTimeout(publish, PUBLISH_EVERY); publishTimer.unref?.(); };

  function start() {
    const channels = live();
    const starts = channels.map(a => ctx.accounts.stats(a.id)?.startedAt).filter(Number.isFinite);
    const startedAt = starts.length ? Math.min(...starts) : now();
    session = { startedAt, peak: 0, messages: 0, platforms: {}, chatters: new Map(), seen: new Set() };
    for (const a of channels) platform(a.platform);
    // ponytail: a restart mid-stream starts the counts again (the duration stays right, from the platform's start time).
    // Announce only a stream that has just started (not the one already running when Tramevia Dock starts, nor the demo).
    if (!ctx.config.demo && now() - startedAt < ANNOUNCE_MAX_AGE && discord().announce && webhook()) {
      announceTimer = setTimeout(() => { if (session && !offSince) announce().catch(err => ctx.log.warn(`[discord] announcement failed: ${err.message}`)); }, ANNOUNCE_DELAY);
      announceTimer.unref?.();
    }
  }

  function end() {
    if (!session) return;
    const summary = snapshot(session, offSince || now());
    session = null;
    offSince = 0;
    clearTimeout(announceTimer);
    ctx.settings.set('live:last', summary);
    publish();
    if (discord().summary && webhook() && summary.endedAt - summary.startedAt >= 60_000) {
      send(summaryMessage(summary)).catch(err => ctx.log.warn(`[discord] summary failed: ${err.message}`));
    }
  }

  function onStats() {
    const state = ctx.liveState();
    if (state === 'live') {
      if (!session) start();
      if (offSince) { offSince = 0; clearTimeout(endTimer); } // back within the grace period: same stream
      const by = {};
      for (const a of live()) {
        const v = ctx.accounts.stats(a.id)?.viewers;
        if (Number.isFinite(v)) by[a.platform] = (by[a.platform] || 0) + v;
      }
      const total = Object.values(by).reduce((x, y) => x + y, 0);
      session.peak = Math.max(session.peak, total);
      for (const [pf, v] of Object.entries(by)) platform(pf).peak = Math.max(platform(pf).peak, v);
      publishSoon();
    } else if (state === 'off' && session && !offSince) {
      offSince = now();
      endTimer = setTimeout(end, GRACE);
      endTimer.unref?.();
    }
  }

  function onEvent(evt) {
    const add = session && gains(evt);
    if (!add) return;
    const key = `${evt.accountId}:${evt.id}`;
    if (evt.id && session.seen.has(key)) return;
    if (evt.id) session.seen.add(key);
    const p = platform(evt.platform);
    p.follows += add.follows || 0;
    p.subs += add.subs || 0;
    publishSoon();
  }

  function onChat(msg) {
    if (!session || msg.flags?.self || msg.author?.roles?.includes('bot')) return;
    session.messages++;
    platform(msg.platform).messages++;
    const key = `${msg.platform}:${msg.author?.id || msg.author?.login || ''}`;
    const c = session.chatters.get(key) || { name: msg.author?.name || msg.author?.login || '?', platform: msg.platform, n: 0 };
    c.n++;
    session.chatters.set(key, c);
    publishSoon();
  }

  /** The announcement: the streamer's text (or the built-in one) and every live channel's link. */
  function announceMessage() {
    const channels = live();
    const first = channels[0];
    const s = (first && ctx.accounts.stats(first.id)) || {};
    const vars = { name: first?.displayName || first?.login || '', title: s.title || '', category: s.category || '' };
    const template = discord().message || ctx.t('🔴 {name} est en live : {title}', '🔴 {name} is live: {title}');
    const content = cut(template.replace(/\{(name|title|category)\}/g, (_, k) => quiet(vars[k])), 2000);
    const links = channels.map(a => [NAMES[a.platform] || a.platform, CHANNEL_URL[a.platform]?.(a)]).filter(([, url]) => url);
    return {
      content,
      embeds: [{
        title: cut(vars.title || ctx.t('En live maintenant', 'Live now'), 256), url: links[0]?.[1], color: LAVENDER,
        description: links.map(([name, url]) => `**${name}** · ${url}`).join('\n') || undefined,
        fields: vars.category ? [{ name: ctx.t('Catégorie', 'Category'), value: cut(quiet(vars.category), 1024), inline: true }] : undefined,
        timestamp: new Date(now()).toISOString(),
      }],
    };
  }
  const announce = () => send(announceMessage());

  function summaryMessage(s) {
    const n = x => x.toLocaleString(ctx.t('fr-FR', 'en-US'));
    const fields = s.platforms.map(p => ({
      name: NAMES[p.platform] || p.platform, inline: true,
      value: [ctx.t(`${n(p.follows)} follows`, `${n(p.follows)} follows`), ctx.t(`${n(p.subs)} abonnements`, `${n(p.subs)} subs`),
        ctx.t(`${n(p.messages)} messages`, `${n(p.messages)} messages`), ctx.t(`pic ${n(p.peak)}`, `peak ${n(p.peak)}`)].join('\n'),
    }));
    if (s.top.length) {
      fields.push({ name: ctx.t('Les plus actifs', 'Most active'), inline: false,
        value: s.top.map((c, i) => `${i + 1}. ${quiet(c.name)} (${NAMES[c.platform] || c.platform}) · ${n(c.n)}`).join('\n') });
    }
    return {
      embeds: [{
        title: ctx.t('Résumé du live', 'Stream recap'), color: LAVENDER, timestamp: new Date(s.endedAt).toISOString(),
        description: [duration(s.endedAt - s.startedAt), ctx.t(`pic de ${n(s.peak)} spectateurs`, `peak of ${n(s.peak)} viewers`),
          ctx.t(`${n(s.messages)} messages de ${n(s.chatters)} personnes`, `${n(s.messages)} messages from ${n(s.chatters)} people`)].join(' · '),
        fields, footer: { text: 'Tramevia Dock' },
      }],
    };
  }

  /** What the dashboard shows: the running stream (null when off) and the last finished one. */
  const state = () => ({ current: session && snapshot(session), last: ctx.settings.get('live:last', null) });

  ctx.hub.on((t, d) => {
    if (t === 'stats' || t === 'accounts') onStats();
    else if (t === 'event' && d) onEvent(d);
    else if (t === 'chat' && d) onChat(d);
  });

  return {
    state, end, onStats, onEvent, onChat, announceMessage, summaryMessage,
    discord: () => { const { webhook: _, ...rest } = discord(); const url = webhook(); return { ...rest, webhook: Boolean(url), hint: url ? `…/${url.split('/').at(-2).slice(-4)}` : '' }; },
    setDiscord(patch) { ctx.settings.set('discord', { ...discord(), ...patch }); },
    test: () => send({ content: ctx.t('✅ Tramevia Dock est relié à ce salon.', '✅ Tramevia Dock is connected to this channel.') }),
  };
}

export function register(router, ctx) {
  ctx.live = createLive(ctx);
  router.get('/api/live', () => ctx.live.state());
  router.get('/api/discord', () => ctx.live.discord());
  // Partial: only what is sent changes. webhook: a Discord webhook address, '' or null = remove it.
  router.put('/api/discord', ({ body }) => {
    const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const bad = (fr, en) => { throw new HttpError(400, ctx.t(fr, en), 'invalid'); };
    const patch = {};
    for (const k of ['announce', 'summary']) {
      if (b[k] === undefined) continue;
      if (typeof b[k] !== 'boolean') bad(`Valeur invalide : ${k}`, `Invalid ${k}`);
      patch[k] = b[k];
    }
    if (b.message !== undefined) {
      if (typeof b.message !== 'string' || [...b.message.trim()].length > 500) bad('Le message fait 500 caractères au plus.', 'The message is 500 characters at most.');
      patch.message = b.message.trim();
    }
    if (b.webhook !== undefined) {
      const url = typeof b.webhook === 'string' ? b.webhook.trim() : '';
      if (url && !WEBHOOK.test(url)) bad('Ce n’est pas une adresse de webhook Discord (https://discord.com/api/webhooks/…).', 'This is not a Discord webhook address (https://discord.com/api/webhooks/…).');
      patch.webhook = url ? seal(url, 'discord') : null;
    }
    ctx.live.setDiscord(patch);
    return ctx.live.discord();
  });
  router.post('/api/discord/test', async () => {
    if (!ctx.live.discord().webhook) throw new HttpError(400, ctx.t('Ajoute d’abord l’adresse du webhook.', 'Add the webhook address first.'), 'no_webhook');
    try { await ctx.live.test(); } catch (err) {
      throw new HttpError(502, ctx.t(`Discord a refusé le message : ${err.message}`, `Discord refused the message: ${err.message}`), 'discord_error');
    }
    return { ok: true };
  });
}
