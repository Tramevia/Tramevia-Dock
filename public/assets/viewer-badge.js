// Viewer badge (overlay id=viewers): the total live viewer count in a sphere of glowing particles.
// The sphere is ~2 900 dots drawn by 5 SVG paths (one zero-length round-capped subpath per dot) coloured by one gradient.
// At rest a few layers sway / drift (transform + opacity only). A change replays the paths' `d` through keyframes computed
// here once per change: every dot follows its own trajectory and each subpath runs from where the dot was one shutter ago
// to where it is now, so fast dots draw their own motion-blur streak. No per-frame JS, no randomness (hash of the index).
const R = 50; // orb radius, SVG units
const V = 130; // half of the layers' view box (they overflow the orb: frayed rim, lobes, entry spiral)
const Q = 10; // path coordinates are integer tenths of a unit (short path text, fast to build and parse)
const TAU = Math.PI * 2;
const SHUTTER = 33; // ms: each dot's streak is where it went in the last 33 ms (the keyframe step in the fast part)
const hash = (i, s = 0) => { const x = Math.sin(i * 12.9898 + s * 78.233 + 0.5) * 43758.5453; return x - Math.floor(x); };
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = c01(x); return x * x * (3 - 2 * x); };
const bump = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x)); // 0 → 1 → 0 over [0, 1]
const wave = a => 1 + 0.012 * Math.sin(2 * a + 1.7) + 0.026 * Math.sin(3 * a + 0.6) + 0.022 * Math.sin(5 * a + 2.1) + 0.02 * Math.sin(9 * a + 0.3) + 0.016 * Math.sin(13 * a + 1.3) + 0.01 * Math.sin(21 * a + 0.2) + 0.006 * Math.sin(34 * a + 2.4);

// ---- the particle cloud (built once, shared by every badge): a dot sphere seen from a tilt, sorted by how close to the limb
// each dot is (face, mid, rim), plus ridges, fray, white specks and strays around the rim.
let CLOUD = null;
function cloud() {
  if (CLOUD) return CLOUD;
  const L = { face: [], mid: [], rim: [], fray: [], spark: [], stray: [] };
  const ga = Math.PI * (3 - Math.sqrt(5));
  const [ct, st, cz, sz] = [Math.cos(0.75), Math.sin(0.75), Math.cos(0.5), Math.sin(0.5)];
  const NL = 32;
  let i = 0;
  for (let j = 0; j < NL; j++) { // the shell: a latitude / longitude grid of dots (curved rows, like the reference's lattice),
    const phi = -Math.PI / 2 + (Math.PI * (j + 0.5)) / NL, n = Math.max(3, Math.round(2 * NL * Math.cos(phi))); // tilted,
    for (let m = 0; m < n; m++, i++) { // crumpled by a smooth 3D noise (the folds), seen from the front: both halves show
      const th = (TAU * (m + 0.5 * (j % 2))) / n;
      let x = Math.cos(phi) * Math.cos(th), y = Math.sin(phi), z = Math.cos(phi) * Math.sin(th);
      const bump3 = 0.05 * Math.sin(3.1 * x + 2.3 * y + 0.4) * Math.sin(2.7 * z - 1.9 * y + 1.1) + 0.03 * Math.sin(5.3 * y + 4.1 * z + 2 * x);
      x *= 1 + bump3; y *= 1 + bump3; z *= 1 + bump3;
      x += 0.035 * Math.sin(4.4 * y + 3 * z); y += 0.035 * Math.sin(4.1 * z - 2.6 * x + 1);
      [y, z] = [y * ct - z * st, y * st + z * ct];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      const rho = Math.hypot(x, y), a = Math.atan2(y, x);
      const r = R * rho * (1 + (wave(a) - 1) * Math.min(1, rho) ** 4);
      (rho > 0.9 ? L.rim : rho > 0.62 ? L.mid : L.face).push({ r, a, i });
    }
  }
  for (let k = 0; k < 720; k++) { // ridges: four wavy bands on the rim, phases apart, crossing (the layered rim of the reference)
    const c = k % 4, a = (k * ga * 2.3) % TAU;
    const w = 1 + (wave(a + 0.3 * c - 0.45) - 1) * (1.25 - 0.2 * c) + 0.014 * Math.sin(23 * a + 2 * c) + 0.008 * Math.sin(41 * a + c);
    L.rim.push({ r: R * w * (0.945 + 0.024 * c + 0.016 * hash(k, 8)), a, i: 2000 + k });
  }
  const flame = a => c01(0.55 * Math.sin(5 * a + 1.2) + 0.45 * Math.sin(8 * a - 0.4) + 0.3 * Math.sin(13 * a + 2.2)); // where the rim frays out
  for (let k = 0; k < 420; k++) { // frayed edge: dust just outside the rim, flaring out in flames at some angles
    const a = (k * ga * 3.1) % TAU, h1 = hash(k, 3);
    L.fray.push({ r: R * wave(a) * (0.99 + (0.03 + 0.2 * flame(a)) * h1 ** 1.4), a: a + 0.03 * (hash(k, 13) - 0.5), i: 3000 + k, loose: true });
  }
  for (let k = 0; k < 22; k++) { const a = (k * ga * 4.7) % TAU; L.spark.push({ r: R * wave(a) * (0.96 + 0.05 * hash(k, 5)), a, i: 3600 + k }); } // white specks on the rim: they streak as the bright lead filaments
  for (let k = 0; k < 70; k++) { const a = (k * ga * 5.3) % TAU; L.stray.push({ r: R * wave(a) * (1.06 + (0.08 + 0.2 * flame(a)) * hash(k, 7)), a, i: 4000 + k, loose: true }); }
  for (const pts of Object.values(L)) for (const p of pts) { [p.h1, p.h2, p.h3, p.h6, p.h9] = [1, 2, 3, 6, 9].map(n => hash(p.i, n)); p.rn = Math.min(p.r / R, 1.3); p.rn15 = p.rn ** 1.5; } // per-dot constants
  return (CLOUD = L);
}

// ---- motion: each kind has a per-time envelope (env: computed once per keyframe) and a per-dot part (f) that adds an angle
// offset, a radius factor, a squash and a shift to the dot. Changes add up: a second change during the first sums them.
const KIND = {
  entry: { T: 1150, // the dots spiral in from out of the orb, fast, and settle into the sphere with a small overshoot
    env: u => ({ u, ov: 1 - 0.06 * bump((u - 0.36) / 0.5) }),
    f(p, e, o) {
      const lag = 0.22 * p.h3, rem = (1 - c01((e.u - lag) / (1 - lag))) ** 3.4; // dots arrive at their own time: layered filaments
      o.da += (1.25 + 0.7 * p.h1) * Math.PI * rem; o.k *= (1 + (0.6 + 0.8 * p.h2) * rem ** 1.2) * e.ov;
    } },
  up: { T: 1100, // vortex: one full turn (anticipation, whip, long settle; a dot moves < 25° between keyframes, so no chords),
    env(u, s, seed) { // inner dots twist further, the shape folds into lobes and swells, the loose fray is flung out and back
      const v = c01((u - 0.07) / 0.93), spin = u < 0.07 ? -0.07 * bump(u / 0.14) : TAU * (1 - (1 - v) ** 2.2), sw = Math.sin(Math.PI * c01(u / 0.8)) ** 2;
      return { spin, tw: 1.1 * s * sw, ks: 1 + 0.07 * s * sw, fl: 0.32 * s * bump(u / 0.65), ph: 0.45 * spin + seed * 2.1,
        lob: s * (0.17 * bump(u / 0.5) - 0.05 * bump((u - 0.5) / 0.3)) };
    },
    f(p, e, o) {
      const tw = e.tw * (1 - 0.8 * p.rn), al = p.a + e.ph + tw; // where the dot is in the frame of the (slower) lobes, a new fold each change
      o.da += e.spin + tw;
      o.k *= (1 + e.lob * (0.62 * Math.sin(3 * al + 0.8) + 0.45 * Math.sin(2 * al - 0.4) + 0.22 * Math.sin(al + 2)) * p.rn15) * e.ks * (p.loose ? 1 + e.fl * p.h9 : 1);
    } },
  down: { T: 1200, // hit from above at 150 ms: squashed and pushed down, a twist back, the lower rim tears into tongues that fly
    env(u, s) { // out and fall, snap back a little past their place, the sphere shrinks
      const t = u * 1200, v = c01((t - 150) / 1050);
      const pre = Math.sin((Math.PI / 2) * c01(t / 150)) * (1 - smooth(v / 0.05));
      const sq = Math.sin((Math.PI / 2) * c01(v / 0.12)) * Math.exp(-3 * v) * Math.cos(TAU * 1.2 * v) * (1 - v);
      return { sy: 1 + 0.05 * s * pre - 0.17 * s * sq, sx: 1 - 0.025 * s * pre + 0.09 * s * sq, dy: R * 0.08 * s * sq,
        tw: -0.5 * s * bump(v / 0.6), tw2: 0.08 * s * bump((v - 0.6) / 0.4), k: 1 - 0.08 * s * bump(v / 0.75),
        F: R * 0.85 * ((v / 0.12) * Math.exp(1 - v / 0.12) * (1 - smooth(v / 0.8)) - 0.1 * bump((v - 0.38) / 0.4)), g: R * 0.25 * bump(v / 0.7) * c01(v / 0.25) };
    },
    f(p, e, o, q) {
      o.da += e.tw * (1 - 0.6 * p.rn) + e.tw2; o.k *= e.k; o.sx *= e.sx; o.sy *= e.sy; o.dy += e.dy;
      if (!p.loose && p.rn <= 0.8) return;
      const m = q.tear || (q.tear = new Map());
      let t = m.get(p);
      if (!t) { // torn sheets: the rim splits into 9 arcs, most rip outward together (parallel streaks), outer layers furthest,
        const pos = ((((p.a + 0.2 + q.seed * 0.83) % TAU) + TAU) % TAU) / (TAU / 9), sec = Math.floor(pos); // each a ragged tongue
        const w = c01(Math.sin(p.a) * 0.7 + 0.5); // y points down: the lower side tears most
        const str = (hash(sec + q.seed * 9, 4) < (q.s >= 1.25 ? 0.08 : 0.22) ? 0 : 0.45 + 0.55 * hash(sec, 4)) * q.s * w * (0.55 + 0.9 * c01((p.rn - 0.8) / 0.3) + (p.loose ? 0.25 : 0));
        const dir = (sec + 0.5) * (TAU / 9) - 0.2 - q.seed * 0.83 + (hash(sec, 5) - 0.5) * 0.5, tg = Math.sin(Math.PI * (pos - sec)) ** 0.7 * (0.85 + 0.3 * p.h6);
        m.set(p, (t = { str, x: Math.cos(dir) * str * tg, y: Math.sin(dir) * str * tg }));
      }
      if (t.str) { o.dx += t.x * e.F; o.dy += t.y * e.F + e.g * t.str; }
    } },
};

// every dot of a path at time t, in tenths of a unit
function track(pts, perts, t) {
  const live = [];
  for (const q of perts) { const tau = t - q.t0; if (tau < q.T) live.push([KIND[q.kind], KIND[q.kind].env(Math.max(0, tau) / q.T, q.s, q.seed || 0), q]); }
  const out = new Int16Array(pts.length * 2), o = {};
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    o.da = 0; o.k = 1; o.sx = 1; o.sy = 1; o.dx = 0; o.dy = 0;
    for (const [K, e, q] of live) K.f(p, e, o, q);
    const r = p.r * o.k, a = p.a + o.da;
    out[2 * k] = Math.round((r * Math.cos(a) * o.sx + o.dx) * Q); out[2 * k + 1] = Math.round((r * Math.sin(a) * o.sy + o.dy) * Q);
  }
  return out;
}
// a path from the dots' positions one shutter ago (tail) to now (head): "M tail l head-tail" per dot
function streaks(tail, head) {
  let d = '';
  for (let k = 0; k < head.length; k += 2) d += `M${tail[k]} ${tail[k + 1]}l${head[k] - tail[k]} ${head[k + 1] - tail[k + 1]}`;
  return d;
}
const restPath = pts => { const at = track(pts, [], 0); return streaks(at, at); };

// keyframe times: one shutter apart while things move fast, two in the settle
function sampleTimes(end) {
  const out = [];
  for (let t = 0; t < end; t += t < 660 ? SHUTTER : 2 * SHUTTER) out.push(t);
  out.push(end);
  return out;
}

const PAL = { // gradient tints during a change, top → bottom stop (light: the ink versions)
  up: ['#9dffc9', '#38ff96', '#14dc6e', '#08a650'], down: ['#ff9aa3', '#ff4a5c', '#ff1f3c', '#c90d29'],
  upLight: ['#18b863', '#0b9a4d', '#078a42', '#056f35'], downLight: ['#ee3a49', '#d4142a', '#bf0f24', '#9e0b1c'],
};
const EASE_OUT = 'cubic-bezier(.16,.8,.3,1)', EASE_IN = 'cubic-bezier(.55,0,.9,.45)';
let uid = 0;

export function viewerBadge({ h, svg, format }) {
  const id = `vw${++uid}`;
  const C = cloud();
  const g = `url(#${id}-g)`;
  const path = (cls, pts) => `<path class="vw-p ${cls}" stroke="${cls === 'vw-spark' ? '#fff' : g}" d="${restPath(pts)}"/>`;
  const layer = (cls, inner) => h(`div.vw-layer.${cls.split(" ").join(".")}`, svg(`<svg viewBox="${-V * Q} ${-V * Q} ${2 * V * Q} ${2 * V * Q}" aria-hidden="true">${inner}</svg>`)); // a div: its transform runs on the compositor
  const defs = svg(`<svg class="vw-defs" width="0" height="0" aria-hidden="true"><defs>
    <linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="160" y1="-560" x2="-160" y2="560">
      <stop class="vw-s0" offset="0"/><stop class="vw-s1" offset="0.34"/><stop class="vw-s2" offset="0.66"/><stop class="vw-s3" offset="1"/></linearGradient>
    <filter id="${id}-vb" x="-10%" y="-80%" width="120%" height="260%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 3"/></filter>
  </defs></svg>`);
  const stops = [...defs.querySelectorAll('stop')];
  const blurEl = defs.querySelector('feGaussianBlur');
  const shell = layer('vw-shell', path('vw-face', C.face) + path('vw-mid', C.mid));
  const rim = layer('vw-rim', path('vw-fray', C.fray) + path('vw-rimp', C.rim) + path('vw-spark', C.spark));
  const strayPath = `<path class="vw-p vw-stray" stroke="${g}" d="${restPath(C.stray)}"/>`;
  const sa = layer('vw-strays vw-sa', strayPath), sb = layer('vw-strays vw-sb', strayPath);
  const P = [...shell.querySelectorAll('path'), ...rim.querySelectorAll('path')];
  const PTS = [C.face, C.mid, C.fray, C.rim, C.spark];
  const dust = h('div.vw-dust', sa, sb); // the strays' own opacity drift stays on the compositor: the entry fades this wrapper
  const orb = h('div.vw-orb', defs, shell, rim, dust);
  const numbox = h('div.vw-numbox');
  const el = h('div.vw.vw-empty', h('div.vw-badge', orb, numbox));

  let shown = null, num = null, chip = null, churn = null, changes = 0; // churn: { anims, perts } of the running `d` animation
  const light = () => document.documentElement.dataset.overlay === 'light';
  const vb = `url(#${id}-vb)`;
  const now = a => (a && (a.playState === 'running' || a.playState === 'paused') ? a.currentTime || 0 : null);
  const cs = e => { const st = getComputedStyle(e); return { transform: st.transform, opacity: st.opacity }; };
  const kill = e => e.getAnimations().forEach(a => a instanceof CSSAnimation || a.cancel()); // the idle sway (CSS) stays
  const drop = (e, a) => a.finished.then(() => e.remove(), () => {});
  const pseudo = (name, fn) => orb.getAnimations().forEach(a => a.effect && a.effect.pseudoElement === name && fn(a));

  // the number fits the dark centre of the orb (centre layout): its width in digits drives its size
  const width = str => [...str].reduce((w, ch) => w + (/\d/.test(ch) ? 1 : /[kKM]/.test(ch) ? 0.95 : 0.42), 0);
  function setText(n) {
    const str = format(n);
    numbox.style.setProperty('--w', String(Math.max(1, width(str))));
    return str;
  }
  function blurFor() { // the text streak follows the text size (3 px at 28 px)
    blurEl.setAttribute('stdDeviation', `0 ${Math.max(1.5, parseFloat(getComputedStyle(numbox).fontSize) * 0.11).toFixed(1)}`);
  }

  // ---- the dots: one `d` animation per path, keyframes from the sum of every perturbation still running
  let base = null; // the paths' resting opacity / stroke width, read while no churn runs
  function churnTo(perts) {
    if (!churn) base = P.map(pe => { const st = getComputedStyle(pe); return [Number(st.opacity), Number((/[\d.]+/.exec(st.strokeWidth) || [10])[0])]; }); // "calc(9.5px)"
    const end = Math.max(...perts.map(q => q.t0 + q.T));
    const times = sampleTimes(end);
    const anims = P.map((pe, j) => {
      const pts = PTS[j], [o, w] = base[j], memo = new Map();
      const at = t => { if (!memo.has(t)) memo.set(t, track(pts, perts, t)); return memo.get(t); };
      return pe.animate(times.map(t => {
        const tail = at(t - SHUTTER), head = at(t);
        let len = 0; // mean streak length (sampled): a streak is fainter and finer than a dot, its light spread along its path
        for (let k = 0; k < head.length; k += 18) len += Math.hypot(head[k] - tail[k], head[k + 1] - tail[k + 1]);
        const f = 1 / (1 + (len / Math.ceil(head.length / 18)) / (4 * Q));
        return { offset: t / end, d: `path("${streaks(tail, head)}")`, opacity: (o * (0.45 + 0.55 * f)).toFixed(3), strokeWidth: `${(w * (0.6 + 0.4 * f)).toFixed(2)}px` };
      }), { duration: end });
    });
    if (churn) churn.anims.forEach(x => x.cancel());
    churn = { anims, perts };
    anims[0].finished.then(() => { if (churn && churn.anims === anims) churn = null; }, () => {});
  }
  function perturb(kind, str) {
    const at = churn ? now(churn.anims[0]) : null;
    const old = at === null ? [] : churn.perts.map(q => ({ ...q, t0: q.t0 - at })).filter(q => q.t0 + q.T > 0);
    churnTo([...old, { kind, t0: 0, s: str, T: KIND[kind].T, seed: ++changes }]);
  }

  // ---- the gradient takes the change's colour as a wave (up: from the bottom, down: from the top), then cools back;
  // the rainbow bloom around the rim steps back meanwhile
  function tint(kind) {
    const pal = PAL[kind + (light() ? 'Light' : '')];
    stops.forEach((st, j) => {
      const from = getComputedStyle(st).stopColor, busy = st.getAnimations().length > 0; // already tinted: turn over fast (no muddy mix)
      kill(st);
      const o = kind === 'up' ? 3 - j : j;
      st.animate([{ stopColor: from, offset: 0 }, { stopColor: pal[j], offset: busy ? 0.03 + o * 0.015 : 0.08 + o * 0.04 }, { stopColor: pal[j], offset: 0.5 + o * 0.04 }],
        { duration: 1400, delay: busy ? 0 : kind === 'down' ? 130 : 30, fill: 'backwards' });
    });
    const bloom = getComputedStyle(orb, '::after').opacity;
    pseudo('::after', a => a.cancel());
    orb.animate([{ opacity: bloom }, { opacity: 0.08, offset: 0.15 }, { opacity: 0.08, offset: 0.6 }], { duration: 1400, pseudoElement: '::after' });
  }

  // ---- the number: the old one streaks out, the new one streaks in from the other side (up: it rises, down: it drops)
  function swapNumber(n, dir, delay) {
    const next = h('span.vw-num', setText(n));
    if (num) {
      const old = num, moving = old.getAnimations().some(x => now(x) !== null);
      const from = cs(old);
      kill(old);
      drop(old, old.animate([
        { ...from, filter: 'none', offset: 0, easing: EASE_IN },
        { transform: `translateY(${dir * 0.12}em) scaleY(1.08)`, opacity: 1, filter: vb, offset: 0.35, easing: EASE_IN },
        { transform: `translateY(${dir * 0.9}em) scaleY(1.7)`, opacity: 0, filter: vb },
      ], { duration: moving ? 120 : 180, delay: moving ? 0 : delay - 50, fill: 'both' }));
      delay = moving ? 70 : delay + 60;
    }
    numbox.prepend(next);
    num = next;
    next.animate([
      { transform: `translateY(${-dir * 0.95}em) scaleY(1.8)`, opacity: 0, filter: vb, easing: EASE_OUT },
      { transform: `translateY(${dir * 0.07}em) scaleY(0.94)`, opacity: 1, filter: vb, offset: 0.45 },
      { transform: `translateY(${dir * 0.07}em) scaleY(0.94)`, opacity: 1, filter: 'none', offset: 0.46, easing: 'ease-in-out' },
      { transform: 'none', opacity: 1, filter: 'none' },
    ], { duration: 400, delay, fill: 'backwards' });
  }

  // ---- the chip "+x" / "−x" above the number: one at a time; a change of the same sign while it shows adds up in it.
  // Two animations, an entrance and a delayed exit: nothing runs while it holds (its filter keeps a running chip off the compositor).
  const HOLD = 2214; // ms the chip shows before it leaves
  const ms = (list, dur) => list.map(([t, k]) => ({ ...k, offset: t / dur })); // keyframes written in milliseconds
  function chipLife(c, from) {
    const enter = from ? [ // counting on: a punch from wherever it was
      [0, { ...from, filter: 'none', easing: EASE_OUT }], [95, { transform: 'scale(1.3)', opacity: 1, filter: 'none', easing: 'ease-in-out' }],
      [300, { transform: 'none', opacity: 1, filter: 'none' }],
    ] : c.up ? [ // shot up out of the orb, streaking, overshoots and settles
      [0, { transform: 'translateY(1.2em) scale(0.8, 1.5)', opacity: 0, filter: vb, easing: 'linear' }],
      [32, { transform: 'translateY(0.9em) scale(0.85, 1.45)', opacity: 1, filter: vb, easing: EASE_OUT }],
      [189, { transform: 'translateY(-0.16em) scale(1.05, 0.97)', opacity: 1, filter: vb }],
      [192, { transform: 'translateY(-0.16em) scale(1.05, 0.97)', opacity: 1, filter: 'none', easing: 'ease-in-out' }],
      [351, { transform: 'none', opacity: 1, filter: 'none' }],
    ] : [ // falls in from above, accelerating, lands with a squash
      [0, { transform: 'translateY(-1.25em) scale(0.85, 1.6)', opacity: 0, filter: vb, easing: 'linear' }],
      [32, { transform: 'translateY(-1em) scale(0.86, 1.55)', opacity: 1, filter: vb, easing: EASE_IN }],
      [148, { transform: 'translateY(0.04em) scale(1.2, 0.72)', opacity: 1, filter: vb }],
      [151, { transform: 'translateY(0.04em) scale(1.2, 0.72)', opacity: 1, filter: 'none', easing: EASE_OUT }],
      [243, { transform: 'translateY(-0.06em) scale(0.97, 1.05)', opacity: 1, filter: 'none', easing: 'ease-in-out' }],
      [351, { transform: 'none', opacity: 1, filter: 'none' }],
    ];
    const exit = c.up ? [ // leaves upward, streaking
      [0, { transform: 'none', opacity: 1, filter: 'none', easing: EASE_OUT }], [81, { transform: 'translateY(0.06em) scaleY(0.94)', opacity: 1, filter: 'none' }],
      [84, { transform: 'translateY(0.06em) scaleY(0.94)', opacity: 1, filter: vb, easing: EASE_IN }], [486, { transform: 'translateY(-1.2em) scaleY(1.7)', opacity: 0, filter: vb }],
    ] : [ // snuffed: flattened to a line
      [0, { transform: 'none', opacity: 1, easing: EASE_OUT }], [135, { transform: 'scale(1.1, 0.7)', opacity: 1, easing: EASE_IN }], [486, { transform: 'scale(1.35, 0.03)', opacity: 0 }],
    ];
    const delay = from ? 0 : c.up ? 160 : 0, inDur = enter[enter.length - 1][0];
    c.el.animate(ms(enter, inDur), { duration: inDur, delay, fill: 'backwards' });
    const a = c.el.animate(ms(exit, 486), { duration: 486, delay: delay + HOLD, fill: 'forwards' });
    c.anim = a; // its current time is the chip's age
    a.finished.then(() => { c.el.remove(); if (chip === c) chip = null; }, () => {});
  }
  function showChip(delta) {
    const up = delta > 0;
    const t = chip ? now(chip.anim) : null;
    if (chip && chip.up === up && t !== null && t < HOLD) { // same direction while it shows: it counts on
      chip.sum += delta;
      chip.el.textContent = `${up ? '+' : '−'}${format(Math.abs(chip.sum))}`;
      const from = cs(chip.el); kill(chip.el); chipLife(chip, from);
      return;
    }
    if (chip) { // the other direction (or leaving): the old chip is snuffed out in place, the new one arrives
      const old = chip.el, from = cs(old); kill(old);
      drop(old, old.animate([{ ...from }, { transform: 'scale(1.3, 0.04)', opacity: 0 }], { duration: 100, easing: EASE_IN, fill: 'both' }));
    }
    const c = { up, sum: delta, el: h(`div.vw-chip.${up ? 'vw-up' : 'vw-down'}${Math.abs(delta) >= 100 ? '.vw-big' : ''}`, `${up ? '+' : '−'}${format(Math.abs(delta))}`) };
    numbox.append(c.el);
    chip = c;
    chipLife(c, null);
  }

  function still(total) {
    if (churn) { churn.anims.forEach(x => x.cancel()); churn = null; }
    stops.forEach(kill);
    pseudo('::before', a => a.cancel()); pseudo('::after', a => a.cancel());
    [shell, rim, dust].forEach(kill);
    [...numbox.children].forEach(e => { kill(e); e.remove(); });
    chip = null;
    num = h('span.vw-num', setText(total));
    numbox.append(num);
    el.classList.remove('vw-empty');
  }

  // ---- entry: the dots spiral in from far out as white streaks, cool into the gradient, the core opens, the number lands
  function entry(total) {
    still(total);
    blurFor();
    churnTo([{ kind: 'entry', t0: 0, s: 1, T: KIND.entry.T }]);
    const flash = light() ? '#24264a' : '#ffffff';
    stops.forEach(st => st.animate([{ stopColor: flash }, { stopColor: flash, offset: 0.3 }], { duration: 1150, easing: 'ease-in' }));
    for (const L of [shell, rim]) L.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1 }], { duration: 1000 });
    dust.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], { duration: 1600 });
    orb.animate([{ opacity: 0, transform: 'scale(0.3)', easing: EASE_OUT }, { opacity: 1, transform: 'none' }], { duration: 900, pseudoElement: '::before' });
    orb.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }], { duration: 1300, pseudoElement: '::after' });
    num.animate([
      { transform: 'translateY(0.9em) scaleY(1.8)', opacity: 0, filter: vb, easing: EASE_OUT },
      { transform: 'translateY(-0.06em) scaleY(0.95)', opacity: 1, filter: vb, offset: 0.45 },
      { transform: 'translateY(-0.06em) scaleY(0.95)', opacity: 1, filter: 'none', offset: 0.46, easing: 'ease-in-out' },
      { transform: 'none', opacity: 1, filter: 'none' },
    ], { duration: 420, delay: 640, fill: 'backwards' });
  }

  function set(total, { still: calm = false } = {}) {
    total = Math.max(0, Math.round(Number(total) || 0));
    if (total === shown) return;
    const prev = shown;
    shown = total;
    if (calm) return still(total);
    if (prev === null) return entry(total);
    const delta = total - prev, up = delta > 0;
    const str = Math.min(1.4, 0.75 + 0.27 * Math.log10(Math.abs(delta)));
    blurFor();
    perturb(up ? 'up' : 'down', str);
    tint(up ? 'up' : 'down');
    if (format(total) !== num.textContent) swapNumber(total, up ? -1 : 1, up ? 300 : 230); // 12 k → 12 k: the number holds
    showChip(delta);
  }

  return { el, set };
}
