// Supporter styles pack: the eight supporter alert styles are not in this repository. Once a supporter code is active, the dock
// downloads them from the Tramevia server (GET <url>/pack?api=1, the code as Bearer token), keeps them in <dir>/assets/ (the
// data volume, so a cloud install keeps them across restarts) and serves them at /premium/ to the alerts overlay.
// No code, or a code the server refuses (expired, revoked): the pack is deleted. Server unreachable: the pack already here stays.
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PREMIUM_API = 1; // the contract with the pack: init({ h, svg }) in decor.js + alerts.css; the server answers 409 to another one
const NAME = /^[\w-]+(\.[\w-]+)*\.(js|css)$/;

/** code(): the active supporter code or null. onChange(): the pack appeared, changed or went away. */
export function createPremium({ dir, url, code, fetch = globalThis.fetch, onChange = () => {}, log = console }) {
  let version = null;
  let status = 'none'; // none | ok | refused (code refused by the server) | offline (unreachable, pack kept) | outdated (dock too old)
  const loaded = readFile(join(dir, 'version.json'), 'utf8').then(s => { version = JSON.parse(s).version || null; }).catch(() => {});

  async function drop() {
    await rm(dir, { recursive: true, force: true });
    if (version) { version = null; onChange(); }
  }

  async function run() {
    await loaded;
    const c = code();
    if (!c || !url) { status = 'none'; return drop(); }
    let res;
    try {
      res = await fetch(`${url}/pack?api=${PREMIUM_API}`, {
        headers: { Authorization: `Bearer ${c}`, ...(version && { 'If-None-Match': `"${version}"` }) },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      status = 'offline';
      return log.warn(`[premium] server unreachable, pack kept: ${err.message}`);
    }
    if (res.status === 304) { status = 'ok'; return; }
    if (res.status === 401 || res.status === 403) { status = 'refused'; return drop(); }
    if (res.status === 409) { status = 'outdated'; return; }
    if (!res.ok) { status = 'offline'; return log.warn(`[premium] server answered ${res.status}, pack kept`); }
    const pack = await res.json().catch(() => null);
    const files = Object.entries(pack?.files ?? {});
    if (typeof pack?.version !== 'string' || !files.length || !files.every(([n, body]) => NAME.test(n) && typeof body === 'string')
      || !pack.files['decor.js'] || !pack.files['alerts.css']) { status = 'offline'; return log.warn('[premium] malformed pack, ignored'); }
    // Written next to the pack, then swapped in: an overlay never loads half a pack.
    const tmp = `${dir}.new`;
    await rm(tmp, { recursive: true, force: true });
    await mkdir(join(tmp, 'assets'), { recursive: true });
    for (const [n, body] of files) await writeFile(join(tmp, 'assets', n), body);
    await writeFile(join(tmp, 'version.json'), JSON.stringify({ version: pack.version }));
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
    version = pack.version;
    status = 'ok';
    log.info(`[premium] supporter styles ${version} downloaded`);
    onChange();
  }

  let queue = Promise.resolve();
  return {
    version: () => version,
    info: () => ({ version, status }),
    /** Download, update or delete the pack for the current code. Calls never overlap; never throws. */
    sync: () => (queue = queue.then(run).catch(err => { status = 'offline'; log.warn(`[premium] ${err.message}`); })),
  };
}
