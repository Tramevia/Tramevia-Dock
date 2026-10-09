// Chat overlay for OBS browser sources (/overlay/chat): read-only, transparent. Two kinds of URL:
//  - saved:  ?key=&id=chat|featured → settings stored on the server (dashboard builder), re-applied live on every change
//            without reloading; any setting param also in the URL overrides that one setting.
//  - legacy: ?key= without id → configured only by its params, as in 1.2, ignores live updates:
//            &theme=dark|light|transparent&max=12&fade=0&platforms=&accounts=&hideBots=1&hideCommands=1&badges=0&icons=0
//            &avatars=1&size=18&align=left|right&events=1&bubble=1&outline=1&mode=featured&featureSeconds=0&credit=1
// platforms=/accounts= are inclusion lists; saved settings exclude with offPlatforms/offAccounts. Parsing: overlay-settings.js.
import { boot, h, query, addI18n, t } from '/assets/core.js';
import { renderMessage, renderEvent } from '/assets/chat-render.js';
import { overlayFromQuery } from '/assets/overlay-settings.js';

addI18n({ fr: { 'overlay.title': 'Overlay du chat' }, en: { 'overlay.title': 'Chat overlay' } });

const BOTS = new Set(['nightbot', 'streamelements', 'moobot', 'streamlabs', 'fossabot', 'wizebot', 'sery_bot', 'botrixoficial', 'kickbot', 'soundalerts']);
const KEEP = 200; // live chat/event frames kept for a rebuild (max is 100, the rest absorbs filtering); the hello backlog is kept whole

const root = document.documentElement;
const list = h('div.ov-list', { attrs: { 'aria-live': 'off' } });
const credit = h('div.ov-credit', 'Chat via Tramevia Dock'); // opt-in, off by default
let app = null;
let saved = null; // { chat, featured } from the server (saved URLs only)
let C = overlayFromQuery(query, null); // { id, featured, settings: S, onlyPlatforms, onlyAccounts }
let S = C.settings;
let opts = {};
let frames = []; // { t, d, at } (at = receive time)
let feature = null; // last 'feature' payload, kept even in chat mode: { m, start }
let featureTimer = 0;

/** Root attributes, classes and render options from the current settings (idempotent). */
function apply() {
  S = C.settings;
  opts = { light: S.theme === 'light', readable: true, links: false, timestamps: false, channel: false, badges: S.badges, icons: S.icons, avatars: S.avatars };
  root.dataset.overlay = S.theme;
  if (C.id) root.dataset.theme = S.theme === 'light' ? 'light' : 'dark';
  if (S.size) root.style.setProperty('--ov-fs', `${S.size}px`); else root.style.removeProperty('--ov-fs');
  for (const [cls, on] of [['ov-right', S.align === 'right'], ['ov-bubble', S.bubble], ['ov-outline', S.outline], ['ov-featured', C.featured]]) root.classList.toggle(cls, on);
  if (app && S.credit) app.append(credit); else credit.remove();
}
if (!C.id) apply(); // legacy: at import time, as before; saved URLs wait for the server settings

function shown(d) {
  if (C.onlyPlatforms.length && !C.onlyPlatforms.includes(d.platform)) return false;
  if (C.onlyAccounts.length && !C.onlyAccounts.includes(d.accountId)) return false;
  return !S.offPlatforms.includes(d.platform) && !S.offAccounts.includes(d.accountId);
}

function wanted(kind, d) {
  if (!shown(d)) return false;
  if (kind === 'event') return S.events;
  if (d.deleted) return false;
  if (S.hideCommands && String(d.text || '').trimStart().startsWith('!')) return false;
  if (S.hideBots && (d.author?.roles?.includes('bot') || BOTS.has(String(d.author?.login || '').toLowerCase()))) return false;
  return true;
}

function remove(el) {
  if (!el.isConnected || el.classList.contains('gone')) return;
  el.classList.add('gone');
  setTimeout(() => el.remove(), 450);
}

/** still = rebuild after a settings change: no entrance animation. */
function add(kind, d, age = 0, still = false) {
  if (C.featured || !wanted(kind, d)) return;
  const el = kind === 'chat' ? renderMessage(d, opts) : renderEvent(d, opts);
  // The same id again (YouTube Jewels combos): replace that card in place instead of adding a second one.
  const old = d.id && [...list.children].find(c => !c.classList.contains('gone') && c.classList.contains(kind === 'chat' ? 'msg' : 'evt')
    && c.dataset.id === String(d.id) && c.dataset.account === String(d.accountId || ''));
  if (old || still) el.style.setProperty('animation', 'none');
  if (old) old.replaceWith(el); else list.append(el);
  const alive = [...list.children].filter(c => !c.classList.contains('gone'));
  for (const extra of alive.slice(0, Math.max(0, alive.length - S.max))) remove(extra);
  if (S.fade) setTimeout(() => remove(el), Math.max(0, S.fade * 1000 - age));
}

/** The chat list from the kept frames (after 'hello', or a settings change with still = true). */
function renderChat(still = false) {
  list.replaceChildren();
  if (C.featured) return;
  const now = Date.now();
  const recent = frames.filter(f => wanted(f.t, f.d) && (!S.fade || now - f.at < S.fade * 1000));
  for (const f of recent.slice(-S.max)) add(f.t, f.d, now - f.at, still);
}

/** f = { m, start }: start = when it went on screen (the server's featuredAt for the copy replayed after 'hello'). */
function showFeatured(f, still = false) {
  clearTimeout(featureTimer);
  if (still) list.replaceChildren(); else for (const old of list.children) remove(old);
  const m = f?.m;
  const left = S.featureSeconds * 1000 - (f ? Math.max(0, Date.now() - f.start) : 0);
  // A deleted (moderated) message never goes back on stream.
  if (!m || m.deleted || (S.featureSeconds && left <= 0) || !shown(m)) return;
  const card = h('div.feat-card', { class: `pf-${String(m.platform).replace(/[^a-z]/g, '')}` }, renderMessage(m, { ...opts, avatars: true }));
  if (still) card.style.setProperty('animation', 'none');
  list.append(card);
  if (S.featureSeconds) featureTimer = setTimeout(() => showFeatured(null), left);
}

/** Saved URLs: settings from the server (+ URL overrides), re-rendered in place. */
function reconfigure(overlays, rebuild) {
  if (!C.id || !overlays) return;
  saved = overlays;
  C = overlayFromQuery(query, saved);
  apply();
  if (!rebuild) return;
  clearTimeout(featureTimer);
  if (C.featured) showFeatured(feature, true); else renderChat(true);
}

const isMatch = (d, x) => x.account === d.accountId && (d.messageId ? x.id === d.messageId : d.userId ? x.user === String(d.userId) : true);
const keys = m => ({ account: String(m.accountId || ''), id: String(m.id || ''), user: String(m.author?.id ?? '') });

let afterHello = false;
function onFrame({ t: type, d }) {
  const replayed = afterHello;
  afterHello = type === 'hello';
  if (type === 'hello') {
    reconfigure(d.overlays, false);
    frames = (d.backlog || []).filter(f => f.t === 'chat' || f.t === 'event').map(f => ({ t: f.t, d: f.d, at: f.d.ts }));
    feature = null;
    renderChat();
  } else if (type === 'chat' || type === 'event') {
    frames.push({ t: type, d, at: Date.now() });
    if (frames.length > KEEP) frames.splice(0, frames.length - KEEP);
    add(type, d);
  } else if (type === 'chat:delete') {
    for (const f of frames) if (f.t === 'chat' && isMatch(d, keys(f.d))) f.d.deleted = true;
    if (feature?.m && isMatch(d, keys(feature.m))) feature.m.deleted = true;
    for (const el of list.querySelectorAll('.msg')) if (isMatch(d, el.dataset)) remove(el.closest('.feat-card') || el);
  } else if (type === 'feature') {
    feature = { m: d, start: replayed && d?.featuredAt ? d.featuredAt : Date.now() };
    if (C.featured) showFeatured(feature);
  } else if (type === 'overlay' && C.id && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
}

boot({
  page: '/overlay/chat', title: t('overlay.title'), header: false, admin: false, ownTheme: Boolean(C.id),
  onReady(state, el) {
    app = el;
    app.classList.add('ov');
    app.append(list);
    if (C.id) reconfigure(state.overlays || {}, false); else apply();
  },
  onFrame,
});
