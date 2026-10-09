// Saved chat overlays (settings key 'overlays' = { chat, featured }). Every change is published live to overlay pages.
import { OVERLAY_IDS, DEFAULTS, cleanOverlay } from '../public/assets/overlay-settings.js';

export function createOverlays({ settings, hub }) {
  const all = () => {
    const stored = settings.get('overlays');
    return Object.fromEntries(OVERLAY_IDS.map(id => [id, cleanOverlay(stored?.[id], DEFAULTS[id])]));
  };
  const write = (id, next) => {
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
  };
}
