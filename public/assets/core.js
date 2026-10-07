// Tramevia Dock — shared front-end library (no build step, no framework).
// Pages: import { boot, h, api, t, … } from '/assets/core.js'.

// ---------------------------------------------------------------- DOM helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * h('button.btn.primary', { onclick, title, attrs: {…}, dataset: {…}, style: {'--pf': '#fff'} }, 'Text', child…)
 * Strings become text nodes (never HTML). null/false children are skipped.
 */
export function h(spec, props, ...children) {
  if (props instanceof Node || typeof props !== 'object' || props === null || Array.isArray(props)) {
    if (props !== undefined && props !== null) children.unshift(props);
    props = {};
  }
  const [head, ...classes] = spec.split('.');
  const [tag, id] = head.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
    else if (k === 'attrs') for (const [ak, av] of Object.entries(v)) { if (av !== false && av != null) el.setAttribute(ak, av === true ? '' : av); }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Build an element from a trusted, static SVG string (icons only). */
export function svg(markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild;
}

// ---------------------------------------------------------------- Storage
const PREFIX = 'od.';
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(PREFIX + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------- Environment
const params = new URLSearchParams(location.search);
/** Access key passed in the dock/overlay URL (?key=…). Kept in memory, sent as a Bearer header. */
export const accessKey = params.get('key') || '';
export const inObs = typeof window.obsstudio !== 'undefined';
export const query = params;

/** Keep the ?key= when linking between pages inside a dock. */
export function withKey(path) {
  if (!accessKey) return path;
  const u = new URL(path, location.origin);
  u.searchParams.set('key', accessKey);
  return u.pathname + u.search;
}

// ---------------------------------------------------------------- i18n
const dict = { fr: {}, en: {} };
let currentLang = params.get('lang') || store.get('lang') || (navigator.language || 'en').slice(0, 2);
if (!['fr', 'en'].includes(currentLang)) currentLang = 'en';

export function addI18n(entries) {
  for (const lang of Object.keys(dict)) Object.assign(dict[lang], entries[lang] || {});
}
export const lang = () => currentLang;
export function setLang(value) {
  currentLang = value === 'fr' ? 'fr' : 'en';
  store.set('lang', currentLang);
  document.documentElement.lang = currentLang;
  applyI18n();
  const dot = $('#conn-dot');
  if (dot) dot.title = t(connected ? 'common.online' : 'common.offline');
  window.dispatchEvent(new CustomEvent('od:lang', { detail: currentLang }));
}
/** t('key', {n: 3}) — {n} placeholders; `key|plural` picked for plural counts (FR: n ≥ 2, EN: n ≠ 1). */
export function t(key, vars = {}) {
  const table = dict[currentLang];
  const n = Math.abs(Number(vars.n));
  const plural = vars.n !== undefined && (currentLang === 'fr' ? n >= 2 : n !== 1);
  let s = (plural && table[key + '|plural']) || table[key] || dict.en[key] || key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
/** Translate [data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label] inside root. */
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const attr of ['placeholder', 'title', 'aria-label']) {
    for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.dataset[`i18n${attr.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`]));
  }
}

addI18n({
  fr: {
    'nav.home': 'Tableau de bord', 'nav.chat': 'Chat', 'nav.community': 'Communauté', 'nav.stream': 'Infos du live',
    'login.title': 'Tramevia Dock', 'login.subtitle': 'Saisis le mot de passe administrateur (ADMIN_PASSWORD).',
    'login.password': 'Mot de passe', 'login.submit': 'Se connecter', 'login.error': 'Mot de passe incorrect.',
    'common.save': 'Enregistrer', 'common.cancel': 'Annuler', 'common.close': 'Fermer', 'common.copy': 'Copier',
    'common.copied': 'Copié !', 'common.copyFailed': 'Copie impossible : sélectionne le texte puis Ctrl+C.',
    'common.retry': 'Réessayer', 'common.loading': 'Chargement…', 'common.delete': 'Supprimer', 'common.confirm': 'Confirmer',
    'common.offline': 'Connexion au serveur perdue — reconnexion…', 'common.online': 'Connecté au serveur',
    'common.error': 'Erreur', 'common.live': 'EN DIRECT', 'common.offlineStream': 'Hors ligne', 'common.viewers': 'spectateurs',
    'common.demo': 'Mode démo : données fictives', 'common.unofficial': 'Non officiel',
    'common.openDashboard': 'Ouvrir le tableau de bord', 'common.noAccounts': 'Aucun compte connecté pour l’instant.',
    'common.connectAccounts': 'Connecter mes comptes', 'common.lang': 'Langue', 'common.theme': 'Thème',
    'common.updated': 'Mis à jour vers {v}',
    'err.network': 'Serveur injoignable. Vérifie que Tramevia Dock est lancé.', 'err.unauthorized': 'Session expirée : reconnecte-toi.',
    'err.forbidden': 'Action non autorisée avec cette clé (lecture seule).',
  },
  en: {
    'nav.home': 'Dashboard', 'nav.chat': 'Chat', 'nav.community': 'Community', 'nav.stream': 'Stream info',
    'login.title': 'Tramevia Dock', 'login.subtitle': 'Enter the admin password (ADMIN_PASSWORD).',
    'login.password': 'Password', 'login.submit': 'Sign in', 'login.error': 'Wrong password.',
    'common.save': 'Save', 'common.cancel': 'Cancel', 'common.close': 'Close', 'common.copy': 'Copy',
    'common.copied': 'Copied!', 'common.copyFailed': 'Copy failed: select the text and press Ctrl+C.',
    'common.retry': 'Retry', 'common.loading': 'Loading…', 'common.delete': 'Delete', 'common.confirm': 'Confirm',
    'common.offline': 'Lost connection to the server — reconnecting…', 'common.online': 'Connected to the server',
    'common.error': 'Error', 'common.live': 'LIVE', 'common.offlineStream': 'Offline', 'common.viewers': 'viewers',
    'common.demo': 'Demo mode: fake data', 'common.unofficial': 'Unofficial',
    'common.openDashboard': 'Open dashboard', 'common.noAccounts': 'No account connected yet.',
    'common.connectAccounts': 'Connect my accounts', 'common.lang': 'Language', 'common.theme': 'Theme',
    'common.updated': 'Updated to {v}',
    'err.network': 'Server unreachable. Make sure Tramevia Dock is running.', 'err.unauthorized': 'Session expired: sign in again.',
    'err.forbidden': 'Not allowed with this key (read-only).',
  },
});

// ---------------------------------------------------------------- API
export class ApiFailure extends Error {
  constructor(message, status, code, data) { super(message); this.status = status; this.code = code; this.data = data; }
}

/** api('/api/x', { method, body }) → parsed JSON; throws ApiFailure with a user-readable message. */
export async function api(path, { method, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (accessKey) headers.Authorization = `Bearer ${accessKey}`;
  const init = { method: method || (body === undefined ? 'GET' : 'POST'), headers, credentials: 'same-origin' };
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, init); } catch { throw new ApiFailure(t('err.network'), 0, 'network'); }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const message = res.status === 401 ? t('err.unauthorized') : res.status === 403 && data?.code === 'unauthorized' ? t('err.forbidden') : data?.error || `HTTP ${res.status}`;
    if (res.status === 401) window.dispatchEvent(new CustomEvent('od:unauthorized'));
    throw new ApiFailure(message, res.status, data?.code, data);
  }
  return data;
}

// ---------------------------------------------------------------- Realtime
/**
 * connectHub(onFrame, onRevoked) — single WebSocket per page with auto-reconnect.
 * onFrame({t, d}); a fresh {t:'hello'} arrives after every (re)connect.
 * onRevoked() runs when the server says our key/session was revoked (close 4001, or refused upgrades).
 */
export function connectHub(onFrame, onRevoked) {
  let ws = null;
  let attempt = 0;
  let closed = false;
  let version = null; // server version of the first hello: another one later means an update was installed
  const open = () => {
    const url = new URL('/ws', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (accessKey) url.searchParams.set('key', accessKey);
    ws = new WebSocket(url);
    ws.onopen = () => { attempt = 0; setConnected(true); };
    ws.onmessage = e => {
      try {
        const frame = JSON.parse(e.data);
        if (frame.t === 'hello' && frame.d?.version) {
          // New server version (update installed): reload so every page, OBS docks and overlays included, runs the new JS.
          if (version && frame.d.version !== version) {
            try { sessionStorage.setItem('od:updated', frame.d.version); } catch { /* storage blocked: no toast */ }
            closed = true;
            location.reload();
            return;
          }
          version = frame.d.version;
        }
        onFrame(frame);
      } catch (err) { console.error(err); }
    };
    ws.onclose = e => {
      setConnected(false);
      if (closed) return;
      if (e.code === 4001) { closed = true; onRevoked?.(); return; }
      // A refused upgrade looks like a network drop (1006): after a few, ask whether we are still allowed in.
      if (attempt >= 2) {
        api('/api/session').then(s => { if (s.access === 'public' && !closed) { closed = true; onRevoked?.(); } }).catch(() => {});
      }
      setTimeout(() => { if (!closed) open(); }, Math.min(15000, 500 * 2 ** attempt++) + Math.random() * 400);
    };
  };
  open();
  return { close() { closed = true; ws?.close(); } };
}

let connected = null;
function setConnected(value) {
  if (connected === value) return;
  connected = value;
  const dot = $('#conn-dot');
  if (dot) {
    dot.className = 'conn-dot ' + (value ? 'on' : 'off');
    dot.title = t(value ? 'common.online' : 'common.offline');
  }
  window.dispatchEvent(new CustomEvent('od:connection', { detail: value }));
}

// ---------------------------------------------------------------- UI helpers
export function toast(message, kind = 'info', ms = 3500) {
  let box = $('.toasts');
  if (!box) { box = h('div.toasts', { attrs: { role: 'status', 'aria-live': 'polite' } }); document.body.append(box); }
  const el = h(`div.toast.${kind}`, message);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}

export async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(label || t('common.copied'), 'ok', 1800);
    return true;
  } catch {
    const area = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    area.remove();
    toast(ok ? (label || t('common.copied')) : t('common.copyFailed'), ok ? 'ok' : 'warn');
    return ok;
  }
}

/** A read-only code field with a copy button. */
export function copyField(text, { label } = {}) {
  return h('div.copy-field', h('code', { title: text }, text), h('button.btn.sm', { type: 'button', onclick: () => copy(text, label) }, t('common.copy')));
}

/** Run an async action on a button with a busy spinner; errors become toasts. Keyboard focus is kept. */
export async function busy(button, fn) {
  const hadFocus = button && document.activeElement === button;
  if (button) { button.classList.add('busy'); button.disabled = true; }
  try { return await fn(); } catch (err) { toast(err.message, 'error', 6000); return undefined; } finally {
    if (button) {
      button.classList.remove('busy');
      button.disabled = false;
      if (hadFocus && button.isConnected && (document.activeElement === document.body || !document.activeElement)) button.focus();
    }
  }
}

/** Promise-based modal. confirmDialog({ title, body, confirm, danger }) → boolean */
export function confirmDialog({ title, body, confirm = t('common.confirm'), danger = false }) {
  return new Promise(resolve => {
    const titleId = `dlg-${Math.random().toString(36).slice(2)}`;
    const dlg = h('dialog', { attrs: { 'aria-labelledby': titleId } }, h('div.dialog-body', h('h2', { id: titleId }, title), typeof body === 'string' ? h('p.muted', body) : body),
      h('div.dialog-actions',
        h('button.btn', { type: 'button', onclick: () => dlg.close('no') }, t('common.cancel')),
        h(`button.btn.${danger ? 'danger.solid' : 'primary'}`, { type: 'button', onclick: () => dlg.close('yes') }, confirm)));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export const fmt = {
  number: n => (n === null || n === undefined ? '—' : new Intl.NumberFormat(currentLang, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n)),
  time: ts => new Date(ts).toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' }),
  duration(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 60) return `${m} min`;
    return currentLang === 'fr' ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  },
  ago(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    const rtf = new Intl.RelativeTimeFormat(currentLang, { numeric: 'auto' });
    if (s < 60) return rtf.format(-s, 'second');
    if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
    if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
    return rtf.format(-Math.round(s / 86400), 'day');
  },
};

// ---------------------------------------------------------------- Icons
// Platform glyphs from Simple Icons (CC0). Trademarks belong to their owners; used only to identify platforms.
const PLATFORM_PATHS = {
  twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
  kick: 'M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
};
export const PLATFORM_NAMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube', tiktok: 'TikTok' };

/** <span class="pf-icon pf-twitch"><svg…></span> */
export function platformIcon(platform, { large = false, title } = {}) {
  const path = PLATFORM_PATHS[platform] || 'M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20z';
  const el = h(`span.pf-icon.pf-${platform}${large ? '.lg' : ''}`, { attrs: { title: title || PLATFORM_NAMES[platform] || platform, role: 'img', 'aria-label': title || PLATFORM_NAMES[platform] || platform } });
  el.append(svg(`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`));
  return el;
}

// Feather-style UI icons (MIT). icon('send') → SVG element.
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  play: '<path d="m5 3 14 9-14 9z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
};
export function icon(name, size = 16) {
  return svg(`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`);
}

// ---------------------------------------------------------------- Theme
export function applyTheme(theme) {
  document.documentElement.dataset.theme = ['light', 'dark', 'auto'].includes(theme) ? theme : 'dark';
}

// ---------------------------------------------------------------- Accounts / OAuth
/** Start an OAuth connection. In OBS docks the server opens the system browser. */
export async function openAuth(platform, reconnect = null) {
  const { url, opened } = await api(`/api/accounts/${platform}/connect`, { body: { reconnect, openOnServer: inObs } });
  if (opened) return { url, opened };
  const win = window.open(url, '_blank');
  if (win) win.opener = null;
  else if (!inObs) location.assign(url);
  return { url, opened: Boolean(win) };
}

// ---------------------------------------------------------------- Page boot
const NAV = [
  { href: '/', key: 'nav.home', icon: 'home' },
  { href: '/chat', key: 'nav.chat', icon: 'chat' },
  { href: '/community', key: 'nav.community', icon: 'users' },
  { href: '/stream', key: 'nav.stream', icon: 'edit' },
];

function header(page) {
  const nav = h('nav.nav', { attrs: { 'aria-label': 'Navigation' } },
    NAV.map(item => h('a', {
      href: withKey(item.href),
      attrs: { 'aria-current': item.href === page ? 'page' : false, title: t(item.key), 'data-i18n-title': item.key },
    }, icon(item.icon), h('span', { dataset: { i18n: item.key } }, t(item.key)))));
  return h('header.app-header',
    h('a.brand', { href: withKey('/'), title: 'Tramevia Dock' }, h('img', { src: '/assets/logo.svg', alt: '' }), h('span', 'Tramevia Dock')),
    nav, h('div.spacer'),
    h('span#conn-dot.conn-dot', { title: t('common.offline') }));
}

function loginScreen(onSuccess) {
  const input = h('input', { type: 'password', autocomplete: 'current-password', required: true, attrs: { 'aria-label': t('login.password') }, placeholder: t('login.password') });
  const error = h('p.small', { style: { color: 'var(--danger)' }, attrs: { role: 'alert' } });
  const button = h('button.btn.primary.block', { type: 'submit' }, t('login.submit'));
  const form = h('form.card.login-card',
    { onsubmit: async e => {
      e.preventDefault();
      error.textContent = '';
      await busy(button, async () => {
        try { await api('/api/login', { body: { password: input.value } }); onSuccess(); } catch (err) { error.textContent = err.status === 403 ? t('login.error') : err.message; }
      });
    } },
    h('img', { src: '/assets/logo.svg', alt: '' }), h('h1', t('login.title')), h('p.muted', t('login.subtitle')), input, error, button);
  return h('main.center-page', form);
}

/**
 * boot({ page: '/chat', title, header: true, admin: true, onReady(state), onFrame(frame) })
 *  - checks the session (shows the login screen if needed)
 *  - renders the header (unless header:false — overlays)
 *  - loads /api/state, applies theme + language, opens the realtime hub
 * Returns the <main id="app"> element the page renders into.
 */
export async function boot({ page, title, header: withHeader = true, admin = true, onReady, onFrame }) {
  document.documentElement.lang = currentLang;
  if (inObs) document.documentElement.classList.add('dock-mode');
  if (title) document.title = `${title} · Tramevia Dock`;
  const root = $('#app') || document.body.appendChild(h('main#app'));
  let session;
  try { session = await api('/api/session'); } catch (err) {
    root.replaceChildren(h('div.center-page', h('div.card.stack', h('h2', t('common.error')), h('p', err.message), h('button.btn', { onclick: () => location.reload() }, t('common.retry')))));
    return root;
  }
  if (session.access === 'public' || (admin && session.access !== 'admin')) {
    if (session.access === 'read') { root.replaceChildren(h('div.center-page', h('p.muted', t('err.forbidden')))); return root; }
    document.body.replaceChildren(loginScreen(() => location.reload()));
    return root;
  }
  window.addEventListener('od:unauthorized', () => location.reload(), { once: true });
  if (withHeader) document.body.prepend(header(page));
  const state = await api('/api/state');
  applyTheme(params.get('theme') || state.ui?.theme || 'dark');
  // The dashboard language (server ui.lang) is the source of truth; localStorage is only a first-paint cache.
  const serverLang = state.ui?.lang === 'fr' || state.ui?.lang === 'en' ? state.ui.lang : null;
  if (!params.get('lang') && serverLang && serverLang !== currentLang) {
    // Page modules may have built strings at import time in the cached language: reload once
    // (the cache now holds the server language, so this cannot loop).
    setLang(serverLang);
    if (store.get('lang') === serverLang) { location.reload(); return root; }
  }
  // First visit: tell the server which language to use for its own messages (account errors…).
  if (!state.ui?.lang && state.access === 'admin') api('/api/settings', { method: 'PUT', body: { lang: currentLang } }).catch(() => {});
  if (state.demo && withHeader) document.body.insertBefore(h('div.banner.info.small', { style: { 'border-radius': '0', 'justify-content': 'center' }, dataset: { i18n: 'common.demo' } }, t('common.demo')), root);
  await onReady?.(state, root);
  applyI18n();
  let updated = null; // set by connectHub just before the reload that follows an update
  try { updated = sessionStorage.getItem('od:updated'); sessionStorage.removeItem('od:updated'); } catch { /* storage blocked */ }
  if (updated && withHeader) toast(t('common.updated', { v: updated }), 'ok', 6000); // never on an overlay (it is on stream)
  connectHub(frame => {
    if (frame.t === 'settings' || frame.t === 'hello') {
      const ui = frame.t === 'settings' ? frame.d : frame.d.ui;
      if (ui?.theme && !params.get('theme')) applyTheme(ui.theme);
      // Language changed from the dashboard (live, or while this page was disconnected): follow it.
      // Pages build their strings once → reload. The dashboard itself calls setLang() first, so its own echo is a no-op.
      // Skip the echo of this page's own PUT /api/settings during a quick FR↔EN toggle (index.js sets __odUiWriteAt).
      const ownEcho = frame.t === 'settings' && Date.now() - (window.__odUiWriteAt || 0) < 1500;
      if ((ui?.lang === 'fr' || ui?.lang === 'en') && ui.lang !== currentLang && !params.get('lang') && !ownEcho) {
        setLang(ui.lang);
        setTimeout(() => location.reload(), 150);
      }
    }
    onFrame?.(frame);
  }, withHeader ? () => location.reload() : null);
  return root;
}
