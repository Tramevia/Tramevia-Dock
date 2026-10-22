// Goals (overlay id=goal): follows and subs added up over every platform since the goal was set: Twitch and Kick subs,
// gifted subs (one per gift), YouTube members, TikTok subscribers. Settings key 'goals'. SPEC.md §7.8.
// An event re-sent with the same id (webhook retry, Jewels combo) counts once.
import { HttpError } from './http.js';

export const KINDS = ['follows', 'subs'];
export const DEFAULTS = { follows: { label: '', target: 100, count: 0 }, subs: { label: '', target: 50, count: 0 } };
const MAX = 10_000_000;

/** What an event adds to the goals: { follows: 1 } | { subs: n } | null. Test alerts never count. */
export function gains(evt) {
  if (!evt || evt.test) return null;
  switch (evt.type) {
    case 'follow': return { follows: 1 };
    case 'sub': case 'resub': case 'membership': return { subs: 1 };
    case 'giftsub': case 'giftmembership': return { subs: Math.min(Math.max(1, Math.floor(Number(evt.count)) || 1), 1000) };
    default: return null;
  }
}

/** Validated goals from a PUT body (missing kinds keep `current`), or a French/English error. */
export function validate(body, current = DEFAULTS) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const out = {};
  for (const k of KINDS) {
    const g = b[k] === undefined ? current[k] : b[k];
    const label = typeof g?.label === 'string' ? g.label.replace(/\s+/g, ' ').trim() : '';
    if ([...label].length > 40) return { error: ['Le titre de l’objectif fait 40 caractères au plus.', 'A goal title is 40 characters at most.'] };
    if (!Number.isInteger(g?.target) || g.target < 1 || g.target > MAX) return { error: ['L’objectif doit être un nombre entier de 1 à 10 000 000.', 'The goal must be a whole number from 1 to 10,000,000.'] };
    if (!Number.isInteger(g?.count) || g.count < 0 || g.count > MAX) return { error: ['Le compteur doit être un nombre entier de 0 à 10 000 000.', 'The count must be a whole number from 0 to 10,000,000.'] };
    out[k] = { label, target: g.target, count: g.count };
  }
  return { goals: out };
}

export function createGoals(ctx) {
  let current = validate(ctx.settings.get('goals', DEFAULTS)).goals || structuredClone(DEFAULTS);
  const seen = new Set(); // event ids already counted

  function set(next) {
    current = next;
    ctx.settings.set('goals', current);
    ctx.hub.publish('goal', current);
    return current;
  }

  function onEvent(evt) {
    const add = gains(evt);
    if (!add) return;
    const key = `${evt.accountId}:${evt.id}`;
    if (evt.id && seen.has(key)) return;
    if (evt.id) seen.add(key);
    if (seen.size > 5000) seen.clear(); // ponytail: a re-send hours later would count again; a ring buffer if that ever shows up
    const next = structuredClone(current);
    for (const [k, n] of Object.entries(add)) next[k].count = Math.min(MAX, next[k].count + n);
    set(next);
  }

  ctx.hub.on((t, d) => { if (t === 'event') onEvent(d); });
  return { get: () => current, set, onEvent };
}

export function register(router, ctx) {
  ctx.goals = createGoals(ctx);
  router.get('/api/goals', () => ctx.goals.get(), { access: 'read' });
  router.put('/api/goals', ({ body }) => {
    const { goals, error } = validate(body, ctx.goals.get());
    if (error) throw new HttpError(400, ctx.t(...error), 'invalid');
    return ctx.goals.set(goals);
  });
  // Test for goal overlays (topic goal:test): they show a gain for a few seconds, then the real count again. Never stored.
  router.post('/api/overlays/goal/test', () => {
    const gain = { follows: 1, subs: 5 };
    ctx.hub.publish('goal:test', gain);
    return { ok: true, ...gain };
  });
}
