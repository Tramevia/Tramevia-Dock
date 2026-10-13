// One alert of the alerts overlay (/overlay/chat?id=alerts): the event card, its kinetic title, and the extra elements of its style.
import { h, svg } from '/assets/core.js';
import { renderEvent } from '/assets/chat-render.js';
import wave from '/assets/alert-wave.js'; // the wave style's particles: a module of their own (generative, ~440 lines)
import silk from '/assets/alert-silk.js'; // the silk style's sheets: a module of their own (generative, ~200 lines)
import neon from '/assets/alert-neon.js'; // the neon style's ring of letters: a module of their own (~150 lines)

/** Break points at a long word's seams (lower to upper case or digit, after _ . -): a name or a reward title wraps there before breaking anywhere. */
const seams = text => text.split(/(?<=[a-zà-ÿ])(?=[A-ZÀ-Ý0-9])|(?<=[_.-])(?=[^_.-])/).flatMap((p, i) => (i ? [h('wbr'), p] : [p]));

/** Kinetic title: every word in its own span with its index (--i), so the CSS can bring them in one after the other.
 *  Words are split on ASCII spaces only: the no-break spaces Intl.NumberFormat puts in numbers ("5 000", "1 500") keep a number whole. */
function kinetic(title) {
  let i = 0;
  for (const node of [...title.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) {
      node.classList.add('w'); node.style.setProperty('--i', i++);
      if (!node.children.length) node.replaceChildren(...seams(node.textContent));
      continue;
    }
    const frag = document.createDocumentFragment();
    for (const part of node.textContent.split(/([ \t\n]+)/)) frag.append(!part || /^[ \t\n]+$/.test(part) ? part : h('span.w', { style: { '--i': i++ } }, ...seams(part)));
    node.replaceWith(frag);
  }
}

// ------------------------------------------------------------------ impact: a product shot (after a canned-drink ad)
// The alert arrives as a can label cut in three slices between its lines of text (the name, the title, the rest). Each slice
// is a thick bar printed on both sides (drawn by the CSS); they turn on their own, stop aligned, then slam together onto the
// floor: the alert is whole again and spray bursts out of the seams.
const JETS = [ // start x (% of the card), seam (1 upper, 2 lower), direction (deg, 0 = right, -90 = up), distance (em), lead drop size (em)
  [0, 1, -166, 6.4, 0.42], [0, 1, -116, 4.6, 0.36], [0, 2, 170, 5.6, 0.38], [0, 2, 116, 3.8, 0.32], [0, 1, -138, 3.4, 0.3],
  [100, 2, 10, 6.6, 0.42], [100, 2, 64, 4.4, 0.36], [100, 1, -12, 5.4, 0.38], [100, 1, -66, 4.2, 0.32], [100, 2, 40, 3.2, 0.3],
];
const ZWSP = '​', WJ = '⁠'; // zero-width space: may wrap here; word joiner: may not
const JOINS = /(?<=\p{Ll})(?=\p{Lu})|(?<=\p{L})(?=[_\d])/gu; // where a long name may wrap: aB, a_, a1
const PICTO = /\p{Extended_Pictographic}/u;
// A name wraps only where its parts meet (spaces and JOINS): two emoji side by side stay together (by graphemes, so
// families, flags and skin tones stay whole).
const parts = t => [...new Intl.Segmenter().segment(t)].map(s => s.segment)
  .reduce((out, g, i, a) => out + (i && PICTO.test(g) && PICTO.test(a[i - 1]) ? WJ : '') + g, '').replace(JOINS, ZWSP);

function impact(card, event) {
  // Text widths in em of the bold font, so the CSS can size the name, the amount and a gift's recipient to their room.
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `800 100px ${getComputedStyle(document.body).fontFamily}`;
  const em = t => ctx.measureText(t).width / 100;
  const widest = t => Math.max(...t.split(/[\s​]+/).map(em)); // the longest part that may not wrap
  const set = (el, k, v) => el.style.setProperty(k, v.toFixed(2));
  const amount = card.querySelector('.evt-amount');
  if (amount) { card.classList.add('impact-money'); set(card, '--im-amt', em(amount.textContent)); }
  // A gifted sub's recipient (meta, "pour {name}"): keeps its case and wraps only where its parts meet.
  const to = event.type === 'giftsub' && event.label && [...card.querySelectorAll('.evt-meta span')].find(s => s.textContent.endsWith(event.label));
  if (to) { to.textContent = parts(to.textContent); to.classList.add('impact-to'); set(to, '--im-mp', widest(to.textContent)); }
  // The name, and the title the slices print (name, then the other words) when the title starts with the name.
  const name = card.querySelector('.evt-user');
  let lead = '', rest = '';
  if (name) {
    const text = name.textContent.trim(), first = card.querySelector('.evt-title').textContent.trimStart().startsWith(text);
    name.textContent = parts(text);
    set(card, '--im-w', em(text));
    set(card, '--im-wp', widest(name.textContent));
    if (first) {
      lead = name.textContent;
      rest = [...card.querySelectorAll('.evt-title .w:not(.evt-user)')].map(w => w.textContent).join(' ');
    }
  }
  const face = cls => h(cls, { attrs: { 'data-title': rest } }, lead);
  card.append(
    h('i.impact-slab', ...[0, 1, 2].map(k => h('i.impact-tier', { style: { '--im-k': k } },
      h('i.impact-slice', face('i.impact-face'), face('i.impact-face.impact-back'))))),
    h('i.impact-fx', ...JETS.map(([x, seam, r, d, s], n) => h('i.impact-drop', { style: {
      '--im-x': `${x}%`, '--im-y': `var(--im-cut${seam})`, '--im-r': `${r}deg`, '--im-s': `${s}em`, '--im-f': n % 2 ? -1 : 1,
      '--im-tx': `${(d * Math.cos(r * Math.PI / 180)).toFixed(2)}em`, '--im-ty': `${(d * Math.sin(r * Math.PI / 180)).toFixed(2)}em`,
      '--im-dur': `${600 + (n % 3) * 80}ms`, '--im-dl': `${(n % 4) * 10}ms` } }))),
    h('i.impact-burst'), // two more spray fans (its ::before and ::after)
    h('i.impact-flash'), // light out of the seams on the impact frame
  );
}

// ------------------------------------------------------------------ eclipse: light is the only material
// Two folded beams of light converge on the ring (the icon); a dark corridor opens around the text between two curved walls
// of light that pinch at its middle and curve away above and below (the throat of a tunnel), closed by thin arcs of light;
// a bead flares under the text and opens into the eclipse rim; a crescent orbits the ring.
// The SVGs share one box stretched over the card and its overhang (see .ecl-tunnel): x = 11.5 / 88.5 is the throat on the
// card edges, y = 10 / 90 the corners where the arcs close the corridor; past them the walls run on as hairlines and fade out.
// The glow (a blurred halo) sits under the corridor, so it only shows outside the walls. The SVGs are grouped in two frames
// (outer light: glow + sheen; corridor + walls) that carry the exit, so it never stacks on the SVGs' own entry animations.
// width / height 0: the CSS sizes the SVGs; if the streamer switches style while an alert is on screen, they stay empty.
const ECL_WALL_L = 'C7.9,14 11.5,32 11.5,50 C11.5,68 7.9,86 5.5,90';
const ECL_WALL_R = 'C92.1,14 88.5,32 88.5,50 C88.5,68 92.1,86 94.5,90';
const ECL_WALLS = `M5.5,10 ${ECL_WALL_L} M94.5,10 ${ECL_WALL_R}`;
const ECL_ARCS = 'M5.5,10 Q50,2 94.5,10 M5.5,90 Q50,98 94.5,90';
const ECL_LINES = `${ECL_ARCS} M5.5,10 C4,7.5 2,3.5 0,0 M5.5,90 C4,92.5 2,96.5 0,100 M94.5,10 C96,7.5 98,3.5 100,0 M94.5,90 C96,92.5 98,96.5 100,100`;

function eclipse(card) {
  const layer = (cls, paths) => svg(`<svg class="ecl-tunnel ${cls}" width="0" height="0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${
    paths.map(([c, d]) => `<path class="ecl-${c}" d="${d}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>`);
  card.append(
    h('i.ecl-beam.ecl-bl'),
    h('i.ecl-beam.ecl-br'),
    h('i.ecl-frame.ecl-aura',
      layer('ecl-glow', [['halo', ECL_WALLS], ['haze', ECL_ARCS]]),
      layer('ecl-sheen', [['fill', `M0,0 L5.5,10 ${ECL_WALL_L} L0,100 Z M100,0 L94.5,10 ${ECL_WALL_R} L100,100 Z`]])),
    h('i.ecl-frame',
      layer('ecl-corridor', [['fill', `M5.5,10 Q50,2 94.5,10 ${ECL_WALL_R} Q50,98 5.5,90 C7.9,86 11.5,68 11.5,50 C11.5,32 7.9,14 5.5,10 Z`]]),
      layer('ecl-walls', [['bloom', ECL_WALLS], ['edge', ECL_WALLS], ['line', ECL_LINES]])),
    h('i.ecl-rim', h('i.ecl-limb')),
    h('i.ecl-bead'),
  );
  card.querySelector('.evt-icon')?.append(h('i.ecl-orbit'));
}

// ------------------------------------------------------------------ plasma: a thermal orb, the hero above the text
// Its layers go inside the event icon, which anchors the orb above the text (the glyph stays on top): the halo and the glow
// around it; the shape frame (swell, a star-shaped glow while it morphs, then a slow liquid rock) with the hot rim under the
// fill, both clipped to the morphing outline; inside the fill, a tilted layer with the rolling rest bands, a wandering hot
// spot, the entry's heat bands (on top: they hand over to the rest bands, and come back at the exit) and the shading.
function plasma(card) {
  card.querySelector('.evt-icon')?.prepend(
    h('i.plasma-halo'),
    h('i.plasma-glow'),
    h('i.plasma-shape', h('i.plasma-rim'), h('i.plasma-fill', h('i.plasma-still', h('i.plasma-flow'), h('i.plasma-spot'), h('i.plasma-heat'), h('i.plasma-shade')))),
  );
}

// ------------------------------------------------------------------ glass: frosted glass lit from behind
// A frosted-glass capsule with an ice rim morphs into the card while a warm light (--evt) sweeps in from the bottom-right
// corner, under and through the glass; the warm light wraps the whole rim and the lens (the event icon) pops in the
// top-left corner. The glass is faked (an OBS source is transparent, so backdrop-filter has nothing to blur): a tinted
// body with light shapes moving inside it, and hairline rims drawn as SVG rects whose geometry morphs with the body.
// width / height 0 on the SVGs: the CSS sizes them; if the streamer switches style while an alert is on screen they stay empty.
function glass(card) {
  const rim = cls => svg(`<svg class="glass-rim ${cls}" width="0" height="0" aria-hidden="true"><rect/></svg>`);
  card.append(
    rim('glass-glow'),
    h('i.glass-body', h('i.glass-streak'), h('i.glass-streak.glass-streak-b'), h('i.glass-wash')),
    rim('glass-cool'),
    rim('glass-warm'),
  );
  if (card.querySelector('.evt-amount')) card.classList.add('glass-money');
}

// ------------------------------------------------------------------ switch: a soft-UI clay rocker switch
// (after a 3D product loop). The alert arrives as a small matte clay switch seen from
// three quarters, standing alone on the scene: it rises (its --evt wall shows) and the rocker key clicks up on the chime.
// Hard cut to dark, same shot: the switch is black, its wall turns into a white-hot light panel and --evt light seeps out
// from under it. Cut to the front: the pill runs out to the right into the whole alert, the light running under it, the
// title lighting up on it; a dotted LED track under it lights up, then counts down the time left. When the count reaches
// zero the outro mirrors it: the pill runs back into the switch, cut to 3/4, the key clicks off and the light dies (hard
// cut back to clay), then the switch sinks and fades.
// The pill is drawn twice: in the 3/4 shots (.switch-clay: footprint, light, wall layers, face) and from the front, lit
// (.switch-neon). The 3/4 wall is a stack of pill-shaped layers pushed down toward the base and tilted with the key
// (--k: 0 = face, 1 = base); each layer also carries its shade in clay and its light in the dark.
const WALLS = 12;
// the key end lifted toward the camera by c em per em from the pivot, for a layer at height f (1 = face): see overlay.css
const TILT = (c, f) => `matrix(${(1 - 1.0735 * c * f).toFixed(4)}, ${(1.0735 * c * f).toFixed(4)}, 0, 1, 0, 0)`;

function rocker(card) {
  const walls = [];
  for (let j = WALLS; j >= 1; j--) { // bottom layer first: the upper ones paint over it
    const k = j / WALLS;
    walls.push(h('i.switch-wall', { style: {
      '--k': k.toFixed(3), '--sw-shade': (0.04 + 0.18 * k).toFixed(3), '--sw-lit': (0.14 * (1 - k) ** 2).toFixed(3), // clay: lit lip, darker foot
      '--sw-hot': (0.92 * Math.min(1, 1.8 * Math.sin(Math.PI * k)) ** 0.7).toFixed(3), // dark: white-hot through the middle, --evt at the lip and the foot
      '--sw-dip': TILT(-0.035, 1 - k), '--sw-lift': TILT(0.13, 1 - k), '--sw-load': TILT(0.15, 1 - k) } }));
  }
  card.append(
    h('i.switch-clay', h('i.switch-stage'), h('i.switch-shadow'), ...walls, h('i.switch-band'), h('i.switch-face', h('i.switch-off'))),
    h('i.switch-neon', h('i.switch-pool'), h('i.switch-floor'), h('i.switch-tip'), h('i.switch-band'), h('i.switch-face'), h('i.switch-cap')),
    h('i.switch-track', h('i.switch-led', h('i.switch-led-in'))),
  );
}

// ------------------------------------------------------------------ prism: glass prisms on a black mirror floor
// A cluster of glass prisms on a black mirror floor (after a 3D motion piece: glossy glass bars rising and falling
// like an equalizer while the camera moves around them). No card: the text floats in front of the cluster, above the floor.
// Each bar is one element: its front face, its side (::before) and its cap (::after); under the floor it goes on as its
// reflection. Scene graph: scene (2D: the camera pulling away at the end) > stage (perspective) > rig (the crane at the
// start) > cam (the slow orbit) > floor + 5 drops (the outro's collapse, column by column) > 5 columns (the travelling wave
// of the equalizer) > bars (the burst). One transform animation per element: two on one element (even one still waiting)
// would take it off the compositor.
// [column, row, height (em)] on a 5 x 5 grid seen corner-on: row 0 is the back, column 4 the right; heights in clumps.
const BARS = [
  [0, 0, 3.6], [1, 0, 5.4], [2, 0, 6.9], [3, 0, 4.2],
  [0, 1, 4.6], [1, 1, 7.6], [2, 1, 6], [3, 1, 3.4], [4, 1, 2.8],
  [0, 2, 3], [1, 2, 5.9], [2, 2, 5], [3, 2, 6.4], [4, 2, 2.2],
  [0, 3, 4.2], [1, 3, 3.6], [2, 3, 2.6], [3, 3, 2], [4, 3, 1.4],
  [1, 4, 1.8], [2, 4, 3], [3, 4, 1.3],
];
const STEP = 1.28; // em between bar centres; the bars are 0.82em square

function prism(card, event) {
  const flip = [...(event.user?.name || '')].length % 2; // every other name length mirrors the cluster
  const cols = [0, 1, 2, 3, 4].map(c => h('i.prism-col', { style: { '--ph': `${c * 480}ms` } })); // the wave reaches each column 480 ms after the last
  const drops = cols.map((col, c) => h('i.prism-drop', { style: { '--out': `${c * 80}ms` } }, col)); // the collapse runs across the columns
  BARS.forEach(([c0, r, ht], i) => {
    const c = flip ? r : c0, row = flip ? c0 : r; // swapping column and row mirrors the cluster left to right on screen
    const ring = Math.round(Math.hypot(c - 2, row - 2)); // rings around the impact point, the cluster's centre
    // light pulses run up the tall bars on the chime (a background animation: main thread, so the short ones are left out)
    cols[c].append(h(ht >= 4.5 ? 'i.prism-bar.prism-lit' : 'i.prism-bar', { style: {
      '--x': `${(c - 2) * STEP}em`, '--z': `${(row - 2) * STEP}em`, '--h': `${ht}em`,
      '--dl': `${ring * 60}ms`, // the chime's ripples reach this ring after 0 / 60 / 120 / 180 ms
      // refractions seen through the glass and the iridescent glints on the edges, at bar-specific heights
      '--r1': `${(0.7 + (i * 0.53) % 1.6).toFixed(2)}em`, '--r2': `${(1.4 + (i * 0.71) % 1.9).toFixed(2)}em`,
      '--g1': `${(0.3 + (i * 0.37) % 1.2).toFixed(2)}em`, '--g2': `${(0.8 + (i * 0.61) % 1.5).toFixed(2)}em`,
    } }));
  });
  card.append(h('i.prism-scene',
    h('i.prism-stage', h('i.prism-rig', h('i.prism-cam', h('i.prism-floor'), ...drops))),
    h('i.prism-sheen')));
}

/** Style → function(card, event) that adds the style's own elements to a new card. Styles made of CSS only (card, text) have none. */
export const DECOR = { impact, eclipse, plasma, glass, switch: rocker, wave: (card, event) => wave(card, event, { h, svg }), prism,
  silk: (card, event) => silk(card, event, { h, svg }), neon: (card, event) => neon(card, event, { h, svg }) };

/** A new alert card for event d (not yet in the page). Set --evt on it once it is in the page (it comes from the event's CSS class). */
export function alertCard(d, opts, style) {
  const evt = renderEvent(d, { ...opts, timestamps: false });
  const title = evt.querySelector('.evt-title');
  kinetic(title);
  const card = h('div.alert-card', { class: `pf-${String(d.platform).replace(/[^a-z]/g, '')}` }, evt);
  // The styles size the title so its longest word fits a line before wrapping inside it: --longest = characters of the longest
  // word (a 25-character name), --longest-part = of the longest piece between seams (a name wraps at its seams at full size first).
  const words = title.textContent.split(/\s+/);
  card.style.setProperty('--longest', Math.max(1, ...words.map(s => [...s].length)));
  card.style.setProperty('--longest-part', Math.max(1, ...words.flatMap(s => seams(s).filter(p => typeof p === 'string')).map(s => [...s].length)));
  DECOR[style]?.(card, d);
  return card;
}
