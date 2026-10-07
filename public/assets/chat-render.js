// Shared chat/event renderer for the dock (/chat, /events) and the overlay (/overlay/chat).
// Chat content is attacker-controlled: DOM nodes + textContent only, <img> only for http(s) URLs.
import { h, svg, t, addI18n, fmt, icon, platformIcon, lang } from '/assets/core.js';

addI18n({
  fr: {
    'chat.first': 'Premier message', 'chat.replyTo': 'En réponse', 'chat.deletedTag': 'supprimé',
    'chat.role.broadcaster': 'Streamer', 'chat.role.moderator': 'Modérateur', 'chat.role.vip': 'VIP',
    'chat.role.subscriber': 'Abonné', 'chat.role.member': 'Membre', 'chat.role.verified': 'Vérifié',
    'chat.role.bot': 'Bot', 'chat.role.staff': 'Staff',
    'chat.evt.follow': '{user} suit désormais la chaîne', 'chat.evt.sub': '{user} s’est abonné', 'chat.evt.resub': '{user} s’est réabonné',
    'chat.evt.giftsub': '{user} a offert {count} abonnement', 'chat.evt.giftsub|plural': '{user} a offert {count} abonnements',
    'chat.evt.cheer': '{user} a envoyé {count} bit', 'chat.evt.cheer|plural': '{user} a envoyé {count} bits',
    'chat.evt.kicks': '{user} a envoyé {count} KICK', 'chat.evt.kicks|plural': '{user} a envoyé {count} KICKs',
    'chat.evt.superchat': '{user} a envoyé un Super Chat',
    'chat.evt.supersticker': '{user} a envoyé un Super Sticker', 'chat.evt.membership': '{user} est devenu membre',
    'chat.evt.giftmembership': '{user} a offert {count} abonnement de membre', 'chat.evt.giftmembership|plural': '{user} a offert {count} abonnements de membre',
    'chat.evt.raid': '{user} a lancé un raid avec {count} spectateur', 'chat.evt.raid|plural': '{user} a lancé un raid avec {count} spectateurs',
    'chat.evt.redemption': '{user} a utilisé « {label} »', 'chat.evt.gift': '{user} a envoyé {label} ×{count}', 'chat.gift': 'un cadeau',
    'chat.evt.like': '{user} a envoyé {count} j’aime', 'chat.evt.likeMany': '{count} j’aime reçu', 'chat.evt.likeMany|plural': '{count} j’aime reçus',
    'chat.evt.share': '{user} a partagé le live',
    'chat.evt.announcement': 'Annonce de {user}', 'chat.evt.announcementAnon': 'Annonce',
    'chat.evt.stream_online': 'Le live a commencé', 'chat.evt.stream_offline': 'Le live est terminé',
    'chat.evt.other': '{user} · {type}', 'chat.evt.someone': 'Quelqu’un',
    'chat.tier': 'Palier {n}', 'chat.prime': 'Prime', 'chat.months': '{count} mois', 'chat.points': '{count} point', 'chat.points|plural': '{count} points',
    'chat.diamonds': '{count} diamant', 'chat.diamonds|plural': '{count} diamants', 'chat.jewels': '{count} Jewel', 'chat.jewels|plural': '{count} Jewels',
    'chat.giftTo': 'pour {name}',
  },
  en: {
    'chat.first': 'First message', 'chat.replyTo': 'Replying', 'chat.deletedTag': 'deleted',
    'chat.role.broadcaster': 'Broadcaster', 'chat.role.moderator': 'Moderator', 'chat.role.vip': 'VIP',
    'chat.role.subscriber': 'Subscriber', 'chat.role.member': 'Member', 'chat.role.verified': 'Verified',
    'chat.role.bot': 'Bot', 'chat.role.staff': 'Staff',
    'chat.evt.follow': '{user} followed', 'chat.evt.sub': '{user} subscribed', 'chat.evt.resub': '{user} resubscribed',
    'chat.evt.giftsub': '{user} gifted {count} sub', 'chat.evt.giftsub|plural': '{user} gifted {count} subs',
    'chat.evt.cheer': '{user} cheered {count} bit', 'chat.evt.cheer|plural': '{user} cheered {count} bits',
    'chat.evt.kicks': '{user} sent {count} KICK', 'chat.evt.kicks|plural': '{user} sent {count} KICKs',
    'chat.evt.superchat': '{user} sent a Super Chat',
    'chat.evt.supersticker': '{user} sent a Super Sticker', 'chat.evt.membership': '{user} became a member',
    'chat.evt.giftmembership': '{user} gifted {count} membership', 'chat.evt.giftmembership|plural': '{user} gifted {count} memberships',
    'chat.evt.raid': '{user} is raiding with {count} viewer', 'chat.evt.raid|plural': '{user} is raiding with {count} viewers',
    'chat.evt.redemption': '{user} redeemed “{label}”', 'chat.evt.gift': '{user} sent {label} ×{count}', 'chat.gift': 'a gift',
    'chat.evt.like': '{user} sent {count} like', 'chat.evt.like|plural': '{user} sent {count} likes',
    'chat.evt.likeMany': '{count} like received', 'chat.evt.likeMany|plural': '{count} likes received',
    'chat.evt.share': '{user} shared the live',
    'chat.evt.announcement': 'Announcement from {user}', 'chat.evt.announcementAnon': 'Announcement',
    'chat.evt.stream_online': 'Stream started', 'chat.evt.stream_offline': 'Stream ended',
    'chat.evt.other': '{user} · {type}', 'chat.evt.someone': 'Someone',
    'chat.tier': 'Tier {n}', 'chat.prime': 'Prime', 'chat.months': '{count} month', 'chat.months|plural': '{count} months',
    'chat.points': '{count} point', 'chat.points|plural': '{count} points',
    'chat.diamonds': '{count} diamond', 'chat.diamonds|plural': '{count} diamonds', 'chat.jewels': '{count} Jewel', 'chat.jewels|plural': '{count} Jewels',
    'chat.giftTo': 'to {name}',
  },
});

// ------------------------------------------------------------------ safety helpers
/** Absolute http(s) URL (protocol-relative allowed) or ''. */
export function safeUrl(u) {
  if (typeof u !== 'string' || !u) return '';
  try {
    const url = new URL(u.startsWith('//') ? 'https:' + u : u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}
const cls = s => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

// ------------------------------------------------------------------ colors
// Worst-case row backgrounds in chat.css: the lightest dark one (.keyword tint) and the darkest light one (.mention-me tint).
const BG = { dark: [46, 39, 21], light: [236, 217, 220] };
const parseHex = c => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(c || '').trim());
  if (!m) return null;
  const x = m[1].length === 3 ? [...m[1]].map(d => d + d).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
};
const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const lum = rgb => {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function toHsl([r, g, b]) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, d / (1 - Math.abs(2 * l - 1)), l];
}
function fromHsl([hue, s, l]) {
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + hue / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
}
const colorCache = new Map();
/** Keep the hue, move lightness until the name reads at ≥4.5:1 on every row background of the theme. */
export function readableColor(color, light = false) {
  const key = `${color}|${light}`;
  if (colorCache.has(key)) return colorCache.get(key);
  let rgb = parseHex(color);
  if (rgb) {
    const bg = light ? BG.light : BG.dark;
    const hsl = toHsl(rgb);
    for (let i = 0; i < 25 && ratio(rgb, bg) < 4.5; i++) {
      hsl[2] = Math.min(1, Math.max(0, hsl[2] + (light ? -0.04 : 0.04)));
      rgb = fromHsl(hsl);
    }
  }
  const out = rgb ? toHex(rgb) : '';
  if (colorCache.size > 2000) colorCache.clear();
  colorCache.set(key, out);
  return out;
}
/** Pleasant deterministic color for users without one (hash of id/login → hue). */
export function seedColor(seed) {
  let n = 0;
  for (const ch of String(seed || '?')) n = (n * 31 + ch.codePointAt(0)) >>> 0;
  return toHex(fromHsl([n % 360, 0.68, 0.64]));
}
function nameColor(author, o) {
  const raw = parseHex(author.color) ? author.color : seedColor(author.id || author.login || author.name);
  return o.readable === false ? (parseHex(raw) ? raw : '') : readableColor(raw, Boolean(o.light));
}

// ------------------------------------------------------------------ badges & roles
const ROLE_PATHS = {
  broadcaster: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5zM16 10.5l5-3v9l-5-3z',
  moderator: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z',
  vip: 'M6 3h12l4 6-10 12L2 9z',
  subscriber: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  member: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  verified: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z',
  bot: 'M11 2h2v3h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5zM8.5 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 15v1.5h8V15z',
  staff: 'M13 2 3 14h9l-1 8 10-12h-9z',
};
export const ROLES = Object.keys(ROLE_PATHS);
/** Compact role glyph (used when the platform gives no badge image). */
export function roleGlyph(role) {
  if (!ROLE_PATHS[role]) return null;
  const el = h(`span.role.role-${role}`, { title: t(`chat.role.${role}`), attrs: { role: 'img', 'aria-label': t(`chat.role.${role}`) } });
  el.append(svg(`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${ROLE_PATHS[role]}"/></svg>`));
  return el;
}
// Badge images that already stand for a role (Twitch set ids; an adapter may also tag a badge with `role`).
const BADGE_ROLE = {
  broadcaster: 'broadcaster', moderator: 'moderator', lead_moderator: 'moderator', vip: 'vip', subscriber: 'subscriber',
  founder: 'subscriber', staff: 'staff', admin: 'staff', global_mod: 'staff', partner: 'verified',
};
/** Role glyphs for roles no badge image represents (Kick/TikTok cosmetic badges carry no role), then the images. */
export function badges(author) {
  const list = (Array.isArray(author.badges) ? author.badges : []).filter(b => safeUrl(b?.url)).slice(0, 6);
  const covered = new Set(list.map(b => b.role || (Object.hasOwn(BADGE_ROLE, b.id) ? BADGE_ROLE[b.id] : '')));
  const roles = (Array.isArray(author.roles) ? author.roles : []).filter(r => !covered.has(r)).map(roleGlyph).filter(Boolean);
  const imgs = list.map(b => h('img.badge-img', { src: safeUrl(b.url), alt: String(b.title || b.id || ''), title: String(b.title || b.id || '') }));
  return roles.length || imgs.length ? h('span.msg-badges', roles, imgs) : null;
}

// ------------------------------------------------------------------ tokens
function emote(tok) {
  const src = safeUrl(tok.url);
  const name = String(tok.name || '');
  if (!src) return name;
  const img = h('img.emote', { src, alt: name, title: name, decoding: 'async', attrs: { draggable: 'false' } });
  img.addEventListener('error', () => img.replaceWith(name), { once: true });
  const zw = (Array.isArray(tok.zw) ? tok.zw : []).filter(z => safeUrl(z?.url))
    .map(z => h('img.emote.zw', { src: safeUrl(z.url), alt: '', title: String(z.name || ''), attrs: { draggable: 'false' } }));
  if (!zw.length) return img;
  img.title = [name, ...zw.map(z => z.title)].join(' + ');
  return h('span.emote-stack', img, zw);
}

function renderTokens(tokens, text, o) {
  if (!Array.isArray(tokens) || !tokens.length) return [String(text || '')];
  return tokens.map(tok => {
    switch (tok?.t) {
      case 'text': return String(tok.v ?? '');
      case 'emote': return emote(tok);
      case 'mention': {
        const v = String(tok.v ?? '');
        return h('span.mention', v.startsWith('@') ? v : '@' + v);
      }
      case 'link': {
        const href = safeUrl(tok.href || tok.v);
        if (!href || o.links === false) return h('span.link', String(tok.v ?? ''));
        return h('a.link', { href, target: '_blank', rel: 'noopener noreferrer', title: href }, String(tok.v ?? ''));
      }
      case 'cheer': {
        const src = safeUrl(tok.url);
        const color = parseHex(tok.color) ? tok.color : '';
        return h('span.cheer', { style: color ? { '--cheer': color } : undefined },
          src && h('img.emote', { src, alt: String(tok.name || ''), title: String(tok.name || '') }), fmt.number(Number(tok.amount) || 0));
      }
      default: return String(tok?.v ?? tok?.name ?? tok?.text ?? '');
    }
  });
}

/** Regex matching @login for any connected account (self-mention highlight). */
export function mentionRegex(logins) {
  const list = [...new Set(logins.filter(Boolean).map(l => String(l).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))];
  return list.length ? new RegExp(`(^|[^\\w])@?(${list.join('|')})(?![\\w])`, 'i') : null;
}

// ------------------------------------------------------------------ messages
/**
 * renderMessage(msg, {light, readable, timestamps, icons, badges, avatars, links, mentionRe, keywords, first})
 * Classes: first, highlight, mention-me, keyword, self, action, deleted.
 */
export function renderMessage(msg, o = {}) {
  const a = msg.author && typeof msg.author === 'object' ? msg.author : {};
  const flags = msg.flags || {};
  const name = String(a.name || a.login || '?');
  const color = nameColor(a, o);
  const text = String(msg.text || '');
  const lower = text.toLowerCase();
  const classes = ['msg', `pf-${cls(msg.platform)}`];
  if (flags.first) classes.push('first');
  if (flags.highlight) classes.push('highlight');
  if (flags.self) classes.push('self');
  else if (o.mentionRe?.test(text)) classes.push('mention-me');
  if (!flags.self && o.keywords?.some(k => k && lower.includes(k))) classes.push('keyword');
  if (flags.action) classes.push('action');
  if (msg.deleted) classes.push('deleted');
  const reply = msg.reply && typeof msg.reply === 'object' ? msg.reply : null;
  const avatarUrl = o.avatars && safeUrl(a.avatar);
  return h('div', { class: classes.join(' '), style: color ? { '--c': color } : undefined, dataset: { id: String(msg.id || ''), account: String(msg.accountId || ''), user: String(a.id ?? '') } },
    reply && h('div.msg-reply', icon('reply', 12),
      h('span.ellipsis', reply.author ? h('b', '@' + String(reply.author)) : t('chat.replyTo'), reply.text ? ' ' + String(reply.text) : '')),
    flags.first && o.firstTag !== false && h('div.msg-tag', icon('star', 11), t('chat.first')),
    h('div.msg-line',
      o.timestamps !== false && msg.ts ? h('time.msg-time', { dateTime: new Date(msg.ts).toISOString() }, fmt.time(msg.ts)) : null,
      o.icons !== false && platformIcon(cls(msg.platform)),
      o.avatars && (avatarUrl ? h('img.msg-avatar', { src: avatarUrl, alt: '' }) : h('span.msg-avatar', { attrs: { 'aria-hidden': 'true' } }, [...name][0].toUpperCase())),
      o.badges !== false && badges(a),
      h('span.msg-author', { title: a.login && a.login !== name.toLowerCase() ? `${name} (${a.login})` : name }, name),
      h('span.msg-sep', flags.action ? ' ' : ': '),
      h('span.msg-text', renderTokens(msg.tokens, text, o))));
}

// ------------------------------------------------------------------ events
const EVENT_ICONS = {
  follow: 'heart', sub: 'star', resub: 'star', giftsub: 'gift', cheer: 'zap', kicks: 'zap', superchat: 'chat', supersticker: 'star',
  membership: 'star', giftmembership: 'gift', raid: 'users', redemption: 'bookmark', gift: 'gift', like: 'heart',
  share: 'external', announcement: 'info', stream_online: 'play', stream_offline: 'pause',
};
const TIERS = {
  // YouTube Super Chat colors by amount (major currency units) and Twitch cheer tiers.
  superchat: [[100, '#e62117'], [50, '#e91e63'], [20, '#f57c00'], [10, '#ffca28'], [5, '#1de9b6'], [2, '#00e5ff'], [0, '#1e88e5']],
  cheer: [[10000, '#f43021'], [5000, '#0099fe'], [1000, '#1db2a5'], [100, '#9c3ee8'], [0, '#979797']],
};
TIERS.supersticker = TIERS.superchat;
/** Legacy 'tiktok_gift' (before SPEC v2) is a 'gift'. */
const typeOf = evt => (evt.type === 'tiktok_gift' ? 'gift' : String(evt.type || ''));
/** t() with the plural picked from the raw number n and {count} shown as an exact localized number ('1 500' in FR). */
const count = (key, n, vars) => t(key, { ...vars, n, count: new Intl.NumberFormat(lang()).format(n) });

export function money(amount, currency) {
  const n = Number(amount) || 0;
  if (!/^[A-Z]{3}$/.test(String(currency || ''))) return fmt.number(n);
  try { return new Intl.NumberFormat(lang(), { style: 'currency', currency }).format(n); } catch { return `${n} ${currency}`; }
}

function eventTitle(evt, type) {
  const userName = String(evt.user?.name || evt.user?.login || '') || t('chat.evt.someone');
  const n = Number(type === 'cheer' || type === 'kicks' ? evt.amount : evt.count) || 0;
  const key = !Object.hasOwn(EVENT_ICONS, type) ? 'chat.evt.other'
    : !evt.user && type === 'announcement' ? 'chat.evt.announcementAnon'
      : !evt.user && type === 'like' ? 'chat.evt.likeMany' : `chat.evt.${type}`;
  // Translate everything but {user}, then splice the name in as <b>.
  const tpl = count(key, n, { label: String(evt.label || '') || (type === 'gift' ? t('chat.gift') : ''), type });
  return tpl.split('{user}').flatMap((part, i) => (i ? [h('b.evt-user', userName), part] : [part]));
}

function eventDetails(evt, type) {
  const out = [];
  const tier = String(evt.tier || ''), label = String(evt.label || '');
  const prime = label.toLowerCase() === 'prime' || tier.toLowerCase() === 'prime'; // Twitch: label 'Prime' + tier '1000'
  if (prime) out.push(t('chat.prime'));
  else if (tier) out.push(/^[123]000$/.test(tier) ? t('chat.tier', { n: tier[0] }) : tier);
  if (evt.months) out.push(count('chat.months', Number(evt.months) || 0));
  if (type === 'redemption' && evt.amount) out.push(count('chat.points', Number(evt.amount) || 0));
  if (type === 'gift' && evt.amount) {
    const unit = evt.unit || (evt.platform === 'youtube' ? 'jewels' : 'diamonds');
    out.push(count(unit === 'jewels' ? 'chat.jewels' : 'chat.diamonds', Number(evt.amount) || 0));
  }
  // label = gift recipient (giftsub), Power-up (cheer), Super Fan (TikTok sub), KICKs gift, membership level.
  if (type === 'giftsub' && label) out.push(t('chat.giftTo', { name: label }));
  else if (!prime && label && ['sub', 'resub', 'cheer', 'kicks', 'membership', 'giftmembership', 'supersticker'].includes(type)) out.push(label);
  return out;
}

/** Event card: icon (or gift image), title with the user in bold, details, optional message, amount pill for money. */
export function renderEvent(evt, o = {}) {
  const type = typeOf(evt);
  const tier = Object.hasOwn(TIERS, type) && TIERS[type].find(([min]) => Number(evt.amount) >= min)?.[1];
  const details = eventDetails(evt, type);
  const isMoney = type === 'superchat' || type === 'supersticker';
  const hasText = (Array.isArray(evt.tokens) && evt.tokens.length) || evt.text;
  const glyph = () => icon(Object.hasOwn(EVENT_ICONS, type) ? EVENT_ICONS[type] : 'info', 15);
  const src = safeUrl(evt.image);
  const art = src ? h('img', { src, alt: '', decoding: 'async' }) : null;
  art?.addEventListener('error', () => art.replaceWith(glyph()), { once: true });
  return h('div', { class: `evt evt-${cls(type)} pf-${cls(evt.platform)}`, style: tier ? { '--evt': tier } : undefined, dataset: { id: String(evt.id || ''), account: String(evt.accountId || '') } },
    h('span.evt-icon', art || glyph()),
    h('div.evt-body',
      h('div.evt-title', eventTitle(evt, type)),
      hasText && h('div.evt-text', renderTokens(evt.tokens, evt.text, o)),
      h('div.evt-meta',
        o.icons !== false && platformIcon(cls(evt.platform)),
        details.map(d => h('span', d)),
        o.channel && evt.channel && h('span', String(evt.channel)),
        o.timestamps !== false && evt.ts ? h('time', { dateTime: new Date(evt.ts).toISOString() }, fmt.time(evt.ts)) : null)),
    isMoney && evt.amount ? h('span.evt-amount', money(evt.amount, evt.currency)) : null);
}
