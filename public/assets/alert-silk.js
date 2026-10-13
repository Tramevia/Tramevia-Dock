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

// The swash: silk flowing out of the orb under the title and past it, for the whole alert. It lives in a window (1000 × 480
// units: y −320…160, the ribbon around y 60) stretched under the title, whose ends fade out (a mask, style.css). Each ribbon's
// rest shape is periodic (strip a: period 500, strip b: 400): it is drawn over the window plus one period on its left, and
// a CSS loop slides it right by exactly one period (2.4 s, 1.5 s) while it opens and turns edge-on again (scaleY): the
// picture repeats exactly, so its waves, its folds (where it turns edge-on its threads bunch into a bright line) and their
// colours travel along it forever with no seam. Strip b, narrower and faster, crosses strip a (moiré: the threads shimmer)
// and carries a glint: its colour runs along it (the event colour, cold, a bright band, cold) once per period, so a light
// runs along the silk. Past the title a tail curls up out of it and flutters (its own transform loop). A ribbon is one
// path: threads + hems.
// The entry sweep plays strip a's `d` once (14 keyframes): its head runs out of the orb to the end of the window, the sheet
// behind it broad and lifted over the title, fluttering, then sinking into the rest shape (the strip at its start).
const SW_T = [0, 50, 100, 150, 200, 250, 300, 350, 400, 460, 530, 610, 700, 800];
const STRIPS = [ // P: period, k: threads per period, w: half width, a: wave height, ph: wave phase, f: twist phase (deg), y: centre
  { P: 500, k: 110, w: 56, a: 40, ph: 0.4, f: 80, y: 60 },
  { P: 400, k: 70, w: 30, a: 28, ph: 2.3, f: 200, y: 64 },
];
// a strip's hems at its threads (window x from −P to 1000; strip x = window x + P), at sweep progress q (1: at rest)
function stripHems(st, q) {
  const { P, k, w: W, a, ph, f, y: Y } = st, n = Math.round((k * (1000 + P)) / P) + 1;
  const e = 1 - (1 - q) ** 3, head = 1000 * e, big = 1 - e ** 4; // big: how much of the sweep is left
  const A = new Float64Array(2 * n), B = new Float64Array(2 * n);
  for (let j = 0; j < n; j++) {
    const x0 = -P + (j * P) / k; // its place at rest
    let x = x0, lift = 0, flut = 0, wide = 0, lead = 1;
    if (q < 1 && x0 >= 0) { // in the window, during the sweep: it runs behind the head
      const s = x0 / 1000, gap = head - head * s, front = Math.exp(-gap / 260) * big;
      x = head * s; lift = 150 * front; wide = 140 * front; flut = Math.exp(-gap / 140) * (1 - e * 0.85);
      lead = (1 - big * (1 - c01((1 - s) / 0.1) ** 0.5)) * c01(e / 0.05); // a rounded leading edge; nothing at the start
    }
    const th = (2 * Math.PI * x) / P, phi = f * DEG + th + 2.6 * flut; // one full turn per period: edge-on twice
    const w = (W * (0.8 + 0.2 * Math.sin(th + 1.3)) + wide) * lead;
    const cy = Y + a * Math.sin(th + ph) + 22 * flut * Math.sin((head - x) / 45 + ph) - lift;
    const nx = 0.35 * Math.sin(phi) * w, ny = Math.cos(phi) * w, cx = x + P;
    A[2 * j] = cx + nx; A[2 * j + 1] = cy + ny; B[2 * j] = cx - nx; B[2 * j + 1] = cy - ny;
  }
  return [A, B, n];
}
// a strip as one path: threads (A at j to B at j + 2, a curve through the middle) and both hems; periodic like its points
function stripPath(st, q) {
  const [A, B, n] = stripHems(st, q), R0 = Math.round;
  let d = '';
  for (let j = 0; j < n; j++) {
    const i = Math.min(n - 1, j + 2), m = Math.min(n - 1, j + 1), x = R0(A[2 * j]), y = R0(A[2 * j + 1]);
    const cx = R0(A[2 * m] + B[2 * m] - (A[2 * j] + B[2 * i]) / 2), cy = R0(A[2 * m + 1] + B[2 * m + 1] - (A[2 * j + 1] + B[2 * i + 1]) / 2);
    d += `M${x} ${y}q${cx - x} ${cy - y} ${R0(B[2 * i]) - x} ${R0(B[2 * i + 1]) - y}`;
  }
  for (const H of [A, B]) {
    let x = R0(H[0]), y = R0(H[1]);
    d += `M${x} ${y}l`;
    for (let j = 1; j < n; j++) { const X = R0(H[2 * j]), Y = R0(H[2 * j + 1]); d += `${X - x} ${Y - y} `; x = X; y = Y; }
  }
  return d;
}
// the tail (box 300 × 310: y −150…160, its base at 0, 60 on the ribbon's line): it leaves the ribbon to the right, lifts,
// curls back over and tapers to a point; 10 strands along it that cross where it twists (smoke, like the wisps)
function tailPath() {
  const N = 40, S = 10, pts = [];
  let x = 0, y = 60;
  for (let i = 0; i <= N; i++) {
    const f = i / N, hd = -0.7 * smooth(f / 0.5) - 1.9 * smooth((f - 0.4) / 0.6) ** 1.3; // heading: east, lifting, then up and back over
    // it grows out of the ribbon from a point (no hatched block at its base), swells, and tapers to a point again
    const w = 62 * (0.12 + 0.88 * smooth(f / 0.35)) * (0.8 + 0.5 * Math.sin(Math.PI * Math.min(1, f / 0.7))) * (1 - f) ** 0.7, tw = Math.cos(0.2 + 1.3 * Math.PI * f);
    pts.push([x, y, -Math.sin(hd) * w * tw, Math.cos(hd) * w * tw]);
    x += Math.cos(hd) * 8.5; y += Math.sin(hd) * 8.5;
  }
  let d = '';
  for (let s = 0; s < S; s++) {
    const u = (s + 0.5) / S - 0.5;
    let [px, py] = [Math.round(pts[0][0] + u * pts[0][2]), Math.round(pts[0][1] + u * pts[0][3])];
    d += `M${px} ${py}l`;
    for (const [cx, cy, nx, ny] of pts.slice(1)) { const X = Math.round(cx + u * nx), Y = Math.round(cy + u * ny); d += `${X - px} ${Y - py} `; px = X; py = Y; }
  }
  return d;
}

let uid = 0;
export default function decorate(card, event, { h, svg }) {
  const id = `silk${++uid}`;
  const of = orbFrames(), orbRest = of[of.length - 1];
  const sweep = SW_T.map(t => stripPath(STRIPS[0], c01(t / SW_T[SW_T.length - 1])));
  const stops = (cls, offsets) => offsets.map((o, i) => `<stop class="${cls}${i}" offset="${o}"/>`).join('');
  // the gradients and the bloom live in the first layer's SVG. The orb's runs top to bottom in the layers' space; the
  // swash's too, in the swash's units (so the strips can slide under it, and the tail gets it too): cold at the top, the
  // event colour at the bottom, so the hems swap colours where the ribbon turns over. The bloom: the threads glow in their
  // own colours, the glow's alpha raised to 1.5 and doubled, so a dense fold glows and an open sheet barely hazes
  const defs = `<linearGradient id="${id}-o" gradientUnits="userSpaceOnUse" x1="0" y1="-200" x2="0" y2="105">${stops('silk-o', [0, 0.23, 0.43, 0.61, 0.79])}</linearGradient>
    <linearGradient id="${id}-w" gradientUnits="userSpaceOnUse" x1="0" y1="-150" x2="0" y2="100">${stops('silk-w', [0, 0.5, 0.72, 0.9])}</linearGradient>
    <linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${STRIPS[1].P}" y2="0" spreadMethod="repeat">${stops('silk-g', [0.1, 0.42, 0.5, 0.6])}</linearGradient>
    <filter id="${id}-b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/><feComponentTransfer><feFuncA type="gamma" amplitude="1.9" exponent="1.5"/></feComponentTransfer><feComposite in="SourceGraphic" operator="over"/></filter>`;
  const layers = ['silk-back', 'silk-front', 'silk-rim', 'silk-flame'].map((cls, g) => h(`i.silk-layer.${cls}`,
    svg(`<svg viewBox="-170 -200 340 360" width="0" height="0" filter="url(#${id}-b)" aria-hidden="true">${g ? '' : defs}<path class="silk-r" stroke="url(#${id}-o)" d="${orbRest[g][0]}${orbRest[g][1]}"/></svg>`)));
  const strip = (st, i, g, d) => svg(`<svg class="silk-strip silk-strip-${i}" viewBox="0 -320 ${1000 + st.P} 480" preserveAspectRatio="none" width="0" height="0" aria-hidden="true"><path class="silk-r" stroke="url(#${id}-${g})" d="${d}"/></svg>`);
  const strips = [strip(STRIPS[0], 0, 'w', sweep[sweep.length - 1]), strip(STRIPS[1], 1, 'g', stripPath(STRIPS[1], 1))];
  const tail = svg(`<svg class="silk-tail" viewBox="0 -150 300 310" width="0" height="0" aria-hidden="true"><path class="silk-r" stroke="url(#${id}-w)" d="${tailPath()}"/></svg>`);
  card.querySelector('.evt-icon')?.append(h('i.silk-orb', ...layers)); // its ::after is the small dark core: over the sheets, under the glyph
  card.querySelector('.evt-title')?.append(h('i.silk-swash', ...strips), tail);
  // the entry: every path of the orb replays its keyframes, then strip a sweeps
  const play = (el, frames, times, opts) => el.animate(
    frames.map((d, i) => ({ offset: times[i] / times[times.length - 1], d: `path("${d}")` })), { duration: times[times.length - 1], ...opts });
  layers.forEach((l, g) => play(l.querySelector('path'), of.map(f => f[g][0] + f[g][1]), ORB_T, {}));
  play(strips[0].querySelector('path'), sweep, SW_T, { delay: 520, fill: 'backwards' });
}
