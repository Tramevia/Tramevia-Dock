// Giveaway on every platform at once (overlay id=giveaway): viewers type !keyword in any chat, TikTok included; one entry
// per person and platform. The streamer closes the entries and draws a winner; drawing again picks another one (a winner
// never wins twice in the same giveaway). Entry messages carry flags.entry: the chat overlay hides them. Your own messages,
// bots and filtered messages never enter. Optional announcements in every live chat (bot.sayLive). SPEC.md §7.10.
// The public view (topic 'giveaway', read access) has the count, the last few names and the winners, never the whole list;
// a draw adds a reel: up to 24 names taken at random, ending with the winner, for the overlay's roulette.
import { randomInt } from 'node:crypto';
import { randomId } from './crypto.js';
import { HttpError } from './http.js';

const MAX_ENTRIES = 100_000, RECENT = 6, REEL = 24, PUBLISH_EVERY = 400;
const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const NAMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube', tiktok: 'TikTok' };

/** Validated giveaway from a POST body, or a French/English error. */
export function validate(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const keyword = typeof b.keyword === 'string' ? b.keyword.trim().replace(/^!+/, '').toLowerCase() : '';
  if (!/^[\p{L}\p{N}_-]{1,25}$/u.test(keyword)) return { error: ['Mot-clé invalide (lettres, chiffres, - et _, 25 au plus).', 'Invalid keyword (letters, digits, - and _, 25 at most).'] };
  const title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim() : '';
  if ([...title].length > 60) return { error: ['Le lot fait 60 caractères au plus.', 'The prize is 60 characters at most.'] };
  return { giveaway: { keyword, title, announce: b.announce !== false } };
}

export function createGiveaway(ctx, { now = Date.now, pick = randomInt } = {}) {
  let g = null; // { id, keyword, title, open, count, recent, winners, draw, startedAt, closedAt, announce }
  let entries = []; // { key, name, platform }
  let keys = new Set();
  let publishTimer = 0;
  const say = text => ctx.bot?.sayLive(text).catch(() => {});

  function publish() {
    clearTimeout(publishTimer);
    publishTimer = 0;
    ctx.hub.publish('giveaway', g);
  }

  function start({ keyword, title, announce }) {
    g = { id: randomId(6), keyword, title, open: true, count: 0, recent: [], winners: [], draw: null, startedAt: now(), closedAt: null, announce };
    entries = [];
    keys = new Set();
    publish();
    if (announce) say(ctx.t(`🎁 Tirage au sort${title ? ` : ${title}` : ''} ! Tapez !${keyword} pour participer.`, `🎁 Giveaway${title ? `: ${title}` : ''}! Type !${keyword} to enter.`));
    return g;
  }

  function close() {
    if (!g || !g.open) return g;
    g.open = false;
    g.closedAt = now();
    publish();
    if (g.announce) say(ctx.t(`🎁 Participations closes : ${g.count} participant${g.count > 1 ? 's' : ''}.`, `🎁 Entries closed: ${g.count} ${g.count === 1 ? 'entry' : 'entries'}.`));
    return g;
  }

  /** A winner among the entries that have not won yet (closes the entries first), or null when nobody is left. */
  function draw() {
    if (!g) return null;
    const won = new Set(g.winners.map(w => w.key));
    const left = entries.filter(e => !won.has(e.key));
    if (!left.length) return null;
    if (g.open) close();
    const winner = left[pick(left.length)];
    const others = entries.filter(e => e !== winner);
    const reel = [];
    for (let i = 0; i < Math.min(REEL - 1, others.length * 3); i++) reel.push(others[pick(others.length)]);
    g.winners.push(winner);
    g.draw = { id: randomId(6), at: now(), reel: [...reel, winner].map(({ name, platform }) => ({ name, platform })) };
    publish();
    if (g.announce) say(ctx.t(`🎉 Bravo ${winner.name} (${NAMES[winner.platform] || winner.platform}) !`, `🎉 Congrats ${winner.name} (${NAMES[winner.platform] || winner.platform})!`));
    return g;
  }

  /** Called on every chat message before it is published: "!keyword" while entries are open = an entry. */
  function enter(msg) {
    if (!g || !g.open || msg.deleted || msg.flags?.self || msg.author?.roles?.includes('bot')) return;
    const word = /^!([\p{L}\p{N}_-]+)\s*$/u.exec(String(msg.text || '').trim())?.[1];
    if (!word || fold(word) !== fold(g.keyword)) return;
    msg.flags = { ...msg.flags, entry: true };
    const key = `${msg.platform}:${msg.author?.id || msg.author?.login || ''}`;
    if (keys.has(key) || entries.length >= MAX_ENTRIES) return;
    keys.add(key);
    const entry = { key, name: msg.author?.name || msg.author?.login || '?', platform: msg.platform };
    entries.push(entry);
    g.count++;
    g.recent = [{ name: entry.name, platform: entry.platform }, ...g.recent].slice(0, RECENT);
    publishTimer ||= setTimeout(publish, PUBLISH_EVERY); // a wave of entries = a few frames, not one per entry
    publishTimer.unref?.();
  }

  // The winners' keys stay on the server: the public view only has names and platforms.
  const view = () => g && { ...g, winners: g.winners.map(({ name, platform }) => ({ name, platform })) };

  return {
    get: view, start, close, enter,
    draw: () => (draw() ? view() : null),
    /** Hide it (overlay and dashboard). */
    clear() { g = null; entries = []; keys = new Set(); publish(); },
  };
}

export function register(router, ctx) {
  ctx.giveaway = createGiveaway(ctx);
  router.get('/api/giveaway', () => ctx.giveaway.get(), { access: 'read' });
  router.post('/api/giveaway', ({ body }) => {
    if (ctx.giveaway.get()?.open) throw new HttpError(409, ctx.t('Un tirage au sort est déjà ouvert : ferme-le d’abord.', 'A giveaway is already open: close it first.'), 'giveaway_running');
    const { giveaway, error } = validate(body);
    if (error) throw new HttpError(400, ctx.t(...error), 'invalid');
    return ctx.giveaway.start(giveaway);
  });
  router.post('/api/giveaway/close', () => ctx.giveaway.close());
  router.post('/api/giveaway/draw', () => {
    const g = ctx.giveaway.draw();
    if (!g) throw new HttpError(409, ctx.giveaway.get()?.count
      ? ctx.t('Tout le monde a déjà gagné : plus personne à tirer.', 'Everyone has already won: nobody left to draw.')
      : ctx.t('Personne ne participe encore.', 'Nobody has entered yet.'), 'no_entries');
    return g;
  });
  router.delete('/api/giveaway', () => { ctx.giveaway.clear(); return { ok: true }; });
  // Test for giveaway overlays (topic giveaway:test): they play sample entries and a draw on their own. Never stored.
  router.post('/api/overlays/giveaway/test', () => {
    ctx.hub.publish('giveaway:test', { keyword: ctx.t('participer', 'join'), title: ctx.t('Une clé Steam', 'A Steam key') });
    return { ok: true };
  });
}
