// Chat overlay settings: one source of truth for the server (src/overlays.js), the overlay page and the dashboard builder.
// Pure module (no DOM, no imports): Node can import it from src/, browsers from /assets/.
//
// Two kinds of overlay URL:
//  - saved:  /overlay/chat?key=…&id=chat|featured|alerts|viewers|poll|goal → settings stored on the server, applied live; any param below that
//            the URL also carries overrides that one setting (a variant for another scene, the builder's draft preview).
//  - legacy: /overlay/chat?key=…&theme=…&max=…     → no id: configured only by its params, exactly like before 1.3.

export const OVERLAY_IDS = ['chat', 'featured', 'alerts', 'viewers', 'poll', 'goal'];
export const BOOLS = ['hideBots', 'hideCommands', 'events', 'badges', 'icons', 'avatars', 'bubble', 'outline', 'credit'];
export const THEMES = ['transparent', 'dark', 'light'];
export const POSITIONS = ['top', 'center', 'bottom'];
export const GOALS = ['subs', 'follows', 'both']; // goal overlay: which goal it shows
export const LOOKS = ['bars', 'ring']; // poll and goal overlays: bars, or a ring gauge
/** Goal overlay: the icon of each goal (drawn by overlay-widgets.js). */
/** Goal overlay colour: 'tramevia' (the stream gradients) or any '#rrggbb'; these are the builder's suggestions. */
export const GOAL_COLORS = ['#ffffff', '#94a3b8', '#8ab4ff', '#22d3ee', '#34d399', '#a3e635', '#fbbf24', '#fb923c', '#ef4444', '#f472b6', '#a78bfa'];
const HEX = /^#[0-9a-f]{6}$/i;
export const GOAL_ICONS = ['star', 'heart', 'user-plus', 'users', 'trophy', 'crown', 'award', 'flag', 'target', 'rocket', 'zap', 'flame', 'gem', 'sparkles', 'gamepad', 'music', 'coffee', 'gift'];
export const ALIGNS = ['left', 'center', 'right']; // chat: left | right (anything else = left) · viewers: the number beside or inside the orb
export const STYLES = ['card', 'text', 'impact', 'eclipse', 'glass', 'switch', 'wave', 'prism', 'silk', 'neon']; // alerts: glass card · big kinetic text · impact (physical, product shot) · eclipse (lines of light) · glass (frosted glass lit from behind) · switch (a clay rocker switch that lights up) · wave (a breaking wave of white particles) · prism (glass bars like an equalizer) · silk (a sphere of silk sheets) · neon (the name on a ring of neon letters)
/** Supporter styles: only a supporter code unlocks them (src/supporter.js). */
export const SUPPORTER_STYLES = new Set(['impact', 'eclipse', 'glass', 'switch', 'wave', 'prism', 'silk', 'neon']);
/** True when `style` is a supporter style and this install has no valid supporter code. */
export const isLocked = (style, unlocked) => !unlocked && SUPPORTER_STYLES.has(style);
/** [min, max] of every number (the overlay page clamps URL values to the same ranges). */
export const RANGES = { max: [1, 100], fade: [0, 3600], size: [8, 120], featureSeconds: [0, 3600], alertSeconds: [1, 60], volume: [0, 100] };
const LIST_MAX = 50;

/** Alert categories (the builder's toggles, `offTypes`) and the event types each one covers. Other event types never alert. */
export const ALERT_TYPES = {
  follow: ['follow'], sub: ['sub', 'resub', 'membership'], giftsub: ['giftsub', 'giftmembership'],
  tip: ['cheer', 'kicks', 'superchat', 'supersticker', 'gift'], raid: ['raid'], redemption: ['redemption'], like: ['like'], share: ['share'],
};
const CATEGORY = Object.fromEntries(Object.entries(ALERT_TYPES).flatMap(([cat, types]) => types.map(t => [t, cat])));
/** Alert category of an event type ('tiktok_gift' = legacy 'gift'), or null when that type never alerts. */
export const alertCategory = type => CATEGORY[type === 'tiktok_gift' ? 'gift' : type] ?? null;

const SAVED_BASE = {
  theme: 'dark', max: 20, fade: 0, size: 16, align: 'left', featureSeconds: 15, alertSeconds: 6, position: 'top', style: 'card', volume: 60,
  hideBots: true, hideCommands: true, events: true, badges: true, icons: true, avatars: false, bubble: false, outline: true, credit: false,
  offPlatforms: [], offAccounts: [], offTypes: [], goal: 'subs', look: 'bars', color: 'tramevia', subsIcon: 'star', followsIcon: 'heart',
};
/** Defaults of a saved overlay (what the dashboard builder starts from). */
export const DEFAULTS = { chat: { ...SAVED_BASE }, featured: { ...SAVED_BASE }, alerts: { ...SAVED_BASE, size: 28 },
  viewers: { ...SAVED_BASE, theme: 'transparent', size: 28, align: 'center' },
  poll: { ...SAVED_BASE, size: 20 }, goal: { ...SAVED_BASE, size: 20 } };

/** What a legacy URL means when a param is missing (the overlay page's behaviour before saved overlays). size null = CSS default. */
export const LEGACY = {
  theme: 'transparent', max: 12, fade: 0, size: null, align: 'left', featureSeconds: 0, alertSeconds: 6, position: 'top', style: 'card', volume: 60,
  hideBots: false, hideCommands: false, events: true, badges: true, icons: true, avatars: false, bubble: false, outline: false, credit: false,
  offPlatforms: [], offAccounts: [], offTypes: [], goal: 'subs', look: 'bars', color: 'tramevia', subsIcon: 'star', followsIcon: 'heart',
};

const clamp = (n, [min, max]) => Math.min(max, Math.max(min, n));
const idList = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x && x.length <= 64))].slice(0, LIST_MAX) : []);

/**
 * Validated, complete saved settings: every known key present, unknown keys dropped, numbers rounded and clamped,
 * enums whitelisted. `input` may be partial or untrusted (an HTTP body); missing or invalid values come from `base`.
 */
export function cleanOverlay(input, base = SAVED_BASE) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  out.theme = THEMES.includes(src.theme) ? src.theme : base.theme;
  out.align = ALIGNS.includes(src.align) ? src.align : base.align;
  out.position = POSITIONS.includes(src.position) ? src.position : base.position;
  out.style = STYLES.includes(src.style) ? src.style : base.style;
  out.goal = GOALS.includes(src.goal) ? src.goal : base.goal;
  out.look = LOOKS.includes(src.look) ? src.look : base.look;
  out.color = src.color === 'tramevia' || HEX.test(src.color) ? src.color.toLowerCase() : base.color;
  for (const k of ['subsIcon', 'followsIcon']) out[k] = GOAL_ICONS.includes(src[k]) ? src[k] : base[k];
  for (const [k, range] of Object.entries(RANGES)) {
    const n = typeof src[k] === 'number' ? src[k] : typeof src[k] === 'string' && src[k].trim() !== '' ? Number(src[k]) : NaN;
    out[k] = Number.isFinite(n) ? clamp(Math.round(n), range) : base[k];
  }
  for (const k of BOOLS) out[k] = typeof src[k] === 'boolean' ? src[k] : base[k];
  for (const k of ['offPlatforms', 'offAccounts', 'offTypes']) out[k] = Array.isArray(src[k]) ? idList(src[k]) : idList(base[k]);
  return out;
}

/**
 * Settings the overlay page runs with.
 * query: URLSearchParams of the page. saved: { chat, featured } from the server (only used when the URL has a valid id).
 * unlocked: the install has a supporter code (else a `style` param naming a supporter style falls back to card).
 * Returns { id, featured, alerts, viewers, poll, goal, settings, onlyPlatforms, onlyAccounts }: id null = legacy URL; only* = inclusion lists from the URL.
 */
export function overlayFromQuery(query, saved, unlocked = false) {
  const id = OVERLAY_IDS.includes(query.get('id')) ? query.get('id') : null;
  const base = id ? cleanOverlay(saved?.[id], DEFAULTS[id]) : { ...LEGACY };
  const has = k => query.get(k) !== null && query.get(k) !== '';
  const s = { ...base };
  // Same parsing rules as the overlay page always had (1.0–1.2): numbers clamped, flags = 1/true/yes, unknown values ignored.
  for (const [k, range] of Object.entries(RANGES)) {
    const n = Number(query.get(k));
    if (has(k) && Number.isFinite(n)) s[k] = clamp(n, range);
  }
  for (const k of BOOLS) if (query.has(k)) s[k] = ['1', 'true', 'yes'].includes(query.get(k));
  if (THEMES.includes(query.get('theme'))) s.theme = query.get('theme');
  if (query.has('align')) s.align = ALIGNS.includes(query.get('align')) ? query.get('align') : 'left';
  if (POSITIONS.includes(query.get('position'))) s.position = query.get('position');
  if (STYLES.includes(query.get('style'))) s.style = query.get('style');
  if (GOALS.includes(query.get('goal'))) s.goal = query.get('goal');
  if (LOOKS.includes(query.get('look'))) s.look = query.get('look');
  const color = query.get('color'); // ?color=tramevia, ?color=%23ff8800 or ?color=ff8800
  if (color === 'tramevia' || HEX.test(color) || HEX.test('#' + color)) s.color = (color.startsWith('#') || color === 'tramevia' ? color : '#' + color).toLowerCase();
  for (const k of ['subsIcon', 'followsIcon']) if (GOAL_ICONS.includes(query.get(k))) s[k] = query.get(k);
  if (isLocked(s.style, unlocked)) s.style = 'card';
  const csv = k => (query.get(k) || '').split(',').map(x => x.trim()).filter(Boolean);
  const alerts = id === 'alerts', viewers = id === 'viewers', poll = id === 'poll', goal = id === 'goal';
  const featured = !alerts && !viewers && !poll && !goal && (has('mode') ? query.get('mode') === 'featured' : id === 'featured');
  return { id, featured, alerts, viewers, poll, goal, settings: s, onlyPlatforms: csv('platforms').map(p => p.toLowerCase()), onlyAccounts: csv('accounts') };
}
