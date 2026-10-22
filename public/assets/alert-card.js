// One alert of the alerts overlay (/overlay/chat?id=alerts): the event card and its kinetic title. The supporter styles add their own
// elements from the supporter pack (decor.js, downloaded by src/premium.js): card and text are CSS only.
import { h } from '/assets/core.js';
import { renderEvent } from '/assets/chat-render.js';

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

/** A new alert card for event d (not yet in the page). Set --evt on it once it is in the page (it comes from the event's CSS class).
 *  decor: the supporter pack's styles (init() of /premium/decor.js), or null. */
export function alertCard(d, opts, style, decor) {
  const evt = renderEvent(d, { ...opts, timestamps: false });
  const title = evt.querySelector('.evt-title');
  kinetic(title);
  const card = h('div.alert-card', { class: `pf-${String(d.platform).replace(/[^a-z]/g, '')}` }, evt);
  // The styles size the title so its longest word fits a line before wrapping inside it: --longest = characters of the longest
  // word (a 25-character name), --longest-part = of the longest piece between seams (a name wraps at its seams at full size first).
  const words = title.textContent.split(/\s+/);
  card.style.setProperty('--longest', Math.max(1, ...words.map(s => [...s].length)));
  card.style.setProperty('--longest-part', Math.max(1, ...words.flatMap(s => seams(s).filter(p => typeof p === 'string')).map(s => [...s].length)));
  decor?.[style]?.(card, d);
  return card;
}
