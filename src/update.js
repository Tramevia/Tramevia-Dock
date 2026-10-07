// Self-update for ZIP installs started by start.bat / start.sh (SPEC.md §11). Imports node: built-ins ONLY: its copy
// in .update/rollback.mjs must run on its own (`node .update/rollback.mjs rollback`, used by the launchers).
import { spawnSync } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash } from 'node:crypto';

const REPO = 'Tramevia/Tramevia-Dock';                    // hard-coded: never take a URL from a request or a release body
const KEEP = new Set(['data', '.env', '.update', '.git']); // an update never touches these
// Windows: System32 bsdtar by absolute path (Git-for-Windows' GNU tar reads "C:\…" as a remote host).
const TAR = process.platform === 'win32' ? join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
export const RESTART = 75;                                 // exit code the launchers loop on (unused by Node itself)

const semver = v => String(v).match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
/** a > b for X.Y.Z[-pre] (a release beats its own pre-releases). */
export function newer(a, b) {
  const x = semver(a), y = semver(b);
  if (!x || !y) return false;
  for (let i = 1; i <= 3; i++) if (+x[i] !== +y[i]) return +x[i] > +y[i];
  return !x[4] && Boolean(y[4]);
}

/** 'railway' | 'docker' | 'git' | 'manual' | 'zip'. Only 'zip' ever modifies its own files. */
export function installType(root, env = process.env) {
  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PUBLIC_DOMAIN) return 'railway';
  if (env.CONTAINER) return 'docker';
  if (existsSync(join(root, '.git'))) return 'git';
  if (env.TRAMEVIA_LAUNCHER !== '1') return 'manual'; // npm start, pm2, service: nobody restarts us on exit 75
  try { accessSync(root, constants.W_OK); } catch { return 'manual'; }
  return 'zip';
}

/** One unauthenticated request (60/h per IP): call it about once a day. → null | {version, notesUrl, url, size, digest} */
export async function checkLatest(current) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'user-agent': `tramevia-dock/${current}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null; // no release yet (or the repo is private)
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`); // 403/429 rate limited, 5xx: keep what we knew, try again next cycle
  const rel = (await res.json()) || {};
  const tag = String(rel.tag_name || '');
  const version = tag.slice(1);
  if (rel.draft || rel.prerelease || !/^v\d+\.\d+\.\d+$/.test(tag) || !newer(version, current)) return null;
  const asset = (Array.isArray(rel.assets) ? rel.assets : []).find(a => a?.name === `tramevia-dock-${version}.tar.gz`);
  if (!asset || !/^sha256:[0-9a-f]{64}$/.test(asset.digest || '')) return null; // no checksum, no update
  if (!String(asset.browser_download_url).startsWith(`https://github.com/${REPO}/releases/download/${tag}/`)) return null;
  return { version, notesUrl: `https://github.com/${REPO}/releases/tag/${tag}`, url: asset.browser_download_url, size: asset.size, digest: asset.digest };
}

const fail = (code, message, extra) => Object.assign(new Error(message), { update: code }, extra);

/** Download, verify (size + SHA-256), extract to .update/staging and sanity-check. Throws; changes nothing outside .update/. */
export async function stage(root, upd) {
  const res = await fetch(upd.url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw fail('download', `Download failed (HTTP ${res.status})`, { status: res.status });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== upd.size || `sha256:${hash('sha256', buf)}` !== upd.digest) throw fail('corrupt', 'Download corrupted (size or SHA-256 mismatch)');
  const dir = join(root, '.update'), st = join(dir, 'staging'); // inside the app folder: same volume, so rename() works (no EXDEV)
  rmSync(st, { recursive: true, force: true });
  mkdirSync(st, { recursive: true });
  writeFileSync(join(dir, 'download.tar.gz'), buf);
  // Relative paths: no drive letter for tar to misread, no non-ASCII folder name to convert.
  const r = spawnSync(TAR, ['-xzf', 'download.tar.gz', '-C', 'staging'], { cwd: dir, windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0) throw fail('tar', `tar failed: ${r.error?.message || r.stderr}`);
  let pkg = null;
  try { pkg = JSON.parse(readFileSync(join(st, 'package.json'), 'utf8')); } catch { /* checked below */ }
  if (pkg?.version !== upd.version || !existsSync(join(st, 'src', 'server.js')) || !existsSync(join(st, 'node_modules'))) throw fail('bundle', 'Unexpected bundle content');
  const m = String(pkg.engines?.node || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  const need = m && `${m[1]}.${m[2] || 0}.${m[3] || 0}`;
  if (need && newer(need, process.versions.node)) throw fail('node', `Install Node.js ${need} first`, { need });
}

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const retry = fn => { // Windows: antivirus / indexer / OneDrive may hold a fresh file for a moment
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) { if (i >= 20 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; sleep(250); }
  }
};

/**
 * Sync, after the HTTP server and the DB are closed. Writes .update/unconfirmed first, then renames each staged
 * top-level entry into place (the current one goes to .update/rollback). Rename only, never copy over.
 * On error: restore() (or at least record failed.json, so auto-install does not retry it in a loop) and throw.
 */
export function swap(root, { from, to, db = null, snapshot = null }) {
  const dir = join(root, '.update'), st = join(dir, 'staging'), rb = join(dir, 'rollback'), added = [];
  // done: every file is in place. Only then may the new version migrate the DB, so only then does a rollback need the snapshot.
  const mark = (done = false) => writeFileSync(join(dir, 'unconfirmed'), JSON.stringify({ from, to, added, done, ...(done && { db, snapshot }) }));
  try {
    // The launchers' rollback CLI: this file, kept outside the folders a swap moves around.
    copyFileSync(fileURLToPath(import.meta.url), join(dir, 'rollback.mjs'));
    rmSync(rb, { recursive: true, force: true });
    mkdirSync(rb);
    const names = readdirSync(st).filter(n => !KEEP.has(n));
    mark();
    for (const n of names) {
      if (existsSync(join(root, n))) retry(() => renameSync(join(root, n), join(rb, n)));
      else { added.push(n); mark(); }
      retry(() => renameSync(join(st, n), join(root, n)));
    }
    mark(true);
  } catch (err) {
    if (!restore(root, err.message)) writeFileSync(join(dir, 'failed.json'), JSON.stringify({ version: to, reason: err.message }));
    throw err;
  }
}

/** True when a swap stopped halfway (window closed, power cut): server.js restores before opening anything. */
export function interrupted(root) {
  try { return !JSON.parse(readFileSync(join(root, '.update', 'unconfirmed'), 'utf8')).done; } catch { return false; }
}

/** Put the previous version (and its DB snapshot) back, record failed.json. No marker = nothing to undo → false. */
export function restore(root, reason = '') { // '' = the new version did not start (the UI says so in the dashboard language)
  const dir = join(root, '.update'), rb = join(dir, 'rollback'), marker = join(dir, 'unconfirmed');
  if (!existsSync(marker)) return false;
  const m = JSON.parse(readFileSync(marker, 'utf8'));
  // DB first: if it is still open (Windows locks it), nothing has moved yet and the marker stays for a later try.
  if (m.db && m.snapshot && existsSync(m.snapshot)) {
    for (const f of [`${m.db}-wal`, `${m.db}-shm`]) retry(() => rmSync(f, { force: true }));
    retry(() => copyFileSync(m.snapshot, m.db));
  }
  for (const n of [...(existsSync(rb) ? readdirSync(rb) : []), ...(m.added || [])]) {
    retry(() => rmSync(join(root, n), { recursive: true, force: true }));
    if (existsSync(join(rb, n))) retry(() => renameSync(join(rb, n), join(root, n)));
  }
  writeFileSync(join(dir, 'failed.json'), JSON.stringify({ version: m.to || null, reason: String(reason) }));
  rmSync(marker, { force: true });
  return true;
}

/** The new version runs fine: drop the rollback trigger and the leftovers (.update/rollback stays until the next update). */
export function confirm(root) {
  const dir = join(root, '.update');
  for (const f of ['unconfirmed', 'failed.json', 'download.tar.gz', 'staging']) rmSync(join(dir, f), { recursive: true, force: true });
}

/** → {version, reason} of the last rolled-back update, or null. */
export function failed(root) {
  try { return JSON.parse(readFileSync(join(root, '.update', 'failed.json'), 'utf8')); } catch { return null; }
}

// CLI, run by the launchers from the app folder after a failed first start: node .update/rollback.mjs rollback
if (import.meta.main && process.argv[2] === 'rollback') {
  let ok = false;
  try { ok = restore(process.cwd()); } catch (err) { console.error(err.message); }
  console.log(ok ? '[FR] La nouvelle version n’a pas démarré : version précédente restaurée. / [EN] The new version did not start: previous version restored.'
    : '[FR] Rien à restaurer. / [EN] Nothing to roll back.');
  process.exitCode = ok ? 0 : 1;
}
