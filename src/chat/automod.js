// Auto filters: banned words and links, on every connected platform. A matching message is hidden everywhere
// (dock and overlay get it already deleted) and deleted on the platform, plus an optional timeout, when the account
// allows it. Anti-spam rules on top: shouting, the same message again and again, emote or symbol floods. Broadcaster, moderators
// and our own messages are never filtered. Settings: settings key 'automod'. SPEC.md §7.1.

export const DEFAULTS = { words: [], links: false, allowedLinks: [], caps: false, repeat: false, emotes: false, symbols: false, action: 'delete', duration: 600, exemptVip: true, exemptSub: false };
// Anti-spam thresholds (the dashboard states them): caps = 15+ letters, 70 % in capitals · repeat = the 3rd identical message
// from one person within a minute · emotes = more than 10 emotes or emoji · symbols = 15+ symbols, over half the message.
const CAPS_MIN = 15, CAPS_SHARE = 0.7, REPEAT_COUNT = 3, REPEAT_MS = 60_000, EMOTES_MAX = 10, SYMBOLS_MIN = 15, SYMBOLS_SHARE = 0.5;
const MAX_WORDS = 500, MAX_WORD = 50, MAX_DOMAINS = 100, MAX_TIMEOUT = 1_209_600;

// The host of each link: after http(s)://, a www. address, or a bare domain on a TLD spammers use ("bit.ly/x",
// "free-followers.xyz"). No .ca: "salut.ca va" stays text. Not inside a path or an e-mail ("/x.com", "a@b.com").
const TLDS = 'com|net|org|info|biz|io|gg|tv|ly|me|co|cc|to|fr|be|ch|de|uk|eu|es|it|nl|ru|us|xyz|app|link|site|online|live|shop|store|club|top|fun|vip|pro|tk|ml|ga|cf|gq|sh|ws|gl|gd|su';
const LINKS = new RegExp(`https?://([^\\s/?#@]+)|(?<![\\p{L}\\p{N}./@-])(www\\.[^\\s/?#@]+|(?:[\\p{L}\\p{N}-]+\\.)+(?:${TLDS})(?![\\p{L}\\p{N}-]))`, 'giu');

/** "https://www.YouTube.com/@x" → "youtube.com" (port and trailing punctuation dropped). */
const host = s => s.toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/[.,!?;:)]+$/, '').replace(/^www\./, '');

/** Lowercase, no accents: "Crétin" matches "cretin". */
const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Validated settings from a PUT body, or a French/English error message. */
export function validate(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const s = { ...DEFAULTS };
  if (b.words !== undefined) {
    if (!Array.isArray(b.words) || b.words.some(w => typeof w !== 'string')) return { error: ['Liste de mots invalide.', 'Invalid word list.'] };
    s.words = [...new Set(b.words.map(w => w.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (s.words.length > MAX_WORDS) return { error: [`${MAX_WORDS} mots maximum.`, `${MAX_WORDS} words at most.`] };
    if (s.words.some(w => w.length > MAX_WORD)) return { error: [`${MAX_WORD} caractères maximum par mot.`, `${MAX_WORD} characters per word at most.`] };
  }
  if (b.allowedLinks !== undefined) {
    if (!Array.isArray(b.allowedLinks) || b.allowedLinks.some(d => typeof d !== 'string' || d.length > 200)) return { error: ['Liste de liens autorisés invalide.', 'Invalid allowed links.'] };
    s.allowedLinks = [...new Set(b.allowedLinks.map(d => host(d.trim())).filter(Boolean))];
    if (s.allowedLinks.length > MAX_DOMAINS) return { error: [`${MAX_DOMAINS} liens autorisés maximum.`, `${MAX_DOMAINS} allowed links at most.`] };
    const bad = s.allowedLinks.find(d => !/^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+$/u.test(d));
    if (bad) return { error: [`Lien autorisé invalide : ${bad} (exemple : youtube.com)`, `Invalid allowed link: ${bad} (example: youtube.com)`] };
  }
  for (const k of ['links', 'caps', 'repeat', 'emotes', 'symbols', 'exemptVip', 'exemptSub']) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== 'boolean') return { error: [`Valeur invalide : ${k}`, `Invalid ${k}`] };
    s[k] = b[k];
  }
  if (b.action !== undefined) {
    if (!['delete', 'timeout'].includes(b.action)) return { error: ['Action inconnue.', 'Unknown action.'] };
    s.action = b.action;
  }
  if (b.duration !== undefined) {
    if (!Number.isInteger(b.duration) || b.duration < 1 || b.duration > MAX_TIMEOUT) return { error: ['Durée invalide.', 'Invalid duration.'] };
    s.duration = b.duration;
  }
  return { settings: s };
}

const count = (text, re) => text.match(re)?.length || 0;
const REASONS = { word: 'banned word', link: 'link', caps: 'too many capitals', repeat: 'repeated message', emotes: 'emote flood', symbols: 'symbol flood' };

/** Matcher for one set of settings: (msg) => 'word' | 'link' | 'caps' | 'repeat' | 'emotes' | 'symbols' | null. */
export function matcher(s, now = Date.now) {
  const words = s.words.map(fold).filter(Boolean);
  // Whole words only: "con" does not hit "content". \p{L}\p{N} so accents and digits count as letters.
  const re = words.length && new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'u');
  // An allowed domain also covers its subdomains: youtube.com lets m.youtube.com through, not notyoutube.com.
  const allowed = h => (s.allowedLinks || []).some(d => h === d || h.endsWith('.' + d));
  const badLink = text => [...text.matchAll(LINKS)].some(m => !allowed(host(m[1] || m[2])));
  const last = new Map(); // platform:user → { text, n, at } (repeat rule)
  /** The same text a 3rd time within a minute (counted from the first copy). */
  function repeated(msg, text) {
    const key = `${msg.platform}:${msg.author?.id || msg.author?.login || ''}`;
    const t = now(), same = fold(text).replace(/\s+/g, ' ').trim();
    const prev = last.get(key);
    const n = prev && prev.text === same && t - prev.at < REPEAT_MS ? prev.n + 1 : 1;
    last.set(key, { text: same, n, at: n === 1 ? t : prev.at });
    if (last.size > 5000) for (const [k, v] of last) if (t - v.at >= REPEAT_MS) last.delete(k);
    return same !== '' && n >= REPEAT_COUNT;
  }
  return msg => {
    const roles = msg.author?.roles || [];
    if (msg.flags?.self || roles.includes('broadcaster') || roles.includes('moderator')) return null;
    if (s.exemptVip && roles.includes('vip')) return null;
    if (s.exemptSub && (roles.includes('subscriber') || roles.includes('member'))) return null;
    const text = String(msg.text || '');
    if (s.repeat && repeated(msg, text)) return 'repeat'; // first: every message must be counted
    if (re && re.test(fold(text))) return 'word';
    if (s.links && badLink(text)) return 'link';
    // Caps and symbols look at what the person typed, not at emote names ("LUL", "PogChamp") or links.
    const tokens = Array.isArray(msg.tokens) && msg.tokens.length ? msg.tokens : null;
    const typed = tokens ? tokens.filter(k => k.t === 'text').map(k => k.v).join(' ') : text;
    if (s.caps) {
      const upper = count(typed, /\p{Lu}/gu), cased = upper + count(typed, /\p{Ll}/gu);
      if (upper >= CAPS_MIN && upper >= cased * CAPS_SHARE) return 'caps';
    }
    if (s.emotes && (tokens ? tokens.filter(k => k.t === 'emote').length : 0) + count(typed, /\p{Extended_Pictographic}/gu) > EMOTES_MAX) return 'emotes';
    if (s.symbols) {
      const symbols = count(typed, /[^\p{L}\p{N}\s\p{Extended_Pictographic}\p{M}‍]/gu), visible = count(typed, /\S/gu);
      if (symbols >= SYMBOLS_MIN && symbols > visible * SYMBOLS_SHARE) return 'symbols';
    }
    return null;
  };
}

export function createAutomod(ctx) {
  let current = { ...DEFAULTS, ...ctx.settings.get('automod', {}) };
  let match = matcher(current);

  /** Delete on the platform, then time out if asked. Best effort: the message is already hidden in the dock and overlay. */
  async function act(msg, why) {
    const account = ctx.accounts.get(msg.accountId);
    const adapter = account && ctx.adapterFor(account);
    if (typeof adapter?.moderate !== 'function') return;
    const caps = ctx.accounts.describe(account).caps || {};
    const reason = `Tramevia Dock: ${REASONS[why] || 'banned word'}`;
    const run = async action => {
      try {
        const r = await adapter.moderate(ctx, account, action);
        if (r?.ok === false) ctx.log.warn(`[automod] ${action.action} refused on ${account.id}: ${r.error || ''}`);
      } catch (err) { ctx.log.warn(`[automod] ${action.action} failed on ${account.id}: ${err.message}`); }
    };
    if (caps.deleteMessage) await run({ action: 'delete', messageId: msg.id, reason });
    if (current.action === 'timeout' && caps.timeout && msg.author?.id) {
      const { timeoutMin = 1, timeoutMax = MAX_TIMEOUT } = caps.limits || {};
      const duration = Math.min(Math.max(current.duration, timeoutMin), timeoutMax);
      await run({ action: 'timeout', userId: String(msg.author.id), userLogin: msg.author.login, duration, reason });
    }
  }

  return {
    get: () => current,
    set(s) { ctx.settings.set('automod', s); current = s; match = matcher(s); },
    /** Called on every incoming chat message before it is published. Marks it deleted + flags.filtered when it matches. */
    check(msg) {
      const why = match(msg);
      if (!why) return null;
      msg.deleted = true;
      msg.flags = { ...msg.flags, filtered: why };
      queueMicrotask(() => act(msg, why)); // after the publish: the platform's delete echo then finds the message
      return why;
    },
  };
}
