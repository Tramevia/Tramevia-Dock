import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, settings as settingsStore } from '../src/db.js';
import { createOverlays } from '../src/overlays.js';
import { DEFAULTS } from '../public/assets/overlay-settings.js';

function setup() {
  const settings = settingsStore(openDb(':memory:'));
  const published = [];
  const overlays = createOverlays({ settings, hub: { publish: (t, d) => published.push({ t, d }) } });
  return { settings, published, overlays };
}

test('overlays: defaults until saved, save merges + validates + persists + publishes', () => {
  const { settings, published, overlays } = setup();
  assert.equal(overlays.saved(), false);
  assert.deepEqual(overlays.all(), DEFAULTS);

  const out = overlays.save('chat', { max: 9999, fade: 12.6, theme: 'neon', hideBots: 'yes', bogus: 1, offPlatforms: ['kick', 3, 'kick'] });
  assert.equal(out.max, 100);
  assert.equal(out.fade, 13);
  assert.equal(out.theme, DEFAULTS.chat.theme);
  assert.equal(out.hideBots, DEFAULTS.chat.hideBots);
  assert.deepEqual(out.offPlatforms, ['kick']);
  assert.ok(!('bogus' in out));
  assert.equal(overlays.saved(), true);
  assert.deepEqual(settings.get('overlays'), { chat: out, featured: DEFAULTS.featured });
  assert.deepEqual(published, [{ t: 'overlay', d: { id: 'chat', settings: out } }]);

  const merged = overlays.save('chat', { align: 'right' }); // patch keeps earlier values
  assert.equal(merged.max, 100);
  assert.equal(merged.align, 'right');
  assert.deepEqual(overlays.all().featured, DEFAULTS.featured);
});

test('overlays: reset restores defaults (persisted + published), unknown id throws', () => {
  const { settings, published, overlays } = setup();
  overlays.save('featured', { featureSeconds: 60 });
  const out = overlays.reset('featured');
  assert.deepEqual(out, DEFAULTS.featured);
  assert.notEqual(out.offAccounts, DEFAULTS.featured.offAccounts); // a copy, never the shared object
  assert.deepEqual(settings.get('overlays').featured, DEFAULTS.featured);
  assert.deepEqual(published.at(-1), { t: 'overlay', d: { id: 'featured', settings: out } });
  assert.throws(() => overlays.save('nope', {}));
  assert.throws(() => overlays.reset('__proto__'));
});

test('overlays: corrupt stored value falls back to defaults', () => {
  const { settings, overlays } = setup();
  settings.set('overlays', { chat: 'junk', featured: { max: -5 } });
  assert.deepEqual(overlays.all().chat, DEFAULTS.chat);
  assert.equal(overlays.all().featured.max, 1);
});
