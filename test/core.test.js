import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { seal, unseal, sign, safeEqual, pkcePair } from '../src/crypto.js';
import { hostAllowed, writeAllowed, createRouter } from '../src/http.js';
import { openDb, settings } from '../src/db.js';

test('seal/unseal round-trip and AAD binding', () => {
  const box = seal({ access: 'a', refresh: 'b' }, 'account:1');
  assert.match(box, /^v1\./);
  assert.deepEqual(unseal(box, 'account:1'), { access: 'a', refresh: 'b' });
  assert.throws(() => unseal(box, 'account:2'));
  assert.throws(() => unseal(box.slice(0, -2) + 'AA', 'account:1'));
});

test('sign / safeEqual / pkce', () => {
  assert.equal(sign('x'), sign('x'));
  assert.notEqual(sign('x'), sign('y'));
  assert.ok(safeEqual('abc', 'abc'));
  assert.ok(!safeEqual('abc', 'abd'));
  const { verifier, challenge } = pkcePair();
  assert.ok(verifier.length >= 43 && challenge.length === 43);
});

test('host allowlist (DNS rebinding)', () => {
  const config = { publicHost: 'dock.example.com', allowedHosts: ['lan.local:8787'], port: 8787 };
  assert.ok(hostAllowed('localhost:8787', config));
  assert.ok(hostAllowed('127.0.0.1:8787', config));
  assert.ok(hostAllowed('[::1]:8787', config));
  assert.ok(hostAllowed('dock.example.com', config));
  assert.ok(hostAllowed('lan.local:8787', config));
  assert.ok(!hostAllowed('localhost:9999', config));
  assert.ok(!hostAllowed('evil.com', config));
  assert.ok(!hostAllowed('', config));
});

test('CSRF write guard', () => {
  const req = headers => ({ headers: { host: 'localhost:8787', ...headers } });
  assert.ok(writeAllowed(req({ 'sec-fetch-site': 'same-origin' })));
  assert.ok(!writeAllowed(req({ 'sec-fetch-site': 'cross-site', origin: 'http://localhost:8787' })));
  assert.ok(writeAllowed(req({ origin: 'http://localhost:8787' })));
  assert.ok(!writeAllowed(req({ origin: 'http://evil.com' })));
  assert.ok(!writeAllowed(req({})));
  assert.ok(writeAllowed(req({ authorization: 'Bearer k' })));
});

test('router params', () => {
  const r = createRouter();
  r.get('/api/accounts/:id', () => 1);
  assert.deepEqual(r.match('GET', '/api/accounts/a%20b').params, { id: 'a b' });
  assert.equal(r.match('POST', '/api/accounts/x'), null);
  assert.equal(r.match('GET', '/api/accounts'), null);
});

test('db migrations + settings', () => {
  const db = openDb(':memory:');
  const s = settings(db);
  s.set('a', { b: 1 });
  assert.deepEqual(s.get('a'), { b: 1 });
  s.set('a', null);
  assert.equal(s.get('a', 'x'), 'x');
  assert.equal(db.prepare('pragma user_version').get().user_version, 1);
});
