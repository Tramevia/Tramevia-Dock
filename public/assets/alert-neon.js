// Neon style of the alerts overlay (DECOR.neon in alert-card.js).
// neon: the user's name in chunky extruded letters on a turning ring, chrome lit by neon (after ref F).
// The ring is cut into flat facets (one glyph each for a short name, a few for a long one; the copy that faces the camera
// is cut finer than the ones behind), set around the ring's axis in CSS 3D. A facet is three layers of the same text: the
// chrome face, a lit rim just behind it and the back face; the rim's text-shadows step back to mid-depth and the back
// face's step forward to it, so together they draw the extruded wall (one step's offset, in the facet's own plane, is
// computed here for the rest view). The name goes round twice (more for a short one) with stars between the copies: the
// ring is as small as it can be while the copy in front still faces the camera (its end letters within LIMIT), an oval
// when that is smaller.
// A long name splits at a seam (aB, a1, _ . -) into two rows: a stack of two rings, a turning drum.
// Geometry is in em of the ring font (the CSS sizes the stage from --neon-wd / --neon-h).
// The hero: the name again, flat and big under the ring (the ring's ends curl away), as a neon sign: one line, or two at
// that same seam when the source is narrow (the CSS sizes it from --neon-nw / --neon-np).
const FONT = '900 100px Impact, "Bahnschrift Condensed", "Arial Narrow", sans-serif';
const HERO = '400 100px Impact, "Bahnschrift Condensed", "Arial Narrow", sans-serif', HTRACK = 0.02; // the hero's font and tracking, as in the CSS
const PICTO = /\p{Extended_Pictographic}/u;
const SEAM = /(?<=\p{Ll})(?=\p{Lu}|\d)|(?<=[_.\-\s])(?=[^_.\-\s])/u; // where a name may split into two rows
const SEP = '✦';
const ZWSP = '\u200b'; // zero-width space: a line may break here
const TRACK = 0.06; // letter spacing (em), as in the CSS: a gap where the walls show between letters
const TILT = 28, ROLL = -10; // rest view (deg), as in the CSS (.neon-tilt)
const SY1 = 2.3, SY2 = 1.75; // the letters' stretch (--neon-sy): one ring, a two-row drum (whose row pitch follows)
const DEPTH = 0.36, STEPS = 5; // extrusion (CSS: face at +0.06em, back at -0.30em of the facet); wall steps per half
const LIMIT = 56; // deg: the end letters of the copy in front face the camera within this, at rest
const N = 360; // arc-length table resolution
const RAD = Math.PI / 180;
let ctx;
// The neon light on a facet, by the way it faces at rest (0 = the camera): the lights round the ring, mixed between the
// two nearest (--g), and the nearest alone (--gp, for browsers without color-mix).
const LIGHTS = [[-180, 'hot'], [-125, 'vio'], [-65, 'cold'], [0, 'key'], [55, 'pink'], [110, 'warm'], [180, 'hot']];
const light = a => {
  const i = LIGHTS.findIndex(l => l[0] >= a) || 1, [a0, l0] = LIGHTS[i - 1], [a1, l1] = LIGHTS[i], p = (a1 - a) / (a1 - a0);
  return { '--g': `color-mix(in srgb, var(--neon-${l0}) ${(p * 100).toFixed(0)}%, var(--neon-${l1}))`, '--gp': `var(--neon-${p > 0.5 ? l0 : l1})` };
};
// An ellipse x = e sin t, z = cos t: its arc length from t = 0, sampled over a turn.
const table = e => {
  const arc = [0];
  for (let i = 1; i <= N; i++) {
    const t0 = (i - 1) / N * 2 * Math.PI, t1 = i / N * 2 * Math.PI;
    arc.push(arc[i - 1] + Math.hypot(e * (Math.sin(t1) - Math.sin(t0)), Math.cos(t1) - Math.cos(t0)));
  }
  return arc;
};

export default function decorate(card, event, { h }) {
  const user = card.querySelector('.evt-user');
  const raw = (user || card.querySelector('.evt-title')).textContent.trim();
  if (!user) card.classList.add('neon-anon'); // no name (a stream event): the title itself goes on the ring
  ctx ||= document.createElement('canvas').getContext('2d');
  ctx.font = FONT;
  const adv = g => ctx.measureText(g).width / 100 + TRACK;
  const glyphs = t => [...new Intl.Segmenter().segment(t.toUpperCase())].map(s => [s.segment, adv(s.segment)]);
  const width = gs => gs.reduce((s, g) => s + g[1], 0);
  // The seam that splits the name most evenly (each part at least a third of it): the ring's two rows (a long name), the
  // hero's line break.
  const total = width(glyphs(raw)), parts = raw.split(SEAM);
  let best = null;
  for (let i = 1; i < parts.length; i++) {
    const cut = parts.slice(0, i).join('').length, wa = width(glyphs(raw.slice(0, cut).trim()));
    if (Math.min(wa, total - wa) >= total / 3 && (!best || Math.abs(2 * wa - total) < best.d)) best = { d: Math.abs(2 * wa - total), cut };
  }
  const lines = best && total > 8.5 ? [raw.slice(0, best.cut).trim(), raw.slice(best.cut).trim()] : [raw];
  const rows = lines.map(glyphs);
  const SY = rows.length > 1 ? SY2 : SY1, ROW = 0.81 * SY + 0.3;
  const lineW = Math.max(...rows.map(width));
  const copies = Math.max(2, Math.round(16 / (Math.max(...rows.map(r => r.length)) + 1)));
  const sepMin = adv(SEP) + 0.12;
  // How far the end letters' centres are from the name's centre, along the ring.
  const reach = Math.max(...rows.map(r => width(r) / 2 - Math.min(r[0][1], r[r.length - 1][1]) / 2));
  // The smallest ring (width A = e B) that fits the copies and keeps the end letters within LIMIT: a circle or an oval.
  let ring;
  for (const e of [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2]) {
    const arc = table(e), tl = Math.atan(e * Math.tan(LIMIT * RAD)), f = tl / (2 * Math.PI) * N, i = Math.floor(f);
    const B = Math.max(reach / (arc[i] + (arc[i + 1] - arc[i]) * (f - i)), copies * (lineW + sepMin) / arc[N]);
    if (!ring || e * B < ring.e * ring.B - 1e-6) ring = { e, B, arc };
  }
  const { e, B, arc } = ring, A = e * B, C = arc[N] * B;
  const at = s => { // the parameter t at arc length s (front = 0)
    const u = ((s % C) + C) % C / B;
    let i = 1; while (arc[i] < u) i++;
    return (i - 1 + (u - arc[i - 1]) / (arc[i] - arc[i - 1])) / N * 2 * Math.PI;
  };
  // The rest camera: tilt then roll (the CSS: rotateZ(ROLL) rotateX(-TILT)), perspective P from the ring's centre.
  const P = 4 * A, ct = Math.cos(-TILT * RAD), st = Math.sin(-TILT * RAD), cr = Math.cos(ROLL * RAD), sr = Math.sin(ROLL * RAD);
  const turn = ([x, y, z]) => { const y1 = y * ct - z * st; return [x * cr - y1 * sr, x * sr + y1 * cr, y * st + z * ct]; };
  const view = p => { const [x, y, z] = turn(p), k = P / (P - z); return [x * k, y * k]; };
  // The wall: half the extrusion as a 2D offset in the facet's own plane that looks the same from the rest camera
  // (orthographic: stable up to edge-on; the rim's shadows go back by it, the back face's come forward by it).
  const wall = a => {
    const s = Math.sin(a), co = Math.cos(a), D = turn([-DEPTH / 2 * s, 0, -DEPTH / 2 * co]), X = turn([co, 0, -s]), Y = turn([0, SY, 0]);
    const det = X[0] * Y[1] - X[1] * Y[0];
    let u = (D[0] * Y[1] - D[1] * Y[0]) / det, v = (X[0] * D[1] - X[1] * D[0]) / det;
    const m = Math.hypot(u, v);
    if (!(m <= 0.45)) [u, v] = Number.isFinite(m) ? [u * 0.45 / m, v * 0.45 / m] : [0, 0]; // near edge-on: a sliver anyway
    return { '--eu': (u / STEPS).toFixed(4), '--ev': (v / STEPS).toFixed(4) };
  };
  // Facets: the copy in front is cut into at most 12 / rows runs, the copies behind coarser: about 30 in all.
  const boxes = []; // [x, y, z, facing, width] of every facet, for the stage size
  const budget = rows.length > 1 ? 16 : 30;
  const spins = rows.map((row, r) => {
    const rw = width(row), gap = C / copies - rw; // the stars fill the rest of a copy's share of the ring
    const stars = Math.max(1, Math.round(gap / 1.1));
    const front = Math.ceil(row.length / Math.min(row.length, Math.floor(12 / rows.length)));
    const frontCount = Math.ceil(row.length / front);
    const back = Math.ceil(row.length / Math.max(1, Math.floor((budget - frontCount - copies * stars) / (copies - 1))));
    const ry = (r - (rows.length - 1) / 2) * ROW;
    const facets = [];
    let s = 0;
    const facet = (txt, w) => {
      const t = at(s + w / 2 - rw / 2); // facet centre; 0 = the name's centre (front)
      const a = Math.atan2(B * Math.sin(t), A * Math.cos(t)); // the way it faces
      const c = [A * Math.sin(t), ry, B * Math.cos(t)];
      boxes.push([...c, a, w]);
      facets.push(h('i.neon-f', {
        class: PICTO.test(txt) ? 'neon-pic' : undefined,
        attrs: { 'data-t': txt },
        style: {
          '--px': c[0].toFixed(3), '--pz': c[2].toFixed(3), '--a': (a / RAD).toFixed(2), ...light(a / RAD), ...wall(a),
          '--w': w.toFixed(3), '--x': ((a / RAD + 180) / 360 * C - w / 2).toFixed(3),
        },
      }, txt));
      s += w;
    };
    for (let k = 0; k < copies; k++) {
      const per = k ? back : front;
      for (let i = 0; i < row.length;) {
        let run = row.slice(i, i + per);
        const cut = run.findIndex((g, j) => j && (PICTO.test(g[0]) || PICTO.test(run[j - 1][0]))); // an emoji is a facet of its own
        if (cut > 0) run = run.slice(0, cut);
        facet(run.map(g => g[0]).join(''), width(run));
        i += run.length;
      }
      for (let j = 0; j < stars; j++) facet(SEP, gap / stars);
    }
    return h(`i.neon-spin${r ? '.neon-r2' : ''}`, { style: { '--ry': ry.toFixed(3) } }, ...facets);
  });
  // Projected box of the ring at rest: every facet's corners (line box, face to back), seen through the camera.
  let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
  for (const [px, py, pz, a, w] of boxes) for (const lx of [-w / 2, w / 2]) for (const ly of [-0.63 * SY, 0.63 * SY]) for (const lz of [0, -DEPTH]) {
    const [x, y] = view([px + lx * Math.cos(a) + lz * Math.sin(a), py + ly, pz - lx * Math.sin(a) + lz * Math.cos(a)]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const set = (k, v) => card.style.setProperty(k, v.toFixed(3));
  set('--neon-c', C);
  set('--neon-sy', SY);
  set('--neon-p', P);
  set('--neon-wd', 2 * Math.max(-x0, x1) + 0.4); // centred on the ring's axis, + the idle sway
  set('--neon-h', y1 - y0 + 0.4);
  set('--neon-cy', -y0 + 0.2);
  card.append(h('i.neon-stage', h('i.neon-tilt', h('i.neon-sway', h('i.neon-whip', ...spins)))));
  if (!user) return;
  // The hero, with a zero-width space at the seam (a break opportunity, used only if the line is too long), its width and
  // its widest unbreakable piece in em of its font.
  ctx.font = HERO;
  const hw = t => ctx.measureText(t).width / 100 + [...new Intl.Segmenter().segment(t)].length * HTRACK;
  const text = best ? raw.slice(0, best.cut) + ZWSP + raw.slice(best.cut) : raw;
  set('--neon-nw', hw(raw));
  set('--neon-np', Math.max(...text.split(/[\s\u200b]+/).map(hw)));
  card.append(h('i.neon-name', text));
}
