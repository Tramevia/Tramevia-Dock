// One alert of the alerts overlay (/overlay/chat?id=alerts): the event card, its kinetic title, and the extra elements of its style.
import { h, svg } from '/assets/core.js';
import { renderEvent } from '/assets/chat-render.js';

/** Kinetic title: every word in its own span with its index (--i), so the CSS can bring them in one after the other. */
function kinetic(title) {
  let i = 0;
  for (const node of [...title.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) { node.classList.add('w'); node.style.setProperty('--i', i++); continue; }
    const frag = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) frag.append(!part || /^\s+$/.test(part) ? part : h('span.w', { style: { '--i': i++ } }, part));
    node.replaceWith(frag);
  }
}

/** Style → function(card, event, { h, svg }) that adds the style's own elements to a new card. Styles made of CSS only have none. */
export const DECOR = {};

/** A new alert card for event d (not yet in the page). Set --evt on it once it is in the page (it comes from the event's CSS class). */
export function alertCard(d, opts, style) {
  const evt = renderEvent(d, { ...opts, timestamps: false });
  kinetic(evt.querySelector('.evt-title'));
  const card = h('div.alert-card', { class: `pf-${String(d.platform).replace(/[^a-z]/g, '')}` }, evt);
  DECOR[style]?.(card, d, { h, svg });
  return card;
}
