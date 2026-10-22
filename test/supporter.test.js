import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { openDb, settings as settingsStore } from '../src/db.js';
import { readCode, createSupporter } from '../src/supporter.js';
import { createOverlays } from '../src/overlays.js';
import { isLocked, overlayFromQuery } from '../public/assets/overlay-settings.js';

const { publicKey: key, privateKey } = generateKeyPairSync('ed25519');
const make = (payload, pk = privateKey) => {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `TD1-${p}.${sign(null, Buffer.from(p), pk).toString('base64url')}`;
};

test('supporter: only codes signed with the project key are read; expiry is reported', () => {
  assert.deepEqual(readCode(make({ n: 'Ana' }), { key }), { name: 'Ana', until: null, expired: false });
  assert.deepEqual(readCode(make({ n: 'Bo', x: '2026-12-01' }), { key, now: Date.parse('2026-12-01') }), { name: 'Bo', until: '2026-12-01', expired: true });
  assert.equal(readCode(make({ n: 'Ana' }, generateKeyPairSync('ed25519').privateKey), { key }), null); // someone else's key
  const good = make({ n: 'Ana' });
  const forged = `TD1-${Buffer.from(JSON.stringify({ n: 'Eve' })).toString('base64url')}.${good.split('.')[1]}`;
  assert.equal(readCode(forged, { key }), null); // payload swapped under a real signature
  for (const bad of ['', null, 'TD1-x.y', 'hello', good.slice(0, -3)]) assert.equal(readCode(bad, { key }), null);
  assert.equal(readCode(make({ n: 'Ana' })), null); // the shipped public key never accepts a test key's code
});

test('supporter: set stores genuine, unexpired codes only; unlocked follows', () => {
  const settings = settingsStore(openDb(':memory:'));
  const sup = createSupporter({ settings, key });
  assert.equal(sup.unlocked(), false);
  assert.equal(sup.set('TD1-nope.nope'), null);
  assert.equal(sup.set(make({ n: 'Old', x: '2000-01-01' })).expired, true);
  assert.equal(settings.get('supporter'), null);
  assert.equal(sup.set(` ${make({ n: 'Ana' })} `).name, 'Ana');
  assert.equal(sup.unlocked(), true);
  sup.clear();
  assert.equal(sup.unlocked(), false);
});

test('supporter styles: locked without a code, card in its place', () => {
  assert.equal(isLocked('impact', false), true);
  assert.equal(isLocked('impact', true), false);
  assert.equal(isLocked('card', false), false);
  assert.equal(isLocked('text', false), false);

  let unlocked = false;
  const published = [];
  const settings = settingsStore(openDb(':memory:'));
  const overlays = createOverlays({ settings, hub: { publish: (t, d) => published.push({ t, d }) }, unlocked: () => unlocked });
  assert.equal(overlays.save('alerts', { style: 'impact' }).style, 'card'); // not saved, not published as impact
  assert.equal(published.at(-1).d.settings.style, 'card');
  unlocked = true;
  assert.equal(overlays.save('alerts', { style: 'impact' }).style, 'impact');
  unlocked = false; // code removed: the saved style runs as card
  assert.equal(overlays.all().alerts.style, 'card');
  overlays.republish();
  assert.deepEqual(published.at(-1), { t: 'overlay', d: { id: 'alerts', settings: overlays.all().alerts, unlocked: false, premium: null } });

  const q = new URLSearchParams('id=alerts&style=impact');
  assert.equal(overlayFromQuery(q, {}).settings.style, 'card'); // the URL param follows the same rule
  assert.equal(overlayFromQuery(q, {}, true).settings.style, 'impact');
});
