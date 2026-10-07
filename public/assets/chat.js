// Chat dock (/chat) and event feed (/events, same page): unified multichat for OBS docks. SPEC.md §7.1, §9.
import { boot, h, api, t, addI18n, store, toast, copy, busy, confirmDialog, icon, platformIcon, fmt, withKey, applyTheme, query, lang, PLATFORM_NAMES } from '/assets/core.js';
import { renderMessage, renderEvent, mentionRegex, roleGlyph, safeUrl, readableColor, seedColor } from '/assets/chat-render.js';

addI18n({
  fr: {
    'chat.title': 'Chat', 'chat.eventsTitle': 'Événements', 'chat.list': 'Messages du chat', 'chat.eventsList': 'Événements du live',
    'chat.filters': 'Comptes affichés', 'chat.search': 'Rechercher', 'chat.searchPlaceholder': 'Rechercher un message ou un pseudo…',
    'chat.clearSearch': 'Effacer la recherche', 'chat.events': 'Afficher les événements dans le chat',
    'chat.pause': 'Mettre le chat en pause', 'chat.resume': 'Reprendre le défilement', 'chat.settings': 'Réglages du chat',
    'chat.newMessages': '{n} nouveau message', 'chat.newMessages|plural': '{n} nouveaux messages', 'chat.paused': 'Chat en pause',
    'chat.waiting': 'En attente de messages…', 'chat.waitingHint': 'Les messages de tous tes chats arrivent ici en direct.',
    'chat.waitingEvents': 'Aucun événement pour l’instant', 'chat.waitingEventsHint': 'Follows, abonnements, dons et raids apparaîtront ici.',
    'chat.noMatch': 'Rien ne correspond aux filtres.', 'chat.resetFilters': 'Réinitialiser les filtres',
    'chat.viewersOf': '{name} : {count} spectateur', 'chat.viewersOf|plural': '{name} : {count} spectateurs', 'chat.offlineOf': '{name} : hors ligne',
    'chat.liveNoCount': '{name} : en direct, nombre de spectateurs indisponible',
    'chat.totalViewers': '{count} spectateur au total', 'chat.totalViewers|plural': '{count} spectateurs au total',
    'chat.liveStatus': 'Statut des lives',
    'chat.reply': 'Répondre', 'chat.mention': 'Mentionner', 'chat.copy': 'Copier le message', 'chat.feature': 'Afficher sur l’overlay',
    'chat.unfeature': 'Retirer de l’overlay', 'chat.delete': 'Supprimer le message', 'chat.timeout': 'Exclure temporairement',
    'chat.ban': 'Bannir', 'chat.unban': 'Débannir', 'chat.userCard': 'Fiche de l’utilisateur', 'chat.msgTools': 'Actions du message',
    'chat.timeoutFor': 'Exclure {user} pendant…', 'chat.banTitle': 'Bannir {user} ?',
    'chat.banBody': '{user} ne pourra plus écrire dans le chat de {channel} ({platform}) tant que tu ne le débannis pas.',
    'chat.done.delete': 'Message supprimé', 'chat.done.timeout': '{user} exclu pour {d}', 'chat.done.ban': '{user} banni',
    'chat.done.unban': '{user} débanni', 'chat.featured': 'Affiché sur l’overlay', 'chat.unfeatured': 'Retiré de l’overlay',
    'chat.composer': 'Écrire un message', 'chat.placeholder': 'Envoyer un message…', 'chat.send': 'Envoyer', 'chat.targets': 'Envoyer sur',
    'chat.targetOff': '{name} : reconnexion nécessaire', 'chat.replyingTo': 'Réponse à {user}', 'chat.cancelReply': 'Annuler la réponse',
    'chat.cannotSend': 'Aucun compte connecté ne peut écrire dans le chat (TikTok est en lecture seule).',
    'chat.noTarget': 'Choisis au moins un compte destinataire.', 'chat.tooLongFor': 'Message trop long pour {names}',
    'chat.quota': 'quota YouTube : {used} / {limit} unités aujourd’hui',
    'chat.quotaFull': '{name} : quota de l’API YouTube presque épuisé ({used} / {limit}). Envoi en pause jusqu’à minuit (heure du Pacifique).',
    'chat.statsStale': '{name} : statistiques pas à jour ({error})', 'chat.statsUnknown': '{name} : état du live inconnu ({error})',
    'chat.totalPartial': '{count} spectateur au total (certaines statistiques manquent ou ne sont pas à jour)',
    'chat.totalPartial|plural': '{count} spectateurs au total (certaines statistiques manquent ou ne sont pas à jour)',
    'chat.sendFailed': '{name} : {error}',
    'chat.hint': 'Entrée : envoyer · ↑ : historique · Tab : émotes', 'chat.quick': 'Actions rapides', 'chat.marker': 'Marqueur',
    'chat.clip': 'Clip', 'chat.markerDone': 'Marqueur ajouté ({name})', 'chat.clipDone': 'Clip créé ({name})', 'chat.openClip': 'Ouvrir',
    'chat.suggestions': 'Émotes suggérées',
    'chat.set.density': 'Densité', 'chat.set.compact': 'Compacte', 'chat.set.comfortable': 'Confortable', 'chat.set.fontSize': 'Taille du texte',
    'chat.set.timestamps': 'Heure des messages', 'chat.set.avatars': 'Avatars', 'chat.set.badges': 'Badges', 'chat.set.icons': 'Icônes de plateforme',
    'chat.set.readable': 'Couleurs lisibles', 'chat.set.showDeleted': 'Montrer les messages supprimés', 'chat.set.sound': 'Son quand on me mentionne',
    'chat.set.keywords': 'Mots-clés à surligner', 'chat.set.keywordsHint': 'Séparés par des virgules, ex. : giveaway, discord',
    'chat.card.messages': 'Messages pendant cette session', 'chat.card.noMessages': 'Aucun message pendant cette session.',
    'chat.card.created': 'Compte créé', 'chat.card.followed': 'Suit depuis', 'chat.card.infoError': 'Infos du profil indisponibles : {error}',
    'chat.card.on': 'sur {channel}', 'chat.card.mod': 'Modération', 'chat.card.count': '{n} message', 'chat.card.count|plural': '{n} messages',
  },
  en: {
    'chat.title': 'Chat', 'chat.eventsTitle': 'Events', 'chat.list': 'Chat messages', 'chat.eventsList': 'Stream events',
    'chat.filters': 'Shown accounts', 'chat.search': 'Search', 'chat.searchPlaceholder': 'Search messages or names…',
    'chat.clearSearch': 'Clear search', 'chat.events': 'Show events in chat',
    'chat.pause': 'Pause chat', 'chat.resume': 'Resume scrolling', 'chat.settings': 'Chat settings',
    'chat.newMessages': '{n} new message', 'chat.newMessages|plural': '{n} new messages', 'chat.paused': 'Chat paused',
    'chat.waiting': 'Waiting for messages…', 'chat.waitingHint': 'Messages from all your chats show up here live.',
    'chat.waitingEvents': 'No events yet', 'chat.waitingEventsHint': 'Follows, subs, donations and raids will show up here.',
    'chat.noMatch': 'Nothing matches the filters.', 'chat.resetFilters': 'Reset filters',
    'chat.viewersOf': '{name}: {count} viewer', 'chat.viewersOf|plural': '{name}: {count} viewers', 'chat.offlineOf': '{name}: offline',
    'chat.liveNoCount': '{name}: live, viewer count unavailable',
    'chat.totalViewers': '{count} viewer in total', 'chat.totalViewers|plural': '{count} viewers in total',
    'chat.liveStatus': 'Live status',
    'chat.reply': 'Reply', 'chat.mention': 'Mention', 'chat.copy': 'Copy message', 'chat.feature': 'Show on overlay',
    'chat.unfeature': 'Remove from overlay', 'chat.delete': 'Delete message', 'chat.timeout': 'Timeout',
    'chat.ban': 'Ban', 'chat.unban': 'Unban', 'chat.userCard': 'User card', 'chat.msgTools': 'Message actions',
    'chat.timeoutFor': 'Timeout {user} for…', 'chat.banTitle': 'Ban {user}?',
    'chat.banBody': '{user} will not be able to chat in {channel} ({platform}) until you unban them.',
    'chat.done.delete': 'Message deleted', 'chat.done.timeout': '{user} timed out for {d}', 'chat.done.ban': '{user} banned',
    'chat.done.unban': '{user} unbanned', 'chat.featured': 'Shown on the overlay', 'chat.unfeatured': 'Removed from the overlay',
    'chat.composer': 'Write a message', 'chat.placeholder': 'Send a message…', 'chat.send': 'Send', 'chat.targets': 'Send to',
    'chat.targetOff': '{name}: needs reconnect', 'chat.replyingTo': 'Replying to {user}', 'chat.cancelReply': 'Cancel reply',
    'chat.cannotSend': 'No connected account can send chat messages (TikTok is read-only).',
    'chat.noTarget': 'Pick at least one account to send to.', 'chat.tooLongFor': 'Message too long for {names}',
    'chat.quota': 'YouTube quota: {used} / {limit} units today',
    'chat.quotaFull': '{name}: YouTube API quota almost used up ({used} / {limit}). Sending is paused until midnight Pacific time.',
    'chat.statsStale': '{name}: stats out of date ({error})', 'chat.statsUnknown': '{name}: live status unknown ({error})',
    'chat.totalPartial': '{count} viewer in total (some stats are missing or out of date)',
    'chat.totalPartial|plural': '{count} viewers in total (some stats are missing or out of date)',
    'chat.sendFailed': '{name}: {error}',
    'chat.hint': 'Enter: send · ↑: history · Tab: emotes', 'chat.quick': 'Quick actions', 'chat.marker': 'Stream marker',
    'chat.clip': 'Clip', 'chat.markerDone': 'Marker added ({name})', 'chat.clipDone': 'Clip created ({name})', 'chat.openClip': 'Open',
    'chat.suggestions': 'Suggested emotes',
    'chat.set.density': 'Density', 'chat.set.compact': 'Compact', 'chat.set.comfortable': 'Comfortable', 'chat.set.fontSize': 'Text size',
    'chat.set.timestamps': 'Timestamps', 'chat.set.avatars': 'Avatars', 'chat.set.badges': 'Badges', 'chat.set.icons': 'Platform icons',
    'chat.set.readable': 'Readable colors', 'chat.set.showDeleted': 'Show deleted messages', 'chat.set.sound': 'Sound when mentioned',
    'chat.set.keywords': 'Highlight keywords', 'chat.set.keywordsHint': 'Comma-separated, e.g. giveaway, discord',
    'chat.card.messages': 'Messages this session', 'chat.card.noMessages': 'No messages this session.',
    'chat.card.created': 'Account created', 'chat.card.followed': 'Following since', 'chat.card.infoError': 'Profile info unavailable: {error}',
    'chat.card.on': 'on {channel}', 'chat.card.mod': 'Moderation', 'chat.card.count': '{n} message', 'chat.card.count|plural': '{n} messages',
  },
});

// ------------------------------------------------------------------ state
const EVENTS_ONLY = location.pathname === '/events';
const MAX = 300;
const DURATIONS = [[10, '10 s'], [60, '1 min'], [600, '10 min'], [3600, '1 h'], [86400, '24 h']];
const DEFAULTS = {
  density: 'comfortable', fontSize: 14, timestamps: true, avatars: false, badges: true, icons: true, readable: true,
  showDeleted: true, keywords: [], sound: false, events: true, hidden: [], targets: null,
};
const prefs = { ...DEFAULTS, ...store.get('chat.prefs', {}) };
for (const k of ['keywords', 'hidden']) if (!Array.isArray(prefs[k])) prefs[k] = [];
const savePrefs = () => store.set('chat.prefs', prefs);

let accounts = [];
const byId = new Map();
const stats = new Map();
const items = [];          // rendered items {kind, d, el}, oldest first
let pending = [];          // received while paused / before the next frame
const elItem = new WeakMap();
const pause = { hover: false, scroll: false, manual: false, focus: false };
let raf = 0, opts = {}, replyTo = null, featuredId = null, featureTimer = 0, search = '', ready = false, sending = false;
const emotes = new Map();  // emote name -> url seen this session (Tab completion)
const sentHistory = [];
let histPos = -1;

const isPaused = () => pause.hover || pause.scroll || pause.manual || pause.focus;
const caps = id => byId.get(id)?.caps || {};
const limits = id => caps(id).limits || {};
const num = n => new Intl.NumberFormat(lang()).format(Number(n) || 0);
/** Timeout presets the account's platform accepts (e.g. no 10 s on Kick, whose timeouts are whole minutes). */
const durationsFor = id => DURATIONS.filter(([s]) => s >= (limits(id).timeoutMin || 1) && s <= (limits(id).timeoutMax || Infinity));
/** YouTube API quota from stats; `full` mirrors the adapter, which refuses writes beyond 95 % of the daily limit. */
const quotaOf = id => { const q = stats.get(id)?.quota; return q?.limit > 0 ? { ...q, full: q.used >= q.limit * 0.95 } : null; };
const accLabel = a => a ? `${PLATFORM_NAMES[a.platform] || a.platform} · ${a.displayName || a.login}` : '?';
/** Why a message cannot go to this account right now ('' when it can). */
function blockReason(a) {
  if (!a) return '';
  if (a.status && a.status !== 'ok') return t('chat.targetOff', { name: accLabel(a) });
  const q = quotaOf(a.id);
  return q?.full ? t('chat.quotaFull', { name: accLabel(a), used: num(q.used), limit: num(q.limit) }) : '';
}
/** 3-letter label telling apart accounts of the same platform in compact chips ('' when the platform is unique). */
function shortName(a) {
  const names = accounts.filter(x => x.platform === a.platform).map(x => String(x.displayName || x.login || '').toLowerCase());
  if (names.length < 2) return '';
  const name = String(a.displayName || a.login || '');
  let i = 0;
  while (i < name.length && names.every(n => n[i] === name[i].toLowerCase())) i++; // drop the shared prefix (TrameviaTV / TrameviaGaming)
  return [...(name.slice(i) || name)].slice(0, 3).join('');
}
const authorName = m => m.author?.name || m.author?.login || '?';
const isLight = () => getComputedStyle(document.documentElement).colorScheme === 'light';

// ------------------------------------------------------------------ static DOM
const iconBtn = (name, label, onclick, extra = {}) =>
  h('button.icon-btn', { type: 'button', title: label, attrs: { 'aria-label': label, ...extra.attrs }, onclick, class: extra.class }, icon(name));

const strip = h('div.live-strip', { hidden: true, attrs: { role: 'status', 'aria-label': t('chat.liveStatus') } });
const filters = h('div.filters', { attrs: { role: 'group', 'aria-label': t('chat.filters') } });
const searchInput = h('input', { type: 'search', placeholder: t('chat.searchPlaceholder'), attrs: { 'aria-label': t('chat.search') } });
const searchRow = h('div.search-row', { hidden: true }, icon('search', 14), searchInput,
  iconBtn('x', t('chat.clearSearch'), () => { searchInput.value = ''; setSearch(''); searchRow.hidden = true; searchBtn.setAttribute('aria-expanded', 'false'); searchBtn.focus(); }));
const searchBtn = iconBtn('search', t('chat.search'), () => {
  searchRow.hidden = !searchRow.hidden;
  searchBtn.setAttribute('aria-expanded', String(!searchRow.hidden));
  if (!searchRow.hidden) searchInput.focus(); else { searchInput.value = ''; setSearch(''); }
}, { attrs: { 'aria-expanded': 'false' } });
const eventsBtn = iconBtn('zap', t('chat.events'), () => { prefs.events = !prefs.events; savePrefs(); syncToolbar(); refilter(); });
const pauseBtn = iconBtn('pause', t('chat.pause'), () => { pause.manual = !pause.manual; if (!pause.manual) resume(true); syncPause(); });
const settingsBtn = iconBtn('settings', t('chat.settings'), () => openSettings(), { attrs: { 'aria-haspopup': 'dialog' } });
const toolbar = h('div.chat-toolbar', filters, h('div.toolbar-actions', searchBtn, EVENTS_ONLY ? null : eventsBtn, pauseBtn, settingsBtn));
const connBanner = h('div.conn-banner.banner.warn.small', { hidden: true, attrs: { role: 'alert' } }, icon('alert', 14), t('common.offline'));
const list = h('div.chat-list', { tabindex: 0, attrs: { role: 'log', 'aria-label': t(EVENTS_ONLY ? 'chat.eventsList' : 'chat.list') } });
const emptyBox = h('div.chat-empty');
const pill = h('button.new-pill', { type: 'button', hidden: true, onclick: () => {
  const had = document.activeElement === pill;
  pause.hover = false; pause.manual = false; resume(true); syncPause();
  if (had && pill.hidden) pauseBtn.focus(); // the pill hides itself: keep keyboard focus on the same toggle
} });
const tools = h('div.msg-tools', { attrs: { role: 'toolbar', 'aria-label': t('chat.msgTools') } });
const listWrap = h('div.list-wrap', list, pill);
const menu = h('div.menu', { attrs: { popover: 'auto', role: 'menu' } });

// Composer
const targetsBox = h('div.targets', { attrs: { role: 'group', 'aria-label': t('chat.targets') } });
const quickBtn = iconBtn('zap', t('chat.quick'), e => openQuick(e.currentTarget), { attrs: { 'aria-haspopup': 'menu' } });
const replyChip = h('div.reply-chip', { hidden: true });
const suggest = h('div.suggest', { hidden: true, attrs: { role: 'listbox', 'aria-label': t('chat.suggestions') } });
const input = h('textarea.composer-input', { rows: 1, maxLength: 1000, placeholder: t('chat.placeholder'), attrs: { 'aria-label': t('chat.composer'), 'aria-describedby': 'chat-counter', enterkeyhint: 'send' } });
// The counter is not a live region (it would read "17/500" on every keystroke); only crossing a limit is announced.
const counter = h('span#chat-counter.counter');
const limitStatus = h('span.sr-only', { attrs: { role: 'status' } });
const hint = h('span.faint.tiny.hint', t('chat.hint'));
const sendBtn = h('button.btn.primary.send-btn', { type: 'button', title: t('chat.send'), attrs: { 'aria-label': t('chat.send') }, onclick: () => send() }, icon('send'));
const composerOff = h('div.composer-off.small', { hidden: true }, icon('info', 14), h('span', t('chat.cannotSend')));
const composerMain = h('div.composer-main',
  h('div.composer-top', targetsBox, quickBtn), replyChip, suggest,
  h('div.input-row', input, sendBtn),
  h('div.composer-foot', hint, counter, limitStatus));
const composer = h('div.composer', { hidden: true }, composerMain, composerOff);

// ------------------------------------------------------------------ rendering
function buildOpts() {
  opts = {
    light: isLight(), readable: prefs.readable, timestamps: prefs.timestamps, icons: prefs.icons, badges: prefs.badges, avatars: prefs.avatars,
    keywords: prefs.keywords.map(k => k.toLowerCase()), channel: accounts.length > 1,
    mentionRe: mentionRegex(accounts.flatMap(a => [a.login, a.displayName])),
  };
}

function render(it) {
  const el = it.kind === 'chat' ? renderMessage(it.d, opts) : renderEvent(it.d, opts);
  el.tabIndex = -1;
  if (it.kind === 'chat' && it.d.id && it.d.id === featuredId) el.classList.add('featured');
  el.hidden = !visible(it);
  elItem.set(el, it);
  it.el = el;
  return el;
}

function visible(it) {
  if (prefs.hidden.includes(it.d.accountId)) return false;
  if (it.kind === 'chat' ? EVENTS_ONLY : !(EVENTS_ONLY || prefs.events)) return false;
  if (!search) return true;
  const d = it.d;
  const hay = it.kind === 'chat' ? `${d.author?.name} ${d.author?.login} ${d.text}` : `${d.user?.name} ${d.label || ''} ${d.text || ''} ${d.type}`;
  return hay.toLowerCase().includes(search);
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(flush);
}

/** Batch DOM writes: append pending items once per frame, cap the DOM, stick to the bottom. */
function flush() {
  raf = 0;
  if (!ready) return;
  if (isPaused() && items.length) { syncPause(); return; } // the first backlog always renders
  if (pending.length) {
    const batch = pending.splice(0).slice(-MAX);
    const frag = document.createDocumentFragment();
    for (const it of batch) { frag.append(render(it)); items.push(it); }
    list.append(frag);
    while (items.length > MAX) {
      const old = items.shift();
      if (old.el.contains(tools)) dropTools();
      old.el.remove();
    }
  }
  syncEmpty();
  stick();
  syncPause();
}

function stick() { list.scrollTop = list.scrollHeight; }

function resume(force) {
  if (force) pause.scroll = false;
  schedule();
  if (force) requestAnimationFrame(stick);
}

const sameItem = (a, b) => a.kind === b.kind && a.d.id === b.d.id && a.d.accountId === b.d.accountId;
/** The same id again (YouTube Jewels combos, re-sent messages) replaces the item in place, never duplicates it. */
function upsert(it) {
  const old = it.d.id && (items.findLast(x => sameItem(x, it)) || pending.findLast(x => sameItem(x, it)));
  if (!old) return false;
  if (old.d.deleted) it.d.deleted = true;
  old.d = it.d;
  if (!old.el) return true; // still pending: rendered with the new data
  const focused = old.el.contains(document.activeElement);
  if (old.el.contains(tools)) dropTools();
  old.el.replaceWith(render(old));
  old.el.style.setProperty('animation', 'none');
  if (focused) old.el.focus();
  return true;
}

function push(it) {
  if (it.kind === 'chat' && EVENTS_ONLY) return;
  if (upsert(it)) return;
  if (it.kind === 'chat') {
    for (const tok of it.d.tokens || []) if (tok?.t === 'emote' && tok.name && safeUrl(tok.url) && !emotes.has(tok.name) && emotes.size < 800) emotes.set(tok.name, safeUrl(tok.url));
    if (ready && prefs.sound && !it.d.flags?.self && !prefs.hidden.includes(it.d.accountId)) {
      const text = String(it.d.text || '');
      if (opts.mentionRe?.test(text) || opts.keywords.some(k => k && text.toLowerCase().includes(k))) beep();
    }
  }
  pending.push(it);
  if (pending.length > 1000) pending = pending.slice(-MAX);
  schedule();
}

function rerenderAll() {
  buildOpts();
  const focused = elItem.get(document.activeElement?.closest?.('.msg, .evt'));
  dropTools();
  for (const it of items) it.el.replaceWith(render(it));
  focused?.el.focus(); // an accounts/settings frame must not drop keyboard focus to <body>
  syncEmpty();
  if (!isPaused()) stick();
}

function refilter() {
  for (const it of items) it.el.hidden = !visible(it);
  syncEmpty();
  if (!isPaused()) stick();
  syncPause();
}

function resetList(backlog) {
  ready = false; // no mention sounds for replayed backlog
  dropTools();
  for (const s of list.querySelectorAll('.msg-skel')) s.remove(); // skeletons stay until the first hello

  for (const it of items) it.el.remove();
  items.length = 0;
  pending = [];
  for (const f of backlog || []) if (f.t === 'chat' || f.t === 'event') push({ kind: f.t, d: f.d });
  ready = true;
  pause.scroll = false;
  schedule();
}

function syncEmpty() {
  const shown = items.some(it => !it.el.hidden);
  emptyBox.hidden = shown || !ready; // skeletons until the first hello
  if (emptyBox.hidden) return;
  if (!accounts.length) {
    emptyBox.replaceChildren(h('div.empty',
      h('div.empty-icon', icon('chat', 22)), h('p', t('common.noAccounts')),
      h('a.btn.primary.sm', { href: withKey('/') }, t('common.connectAccounts'))));
  } else if (items.length) {
    emptyBox.replaceChildren(h('div.empty', h('div.empty-icon', icon('filter', 22)), h('p', t('chat.noMatch')),
      h('button.btn.sm', { type: 'button', onclick: resetFilters }, t('chat.resetFilters'))));
  } else {
    emptyBox.replaceChildren(h('div.empty',
      h('div.empty-icon', icon(EVENTS_ONLY ? 'zap' : 'chat', 22)),
      h('p', t(EVENTS_ONLY ? 'chat.waitingEvents' : 'chat.waiting')),
      h('p.small.faint', t(EVENTS_ONLY ? 'chat.waitingEventsHint' : 'chat.waitingHint'))));
  }
  if (!emptyBox.isConnected) list.prepend(emptyBox);
}

function resetFilters() {
  prefs.hidden = [];
  if (!EVENTS_ONLY) prefs.events = true;
  savePrefs();
  searchInput.value = '';
  setSearch('');
  searchRow.hidden = true;
  renderFilters();
  syncToolbar();
}

function setSearch(v) {
  search = v.trim().toLowerCase();
  refilter();
}

function syncPause() {
  const paused = isPaused();
  const unseen = paused ? pending.filter(visible).length : 0;
  pill.hidden = !(paused && (unseen || pause.manual || pause.scroll));
  pill.replaceChildren(h('span', unseen ? t('chat.newMessages', { n: unseen }) : t('chat.paused')),
    pause.manual ? icon('play', 13) : h('span.arrow', { attrs: { 'aria-hidden': 'true' } }, '↓'));
  pauseBtn.replaceChildren(icon(pause.manual ? 'play' : 'pause'));
  const label = t(pause.manual ? 'chat.resume' : 'chat.pause');
  pauseBtn.title = label;
  pauseBtn.setAttribute('aria-label', label);
  pauseBtn.setAttribute('aria-pressed', String(pause.manual));
  listWrap.classList.toggle('is-paused', paused);
}

function syncToolbar() {
  eventsBtn.setAttribute('aria-pressed', String(prefs.events));
}

/**
 * 'feature' frame (null = cleared). The overlay hides the card after its featureSeconds, so the star must not keep saying
 * "remove" afterwards. ponytail: the dock cannot read the overlay URL; it uses this browser's overlay-builder duration
 * (dashboard default 15 s, 0 = until removed). Have /api/chat/feature carry the duration if overlays ever need to diverge.
 */
function setFeatured(d, replayed = false) {
  clearTimeout(featureTimer);
  const secs = Math.min(3600, Number(store.get('home.overlay', {})?.featureSeconds ?? 15));
  // Like the overlay: only the copy replayed after 'hello' is aged by featuredAt (server clock).
  const left = secs > 0 ? secs * 1000 - (replayed && d?.featuredAt ? Math.max(0, Date.now() - d.featuredAt) : 0) : Infinity;
  featuredId = d?.id && left > 0 ? d.id : null;
  if (featuredId && left < Infinity) featureTimer = setTimeout(setFeatured, left, null);
  markFeatured();
  dropTools();
}

function markFeatured() {
  for (const el of list.querySelectorAll('.msg.featured')) el.classList.remove('featured');
  if (!featuredId) return;
  for (const it of items) if (it.kind === 'chat' && it.d.id === featuredId) it.el.classList.add('featured');
}

function applyDelete(d) {
  const hit = m => m.accountId === d.accountId && (d.messageId ? m.id === d.messageId : d.userId ? String(m.author?.id) === String(d.userId) : true);
  for (const it of pending) if (it.kind === 'chat' && hit(it.d)) it.d.deleted = true;
  for (const it of items) {
    if (it.kind !== 'chat' || !hit(it.d)) continue;
    it.d.deleted = true;
    it.el.classList.add('deleted');
  }
}

// ------------------------------------------------------------------ accounts, filters, live strip, targets
function setAccounts(list_) {
  accounts = Array.isArray(list_) ? list_ : [];
  byId.clear();
  for (const a of accounts) {
    byId.set(a.id, a);
    if (a.stats && !(stats.get(a.id)?.at > a.stats.at)) stats.set(a.id, a.stats); // keep whichever is fresher
  }
  prefs.hidden = prefs.hidden.filter(id => byId.has(id));
  buildOpts();
  renderFilters();
  renderStrip();
  renderTargets();
  if (ready) rerenderAll();
}

/** Re-render a chip row, keeping keyboard focus on the same chip. */
function setChips(box, nodes) {
  const id = box.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  box.replaceChildren(...nodes);
  if (id) [...box.children].find(b => b.dataset.id === id)?.focus();
}

/** Platform icon + name; the short label is shown instead of the name in narrow docks (two accounts, same platform). */
function chipLabel(a, nameClass) {
  const short = shortName(a);
  return [platformIcon(a.platform), h(`span.${nameClass}`, a.displayName || a.login), short && h('span.chip-short', { attrs: { 'aria-hidden': 'true' } }, short)];
}

function renderFilters() {
  filters.hidden = accounts.length < 2;
  setChips(filters, accounts.map(a => h('button.fchip', {
    type: 'button', class: `pf-${a.platform}${shortName(a) ? ' dup' : ''}`, title: accLabel(a), dataset: { id: a.id },
    attrs: { 'aria-pressed': String(!prefs.hidden.includes(a.id)), 'aria-label': accLabel(a) },
    onclick: () => {
      prefs.hidden = prefs.hidden.includes(a.id) ? prefs.hidden.filter(id => id !== a.id) : [...prefs.hidden, a.id];
      savePrefs();
      renderFilters();
      refilter();
    },
  }, chipLabel(a, 'fchip-name'))));
}

function renderStrip() {
  strip.hidden = !accounts.length;
  let total = 0, partial = false;
  const parts = accounts.map(a => {
    const s = stats.get(a.id) || {};
    // Stale stats (failed polls) are shown dimmed with the error, never as a confident number.
    const stale = Boolean(s.error) || s.fails >= 3;
    const unknown = s.viewers === null || s.viewers === undefined || s.live === undefined;
    const noCount = s.live && !Number.isFinite(s.viewers); // live but no count (YouTube owner hid it): unknown, not 0
    if (s.live) total += Number(s.viewers) || 0;
    partial ||= stale || noCount;
    const q = quotaOf(a.id);
    const title = [
      stale ? t(unknown ? 'chat.statsUnknown' : 'chat.statsStale', { name: accLabel(a), error: String(s.error || '?') })
        : noCount ? t('chat.liveNoCount', { name: accLabel(a) })
          : s.live ? t('chat.viewersOf', { name: accLabel(a), n: s.viewers, count: num(s.viewers) }) : t('chat.offlineOf', { name: accLabel(a) }),
      q && t('chat.quota', { used: num(q.used), limit: num(q.limit) }),
    ].filter(Boolean).join(' · ');
    return h('span.ls-item', { class: `pf-${a.platform}${stale ? ' stale' : ''}${q?.full ? ' quota-full' : ''}`, title },
      platformIcon(a.platform), h(`span.status-dot${s.live ? '.live' : ''}`),
      h('span.ls-num', (stale && unknown) || noCount ? '?' : s.live ? fmt.number(Number(s.viewers) || 0) : '—'));
  });
  strip.replaceChildren(h('div.ls-items', parts),
    h('span.ls-total', { class: partial ? 'stale' : '', title: t(partial ? 'chat.totalPartial' : 'chat.totalViewers', { n: total, count: num(total) }) },
      icon('eye', 13), h('span', fmt.number(total))));
}

const senders = () => accounts.filter(a => a.caps?.chatSend);
function currentTargets() {
  const ok = senders().filter(a => !blockReason(a)).map(a => a.id);
  return prefs.targets ? ok.filter(id => prefs.targets.includes(id)) : ok;
}

function renderTargets() {
  if (EVENTS_ONLY) return;
  composer.hidden = !accounts.length;
  const list_ = senders();
  composerMain.hidden = !list_.length;
  composerOff.hidden = Boolean(list_.length);
  const chosen = new Set(currentTargets());
  setChips(targetsBox, list_.map(a => {
    // aria-disabled (not disabled): the chip stays focusable and a click explains why (reconnect, YouTube quota).
    const why = blockReason(a);
    const q = quotaOf(a.id);
    const title = why || [accLabel(a), q && t('chat.quota', { used: num(q.used), limit: num(q.limit) })].filter(Boolean).join(' · ');
    return h('button.tchip', {
      type: 'button', class: `pf-${a.platform}${shortName(a) ? ' dup' : ''}`, title, dataset: { id: a.id },
      attrs: { 'aria-pressed': String(chosen.has(a.id)), 'aria-label': title, 'aria-disabled': why ? 'true' : null },
      onclick: () => {
        if (why) return void toast(why, 'warn', 6000);
        // Toggle within the saved choice, so an account blocked for a while (quota, reconnect) comes back selected.
        const next = new Set(prefs.targets || senders().map(x => x.id));
        if (chosen.has(a.id)) next.delete(a.id); else next.add(a.id);
        prefs.targets = [...next];
        savePrefs();
        renderTargets();
      },
    }, chipLabel(a, 'tchip-name'));
  }));
  targetsBox.classList.toggle('dimmed', Boolean(replyTo));
  quickBtn.hidden = !accounts.some(a => a.caps?.markers || a.caps?.clips);
  syncCounter(); // the length limit depends on the targets
}

// ------------------------------------------------------------------ hover tools, menus, moderation
function attachTools(el) {
  const it = elItem.get(el);
  if (!it || it.kind !== 'chat') { dropTools(); return; }
  if (tools.parentNode === el) return;
  const m = it.d;
  const c = caps(m.accountId);
  const own = m.flags?.self || m.author?.roles?.includes('broadcaster');
  const featured = featuredId === m.id;
  tools.replaceChildren(...[
    c.chatSend && iconBtn('reply', t(c.reply ? 'chat.reply' : 'chat.mention'), () => startReply(m)),
    iconBtn('copy', t('chat.copy'), () => copy(m.text || '')),
    (featured || !m.deleted) && iconBtn('star', t(featured ? 'chat.unfeature' : 'chat.feature'), e => feature(featured ? null : m, e.currentTarget), { class: featured ? 'on' : '' }),
    c.deleteMessage && !m.deleted && iconBtn('trash', t('chat.delete'), e => moderate(m, 'delete', {}, e.currentTarget)),
    c.timeout && !own && durationsFor(m.accountId).length > 0 && iconBtn('clock', t('chat.timeout'), e => openTimeout(m, e.currentTarget), { attrs: { 'aria-haspopup': 'menu' } }),
    c.ban && !own && iconBtn('ban', t('chat.ban'), e => ban(m, e.currentTarget), { class: 'danger' }),
    m.author?.id && iconBtn('user', t('chat.userCard'), () => openUserCard(m)),
  ].filter(Boolean));
  // Float above the message, or below it when it is the first visible line (the list clips its top edge).
  tools.classList.toggle('below', el.offsetTop - list.scrollTop < 34);
  el.append(tools);
}

/** Show the shared popover menu under an anchor. entries: [{label, onclick, danger?}] or nodes. */
let menuAnchor = null, menuClosedAt = 0;
/** A menu anchored in the list (timeout presets) or a dialog (user card, ban confirm) opened from it is still open. */
const popupOpen = () => (menu.matches(':popover-open') && list.contains(menuAnchor)) || Boolean(document.querySelector('dialog[open]'));
/** Once that popup closes (focus is already restored by then), drop the hover/focus pause it kept alive. */
function settle() {
  if (popupOpen()) return;
  if (!list.contains(document.activeElement)) pause.focus = false;
  if (!listWrap.matches(':hover')) { pause.hover = false; if (!tools.contains(document.activeElement)) tools.remove(); }
  resume();
  syncPause();
}
menu.addEventListener('toggle', e => { if (e.newState === 'closed') { menuClosedAt = Date.now(); settle(); } });
document.addEventListener('close', e => { if (e.target instanceof HTMLDialogElement) settle(); }, true);
function openMenu(anchor, title, entries, wide = false) {
  // A click on the anchor that just light-dismissed the menu closes it instead of reopening it.
  if (anchor === menuAnchor && Date.now() - menuClosedAt < 300) return;
  menuAnchor = anchor;
  menu.classList.toggle('wide', wide);
  menu.setAttribute('role', wide ? 'dialog' : 'menu'); // the settings panel holds form controls, not menu items
  menu.setAttribute('aria-label', title || '');
  menu.replaceChildren(...(title ? [h('div.menu-title', title)] : []), ...entries.map(e => e instanceof Node ? e
    : h('button.menu-item', { type: 'button', attrs: { role: 'menuitem' }, class: e.danger ? 'danger' : '', onclick: () => { menu.hidePopover(); e.onclick(); } }, e.icon && icon(e.icon, 14), e.label)));
  if (!menu.isConnected) document.body.append(menu);
  if (!menu.matches(':popover-open')) menu.showPopover();
  const r = anchor.getBoundingClientRect();
  const w = menu.offsetWidth, hgt = menu.offsetHeight;
  const left = Math.max(6, Math.min(innerWidth - w - 6, r.right - w));
  const top = r.bottom + 4 + hgt > innerHeight - 6 ? Math.max(6, r.top - hgt - 4) : r.bottom + 4;
  menu.style.setProperty('left', `${left}px`);
  menu.style.setProperty('top', `${top}px`);
  menu.querySelector('button, input, select')?.focus();
}
menu.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const btns = [...menu.querySelectorAll('.menu-item')];
  const i = btns.indexOf(document.activeElement);
  btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus();
  e.preventDefault();
});

/**
 * Detach the hover toolbar (rebuilt on the next hover/focus). If it holds focus, focus moves to its row first (or the
 * list when the row is hidden): keyboard users keep their place, and Chrome would otherwise fire focusout in the middle
 * of remove(), whose handler removes the toolbar a second time (DOMException).
 */
function dropTools(row = tools.parentNode, had = tools.contains(document.activeElement)) {
  if (had || tools.contains(document.activeElement)) {
    row?.focus();
    if (!list.contains(document.activeElement) || tools.contains(document.activeElement)) list.focus();
  }
  tools.remove();
  if (row && document.activeElement === row && row.parentNode === list) attachTools(row); // fresh buttons, still Tab-reachable
}

async function moderate(m, action, extra = {}, btn) {
  const user = authorName(m);
  const row = tools.parentNode, had = tools.contains(document.activeElement); // before busy() disables the button
  return busy(btn, async () => {
    await api('/api/chat/moderate', { body: { accountId: m.accountId, action, messageId: m.id, userId: m.author?.id ? String(m.author.id) : undefined, userLogin: m.author?.login, ...extra } });
    const d = DURATIONS.find(([s]) => s === extra.duration)?.[1] || '';
    toast(t(`chat.done.${action}`, { user, d }), 'ok', 2200);
    dropTools(row, had); // e.g. no delete button on a deleted message
    return true;
  });
}

function openTimeout(m, anchor) {
  openMenu(anchor, t('chat.timeoutFor', { user: authorName(m) }),
    durationsFor(m.accountId).map(([s, label]) => ({ label, onclick: () => moderate(m, 'timeout', { duration: s }) })));
}

async function ban(m, btn) {
  const a = byId.get(m.accountId);
  const user = authorName(m);
  const ok = await confirmDialog({
    title: t('chat.banTitle', { user }), danger: true, confirm: t('chat.ban'),
    body: t('chat.banBody', { user, channel: a?.displayName || m.channel || '', platform: PLATFORM_NAMES[m.platform] || m.platform }),
  });
  if (ok) return moderate(m, 'ban', {}, btn);
  return false;
}

async function feature(m, btn) {
  const row = tools.parentNode, had = tools.contains(document.activeElement);
  await busy(btn, async () => {
    await api('/api/chat/feature', { body: { message: m } });
    toast(t(m ? 'chat.featured' : 'chat.unfeatured'), 'ok', 1800);
  });
  dropTools(row, had);
}

function openQuick(anchor) {
  const entries = [];
  for (const a of accounts) {
    if (a.caps?.markers) entries.push({ label: `${t('chat.marker')} · ${a.displayName}`, icon: 'bookmark', onclick: () => quick('marker', a) });
    if (a.caps?.clips) entries.push({ label: `${t('chat.clip')} · ${a.displayName}`, icon: 'film', onclick: () => quick('clip', a) });
  }
  openMenu(anchor, t('chat.quick'), entries);
}

async function quick(kind, a) {
  await busy(quickBtn, async () => {
    const r = await api(`/api/actions/${kind}`, { body: { accountId: a.id } });
    if (r?.ok === false) throw new Error(r.error || t('common.error'));
    const url = safeUrl(r?.url);
    toast(h('span', t(kind === 'marker' ? 'chat.markerDone' : 'chat.clipDone', { name: a.displayName }),
      url ? [' · ', h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, t('chat.openClip'))] : null), 'ok', 6000);
  });
}

// ------------------------------------------------------------------ user card
function avatarEl(author, large) {
  const url = safeUrl(author?.avatar);
  if (url) return h(`img.avatar${large ? '.lg' : ''}`, { src: url, alt: '' });
  const color = readableColor(author?.color || seedColor(author?.id || author?.login), isLight());
  return h(`span.avatar.letter${large ? '.lg' : ''}`, { style: { '--c': color }, attrs: { 'aria-hidden': 'true' } }, [...(author?.name || author?.login || '?')][0].toUpperCase());
}

function openUserCard(m) {
  const a = byId.get(m.accountId);
  const c = caps(m.accountId);
  const author = m.author || {};
  const own = m.flags?.self || author.roles?.includes('broadcaster');
  const color = readableColor(author.color || seedColor(author.id || author.login), isLight());
  const roles = h('div.card-roles', (author.roles || []).map(r => roleGlyph(r) && h('span.badge', roleGlyph(r), t(`chat.role.${r}`))));
  const info = h('div.card-info');
  const msgs = h('div.card-msgs', [0, 1, 2].map(() => h('div.skeleton.card-skel')));
  const count = h('span.badge', { hidden: true });
  const modRow = !own && (c.timeout || c.ban || c.unban) ? h('div.stack.card-mod',
    h('div.section-title', t('chat.card.mod')),
    c.timeout && durationsFor(m.accountId).length > 0 && h('div.row.dur-row', { style: { '--gap': '6px' } }, icon('clock', 14),
      durationsFor(m.accountId).map(([s, label]) => h('button.btn.sm', { type: 'button', title: t('chat.timeout'), onclick: e => moderate(m, 'timeout', { duration: s }, e.currentTarget) }, label))),
    h('div.row', { style: { '--gap': '6px' } },
      c.ban && h('button.btn.sm.danger', { type: 'button', onclick: e => ban(m, e.currentTarget) }, icon('ban'), t('chat.ban')),
      c.unban && h('button.btn.sm', { type: 'button', onclick: e => moderate(m, 'unban', {}, e.currentTarget) }, icon('check'), t('chat.unban')))) : null;
  const dlg = h('dialog.user-dialog', { attrs: { 'aria-label': `${t('chat.userCard')} · ${authorName(m)}` } },
    h('div.dialog-body',
      h('div.card-head',
        avatarEl(author, true),
        h('div.card-id',
          h('div.card-name', { style: { '--c': color } }, authorName(m)),
          h('div.small.muted.row', { style: { '--gap': '6px' } }, platformIcon(m.platform), author.login && h('span', '@' + author.login),
            a && h('span.faint', t('chat.card.on', { channel: a.displayName })))),
        h('button.icon-btn', { type: 'button', title: t('common.close'), attrs: { 'aria-label': t('common.close') }, onclick: () => dlg.close() }, icon('x'))),
      roles.childElementCount ? roles : null,
      info,
      modRow,
      h('div.row.card-msgs-head', h('div.section-title', t('chat.card.messages')), count),
      msgs));
  // The opener (toolbar button, row) may be gone by the time the card closes (moderation, a 'feature' frame or a
  // re-render dropped the hover toolbar): the browser then drops focus to <body>, so put it back on the row.
  const row = elItem.get(document.activeElement?.closest?.('.msg'));
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (document.activeElement && document.activeElement !== document.body) return;
    (row?.el.isConnected && !row.el.hidden ? row.el : list).focus();
  });
  document.body.append(dlg);
  dlg.showModal();
  const qs = new URLSearchParams({ accountId: m.accountId, userId: String(author.id) });
  api(`/api/chat/user?${qs}`).then(data => {
    const fields = [];
    const date = v => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(lang(), { dateStyle: 'medium' }) : ''; };
    if (date(data.info?.createdAt)) fields.push([t('chat.card.created'), date(data.info.createdAt)]);
    if (date(data.info?.followedAt)) fields.push([t('chat.card.followed'), date(data.info.followedAt)]);
    info.replaceChildren(...[
      fields.length && h('dl.card-fields', fields.map(([k, v]) => [h('dt', k), h('dd', v)])),
      data.info?.description && h('p.small.muted', String(data.info.description)),
      data.infoError && h('p.tiny.faint', t('chat.card.infoError', { error: data.infoError })),
    ].filter(Boolean));
    const list_ = data.messages || [];
    count.textContent = t('chat.card.count', { n: list_.length });
    count.hidden = false;
    msgs.replaceChildren(...(list_.length
      ? list_.slice(-50).map(x => renderMessage(x, { ...opts, avatars: false, icons: accounts.length > 1, badges: false }))
      : [h('p.small.muted', t('chat.card.noMessages'))]));
    msgs.scrollTop = msgs.scrollHeight;
  }).catch(err => {
    msgs.replaceChildren(h('div.banner.danger.small', icon('alert', 14), err.message));
  });
}

// ------------------------------------------------------------------ settings popover
function openSettings() {
  const sw = (key, label, onChange = () => rerenderAll()) => h('label.switch',
    h('input', { type: 'checkbox', checked: Boolean(prefs[key]), onchange: e => { prefs[key] = e.target.checked; savePrefs(); onChange(); } }),
    h('span'), h('span', label));
  const seg = h('div.segmented', { attrs: { role: 'group', 'aria-label': t('chat.set.density') } },
    ['compact', 'comfortable'].map(v => h('button', {
      type: 'button', attrs: { 'aria-pressed': String(prefs.density === v) },
      onclick: e => { prefs.density = v; savePrefs(); applyLayoutPrefs(); for (const b of seg.children) b.setAttribute('aria-pressed', String(b === e.currentTarget)); },
    }, t(`chat.set.${v}`))));
  const sizeOut = h('output.small.muted', `${prefs.fontSize}px`);
  const size = h('input.range', { type: 'range', min: 11, max: 22, step: 1, value: prefs.fontSize, attrs: { 'aria-label': t('chat.set.fontSize') },
    oninput: e => { prefs.fontSize = Number(e.target.value); sizeOut.textContent = `${prefs.fontSize}px`; savePrefs(); applyLayoutPrefs(); } });
  const kw = h('input', { type: 'text', value: prefs.keywords.join(', '), maxLength: 500, placeholder: 'giveaway, discord', attrs: { 'aria-describedby': 'kw-hint' },
    onchange: e => { prefs.keywords = e.target.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30); savePrefs(); rerenderAll(); } });
  const panel = h('div.settings-panel',
    h('div.field', h('span.label', t('chat.set.density')), seg),
    h('div.field', h('span.label.row.nowrap', t('chat.set.fontSize'), h('span.spacer'), sizeOut), size),
    h('div.settings-switches',
      sw('timestamps', t('chat.set.timestamps')), sw('avatars', t('chat.set.avatars')), sw('badges', t('chat.set.badges')),
      sw('icons', t('chat.set.icons')), sw('readable', t('chat.set.readable')),
      sw('showDeleted', t('chat.set.showDeleted'), applyLayoutPrefs),
      !EVENTS_ONLY && sw('sound', t('chat.set.sound'), () => { if (prefs.sound) beep(); })),
    !EVENTS_ONLY && h('label.field', h('span.label', t('chat.set.keywords')), kw, h('span.hint', { id: 'kw-hint' }, t('chat.set.keywordsHint'))));
  openMenu(settingsBtn, t('chat.settings'), [panel], true);
}

function applyLayoutPrefs() {
  document.documentElement.style.setProperty('--chat-fs', `${Math.min(22, Math.max(11, Number(prefs.fontSize) || 14))}px`);
  list.classList.toggle('compact', prefs.density === 'compact');
  list.classList.toggle('hide-deleted', !prefs.showDeleted);
  refilter();
}

let audio;
let lastBeep = 0;
function beep() {
  if (Date.now() - lastBeep < 1500) return;
  lastBeep = Date.now();
  try {
    audio ||= new AudioContext();
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch { /* audio unavailable */ }
}

// ------------------------------------------------------------------ composer
function startReply(m) {
  if (!caps(m.accountId).reply) {
    const mention = `@${m.author?.login || authorName(m)} `;
    if (!input.value.startsWith(mention)) input.value = mention + input.value;
  } else {
    replyTo = m;
    replyChip.replaceChildren(icon('reply', 14),
      h('span.ellipsis', t('chat.replyingTo', { user: authorName(m) }), h('span.faint', ` · ${accLabel(byId.get(m.accountId))}`)),
      h('button.icon-btn', { type: 'button', title: t('chat.cancelReply'), attrs: { 'aria-label': t('chat.cancelReply') }, onclick: cancelReply }, icon('x', 14)));
    replyChip.hidden = false;
    renderTargets();
  }
  syncCounter();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

function cancelReply() {
  replyTo = null;
  replyChip.hidden = true;
  renderTargets();
  input.focus();
}

/** Smallest chatMaxLength among the accounts the message goes to (YouTube 200, Twitch/Kick 500), and which ones it is too long for. */
function lengthCheck(n) {
  const ids = replyTo ? [replyTo.accountId] : currentTargets();
  const max = id => Math.min(500, limits(id).chatMaxLength || 500);
  const over = ids.filter(id => n > max(id)).map(id => `${accLabel(byId.get(id))} (${max(id)})`);
  return { max: Math.min(500, ...ids.map(max)), error: over.length ? t('chat.tooLongFor', { names: over.join(', ') }) : '' };
}

function syncCounter() {
  const n = [...input.value].length;
  const { max, error } = lengthCheck(n);
  counter.textContent = n ? `${n}/${max}` : '';
  counter.title = error;
  counter.classList.toggle('over', Boolean(error));
  hint.textContent = error || t('chat.hint');
  hint.classList.toggle('over', Boolean(error));
  if (limitStatus.textContent !== error) limitStatus.textContent = error; // announced only when the limit state changes
  input.setAttribute('aria-invalid', String(Boolean(error)));
  input.style.setProperty('height', 'auto');
  input.style.setProperty('height', `${Math.min(input.scrollHeight + 2, 120)}px`);
}

async function send() {
  if (sending) return;
  const text = input.value.replace(/\s+/g, ' ').trim();
  if (!text) return;
  const targets = replyTo ? [replyTo.accountId] : currentTargets();
  if (!targets.length) { toast(t('chat.noTarget'), 'warn'); return; }
  const why = replyTo ? blockReason(byId.get(replyTo.accountId)) : '';
  if (why) { toast(why, 'warn', 6000); return; }
  const { error } = lengthCheck([...text].length);
  if (error) { toast(error, 'warn', 6000); return; }
  sending = true;
  await busy(sendBtn, async () => {
    const body = { text, targets };
    if (replyTo) body.replyTo = { accountId: replyTo.accountId, messageId: replyTo.id };
    const { results } = await api('/api/chat/send', { body });
    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    for (const [id, r] of failed) toast(t('chat.sendFailed', { name: accLabel(byId.get(id)), error: r.error || t('common.error') }), 'error', 7000);
    if (failed.length < targets.length) {
      if (sentHistory.at(-1) !== text) sentHistory.push(text);
      if (sentHistory.length > 50) sentHistory.shift();
      histPos = -1;
      input.value = '';
      if (replyTo) cancelReply();
      syncCounter();
    }
  });
  sending = false;
  input.focus();
}

let tab = null; // {start, end, matches, i}
function completeEmote(back) {
  if (!tab) {
    const caret = input.selectionStart;
    const word = /(\S+)$/.exec(input.value.slice(0, caret))?.[1];
    if (!word) return false;
    const low = word.toLowerCase();
    const matches = [...emotes.keys()].filter(n => n.toLowerCase().startsWith(low)).sort((x, y) => x.length - y.length || x.localeCompare(y)).slice(0, 12);
    if (!matches.length) return false;
    tab = { start: caret - word.length, end: caret, matches, i: -1 };
  }
  tab.i = (tab.i + (back ? -1 : 1) + tab.matches.length) % tab.matches.length;
  applyCompletion(tab.matches[tab.i]);
  return true;
}

function applyCompletion(name) {
  input.value = input.value.slice(0, tab.start) + name + input.value.slice(tab.end);
  tab.end = tab.start + name.length;
  input.setSelectionRange(tab.end, tab.end);
  suggest.replaceChildren(...tab.matches.map((n, i) => h('button.sugg', {
    type: 'button', tabIndex: -1, attrs: { role: 'option', 'aria-selected': String(i === tab.i) },
    onmousedown: e => e.preventDefault(),
    onclick: () => { tab.i = i; applyCompletion(n); closeSuggest(); input.value = input.value.slice(0, input.selectionEnd) + ' ' + input.value.slice(input.selectionEnd); },
  }, h('img', { src: emotes.get(n), alt: '' }), h('span', n))));
  suggest.hidden = false;
  suggest.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  syncCounter();
}
function closeSuggest() { tab = null; suggest.hidden = true; }

input.addEventListener('keydown', e => {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
    if (completeEmote(e.shiftKey)) { e.preventDefault(); return; }
  } else if (e.key !== 'Shift') closeSuggest();
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); return; }
  if (e.key === 'Escape' && replyTo) { cancelReply(); return; }
  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  if (e.key === 'ArrowUp' && sentHistory.length && (atStart || !input.value || histPos >= 0)) {
    histPos = Math.min(sentHistory.length - 1, histPos + 1);
    input.value = sentHistory[sentHistory.length - 1 - histPos];
    e.preventDefault();
    syncCounter();
  } else if (e.key === 'ArrowDown' && histPos >= 0) {
    histPos--;
    input.value = histPos >= 0 ? sentHistory[sentHistory.length - 1 - histPos] : '';
    e.preventDefault();
    syncCounter();
  }
});
input.addEventListener('input', () => { histPos = -1; syncCounter(); });
input.addEventListener('blur', () => setTimeout(closeSuggest, 150));

// ------------------------------------------------------------------ list interactions
listWrap.addEventListener('mouseenter', () => { pause.hover = true; syncPause(); });
listWrap.addEventListener('mouseleave', () => {
  if (popupOpen()) return; // moving onto the timeout menu / user card: keep the moderated line in place (settle() resumes)
  pause.hover = false;
  if (!tools.contains(document.activeElement)) tools.remove();
  resume();
});
list.addEventListener('mouseover', e => {
  const el = e.target.closest?.('.msg, .evt');
  if (el && el.parentNode === list) attachTools(el);
});
// Only a user scroll (wheel, touch, keys, scrollbar drag) pauses; layout shifts (images, scroll anchoring) keep following.
let userScrollAt = 0, dragging = false;
for (const type of ['wheel', 'touchmove']) list.addEventListener(type, () => { userScrollAt = Date.now(); }, { passive: true });
list.addEventListener('pointerdown', () => { dragging = true; });
window.addEventListener('pointerup', () => { dragging = false; });
list.addEventListener('scroll', () => {
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  if (atBottom) {
    if (pause.scroll) { pause.scroll = false; resume(); }
  } else if (dragging || Date.now() - userScrollAt < 800) {
    if (!pause.scroll) { pause.scroll = true; syncPause(); }
  } else if (!isPaused()) stick();
}, { passive: true });
// Images (emotes, badges) change line heights after load: keep following the bottom.
list.addEventListener('load', () => { if (!isPaused()) stick(); }, true);
list.addEventListener('focusin', e => {
  const el = e.target.closest('.msg, .evt');
  pause.focus = Boolean(el) && e.target.matches(':focus-visible'); // keyboard navigation only, not mouse clicks
  if (el && el.parentNode === list) attachTools(el);
  syncPause();
});
list.addEventListener('focusout', e => {
  const to = e.relatedTarget;
  // Focus moving into the timeout menu or a dialog opened from the list keeps its anchor (and the pause) alive.
  if (to && ((list.contains(to) && to !== list) || menu.contains(to) || to.closest?.('dialog'))) return;
  pause.focus = false;
  if (!pause.hover) tools.remove();
  resume();
});
list.addEventListener('keydown', e => {
  if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' '].includes(e.key)) userScrollAt = Date.now();
  const rows = items.filter(it => !it.el.hidden).map(it => it.el);
  if (!rows.length) return;
  const cur = document.activeElement.closest?.('.msg, .evt');
  let i = rows.indexOf(cur);
  if (e.key === 'ArrowDown') i = i < 0 ? rows.length - 1 : Math.min(rows.length - 1, i + 1);
  else if (e.key === 'ArrowUp') i = i < 0 ? rows.length - 1 : Math.max(0, i - 1);
  else if (e.key === 'Home') i = 0;
  else if (e.key === 'End') i = rows.length - 1;
  else if (e.key === 'Escape') { list.focus(); pause.focus = false; resume(true); return; }
  else if (e.key === 'Enter' && cur && e.target === cur) { const it = elItem.get(cur); if (it?.kind === 'chat' && it.d.author?.id) openUserCard(it.d); return; }
  else return;
  e.preventDefault();
  rows[i].focus();
  rows[i].scrollIntoView({ block: 'nearest' });
});
list.addEventListener('dblclick', e => {
  const el = e.target.closest('.msg');
  const it = el && elItem.get(el);
  if (it?.d.author?.id && !e.target.closest('a, button')) openUserCard(it.d);
});
list.addEventListener('click', e => {
  if (!e.target.closest('.msg-author')) return;
  const it = elItem.get(e.target.closest('.msg'));
  if (it?.d.author?.id) openUserCard(it.d);
});
searchInput.addEventListener('input', () => setSearch(searchInput.value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { searchInput.value = ''; setSearch(''); searchRow.hidden = true; searchBtn.focus(); } });
window.addEventListener('od:connection', e => { connBanner.hidden = e.detail; });

// ------------------------------------------------------------------ boot
let afterHello = false;
function onFrame({ t: type, d }) {
  const replayed = afterHello;
  afterHello = type === 'hello';
  // The hub replays 'feature' right after hello only when something is still featured: forget the old one first.
  if (type === 'hello') { setFeatured(null); setAccounts(d.accounts); resetList(d.backlog); }
  else if (type === 'chat' || type === 'event') push({ kind: type, d });
  else if (type === 'chat:delete') applyDelete(d);
  else if (type === 'stats') { stats.set(d.accountId, d); renderStrip(); if (d.quota) renderTargets(); }
  else if (type === 'accounts') setAccounts(d);
  else if (type === 'feature') setFeatured(d, replayed);
  else if (type === 'settings' && !query.get('theme') && d?.theme) { applyTheme(d.theme); rerenderAll(); }
}

boot({
  page: '/chat',
  title: t(EVENTS_ONLY ? 'chat.eventsTitle' : 'chat.title'),
  onReady(state, root) {
    root.classList.add('chat-app');
    if (EVENTS_ONLY) root.classList.add('events-only');
    list.append(...Array.from({ length: 7 }, (_, i) => h('div.msg-skel', { style: { '--w': `${45 + ((i * 37) % 45)}%` } }, h('span.skeleton'), h('span.skeleton'))));
    root.append(strip, toolbar, searchRow, connBanner, listWrap);
    if (!EVENTS_ONLY) root.append(composer);
    setAccounts(state.accounts);
    syncToolbar();
    applyLayoutPrefs();
    syncPause();
  },
  onFrame,
});
