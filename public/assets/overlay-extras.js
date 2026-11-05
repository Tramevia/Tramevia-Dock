// Giveaway card (overlay id=giveaway) and credits (overlay id=credits, four motions and a particle layer). Built once and updated in place, like the poll
// card (overlay-widgets.js): effects are one-shot animations restarted by toggling a class, the draw's roulette and the
// credits by transform, opacity and clip-path, with particles on a canvas only while they roll. Nothing runs at rest. Styles: overlay.css, "Giveaway" and "Credits" sections.
import { h, icon, platformIcon, fmt } from '/assets/core.js';

function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

const REEL_MS = 4200; // the roulette spins this long before it lands on the winner
const FRESH_DRAW = 8000; // a draw older than this (page opened later) shows the winner without the roulette

/**
 * giveawayCard({ t }) → { el, set(giveaway, platforms), leave() }. giveaway = the server's public view (or a local test copy):
 * { id, keyword, title, open, count, recent: [{ name, platform }], winners, draw: { id, at, reel } | null }.
 * Open: the keyword to type, the platforms, the count and the last names in. A draw: the names roll in a window and slow
 * down onto the winner, who then lights up in gold.
 */
export function giveawayCard({ t }) {
  const tag = h('span.pl-tag', h('span.pl-tag-icon', icon('gift', 16)), h('span.pl-tag-text'));
  const count = h('strong.gw-count'), countLabel = h('span.gw-count-label');
  const title = h('div.pl-q.gw-title');
  const how = h('span.gw-how'), pfs = h('span.pl-pfs');
  const recent = h('ul.gw-recent');
  const strip = h('ul.gw-strip');
  const reel = h('div.gw-reel', h('div.gw-window', strip), h('i.gw-burst'));
  const winner = h('div.gw-winner');
  const card = h('div.pl-card.gw-card', h('div.pl-head', tag, h('span.gw-tally', count, countLabel)), title,
    h('div.gw-body', recent, reel), h('div.pl-foot', h('span.pl-vote', how, pfs), winner));
  const el = h('div.pl.gw', card);
  let id = null, drawId = null, seen = new Set(), landTimer = 0;

  function land(w) {
    el.classList.add('landed');
    winner.replaceChildren(icon('star', 14), h('b', w.name), platformIcon(w.platform));
    replay(el, 'won');
  }

  function spin(draw, fresh) {
    clearTimeout(landTimer);
    el.classList.remove('landed', 'won');
    const names = draw.reel;
    strip.replaceChildren(...names.map(n => h('li', platformIcon(n.platform), h('span', n.name))));
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    el.classList.add('drawing');
    const end = `translateY(calc(${names.length - 1} * -1 * var(--gw-row)))`;
    if (!fresh) { strip.style.transform = end; land(names.at(-1)); return; }
    void strip.offsetWidth;
    strip.style.transition = `transform ${REEL_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1)`;
    strip.style.transform = end;
    landTimer = setTimeout(() => land(names.at(-1)), REEL_MS);
  }

  function set(g, platforms = []) {
    if (g.id !== id) { // a new giveaway: rebuilt, then enters
      id = g.id;
      drawId = null;
      seen = new Set();
      recent.replaceChildren();
      winner.replaceChildren();
      el.classList.remove('out', 'drawing', 'landed', 'won');
      replay(el, 'in');
    }
    tag.lastChild.textContent = t(g.draw ? 'overlay.gw.winner' : g.open ? 'overlay.gw.tag' : 'overlay.gw.closed');
    title.textContent = g.title || t('overlay.gw.tag');
    title.classList.toggle('gw-untitled', !g.title);
    how.textContent = g.open ? t('overlay.gw.how', { k: g.keyword }) : t('overlay.gw.ended');
    pfs.replaceChildren(...(g.open ? platforms.map(p => platformIcon(p)) : []));
    const before = count.textContent;
    count.textContent = fmt.number(g.count);
    countLabel.textContent = t('overlay.gw.entries', { n: g.count });
    if (before && before !== count.textContent) replay(count, 'hit');
    // The last names in, newest on top; a name already shown keeps its place.
    const fresh = g.recent.filter(r => !seen.has(`${r.platform}:${r.name}`));
    for (const r of fresh.reverse()) {
      seen.add(`${r.platform}:${r.name}`);
      recent.prepend(h('li.gw-in', platformIcon(r.platform), h('span', r.name)));
    }
    while (recent.children.length > 5) recent.lastChild.remove();
    el.classList.toggle('closed', !g.open);
    if (g.draw && g.draw.id !== drawId) {
      drawId = g.draw.id;
      spin(g.draw, Date.now() - g.draw.at < FRESH_DRAW);
    }
  }

  function leave() {
    clearTimeout(landTimer);
    id = null;
    el.classList.remove('in', 'won');
    el.classList.add('out');
  }

  return { el, set, leave };
}

// ------------------------------------------------------------------ credits

const CR_EMOJI = { head: '🎬', subs: '⭐', gifts: '🎁', tips: '💎', raids: '🚀', follows: '💜', top: '💬', end: '🎉' };
const CONFETTI_EMOJI = ['🎉', '💜', '⭐', '✨', '🎁'];
const TRAMEVIA = ['#74a4ff', '#9c66ff', '#ff4bb4', '#ff8236'];
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (hex, to, k) => { const b = rgbOf(to); return '#' + rgbOf(hex).map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
/** The four colours of the title gradient and the particles: the Tramevia gradient, or shades of the chosen colour. */
const palette = color => (/^#[0-9a-f]{6}$/i.test(color) ? [mix(color, '#ffffff', 0.5), color, mix(color, '#000000', 0.2), mix(color, '#ffffff', 0.8)] : TRAMEVIA);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/**
 * Particles on a canvas behind the credits: confetti falling (and bursting when a scene starts), sparkles twinkling, or bokeh
 * lights drifting up. Runs only while the credits roll: stop() clears the canvas and ends the frame loop.
 */
function particles(canvas) {
  const g = canvas.getContext('2d');
  let raf = 0, parts = [], kind = 'none', colors = TRAMEVIA, emoji = false, w = 0, ht = 0, s = 1, last = 0;
  const target = () => ({ confetti: 70, sparkles: 55, bokeh: 22 }[kind] || 0);

  function make(x, y, burst) {
    const c = pick([...colors, '#ffffff']);
    if (kind === 'confetti') {
      const em = emoji && Math.random() < 0.12;
      const a = rnd(0, Math.PI * 2), v = burst ? rnd(5, 15) : 0;
      return { x: x ?? rnd(0, w), y: y ?? rnd(-80, -10), vx: burst ? Math.cos(a) * v : rnd(-0.6, 0.6), vy: burst ? Math.sin(a) * v - 4 : rnd(1.6, 3.4),
        r: rnd(0, 6.3), vr: rnd(-0.12, 0.12), size: (em ? rnd(26, 40) : rnd(9, 16)) * s, c, em: em ? pick(CONFETTI_EMOJI) : null, round: Math.random() < 0.3, sway: rnd(0, 6.3), burst };
    }
    if (kind === 'sparkles') {
      const near = x != null;
      return { x: near ? x + rnd(-260, 260) * s : rnd(0, w), y: near ? y + rnd(-140, 140) * s : rnd(0, ht), age: 0, life: rnd(900, 2200), size: rnd(6, near ? 20 : 15) * s, c };
    }
    return { x: rnd(0, w), y: y ?? rnd(0, ht), vy: rnd(-0.25, -0.7), size: rnd(24, 90) * s, a: rnd(0.08, 0.24), sway: rnd(0, 6.3), c };
  }

  function star(x, y, r, c, alpha) {
    g.globalAlpha = alpha;
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.28 : r, a = (i * Math.PI) / 4;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  }

  function frame(now) {
    const dt = Math.min(50, now - (last || now)), f = dt / 16.67;
    last = now;
    g.clearRect(0, 0, w, ht);
    while (parts.filter(p => !p.burst).length < target()) parts.push(make(null, kind === 'bokeh' ? ht + 100 : null));
    g.globalCompositeOperation = kind === 'bokeh' ? 'lighter' : 'source-over';
    parts = parts.filter(p => {
      if (kind === 'confetti') {
        if (p.burst) { p.vx *= 0.97 ** f; p.vy = p.vy * 0.97 ** f + 0.28 * f; } else p.x += Math.sin((p.sway += 0.03 * f)) * 0.8 * f;
        p.x += p.vx * f; p.y += p.vy * f; p.r += p.vr * f;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = 1;
        if (p.em) { g.font = `${p.size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.em, 0, 0); }
        else { g.fillStyle = p.c; g.scale(1, Math.cos(p.r * 2)); if (p.round) { g.beginPath(); g.arc(0, 0, p.size / 2.4, 0, 6.3); g.fill(); } else g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
        g.restore();
        return p.y < ht + 60 && p.x > -60 && p.x < w + 60;
      }
      if (kind === 'sparkles') {
        p.age += dt;
        const k = p.age / p.life;
        star(p.x, p.y, p.size * Math.sin(Math.PI * Math.min(1, k)), p.c, Math.sin(Math.PI * Math.min(1, k)));
        return k < 1;
      }
      p.y += p.vy * f; p.x += Math.sin((p.sway += 0.01 * f)) * 0.4 * f;
      const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      grad.addColorStop(0, p.c); grad.addColorStop(1, 'transparent');
      g.globalAlpha = p.a; g.fillStyle = grad;
      g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.3); g.fill();
      return p.y > -p.size;
    });
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  return {
    start(next, list, withEmoji) {
      cancelAnimationFrame(raf);
      kind = next; colors = list; emoji = withEmoji; parts = []; last = 0;
      const r = Math.min(2, devicePixelRatio || 1);
      w = canvas.clientWidth; ht = canvas.clientHeight; s = Math.max(0.4, ht / 1080);
      canvas.width = w * r; canvas.height = ht * r;
      g.setTransform(r, 0, 0, r, 0, 0);
      g.clearRect(0, 0, w, ht);
      if (kind === 'none' || !w) return;
      if (kind === 'sparkles') for (let i = 0; i < target(); i++) parts.push({ ...make(), age: rnd(0, 1500) });
      if (kind === 'bokeh') for (let i = 0; i < target(); i++) parts.push(make());
      raf = requestAnimationFrame(frame);
    },
    /** A burst where a scene starts (confetti and sparkles only). */
    burst(x, y) {
      if (kind === 'confetti') for (let i = 0; i < 60; i++) parts.push(make(x, y, true));
      if (kind === 'sparkles') for (let i = 0; i < 18; i++) parts.push(make(x, y));
    },
    stop() { cancelAnimationFrame(raf); raf = 0; parts = []; g.clearRect(0, 0, w, ht); },
  };
}

/**
 * creditsRoll({ t, money }) → { el, roll(credits, options), stop() }. credits = /api/credits: { startedAt, endedAt, peak, messages,
 * follows, subs, gifts, tips, raids, top } (null = only the thank-you). options = { seconds, loop, credit, name, motion, font, fx, emoji, color }:
 *  - motion roll: one column scrolls up from below the source to past its top in `seconds`.
 *  - motion scenes: one section at a time; its emoji pops, the title slides in, the names bounce in one by one, then fly off.
 *  - motion warp: section titles zoom in at the centre, the names fly out of it towards the edges, growing.
 *  - motion arcade: high-score pages, rows typed in letter by letter with ranks, scanlines.
 * scenes / warp / arcade share `seconds` between their pages (at least 2.6 s each). `loop` starts again at the end, else the source
 * empties and nothing runs any more. Styles: overlay.css, "Credits".
 */
export function creditsRoll({ t, money }) {
  const canvas = h('canvas.cr-fx');
  const stage = h('div.cr-stage');
  const el = h('div.cr', canvas, stage);
  const fx = particles(canvas);
  let timers = [], anims = [], run = 0;

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const play = (node, frames, opts) => { const a = node.animate(frames, { fill: 'both', ...opts }); anims.push(a); return a; };
  function reset() {
    for (const id of timers) clearTimeout(id);
    for (const a of anims) a.cancel();
    timers = []; anims = [];
    fx.stop();
    stage.replaceChildren();
  }

  const tip = c => (c.type === 'cheer' ? t('overlay.cr.bits', { n: c.amount, v: fmt.number(c.amount) })
    : c.type === 'kicks' ? t('overlay.cr.kicks', { n: c.amount, v: fmt.number(c.amount) })
      : c.type === 'gift' ? t(c.unit === 'jewels' ? 'overlay.cr.jewels' : 'overlay.cr.diamonds', { n: c.amount, v: fmt.number(c.amount) })
        : money(c.amount, c.currency));

  /** The credits as sections of { name, platform, detail }, in the order they roll. */
  function sections(c) {
    if (!c) return [];
    return [
      ['subs', c.subs], ['gifts', c.gifts, g => `×${fmt.number(g.n)}`], ['tips', c.tips, tip],
      ['raids', c.raids, r => (r.n ? t('overlay.cr.raiders', { n: r.n, v: fmt.number(r.n) }) : '')], ['follows', c.follows],
      ['top', c.top, x => t('overlay.cr.messages', { n: x.n, v: fmt.number(x.n) })],
    ].filter(([, list]) => list?.length > 0)
      .map(([key, list, detail]) => ({ key, title: t(`overlay.cr.${key}`), items: list.map(x => ({ name: x.name, platform: x.platform, detail: detail?.(x) || '' })) }));
  }
  const statsOf = c => c && [c.endedAt || c.startedAt ? fmt.duration((c.endedAt || Date.now()) - c.startedAt) : null,
    c.peak ? t('overlay.cr.peak', { v: fmt.number(c.peak) }) : null, c.messages ? t('overlay.cr.messages', { n: c.messages, v: fmt.number(c.messages) }) : null].filter(Boolean).join(' · ');
  const emo = (o, key) => (o.emoji ? h('span.cr-emo', { attrs: { 'aria-hidden': 'true' } }, CR_EMOJI[key]) : null);
  const nameEl = (tag, x) => h(tag, platformIcon(x.platform), h('span', x.name), x.detail ? h('em', x.detail) : null);
  const head = (c, o) => [h('span.cr-kicker', o.name || t('overlay.cr.kicker')), emo(o, 'head'), h('h2', t('overlay.cr.thanks')), statsOf(c) ? h('p.cr-stats', statsOf(c)) : null];
  const outro = o => [emo(o, 'end'), h('h2', t('overlay.cr.next')), o.credit ? h('p.cr-foot', t('overlay.cr.made')) : null];
  const centre = node => { const r = node.getBoundingClientRect(), b = el.getBoundingClientRect(); return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2]; };

  // ---- roll: one column
  function rollColumn(c, o, done) {
    const col = h('div.cr-col', h('header.cr-head', head(c, o)),
      sections(c).map(sec => h('section.cr-sec', h('h3', emo(o, sec.key), sec.title), h('ul', sec.items.map(x => nameEl('li.cr-name', x))))),
      h('footer.cr-end', outro(o)));
    stage.append(col);
    const from = el.clientHeight, to = -col.offsetHeight;
    play(col, [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], { duration: o.seconds * 1000, easing: 'linear' }).onfinish = done;
  }

  // ---- scenes and arcade: pages
  function pages(c, o, done) {
    const arcade = o.motion === 'arcade', per = arcade ? 8 : 12;
    const list = [{ kind: 'head' }, ...sections(c).flatMap(sec => chunk(sec.items, per).map((items, i) => ({ kind: 'sec', sec, items, from: i * per }))), { kind: 'end' }];
    const slot = Math.max(2600, (o.seconds * 1000) / list.length), OUT = 520;
    list.forEach((p, i) => later(i * slot, () => showPage(p, o, c, slot - OUT, OUT)));
    later(list.length * slot, done);
  }

  function showPage(p, o, c, hold, out) {
    const arcade = o.motion === 'arcade';
    const page = h('div.cr-page');
    if (p.kind === 'head') page.append(...head(c, o).filter(Boolean));
    else if (p.kind === 'end') page.append(...outro(o).filter(Boolean));
    else {
      page.append(emo(o, p.sec.key) || '', h('h3', p.sec.title));
      page.append(arcade
        ? h('ol.cr-board', p.items.map((x, i) => h('li.cr-row', h('b.cr-rank', String(p.from + i + 1).padStart(2, '0')), platformIcon(x.platform), h('span', x.name), x.detail ? h('em', x.detail) : null)))
        : h(p.items.length > 6 ? 'ul.cr-grid.wide' : 'ul.cr-grid', p.items.map(x => nameEl('li.cr-name', x))));
    }
    stage.replaceChildren(page);
    const big = page.querySelector('.cr-emo'), title = page.querySelector('h2, h3'), rows = [...page.querySelectorAll('li, .cr-stats, .cr-foot, .cr-kicker')];
    if (arcade) {
      if (title) play(title, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 600, easing: `steps(${Math.max(4, title.textContent.length)})` });
      if (big) play(big, [{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 400, easing: 'steps(4)' });
      rows.forEach((r, i) => play(r, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, delay: 450 + i * 170, easing: `steps(${Math.max(6, r.textContent.length)})` }));
      later(hold, () => [title, big, ...rows].forEach(n => n && play(n, [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: out - 40, easing: 'steps(4)' })));
    } else {
      if (big) play(big, [{ transform: 'scale(0) rotate(-35deg)' }, { transform: 'scale(1.3) rotate(8deg)', offset: 0.6 }, { transform: 'scale(1) rotate(0)' }], { duration: 750, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' });
      if (title) play(title, [{ opacity: 0, transform: 'translateY(0.5em)', letterSpacing: '0.5em', filter: 'blur(8px)' }, { opacity: 1, transform: 'none', letterSpacing: getComputedStyle(title).letterSpacing, filter: 'blur(0)' }], { duration: 700, delay: 120, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      rows.forEach((r, i) => play(r, [{ opacity: 0, transform: `translateY(1.3em) scale(0.5) rotate(${rnd(-10, 10)}deg)`, filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 700, delay: 320 + i * 75, easing: 'cubic-bezier(0.2, 1.5, 0.35, 1)' }));
      later(hold, () => {
        [...rows].reverse().forEach((r, i) => play(r, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-0.8em) scale(0.9)', filter: 'blur(4px)' }], { duration: 380, delay: i * 18, easing: 'ease-in' }));
        for (const n of [title, big]) if (n) play(n, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.15)', filter: 'blur(6px)' }], { duration: out - 60, easing: 'ease-in' });
      });
    }
    const [x, y] = centre(big || title || page);
    later(arcade ? 300 : 380, () => fx.burst(x, y));
  }

  // ---- warp: names fly out of the centre
  function warp(c, o, done) {
    const secs = sections(c), names = secs.reduce((n, s) => n + s.items.length, 0);
    const step = Math.min(900, Math.max(220, (o.seconds * 1000 - (secs.length + 2) * 1700) / Math.max(1, names)));
    let at = 0;
    const title = nodes => { const n = h('div.cr-warp-title', nodes); later(at, () => {
      stage.append(n);
      play(n, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.2)', filter: 'blur(10px)' }, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', filter: 'blur(0)', offset: 0.22 },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1.08)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%, -50%) scale(2.6)', filter: 'blur(8px)' }], { duration: 2000, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' }).onfinish = () => n.remove();
      const [x, y] = centre(n);
      later(350, () => fx.burst(x, y));
    }); at += 1700; };
    title(head(c, o));
    for (const sec of secs) {
      title([emo(o, sec.key), h('h3', sec.title)]);
      for (const x of sec.items) {
        const n = nameEl('div.cr-warp-name', x), a = rnd(0, Math.PI * 2), d = Math.hypot(el.clientWidth, el.clientHeight) * 0.42;
        const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.75;
        later(at, () => {
          stage.prepend(n);
          play(n, [{ opacity: 0, transform: 'translate(-50%, -50%) scale(0.15)' }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.78 },
            { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.7)` }], { duration: 4200, easing: 'cubic-bezier(0.45, 0, 0.85, 0.55)' }).onfinish = () => n.remove();
        });
        at += step;
      }
      at += 600;
    }
    title(outro(o));
    later(at + 1200, done);
  }

  function roll(c, { seconds = 45, loop = false, credit = false, name = '', motion = 'roll', font = 'auto', fx: effect = 'none', emoji = false, color = 'tramevia' } = {}) {
    reset();
    const o = { seconds, loop, credit, name, motion, emoji };
    const id = ++run;
    const [g1, g2, g3, g4] = palette(color);
    Object.assign(el.dataset, { motion, font });
    for (const [k, v] of Object.entries({ '--cr-g1': g1, '--cr-g2': g2, '--cr-g3': g3, '--cr-g4': g4, '--cr-head': color === 'tramevia' ? '' : mix(color, '#ffffff', 0.55), '--cr-head-ink': color === 'tramevia' ? '' : mix(color, '#000000', 0.35) })) {
      if (v) el.style.setProperty(k, v); else el.style.removeProperty(k);
    }
    el.hidden = false;
    fx.start(effect, palette(color), emoji);
    const done = () => { if (id !== run) return; if (loop) roll(c, { seconds, loop, credit, name, motion, font, fx: effect, emoji, color }); else { reset(); el.hidden = true; } };
    (motion === 'roll' ? rollColumn : motion === 'warp' ? warp : pages)(c, o, done);
  }

  return { el, roll, stop() { run++; reset(); el.hidden = true; } };
}
