// chat-render.js without a browser: '/assets/core.js' is swapped for a tiny DOM-free stub (same t() plural rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const stub = `
const node = (tag, cls = []) => ({ tag, cls, props: {}, children: [],
  append(...c) { this.children.push(...c.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false)); },
  addEventListener() {} });
export function h(spec, props, ...children) {
  if (typeof props !== 'object' || props === null || Array.isArray(props) || props.tag) { if (props != null) children.unshift(props); props = {}; }
  const [tag, ...cls] = spec.split('.');
  const el = node(tag, cls);
  if (props.class) el.cls.push(...String(props.class).split(' '));
  el.props = props;
  el.append(...children);
  return el;
}
export const svg = () => node('svg');
const dict = { fr: {}, en: {} };
let L = 'en';
export const lang = () => L;
export const setLang = v => { L = v; };
export const addI18n = d => { Object.assign(dict.fr, d.fr); Object.assign(dict.en, d.en); };
export function t(key, vars = {}) { // same plural rule as core.js
  const n = Math.abs(Number(vars.n));
  const plural = vars.n !== undefined && (L === 'fr' ? n >= 2 : n !== 1);
  let s = (plural && dict[L][key + '|plural']) || dict[L][key] || dict.en[key] || key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', String(v));
  return s;
}
export const fmt = { number: n => String(n), time: () => '12:00' };
export const icon = name => node('icon', [name]);
export const platformIcon = p => node('pf', [p]);
`;
registerHooks({
  resolve: (spec, ctx, next) => (spec === '/assets/core.js' ? { url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true } : next(spec, ctx)),
});
const { badges, renderEvent, readableColor } = await import('../public/assets/chat-render.js');
const { setLang } = await import('/assets/core.js');

const text = n => (typeof n === 'string' ? n : (n.children || []).map(text).join(''));
const find = (n, pred) => (typeof n === 'string' ? [] : [...(pred(n) ? [n] : []), ...n.children.flatMap(c => find(c, pred))]);
const has = cls => n => n.cls.includes(cls);

test('badges: role glyphs for roles no badge image covers (Kick cosmetic badge, Twitch bot)', () => {
  // Kick Pusher identity (test/kick.test.js): subscriber role badge without image + a selected 'level' badges_v2 image.
  const kick = badges({ roles: ['subscriber'], badges: [{ id: 'subscriber', title: 'Subscriber', url: '' }, { id: 'level', title: 'level 35', url: 'https://files.kick.com/b.png' }] });
  assert.equal(find(kick, has('role-subscriber')).length, 1);
  assert.equal(find(kick, has('badge-img')).length, 1);
  // Twitch: the moderator image already stands for the role; the bot role has no badge and keeps its glyph.
  const tw = badges({ roles: ['moderator', 'bot'], badges: [{ id: 'moderator', url: 'https://static-cdn.jtvnw.net/m.png' }] });
  assert.equal(find(tw, has('role-moderator')).length, 0);
  assert.equal(find(tw, has('role-bot')).length, 1);
  assert.equal(badges({ roles: ['subscriber'], badges: [{ id: 'x', role: 'subscriber', url: 'https://a/b.png' }] }).children.length, 1);
  assert.equal(badges({ roles: [], badges: [{ id: 'x', url: 'javascript:alert(1)' }] }), null);
});

test('events: gift (diamonds / jewels, legacy tiktok_gift), image, likes, plurals, Prime, recipient', () => {
  const ev = (o) => renderEvent({ id: 'e', platform: 'tiktok', accountId: 'a', ts: 0, user: { name: 'Bob' }, ...o }, { timestamps: false, icons: false });
  const gift = ev({ type: 'gift', label: 'Rose', count: 10, amount: 1500, unit: 'diamonds', image: 'https://p16.tiktokcdn.com/rose.png' });
  assert.ok(gift.cls.includes('evt-gift'));
  assert.equal(text(find(gift, has('evt-title'))[0]), 'Bob sent Rose ×10');
  assert.match(text(find(gift, has('evt-meta'))[0]), /1,500 diamonds/);
  assert.equal(find(gift, n => n.tag === 'img').length, 1);
  const yt = ev({ type: 'tiktok_gift', platform: 'youtube', label: 'Heart', count: 1, amount: 1 });
  assert.ok(yt.cls.includes('evt-gift'));
  assert.match(text(find(yt, has('evt-meta'))[0]), /^1 Jewel$/);
  assert.equal(text(find(ev({ type: 'like', user: null, count: 1 }), has('evt-title'))[0]), '1 like received');
  assert.equal(text(find(ev({ type: 'like', count: 42 }), has('evt-title'))[0]), 'Bob sent 42 likes');
  assert.equal(text(find(ev({ type: 'resub', tier: '1000', months: 1, label: 'Prime' }), has('evt-meta'))[0]), 'Prime1 month');
  assert.equal(text(find(ev({ type: 'giftsub', count: 1, tier: '2000', label: 'Alice' }), has('evt-meta'))[0]), 'Tier 2to Alice');
  assert.equal(text(find(ev({ type: 'constructor' }), has('evt-title'))[0]), 'Bob · constructor');
});

test('events: French plurals follow the number, not its grouped form (1 500 → plural)', t => {
  setLang('fr');
  t.after(() => setLang('en'));
  const title = o => text(find(renderEvent({ id: 'e', platform: 'twitch', accountId: 'a', ts: 0, user: { name: 'Bob' }, ...o }, { timestamps: false, icons: false }), has('evt-title'))[0]);
  const meta = o => text(find(renderEvent({ id: 'e', platform: 'twitch', accountId: 'a', ts: 0, user: { name: 'Bob' }, ...o }, { timestamps: false, icons: false }), has('evt-meta'))[0]);
  const g = new Intl.NumberFormat('fr').format(1500); // '1 500' with U+202F
  assert.equal(title({ type: 'raid', count: 1500 }), `Bob a lancé un raid avec ${g} spectateurs`);
  assert.equal(title({ type: 'raid', count: 1 }), 'Bob a lancé un raid avec 1 spectateur');
  assert.equal(title({ type: 'raid', count: 0 }), 'Bob a lancé un raid avec 0 spectateur');
  assert.equal(title({ type: 'cheer', amount: 1000 }), `Bob a envoyé ${new Intl.NumberFormat('fr').format(1000)} bits`);
  assert.equal(meta({ type: 'redemption', label: 'X', amount: 1000 }), `${new Intl.NumberFormat('fr').format(1000)} points`);
  assert.equal(title({ type: 'like', user: null, count: 12000 }), `${new Intl.NumberFormat('fr').format(12000)} j’aime reçus`);
});

test('readableColor: names reach 4.5:1 on the tinted rows, not only on the plain background', () => {
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Light: .mention-me / .highlight tints over #f4f5f9 (chat.css). Dark: .keyword / .highlight tints over #0d0e12.
  for (const c of ['#9249ff', '#996b00', '#ff0000', '#00ff7f', '#1e90ff', '#daa520']) {
    for (const bg of ['#ecd9dc', '#e4e0fa', '#f4f5f9']) assert.ok(ratio(readableColor(c, true), bg) >= 4.5, `${c} on ${bg}`);
    for (const bg of ['#2e2715', '#211d38', '#15171d']) assert.ok(ratio(readableColor(c, false), bg) >= 4.5, `${c} dark on ${bg}`);
  }
});
