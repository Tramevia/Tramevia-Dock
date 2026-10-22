import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPremium } from '../src/premium.js';

const quiet = { info() {}, warn() {} };
const PACK = { api: 1, version: '1.5.0', files: { 'decor.js': 'export default () => ({});', 'alerts.css': '.x{}', 'alert-wave.js': '//' } };
const reply = (status, body) => async () => new Response(body ? JSON.stringify(body) : null, { status });

function setup(fetch, code = 'TD1-x.y') {
  const dir = join(mkdtempSync(join(tmpdir(), 'premium-')), 'premium');
  const state = { code, changes: 0, calls: [] };
  const premium = createPremium({ dir, url: 'https://premium.test', log: quiet, code: () => state.code, onChange: () => state.changes++,
    fetch: (url, init) => { state.calls.push({ url, headers: init.headers }); return fetch(url, init); } });
  return { dir, state, premium };
}

test('a code downloads the pack, then asks with the version and keeps it on 304', async () => {
  const { dir, state, premium } = setup(reply(200, PACK));
  await premium.sync();
  assert.deepEqual(premium.info(), { version: '1.5.0', status: 'ok' });
  assert.equal(readFileSync(join(dir, 'assets', 'alerts.css'), 'utf8'), '.x{}');
  assert.equal(state.calls[0].url, 'https://premium.test/pack?api=1');
  assert.equal(state.calls[0].headers.Authorization, 'Bearer TD1-x.y');
  assert.equal(state.changes, 1);

  const again = createPremium({ dir, url: 'https://premium.test', log: quiet, code: () => 'TD1-x.y', fetch: async (url, init) => {
    assert.equal(init.headers['If-None-Match'], '"1.5.0"');
    return new Response(null, { status: 304 });
  } });
  await again.sync();
  assert.deepEqual(again.info(), { version: '1.5.0', status: 'ok' }); // read back from disk after a restart
});

test('unreachable server keeps the pack; refused or removed code deletes it', async () => {
  let next = reply(200, PACK);
  const { dir, state, premium } = setup((...a) => next(...a));
  await premium.sync();
  next = async () => { throw new Error('ECONNREFUSED'); };
  await premium.sync();
  assert.deepEqual(premium.info(), { version: '1.5.0', status: 'offline' });
  next = reply(500);
  await premium.sync();
  assert.equal(premium.info().version, '1.5.0');
  next = reply(403, { error: 'revoked_code' });
  await premium.sync();
  assert.deepEqual(premium.info(), { version: null, status: 'refused' });
  assert.equal(existsSync(dir), false);
  assert.equal(state.changes, 2);

  next = reply(200, PACK);
  await premium.sync();
  state.code = null;
  await premium.sync();
  assert.deepEqual(premium.info(), { version: null, status: 'none' });
  assert.equal(state.calls.length, 5); // no request without a code
});

test('a malformed pack or a file name leaving the folder is ignored', async () => {
  for (const files of [{ '../x.js': '', 'decor.js': '', 'alerts.css': '' }, { 'decor.js': '' }, { 'decor.js': 1, 'alerts.css': '' }]) {
    const { dir, premium } = setup(reply(200, { ...PACK, files }));
    await premium.sync();
    assert.deepEqual(premium.info(), { version: null, status: 'offline' });
    assert.equal(existsSync(dir), false);
  }
});
