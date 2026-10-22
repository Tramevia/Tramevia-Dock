// Saved chat overlays (settings key 'overlays' = { chat, featured }). Every change is published live to overlay pages.
import { OVERLAY_IDS, DEFAULTS, cleanOverlay, isLocked } from '../public/assets/overlay-settings.js';

// unlocked(): the install has a supporter code. Without it a saved supporter style runs (and saves back) as card.
// premium(): version of the supporter styles pack (src/premium.js) or null: the alerts pages reload when it changes.
export function createOverlays({ settings, hub, unlocked = () => false, premium = () => null }) {
  const all = () => {
    const stored = settings.get('overlays');
    return Object.fromEntries(OVERLAY_IDS.map(id => {
      const o = cleanOverlay(stored?.[id], DEFAULTS[id]);
      return [id, isLocked(o.style, unlocked()) ? { ...o, style: 'card' } : o];
    }));
  };
  const write = (id, next) => {
    if (isLocked(next.style, unlocked())) next = { ...next, style: 'card' };
    settings.set('overlays', { ...all(), [id]: next });
    hub.publish('overlay', { id, settings: next });
    return next;
  };
  const known = id => { if (!OVERLAY_IDS.includes(id)) throw new Error(`Unknown overlay ${id}`); };
  return {
    all,
    saved: () => settings.get('overlays') !== null,
    save(id, patch) { known(id); return write(id, cleanOverlay({ ...all()[id], ...patch }, DEFAULTS[id])); },
    reset(id) { known(id); return write(id, cleanOverlay(DEFAULTS[id], DEFAULTS[id])); },
    /** Supporter code or pack added or removed: alerts pages take the style they may now use. */
    republish() { hub.publish('overlay', { id: 'alerts', settings: all().alerts, unlocked: unlocked(), premium: premium() }); },
  };
}
