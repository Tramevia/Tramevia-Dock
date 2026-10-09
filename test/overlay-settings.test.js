import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAY_IDS, DEFAULTS, LEGACY, cleanOverlay, overlayFromQuery } from '../public/assets/overlay-settings.js';

const q = s => new URLSearchParams(s);
const legacy = s => overlayFromQuery(q(s), null);

test('legacy URL: defaults as in 1.2', () => {
  const r = legacy('key=x');
  assert.equal(r.id, null);
  assert.equal(r.featured, false);
  assert.deepEqual(r.settings, LEGACY);
  assert.equal(r.settings.theme, 'transparent');
  assert.equal(r.settings.max, 12);
  assert.equal(r.settings.size, null);
  assert.deepEqual([r.onlyPlatforms, r.onlyAccounts], [[], []]);
});

test('legacy URL: numbers clamped (not rounded), empty = default', () => {
  const s = legacy('max=500&fade=-3&size=0&featureSeconds=99999').settings;
  assert.deepEqual([s.max, s.fade, s.size, s.featureSeconds], [100, 0, 8, 3600]);
  assert.equal(legacy('max=0').settings.max, 1);
  assert.equal(legacy('max=2.5').settings.max, 2.5);
  assert.equal(legacy('max=&size=').settings.max, 12);
  assert.equal(legacy('max=abc').settings.max, 12);
  assert.equal(legacy('size=').settings.size, null);
});

test('legacy URL: flags 1/true/yes, anything else (empty too) = false', () => {
  for (const v of ['1', 'true', 'yes']) assert.equal(legacy(`bubble=${v}`).settings.bubble, true);
  for (const v of ['', '0', 'no', 'TRUE']) assert.equal(legacy(`events=${v}`).settings.events, false);
  const s = legacy('hideBots=1&badges=0').settings;
  assert.deepEqual([s.hideBots, s.badges, s.icons], [true, false, true]);
});

test('legacy URL: theme fallback, align, mode, inclusion lists', () => {
  assert.equal(legacy('theme=neon').settings.theme, 'transparent');
  assert.equal(legacy('theme=light').settings.theme, 'light');
  assert.equal(legacy('align=right').settings.align, 'right');
  assert.equal(legacy('align=center').settings.align, 'left');
  assert.equal(legacy('mode=featured').featured, true);
  assert.equal(legacy('mode=chat').featured, false);
  const r = legacy('platforms=Twitch, kick,&accounts=a1,,b2');
  assert.deepEqual(r.onlyPlatforms, ['twitch', 'kick']);
  assert.deepEqual(r.onlyAccounts, ['a1', 'b2']);
});

test('legacy URL: an unknown id stays legacy', () => {
  assert.equal(legacy('id=other').id, null);
  assert.deepEqual(overlayFromQuery(q('id=other'), { chat: { max: 3 } }).settings, LEGACY);
});

test('saved URL: server settings, URL param overrides one setting', () => {
  const saved = { chat: { ...DEFAULTS.chat, max: 30, theme: 'light' }, featured: DEFAULTS.featured };
  const r = overlayFromQuery(q('id=chat&max=5'), saved);
  assert.equal(r.id, 'chat');
  assert.equal(r.featured, false);
  assert.equal(r.settings.max, 5);
  assert.equal(r.settings.theme, 'light');
  assert.equal(overlayFromQuery(q('id=chat&theme=dark'), saved).settings.theme, 'dark');
  assert.deepEqual(overlayFromQuery(q('id=chat'), {}).settings, DEFAULTS.chat);
  assert.deepEqual(overlayFromQuery(q('id=featured'), undefined).settings, DEFAULTS.featured);
});

test('saved URL: id featured implies featured unless mode says otherwise', () => {
  assert.equal(overlayFromQuery(q('id=featured'), {}).featured, true);
  assert.equal(overlayFromQuery(q('id=featured&mode=chat'), {}).featured, false);
  assert.equal(overlayFromQuery(q('id=chat&mode=featured'), {}).featured, true);
});

test('saved URL: invalid saved values are cleaned', () => {
  const r = overlayFromQuery(q('id=chat'), { chat: { max: 1e9, theme: 'neon', bubble: 'yes', offPlatforms: 'twitch', evil: 1 } });
  assert.equal(r.settings.max, 100);
  assert.equal(r.settings.theme, DEFAULTS.chat.theme);
  assert.equal(r.settings.bubble, DEFAULTS.chat.bubble);
  assert.deepEqual(r.settings.offPlatforms, []);
  assert.equal('evil' in r.settings, false);
});

test('cleanOverlay: complete object, rounding, clamping, enums, unknown keys', () => {
  assert.deepEqual(Object.keys(cleanOverlay({})).sort(), Object.keys(DEFAULTS.chat).sort());
  assert.deepEqual(cleanOverlay(null), DEFAULTS.chat);
  assert.deepEqual(cleanOverlay([1, 2]), DEFAULTS.chat);
  const s = cleanOverlay({ max: 2.6, fade: -1, size: 500, featureSeconds: '20', theme: 'light', align: 'right', bubble: true, hideBots: 1, x: 1 });
  assert.deepEqual([s.max, s.fade, s.size, s.featureSeconds], [3, 0, 120, 20]);
  assert.deepEqual([s.theme, s.align, s.bubble, s.hideBots], ['light', 'right', true, DEFAULTS.chat.hideBots]);
  assert.equal('x' in s, false);
  assert.equal(cleanOverlay({ max: NaN }).max, DEFAULTS.chat.max);
  assert.equal(cleanOverlay({ max: Infinity }).max, DEFAULTS.chat.max);
  assert.equal(cleanOverlay({ max: ' ' }).max, DEFAULTS.chat.max);
  assert.equal(cleanOverlay({ align: 'center', theme: 'neon' }).align, 'left');
  assert.equal(cleanOverlay({}, LEGACY).theme, 'transparent');
});

test('cleanOverlay: id lists deduped, typed, bounded', () => {
  const s = cleanOverlay({ offPlatforms: ['kick', 'kick', '', 3, null, 'x'.repeat(65)], offAccounts: Array.from({ length: 80 }, (_, i) => `a${i}`) });
  assert.deepEqual(s.offPlatforms, ['kick']);
  assert.equal(s.offAccounts.length, 50);
  assert.deepEqual(cleanOverlay({ offPlatforms: 'kick' }).offPlatforms, []);
  const base = { ...DEFAULTS.chat, offAccounts: ['b'] };
  assert.deepEqual(cleanOverlay({}, base).offAccounts, ['b']);
  assert.notEqual(cleanOverlay({}, base).offAccounts, base.offAccounts); // a copy, never the base's array
});

test('OVERLAY_IDS and DEFAULTS agree', () => {
  assert.deepEqual(Object.keys(DEFAULTS).sort(), [...OVERLAY_IDS].sort());
  for (const id of OVERLAY_IDS) assert.deepEqual(cleanOverlay(DEFAULTS[id], DEFAULTS[id]), DEFAULTS[id]);
});
