// Platform registry. Each adapter is one self-contained module following SPEC.md §4 (Adapter contract).
// Adapters load independently: a broken adapter is logged and skipped instead of taking the app down.
const FILES = ['twitch', 'kick', 'youtube', 'tiktok', 'demo'];
const loaded = [];
for (const name of FILES) {
  try {
    loaded.push((await import(`./${name}.js`)).default);
  } catch (err) {
    console.error(`[platforms] ${name} adapter failed to load: ${err.stack || err.message}`);
  }
}

export const PLATFORMS = loaded.filter(a => a.id !== 'demo');
export const adapters = new Map(loaded.map(a => [a.id, a]));

/** Static metadata sent to the UI (no functions). */
export function platformMeta(ctx) {
  return PLATFORMS.map(({ id, name, color, auth, app, capabilities, infoFields, notes }) => ({
    id, name, color, auth, app: app || null,
    capabilities: typeof capabilities === 'function' ? capabilities(null, ctx) : capabilities,
    infoFields: infoFields || {}, notes: notes || null,
  }));
}
