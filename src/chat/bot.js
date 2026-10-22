// Chat commands and timed reminders, on every platform that can send. Settings key 'bot'. SPEC.md §7.5.
//  - command: a viewer types !name (any case, accents ignored), the answer goes to the chat it was typed in. 30 s cooldown per
//    command and channel. {user} = the viewer's name.
//  - timer: every N minutes while live, the text goes to every live channel. A channel gets it only if a viewer wrote there since
//    the last time (no reminders into an empty chat, no YouTube quota spent for nothing).
// Answers never start with ! or /: the bot can't trigger itself or run a platform's chat commands.
import { HttpError } from '../http.js';

export const DEFAULTS = { commands: [], timers: [], offAccounts: [] };
const MAX_COMMANDS = 50, MAX_TIMERS = 10, MAX_TEXT = 500, COOLDOWN = 30_000, TICK = 15_000;

const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const cleanText = s => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

/** Validated settings from a PUT body, or a French/English error message. */
export function validate(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const textError = (text, what) => {
    if (!text || [...text].length > MAX_TEXT) return [`${what} : le texte doit faire de 1 à ${MAX_TEXT} caractères.`, `${what}: the text must be 1–${MAX_TEXT} characters.`];
    if (/^[!/]/.test(text)) return [`${what} : le texte ne peut pas commencer par ! ou /.`, `${what}: the text can’t start with ! or /.`];
    return null;
  };
  const commands = [], seen = new Set();
  if (!Array.isArray(b.commands ?? []) || !Array.isArray(b.timers ?? []) || !Array.isArray(b.offAccounts ?? [])) return { error: ['Réglages invalides.', 'Invalid settings.'] };
  for (const c of b.commands || []) {
    const name = typeof c?.name === 'string' ? c.name.trim().replace(/^!+/, '').toLowerCase() : '';
    if (!/^[\p{L}\p{N}_-]{1,25}$/u.test(name)) return { error: [`Nom de commande invalide : ${name || '(vide)'} (lettres, chiffres, - et _, 25 au plus).`, `Invalid command name: ${name || '(empty)'} (letters, digits, - and _, 25 at most).`] };
    if (seen.has(fold(name))) return { error: [`La commande !${name} existe deux fois.`, `The command !${name} is listed twice.`] };
    seen.add(fold(name));
    const text = cleanText(c.text);
    const bad = textError(text, `!${name}`);
    if (bad) return { error: bad };
    commands.push({ name, text });
  }
  if (commands.length > MAX_COMMANDS) return { error: [`${MAX_COMMANDS} commandes au plus.`, `${MAX_COMMANDS} commands at most.`] };
  const timers = [];
  for (const [i, r] of (b.timers || []).entries()) {
    const text = cleanText(r?.text);
    const bad = textError(text, `Rappel ${i + 1}`);
    if (bad) return { error: bad };
    if (!Number.isInteger(r.minutes) || r.minutes < 5 || r.minutes > 240) return { error: ['Un rappel part toutes les 5 à 240 minutes.', 'A reminder runs every 5 to 240 minutes.'] };
    timers.push({ text, minutes: r.minutes });
  }
  if (timers.length > MAX_TIMERS) return { error: [`${MAX_TIMERS} rappels au plus.`, `${MAX_TIMERS} reminders at most.`] };
  const offAccounts = [...new Set((b.offAccounts || []).filter(x => typeof x === 'string' && x && x.length <= 64))].slice(0, 50);
  return { settings: { commands, timers, offAccounts } };
}

export function createBot(ctx, now = Date.now) {
  let current = { ...DEFAULTS, ...ctx.settings.get('bot', {}) };
  const cooldown = new Map(); // accountId:command → last answer
  const lastViewer = new Map(); // accountId → last message from a viewer
  let due = []; // timer index → next run (null = not live)
  const posted = new Map(); // `${index}:${accountId}` → last post

  const speaks = account => account && !current.offAccounts.includes(account.id);
  const live = () => ctx.accounts.list().filter(a => a.status !== 'disabled' && speaks(a) && ctx.accounts.stats(a.id)?.live === true);

  /** Send `text` to one channel, cut to the platform's length (YouTube: 200). Best effort: a refusal is logged, never thrown. */
  async function say(account, text) {
    const caps = ctx.accounts.describe(account).caps || {};
    const adapter = ctx.adapterFor(account);
    if (!caps.chatSend || typeof adapter?.send !== 'function') return false;
    const max = caps.limits?.chatMaxLength;
    if (max && [...text].length > max) text = [...text].slice(0, max - 1).join('').trimEnd() + '…';
    try {
      const r = await adapter.send(ctx, account, { text });
      if (r?.ok === false) ctx.log.warn(`[bot] refused on ${account.id}: ${r.error || ''}`);
      return r?.ok !== false;
    } catch (err) { ctx.log.warn(`[bot] send failed on ${account.id}: ${err.message}`); return false; }
  }

  function onChat(msg) {
    if (!msg.flags?.self) lastViewer.set(msg.accountId, now());
    if (msg.deleted) return; // a filtered message gets no answer
    const name = /^!([\p{L}\p{N}_-]+)/u.exec(String(msg.text || '').trimStart())?.[1];
    const command = name && current.commands.find(c => fold(c.name) === fold(name));
    const account = command && ctx.accounts.get(msg.accountId);
    if (!speaks(account)) return;
    const key = `${account.id}:${command.name}`;
    if (now() - (cooldown.get(key) || 0) < COOLDOWN) return;
    cooldown.set(key, now());
    // After the command's own publish: the answer must reach the pages after the question.
    queueMicrotask(() => say(account, command.text.replaceAll('{user}', msg.author?.name || msg.author?.login || '')));
  }

  function tick() {
    const channels = live();
    if (!channels.length) { due = []; return; }
    const t = now();
    current.timers.forEach((timer, i) => {
      // A stream starts (or the reminder was just added): first run one interval later, staggered by a minute per reminder.
      due[i] ??= t + timer.minutes * 60_000 + i * 60_000;
      if (t < due[i]) return;
      due[i] = t + timer.minutes * 60_000;
      for (const a of channels) {
        const key = `${i}:${a.id}`;
        if (posted.has(key) && !((lastViewer.get(a.id) || 0) > posted.get(key))) continue;
        posted.set(key, t);
        say(a, timer.text);
      }
    });
  }

  ctx.hub.on((t, d) => { if (t === 'chat' && d) onChat(d); });
  const timer = setInterval(tick, TICK);
  timer.unref?.();

  return {
    get: () => current,
    set(s) { ctx.settings.set('bot', s); current = s; due = []; posted.clear(); },
    /** Send to every live channel the bot may speak in (poll announcements). */
    sayLive: text => Promise.all(live().map(a => say(a, text))),
    tick, onChat,
    stop: () => clearInterval(timer),
  };
}

export function register(router, ctx) {
  ctx.bot = createBot(ctx);
  router.get('/api/bot', () => ctx.bot.get());
  // Whole settings object each time (the dashboard sends what it shows).
  router.put('/api/bot', ({ body }) => {
    const { settings, error } = validate(body);
    if (error) throw new HttpError(400, ctx.t(...error), 'invalid');
    ctx.bot.set(settings);
    return settings;
  });
}
