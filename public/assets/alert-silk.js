// Silk style of the alerts overlay (DECOR.silk in alert-card.js).
// silk: ONE surface. A sphere whose skin is one lat/long mesh, deformed by a smooth field, drawn as translucent silk
// SHEETS: three belts of that sphere (two hatched with its parallels, one with its meridians, so they cross with moiré), lines
// only inside a belt (open black between the sheets), a crease just inside every sheet edge (the lines bunch into a bright
// hem), three flame tongues at the top (a displacement that carries the skin up a curling centreline and pinches it to a
// point: the parallels crossing a tongue's base become its hatching) and the ribbon under the title (a band of parallels
// whose back half-turn is unrolled off the front of the sphere and runs right, twisting and waving, curling into a tail; its
// first points are the band's own sphere points). One frame of the field is the same geometry rendered as 7 paths (the back
// of the skin, its front parallels, its front meridians, the three tongues, the ribbon), each movable part in its own
// composited layer nested in the body's. The entry (the sheets slide round their own axes while the whole skin shrinks in
// and closes, the tongues grow, the ribbon runs out) is `d` keyframes computed once per page into a constructed stylesheet
// (one-shot CSS animations, nothing per alert); the hold is transforms of the layers only (style.css). No randomness.
const R = 1260; // sphere radius in path units (a tenth of a px at the default text size: the sphere is 9em = 252 px)
const DEG = Math.PI / 180, TAU = 2 * Math.PI;
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = c01(x); return x * x * (3 - 2 * x); };
const bump = x => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const out3 = p => 1 - (1 - p) ** 3;
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };

const NP = 96, NU = 60, NM = 150, NV = 44; // parallels and their samples, meridians and theirs (lines ~4 px apart at the front)
const TILT = [-20 * DEG, 10 * DEG]; // the axis: tipped away from the viewer, then turned in the screen
const BAND = [-Math.PI / 2 + (Math.PI * 57.5) / NP, 0.25]; // the ribbon's band: centre latitude (a midpoint between two parallels: its lines are symmetric about the ribbon's axis), half width (rad)
const RIB = { L: Math.PI, len: 4 * R, tail: 1.3 * R, lam: 2.2 * R, amp: 0.26 * R, n: 110 }; // the band's half turn unrolled: along the exit's height
const T0 = 1300, LOOP = 4800; // entry length; the field's time base
const ENTRY_T = [0, 33, 66, 100, 133, 166, 200, 233, 266, 300, 350, 400, 460, 530, 600, 680, 770, 870, 980, 1100, 1300];
// the sheets: a belt of the sphere round axis d (|n·d − c| < hw), hatched by one family (0 parallels, 1 meridians); its
// entry: it slides round its own axis by `slide` (rad) while it lands, its head (angle 0 round d) first, over t = [delay, travel]
const SHEETS = [
  { d: norm([0.6, 0.5, 0.62]), c: 0.15, hw: 0.3, fam: 0, t: [0, 720], slide: 2.6 }, // the broad diagonal sash
  { d: norm([-0.7, 0.3, 0.65]), c: -0.1, hw: 0.24, fam: 1, t: [140, 680], slide: -2.3 }, // the crossing sheet (meridians)
  { d: norm([0.3, 0.75, 0.6]), c: 0.72, hw: 0.3, fam: 0, t: [60, 640], slide: 1.9 }, // the base: a cap at the lower front (it holds the ribbon's exit), the event colour
];
const EL = 0.35; // the tongues' bases lean toward the viewer (rad)
const TONGUES = [ // screen angle from the top (deg), height (R), lean and curl (rad), base radius (chord, R), pinch, phase
  { g: -40, A: 0.95, lean: -0.3, curl: -1.1, w: 0.2, pinch: 0.85, ph: 0 }, // a thin wisp
  { g: -5, A: 1.5, lean: 0.05, curl: 0.9, w: 0.32, pinch: 0.66, ph: 2 }, // the tall tongue
  { g: 31, A: 1.15, lean: 0.4, curl: 1.15, w: 0.25, pinch: 0.74, ph: 4 },
].map(t => ({ ...t, c: [Math.sin(t.g * DEG) * Math.cos(EL), -Math.cos(t.g * DEG) * Math.cos(EL), Math.sin(EL)] }));
for (const S of SHEETS) { const a = Math.abs(S.d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; S.e1 = norm([a[1] * S.d[2] - a[2] * S.d[1], a[2] * S.d[0] - a[0] * S.d[2], a[0] * S.d[1] - a[1] * S.d[0]]); S.e2 = [S.d[1] * S.e1[2] - S.d[2] * S.e1[1], S.d[2] * S.e1[0] - S.d[0] * S.e1[2], S.d[0] * S.e1[1] - S.d[1] * S.e1[0]]; }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const belt = (S, n) => S.hw - Math.abs(dot(n, S.d) - S.c); // > 0 inside the sheet
const tongueAt = n => { let m = 0; for (const t of TONGUES) m = Math.max(m, 1 - Math.hypot(n[0] - t.c[0], n[1] - t.c[1], n[2] - t.c[2]) / t.w); return m; };
const tongueOf = n => { let k = -1, m = 0; TONGUES.forEach((t, i) => { const d = 1 - Math.hypot(n[0] - t.c[0], n[1] - t.c[1], n[2] - t.c[2]) / t.w; if (d > m) { m = d; k = i; } }); return k; };

// ---- the mesh (once): every drawn sample's rest normal, its sheet (for the entry), its crease and its path / run
const [ca, sa, cb, sb] = [Math.cos(TILT[0]), Math.sin(TILT[0]), Math.cos(TILT[1]), Math.sin(TILT[1])];
const unit = (u, v) => { // the tilted unit sphere (x right, y down, z toward the viewer)
  let x = Math.cos(v) * Math.cos(u), y = -Math.sin(v), z = Math.cos(v) * Math.sin(u);
  [y, z] = [y * ca - z * sa, y * sa + z * ca];
  return [x * cb - y * sb, x * sb + y * cb, z];
};
let MESH = null;
function mesh() {
  if (MESH) return MESH;
  let up = 0, best = -1; // the exit: the lowest screen point of the band's centre parallel; the ribbon leaves it heading right
  for (let i = 0; i < 720; i++) { const y = unit((i * TAU) / 720, BAND[0])[1]; if (y > best) { best = y; up = (i * TAU) / 720; } }
  const sigma = unit(up + 0.01, BAND[0])[0] > unit(up, BAND[0])[0] ? 1 : -1;
  const pts = [], lines = [], rib = []; // sphere samples { n, sh, al, cr }; runs { path, from, to }; ribbon samples { l, v, a }
  // a sample: drawn by this family if it lies in one of the family's sheets (or, for parallels, on a tongue's base); its
  // sheet for the entry is the belt it is deepest in; its crease peaks just inside the sheet's edge
  const sample = (N, fam) => {
    let sh = -1, deep = -1e9;
    for (let k = 0; k < SHEETS.length; k++) { const b = belt(SHEETS[k], N); if (b > deep) { deep = b; sh = k; } }
    const tm = fam === 0 ? tongueAt(N) : 0;
    const famIn = SHEETS.some((S, k) => S.fam === fam && belt(S, N) > 0);
    if (!(famIn || tm > 0) || (fam === 1 && tongueAt(N) > 0)) return null;
    const S = SHEETS[sh], al = (Math.atan2(dot(N, S.e2), dot(N, S.e1)) + Math.PI) / TAU;
    return { n: N, sh, al, cr: famIn ? bump(deep / 0.14) : 0 };
  };
  const emit = (cand, fam, pathOf) => { // runs of consecutive drawn samples of one path and one sheet (a sheet flies in as a unit)
    let run = null;
    for (const N of cand) {
      const p = N && sample(N, fam), path = p ? pathOf(N) : -1;
      const prev = run && pts[pts.length - 1];
      if (!p || !run || run.path !== path || run.sh !== p.sh || Math.abs(prev.al - p.al) > 0.5) { if (run) run.to = pts.length; run = p ? { path, sh: p.sh, from: pts.length } : null; if (run) lines.push(run); } // also where the belt angle wraps: the two sides land at different times
      if (p) pts.push(p);
    }
    if (run) run.to = pts.length;
  };
  const front = N => { const k = tongueOf(N); return k >= 0 ? 3 + k : N[2] > -0.3 ? 1 : 0; }; // 0 back, 1 front parallels, 2 front meridians, 3-5 the tongues, 6 ribbon
  for (let j = 0; j < NP; j++) { // the parallels, bunching into denser sheets with sparser gaps (the band's keep their even spacing)
    const v0 = -Math.PI / 2 + (Math.PI * (j + 0.5)) / NP, band = Math.abs(v0 - BAND[0]) < BAND[1], v = band ? v0 : v0 + 0.09 * Math.sin(6 * v0 + 1) * Math.cos(v0);
    const s0 = band ? RIB.L : 0, n = band ? Math.round((NU * (TAU - RIB.L)) / TAU) : NU; // a band parallel skips its ribbon half
    const cand = []; // the samples: every base step, three times denser where this parallel crosses a tongue's base
    for (let i = 0; i <= 9 * n; i++) {
      const s = s0 + ((TAU - s0) * i) / (9 * n), N = unit(up + sigma * s, v);
      if (i % 9 === 0 || (i % 3 === 0 && N[1] < -0.2 && tongueAt(N) > -0.15)) cand.push(N);
    }
    emit(cand, 0, front);
    if (!band) continue;
    const last = pts[pts.length - 1];
    if (!last || Math.abs(dot(last.n, cand[cand.length - 1]) - 1) > 1e-6) continue; // its end is not drawn: no ribbon from it
    const a = pts.length - 1, from = rib.length; // the ribbon: this parallel's half turn, from its anchor outward
    for (let i = 0; i <= RIB.n; i++) rib.push({ l: (RIB.len * i) / RIB.n, v, a });
    lines.push({ path: 6, from, to: rib.length });
  }
  for (let k = 0; k < NM; k++) { // the meridians: the crossing sheet's hatching
    const u = up + (sigma * (k + 0.5) * TAU) / NM, cand = [];
    for (let i = 0; i <= NV; i++) cand.push(unit(u, -Math.PI / 2 + (Math.PI * i) / NV));
    emit(cand, 1, N => (N[2] > -0.3 ? 2 : 0));
  }
  // the ribbon's frame at the exit: across = d/dv of the sphere there, so the flat ribbon starts in the band's own plane
  const e0 = unit(up, BAND[0] - 0.005), e1 = unit(up, BAND[0] + 0.005), A = [e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]], al = Math.hypot(...A);
  return (MESH = { pts, lines: lines.filter(l => l.to - l.from > 1), rib, up, sigma, exitPsi: Math.atan2(A[2] / al, -A[1] / al) }); // a one-point run would be "M x y l": a parse error
}

// ---- the field at time τ (ms): folds, tongues, the ribbon's wave; the entry (by t, ms) slides the sheets in
const fold = (x, y, z, w) => 0.1 * Math.sin(2.3 * x + 1.6 * y + 0.9 * z + w + 0.3) * Math.sin(1.7 * z - 1.2 * y + 2.1 * x + 1.1)
  + 0.07 * Math.sin(3.3 * y + 2.1 * z - 2 * w + 0.6) + 0.09 * Math.tanh(2.2 * Math.sin(2.6 * x - 1.9 * z + 1.3 * y + w + 2))
  + 0.045 * Math.sin(4.4 * x + 3.1 * y - 2 * w);
function tongueTables(w) { // each tongue's centreline (24 steps) at this time: it breathes, leans, curls and wavers like smoke
  return TONGUES.map(t => {
    const H = t.A * R * (1 + 0.12 * Math.sin(2 * w + t.ph)), lean = t.lean + 0.15 * Math.sin(3 * w + t.ph), curl = t.curl * (1 + 0.2 * Math.sin(2 * w + t.ph + 1));
    const th0 = Math.atan2(t.c[1], t.c[0]), out = [0, 0, 0];
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 24; i++) {
      const s = (i + 0.5) / 24, th = th0 + lean * smooth(s / 0.35) + curl * smooth((s - 0.3) / 0.7) ** 1.4 + 0.22 * Math.sin(7 * s + 2 * w + t.ph) * smooth(s / 0.3), k = 1 - smooth(s / 0.4);
      x += (Math.cos(th) * H) / 24; y += (Math.sin(th) * H) / 24; z += (t.c[2] * k * H) / 24;
      out.push(x, y, z);
    }
    return out;
  });
}
function ribbonTable(w, ex) { // the ribbon's centreline from the exit point ex: rises to its height, waves, curls into a tail
  const N = 100, C = new Float64Array(3 * (N + 1)), lt = RIB.len - RIB.tail, cT = (RIB.lam * w) / TAU; // the wave travels one λ per 2.4 s
  const body = l => ex[1] + RIB.amp * smooth(l / (1.2 * R)) * Math.sin((TAU * (l - cT)) / RIB.lam + 0.4); // level with the exit: the hold flips it about that line
  const curl = 2 + 0.5 * Math.sin(3 * w);
  let x = ex[0], y = ex[1], h = 0;
  for (let i = 0; i <= N; i++) {
    const l = (RIB.len * i) / N;
    if (l <= lt) { x = ex[0] + l * 0.98; y = body(l); h = Math.atan2(body(l + 1) - body(l - 1), 1.96); }
    else { h -= (curl * (RIB.len / N)) / RIB.tail * 1.2 * ((l - lt) / RIB.tail) ** 0.2; x += Math.cos(h) * (RIB.len / N); y += Math.sin(h) * (RIB.len / N); }
    C[3 * i] = x; C[3 * i + 1] = y; C[3 * i + 2] = h;
  }
  return C;
}
const lerpT = (T, k, f) => { const i = Math.min(Math.floor(f * (T.length / k - 1)), T.length / k - 2), q = f * (T.length / k - 1) - i, o = []; for (let m = 0; m < k; m++) o.push(T[k * i + m] + (T[k * i + k + m] - T[k * i + m]) * q); return o; };
const rotAxis = (p, d, a) => { // p turned by a round the unit axis d (Rodrigues)
  const c = Math.cos(a), s = Math.sin(a), k = dot(d, p) * (1 - c);
  return [p[0] * c + (d[1] * p[2] - d[2] * p[1]) * s + d[0] * k, p[1] * c + (d[2] * p[0] - d[0] * p[2]) * s + d[1] * k, p[2] * c + (d[0] * p[1] - d[1] * p[0]) * s + d[2] * k];
};

// every sample's projected position at (τ, t): [X, Y] of the sphere samples, then the ribbon's
function place(tau, t) {
  const M = mesh(), w = (TAU * tau) / LOOP, TT = tongueTables(w), fa = out3(c01((t - 560) / 450)) * (1 + 0.25 * bump((t - 620) / 500));
  const n = M.pts.length, X = new Float64Array(n + M.rib.length), Y = new Float64Array(n + M.rib.length), Z = new Float64Array(n);
  const proj = (k, x, y, z) => { const q = (6 * R) / (6 * R - z); X[k] = x * q; Y[k] = y * q; };
  for (let k = 0; k < n; k++) {
    const p = M.pts[k], [nx, ny, nz] = p.n;
    let x = nx, y = ny, z = nz;
    const rho = R * (1 + fold(nx, ny, nz, w) - 0.07 * p.cr); // the crease: a groove just inside the sheet's edge
    x *= rho; y *= rho; z *= rho;
    if (fa > 0 && ny < -0.2) for (let i = 0; i < TONGUES.length; i++) { // a tongue carries the skin up its centreline
      const T = TONGUES[i], c = T.c, d = Math.hypot(nx - c[0], ny - c[1], nz - c[2]);
      if (d < T.w) { // a plateau: every line crossing the base runs up to the tip, a flat fan: its depth pinched away, its width converging
        const m = 1 - (d / T.w) ** 2.4, [gx, gy, gz] = lerpT(TT[i], 3, m), pull = T.pinch * m * fa;
        x += gx * fa - (x - R * c[0]) * pull; y += gy * fa - (y - R * c[1]) * pull; z += gz * fa - (z - R * c[2]) * 0.95 * m * fa;
      }
    }
    if (t < T0) { // the entry: the sample's sheet slides round its own axis, its head first, while the whole skin shrinks in and turns
      const S = SHEETS[p.sh], e = out3(c01((t - S.t[0] - 0.45 * S.t[1] * p.al) / S.t[1]));
      if (e < 1) {
        const g = 1 - e, q = rotAxis(rotAxis([x, y, z], S.d, S.slide * g), [0, 0, 1], 1.1 * g), sc = 1 + 1.4 * g;
        x = q[0] * sc; y = q[1] * sc; z = q[2] * sc;
      }
    }
    Z[k] = z; proj(k, x, y, z);
  }
  // the ribbon: from the exit (the deformed sphere at the band's centre, where its lines leave) along the centreline
  const ex = (() => { const [nx, ny, nz] = unit(M.up, BAND[0]), r = R * (1 + fold(nx, ny, nz, w)); return [nx * r, ny * r, nz * r]; })();
  const C = ribbonTable(w, ex), cT = (RIB.lam * w) / TAU, prog = c01((t - 450) / 850); // how far the run out of the orb has got
  for (let k = 0; k < M.rib.length; k++) {
    const p = M.rib[k], f = p.l / RIB.len, [cx, cy, h] = lerpT(C, 3, f), ka = smooth(p.l / (0.6 * R));
    const psi = M.exitPsi * (1 - ka) + ka * ((TAU * (p.l - cT)) / RIB.lam + 1.2), taper = (1 - smooth((p.l - (RIB.len - 1.1 * RIB.tail)) / (1.1 * RIB.tail))) ** 0.8;
    const o = (p.v - BAND[0]) * R * (1 + 0.15 * smooth(p.l / R)) * taper, ox = Math.cos(psi) * o * Math.sin(h), oy = -Math.cos(psi) * o * Math.cos(h), oz = Math.sin(psi) * o;
    const a = p.a, ax = M.pts[a].n, ar = R * (1 + fold(ax[0], ax[1], ax[2], w)); // this line's own sphere point: the ribbon starts exactly there
    const kb = smooth(p.l / (0.5 * R)), dx = ax[0] * ar - ex[0], dy = ax[1] * ar - ex[1], dz = ax[2] * ar - ex[2];
    let x = cx + dx * (1 - kb) + ox * kb, y = cy + dy * (1 - kb) + oy * kb, z = (dz * (1 - kb) + oz * kb) * (1 - 0.5 * smooth(f / 0.3));
    if (t < T0) { // the entry: it runs out of the band's end (wherever that is now), tangent to the skin at first, lifted further out
      const e = out3(c01((t - 450 - 550 * f) / 300));
      const q = (6 * R) / (6 * R - Z[a]), sx = X[a] / q, sy = Y[a] / q;
      x = sx + (x - sx) * e; y = sy + (y - sy) * e - 0.35 * R * bump(e) * f * prog; z = Z[a] + (z - Z[a]) * e;
    }
    proj(n + k, x, y, z);
  }
  return [X, Y];
}
// one frame as 7 path strings (integer units, deltas): every run is "M x y l dx dy …", the same commands in every frame
function frame(tau, t) {
  const M = mesh(), [X, Y] = place(tau, t), n = M.pts.length, d = ['', '', '', '', '', '', ''];
  for (const run of M.lines) {
    const off = run.path === 6 ? n : 0;
    let x = Math.round(X[off + run.from]), y = Math.round(Y[off + run.from]), s = `M${x} ${y}l`;
    for (let k = run.from + 1; k < run.to; k++) { const nx = Math.round(X[off + k]), ny = Math.round(Y[off + k]); s += `${nx - x} ${ny - y} `; x = nx; y = ny; }
    d[run.path] += s;
  }
  return d;
}

// ---- the keyframes, once per page: the entry (21 frames to 1.3 s) of each path; the last frame is the settled pose
let SKIN = null;
function skin() {
  if (SKIN) return SKIN;
  const t0 = performance.now();
  const entry = ENTRY_T.map(t => frame(t, t));
  let css = '';
  for (let p = 0; p < 7; p++) css += `@keyframes silk-in-${p}{${ENTRY_T.map((t, i) => `${((100 * t) / T0).toFixed(3)}%{d:path("${entry[i][p]}")}`).join('')}}`;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  return (SKIN = { rest: entry[entry.length - 1], ms: performance.now() - t0, bytes: css.length });
}

let uid = 0;
export default function decorate(card, event, { h, svg }) {
  const id = `silk${++uid}`, { rest } = skin(), M = mesh();
  const ex = unit(M.up, BAND[0]);
  const stops = [0, 0.26, 0.46, 0.64, 0.84].map((o, i) => `<stop class="silk-o${i}" offset="${o}"/>`).join('');
  // one gradient for the whole skin, top to bottom (the tongues' tips fade out); the bloom: the lines glow in their own
  // colours, the glow's alpha raised to 1.5 and doubled, so a dense hem glows and an open face barely hazes
  // every part is one SVG of the same view box in its own layer, nested in the body's: the body sways, each tongue wavers
  // about its base, the ribbon flaps about its exit line, and all of it moves with the body (transforms only: the hold
  // never touches the main thread). The gradient and the bloom are defined once, in the body's SVG
  const part = (paths, defs = '') => svg(`<svg class="silk-skin" viewBox="${-1.5 * R} ${-2.5 * R} ${7 * R} ${3.95 * R}" width="0" height="0" aria-hidden="true">${defs}<g filter="url(#${id}-b)" stroke="url(#${id}-o)">${paths.map(p => `<path class="silk-p silk-p${p}" d="${rest[p]}"/>`).join('')}</g></svg>`);
  const defs = `<defs><linearGradient id="${id}-o" gradientUnits="userSpaceOnUse" x1="0" y1="${-2.4 * R}" x2="0" y2="${R}">${stops}</linearGradient>
    <filter id="${id}-b" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="32"/><feComponentTransfer><feFuncA type="gamma" amplitude="1.9" exponent="1.5"/></feComponentTransfer><feComposite in="SourceGraphic" operator="over"/></filter></defs>`;
  const at = (x, y) => `${(50 + 50 * x).toFixed(1)}% ${(50 + 50 * y).toFixed(1)}%`; // a point of the unit sphere as a transform origin of the icon box
  const tongues = TONGUES.map((t, k) => h(`i.silk-layer.silk-tongue.silk-t${k}`, { style: { 'transform-origin': at(t.c[0], t.c[1]) } }, part([3 + k])));
  const rib = h('i.silk-layer.silk-rib', { style: { 'transform-origin': at(ex[0], ex[1]) } }, part([6]));
  rib.firstChild.style.setProperty('transform-origin', at(ex[0], ex[1])); // the exit: the ribbon whips back into it (on the SVG: it composes with the flap)
  card.querySelector('.evt-icon')?.append(h('i.silk-orb', h('i.silk-glow'), h('i.silk-layer.silk-body', part([0, 1, 2], defs), ...tongues, rib))); // .silk-orb::after is the small dark core: over the skin, under the glyph
}
