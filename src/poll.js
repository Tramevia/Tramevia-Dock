// Poll on every platform at once (overlay id=poll): viewers type the number of their answer (1, 2…) in any chat, TikTok
// included. One vote per person and platform, the first one counts. Vote messages carry flags.vote: the chat overlay
// hides them. Optional announcement of the question and the result in every live chat (bot.sayLive). SPEC.md §7.7.
import { randomId } from './crypto.js';
import { HttpError } from './http.js';

const MIN_OPTIONS = 2, MAX_OPTIONS = 5, MIN_SECONDS = 15, MAX_SECONDS = 1800, PUBLISH_EVERY = 400;

/** Validated poll from a POST body, or a French/English error. */
export function validate(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const clean = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
  const question = clean(b.question);
  if (!question || [...question].length > 120) return { error: ['La question doit faire de 1 à 120 caractères.', 'The question must be 1–120 characters.'] };
  const options = Array.isArray(b.options) ? b.options.map(clean).filter(Boolean) : [];
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return { error: ['Il faut de 2 à 5 réponses.', 'A poll has 2 to 5 answers.'] };
  if (options.some(o => [...o].length > 40)) return { error: ['Une réponse fait 40 caractères au plus.', 'An answer is 40 characters at most.'] };
  if (!Number.isInteger(b.seconds) || b.seconds < MIN_SECONDS || b.seconds > MAX_SECONDS) return { error: ['Durée invalide (15 secondes à 30 minutes).', 'Invalid duration (15 seconds to 30 minutes).'] };
  return { poll: { question, options, seconds: b.seconds, announce: b.announce !== false } };
}

export function createPoll(ctx, now = Date.now) {
  let poll = null; // { id, question, options: [{ label, votes }], total, startedAt, endsAt, closedAt, announce }
  let voters = new Set();
  let endTimer = 0, publishTimer = 0;
  const say = text => ctx.bot?.sayLive(text).catch(() => {});

  function publish() {
    clearTimeout(publishTimer);
    publishTimer = 0;
    ctx.hub.publish('poll', poll);
  }

  function start({ question, options, seconds, announce }) {
    clearTimeout(endTimer);
    const t = now();
    poll = { id: randomId(6), question, options: options.map(label => ({ label, votes: 0 })), total: 0, startedAt: t, endsAt: t + seconds * 1000, closedAt: null, announce };
    voters = new Set();
    endTimer = setTimeout(close, seconds * 1000);
    endTimer.unref?.();
    publish();
    if (announce) say(ctx.t(`📊 Sondage : ${question} Tapez ${options.map((o, i) => `${i + 1} pour ${o}`).join(', ')}.`,
      `📊 Poll: ${question} Type ${options.map((o, i) => `${i + 1} for ${o}`).join(', ')}.`));
    return poll;
  }

  function close() {
    if (!poll || poll.closedAt) return poll;
    clearTimeout(endTimer);
    poll.closedAt = now();
    publish();
    const best = Math.max(...poll.options.map(o => o.votes));
    if (poll.announce && poll.total) {
      const winners = poll.options.filter(o => o.votes === best).map(o => o.label).join(' / ');
      const pct = Math.round((best / poll.total) * 100);
      say(ctx.t(`📊 Résultat : ${winners} (${pct} %) sur ${poll.total} vote${poll.total > 1 ? 's' : ''}.`, `📊 Result: ${winners} (${pct}%) out of ${poll.total} vote${poll.total > 1 ? 's' : ''}.`));
    }
    return poll;
  }

  /** Called on every chat message before it is published. "2" during an open poll = a vote for the 2nd answer. */
  function vote(msg) {
    if (!poll || poll.closedAt || msg.deleted || msg.flags?.self) return;
    const n = Number(/^\s*(\d)\s*$/.exec(String(msg.text || ''))?.[1]);
    if (!(n >= 1 && n <= poll.options.length)) return;
    msg.flags = { ...msg.flags, vote: n };
    const who = `${msg.platform}:${msg.author?.id || msg.author?.login || ''}`;
    if (voters.has(who)) return;
    voters.add(who);
    poll.options[n - 1].votes++;
    poll.total++;
    publishTimer ||= setTimeout(publish, PUBLISH_EVERY); // a wave of votes = a few frames, not one per vote
    publishTimer.unref?.();
  }

  return {
    get: () => poll, start, close, vote,
    /** Hide it (overlay and dashboard). */
    clear() { clearTimeout(endTimer); poll = null; publish(); },
  };
}

export function register(router, ctx) {
  ctx.poll = createPoll(ctx);
  router.get('/api/poll', () => ctx.poll.get(), { access: 'read' });
  router.post('/api/poll', ({ body }) => {
    if (ctx.poll.get() && !ctx.poll.get().closedAt) throw new HttpError(409, ctx.t('Un sondage est déjà en cours : termine-le d’abord.', 'A poll is already running: end it first.'), 'poll_running');
    const { poll, error } = validate(body);
    if (error) throw new HttpError(400, ctx.t(...error), 'invalid');
    return ctx.poll.start(poll);
  });
  router.post('/api/poll/close', () => ctx.poll.close());
  router.delete('/api/poll', () => { ctx.poll.clear(); return { ok: true }; });
  // Test for poll overlays (topic poll:test): they play a sample poll on their own. Never stored, never counted.
  router.post('/api/overlays/poll/test', () => {
    const sample = { question: ctx.t('On joue à quoi après ?', 'What do we play next?'), options: ['Minecraft', 'VALORANT', ctx.t('Discussion', 'Just Chatting')] };
    ctx.hub.publish('poll:test', sample);
    return { ok: true };
  });
}
