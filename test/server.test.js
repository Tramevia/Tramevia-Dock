// End-to-end checks against a real server process (demo mode, temp data dir, random port).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { openDb, settings as settingsStore } from '../src/db.js';
import { createAuth } from '../src/auth.js';
import './helpers.js';

async function startServer(env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'od-test-'));
  const port = 18000 + Math.floor(Math.random() * 2000);
  const child = spawn(process.execPath, ['src/server.js', '--demo'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, NO_OPEN: '1', HOST: '127.0.0.1', PUBLIC_URL: `http://localhost:${port}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(base + '/healthz')).ok) break; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return {
    base, port, child, output: () => output,
    async stop() { child.kill(); await new Promise(r => child.once('exit', r)); rmSync(dir, { recursive: true, force: true }); },
  };
}

function rawRequest(port, text) {
  return new Promise(resolve => {
    const socket = connect(port, '127.0.0.1', () => socket.end(text));
    let data = '';
    socket.on('data', d => { data += d; });
    socket.on('close', () => resolve(data));
    socket.on('error', () => resolve(data));
  });
}

test('malformed cookies and request targets never crash the server', async () => {
  const srv = await startServer();
  try {
    const res = await fetch(srv.base + '/api/session', { headers: { Cookie: 'progress=50%; od_session=%zz' } });
    assert.equal(res.status, 200);
    const raw = await rawRequest(srv.port, `GET http://a:b/ HTTP/1.1\r\nHost: localhost:${srv.port}\r\nConnection: close\r\n\r\n`);
    assert.match(raw, /^HTTP\/1.1 400/);
    const ws = await rawRequest(srv.port, `GET /ws HTTP/1.1\r\nHost: localhost:${srv.port}\r\nCookie: a=%\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
    assert.match(ws, /^HTTP\/1.1 101/); // loopback open mode: cookie junk is ignored
    const bad = await fetch(srv.base + '/api/accounts/%E0%A4%A');
    assert.equal(bad.status, 404);
    assert.equal((await fetch(srv.base + '/healthz')).status, 200);
    assert.equal(srv.child.exitCode, null);
  } finally {
    await srv.stop();
  }
});

test('rotating the dock key closes WebSockets opened with the old key', async () => {
  const srv = await startServer({ ADMIN_PASSWORD: 'correct-horse-battery' });
  try {
    const login = await fetch(srv.base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: srv.base }, body: JSON.stringify({ password: 'correct-horse-battery' }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const { dock } = await (await fetch(srv.base + '/api/keys', { headers: { Cookie: cookie } })).json();
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws?key=${dock}`);
    await new Promise((resolve, reject) => { ws.onmessage = resolve; ws.onerror = reject; });
    const closed = new Promise(resolve => { ws.onclose = e => resolve(e.code); });
    const rotate = await fetch(srv.base + '/api/security/rotate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: srv.base, Cookie: cookie }, body: JSON.stringify({ what: 'dock' }),
    });
    assert.equal(rotate.status, 200);
    assert.equal(await closed, 4001);
    assert.equal((await fetch(srv.base + '/api/state', { headers: { Authorization: `Bearer ${dock}` } })).status, 401);
  } finally {
    await srv.stop();
  }
});

test('login rate limit is per client and password changes revoke sessions', () => {
  const db = openDb(':memory:');
  const settings = settingsStore(db);
  const config = { secure: false, loopbackOnly: true, adminPassword: 'a-very-long-password', publicHost: 'localhost:8787', trustProxy: false };
  const log = { warn() {} };
  const auth = createAuth({ config, settings, log });
  const res = { setHeader() {} };
  const req = ip => ({ headers: {}, socket: { remoteAddress: ip } });
  for (let i = 0; i < 10; i++) assert.throws(() => auth.login(req('10.0.0.1'), res, 'wrong'), { status: 403 });
  assert.throws(() => auth.login(req('10.0.0.1'), res, 'a-very-long-password'), { status: 429 });
  assert.doesNotThrow(() => auth.login(req('10.0.0.2'), res, 'a-very-long-password'));

  const dockBefore = auth.keys().dock;
  const epochBefore = settings.get('sessionEpoch', 0);
  const again = createAuth({ config: { ...config, adminPassword: 'a-new-long-password' }, settings, log });
  assert.notEqual(again.keys().dock, dockBefore);
  assert.equal(settings.get('sessionEpoch', 0), epochBefore + 1);
  const same = createAuth({ config: { ...config, adminPassword: 'a-new-long-password' }, settings, log });
  assert.equal(same.keys().dock, again.keys().dock);
});

test('update API: status object, demo refusal, validated settings, hub topic, version in every hello', async () => {
  const srv = await startServer({ ADMIN_PASSWORD: 'correct-horse-battery', UPDATE_CHECK: '0' }); // UPDATE_CHECK=0: never asks GitHub
  try {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const login = await fetch(srv.base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: srv.base }, body: JSON.stringify({ password: 'correct-horse-battery' }),
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const send = (method, path, body) => fetch(srv.base + path, { method, headers: { 'Content-Type': 'application/json', Origin: srv.base, Cookie: cookie }, body: JSON.stringify(body) });
    const { dock, overlay } = await (await fetch(srv.base + '/api/keys', { headers: { Cookie: cookie } })).json();
    const socket = key => {
      const ws = new WebSocket(`ws://localhost:${srv.port}/ws?key=${key}`);
      const frames = [];
      ws.onmessage = e => frames.push(JSON.parse(e.data));
      return { ws, frames, next: t => new Promise((resolve, reject) => {
        const timer = setInterval(() => { const f = frames.find(x => x.t === t); if (f) { clearInterval(timer); resolve(f); } }, 20);
        setTimeout(() => { clearInterval(timer); reject(new Error(`no ${t} frame`)); }, 5000);
      }) };
    };
    const admin = socket(dock), reader = socket(overlay);
    assert.equal((await admin.next('hello')).d.version, version);
    const hello = (await reader.next('hello')).d;
    assert.equal(hello.access, 'read');
    assert.equal(hello.version, version);

    const status = await (await fetch(srv.base + '/api/update', { headers: { Cookie: cookie } })).json();
    assert.deepEqual(Object.keys(status).sort(), ['auto', 'checkedAt', 'checks', 'current', 'error', 'failed', 'image', 'latest', 'live', 'state', 'type']);
    assert.equal(status.current, version);
    assert.equal(status.image, 'ghcr.io/tramevia/tramevia-dock');
    assert.equal(status.checks, false);
    assert.equal(status.state, 'idle');
    assert.equal((await fetch(srv.base + '/api/update', { headers: { Authorization: `Bearer ${overlay}` } })).status, 403);
    const checked = await (await send('POST', '/api/update/check', {})).json();
    assert.equal(checked.latest, null);
    assert.equal(checked.checkedAt, 0);
    const refused = await send('POST', '/api/update/install', { version: '9.9.9' });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).code, 'demo');

    assert.equal((await send('PUT', '/api/settings', { updateAuto: 'yes' })).status, 400);
    assert.equal((await send('PUT', '/api/settings', { updateCheck: 1 })).status, 400);
    assert.equal((await send('PUT', '/api/settings', { updateAuto: true, updateCheck: null })).status, 200);
    const frame = await admin.next('update');
    assert.equal(frame.d.current, version);
    assert.equal(frame.d.auto, status.type === 'zip');
    assert.ok(!reader.frames.some(f => f.t === 'update'), 'update topic is admin-only');
    admin.ws.close();
    reader.ws.close();
  } finally {
    await srv.stop();
  }
});
