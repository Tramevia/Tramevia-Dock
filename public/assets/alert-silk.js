// Silk style of the alerts overlay (DECOR.silk in alert-card.js).
// silk: a sphere woven of translucent silk sheets holds the event icon. A sheet is a band of very fine threads
// across it (one SVG sub-path each), spaced so you see through it, plus its two hems. A few wide sheets fold over each other
// with open space between them: where a sheet turns edge-on its threads bunch into a bright fold (the folds draw the
// sphere's outline), where two sheets cross they make moiré. Thin wisps leave the top, taper to a point and curl like
// smoke. The sheets whip in on spirals and wrap the icon; then one sheet sweeps across the card and stays as a silk swash
// under the title. The entry replays each path's `d` through keyframes computed here once (WAAPI); at rest the paths are
// static and only a few layers turn (CSS, transform only). Deterministic: no randomness.
const R = 100; // sphere radius, SVG units
const DEG = Math.PI / 180;
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = x => { x = c01(x); return x * x * (3 - 2 * x); };
const out2 = p => 1 - (1 - p) ** 2;

// Sheets. A sheet runs along a great circle of the sphere (local plane z = 0, θ in deg: 0 right, 90 down, 180 left, 270 up),
// tilted by e (deg; 0 = facing us: the limb) and turned by r (deg, in the screen); θ0 → θ1 at rest. w: its width (radii).
// f: [φ0, turns]: its cross-section turning along it (0 = lying on the sphere, 90 = standing out of it, where it sinks in so
// its outer hem stays on the silhouette). sh: the slant of its threads; d: denser threads. t: [delay, travel] ms of its entry; p: the length of
// the spiral it comes in on (rad). g: layer (0 back, 1 front, 2 limb and base, 3 wisps).
// A wisp (fl: its length, radii) continues a short sheet off the top: it turns upward (leaning by lean, rad), sways, curls
// (curl, rad), twists (tw half-turns: its hems cross) and tapers to a point; fw: its width at the base.
// The sheets whip in one per note of the chime (0, 110, 224, 364 ms); the wisps rise last, from close by (short spirals).
const ORB = [
  { g: 0, e: 66, r: 16, a: [200, 340], w: 0.7, f: [15, 0.55], sh: 0.03, t: [60, 640], p: 2.2 }, // behind, dim
  { g: 1, e: 54, r: -34, a: [14, 166], w: 0.62, f: [0, 0.75], sh: -0.03, t: [170, 560], p: 2.2 }, // across the front, diagonally,
  { g: 1, e: 63, r: 126, a: [40, 140], w: 0.4, f: [160, 0.8], sh: 0.03, t: [260, 500], p: 2 }, //   and a narrower one the other way
  { g: 2, e: 14, r: 0, a: [12, 168], w: 0.62, f: [-25, 0.25], sh: 0.03, d: 1.7, t: [0, 640] }, // the base: dense, bright, the event colour
  { g: 2, e: -4, r: 0, a: [100, 236], w: 0.3, f: [0, 1.1], sh: 0.03, t: [110, 680] }, // the limb: edge-on (a crisp line),
  { g: 2, e: 6, r: 0, a: [-82, 70], w: 0.28, f: [0, -1.1], sh: -0.03, t: [224, 600] }, //   twisting open here and there
  { g: 3, e: 10, r: 0, a: [210, 236], w: 0.3, f: [20, 0.3], sh: 0.02, fl: 0.8, lean: -0.3, curl: -1.3, tw: 0.9, fw: 1.5, t: [364, 560], p: 1.1 },
  { g: 3, e: -8, r: 0, a: [244, 264], w: 0.28, f: [60, 0.3], sh: 0.02, fl: 0.95, lean: 0.04, curl: 1.4, tw: 1.1, fw: 1.4, t: [420, 560], p: 1.1 },
  { g: 3, e: 14, r: 0, a: [276, 294], w: 0.28, f: [120, 0.3], sh: 0.02, fl: 0.72, lean: 0.26, curl: 1.2, tw: 0.9, fw: 1.4, t: [470, 520], p: 1 },
  { g: 3, e: -12, r: 0, a: [300, 318], w: 0.26, f: [30, 0.3], sh: 0.02, fl: 0.58, lean: 0.45, curl: -1.1, tw: 0.8, fw: 1.4, t: [500, 520], p: 1 },
];
const DENS = 34; // threads per radian of sheet: about 3.7 px apart at the default text size (style.css: the sphere is 9em)
const GROUPS = 4;
const HEM = 3; // a hem point every 3 threads
const APP = 2.8; // rad: the spiral a sheet comes in on by default (its head starts this far before θ0)
const NF = 40; // points on a wisp's centre line
const ORB_T = [0, 33, 66, 100, 133, 166, 200, 233, 266, 300, 333, 366, 400, 440, 480, 530, 590, 660, 740, 830, 930, 1040];

for (const rb of ORB) {
  const ce = Math.cos(rb.e * DEG), se = Math.sin(rb.e * DEG), cr = Math.cos(rb.r * DEG), sr = Math.sin(rb.r * DEG);
  rb.rot = (x, y, z) => { [y, z] = [y * ce - z * se, y * se + z * ce]; return [x * cr - y * sr, x * sr + y * cr, z]; };
  rb.span = Math.abs(rb.a[1] - rb.a[0]) * DEG;
  rb.k = Math.round(DENS * (rb.span + (rb.fl || 0)) * (rb.d || 1)); // d: denser
  rb.kh = Math.round((rb.k - 1) * (rb.span / (rb.span + (rb.fl || 0)))) + 1; // the threads on the sphere (then the wisp)
  if (rb.fl) rb.F = wispLine(rb);
}

// A wisp's centre line, in the screen (rest geometry): it leaves the end of the sheet along it, turns upward, sways, curls.
function wispLine(rb) {
  const th = rb.a[1] * DEG, dir = Math.sign(rb.a[1] - rb.a[0]);
  const [x1, y1, z1] = rb.rot(R * Math.cos(th), R * Math.sin(th), 0);
  const [x2, y2] = rb.rot(R * Math.cos(th + dir * 0.01), R * Math.sin(th + dir * 0.01), 0);
  const h0 = Math.atan2(y2 - y1, x2 - x1), turn = Math.atan2(Math.sin(-Math.PI / 2 + rb.lean - h0), Math.cos(-Math.PI / 2 + rb.lean - h0));
  const pts = new Float64Array(2 * NF + 2), step = (rb.fl * R) / NF;
  let x = x1, y = y1;
  pts[0] = x; pts[1] = y;
  for (let i = 1; i <= NF; i++) {
    const f = (i - 0.5) / NF;
    const h = h0 + turn * smooth(f / 0.3) + 0.22 * Math.sin(6 * f + rb.a[0]) + rb.curl * smooth((f - 0.35) / 0.65) ** 1.3;
    x += Math.cos(h) * step; y += Math.sin(h) * step;
    pts[2 * i] = x; pts[2 * i + 1] = y;
  }
  return { pts, z1, th };
}

// one sheet at time t (ms): its two hems, k points each, projected (x, y pairs)
function orbHems(rb, t) {
  const [t0] = rb.a, dir = Math.sign(rb.a[1] - t0), span = rb.span, fl = rb.fl || 0, len = span + fl, rot = rb.rot, F = rb.F;
  const q = c01((t - rb.t[0]) / rb.t[1]), e = out2(q);
  // the head runs along the rail (spiral, arc, wisp) from -p to len; the sheet lengthens behind it, wide and twisting in
  // flight, and narrows to its own width as it lands (nothing shows before its delay: no length, no width)
  const head = len - (1 - e) * (len + (rb.p ?? APP)), body = len * c01(4 * e) ** 0.6, spin = 3 * (1 - e) ** 2;
  const open = e ** 0.35 * (1 + 1.8 * (1 - e) ** 2);
  const n = rb.k, A = new Float64Array(2 * n), B = new Float64Array(2 * n);
  const put = (H, j, x, y, z) => { const qz = 600 / (600 - z); H[2 * j] = x * qz; H[2 * j + 1] = y * qz; }; // slight perspective
  for (let j = 0; j < n; j++) {
    const s = j / (n - 1), u = head - (1 - s) * body;
    const phi = rb.f[0] * DEG + rb.f[1] * Math.PI * s + 0.35 * Math.sin(1.6 * Math.PI * s + t0) + spin * (1 - s);
    let hw = 0.5 * R * open * rb.w * (1 + 0.18 * Math.sin(1.7 * Math.PI * s + 2 * t0)) * c01(s / 0.18) ** 0.6; // half width
    const sp = Math.sin(phi), cp = Math.cos(phi);
    if (u > span) { // on the wisp: the cross-section turns to face us, twists (the hems cross) and tapers to a point
      const f = c01((u - span) / fl), i = Math.min(NF - 1, Math.floor(f * NF)), fr = f * NF - i, P = F.pts;
      const dx = P[2 * i + 2] - P[2 * i], dy = P[2 * i + 3] - P[2 * i + 1], dl = Math.hypot(dx, dy) || 1;
      const cx = P[2 * i] + dx * fr, cy = P[2 * i + 1] + dy * fr;
      const [bx, by, bz] = rot(sp * Math.cos(F.th) * hw, sp * Math.sin(F.th) * hw, cp * hw); // as it leaves the sphere
      const k = smooth(f / 0.25), ps = phi + rb.tw * Math.PI * f, tw = hw * rb.fw * (1 - f) ** 0.9 * Math.cos(ps);
      const hx = (1 - k) * bx - k * tw * (dy / dl), hy = (1 - k) * by + k * tw * (dx / dl), hz = (1 - k) * bz;
      put(A, j, cx + hx, cy + hy, F.z1 + hz);
      put(B, j, cx - hx, cy - hy, F.z1 - hz);
    } else { // on the sphere: the hems sit on either side of the circle (β across it), or stand out of it (φ)
      const th = t0 * DEG + dir * u, ct = Math.cos(th), st = Math.sin(th);
      if (!fl) hw *= c01((1 - s) / 0.15) ** 0.6;
      const rho = R * (u < 0 ? 1 + 0.16 * u * u : 1 + 0.03 * Math.sin(2.3 * u + t0)) * (1 + 0.25 * (1 - e) ** 2) - Math.abs(sp) * hw;
      const ra = rho + sp * hw, rr = rho - sp * hw, be = (cp * hw) / R, cb = Math.cos(be), sb = Math.sin(be);
      const [ax, ay, az] = rot(ra * cb * ct, ra * cb * st, ra * sb), [bx, by, bz] = rot(rr * cb * ct, rr * cb * st, -rr * sb);
      put(A, j, ax, ay, az);
      put(B, j, bx, by, bz);
    }
  }
  return [A, B];
}

// A sheet as two path strings: its threads (hem A at j to hem B at j + slant: the slant changes a little along it; each a
// curve through the sheet's middle, so it follows the sheet's bend) and its two hems (a point every HEM threads). Past kh
// the sheet is a wisp: no threads across it, but STRANDS long strands along it, from where it leaves the sphere to its tip,
// at fixed fractions of its width: they converge at the tip and cross where it twists (smoke). Integer coordinates; deltas
// between rounded points (no drift).
const STRANDS_W = 9;
function sheet(A, B, n, sh, ph, out, kh = n) {
  for (let s = 0; s < STRANDS_W && kh < n; s++) {
    const u = (s + 0.5) / STRANDS_W, P = j => [Math.round(A[2 * j] + (B[2 * j] - A[2 * j]) * u), Math.round(A[2 * j + 1] + (B[2 * j + 1] - A[2 * j + 1]) * u)];
    let [x, y] = P(kh - 1);
    out[0] += `M${x} ${y}l`;
    for (let j = kh; j < n; j++) { const [X, Y] = P(j); out[0] += `${X - x} ${Y - y} `; x = X; y = Y; }
  }
  for (let j = 0; j < kh; j++) {
    const i = Math.min(kh - 1, Math.max(0, j + Math.round(n * sh * (0.5 + Math.sin(1.6 * Math.PI * j / n + ph)))));
    const m = (j + i) >> 1, x = Math.round(A[2 * j]), y = Math.round(A[2 * j + 1]);
    const cx = Math.round(A[2 * m] + B[2 * m] - (A[2 * j] + B[2 * i]) / 2);
    const cy = Math.round(A[2 * m + 1] + B[2 * m + 1] - (A[2 * j + 1] + B[2 * i + 1]) / 2);
    out[0] += `M${x} ${y}q${cx - x} ${cy - y} ${Math.round(B[2 * i]) - x} ${Math.round(B[2 * i + 1]) - y}`;
  }
  for (const H of [A, B]) {
    let x = Math.round(H[0]), y = Math.round(H[1]);
    out[1] += `M${x} ${y}l`;
    for (let j = HEM; j < kh + HEM - 1; j += HEM) {
      const k = Math.min(j, kh - 1), X = Math.round(H[2 * k]), Y = Math.round(H[2 * k + 1]);
      out[1] += `${X - x} ${Y - y} `;
      x = X; y = Y;
    }
  }
}

// every keyframe of the orb: per layer, [threads, hems]
const orbFrames = () => ORB_T.map(t => {
  const out = Array.from({ length: GROUPS }, () => ['', '']);
  for (const rb of ORB) { const [A, B] = orbHems(rb, t); sheet(A, B, rb.k, rb.sh, rb.a[0], out[rb.g], rb.kh); }
  return out;
});

// The swash: two strands of thread sheets running under the title (box 1000 × 120 under the title, stretched to its width),
// wide in the middle, folding over irregularly; the right end lifts into a flame tongue. Entry: the sweep. The head runs out
// of the orb to the right end; near it the sheet is broad and lifted over the title (y < 0 is above the box), fluttering,
// so a wide sheet of silk crosses the card and the words appear behind it; behind the head it narrows and sinks into the
// swash, which settles.
const SW_T = [0, 50, 100, 150, 200, 250, 300, 350, 400, 460, 530, 610, 700, 800];
const STRANDS = [ // threads, width, twist turns, twist phase (deg), wave phase, y offset, lag (fraction of the sweep)
  [220, 54, 2.4, 80, 0.4, 0, 0],
  [140, 24, 3.4, 200, 2.2, 6, 0.08],
];
function swashHems(q, [n, wd, turns, f0, ph, dy, lag]) {
  const e = 1 - (1 - c01((q - lag) / (1 - lag))) ** 3, head = 1000 * e, big = 1 - e ** 4; // big: how much of the sweep is left
  const A = new Float64Array(2 * n), B = new Float64Array(2 * n);
  for (let j = 0; j < n; j++) {
    const s = j / (n - 1), x = head * s, gap = head - x; // distance behind the head
    const front = Math.exp(-gap / 260) * big, flut = Math.exp(-gap / 140) * (1 - e * 0.85);
    const curl = c01((x - 840) / 160) ** 2;
    const y = 60 + dy + 9 * Math.sin((x / 1000) * Math.PI * 1.6 + ph) + 22 * flut * Math.sin(gap / 45 + ph) - 150 * front - 70 * curl;
    const phi = f0 * DEG + turns * Math.PI * (x / 1000) + 0.7 * Math.sin(8.2 * (x / 1000) + ph) + 2.6 * flut;
    const lead = 1 - big * (1 - c01((1 - s) / 0.1) ** 0.5); // the head: a rounded leading edge
    const w = (wd * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, x / 900))) * (1 - 0.75 * curl) + 140 * front) * Math.min(1, s * 6) ** 0.7 * lead * c01(e / 0.05);
    const nx = 0.35 * Math.sin(phi) * w, ny = Math.cos(phi) * w, cx = x + 14 * curl;
    A[2 * j] = cx + nx; A[2 * j + 1] = y + ny; B[2 * j] = cx - nx; B[2 * j + 1] = y - ny;
  }
  return [A, B];
}
const swashFrames = () => SW_T.map(t => {
  const out = ['', ''];
  for (const st of STRANDS) { const [A, B] = swashHems(c01(t / SW_T[SW_T.length - 1]), st); sheet(A, B, st[0], 0.03, st[4], out); }
  return out;
});

let uid = 0;
export default function decorate(card, event, { h, svg }) {
  const id = `silk${++uid}`;
  const of = orbFrames(), sf = swashFrames();
  const [orbRest, swRest] = [of[of.length - 1], sf[sf.length - 1]];
  const stops = (cls, offsets) => offsets.map((o, i) => `<stop class="${cls}${i}" offset="${o}"/>`).join('');
  const paths = (g, d) => `<path class="silk-r" stroke="url(#${id}-${g})" d="${d[0]}"/><path class="silk-h" stroke="url(#${id}-${g})" d="${d[1]}"/>`;
  // the gradients (the orb's runs top to bottom in the layers' space, the swash's left to right) and the bloom live in the
  // first layer's SVG. The bloom: the threads glow in their own colours, the glow's alpha raised to 1.5 and doubled, so a
  // dense fold glows and an open sheet barely hazes
  const defs = `<linearGradient id="${id}-o" gradientUnits="userSpaceOnUse" x1="0" y1="-200" x2="0" y2="105">${stops('silk-o', [0, 0.23, 0.43, 0.61, 0.79])}</linearGradient>
    <linearGradient id="${id}-w" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">${stops('silk-w', [0, 0.18, 0.5, 0.85, 1])}</linearGradient>
    <filter id="${id}-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/><feComponentTransfer><feFuncA type="gamma" amplitude="1.9" exponent="1.5"/></feComponentTransfer><feComposite in="SourceGraphic" operator="over"/></filter>`;
  const layers = ['silk-back', 'silk-front', 'silk-rim', 'silk-flame'].map((cls, g) => h(`i.silk-layer.${cls}`,
    svg(`<svg viewBox="-170 -200 340 360" width="0" height="0" filter="url(#${id}-b)" aria-hidden="true">${g ? '' : defs}${paths('o', orbRest[g])}</svg>`)));
  const swash = svg(`<svg class="silk-swash" viewBox="0 0 1000 120" preserveAspectRatio="none" width="0" height="0" aria-hidden="true">${paths('w', swRest)}</svg>`);
  card.querySelector('.evt-icon')?.append(h('i.silk-orb', ...layers, h('i.silk-core'))); // the small dark core: over the sheets, under the glyph
  card.querySelector('.evt-title')?.append(swash);
  // the entry: every path replays its keyframes
  const play = (el, frames, times, k, opts) => el.animate(
    frames.map((f, i) => ({ offset: times[i] / times[times.length - 1], d: `path("${f[k]}")` })), { duration: times[times.length - 1], ...opts });
  layers.forEach((l, g) => l.querySelectorAll('path').forEach((p, k) => play(p, of.map(f => f[g]), ORB_T, k, {})));
  swash.querySelectorAll('path').forEach((p, k) => play(p, sf, SW_T, k, { delay: 520, fill: 'backwards' }));
}
