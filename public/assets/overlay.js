// Chat overlay for OBS browser sources (/overlay/chat): read-only, transparent, configured only by URL params.
// ?key=&theme=dark|light|transparent&max=12&fade=0&platforms=&accounts=&hideBots=1&hideCommands=1&badges=0&icons=0
//  &avatars=1&size=18&align=left|right&events=1&bubble=1&outline=1&mode=featured&featureSeconds=0&credit=1
import { boot, h, query, addI18n, t } from '/assets/core.js';
import { renderMessage, renderEvent } from '/assets/chat-render.js';

addI18n({ fr: { 'overlay.title': 'Overlay du chat' }, en: { 'overlay.title': 'Chat overlay' } });

const num = (k, d, min, max) => {
  const v = Number(query.get(k));
  return query.get(k) !== null && query.get(k) !== '' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
};
const flag = (k, d) => (query.has(k) ? ['1', 'true', 'yes'].includes(query.get(k)) : d);
const csv = k => (query.get(k) || '').split(',').map(s => s.trim()).filter(Boolean);
const theme = ['dark', 'light', 'transparent'].includes(query.get('theme')) ? query.get('theme') : 'transparent';
const P = {
  max: num('max', 12, 1, 100), fade: num('fade', 0, 0, 3600), size: num('size', 0, 8, 120),
  platforms: csv('platforms').map(p => p.toLowerCase()), accounts: csv('accounts'),
  hideBots: flag('hideBots', false), hideCommands: flag('hideCommands', false), events: flag('events', true),
  featured: query.get('mode') === 'featured', featureSeconds: num('featureSeconds', 0, 0, 3600),
};
const BOTS = new Set(['nightbot', 'streamelements', 'moobot', 'streamlabs', 'fossabot', 'wizebot', 'sery_bot', 'botrixoficial', 'kickbot', 'soundalerts']);
const opts = {
  light: theme === 'light', readable: true, links: false, timestamps: false, channel: false,
  badges: flag('badges', true), icons: flag('icons', true), avatars: flag('avatars', false),
};

const root = document.documentElement;
root.dataset.overlay = theme;
if (P.size) root.style.setProperty('--ov-fs', `${P.size}px`);
for (const [cls, on] of [['ov-right', query.get('align') === 'right'], ['ov-bubble', flag('bubble', false)], ['ov-outline', flag('outline', false)], ['ov-featured', P.featured]]) {
  root.classList.toggle(cls, on);
}

const list = h('div.ov-list', { attrs: { 'aria-live': 'off' } });
let featureTimer = 0;

function wanted(kind, d) {
  if (P.platforms.length && !P.platforms.includes(d.platform)) return false;
  if (P.accounts.length && !P.accounts.includes(d.accountId)) return false;
  if (kind === 'event') return P.events;
  if (d.deleted) return false;
  if (P.hideCommands && String(d.text || '').trimStart().startsWith('!')) return false;
  if (P.hideBots && (d.author?.roles?.includes('bot') || BOTS.has(String(d.author?.login || '').toLowerCase()))) return false;
  return true;
}

function remove(el) {
  if (!el.isConnected || el.classList.contains('gone')) return;
  el.classList.add('gone');
  setTimeout(() => el.remove(), 450);
}

function add(kind, d, age = 0) {
  if (P.featured || !wanted(kind, d)) return;
  const el = kind === 'chat' ? renderMessage(d, opts) : renderEvent(d, opts);
  // The same id again (YouTube Jewels combos): replace that card in place instead of adding a second one.
  const old = d.id && [...list.children].find(c => !c.classList.contains('gone') && c.classList.contains(kind === 'chat' ? 'msg' : 'evt')
    && c.dataset.id === String(d.id) && c.dataset.account === String(d.accountId || ''));
  if (old) { el.style.setProperty('animation', 'none'); old.replaceWith(el); } else list.append(el);
  const alive = [...list.children].filter(c => !c.classList.contains('gone'));
  for (const extra of alive.slice(0, Math.max(0, alive.length - P.max))) remove(extra);
  if (P.fade) setTimeout(() => remove(el), Math.max(0, P.fade * 1000 - age));
}

/** replayed = the copy the server resends after 'hello' (reconnect, OBS refresh): it only gets the time it had left. */
function showFeatured(m, replayed = false) {
  clearTimeout(featureTimer);
  for (const old of list.children) remove(old);
  const left = P.featureSeconds * 1000 - (replayed && m?.featuredAt ? Math.max(0, Date.now() - m.featuredAt) : 0);
  // A deleted (moderated) message never goes back on stream.
  if (!m || m.deleted || (P.featureSeconds && left <= 0)) return;
  if ((P.platforms.length && !P.platforms.includes(m.platform)) || (P.accounts.length && !P.accounts.includes(m.accountId))) return;
  list.append(h('div.feat-card', { class: `pf-${String(m.platform).replace(/[^a-z]/g, '')}` }, renderMessage(m, { ...opts, avatars: true })));
  if (P.featureSeconds) featureTimer = setTimeout(() => showFeatured(null), left);
}

let afterHello = false;
function onFrame({ t: type, d }) {
  const replayed = afterHello;
  afterHello = type === 'hello';
  if (type === 'hello') {
    list.replaceChildren();
    if (P.featured) return;
    const now = Date.now();
    const recent = (d.backlog || []).filter(f => (f.t === 'chat' || f.t === 'event') && wanted(f.t, f.d) && (!P.fade || now - f.d.ts < P.fade * 1000));
    for (const f of recent.slice(-P.max)) add(f.t, f.d, now - f.d.ts);
  } else if (type === 'chat' || type === 'event') add(type, d);
  else if (type === 'chat:delete') {
    for (const el of list.querySelectorAll('.msg')) {
      if (el.dataset.account !== d.accountId) continue;
      if (d.messageId ? el.dataset.id === d.messageId : d.userId ? el.dataset.user === String(d.userId) : true) remove(el.closest('.feat-card') || el);
    }
  } else if (type === 'feature' && P.featured) showFeatured(d, replayed);
}

boot({
  page: '/overlay/chat', title: t('overlay.title'), header: false, admin: false,
  onReady(state, app) {
    app.classList.add('ov');
    app.append(list);
    if (flag('credit', false)) app.append(h('div.ov-credit', 'Chat via Tramevia Dock')); // opt-in, off by default
  },
  onFrame,
});
