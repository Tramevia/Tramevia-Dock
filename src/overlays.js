// Saved chat overlays (settings key 'overlays' = { chat, featured }). Every change is published live to overlay pages.
import { OVERLAY_IDS, DEFAULTS, cleanOverlay, isLocked } from '../public/assets/overlay-settings.js';

// unlocked(): the install has a supporter code. Without it a saved early-access style runs (and saves back) as card.
export function createOverlays({ settings, hub, unlocked = () => false, now = Date.now }) {
  const all = () => {
    const stored = settings.get('overlays');
    return Object.fromEntries(OVERLAY_IDS.map(id => {
      const o = cleanOverlay(stored?.[id], DEFAULTS[id]);
      return [id, isLocked(o.style, unlocked(), now()) ? { ...o, style: 'card' } : o];
    }));
  };
  const write = (id, next) => {
    if (isLocked(next.style, unlocked(), now())) next = { ...next, style: 'card' };
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
    /** Supporter code added or removed: alerts pages take the style they may now use. */
    republish() { hub.publish('overlay', { id: 'alerts', settings: all().alerts, unlocked: unlocked() }); },
  };
}
