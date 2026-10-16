// Wave style of the alerts overlay (DECOR.wave in alert-card.js).
// wave: a breaking wave of white particles (after a monochrome particle-fluid piece: it billows up from the bottom left,
// surges, crashes, tears into tendrils and spray, and disperses into dust). One fluid body: every particle lives in one
// flow field (a spine from the base under the icon, up its left, over it, along the crest to a lip curling down), placed by
// (u along, v across) and drawn as round-capped sub-paths of a few SVG paths that differ only in weight. The entry replays
// the paths' `d` through keyframes computed here once (WAAPI): each sub-path runs from halfway since the last keyframe to
// now, so fast particles draw their own motion-blur streak. The hold costs the main thread nothing: the paths are static from
// the settled pose and the motion is CSS transforms and opacity on composited SVGs holding regions of the same field (sway,
// the curl breathing, the crest lifting, dust drifting, spray carried off the lip).
// The exit is CSS (`d: var(--wave-x1 / -x2)`, set here), run by `.gone`.
// The card is measured once it is in the page (a microtask after decorate), so the wave fits its real size and the room
// around it (em), whatever the source size and position.
const Q = 50; // path units per em (integer coordinates: a 0.02 em grid, shorter keyframe strings)
const BOX = { l: 3, r: 2.4, t: 2.8, b: 2.4 }; // the particle box overhangs the card (em), as in the CSS (.wave-fx)
const END = 1480; // ms: the spray is at rest; the body by REST
const REST = 1200;
// stroke width and opacity per path, as in the CSS (the entry keyframes scale them with the streaks)
const WEIGHT = { core: [2.3, 0.96], dense: [3.2, 0.85], grain: [2.3, 0.72], haze: [5, 0.3], spray: [2.2, 0.85], text: [2.1, 0] };
const TAU = Math.PI * 2;
const hash = (i, s = 0) => { // 0..1, deterministic (an integer mix of the index and the stream)
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s + 0x632be5ab, 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = c01(x); return x * x * (3 - 2 * x); };
const bump = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const lerp = (a, b, f) => a + (b - a) * f;
const steps = (a, b, dt) => { const out = []; for (let t = a; t < b; t += dt) out.push(t); return out; };
const FOAM_T = [...steps(0, 500, 100), ...steps(500, 1025, 75), 1100, REST]; // keyframes (coarser while it billows): a streak is half the last step
const SPRAY_T = [0, 250, 400, 500, ...steps(560, 1120, 62), ...steps(1120, END, 120), END]; // riding (fading in) until it breaks off
const DENSE_T = [400, 550, 700, 850, 1000, REST]; // the dense sheets: they thicken the surge and the crash (fading in while they move with the field)
const TEXT_T = [...steps(700, 1300, 50), 1300]; // the letters' dust: thrown out with the spray, then settling into the glyphs

// ---- the spine: control points moving through poses. Sampled every STEP ms as M points evenly spaced along its length,
// with the normal at each; a particle on it is (u along, v across).
const M = 64, STEP = 20;
function cr(P, s, out) { // Catmull-Rom through [x0, y0, x1, y1, …] at s in [0, n - 1]
  const n = P.length / 2, i = Math.min(n - 2, Math.max(0, Math.floor(s))), f = s - i;
  const a = Math.max(0, i - 1) * 2, b = i * 2, c = b + 2, d = Math.min(n - 1, i + 2) * 2;
  const f2 = f * f, f3 = f2 * f;
  const k0 = -0.5 * f3 + f2 - 0.5 * f, k1 = 1.5 * f3 - 2.5 * f2 + 1, k2 = -1.5 * f3 + 2 * f2 + 0.5 * f, k3 = 0.5 * f3 - 0.5 * f2;
  out[0] = k0 * P[a] + k1 * P[b] + k2 * P[c] + k3 * P[d];
  out[1] = k0 * P[a + 1] + k1 * P[b + 1] + k2 * P[c + 1] + k3 * P[d + 1];
}
function spine(poses) {
  const T = Math.ceil(END / STEP) + 2, n = poses[0].p.length, tab = new Float32Array(T * M * 4);
  const track = Array.from({ length: n }, (_, q) => poses.flatMap(p => p.p[q])); // each control point through the poses
  const C = new Float64Array(n * 2), raw = new Float64Array(48 * 2), len = new Float64Array(48), o = [0, 0];
  for (let k = 0; k < T; k++) {
    const t = Math.min(k * STEP, END);
    let j = 0; while (j < poses.length - 2 && t >= poses[j + 1].t) j++;
    const f = c01((t - poses[j].t) / (poses[j + 1].t - poses[j].t));
    for (let q = 0; q < n; q++) { cr(track[q], j + f, o); C[2 * q] = o[0]; C[2 * q + 1] = o[1]; }
    for (let q = 0; q < 48; q++) {
      cr(C, (q / 47) * (n - 1), o); raw[2 * q] = o[0]; raw[2 * q + 1] = o[1];
      len[q] = q ? len[q - 1] + Math.hypot(o[0] - raw[2 * q - 2], o[1] - raw[2 * q - 1]) : 0;
    }
    for (let m = 0, q = 0; m < M; m++) { // resample at even arc length
      const want = (m / (M - 1)) * len[47];
      while (q < 46 && len[q + 1] < want) q++;
      const g = c01((want - len[q]) / (len[q + 1] - len[q] || 1)), A = (k * M + m) * 4;
      const tx = raw[2 * q + 2] - raw[2 * q], ty = raw[2 * q + 3] - raw[2 * q + 1], tl = Math.hypot(tx, ty) || 1;
      tab[A] = raw[2 * q] + tx * g; tab[A + 1] = raw[2 * q + 1] + ty * g; tab[A + 2] = -ty / tl; tab[A + 3] = tx / tl;
    }
  }
  return { tab, T, L: len[47] }; // L: its length at rest (em)
}
function at(S, u, t, out) { // the spine's point and normal at (u, t): [x, y, nx, ny]
  const ft = c01(t / STEP / (S.T - 1)) * (S.T - 1), k = Math.min(S.T - 2, ft | 0), fk = ft - k;
  const fu = c01(u) * (M - 1), m = Math.min(M - 2, fu | 0), fm = fu - m;
  const A = (k * M + m) * 4, B = A + M * 4, tab = S.tab;
  for (let c = 0; c < 4; c++) {
    const a = tab[A + c] + (tab[A + 4 + c] - tab[A + c]) * fm;
    out[c] = a + (tab[B + c] + (tab[B + 4 + c] - tab[B + c]) * fm - a) * fk;
  }
}

// ---- the wave's shape over time (em, card coordinates; eye = the icon's centre and radius): from the base under the eye,
// up its left side (the mass), over it, along the crest to the lip, which curls down and back. A billow at first, then a
// rising column rolling over the eye, a surge high above the card, the crash (the lip thrown down across the card), the
// break (the crest recoils), the rest.
function shape(W, H, { x: ix, y: iy, r }, room) {
  const top = -Math.min(1.35, room.t - 0.3), low = H + Math.min(1.0, room.b - 0.3), left = -Math.min(1.7, room.l - 0.2);
  const lx = Math.max(left + 1.4, ix - r - 1.05), hook = Math.min(0.62 * W, Math.max(0.46 * W, ix + r + 5.5));
  const turn = Math.max(top + 0.9, iy - r - 0.6), peak = -Math.min(2.5, room.t - 0.2), m = f => lerp(ix, hook, f);
  return spine([
    { t: 0, p: [[ix + 0.5, low + 0.1], [ix - 0.4, low + 0.15], [ix - 1.1, low - 0.15], [ix - 1.3, low - 0.65], [ix - 1.0, low - 1.1], [ix - 0.35, low - 1.3], [ix + 0.3, low - 1.15], [ix + 0.7, low - 0.8], [ix + 0.8, low - 0.4], [ix + 0.6, low - 0.15]] },
    { t: 300, p: [[ix + 0.65, low + 0.05], [ix - r - 0.3, low - 0.2], [lx - 0.4, iy + 0.2], [lx - 0.1, turn + 0.2], [ix - 0.2, turn - 0.5], [ix + r + 0.6, turn - 0.6], [ix + r + 1.5, turn - 0.3], [ix + r + 2.2, iy - 0.4], [ix + r + 2.5, iy + 0.2], [ix + r + 2.2, iy + 0.7]] },
    { t: 520, p: [[ix + 0.65, low], [ix - r - 0.3, low - 0.3], [lx - 0.35, iy], [lx - 0.05, turn - 0.4], [ix - 0.1, peak + 0.45], [ix + r + 1.6, peak], [m(0.62), peak + 0.1], [hook * 0.95, peak + 0.5], [hook * 1.03, peak + 1.1], [hook * 0.97, peak + 1.55]] },
    { t: 720, p: [[ix + 0.7, low - 0.05], [ix - r - 0.25, low - 0.25], [lx - 0.15, iy + 0.1], [lx + 0.05, turn - 0.1], [ix + 0.1, top - 0.15], [ix + r + 1.9, top - 0.35], [m(0.7), top - 0.1], [hook * 1.1, top + 0.7], [hook * 1.22, 0.45 * H], [hook * 1.12, 0.85 * H]] },
    { t: 920, p: [[ix + 0.7, low - 0.05], [ix - r - 0.2, low - 0.25], [lx, iy + 0.2], [lx + 0.1, turn], [ix + 0.25, top + 0.45], [ix + r + 2, top + 0.25], [m(0.7), top + 0.3], [hook * 1.02, top + 0.8], [hook + 0.55, top + 1.45], [hook + 0.1, top + 1.8]] },
    { t: END, p: [[ix + 0.7, low - 0.05], [ix - r - 0.2, low - 0.25], [lx, iy + 0.25], [lx + 0.1, turn], [ix + 0.25, top + 0.5], [ix + r + 2, top + 0.3], [m(0.7), top + 0.35], [hook, top + 0.75], [hook + 0.45, top + 1.35], [hook + 0.05, top + 1.8]] },
  ]);
}

// ---- where particles sit at rest, in the sheet's coordinates (X: em along the spine, v across: |v| <= 1 is the sheet,
// v > 0 faces the curl, which is lit; lumpy lobes bulge on the outer side). The fluid stretches everything along its flow.
// Kinds only decide where in the field a particle is likelier (every kind is the same field):
//   core: tiny near-white dots packed into the luminous sheets (an importance sampler); rim: the lobes' lit edges
//   speck: sparse dust, thicker in the churning base
//   back: dim particles behind, for depth; smoke: puffs outside; lace: filaments along the flow; tendril: strands torn off
//   the crest's edge. The icon's surroundings stay dark (the eye) and nothing lands on the text (keep).
const half = u => (u < 0.08 ? lerp(1.3, 1.65, u / 0.08) : u < 0.3 ? lerp(1.65, 1.35, (u - 0.08) / 0.22) : u < 0.45 ? lerp(1.3, 1.1, (u - 0.3) / 0.15) : u < 0.88 ? lerp(1.1, 0.7, (u - 0.45) / 0.43) : lerp(0.7, 0.35, (u - 0.88) / 0.12));
const lobe = u => 1 + 0.9 * Math.max(0, Math.sin(u * 27 + 1.3)) ** 2 * (u < 0.45 ? 1 : 0.6) + 0.35 * Math.max(0, Math.sin(u * 61 + 0.4)) ** 3; // bulges of the outer side
const sheetAt = (X, v) => c01(0.32 + 0.85 * Math.sin(0.46 * X + 1.7 * v + 0.3) * Math.sin(0.29 * X - 1.1 * v + 1.7) + 0.18 * Math.sin(1.15 * X + 2.9 * v + 2.2));
const lit = v => 0.3 + 0.7 * c01((v + 1) / 2) ** 1.3, edge = v => 1 - smooth((Math.abs(v) - 0.85) / 0.3);
const NU = 96, NV = 20; // the importance grid over (u, v), v in [-1.15, 1.15]
function pickers(S, pows) { // samplers of (u, v) where the sheets are bright: cumulative tables over one grid, searched by bisection
  const g = new Float64Array(NU * NV), w = new Float64Array(NU * NV);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const v = -1.15 + ((j + 0.5) * 2.3) / NV; g[i * NV + j] = sheetAt(((i + 0.5) / NU) * S.L, v); w[i * NV + j] = lit(v) ** 1.5 * edge(v); }
  return Object.fromEntries(Object.entries(pows).map(([kind, pow]) => [kind, picker(g, w, pow)]));
}
function picker(g, w, pow) {
  const c = new Float64Array(NU * NV);
  let acc = 0;
  for (let k = 0; k < c.length; k++) c[k] = acc += (g[k] ** pow + 0.05) * w[k]; // a floor: some foam everywhere on the sheet
  return i => {
    const x = hash(i, 1) * acc;
    let a = 0, b = c.length - 1;
    while (a < b) { const mid = (a + b) >> 1; if (c[mid] < x) a = mid + 1; else b = mid; }
    return [(((a / NV) | 0) + hash(i, 2)) / NU, -1.15 + ((a % NV) + hash(i, 3)) * 2.3 / NV];
  };
}
let id = 0, seed = 0; // seed: from the user name, so every alert gets its own folds, lace and tendrils
function foam(ctx, kind, n, out = []) {
  const { S } = ctx, pick = ctx.pick[kind], o = [0, 0, 0, 0];
  for (let j = 0, tries = 0; j < n && tries < n * 20; id++, tries++) {
    let u, v;
    if (pick) [u, v] = pick(id);
    else {
      u = hash(id, 1); v = kind === 'smoke' ? -1.15 - 1.6 * hash(id, 2) ** 1.3 : kind === 'back' ? -1.5 + 1.9 * hash(id, 2) : kind === 'rim' ? -0.78 - 0.3 * hash(id, 2) ** 1.5 : hash(id, 2) * 2.4 - 1.2;
      const X = u * S.L, s = sheetAt(X, v);
      const p = kind === 'rim' ? 0.15 + 0.85 * (lobe(u) - 1) : kind === 'speck' ? (0.25 + 0.75 * (1 - s)) * edge(v * 0.9) * (u < 0.14 ? 1 : 0.5) : kind === 'back' ? 0.75 * edge(v * 0.8)
        : 0.9 * c01(0.5 + 0.7 * Math.sin(0.9 * X + 1.4 * v + 0.7) * Math.sin(0.5 * X - 2.2 * v)); // smoke: puffs
      if (hash(id, 3) > p) continue;
    }
    const q = place(ctx, u, v, id, o);
    if (!q) continue;
    j++;
    if (kind === 'core') q.fib = 0.04 + 0.12 * hash(id, 5); // the sheets' striations
    if (kind === 'smoke') q.ta = 1.5 + u * 0.6;
    out.push(q);
  }
  return out;
}
function lace(ctx, n, out = []) { // filament fragments along the flow
  const { S } = ctx, o = [0, 0, 0, 0];
  for (let m = 0; m < n; m++) {
    const k = m + seed, a = hash(k, 40) ** 1.1 * 0.95, len = (0.9 + 2.4 * hash(k, 41)) / S.L, c = -0.85 + 1.85 * hash(k, 42) ** 0.75;
    const w1 = TAU * hash(k, 43), w2 = TAU * hash(k, 44), fork = hash(k, 45) < 0.3 ? a + len * (0.3 + 0.4 * hash(k, 46)) : 2;
    const dots = Math.ceil((len * S.L) / 0.045);
    for (let i = 0; i < dots; i++, id++) {
      const f = i / dots, u = a + len * f, X = u * S.L;
      if (hash(id, 1) > 0.25 + 0.75 * bump(f) ** 0.5) continue; // tapering ends
      let v = c + 0.22 * Math.sin(0.8 * X + w1) + 0.07 * Math.sin(2.9 * X + w2) + (hash(id, 2) - 0.5) * 0.06;
      if (u > fork && hash(id, 3) < 0.5) v += (u - fork) * S.L * 0.18; // the other branch drifts off
      const q = place(ctx, u, v, id, o);
      if (q) out.push(q);
    }
  }
  return out;
}
function tendrils(ctx, n, out = []) { // strands torn off the crest's outer edge, trailing back and curling
  const { S } = ctx, o = [0, 0, 0, 0];
  for (let m = 0; m < n; m++) {
    const k = m + seed, u0 = 0.4 + 0.58 * hash(k, 47), len = 0.8 + 1.8 * hash(k, 48), bend = (hash(k, 49) - 0.5) * 1.6, w = TAU * hash(k, 52);
    const dots = Math.ceil(len / 0.034), th = half(u0);
    for (let i = 0; i < dots; i++, id++) {
      const s = i / dots;
      if (hash(id, 1) < s ** 1.6 * 0.85) continue; // thinning out to its end
      const u = u0 - (s * len * (0.35 + 0.25 * hash(k, 50))) / S.L, v = -1 - (s * len) / th + (bend * s * s * len) / th * 0.4 + 0.05 * Math.sin(9 * s + w);
      const q = place(ctx, u, v, id, o);
      if (q) out.push(q);
    }
  }
  return out;
}
function place(ctx, u, v, i, o) { // a particle's rest position on the sheet, or null where it may not be; its entry parameters
  at(ctx.S, u, END, o);
  const th = half(u) * (v < 0 ? lobe(u) : 1), X = u * ctx.S.L;
  const wx = 0.14 * Math.sin(0.7 * X + 2.9 * v + 1.3) + (hash(i, 8) - 0.5) * 0.03, wy = 0.14 * Math.sin(0.9 * X - 2.1 * v + 0.4) + (hash(i, 9) - 0.5) * 0.03;
  const x = o[0] + o[2] * v * th + wx, y = o[1] + o[3] * v * th + wy;
  if (hash(i, 7) > ctx.keep(x, y)) return null;
  const a = X - Math.round(X / 1.6) * 1.6, b = v * th; // offset from its billow's centre (along, across; em)
  return { kind: 'foam', u, v, th, wx, wy, tx: o[3], ty: -o[2], fib: 0, X,
    lag: 20 + 90 * c01(0.5 + 0.5 * Math.sin(10.2 * u + 2.3 * v + 0.6)) + 18 * hash(i, 10),
    flow: 0.02 + 0.05 * c01(0.5 + 0.5 * Math.sin(X * 0.8 - v * 1.9)) + 0.015 * hash(i, 11),
    ta: 0.7 + u * 0.6, ph: phases(i, u, v), ra: a, rb: b, rg: Math.exp(-((a * a + b * b) / 0.45)) };
}
// spray: particles ride the crest's end (lip) or the base (base) until they break off, then are thrown in tendrils (the
// particles of a tendril leave one after the other along the same arc), braking into dust. The lip tears from its tip back;
// the base sprays low and falls.
const SPRAY = {
  lip: { strands: 18, u: [0.62, 0.38], v: 1.1, td: [690, 520], ang: [-1.0, 1.6], dist: [2, 5], sag: [0.2, 0.5] },
  base: { strands: 10, u: [0, 0.12], v: 1.2, td: [650, 260], ang: [-0.12, 0.62], dist: [1.6, 5], sag: [0.45, 0.7] },
};
function sprayOf(n, from, out = []) {
  const c = SPRAY[from];
  for (let j = 0; j < n; j++, id++) {
    const k = (j % c.strands) + seed + (from === 'base' ? 300 : 0), q = (j / c.strands) | 0, loose = hash(id, 1) < 0.25, h = s => hash(id, s);
    const u = c01(c.u[0] + c.u[1] * hash(k, 11) ** 0.6 - 0.006 * q + (loose ? 0.08 * (h(2) - 0.5) : 0)); // a tendril: one behind the other
    out.push({ kind: 'spray', fib: 0, u, v: (hash(k, 12) * 2 - 1) * c.v + 0.3 * (h(3) - 0.5),
      td: c.td[0] + (from === 'lip' ? 1 - u : u / 0.12) * c.td[1] + q * 7 + (loose ? 70 * h(4) : 0),
      ang: c.ang[0] + c.ang[1] * hash(k, 14) + (loose ? 0.8 * (h(5) - 0.5) : 0), // a fan (y down)
      dist: (c.dist[0] + c.dist[1] * hash(k, 15)) * (1 - 0.75 * c01(q / 34)) * (0.92 + 0.16 * h(6)) * (loose ? 0.6 + 0.9 * h(7) : 1),
      dur: 650 + 550 * h(8), side: (h(9) - 0.5) * 0.12 + 0.9 * (hash(k, 16) - 0.5) * c01(q / 34), sag: c.sag[0] + c.sag[1] * hash(k, 17),
      ta: 1.4, ph: phases(id, 0.9, 0) });
  }
  return out;
}

// ---- the text forms out of the dust: points on its glyphs, from an offscreen drawing of every laid-out character (so a
// wrapped name or message is right), em in card coordinates. A dust particle leaves the crashing crest with the spray,
// then settles on its point, left to right as the wave passes. At the exit the same dust blows away.
function glyphs(card, fs, n) {
  const rc = card.getBoundingClientRect(), c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
  c.width = Math.ceil(rc.width); c.height = Math.ceil(rc.height);
  g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  const range = document.createRange(), walk = document.createTreeWalker(card.querySelector('.evt') || card, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const st = getComputedStyle(node.parentElement), str = node.data;
    if (st.visibility === 'hidden' || st.display === 'none' || node.parentElement.closest('.evt-icon')) continue;
    g.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    for (let i = 0; i < str.length;) {
      const ch = String.fromCodePoint(str.codePointAt(i)), j = i + ch.length;
      if (ch.trim()) { // on its baseline: a character's box is the font's content area, its top the font's ascent above the baseline
        range.setStart(node, i); range.setEnd(node, j);
        const r = range.getBoundingClientRect();
        if (r.width) g.fillText(ch, r.left - rc.left, r.top - rc.top + g.measureText(ch).fontBoundingBoxAscent);
      }
      i = j;
    }
  }
  const { data } = g.getImageData(0, 0, c.width, c.height), pts = [];
  for (let y = 1; y < c.height; y += 2) for (let x = y & 2 ? 1 : 0; x < c.width; x += 2) if (data[(y * c.width + x) * 4 + 3] > 110) pts.push(x / fs, y / fs);
  const out = [], k = Math.max(1, pts.length / 2 / n);
  for (let f = 0; f < pts.length / 2; f += k) { const i = Math.min(pts.length / 2 - 1, Math.floor(f + hash(out.length, 50) * k)); out.push(pts[2 * i], pts[2 * i + 1]); }
  return out;
}
function dust(pts, S) { // the letters' dust: it leaves the crest as it crashes, thrown forward and down with the lip
  const out = [], o = [0, 0, 0, 0];
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); }
  for (let i = 0; i < pts.length; i += 2, id++) {
    const gx = pts[i], gy = pts[i + 1], h = s => hash(id, s), u = 0.55 + 0.45 * h(1) ** 0.7, t0 = 690 + 70 * h(6);
    at(S, u, t0, o);
    const off = (h(2) * 2 - 1) * half(u), ox = o[0] + o[2] * off, oy = o[1] + o[3] * off;
    const ang = -0.35 + 1.55 * h(3), d = 0.8 + 2.4 * h(5), tc = 830 + 270 * c01((gx - x0) / (x1 - x0 || 1)) + 40 * h(4);
    out.push({ kind: 'text', fib: 0, gx, gy, ox, oy, ca: Math.cos(ang) * d, sa: Math.sin(ang) * d, t0, tc, te: Math.min(tc + 300 + 60 * h(7), 1290) }); // on its glyph by the last keyframe
  }
  return out;
}
function dustAt(list, t, out) {
  for (let j = 0; j < list.length; j++) {
    const p = list[j], e = 1 - (1 - c01((t - p.t0) / 380)) ** 3, c = smooth((t - p.tc) / (p.te - p.tc));
    const x = p.ox + p.ca * e, y = p.oy + p.sa * e + 0.3 * e * e;
    out[2 * j] = Math.round(lerp(x, p.gx, c) * Q); out[2 * j + 1] = Math.round(lerp(y, p.gy, c) * Q);
  }
  return out;
}

// turbulence (entry): six travelling waves; a particle's phases are fixed (it follows its sheet), the time part is shared
const FREQ = [0.0021, -0.0033, 0.0052, 0.0027, -0.0041, 0.0058];
const KU = [6.1, 13.7, 27.3, 5.3, 12.1, 25.9], KV = [2.3, -3.1, 6.7, -1.9, 2.7, -5.9], WT = [0.55, 0.3, 0.15, 0.55, 0.3, 0.15];
const PH = [0.4, 1.9, 4.1, 2.2, 0.7, 5.3];
function phases(i, u, v) { // a smooth function of the particle's place on its sheet (neighbours move together), a little grain
  const ph = new Float64Array(12);
  for (let k = 0; k < 6; k++) { const a = PH[k] + KU[k] * u + KV[k] * v + 0.35 * (hash(i, 20 + k) - 0.5); ph[2 * k] = Math.sin(a); ph[2 * k + 1] = Math.cos(a); }
  return ph;
}
const amp = t => 0.36 * bump(t / 1250) ** 0.7 * (1 - smooth((t - 860) / 340)); // how stirred the fluid is (em)
const roll = t => 2.6 * (1 - smooth(t / 1050)) ** 1.2; // how far the billows still have to turn (rad)

function evaluator(S, tb) {
  const o = [0, 0, 0, 0], cs = new Float64Array(12), xy = [0, 0];
  const trig = t => { for (let i = 0; i < 6; i++) { cs[2 * i] = Math.cos(FREQ[i] * t); cs[2 * i + 1] = Math.sin(FREQ[i] * t); } };
  function turb(p, k) { // sin(a + wt) = sin a cos wt + cos a sin wt
    const ph = p.ph;
    xy[0] += k * (WT[0] * (ph[0] * cs[0] + ph[1] * cs[1]) + WT[1] * (ph[2] * cs[2] + ph[3] * cs[3]) + WT[2] * (ph[4] * cs[4] + ph[5] * cs[5]));
    xy[1] += k * (WT[3] * (ph[6] * cs[6] + ph[7] * cs[7]) + WT[4] * (ph[8] * cs[8] + ph[9] * cs[9]) + WT[5] * (ph[10] * cs[10] + ph[11] * cs[11]));
  }
  function foamAt(list, t, out) { // positions (path units) at time t; rest when t >= REST
    trig(t);
    const a = amp(t), rest = t >= REST;
    for (let j = 0; j < list.length; j++) {
      const p = list[j], tt = rest ? END : Math.max(0, t - p.lag * (1 - smooth((t - 800) / 380)));
      at(S, rest ? p.u : p.u - p.flow * (1 - smooth(tt / 1000)), tt, o);
      const off = p.v * p.th * (rest ? 1 : 1 + 0.45 * bump(tt / 1150));
      xy[0] = o[0] + o[2] * off + p.wx; xy[1] = o[1] + o[3] * off + p.wy;
      if (!rest) {
        if (a) turb(p, a * p.ta);
        const f = roll(tt) * p.rg; // the billow turns its particles into place: rotate their offset back by what is left
        if (f) { const c = Math.cos(f) - 1, s = Math.sin(f), da = p.ra * c - p.rb * s, db = p.ra * s + p.rb * c; xy[0] += o[3] * da + o[2] * db; xy[1] += -o[2] * da + o[3] * db; }
      }
      out[2 * j] = Math.round(xy[0] * Q); out[2 * j + 1] = Math.round(xy[1] * Q);
    }
    return out;
  }
  function riding(p, tt) { // a spray particle on the wave at tt (≤ its break)
    at(S, p.u, tt, o);
    const off = p.v * half(p.u) * (1 + 0.45 * bump(tt / 1150));
    xy[0] = o[0] + o[2] * off; xy[1] = o[1] + o[3] * off;
    if (p.ph) turb(p, amp(tt) * p.ta);
  }
  function sprayAt(list, t, out) {
    trig(t);
    for (let j = 0; j < list.length; j++) {
      const p = list[j];
      if (t <= p.td) riding(p, t);
      else { // thrown from where it broke: fast, braking, sagging, then drifting; it never comes to rest on the text
        if (p.bx === undefined) {
          trig(p.td); riding(p, p.td); p.bx = xy[0]; p.by = xy[1]; trig(t);
          const c = Math.cos(p.ang), s = Math.sin(p.ang), ex = p.bx + c * p.dist - s * p.side, ey = p.by + s * p.dist + c * p.side + p.sag;
          const out = 0.15 + 0.7 * hash(j + 7919, 63); // pushed off the text, scattered beyond its edge (not lined up on it)
          p.ny = ex > tb.x0 && ex < tb.x1 && ey > tb.y0 && ey < tb.y1 ? (ey - tb.y0 < tb.y1 - ey ? tb.y0 - out - ey : tb.y1 + out - ey) : 0;
        }
        const e = 1 - (1 - c01((t - p.td) / Math.min(p.dur, END - p.td))) ** 3, c = Math.cos(p.ang), s = Math.sin(p.ang); // at rest by END
        xy[0] = p.bx + (c * p.dist - s * p.side) * e; xy[1] = p.by + (s * p.dist + c * p.side + p.ny) * e + p.sag * e * e;
      }
      out[2 * j] = Math.round(xy[0] * Q); out[2 * j + 1] = Math.round(xy[1] * Q);
    }
    return out;
  }
  return { foamAt, sprayAt };
}


// ---- the hold costs the main thread nothing: the body paths are static from the settled pose, and the motion is transforms
// and opacity on composited SVGs that each hold a region of the same field (the same particles, drawn in separate paths:
// no outlines, no masks): the whole body sways, the curl breathes about the eye, the crest lifts, the dust drifts, and three
// cohorts of spray are carried off the lip along its own direction (CSS). A cohort is drawn once as a stream leaving the
// lip (each particle some way along its own throw), then translated and scaled from the lip.
function puffs(S, n, s0) {
  const out = [], o = [0, 0, 0, 0];
  for (let j = 0; j < n; j++) {
    const h = s => hash(j + s0, s), u = 0.74 + 0.26 * h(1) ** 0.7, v = (h(2) * 2 - 1) * 1.1 * half(u);
    at(S, u, END, o);
    const a = Math.atan2(-o[2], o[3]) + (h(3) - 0.5) * 0.7, d = 0.7 + 1.9 * h(4) ** 1.3, e = 0.45 * h(5) ** 1.5; // along the tangent, a narrow fan, some way out
    out.push({ kind: 'puff', fib: 0, tx: 1, ty: 0, x: o[0] + o[2] * v + Math.cos(a) * d * e, y: o[1] + o[3] * v + Math.sin(a) * d * e + (0.3 + 0.7 * h(6)) * e * e });
  }
  return out;
}

// sub-paths: each from tail to head (a streak), a resting fibre centred on its particle along the flow
const CAP = 0.18 * Q; // a streak is never longer than this (em): fast particles blur a little, they do not hatch
const streaks = (prev, head) => { // the last fifth of the way since the last keyframe (a short shutter) to now
  let d = '';
  for (let k = 0; k < head.length; k += 2) {
    let dx = (head[k] - prev[k]) * 0.22, dy = (head[k + 1] - prev[k + 1]) * 0.22;
    const l = Math.abs(dx) + Math.abs(dy);
    if (l > CAP) { dx *= CAP / l; dy *= CAP / l; }
    dx = Math.round(dx); dy = Math.round(dy);
    d += `M${head[k] - dx} ${head[k + 1] - dy}l${dx} ${dy}`;
  }
  return d;
};
function fibres(list, pos) {
  let d = '';
  for (let j = 0, k = 0; j < list.length; j++, k += 2) {
    const p = list[j], fx = p.fib ? Math.round(p.tx * p.fib * Q) : 0, fy = p.fib ? Math.round(p.ty * p.fib * Q) : 0;
    d += `M${pos[k] - (fx >> 1)} ${pos[k + 1] - (fy >> 1)}l${fx} ${fy}`;
  }
  return d;
}

export default function decorate(card, event, { h, svg }) {
  const fx = h('i.wave-fx');
  card.append(fx);
  if (card.querySelector('.evt-amount')) card.classList.add('wave-money'); // the title sizes for the narrower column (no :has() in CEF 103)
  const name = String(event?.user?.name || event?.type || '');
  const s = [...name].reduce((a, c) => (Math.imul(a, 31) + c.codePointAt(0)) | 0, 7) >>> 0;
  queueMicrotask(() => { if (card.isConnected) build(card, fx, h, svg, s % 9973); });
}

function build(card, fx, h, svg, alertSeed) {
  const t0 = performance.now();
  const fs = parseFloat(getComputedStyle(card).fontSize) || 28;
  const W = card.offsetWidth / fs, H = card.offsetHeight / fs, box = card.getBoundingClientRect();
  const room = { l: box.left / fs, t: box.top / fs, b: (innerHeight - box.bottom) / fs };
  const evt = card.querySelector('.evt'), icon = card.querySelector('.evt-icon'), body = card.querySelector('.evt-body') || evt;
  const off = el => [(evt.offsetLeft + el.offsetLeft) / fs, (evt.offsetTop + el.offsetTop) / fs, el.offsetWidth / fs, el.offsetHeight / fs];
  const [icx, icy, icw, ich] = icon ? off(icon) : [0.5, H / 2 - 0.9, 1.8, 1.8], eye = { x: icx + icw / 2, y: icy + ich / 2, r: icw / 2 };
  const [bx, by, bw, bh] = off(body), tb = { x0: bx - 0.25, y0: by - 0.2, x1: bx + bw + 0.25, y1: by + bh + 0.2 };
  const S = shape(W, H, eye, room);
  const { foamAt, sprayAt } = evaluator(S, tb);
  const ctx = { S, pick: pickers(S, { core: 4.5 }),
    keep: (x, y) => { // the eye stays dark, the text clear
      const de = Math.hypot(x - eye.x, y - eye.y) - eye.r, dx = Math.max(tb.x0 - x, x - tb.x1, 0), dy = Math.max(tb.y0 - y, y - tb.y1, 0);
      return smooth((de - 0.1) / 0.6) * (dx || dy ? smooth(Math.hypot(dx, dy) / 0.35) : 0);
    } };
  seed = alertSeed; id = alertSeed * 101;
  // the body: one field, four weights; each weight drawn in two paths by region of the field (the base and the curl, the
  // crest and the lip; the border dithered), so the regions can move a little apart in the hold
  const region = p => (p.u + 0.06 * (hash(Math.round(p.u * 1e4 + p.v * 977), 3) - 0.5) < 0.42 ? 0 : 1);
  const split = list => [list.filter(p => region(p) === 0), list.filter(p => region(p) === 1)];
  const B = {
    core: split(foam(ctx, 'core', 1450, foam(ctx, 'rim', 150))),
    dense: split(foam(ctx, 'core', 1250)),
    grain: split(tendrils(ctx, 7, lace(ctx, 7, foam(ctx, 'speck', 260)))),
    haze: split(foam(ctx, 'back', 220, foam(ctx, 'smoke', 110))),
  };
  const spray = sprayOf(110, 'base', sprayOf(250, 'lip')), text = dust(glyphs(card, fs, 320), S);
  const cohorts = [0, 1, 2].map(k => puffs(S, 90, 1000 * k + seed));
  const vb = `${-BOX.l * Q} ${-BOX.t * Q} ${Math.round((W + BOX.l + BOX.r) * Q)} ${Math.round((H + BOX.t + BOX.b) * Q)}`;
  const layer = (cls, paths) => svg(`<svg class="${cls}" viewBox="${vb}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`);
  const lists = []; // [kind, list, path] in document order
  const path = (k, list) => { if (!list.length) return ''; const i = lists.push([k, list]) - 1; return `<path class="wave-${k}" data-i="${i}" d=""/>`; };
  const regionPaths = r => Object.entries(B).map(([k, both]) => path(k, both[r])).join('');
  fx.append(
    h('i.wave-body', layer('wave-curl', regionPaths(0)), layer('wave-crest', regionPaths(1))),
    layer('wave-dust', path('spray', spray) + path('text', text)),
    ...cohorts.map((l, k) => layer(`wave-puff wave-p${k}`, `<path class="wave-grain" d="${fibres(l, l.map(p => [Math.round(p.x * Q), Math.round(p.y * Q)]).flat())}"/>`)));
  // the entry: WAAPI `d` keyframes computed once per path; each path's `d` attribute is the settled pose (the hold is static)
  for (const pe of fx.querySelectorAll('[data-i]')) {
    const n = Number(pe.dataset.i), [k, list] = lists[n];
    pe.removeAttribute('data-i');
    const T = { spray: SPRAY_T, text: TEXT_T, dense: DENSE_T }[k] || FOAM_T, fn = k === 'spray' ? sprayAt : k === 'text' ? dustAt : foamAt;
    const pos = T.map(t => fn(list, t, new Int32Array(list.length * 2))), rest = pos[pos.length - 1], a = T[0], b = T[T.length - 1];
    pe.setAttribute('d', fibres(list, rest));
    const [w, o] = WEIGHT[k];
    const frames = T.map((t, i) => {
      const head = pos[i], prev = pos[Math.max(0, i - 1)], d = `path("${i === T.length - 1 ? fibres(list, head) : streaks(prev, head)}")`;
      let len = 0; // mean streak length (sampled, as drawn: capped): a streak is fainter and finer than a dot, its light spread along it
      for (let q = 0; q < head.length; q += 22) len += Math.min(CAP, 0.22 * (Math.abs(head[q] - prev[q]) + Math.abs(head[q + 1] - prev[q + 1])));
      const f = 1 / (1 + len / Math.ceil(head.length / 22) / 9);
      const vis = k === 'spray' ? smooth((t - 200) / 360) : k === 'dense' ? smooth((t - 400) / 150) : 1; // the spray fades in as it rides the surge; the dense sheets with it
      return { offset: (t - a) / (b - a), d, strokeWidth: (w * (0.65 + 0.35 * f)).toFixed(2), ...(k === 'text' ? {} : { opacity: (o * vis * (0.5 + 0.5 * f)).toFixed(3) }) }; // the letters' dust: its CSS fades it
    });
    pe.animate(frames, { duration: b - a, delay: a, easing: 'linear', fill: 'backwards' });
    gust(pe, rest, n);
  }
  // the hold's transforms (CSS): origins at the eye (the curl breathes) and the lip (the spray is carried off along the lip's tangent)
  const fw = W + BOX.l + BOX.r, fh = H + BOX.t + BOX.b, pct = (x, y) => [`${(((x + BOX.l) / fw) * 100).toFixed(2)}%`, `${(((y + BOX.t) / fh) * 100).toFixed(2)}%`];
  const lip = [0, 0, 0, 0];
  at(S, 0.92, END, lip);
  const [ox, oy] = pct(eye.x, eye.y), [lx, ly] = pct(lip[0], lip[1]), ta = Math.atan2(-lip[2], lip[3]); // the lip's tangent
  for (const [k, v] of [['--wave-ox', ox], ['--wave-oy', oy], ['--wave-lx', lx], ['--wave-ly', ly],
    ['--wave-px', `${(2.2 * Math.cos(ta)).toFixed(3)}em`], ['--wave-py', `${(2.2 * Math.sin(ta) + 0.6).toFixed(3)}em`]]) fx.style.setProperty(k, v);
  // the exit (CSS, on .gone): from the settled pose, a gust from the left blows every particle away, the left side first; two
  // keyframes (150 and 450 ms), each particle a streak along its last 30 ms
  function gust(pe, rest, n) {
    const prev = rest.slice();
    for (const [key, tau, sh] of [['--wave-x1', 150, 0.2], ['--wave-x2', 450, 0.1]]) {
      let d = '';
      for (let k = 0; k < rest.length; k += 2) {
        const x = rest[k] / Q, y = rest[k + 1] / Q, h1 = hash(k + n * 9999, 60), h2 = hash(k + n * 9999, 61), dl = 140 * c01((x + BOX.l) / (W + BOX.l));
        const s = c01((tau - dl) / (450 - dl));
        const bx = Math.round((x + (2.2 + 3.6 * h1) * s ** 1.7 + 0.3 * s * Math.sin(3 * y + 7 * s + 6 * h2)) * Q), by = Math.round((y - (0.25 + 1.2 * h2) * s ** 1.4 + 0.25 * s * Math.sin(2.3 * x + 6 * s)) * Q);
        const dx = Math.round((bx - prev[k]) * sh), dy = Math.round((by - prev[k + 1]) * sh);
        d += `M${bx - dx} ${by - dy}l${dx} ${dy}`;
        prev[k] = bx; prev[k + 1] = by;
      }
      pe.style.setProperty(key, `path("${d}")`);
    }
  }
  card.dataset.waveMs = (performance.now() - t0).toFixed(1);
}
