// Chat overlay for OBS browser sources (/overlay/chat): read-only, transparent. Two kinds of URL:
//  - saved:  ?key=&id=chat|featured|alerts|viewers → settings stored on the server (dashboard builder), re-applied live on every change
//            without reloading; any setting param also in the URL overrides that one setting.
//            id=alerts shows live events one at a time (follows, subs, tips, raids…), never the backlog.
//            id=viewers shows the live viewer total of the shown channels, with every change animated (+x / −x).
//  - legacy: ?key= without id → configured only by its params, as in 1.2, ignores live updates:
//            &theme=dark|light|transparent&max=12&fade=0&platforms=&accounts=&hideBots=1&hideCommands=1&badges=0&icons=0
//            &avatars=1&size=18&align=left|right&events=1&bubble=1&outline=1&mode=featured&featureSeconds=0&credit=1
// platforms=/accounts= are inclusion lists; saved settings exclude with offPlatforms/offAccounts. Parsing: overlay-settings.js.
import { boot, h, svg, fmt, query, addI18n, t } from '/assets/core.js';
import { renderMessage, renderEvent } from '/assets/chat-render.js';
import { alertCard } from '/assets/alert-card.js';
import { viewerBadge } from '/assets/viewer-badge.js';
import { overlayFromQuery, alertCategory } from '/assets/overlay-settings.js';

addI18n({ fr: { 'overlay.title': 'Overlay du chat', 'overlay.alerts': 'Overlay des alertes', 'overlay.viewers': 'Overlay des spectateurs' },
  en: { 'overlay.title': 'Chat overlay', 'overlay.alerts': 'Alerts overlay', 'overlay.viewers': 'Viewers overlay' } });

const BOTS = new Set(['nightbot', 'streamelements', 'moobot', 'streamlabs', 'fossabot', 'wizebot', 'sery_bot', 'botrixoficial', 'kickbot', 'soundalerts']);
const KEEP = 200; // live chat/event frames kept for a rebuild (max is 100, the rest absorbs filtering); the hello backlog is kept whole

const root = document.documentElement;
const list = h('div.ov-list', { attrs: { 'aria-live': 'off' } });
const credit = h('div.ov-credit', 'Chat via Tramevia Dock'); // opt-in, off by default
let app = null;
let saved = null; // { chat, featured } from the server (saved URLs only)
let unlocked = false; // supporter code on the server: a ?style= naming an early-access style is honoured
let C = overlayFromQuery(query, null); // { id, featured, settings: S, onlyPlatforms, onlyAccounts }
let S = C.settings;
let opts = {};
let frames = []; // { t, d, at } (at = receive time)
let feature = null; // last 'feature' payload, kept even in chat mode: { m, start }
let featureTimer = 0;
const ALERT_QUEUE = 20; // alerts waiting their turn; beyond that the oldest waiting ones are dropped
let alerts = []; // events waiting (alerts mode)
let alertTimer = 0; // 0 = nothing on screen

/** Root attributes, classes and render options from the current settings (idempotent). */
function apply() {
  S = C.settings;
  opts = { light: S.theme === 'light', readable: true, links: false, timestamps: false, channel: false, badges: S.badges, icons: S.icons, avatars: S.avatars };
  root.dataset.overlay = S.theme;
  if (C.id) root.dataset.theme = S.theme === 'light' ? 'light' : 'dark';
  if (S.size) root.style.setProperty('--ov-fs', `${S.size}px`); else root.style.removeProperty('--ov-fs');
  // Alignment, bubbles and outline are chat settings: the alert styles draw their own text (the outline would stroke it).
  const chat = !C.alerts && !C.viewers;
  for (const [cls, on] of [['ov-right', chat && S.align === 'right'], ['ov-bubble', chat && S.bubble], ['ov-outline', chat && S.outline], ['ov-featured', C.featured], ['ov-alerts', C.alerts], ['ov-viewers', C.viewers]]) root.classList.toggle(cls, on);
  root.dataset.position = C.alerts ? S.position : '';
  root.dataset.style = C.alerts ? S.style : '';
  root.dataset.align = C.viewers ? S.align : '';
  if (app && S.credit && !C.viewers) app.append(credit); else credit.remove();
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

// ------------------------------------------------------------------ alerts (id=alerts): one event at a time
function alertWanted(d) {
  const cat = alertCategory(d.type);
  return Boolean(cat) && !S.offTypes.includes(cat) && shown(d);
}

let chimeEl = null; // <audio>: OBS captures media elements in both of its audio modes (Web Audio is not always picked up)
/** The built-in chime (/assets/chime.wav, two soft bell notes) at `volume` %. */
function chime(volume) {
  if (!volume) return;
  chimeEl ||= new Audio('/assets/chime.wav');
  chimeEl.volume = volume / 100;
  chimeEl.currentTime = 0;
  chimeEl.play().catch(() => {}); // blocked autoplay (a browser tab before any click), no audio device: the alert still shows
}

let current = null; // the event on screen (alerts mode)
function showAlert(d) {
  const card = alertCard(d, opts, S.style);
  list.append(card);
  card.style.setProperty('--evt', getComputedStyle(card.querySelector('.evt')).getPropertyValue('--evt')); // the event colour, for the card's own glow and accent
  card.style.setProperty('--alert-ms', String(S.alertSeconds * 1000)); // how long it stays: a style may show the time left
}

/** Shows the next waiting alert for S.alertSeconds, then the one after. Nothing waiting = screen left empty. */
function nextAlert() {
  clearTimeout(alertTimer);
  alertTimer = 0;
  for (const old of list.children) remove(old);
  current = alerts.shift() || null;
  if (!current) return;
  showAlert(current);
  chime(S.volume);
  alertTimer = setTimeout(nextAlert, S.alertSeconds * 1000);
}

function enqueueAlert(d) {
  if (!alertWanted(d)) return;
  alerts.push(d);
  if (alerts.length > ALERT_QUEUE) alerts.splice(0, alerts.length - ALERT_QUEUE);
  if (!alertTimer) nextAlert();
}

// ------------------------------------------------------------------ viewers (id=viewers): the live total, changes animated
const stats = new Map(); // accountId → { platform, live, viewers } (last 'stats' frame of each channel)
let badge = null;
let testDelta = 0; // viewers:test: shown on top of the real total for a few seconds
let testTimer = 0;
let statsTimer = 0;

/** Live viewers of the shown channels. A live channel without a count (YouTube owner hid it) adds nothing. */
function viewerTotal() {
  let total = 0;
  for (const [accountId, s] of stats) if (s.live && Number.isFinite(s.viewers) && shown({ accountId, platform: s.platform })) total += s.viewers;
  return total;
}

function showViewers(still = false) {
  if (!app) return;
  badge ||= viewerBadge({ h, svg, format: n => fmt.number(n) });
  if (!badge.el.isConnected) app.append(badge.el); // straight in #app (the list stays empty): the badge lays itself out
  badge.set(Math.max(0, viewerTotal() + testDelta), { still });
}

function keepStats(accounts) {
  for (const a of accounts || []) if (a.stats) stats.set(a.id, { platform: a.platform, ...a.stats });
}

/** Saved URLs: settings from the server (+ URL overrides), re-rendered in place. */
function reconfigure(overlays, rebuild) {
  if (!C.id || !overlays) return;
  const style = S.style;
  saved = overlays;
  C = overlayFromQuery(query, saved, unlocked);
  apply();
  if (!rebuild) return;
  clearTimeout(featureTimer);
  if (C.viewers) showViewers(true); // a filter change is the streamer's edit, not a change of audience: no +x / −x
  else if (C.alerts) {
    alerts = alerts.filter(alertWanted); // the card on screen stays; its duration applies from the next one
    // A style has its own elements and animations: the alert on screen is rebuilt in the new style (the builder's preview shows it at once).
    if (S.style !== style && current && alertTimer) { list.replaceChildren(); showAlert(current); }
  } else if (C.featured) showFeatured(feature, true); else renderChat(true);
}

const isMatch = (d, x) => x.account === d.accountId && (d.messageId ? x.id === d.messageId : d.userId ? x.user === String(d.userId) : true);
const keys = m => ({ account: String(m.accountId || ''), id: String(m.id || ''), user: String(m.author?.id ?? '') });

let afterHello = false;
function onFrame({ t: type, d }) {
  const replayed = afterHello;
  afterHello = type === 'hello';
  if ((type === 'hello' || type === 'overlay') && typeof d?.unlocked === 'boolean') unlocked = d.unlocked;
  if (type === 'hello') {
    reconfigure(d.overlays, false);
    if (C.viewers) { keepStats(d.accounts); showViewers(); return; }
    if (C.alerts) return; // alerts never replay the backlog: an old follow must not pop up again after a reconnect
    frames = (d.backlog || []).filter(f => f.t === 'chat' || f.t === 'event').map(f => ({ t: f.t, d: f.d, at: f.d.ts }));
    feature = null;
    renderChat();
  } else if (C.viewers) {
    if (type === 'stats' && d?.accountId) {
      stats.set(d.accountId, { platform: d.platform, live: d.live, viewers: d.viewers });
      // A stats poll sends every channel within a few ms: one net change on screen, not a burst of +2 −4 +2.
      statsTimer ||= setTimeout(() => { statsTimer = 0; showViewers(); }, 1200);
    }
    else if (type === 'viewers:test' && Number.isFinite(d?.delta)) {
      clearTimeout(testTimer);
      testDelta = viewerTotal() + d.delta < 0 ? -d.delta : d.delta; // never below 0: a drop on an empty total is shown as a rise
      showViewers();
      testTimer = setTimeout(() => { testDelta = 0; showViewers(); }, 3500);
    } else if (type === 'overlay' && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
  } else if (C.alerts) {
    if (type === 'event' || type === 'alert:test') enqueueAlert(d);
    else if (type === 'overlay' && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
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
  page: '/overlay/chat', title: t(C.alerts ? 'overlay.alerts' : C.viewers ? 'overlay.viewers' : 'overlay.title'), header: false, admin: false, ownTheme: Boolean(C.id),
  onReady(state, el) {
    app = el;
    app.classList.add('ov');
    app.append(list);
    unlocked = Boolean(state.unlocked);
    if (C.id) reconfigure(state.overlays || {}, false); else apply();
    if (C.viewers) { keepStats(state.accounts); showViewers(); }
  },
  onFrame,
});
