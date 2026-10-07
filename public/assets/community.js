// Community dock: "who is here" per account (SPEC.md §7.2). Thin view over GET /api/community + 'stats' frames.
import { boot, h, svg, api, t, addI18n, lang, store, icon, platformIcon, PLATFORM_NAMES, fmt, withKey, copy } from '/assets/core.js';

addI18n({
  fr: {
    'community.summary': 'Résumé de l’audience', 'community.totalViewers': 'spectateur au total', 'community.totalViewers|plural': 'spectateurs au total',
    'community.noLive': 'Aucun live en cours', 'community.inChat': '{n} dans le chat', 'community.updated': 'Mis à jour {ago}',
    'community.refresh': 'Actualiser', 'community.search': 'Rechercher un pseudo…', 'community.window': 'Fenêtre des actifs',
    'community.jump': 'Aller à {name}', 'community.viewers': '{n} spectateur', 'community.viewers|plural': '{n} spectateurs',
    'community.people': '{n} personne', 'community.people|plural': '{n} personnes',
    'community.group.broadcaster': 'Streamer', 'community.group.moderator': 'Modérateurs', 'community.group.vip': 'VIP',
    'community.group.subscriber': 'Abonnés', 'community.group.bot': 'Bots', 'community.group.viewer': 'Spectateurs',
    'community.role.broadcaster': 'Streamer', 'community.role.moderator': 'Modérateur', 'community.role.vip': 'VIP',
    'community.role.subscriber': 'Abonné', 'community.role.member': 'Membre', 'community.role.bot': 'Bot',
    'community.role.verified': 'Vérifié', 'community.role.staff': 'Staff',
    'community.activeLabel': 'Actifs ces {n} dernières minutes',
    'community.activeHint': '{platform} ne fournit pas la liste des spectateurs : seules les personnes qui écrivent dans le chat apparaissent.',
    'community.officialLabel': 'Liste officielle · {ago}',
    'community.officialHint': 'Fournie par {platform}, actualisée chaque minute (peut avoir un peu de retard).',
    'community.listError': 'Liste indisponible', 'community.unavailable': 'La lecture du chat est désactivée pour ce compte : impossible de savoir qui est là.', 'community.needsReconnect': 'Ce compte doit être reconnecté.',
    'community.reconnect': 'Reconnecter', 'community.disabled': 'Compte désactivé.',
    'community.emptyLive': 'Personne pour l’instant.', 'community.emptyOffline': 'Hors ligne : la liste se remplira pendant le live.',
    'community.emptyActive': 'Personne n’a écrit ces {n} dernières minutes.', 'community.noMatch': 'Aucun résultat pour « {q} ».',
    'community.showAll': 'Tout afficher ({n})', 'community.loadError': 'Impossible de charger la communauté.',
    'community.refreshError': 'Mise à jour impossible : {error}', 'community.now': 'à l’instant',
    'community.msgs': '{n} message', 'community.msgs|plural': '{n} messages', 'community.lastSeen': 'vu {ago}',
    'community.card.on': 'Sur {platform} · {channel}', 'community.card.activity': 'Activité',
    'community.card.created': 'Compte créé le', 'community.card.followed': 'Suit depuis le',
    'community.card.recent': 'Messages récents', 'community.card.noMessages': 'Aucun message récent.',
    'community.card.unavailable': 'Détails indisponibles pour le moment.', 'community.card.profile': 'Profil',
    'community.card.copy': 'Copier le pseudo',
    'community.partial': 'partiel', 'community.partialTip': 'Le nombre de spectateurs d’au moins un compte est inconnu : il n’est pas compté dans le total.',
    'community.stale': 'La dernière mise à jour a échoué, valeurs précédentes affichées : {error}',
    'community.stale|plural': '{n} mises à jour de suite ont échoué, valeurs précédentes affichées : {error}',
    'community.unknown': 'Statut inconnu', 'community.unknownTip': 'Statistiques indisponibles : {error}',
  },
  en: {
    'community.summary': 'Audience summary', 'community.totalViewers': 'viewer in total', 'community.totalViewers|plural': 'viewers in total',
    'community.noLive': 'No live stream right now', 'community.inChat': '{n} in chat', 'community.updated': 'Updated {ago}',
    'community.refresh': 'Refresh', 'community.search': 'Search a username…', 'community.window': 'Active window',
    'community.jump': 'Go to {name}', 'community.viewers': '{n} viewer', 'community.viewers|plural': '{n} viewers',
    'community.people': '{n} person', 'community.people|plural': '{n} people',
    'community.group.broadcaster': 'Broadcaster', 'community.group.moderator': 'Moderators', 'community.group.vip': 'VIPs',
    'community.group.subscriber': 'Subscribers', 'community.group.bot': 'Bots', 'community.group.viewer': 'Viewers',
    'community.role.broadcaster': 'Broadcaster', 'community.role.moderator': 'Moderator', 'community.role.vip': 'VIP',
    'community.role.subscriber': 'Subscriber', 'community.role.member': 'Member', 'community.role.bot': 'Bot',
    'community.role.verified': 'Verified', 'community.role.staff': 'Staff',
    'community.activeLabel': 'Active in the last {n} minutes',
    'community.activeHint': '{platform} does not provide a viewer list: only people who write in chat are shown.',
    'community.officialLabel': 'Official list · {ago}',
    'community.officialHint': 'Provided by {platform}, refreshed every minute (may lag slightly).',
    'community.listError': 'List unavailable', 'community.unavailable': 'Chat reading is off for this account, so there is no way to tell who is here.', 'community.needsReconnect': 'This account needs to be reconnected.',
    'community.reconnect': 'Reconnect', 'community.disabled': 'Account disabled.',
    'community.emptyLive': 'Nobody here yet.', 'community.emptyOffline': 'Offline: the list fills up during the stream.',
    'community.emptyActive': 'Nobody has written in the last {n} minutes.', 'community.noMatch': 'No results for “{q}”.',
    'community.showAll': 'Show all ({n})', 'community.loadError': 'Could not load the community.',
    'community.refreshError': 'Update failed: {error}', 'community.now': 'now',
    'community.msgs': '{n} message', 'community.msgs|plural': '{n} messages', 'community.lastSeen': 'seen {ago}',
    'community.card.on': 'On {platform} · {channel}', 'community.card.activity': 'Activity',
    'community.card.created': 'Account created', 'community.card.followed': 'Following since',
    'community.card.recent': 'Recent messages', 'community.card.noMessages': 'No recent messages.',
    'community.card.unavailable': 'Details unavailable right now.', 'community.card.profile': 'Profile',
    'community.card.copy': 'Copy username',
    'community.partial': 'partial', 'community.partialTip': 'At least one account’s viewer count is unknown and is not included in the total.',
    'community.stale': 'The last update failed, showing earlier values: {error}',
    'community.stale|plural': '{n} updates in a row failed, showing earlier values: {error}',
    'community.unknown': 'Status unknown', 'community.unknownTip': 'Stats unavailable: {error}',
  },
});

const WINDOWS = [5, 15, 60];
const GROUPS = ['broadcaster', 'moderator', 'vip', 'subscriber', 'bot', 'viewer'];
const PRIORITY = ['broadcaster', 'bot', 'moderator', 'vip', 'subscriber', 'member']; // a modded bot is a bot
const ROLE_ICONS = { broadcaster: 'monitor', moderator: 'shield', vip: 'star', subscriber: 'heart', member: 'heart', bot: 'zap' };
const PAGE = 150; // rows rendered per list before "show all"
const REFRESH_MS = 30_000;
const PROFILE = {
  twitch: u => u.login && `https://www.twitch.tv/${encodeURIComponent(u.login)}`,
  kick: u => u.login && `https://kick.com/${encodeURIComponent(u.login)}`,
  youtube: u => /^UC[\w-]{22}$/.test(u.id) && `https://www.youtube.com/channel/${u.id}`,
  tiktok: u => u.login && `https://www.tiktok.com/@${encodeURIComponent(u.login)}`,
};
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const storedCollapsed = store.get('community.collapsed', []);
const collapsed = new Set(Array.isArray(storedCollapsed) ? storedCollapsed : []);
const showAll = new Set();
let windowMin = WINDOWS.includes(store.get('community.window')) ? store.get('community.window') : 15;
let data = null;        // last /api/community payload
let loadError = '';     // last refresh error ('' when fine)
let loadedAt = 0;
let seq = 0;
let query = '';
let reloadTimer = 0;
let opened = ''; // section just expanded by the user (animated once)
const els = {};

const nameOf = u => u.name || u.login || '?';
const groupOf = roles => { const r = PRIORITY.find(p => roles?.includes(p)) || 'viewer'; return r === 'member' ? 'subscriber' : r; };
const matches = u => !query || nameOf(u).toLowerCase().includes(query) || (u.login || '').toLowerCase().includes(query);
const roleLabel = r => { const s = t('community.role.' + r); return s === 'community.role.' + r ? r : s; };
const isHttpUrl = url => /^https?:\/\//i.test(url || '');
const chevron = () => svg('<svg class="cm-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
const short = ts => { const s = (Date.now() - ts) / 1000; return s < 60 ? t('community.now') : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`; };
const hue = s => [...s].reduce((acc, c) => (acc * 31 + c.codePointAt(0)) % 360, 7);
/** Same rule as freshness() in src/community.js: live null = unknown, statsError = values kept from an earlier poll. */
function applyStats(a, s) {
  a.live = s.live === undefined && s.error ? null : Boolean(s.live);
  a.viewers = Number.isFinite(s.viewers) ? s.viewers : null;
  a.statsError = s.error || undefined;
  a.statsFails = s.fails || undefined;
}
const staleTip = a => (a.live === null ? t('community.unknownTip', { error: a.statsError }) : t('community.stale', { n: a.statsFails || 1, error: a.statsError }));
/** Dimmed wrapper with a tooltip (and the same text for screen readers) when the stats are stale or unknown. */
const stale = (a, ...kids) => (a.statsError ? h('span.cm-stale', { attrs: { title: staleTip(a) } }, ...kids, h('span.sr-only', ` (${staleTip(a)})`)) : kids);
const initial = (name, big) => h(`span.cm-initial${big ? '.lg' : ''}`, { style: { '--h': hue(name) }, attrs: { 'aria-hidden': 'true' } }, [...name][0]?.toUpperCase() || '?');

boot({
  page: '/community',
  title: t('nav.community'),
  onReady(state, root) {
    build(root);
    load();
    setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt > REFRESH_MS) load(); });
  },
  onFrame(frame) {
    if (frame.t === 'stats' && data) {
      const a = data.accounts.find(x => x.accountId === frame.d.accountId);
      if (!a) return;
      applyStats(a, frame.d);
      renderSummary();
      els.list.querySelector(`[data-status="${CSS.escape(a.accountId)}"]`)?.replaceWith(statusLine(a));
    } else if (frame.t === 'accounts' && data) {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(load, 600); // account list or status changed
    } else if (frame.t === 'hello' && data && Date.now() - loadedAt > 5000) {
      load(); // reconnected after a server restart or a network drop
    }
  },
});

function build(root) {
  els.refresh = h('button.icon-btn.cm-refresh', {
    type: 'button', onclick: () => load(true),
    attrs: { 'aria-label': t('community.refresh'), title: t('community.refresh') },
  }, icon('refresh'));
  els.summary = h('div.cm-sum-body');
  els.status = h('p.cm-status.small', { attrs: { role: 'status', 'aria-live': 'polite' } });
  els.search = h('input', {
    type: 'search', placeholder: t('community.search'), autocomplete: 'off',
    attrs: { 'aria-label': t('community.search'), spellcheck: 'false' },
    oninput: () => { query = els.search.value.trim().toLowerCase(); renderAccounts(); },
    onkeydown: e => { if (e.key === 'Escape' && els.search.value) { e.preventDefault(); els.search.value = ''; query = ''; renderAccounts(); } },
  });
  els.window = h('div.segmented.cm-window', { attrs: { role: 'group', 'aria-label': t('community.window'), title: t('community.window') } },
    WINDOWS.map(n => h('button', { type: 'button', dataset: { w: n }, attrs: { 'aria-pressed': String(n === windowMin) }, onclick: () => setWindow(n) }, `${n} min`)));
  els.list = h('div.cm-accounts', { attrs: { 'aria-busy': 'true' } });
  root.append(h('div.cm-page',
    h('section.card.cm-summary', { attrs: { 'aria-label': t('community.summary') } }, els.summary, els.refresh),
    els.status,
    els.toolbar = h('div.cm-toolbar', h('label.cm-search', icon('search'), els.search), els.window),
    els.list));
  // "/" focuses the search, like most list apps.
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(input|textarea|select)$/i.test(e.target.tagName) && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      els.search.focus();
    }
  });
  render();
}

async function load(manual = false) {
  const id = ++seq;
  els.refresh.classList.add('spinning');
  try {
    const res = await api(`/api/community?window=${windowMin}`);
    if (id !== seq) return;
    for (const a of res.accounts) if (a.kind === 'chatters') a.chatters.sort((x, y) => collator.compare(nameOf(x), nameOf(y)));
    data = res;
    loadError = '';
    loadedAt = Date.now();
  } catch (err) {
    if (id !== seq) return;
    loadError = err.message;
    if (manual) els.refresh.focus();
  } finally {
    if (id === seq) els.refresh.classList.remove('spinning');
  }
  render();
}

function setWindow(n) {
  windowMin = n;
  store.set('community.window', n);
  for (const b of els.window.children) b.setAttribute('aria-pressed', String(Number(b.dataset.w) === n));
  load();
}

function toggle(key) {
  if (collapsed.has(key)) { collapsed.delete(key); opened = key; } else collapsed.add(key);
  store.set('community.collapsed', [...collapsed].slice(-300));
  renderAccounts();
}

function render() {
  renderSummary();
  renderAccounts();
}

// ---------------------------------------------------------------- Summary
function renderSummary() {
  els.status.replaceChildren(loadError && data ? h('span.cm-status-err', icon('alert', 14), t('community.refreshError', { error: loadError })) : '');
  if (!data) {
    els.summary.replaceChildren(h('div.skeleton.cm-sk-big'), h('div.skeleton.cm-sk-line'), h('div.skeleton.cm-sk-line.short'));
    return;
  }
  const live = data.accounts.filter(a => a.live);
  const shown = data.accounts.filter(a => a.live || a.live === null); // unknown state: shown, never counted
  const total = live.reduce((sum, a) => sum + (a.viewers ?? 0), 0);
  const partial = data.accounts.some(a => a.live === null || (a.live && a.viewers === null));
  const people = data.accounts.reduce((sum, a) => sum + a.chatters.length, 0);
  els.summary.replaceChildren(
    h('div.cm-total', { attrs: partial ? { title: t('community.partialTip') } : {} },
      h('strong', { class: partial && 'cm-partial' }, fmt.number(total)), h('span.muted', t('community.totalViewers', { n: total })),
      partial && h('span.badge.warn', t('community.partial')), partial && h('span.sr-only', t('community.partialTip'))),
    h('div.cm-chips', shown.length ? shown.map(a => h(`button.cm-chip.pf-${a.platform}${a.statsError ? '.cm-stale' : ''}`, {
      type: 'button', onclick: () => jump(a.accountId),
      attrs: { title: [t('community.jump', { name: `${PLATFORM_NAMES[a.platform] || a.platform} · ${a.displayName}` }), a.statsError && staleTip(a)].filter(Boolean).join(' · ') },
    }, platformIcon(a.platform), h('span.cm-chip-name.ellipsis', a.displayName), h('strong', a.live ? fmt.number(a.viewers) : '?')))
      : h('span.cm-nolive.small.muted', h('span.status-dot'), t('community.noLive'))),
    h('p.cm-meta.small.muted', icon('users', 14), h('span', t('community.inChat', { n: fmt.number(people) })),
      h('span.faint', '·'), h('span.faint', t('community.updated', { ago: fmt.ago(loadedAt) }))));
}

function jump(accountId) {
  const head = els.list.querySelector(`[data-focus="${CSS.escape('a:' + accountId)}"]`);
  if (!head) return;
  if (head.getAttribute('aria-expanded') === 'false') head.click();
  const again = els.list.querySelector(`[data-focus="${CSS.escape('a:' + accountId)}"]`);
  again.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  again.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Accounts
function renderAccounts() {
  const focused = document.activeElement?.dataset?.focus;
  els.window.hidden = !data?.accounts.some(a => a.kind === 'active');
  els.toolbar.hidden = data?.accounts.length === 0;
  els.list.setAttribute('aria-busy', String(!data && !loadError));
  if (!data) {
    els.list.replaceChildren(...(loadError
      ? [h('div.card.empty.cm-empty', h('div.cm-empty-icon.danger', icon('alert', 22)), h('p', t('community.loadError')),
        h('p.small.faint', loadError), h('button.btn', { type: 'button', onclick: () => load(true) }, icon('refresh'), t('common.retry')))]
      : [1, 2, 3].map(() => h('div.card.cm-sk-card', h('div.skeleton.cm-sk-av'), h('div.cm-sk-lines', h('div.skeleton.cm-sk-line'), h('div.skeleton.cm-sk-line.short'))))));
    return;
  }
  if (!data.accounts.length) {
    els.list.replaceChildren(h('div.card.empty.cm-empty', h('div.cm-empty-icon', icon('users', 22)), h('p', t('common.noAccounts')),
      h('a.btn.primary', { href: withKey('/') }, t('common.connectAccounts'))));
    return;
  }
  const sections = data.accounts.map(a => ({ a, users: a.chatters.filter(matches) })).filter(s => !query || s.users.length);
  els.list.replaceChildren(...(sections.length ? sections.map(accountSection)
    : [h('div.card.empty.cm-empty', h('div.cm-empty-icon', icon('search', 22)), h('p', t('community.noMatch', { q: els.search.value.trim() })))]));
  if (focused) els.list.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus();
  opened = '';
}

function statusLine(a) {
  return h('span.cm-acc-status', { dataset: { status: a.accountId } }, stale(a,
    a.live ? [h('span.badge.live', t('common.live')), h('span.cm-viewers', { attrs: { title: t('community.viewers', { n: a.viewers ?? 0 }) } }, icon('eye', 13), h('span', { attrs: { 'aria-hidden': 'true' } }, fmt.number(a.viewers)), h('span.sr-only', t('community.viewers', { n: a.viewers ?? 0 })))]
      : h('span.faint', t(a.live === null ? 'community.unknown' : 'common.offlineStream'))));
}

function accountSection({ a, users }) {
  const key = 'a:' + a.accountId;
  const open = Boolean(query) || !collapsed.has(key);
  const bodyId = 'cm-body-' + a.accountId;
  const avatar = isHttpUrl(a.avatar)
    ? h('span.cm-acc-av', h('img.avatar', { src: a.avatar, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }), platformIcon(a.platform))
    : platformIcon(a.platform, { large: true });
  return h(`section.card.flush.cm-acc.pf-stripe.pf-${a.platform}`, { dataset: { acc: a.accountId } },
    h('h2.cm-acc-h', h('button.cm-acc-head', {
      type: 'button', disabled: Boolean(query), onclick: () => toggle(key), dataset: { focus: key },
      attrs: { 'aria-expanded': String(open), 'aria-controls': bodyId },
    }, avatar,
    h('span.cm-acc-title', h('span.cm-acc-name.ellipsis', a.displayName), statusLine(a)),
    h('span.cm-count', { attrs: { title: t('community.people', { n: users.length }) } }, icon('users', 13), h('span', { attrs: { 'aria-hidden': 'true' } }, fmt.number(users.length)), h('span.sr-only', t('community.people', { n: users.length }))),
    chevron())),
    open && h('div.cm-acc-body', { id: bodyId, class: key === opened && 'cm-in' }, accountBody(a, users)));
}

function accountBody(a, users) {
  const platform = PLATFORM_NAMES[a.platform] || a.platform;
  const out = [];
  if (a.status === 'needs_reconnect') {
    out.push(h('div.banner.warn.small.cm-banner', icon('alert', 15), h('span', t('community.needsReconnect'), ' ', h('a', { href: withKey('/') }, t('community.reconnect')))));
  } else if (a.status === 'disabled') {
    out.push(h('div.banner.small.cm-banner', icon('info', 15), h('span', t('community.disabled'))));
  }
  if (a.unavailable) return [...out, h('p.cm-empty-line', t('community.unavailable'))];
  if (a.error) out.push(h('div.banner.danger.small.cm-banner', icon('alert', 15), h('span', h('strong', t('community.listError')), ' — ', a.error)));
  out.push(a.kind === 'chatters'
    ? h('p.cm-hint', { attrs: { title: t('community.officialHint', { platform }) } }, icon('check', 13), t('community.officialLabel', { ago: fmt.ago(a.updatedAt) }))
    : h('p.cm-hint', { attrs: { title: t('community.activeHint', { platform }) } }, icon('clock', 13), t('community.activeLabel', { n: windowMin })));
  if (!users.length) {
    out.push(h('p.cm-empty-line', a.kind === 'active' ? t('community.emptyActive', { n: windowMin })
      : a.live ? t('community.emptyLive') : t('community.emptyOffline')));
  } else if (a.kind === 'chatters') {
    const groups = new Map(GROUPS.map(g => [g, []]));
    for (const u of users) groups.get(groupOf(u.roles)).push(u);
    for (const [g, list] of groups) if (list.length) out.push(groupSection(a, g, list));
  } else {
    out.push(userList(a, 'l:' + a.accountId, users));
  }
  return out;
}

function groupSection(a, g, users) {
  const key = `g:${a.accountId}:${g}`;
  const open = Boolean(query) || !collapsed.has(key);
  const listId = `cm-list-${a.accountId}-${g}`;
  return h('div.cm-group',
    h('h3.cm-group-h', h('button.cm-group-head', {
      type: 'button', disabled: Boolean(query), onclick: () => toggle(key), dataset: { focus: key },
      attrs: { 'aria-expanded': String(open), 'aria-controls': listId },
    }, chevron(), h('span', t('community.group.' + g)), h('span.cm-group-count', fmt.number(users.length)))),
    open && h('div', { id: listId, class: key === opened && 'cm-in' }, userList(a, key, users)));
}

function userList(a, key, users) {
  const all = showAll.has(key) || users.length <= PAGE + 20;
  return h('ul.cm-users', { attrs: { role: 'list' } },
    (all ? users : users.slice(0, PAGE)).map(u => h('li', userRow(a, u))),
    !all && h('li', h('button.btn.ghost.sm.block.cm-more', {
      type: 'button', dataset: { focus: 'more:' + key }, onclick: () => { showAll.add(key); renderAccounts(); },
    }, t('community.showAll', { n: fmt.number(users.length) }))));
}

function roleIcons(roles = []) {
  return roles.filter(r => ROLE_ICONS[r]).slice(0, 3).map(r => h(`span.cm-role.r-${r}`, { attrs: { title: roleLabel(r) } }, icon(ROLE_ICONS[r], 12)));
}

function userRow(a, u) {
  const name = nameOf(u);
  const activity = u.count !== undefined ? `${t('community.msgs', { n: u.count })}, ${t('community.lastSeen', { ago: fmt.ago(u.lastSeen) })}` : '';
  const roles = (u.roles || []).filter(r => ROLE_ICONS[r]).map(roleLabel);
  return h('button.cm-user', {
    type: 'button', onclick: () => openCard(a, u), dataset: { focus: `u:${a.accountId}:${u.id}` },
    attrs: { 'aria-haspopup': 'dialog', 'aria-label': [name, ...roles, activity].filter(Boolean).join(', ') },
  }, initial(name),
  h('span.cm-user-name.ellipsis', name, u.login && u.login.toLowerCase() !== name.toLowerCase() && h('span.faint', ` @${u.login}`)),
  a.kind === 'active' && roleIcons(u.roles),
  u.count !== undefined && h('span.cm-user-meta', icon('chat', 11), String(u.count), h('span.cm-dot', '·'), short(u.lastSeen)));
}

// ---------------------------------------------------------------- User card
function openCard(a, u) {
  const opener = document.activeElement?.dataset?.focus;
  const name = nameOf(u);
  const platform = PLATFORM_NAMES[a.platform] || a.platform;
  const profile = PROFILE[a.platform]?.(u);
  const titleId = 'cm-card-title';
  const avatar = h('span.cm-card-av', initial(name, true));
  const extra = h('div.cm-card-extra', { attrs: { 'aria-busy': 'true' } }, h('div.skeleton'), h('div.skeleton.short'));
  const facts = h('dl.cm-facts');
  const fact = (label, value) => facts.append(h('div', h('dt', label), h('dd', value)));
  if (u.count !== undefined) fact(t('community.card.activity'), `${t('community.msgs', { n: u.count })} · ${t('community.lastSeen', { ago: fmt.ago(u.lastSeen) })}`);

  const dlg = h(`dialog.cm-card.pf-${a.platform}`, { attrs: { 'aria-labelledby': titleId } },
    h('div.dialog-body',
      h('div.cm-card-head', avatar,
        h('div.cm-card-id', h('h2.ellipsis', { id: titleId }, name), u.login && h('p.small.muted.ellipsis', '@' + u.login)),
        h('button.icon-btn', { type: 'button', onclick: () => dlg.close(), attrs: { 'aria-label': t('common.close') } }, icon('x'))),
      h('p.cm-card-on.small.muted', platformIcon(a.platform), t('community.card.on', { platform, channel: a.displayName })),
      (u.roles || []).length > 0 && h('div.row.cm-card-roles', u.roles.map(r => h(`span.badge${r === 'moderator' || r === 'broadcaster' ? '.ok' : r === 'vip' || r === 'subscriber' || r === 'member' ? '.accent' : ''}`, roleLabel(r)))),
      facts, extra),
    h('div.dialog-actions',
      profile && h('a.btn.sm', { href: profile, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), t('community.card.profile')),
      h('button.btn.sm', { type: 'button', onclick: () => copy(u.login || name) }, icon('copy'), t('community.card.copy'))));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    dlg.remove();
    if (opener) els.list.querySelector(`[data-focus="${CSS.escape(opener)}"]`)?.focus();
  });
  document.body.append(dlg);
  dlg.showModal();

  api(`/api/chat/user?accountId=${encodeURIComponent(a.accountId)}&userId=${encodeURIComponent(u.id)}`).then(res => {
    const info = res?.info || {};
    if (isHttpUrl(info.avatar)) avatar.replaceChildren(h('img.avatar.lg', { src: info.avatar, alt: '', referrerPolicy: 'no-referrer' }));
    const date = v => { const d = new Date(v || NaN); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(lang(), { dateStyle: 'medium' }); };
    if (date(info.createdAt)) fact(t('community.card.created'), date(info.createdAt));
    if (date(info.followedAt)) fact(t('community.card.followed'), date(info.followedAt));
    const messages = (Array.isArray(res?.messages) ? res.messages : []).filter(m => !m.deleted).slice(-5).reverse();
    extra.replaceChildren(
      info.description ? h('p.small.muted.cm-card-desc', String(info.description)) : '',
      h('h3.section-title', t('community.card.recent')),
      messages.length ? h('ul.cm-msgs', messages.map(m => h('li', Number.isFinite(m.ts) && h('time.faint', fmt.time(m.ts)), h('span', m.text || ''))))
        : h('p.small.faint', t('community.card.noMessages')));
  }).catch(err => {
    // 404: the chat API (or this user) is unknown; the basic info above is all we have.
    extra.replaceChildren(err.status === 404 ? '' : h('p.small.faint', t('community.card.unavailable')));
  }).finally(() => extra.removeAttribute('aria-busy'));
}
