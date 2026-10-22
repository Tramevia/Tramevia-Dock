// Poll card (overlay id=poll) and goal bars (overlay id=goal). Both are built once and updated in place: the bars move by
// transform (scaleX / translateX), numbers change as text, every effect is a one-shot animation restarted by toggling a
// class. Nothing runs at rest. Styles: overlay.css, "Poll" and "Goal" sections.
import { h, icon, svg, platformIcon, fmt } from '/assets/core.js';

/** Restart a one-shot CSS animation (class removed, reflow, class added). */
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const RING_COLORS = ['#4d7cff', '#8f4dff', '#ff3d9e', '#ff7a2b', '#12c7a2']; // ring look: one colour per answer

// Goal icons: line icons in the Feather / Lucide style (MIT / ISC), 24 × 24. Names: GOAL_ICONS in overlay-settings.js.
const GOAL_ICON_PATHS = {
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  crown: '<path d="m2 6 4.5 11h11L22 6l-6 5-4-7-4 7z"/><path d="M6 21h12"/>',
  award: '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  gem: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6M2 9h20"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M19 3v4M17 5h4"/>',
  gamepad: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><path d="M6 1v3M10 1v3M14 1v3"/>',
  gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
};
/** A goal icon (unknown name → star). */
export const goalIcon = name => svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GOAL_ICON_PATHS[name] || GOAL_ICON_PATHS.star}</svg>`);
/** '#rrggbb' → true when dark text reads better on it (relative luminance). */
const isLight = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4; };

/**
 * pollCard({ t, look }) → { el, set(poll, platforms), leave() }. poll = the server's poll object (or a local test copy);
 * platforms = the platforms viewers can vote from (icons in the footer). look: 'bars' (one bar per answer) or 'ring' (the
 * answers are arcs of one ring, the time runs round it and shows in its centre, where the winner shows at the end).
 */
export function pollCard({ t, look = 'bars' }) {
  const ring = look === 'ring';
  const tag = h('span.pl-tag', h('span.pl-tag-icon', icon('chart', 16)), h('span.pl-tag-text'));
  const time = h('span.pl-time');
  const question = h('div.pl-q');
  const opts = h('div.pl-opts');
  const how = h('span.pl-how');
  const pfs = h('span.pl-pfs');
  const total = h('span.pl-total');
  const timerFill = h(ring ? 'div.pl-dial-timer' : 'div.pl-timer-fill');
  const dot = h('div.pl-dial-dot', h('i'));
  const arcs = h('div.pl-arcs'), winKey = h('span.pl-key'), winPct = h('span.pl-win-pct');
  const dial = ring && h('div.pl-dial', h('div.pl-dial-track'), arcs, h('div.pl-dial-gloss'), h('div.pl-dial-glint'), timerFill, dot,
    h('div.pl-dial-wave'), h('div.pl-dial-center', time, h('div.pl-dial-win', winKey, winPct)));
  const card = h('div.pl-card', h('div.pl-head', tag, ring ? null : time), question, ring ? h('div.pl-body', dial, opts) : opts,
    h('div.pl-foot', h('span.pl-vote', how, pfs), total), ring ? null : h('div.pl-timer', timerFill));
  const el = h(ring ? 'div.pl.ring' : 'div.pl', card);
  let id = null, closed = null, tick = 0, rows = [];

  function countdown(poll) {
    clearInterval(tick);
    const left = () => poll.endsAt - Date.now(); // ponytail: the server's clock; a hosted server is NTP-synced like the PC
    time.textContent = clock(left());
    timerFill.style.animation = dot.style.animation = 'none';
    if (poll.closedAt) return;
    tick = setInterval(() => { time.textContent = clock(left()); if (left() <= 0) clearInterval(tick); }, 1000);
    void timerFill.offsetWidth;
    const ms = Math.max(0, left());
    timerFill.style.setProperty('--from', String(Math.max(0, Math.min(1, left() / (poll.endsAt - poll.startedAt)))));
    if (!ring) { timerFill.style.animation = `pl-timer ${ms}ms linear forwards`; return; }
    // the ring is repainted, so it steps 10 times a second; its head turns smoothly (transform)
    timerFill.style.animation = `pl-dial-timer ${ms}ms steps(${Math.max(1, Math.ceil(ms / 100))}) forwards`;
    dot.style.setProperty('--from', timerFill.style.getPropertyValue('--from'));
    dot.style.animation = `pl-dial-dot ${ms}ms linear forwards`;
  }

  function set(poll, platforms = []) {
    const fresh = poll.id !== id;
    if (fresh) { // a new poll: rebuilt, then enters (its bars grow from 0)
      id = poll.id;
      question.textContent = poll.question;
      rows = poll.options.map((o, i) => {
        const fill = h('div.pl-fill'), pct = h('span.pl-pct'), key = h('span.pl-key', String(i + 1));
        const row = h('div.pl-opt', { style: { '--i': i, '--c': RING_COLORS[i % RING_COLORS.length] } }, h('div.pl-bar', fill), key, h('span.pl-label', o.label), pct);
        const arc = ring && h('div.pl-arc', { style: { '--c': RING_COLORS[i % RING_COLORS.length] } }, h('i'));
        return { row, fill, pct, key, arc, votes: 0 };
      });
      opts.replaceChildren(...rows.map(r => r.row));
      if (ring) arcs.replaceChildren(...rows.map(r => r.arc));
      el.style.setProperty('--n', String(rows.length));
      el.classList.remove('out', 'ending');
      replay(el, 'in');
    }
    pfs.replaceChildren(...platforms.map(p => platformIcon(p)));
    const best = Math.max(...poll.options.map(o => o.votes));
    let from = 0; // ring: where this answer's arc starts (share of a turn)
    poll.options.forEach((o, i) => {
      const r = rows[i];
      const share = poll.total ? o.votes / poll.total : 0;
      const lead = poll.total > 0 && o.votes === best, win = Boolean(poll.closedAt) && lead;
      r.fill.style.transform = `scaleX(${share})`;
      r.pct.textContent = `${Math.round(share * 100)} %`;
      r.row.classList.toggle('lead', lead);
      r.row.classList.toggle('win', win);
      if (ring) {
        r.arc.firstChild.style.setProperty('--pl-s', String(from));
        r.arc.firstChild.style.setProperty('--pl-e', String((from += share)));
        r.arc.classList.toggle('lead', lead);
        r.arc.classList.toggle('win', win);
        if (win) { winKey.textContent = String(i + 1); winPct.textContent = r.pct.textContent; }
      }
      if (!fresh && o.votes > r.votes) { replay(r.key, 'hit'); if (ring) replay(r.arc, 'hit'); }
      r.votes = o.votes;
    });
    el.classList.toggle('won', Boolean(poll.closedAt) && poll.total > 0);
    total.textContent = t('overlay.poll.votes', { n: poll.total, v: fmt.number(poll.total) });
    if (fresh || closed !== Boolean(poll.closedAt)) {
      closed = Boolean(poll.closedAt);
      el.classList.toggle('closed', closed);
      tag.lastChild.textContent = t(closed ? 'overlay.poll.result' : 'overlay.poll.tag');
      how.textContent = t(closed ? 'overlay.poll.ended' : 'overlay.poll.how');
      if (closed && !fresh) replay(el, 'ending');
      countdown(poll);
    }
  }

  function leave() {
    clearInterval(tick);
    id = null;
    el.classList.remove('in', 'ending');
    el.classList.add('out');
  }

  return { el, set, leave };
}

/**
 * goalBars({ t, look }) → { el, set(goals, kinds, gain?) }. goals = { follows, subs: { label, target, count } };
 * kinds = the goals shown ('subs', 'follows' or both); gain = { subs: 5 } is added on top (goal:test).
 * look: 'bars' (one bar per goal, stacked) or 'ring' (one ring gauge per goal round its medal, side by side).
 * color: 'tramevia' (the stream gradients) or '#rrggbb' (one colour, sober). icons: { subs, follows } = names of goal icons.
 * A rise plays: the bar fills, a +n chip pops by the count, the count rolls; reaching the goal adds a burst.
 */
export function goalBars({ t, look = 'bars', color = 'tramevia', icons = {} }) {
  const ring = look === 'ring';
  const el = h(ring ? 'div.gl.ring' : 'div.gl');
  if (/^#[0-9a-f]{6}$/i.test(color)) { // one colour: the gauges, the medal and the done title take it
    el.classList.add('tinted');
    el.style.setProperty('--gc', color);
    el.style.setProperty('--gc-ink', isLight(color) ? '#14151c' : '#fff');
  }
  const rows = new Map(); // kind → { row, fill, edge, chip, num, target, name, count, done, raf }

  function build(kind) {
    const fill = h(ring ? 'div.gl-arc' : 'div.gl-fill'), chip = h('span.gl-chip');
    const edge = h(ring ? 'div.gl-head' : 'div.gl-edge', ring ? h('i.gl-dot') : null, h('i.gl-burst'));
    const num = h('span.gl-num'), target = h('span.gl-target'), name = h('span.gl-name');
    const medal = h('span.gl-medal', goalIcon(icons[kind] || (kind === 'subs' ? 'star' : 'heart')));
    const label = h('span.gl-label', name, h('span.gl-done', t('overlay.goal.done'))), count = h('span.gl-count', chip, num, target);
    const row = ring
      ? h(`div.gl-row.gl-${kind}`, h('div.gl-dial', h('div.gl-ring'), h('div.gl-glow'), fill, h('div.gl-gloss'), h('div.gl-glint'), edge, medal),
        h('div.gl-body', label, count))
      : h(`div.gl-row.gl-${kind}`, medal, h('div.gl-body', h('div.gl-top', label, count), h('div.gl-track', h('div.gl-rail', fill), edge)));
    if (ring) fill.append(h('i'));
    return { row, fill, edge, chip, num, target, name, count: null, done: false, raf: 0 };
  }

  /** The count rolls from `from` to `to` in 0.8 s, then stops. */
  function roll(r, from, to) {
    cancelAnimationFrame(r.raf);
    const start = performance.now();
    const step = now => {
      const k = Math.min(1, Math.max(0, (now - start) / 800)); // a frame's time can be a little before `start`
      r.num.textContent = fmt.number(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) r.raf = requestAnimationFrame(step);
    };
    r.raf = requestAnimationFrame(step);
  }

  function set(goals, kinds, gain = null) {
    if (kinds.join() !== [...rows.keys()].join()) { // first time, or the overlay now shows other goals: rebuilt, then enters
      for (const r of rows.values()) cancelAnimationFrame(r.raf);
      rows.clear();
      for (const k of kinds) rows.set(k, build(k));
      el.replaceChildren(...[...rows.values()].map(r => r.row));
      el.style.setProperty('--rows', String(kinds.length));
      replay(el, 'in'); // (the reflow also lets the bars grow from 0)
    }
    for (const [kind, r] of rows) {
      const g = goals?.[kind];
      if (!g) continue;
      const count = g.count + (gain?.[kind] || 0);
      const share = Math.min(1, count / g.target);
      const done = count >= g.target;
      r.name.textContent = g.label || t(`overlay.goal.${kind}`); // .done rolls it to the done text once the bar arrives (CSS)
      r.target.textContent = ` / ${fmt.number(g.target)}`;
      if (ring) {
        r.fill.firstChild.style.setProperty('--gl-p', String(share));
        r.edge.style.transform = `rotate(${share * 360}deg)`;
      } else {
        r.fill.style.transform = `scaleX(${share})`;
        r.edge.style.transform = `translateX(${share * 100}cqw)`;
      }
      r.row.classList.toggle('done', done);
      r.row.classList.toggle('empty', share === 0);
      if (r.count === null) roll(r, 0, count);
      else if (count > r.count) {
        roll(r, r.count, count);
        r.chip.textContent = `+${fmt.number(count - r.count)}`;
        replay(r.row, 'gain');
        if (done && !r.done) replay(r.row, 'reach');
      } else { cancelAnimationFrame(r.raf); r.num.textContent = fmt.number(count); }
      r.count = count;
      r.done = done;
    }
  }

  return { el, set };
}
