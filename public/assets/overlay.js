// Chat overlay for OBS browser sources (/overlay/chat): read-only, transparent. Two kinds of URL:
//  - saved:  ?key=&id=chat|featured|alerts|viewers|poll|goal → settings stored on the server (dashboard builder), re-applied live on
//            every change without reloading; any setting param also in the URL overrides that one setting.
//            id=alerts shows live events one at a time (follows, subs, tips, raids…), never the backlog.
//            id=viewers shows the live viewer total of the shown channels, with every change animated (+x / −x).
//            id=poll shows the running poll and its votes, then the result for 15 s; id=goal the follow / sub goals (overlay-widgets.js).
//            id=giveaway shows the open giveaway and its draw; id=credits rolls the stream's credits (overlay-extras.js).
//            The dashboard can replay an alert, skip the one on screen and pause the queue (topic alert:control).
//  - legacy: ?key= without id → configured only by its params, as in 1.2, ignores live updates:
//            &theme=dark|light|transparent&max=12&fade=0&platforms=&accounts=&hideBots=1&hideCommands=1&badges=0&icons=0
//            &avatars=1&size=18&align=left|right&events=1&bubble=1&outline=1&mode=featured&featureSeconds=0&credit=1
// platforms=/accounts= are inclusion lists; saved settings exclude with offPlatforms/offAccounts. Parsing: overlay-settings.js.
import { boot, h, svg, fmt, query, addI18n, t, api } from '/assets/core.js';
import { renderMessage, renderEvent, money } from '/assets/chat-render.js';
import { overlayFromQuery, alertCategory, SUPPORTER_STYLES } from '/assets/overlay-settings.js';

addI18n({
  fr: {
    'overlay.title': 'Overlay du chat', 'overlay.alerts': 'Overlay des alertes', 'overlay.viewers': 'Overlay des spectateurs',
    'overlay.poll': 'Overlay du sondage', 'overlay.goal': 'Overlay des objectifs',
    'overlay.poll.tag': 'Sondage', 'overlay.poll.result': 'Résultat', 'overlay.poll.how': 'Votez dans le chat : tapez le numéro',
    'overlay.poll.ended': 'Sondage terminé', 'overlay.poll.votes': '{v} vote', 'overlay.poll.votes|plural': '{v} votes',
    'overlay.goal.subs': 'Objectif abonnés', 'overlay.goal.follows': 'Objectif follows', 'overlay.goal.done': 'Objectif atteint !',
    'overlay.giveaway': 'Overlay du tirage au sort', 'overlay.credits': 'Overlay du générique',
    'overlay.gw.tag': 'Tirage au sort', 'overlay.gw.closed': 'Participations closes', 'overlay.gw.winner': 'Gagnant',
    'overlay.gw.how': 'Tapez !{k} dans le chat', 'overlay.gw.ended': 'Tirage en cours…',
    'overlay.gw.entries': 'participant', 'overlay.gw.entries|plural': 'participants',
    'overlay.cr.kicker': 'Fin du live', 'overlay.cr.thanks': 'Merci d’être passés !', 'overlay.cr.peak': 'pic de {v} spectateurs',
    'overlay.cr.messages': '{v} message', 'overlay.cr.messages|plural': '{v} messages',
    'overlay.cr.subs': 'Abonnements', 'overlay.cr.gifts': 'Abonnements offerts', 'overlay.cr.tips': 'Soutiens', 'overlay.cr.raids': 'Raids',
    'overlay.cr.follows': 'Nouveaux follows', 'overlay.cr.top': 'Les plus actifs du chat', 'overlay.cr.made': 'Générique : Tramevia Dock', 'overlay.cr.next': 'À la prochaine !',
    'overlay.cr.raiders': '{v} spectateur', 'overlay.cr.raiders|plural': '{v} spectateurs',
    'overlay.cr.bits': '{v} bit', 'overlay.cr.bits|plural': '{v} bits', 'overlay.cr.kicks': '{v} KICK', 'overlay.cr.kicks|plural': '{v} KICKs',
    'overlay.cr.diamonds': '{v} diamant', 'overlay.cr.diamonds|plural': '{v} diamants', 'overlay.cr.jewels': '{v} joyau', 'overlay.cr.jewels|plural': '{v} joyaux',
  },
  en: {
    'overlay.title': 'Chat overlay', 'overlay.alerts': 'Alerts overlay', 'overlay.viewers': 'Viewers overlay',
    'overlay.poll': 'Poll overlay', 'overlay.goal': 'Goal overlay',
    'overlay.poll.tag': 'Poll', 'overlay.poll.result': 'Result', 'overlay.poll.how': 'Vote in chat: type the number',
    'overlay.poll.ended': 'Poll closed', 'overlay.poll.votes': '{v} vote', 'overlay.poll.votes|plural': '{v} votes',
    'overlay.goal.subs': 'Sub goal', 'overlay.goal.follows': 'Follower goal', 'overlay.goal.done': 'Goal reached!',
    'overlay.giveaway': 'Giveaway overlay', 'overlay.credits': 'Credits overlay',
    'overlay.gw.tag': 'Giveaway', 'overlay.gw.closed': 'Entries closed', 'overlay.gw.winner': 'Winner',
    'overlay.gw.how': 'Type !{k} in chat', 'overlay.gw.ended': 'Drawing…',
    'overlay.gw.entries': 'entry', 'overlay.gw.entries|plural': 'entries',
    'overlay.cr.kicker': 'End of stream', 'overlay.cr.thanks': 'Thanks for watching!', 'overlay.cr.peak': 'peak of {v} viewers',
    'overlay.cr.messages': '{v} message', 'overlay.cr.messages|plural': '{v} messages',
    'overlay.cr.subs': 'Subscribers', 'overlay.cr.gifts': 'Gifted subs', 'overlay.cr.tips': 'Supporters', 'overlay.cr.raids': 'Raids',
    'overlay.cr.follows': 'New followers', 'overlay.cr.top': 'Most active in chat', 'overlay.cr.made': 'Credits by Tramevia Dock', 'overlay.cr.next': 'See you next time!',
    'overlay.cr.raiders': '{v} viewer', 'overlay.cr.raiders|plural': '{v} viewers',
    'overlay.cr.bits': '{v} bit', 'overlay.cr.bits|plural': '{v} bits', 'overlay.cr.kicks': '{v} KICK', 'overlay.cr.kicks|plural': '{v} KICKs',
    'overlay.cr.diamonds': '{v} diamond', 'overlay.cr.diamonds|plural': '{v} diamonds', 'overlay.cr.jewels': '{v} Jewel', 'overlay.cr.jewels|plural': '{v} Jewels',
  },
});

const BOTS = new Set(['nightbot', 'streamelements', 'moobot', 'streamlabs', 'fossabot', 'wizebot', 'sery_bot', 'botrixoficial', 'kickbot', 'soundalerts']);
const KEEP = 200; // live chat/event frames kept for a rebuild (max is 100, the rest absorbs filtering); the hello backlog is kept whole

const root = document.documentElement;
const list = h('div.ov-list', { attrs: { 'aria-live': 'off' } });
const credit = h('div.ov-credit', 'Chat via Tramevia Dock'); // opt-in, off by default
let app = null;
let saved = null; // { chat, featured } from the server (saved URLs only)
let unlocked = false; // supporter code on the server: a ?style= naming a supporter style is honoured
let C = overlayFromQuery(query, null); // { id, featured, settings: S, onlyPlatforms, onlyAccounts }
let S = C.settings;
// The id never changes in a page: each overlay loads only its own modules (a chat overlay skips ~120 KB of alert, viewer, poll and goal code).
// The alerts overlay also adds its stylesheet (alerts.css), applied before the first alert can show, and the supporter styles pack
// when this dock has one (/premium/, src/premium.js): decor = the pack's styles, null without it (a supporter style then shows as card).
const stylesheet = href => new Promise(done => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: done, onerror: done })));
const [{ alertCard } = {}, , decor = null] = C.alerts ? await Promise.all([import('/assets/alert-card.js'), stylesheet('/assets/alerts.css'),
  import('/premium/decor.js').then(m => m.default({ h, svg }), () => null), stylesheet('/premium/alerts.css')]) : [];
const look = () => (decor || !SUPPORTER_STYLES.has(S.style) ? S.style : 'card'); // the style the alerts are drawn in
let premium; // pack version given by the server at start: a new, updated or removed pack reloads the alerts page
const { viewerBadge } = C.viewers ? await import('/assets/viewer-badge.js') : {};
const { pollCard, goalBars } = C.poll || C.goal ? await import('/assets/overlay-widgets.js') : {};
const { giveawayCard, creditsRoll } = C.giveaway || C.credits ? await import('/assets/overlay-extras.js') : {};
let opts = {};
let frames = []; // { t, d, at } (at = receive time)
let feature = null; // last 'feature' payload, kept even in chat mode: { m, start }
let featureTimer = 0;
const ALERT_QUEUE = 20; // alerts waiting their turn; beyond that the oldest waiting ones are dropped
let alerts = []; // events waiting (alerts mode)
let alertTimer = 0; // 0 = nothing on screen
let alertsPaused = false; // the dashboard paused the queue: the alert on screen ends, the next ones wait

/** Root attributes, classes and render options from the current settings (idempotent). */
function apply() {
  S = C.settings;
  opts = { light: S.theme === 'light', readable: true, links: false, timestamps: false, channel: false, badges: S.badges, icons: S.icons, avatars: S.avatars };
  root.dataset.overlay = S.theme;
  if (C.id) root.dataset.theme = S.theme === 'light' ? 'light' : 'dark';
  if (S.size) root.style.setProperty('--ov-fs', `${S.size}px`); else root.style.removeProperty('--ov-fs');
  // Alignment, bubbles and outline are chat settings: the alert styles draw their own text (the outline would stroke it).
  const chat = !C.alerts && !C.viewers && !C.poll && !C.goal && !C.giveaway && !C.credits;
  // The giveaway card is a poll card (ov-poll: same frame, tag, foot and themes) with its own body (ov-giveaway).
  for (const [cls, on] of [['ov-right', chat && S.align === 'right'], ['ov-bubble', chat && S.bubble], ['ov-outline', chat && S.outline], ['ov-featured', C.featured], ['ov-alerts', C.alerts], ['ov-viewers', C.viewers], ['ov-poll', C.poll || C.giveaway], ['ov-giveaway', C.giveaway], ['ov-goal', C.goal], ['ov-credits', C.credits]]) root.classList.toggle(cls, on);
  root.dataset.position = C.alerts ? S.position : '';
  root.dataset.style = C.alerts ? look() : '';
  root.dataset.align = C.viewers ? S.align : '';
  if (app && S.credit && (chat || C.alerts)) app.append(credit); else credit.remove();
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
  if (d.deleted || d.flags?.vote || d.flags?.entry) return false; // a poll vote ("1", "2"…) or a giveaway entry counts on its own overlay, not in the chat
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
  const card = alertCard(d, opts, look(), decor);
  list.append(card);
  card.style.setProperty('--evt', getComputedStyle(card.querySelector('.evt')).getPropertyValue('--evt')); // the event colour, for the card's own glow and accent
  card.style.setProperty('--alert-ms', String(S.alertSeconds * 1000)); // how long it stays: a style may show the time left
}

/** Shows the next waiting alert for S.alertSeconds, then the one after. Nothing waiting = screen left empty. */
function nextAlert() {
  clearTimeout(alertTimer);
  alertTimer = 0;
  for (const old of list.children) remove(old);
  current = alertsPaused ? null : alerts.shift() || null;
  if (!current) return;
  showAlert(current);
  chime(S.volume);
  alertTimer = setTimeout(nextAlert, S.alertSeconds * 1000);
}

/** first: a replay asked from the dashboard goes before the alerts already waiting. */
function enqueueAlert(d, first = false) {
  if (!alertWanted(d)) return;
  if (first) alerts.unshift(d); else alerts.push(d);
  if (alerts.length > ALERT_QUEUE) alerts.splice(0, alerts.length - ALERT_QUEUE);
  if (!alertTimer) nextAlert();
}

/** alert:control from the dashboard: replay an alert from the history, skip the one on screen, pause or resume the queue. */
function controlAlerts(d) {
  if (d?.action === 'replay' && d.event) enqueueAlert(d.event, true);
  else if (d?.action === 'skip') nextAlert();
  else if (d?.action === 'pause') alertsPaused = true;
  else if (d?.action === 'resume') { alertsPaused = false; if (!alertTimer) nextAlert(); }
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

// ------------------------------------------------------------------ poll (id=poll) and goals (id=goal)
const POLL_RESULT = 15_000; // a closed poll stays on screen this long
let accounts = []; // the channels (hello): the poll card shows the platforms viewers can vote from
let poll = null, pollTest = null, card = null, pollTimer = 0, testRun = 0;
let goals = null, bars = null, goalTimer = 0;

function votePlatforms() {
  const on = new Set(accounts.filter(a => shown({ accountId: a.id, platform: a.platform })).map(a => a.platform));
  return ['twitch', 'kick', 'youtube', 'tiktok'].filter(p => on.has(p));
}

function showPoll() {
  if (!app) return;
  clearTimeout(pollTimer);
  if (card?.look !== S.look) { card?.leave(); card?.el.remove(); card = { ...pollCard({ t, look: S.look }), look: S.look }; } // a new style: rebuilt
  const p = pollTest || poll;
  const left = p?.closedAt ? p.closedAt + POLL_RESULT - Date.now() : Infinity;
  if (!p || left <= 0) { if (card.el.isConnected) card.leave(); return; }
  if (!card.el.isConnected) app.append(card.el);
  card.set(p, votePlatforms());
  if (left !== Infinity) pollTimer = setTimeout(showPoll, left);
}

/** poll:test: a sample poll played here only (votes trickle in for 12 s, the result shows for 6 s), then the real one again. */
function testPoll({ question, options }) {
  clearInterval(testRun);
  const start = Date.now();
  const p = { id: `test-${start}`, question, options: options.map(label => ({ label, votes: 0 })), total: 0, startedAt: start, endsAt: start + 12_000, closedAt: null };
  pollTest = p;
  showPoll();
  testRun = setInterval(() => {
    if (Date.now() >= p.endsAt) {
      clearInterval(testRun);
      p.closedAt = Date.now();
      showPoll();
      setTimeout(() => { if (pollTest === p) { pollTest = null; showPoll(); } }, 6000);
      return;
    }
    for (let k = Math.floor(Math.random() * 4); k > 0; k--) { p.options[Math.floor(Math.random() ** 1.5 * p.options.length)].votes++; p.total++; }
    showPoll();
  }, 450);
}

// ------------------------------------------------------------------ giveaway (id=giveaway) and credits (id=credits)
let giveaway = null, giveawayTest = null, gwCard = null, gwTestRun = [];
let credits = null, roller = null;

function showGiveaway() {
  if (!app) return;
  gwCard ||= giveawayCard({ t });
  const g = giveawayTest || giveaway;
  if (!g) { if (gwCard.el.isConnected) gwCard.leave(); return; }
  if (!gwCard.el.isConnected) app.append(gwCard.el);
  gwCard.set(g, votePlatforms());
}

/** giveaway:test: sample entries come in for 6 s, a draw, the winner for 8 s, then the real giveaway again. */
function testGiveaway({ keyword, title }) {
  for (const id of gwTestRun) clearTimeout(id);
  const names = [['PixelNova', 'twitch'], ['Kaori', 'tiktok'], ['LeoStream', 'kick'], ['mira.yt', 'youtube'], ['Shadowfox', 'twitch'], ['Nico_92', 'tiktok'], ['Zephyr', 'kick'], ['Brume', 'youtube']]
    .map(([name, platform]) => ({ name, platform }));
  const g = { id: `test-${Date.now()}`, keyword, title, open: true, count: 0, recent: [], winners: [], draw: null };
  giveawayTest = g;
  showGiveaway();
  gwTestRun = names.map((n, i) => setTimeout(() => { g.count++; g.recent = [n, ...g.recent].slice(0, 6); showGiveaway(); }, 400 + i * 650));
  gwTestRun.push(setTimeout(() => {
    g.open = false;
    const reel = Array.from({ length: 18 }, (_, i) => names[(i * 5) % names.length]);
    g.draw = { id: 'test', at: Date.now(), reel: [...reel, names[3]] };
    g.winners = [names[3]];
    showGiveaway();
  }, 6200));
  gwTestRun.push(setTimeout(() => { if (giveawayTest === g) { giveawayTest = null; showGiveaway(); } }, 6200 + 4200 + 8000));
}

/** The credits from the start (data = /api/credits or a credits:roll frame); a settings change rolls them again. */
function rollCredits(data = credits) {
  if (!app) return;
  roller ||= creditsRoll({ t, money });
  if (!roller.el.isConnected) app.append(roller.el);
  const channel = accounts.find(a => shown({ accountId: a.id, platform: a.platform }));
  roller.roll(data, { seconds: S.rollSeconds, loop: S.loop, credit: S.credit, name: channel?.displayName || channel?.login || '',
    motion: S.motion, font: S.font, fx: S.fx, emoji: S.emoji, color: S.color });
}

/** gain = goal:test ({ subs: 5 }): shown on top of the real counts. */
function showGoals(gain = null) {
  if (!app || !goals) return;
  const style = [S.look, S.color, S.subsIcon, S.followsIcon].join();
  if (bars?.style !== style) { // a new look, colour or icon: rebuilt
    bars?.el.remove();
    bars = { ...goalBars({ t, look: S.look, color: S.color, icons: { subs: S.subsIcon, follows: S.followsIcon } }), style };
  }
  if (!bars.el.isConnected) app.append(bars.el);
  bars.set(goals, S.goal === 'both' ? ['subs', 'follows'] : [S.goal], gain);
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
  if (C.poll) showPoll();
  else if (C.goal) showGoals();
  else if (C.giveaway) showGiveaway();
  else if (C.credits) rollCredits();
  else if (C.viewers) showViewers(true); // a filter change is the streamer's edit, not a change of audience: no +x / −x
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
  if (type === 'hello' && typeof d?.alertsPaused === 'boolean') alertsPaused = d.alertsPaused;
  if (C.alerts && (type === 'hello' || type === 'overlay') && d && 'premium' in d && (d.premium ?? null) !== premium) return location.reload();
  if (type === 'hello') {
    reconfigure(d.overlays, false);
    accounts = d.accounts || [];
    if (C.poll) { poll = d.poll ?? null; showPoll(); return; }
    if (C.goal) { goals = d.goals ?? null; showGoals(); return; }
    if (C.giveaway) { giveaway = d.giveaway ?? null; showGiveaway(); return; }
    if (C.credits) return; // the credits roll once from the start, not again on every reconnect
    if (C.viewers) { keepStats(d.accounts); showViewers(); return; }
    if (C.alerts) return; // alerts never replay the backlog: an old follow must not pop up again after a reconnect
    frames = (d.backlog || []).filter(f => f.t === 'chat' || f.t === 'event').map(f => ({ t: f.t, d: f.d, at: f.d.ts }));
    feature = null;
    renderChat();
  } else if (C.giveaway || C.credits) {
    if (type === 'giveaway' && C.giveaway) { giveaway = d; showGiveaway(); }
    else if (type === 'giveaway:test' && C.giveaway && d) testGiveaway(d);
    else if (type === 'credits:roll' && C.credits) { if (!d?.test) credits = d?.credits ?? null; rollCredits(d?.credits ?? null); }
    else if (type === 'overlay' && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
  } else if (C.poll || C.goal) {
    if (type === 'poll' && C.poll) { poll = d; showPoll(); }
    else if (type === 'poll:test' && C.poll && Array.isArray(d?.options)) testPoll(d);
    else if (type === 'goal' && C.goal) { clearTimeout(goalTimer); goals = d; showGoals(); }
    else if (type === 'goal:test' && C.goal) { clearTimeout(goalTimer); showGoals(d); goalTimer = setTimeout(() => showGoals(), 4000); }
    else if (type === 'overlay' && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
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
    else if (type === 'alert:control') controlAlerts(d);
    else if (type === 'overlay' && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
  } else if (type === 'chat' || type === 'event') {
    frames.push({ t: type, d, at: Date.now() });
    if (frames.length > KEEP) frames.splice(0, frames.length - KEEP);
    add(type, d);
  } else if (type === 'chat:delete') {
    for (const f of frames) if (f.t === 'chat' && isMatch(d, keys(f.d))) f.d.deleted = true;
    if (feature?.m && isMatch(d, keys(feature.m))) feature.m.deleted = true;
    for (const el of list.querySelectorAll('.msg')) if (isMatch(d, el.dataset)) remove(el.closest('.feat-card') || el);
  } else if (type === 'chat:clear') {
    frames = [];
    renderChat();
  } else if (type === 'feature') {
    feature = { m: d, start: replayed && d?.featuredAt ? d.featuredAt : Date.now() };
    if (C.featured) showFeatured(feature);
  } else if (type === 'overlay' && C.id && d?.id === C.id) reconfigure({ ...saved, [d.id]: d.settings }, true);
}

boot({
  page: '/overlay/chat', title: t(C.alerts ? 'overlay.alerts' : C.viewers ? 'overlay.viewers' : C.poll ? 'overlay.poll' : C.goal ? 'overlay.goal' : C.giveaway ? 'overlay.giveaway' : C.credits ? 'overlay.credits' : 'overlay.title'), header: false, admin: false, ownTheme: Boolean(C.id),
  onReady(state, el) {
    app = el;
    app.classList.add('ov');
    app.append(list);
    unlocked = Boolean(state.unlocked);
    premium = state.premium?.version ?? null;
    if (C.id) reconfigure(state.overlays || {}, false); else apply();
    accounts = state.accounts || [];
    if (C.poll) { poll = state.poll ?? null; showPoll(); }
    if (C.goal) { goals = state.goals ?? null; showGoals(); }
    alertsPaused = Boolean(state.alertsPaused);
    if (C.giveaway) { giveaway = state.giveaway ?? null; showGiveaway(); }
    if (C.credits) api('/api/credits').then(c => { credits = c; rollCredits(); }, () => rollCredits(null));
    if (C.viewers) { keepStats(state.accounts); showViewers(); }
  },
  onFrame,
});
