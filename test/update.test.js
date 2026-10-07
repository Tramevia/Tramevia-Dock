// Updater: GitHub filters, staging, swap/restore, install type, schema guard, and one end-to-end run
// (install → exit 75 → new version confirmed → crashing version → rollback CLI). Fake GitHub only: no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { mockFetch } from './helpers.js';
import { checkLatest, stage, swap, restore, confirm, failed, installType, interrupted, newer, RESTART } from '../src/update.js';
import { openDb } from '../src/db.js';

const REPO_DIR = fileURLToPath(new URL('..', import.meta.url));
const TAR = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const DL = 'https://github.com/Tramevia/Tramevia-Dock/releases/download';
const sha = buf => `sha256:${hash('sha256', buf)}`;
const read = (...p) => readFileSync(join(...p), 'utf8');
const tmp = () => mkdtempSync(join(tmpdir(), 'td-upd-'));

/** A minimal app tree: package.json, src/server.js, node_modules/, plus extra files. */
function tree(dir, version, extra = {}, engines = '>=1.0.0') {
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'node_modules', 'dep'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version, engines: { node: engines } }));
  writeFileSync(join(dir, 'src', 'server.js'), version);
  writeFileSync(join(dir, 'node_modules', 'dep', 'index.js'), version);
  for (const [name, content] of Object.entries(extra)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
}
/** tar.gz with entries at top level, like the release workflow. */
function tarball(dir, out, names) {
  const r = spawnSync(TAR, ['-czf', out, '-C', dir, ...names], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  return readFileSync(out);
}
const release = (over = {}, asset = {}) => ({
  tag_name: 'v1.0.1', draft: false, prerelease: false, html_url: 'https://evil.example/notes',
  assets: [{ name: 'tramevia-dock-1.0.1.tar.gz', size: 10, digest: `sha256:${'a'.repeat(64)}`, browser_download_url: `${DL}/v1.0.1/tramevia-dock-1.0.1.tar.gz`, ...asset }],
  ...over,
});

test('newer() compares X.Y.Z and ranks a release above its pre-releases', () => {
  assert.ok(newer('1.0.1', '1.0.0'));
  assert.ok(newer('1.10.0', '1.9.9'));
  assert.ok(newer('2.0.0', '1.99.99'));
  assert.ok(newer('1.3.0', '1.3.0-rc.1'));
  assert.ok(!newer('1.0.0', '1.0.0'));
  assert.ok(!newer('1.0.0', '1.0.1'));
  assert.ok(!newer('1.3.0-rc.1', '1.3.0'));
  assert.ok(!newer('latest', '1.0.0'));
});

test('checkLatest accepts only a published, newer, digest-checked asset from the hard-coded repo', async () => {
  let answer = { status: 200, body: release() };
  const mock = mockFetch(() => answer);
  try {
    const ok = await checkLatest('1.0.0');
    assert.deepEqual(ok, {
      version: '1.0.1', notesUrl: 'https://github.com/Tramevia/Tramevia-Dock/releases/tag/v1.0.1', // never the API's html_url
      url: `${DL}/v1.0.1/tramevia-dock-1.0.1.tar.gz`, size: 10, digest: `sha256:${'a'.repeat(64)}`,
    });
    const { url, init } = mock.calls[0];
    assert.equal(url.href, 'https://api.github.com/repos/Tramevia/Tramevia-Dock/releases/latest');
    assert.equal(init.headers['user-agent'], 'tramevia-dock/1.0.0');
    assert.equal(init.headers['x-github-api-version'], '2022-11-28');
    assert.equal(init.headers.accept, 'application/vnd.github+json');

    const refused = {
      'HTTP 404 (private repo)': { status: 404, body: { message: 'Not Found' } },
      draft: { body: release({ draft: true }) },
      prerelease: { body: release({ prerelease: true }) },
      'pre-release tag': { body: release({ tag_name: 'v1.0.1-rc.1' }) },
      'non-semver tag': { body: release({ tag_name: 'latest' }) },
      'tag without v': { body: release({ tag_name: '1.0.1' }) },
      'same version': { body: release({ tag_name: 'v1.0.0' }, { name: 'tramevia-dock-1.0.0.tar.gz', browser_download_url: `${DL}/v1.0.0/tramevia-dock-1.0.0.tar.gz` }) },
      downgrade: { body: release({ tag_name: 'v0.9.9' }, { name: 'tramevia-dock-0.9.9.tar.gz', browser_download_url: `${DL}/v0.9.9/tramevia-dock-0.9.9.tar.gz` }) },
      'wrong asset name': { body: release({}, { name: 'tramevia-dock-1.0.1.zip' }) },
      'no assets': { body: release({ assets: [] }) },
      'no digest': { body: release({}, { digest: undefined }) },
      'sha1 digest': { body: release({}, { digest: `sha1:${'a'.repeat(40)}` }) },
      'uppercase digest': { body: release({}, { digest: `sha256:${'A'.repeat(64)}` }) },
      'foreign host': { body: release({}, { browser_download_url: 'https://evil.example/Tramevia/Tramevia-Dock/releases/download/v1.0.1/tramevia-dock-1.0.1.tar.gz' }) },
      'foreign repo': { body: release({}, { browser_download_url: 'https://github.com/evil/Tramevia-Dock/releases/download/v1.0.1/tramevia-dock-1.0.1.tar.gz' }) },
      'other tag folder': { body: release({}, { browser_download_url: `${DL}/v9.9.9/tramevia-dock-1.0.1.tar.gz` }) },
      'plain http': { body: release({}, { browser_download_url: `${DL.replace('https', 'http')}/v1.0.1/tramevia-dock-1.0.1.tar.gz` }) },
    };
    for (const [why, res] of Object.entries(refused)) {
      answer = res;
      assert.equal(await checkLatest('1.0.0'), null, why);
    }
    // Rate limit / outage: an error, not "no update" (the server keeps what it knew and says the check failed).
    for (const status of [403, 429, 502]) {
      answer = { status, body: { message: 'nope' } };
      await assert.rejects(checkLatest('1.0.0'), new RegExp(`GitHub HTTP ${status}`));
    }
  } finally { mock.restore(); }
});

test('stage verifies size + SHA-256, bundle content and engines.node before touching anything', async () => {
  const base = tmp(), app = join(base, 'app'), rel = join(base, 'rel'), old = join(base, 'old');
  let body = null, status = 200;
  const mock = mockFetch(() => new Response(body, { status }));
  try {
    tree(app, '1.0.0');
    tree(rel, '1.0.1');
    const good = tarball(rel, join(base, 'r.tgz'), ['src', 'node_modules', 'package.json']);
    body = good;
    const upd = { version: '1.0.1', url: `${DL}/v1.0.1/tramevia-dock-1.0.1.tar.gz`, size: body.length, digest: sha(body) };

    await assert.rejects(stage(app, { ...upd, digest: `sha256:${'0'.repeat(64)}` }), { update: 'corrupt' });
    await assert.rejects(stage(app, { ...upd, size: body.length + 1 }), { update: 'corrupt' });
    await assert.rejects(stage(app, { ...upd, version: '1.0.2' }), { update: 'bundle' });
    status = 404;
    await assert.rejects(stage(app, upd), { update: 'download', status: 404 });
    status = 200;

    tree(old, '1.0.1', {}, '>=999.1');
    const tooNew = tarball(old, join(base, 'o.tgz'), ['src', 'node_modules', 'package.json']);
    body = tooNew;
    await assert.rejects(stage(app, { ...upd, size: tooNew.length, digest: sha(tooNew) }), err => err.update === 'node' && err.need === '999.1.0' && /Node\.js 999\.1\.0/.test(err.message));

    body = good; // same bytes: a re-built tar.gz may differ (gzip header time)
    await stage(app, upd);
    assert.equal(read(app, '.update', 'staging', 'src', 'server.js'), '1.0.1');
    assert.equal(read(app, 'src', 'server.js'), '1.0.0'); // nothing swapped yet
  } finally {
    mock.restore();
    rmSync(base, { recursive: true, force: true });
  }
});

test('swap replaces code only, restore brings back files + DB snapshot and records the failure', async () => {
  const base = tmp(), app = join(base, 'app'), rel = join(base, 'rel');
  const mock = mockFetch(() => new Response(readFileSync(join(base, 'r.tgz'))));
  try {
    tree(app, '1.0.0', { 'data/x.db': 'live-db', 'data/x.db-wal': 'wal', '.env': 'A=1', 'README.md': 'old readme' });
    tree(rel, '1.0.1', { 'NEW.md': 'new', 'README.md': 'new readme', '.env': 'EVIL=1', 'data/x.db': 'evil' });
    writeFileSync(join(app, 'data', 'snap.db'), 'snapshot');
    const buf = tarball(rel, join(base, 'r.tgz'), ['src', 'node_modules', 'package.json', 'NEW.md', 'README.md', '.env', 'data']);
    await stage(app, { version: '1.0.1', url: `${DL}/v1.0.1/x`, size: buf.length, digest: sha(buf) });

    const db = join(app, 'data', 'x.db'), snapshot = join(app, 'data', 'snap.db');
    swap(app, { from: '1.0.0', to: '1.0.1', db, snapshot });
    assert.equal(read(app, 'src', 'server.js'), '1.0.1');
    assert.equal(read(app, 'node_modules', 'dep', 'index.js'), '1.0.1');
    assert.equal(read(app, 'NEW.md'), 'new');
    assert.equal(read(app, 'README.md'), 'new readme');
    assert.equal(read(app, '.env'), 'A=1');          // never touched, even when the bundle has one
    assert.equal(read(db), 'live-db');              // data/ never touched
    assert.equal(read(app, '.update', 'rollback', 'src', 'server.js'), '1.0.0');
    assert.deepEqual(JSON.parse(read(app, '.update', 'unconfirmed')), { from: '1.0.0', to: '1.0.1', added: ['NEW.md'], done: true, db, snapshot });
    assert.equal(interrupted(app), false);
    assert.equal(read(app, '.update', 'rollback.mjs'), read(REPO_DIR, 'src', 'update.js')); // rollback CLI outside the moved folders

    assert.equal(restore(app, 'boom'), true);
    assert.equal(read(app, 'src', 'server.js'), '1.0.0');
    assert.equal(read(app, 'node_modules', 'dep', 'index.js'), '1.0.0');
    assert.equal(read(app, 'package.json'), JSON.stringify({ version: '1.0.0', engines: { node: '>=1.0.0' } }));
    assert.equal(read(app, 'README.md'), 'old readme');
    assert.equal(existsSync(join(app, 'NEW.md')), false);     // added entries removed
    assert.equal(read(db), 'snapshot');                          // DB snapshot put back…
    assert.equal(existsSync(`${db}-wal`), false);                // …without the newer WAL
    assert.equal(read(app, '.env'), 'A=1');
    assert.equal(existsSync(join(app, '.update', 'unconfirmed')), false);
    assert.deepEqual(failed(app), { version: '1.0.1', reason: 'boom' });

    assert.equal(restore(app), false); // no marker: nothing to undo, files left alone
    assert.equal(read(app, 'src', 'server.js'), '1.0.0');

    confirm(app);
    assert.equal(failed(app), null);
    assert.equal(existsSync(join(app, '.update', 'download.tar.gz')), false);
  } finally {
    mock.restore();
    rmSync(base, { recursive: true, force: true });
  }
});

test('a swap cut halfway is detected and undone without the DB; a swap failing early still records failed.json', () => {
  const base = tmp(), app = join(base, 'app'), upd = join(app, '.update');
  try {
    tree(app, '1.0.0', { 'data/x.db': 'live-db' });
    tree(join(upd, 'staging'), '1.0.1');
    // Process killed after moving src only: marker written, not done.
    mkdirSync(join(upd, 'rollback'));
    cpSync(join(app, 'src'), join(upd, 'rollback', 'src'), { recursive: true });
    rmSync(join(app, 'src'), { recursive: true });
    cpSync(join(upd, 'staging', 'src'), join(app, 'src'), { recursive: true });
    writeFileSync(join(upd, 'unconfirmed'), JSON.stringify({ from: '1.0.0', to: '1.0.1', added: [], done: false }));
    assert.equal(interrupted(app), true);
    assert.equal(restore(app), true);
    assert.equal(read(app, 'src', 'server.js'), '1.0.0');
    assert.equal(read(app, 'package.json'), JSON.stringify({ version: '1.0.0', engines: { node: '>=1.0.0' } }));
    assert.equal(read(app, 'data', 'x.db'), 'live-db'); // the new version never ran: no snapshot to put back
    assert.equal(interrupted(app), false);

    // No staging folder: swap throws before writing any marker, yet auto-install must not retry this version forever.
    rmSync(join(upd, 'staging'), { recursive: true });
    assert.throws(() => swap(app, { from: '1.0.0', to: '1.0.2' }), { code: 'ENOENT' });
    assert.equal(failed(app)?.version, '1.0.2');
    assert.equal(read(app, 'src', 'server.js'), '1.0.0');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('install type: railway > docker > git > manual > zip', () => {
  const dir = tmp();
  try {
    assert.equal(installType(dir, { RAILWAY_ENVIRONMENT: 'production', CONTAINER: '1', TRAMEVIA_LAUNCHER: '1' }), 'railway');
    assert.equal(installType(dir, { RAILWAY_PUBLIC_DOMAIN: 'x.up.railway.app' }), 'railway');
    assert.equal(installType(dir, { CONTAINER: '1', TRAMEVIA_LAUNCHER: '1' }), 'docker');
    assert.equal(installType(dir, {}), 'manual');
    assert.equal(installType(dir, { TRAMEVIA_LAUNCHER: '1' }), 'zip');
    mkdirSync(join(dir, '.git'));
    assert.equal(installType(dir, { TRAMEVIA_LAUNCHER: '1' }), 'git');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('openDb refuses data written by a newer version', () => {
  const dir = tmp(), file = join(dir, 'x.db');
  try {
    openDb(file).close();
    const raw = new DatabaseSync(file);
    raw.exec('pragma user_version = 99');
    raw.close();
    assert.throws(() => openDb(file), /newer Tramevia Dock/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


// ---------------------------------------------------------------------------------------------------------------
// End to end on a temp copy of the app (this repo's src/, public/ and launchers, only the `ws` dependency).
// A preload (NODE_OPTIONS=--import) replaces fetch: it serves the release described in FAKE_GH and blocks everything else.
const PORT = 8851, BASE_URL = `http://localhost:${PORT}`;
const pkg = JSON.parse(read(REPO_DIR, 'package.json'));
const [MAJ, MIN, PAT] = pkg.version.split(/[.-]/).map(Number);
const V0 = pkg.version, V1 = `${MAJ}.${MIN}.${PAT + 1}`, V2 = `${MAJ}.${MIN}.${PAT + 2}`;
const FAKE_GITHUB = `import { readFileSync } from 'node:fs';
import { hash } from 'node:crypto';
globalThis.fetch = async input => {
  const url = String(input?.url ?? input);
  let rel = {};
  try { rel = JSON.parse(readFileSync(process.env.FAKE_GH, 'utf8')); } catch { /* no release */ }
  const buf = rel.file ? readFileSync(rel.file) : null;
  const dl = \`https://github.com/Tramevia/Tramevia-Dock/releases/download/v\${rel.version}/tramevia-dock-\${rel.version}.tar.gz\`;
  if (url === 'https://api.github.com/repos/Tramevia/Tramevia-Dock/releases/latest') {
    if (!buf) return Response.json({ message: 'Not Found' }, { status: 404 });
    return Response.json({ tag_name: 'v' + rel.version, draft: false, prerelease: false, html_url: 'https://github.com/x', body: '',
      assets: [{ name: \`tramevia-dock-\${rel.version}.tar.gz\`, size: buf.length, digest: 'sha256:' + hash('sha256', buf), browser_download_url: dl }] });
  }
  if (buf && url === dl) return new Response(buf);
  throw new TypeError('network blocked in tests: ' + url);
};
`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, what, ms = 30_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) if (await fn()) return;
  throw new Error(`timed out waiting for ${what}`);
}
const healthz = () => fetch(`${BASE_URL}/healthz`).then(r => r.json()).then(j => j.version, () => null);
async function call(path, body) {
  const res = await fetch(BASE_URL + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE_URL }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const schema = file => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare('pragma user_version').get().user_version; } finally { d.close(); } };

/** Temp app at V0 + bundles V1 (works) and V2 (bumps the DB schema, then crashes at startup). */
function setup() {
  const base = tmp(), app = join(base, 'app');
  const appTree = (dir, version, pad = 0) => {
    for (const d of ['src', 'public']) cpSync(join(REPO_DIR, d), join(dir, d), { recursive: true });
    const ws = JSON.parse(read(REPO_DIR, 'node_modules', 'ws', 'package.json')).version;
    cpSync(join(REPO_DIR, 'node_modules', 'ws'), join(dir, 'node_modules', 'ws'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...pkg, version }, null, 2));
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ packages: { '': {}, 'node_modules/ws': { version: ws } } })); // launcher dep check passes: no npm
    // Newer launchers move the frozen lines to other byte offsets (cmd re-reads start.bat by offset) and say who runs.
    const bat = read(REPO_DIR, 'start.bat').replace(/\r?\n/g, '\r\n').replace('\r\n', '\r\n' + 'rem padding\r\n'.repeat(pad))
      .replace(':run\r\n', pad ? `:run\r\necho [launcher ${version}]\r\n` : ':run\r\n');
    writeFileSync(join(dir, 'start.bat'), bat);
    writeFileSync(join(dir, 'start.sh'), read(REPO_DIR, 'start.sh'));
  };
  appTree(app, V0);
  mkdirSync(join(app, 'data'));
  writeFileSync(join(app, 'data', 'keep.txt'), 'user data');
  writeFileSync(join(app, '.env'), 'OPEN_BROWSER=0\n');
  const bundle = (version, pad, tweak = () => {}) => {
    const dir = join(base, `rel-${version}`), out = join(base, `tramevia-dock-${version}.tar.gz`);
    appTree(dir, version, pad);
    writeFileSync(join(dir, 'CHANGELOG.md'), `## ${version}`);
    tweak(dir);
    tarball(dir, out, ['src', 'public', 'node_modules', 'package.json', 'package-lock.json', 'start.bat', 'start.sh', 'CHANGELOG.md']);
    return out;
  };
  const file1 = bundle(V1, 3);
  const file2 = bundle(V2, 9, dir => writeFileSync(join(dir, 'src', 'server.js'),
    `import { DatabaseSync } from 'node:sqlite';\nconst db = new DatabaseSync(process.env.DATA_DIR + '/tramevia-dock.db');\n` +
    `db.exec('pragma user_version = 99'); // a migration the previous version cannot read\nthrow new Error('${V2} is broken');\n`));
  writeFileSync(join(base, 'fake-github.mjs'), FAKE_GITHUB);
  const serve = release => writeFileSync(join(base, 'fake-github.json'), JSON.stringify(release || {}));
  serve(null);
  const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', PUBLIC_URL: BASE_URL, DATA_DIR: join(app, 'data'), NO_OPEN: '1',
    UPDATE_CONFIRM_MS: '300', FAKE_GH: join(base, 'fake-github.json'), NODE_OPTIONS: `--import=${pathToFileURL(join(base, 'fake-github.mjs')).href}` };
  for (const k of ['CONTAINER', 'RAILWAY_ENVIRONMENT', 'RAILWAY_PUBLIC_DOMAIN', 'ADMIN_PASSWORD', 'DOCK_PASSWORD', 'UPDATE_CHECK', 'DEMO', 'TOKEN_KEY', 'TRAMEVIA_LAUNCHER']) delete env[k];
  return { base, app, env, serve, release1: { version: V1, file: file1 }, release2: { version: V2, file: file2 }, marker: join(app, '.update', 'unconfirmed') };
}

/** Spawn and collect output; `exited` resolves with the exit code. */
function run(cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const exited = new Promise(resolve => child.once('exit', code => resolve(code)));
  return { child, exited, output: () => output };
}

test('end to end: install → exit 75 → new version confirmed; crashing version → rollback CLI restores it', { timeout: 120_000 }, async () => {
  const s = setup(), servers = [];
  /** What a launcher does: start the server with TRAMEVIA_LAUNCHER=1. */
  const boot = async () => {
    const srv = run(process.execPath, ['src/server.js'], { cwd: s.app, env: { ...s.env, TRAMEVIA_LAUNCHER: '1' } });
    servers.push(srv);
    let exitCode = null;
    srv.exited.then(code => { exitCode = code; });
    await waitFor(async () => exitCode !== null || await healthz(), 'server start');
    return srv;
  };
  try {
    // 1. V0 finds V1 and installs it: exit 75, files swapped, data and .env untouched.
    s.serve(s.release1);
    let srv = await boot();
    let status = (await call('/api/update')).body;
    assert.equal(status.type, 'zip', srv.output());
    assert.equal(status.current, V0);
    assert.equal(status.live, 'off');
    // A second instance (double-click) exits 98, the code the launchers never roll back on.
    assert.equal(spawnSync(process.execPath, ['src/server.js'], { cwd: s.app, env: { ...s.env, TRAMEVIA_LAUNCHER: '1' } }).status, 98);
    status = (await call('/api/update/check', {})).body;
    assert.equal(status.latest?.version, V1, srv.output());
    assert.equal((await call('/api/update/install', { version: V0 })).body.code, 'version_mismatch');
    assert.deepEqual((await call('/api/update/install', { version: V1 })).body, { ok: true });
    assert.equal(await srv.exited, RESTART, srv.output());
    assert.equal(JSON.parse(read(s.app, 'package.json')).version, V1);
    assert.equal(JSON.parse(read(s.app, '.update', 'rollback', 'package.json')).version, V0);
    assert.equal(read(s.app, 'CHANGELOG.md'), `## ${V1}`);
    assert.ok(existsSync(s.marker));
    assert.ok(existsSync(join(s.app, 'data', 'pre-update.db')));
    assert.equal(read(s.app, 'data', 'keep.txt'), 'user data');
    assert.equal(read(s.app, '.env'), 'OPEN_BROWSER=0\n');
    const schemaBefore = schema(join(s.app, 'data', 'tramevia-dock.db'));

    // 2. Restarted: V1 runs, confirms itself, then finds V2 and installs it.
    s.serve(s.release2);
    srv = await boot();
    assert.equal((await call('/api/update')).body.current, V1, srv.output());
    await waitFor(() => !existsSync(s.marker), 'V1 confirmed');
    assert.equal((await call('/api/update/check', {})).body.latest?.version, V2);
    assert.deepEqual((await call('/api/update/install', { version: V2 })).body, { ok: true });
    assert.equal(await srv.exited, RESTART, srv.output());

    // 3. V2 bumps the schema and crashes at startup; the launcher would now run the previous version's updater.
    srv = await boot();
    const code = await srv.exited;
    assert.ok(code !== 0 && code !== RESTART, `crash exit code, got ${code}`);
    assert.match(srv.output(), new RegExp(`${V2} is broken`));
    assert.equal(schema(join(s.app, 'data', 'tramevia-dock.db')), 99);
    assert.ok(existsSync(s.marker));
    const cli = spawnSync(process.execPath, [join('.update', 'rollback.mjs'), 'rollback'], { cwd: s.app, env: s.env, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stdout + cli.stderr);
    assert.equal(JSON.parse(read(s.app, 'package.json')).version, V1);
    assert.equal(failed(s.app)?.version, V2);
    assert.equal(existsSync(s.marker), false);
    assert.equal(schema(join(s.app, 'data', 'tramevia-dock.db')), schemaBefore); // pre-update.db is back

    // 4. V1 starts again on the restored DB (the schema guard would refuse user_version 99) and reports the failed version.
    s.serve(null);
    srv = await boot();
    status = (await call('/api/update')).body;
    assert.equal(status.current, V1, srv.output());
    assert.deepEqual(status.failed, { version: V2, reason: '' });
    assert.equal(read(s.app, 'data', 'keep.txt'), 'user data');
  } finally {
    for (const srv of servers) if (srv.child.exitCode === null) { srv.child.kill(); await srv.exited; }
    rmSync(s.base, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('end to end with the real launcher (start.bat / start.sh): update, restart, crash, automatic rollback', { timeout: 120_000 }, async () => {
  const s = setup();
  const win = process.platform === 'win32';
  const launcher = run(win ? 'cmd.exe' : 'bash', win ? ['/d', '/c', '.\\start.bat'] : ['start.sh'], { cwd: s.app, env: s.env, detached: !win });
  let done = false;
  launcher.exited.then(() => { done = true; });
  const alive = what => { if (done) throw new Error(`launcher exited while waiting for ${what}:\n${launcher.output()}`); };
  try {
    s.serve(s.release1);
    await waitFor(async () => (alive('V0'), await healthz() === V0), 'V0');
    assert.equal((await call('/api/update/check', {})).body.latest?.version, V1, launcher.output());
    assert.deepEqual((await call('/api/update/install', { version: V1 })).body, { ok: true });
    await waitFor(async () => (alive('V1'), await healthz() === V1), 'V1 restarted by the launcher');
    await waitFor(() => !existsSync(s.marker), 'V1 confirmed');

    s.serve(s.release2);
    assert.equal((await call('/api/update/check', {})).body.latest?.version, V2, launcher.output());
    assert.deepEqual((await call('/api/update/install', { version: V2 })).body, { ok: true });
    // V2 crashes at startup → the launcher runs .update/rollback.mjs rollback → V1 again.
    await waitFor(async () => (alive('rollback'), failed(s.app)?.version === V2 && await healthz() === V1), 'V1 back after rollback');
    const out = launcher.output();
    assert.match(out, new RegExp(`${V2} is broken`));
    assert.match(out, /previous version restored/);
    if (win) assert.match(out, new RegExp(`\\[launcher ${V1}\\]`)); // cmd jumped into the new start.bat (other offsets)
    assert.equal(read(s.app, 'data', 'keep.txt'), 'user data');
  } finally {
    if (!done) {
      if (win) spawnSync('taskkill', ['/pid', String(launcher.child.pid), '/T', '/F']);
      else try { process.kill(-launcher.child.pid, 'SIGTERM'); } catch { /* gone */ }
      await launcher.exited;
    }
    await sleep(300);
    rmSync(s.base, { recursive: true, force: true, maxRetries: 10 });
  }
});
