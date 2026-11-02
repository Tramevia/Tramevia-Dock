// serveStatic (src/http.js): compressed bodies follow every edit, one ETag per encoding, /premium/ files stamped like /assets/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { serveStatic } from '../src/http.js';

/** A folder with assets/ (the stamp) and the given files. */
function folder(files) {
  const root = mkdtempSync(join(tmpdir(), 'http-'));
  mkdirSync(join(root, 'assets'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, name), body);
  return root;
}

async function get(root, path, headers = {}, assets) {
  const out = {};
  const res = { req: { headers }, writeHead(status, h) { Object.assign(out, { status, headers: h }); }, end(body) { out.body = body; } };
  await serveStatic(res, root, path, null, assets);
  out.text = out.headers['Content-Encoding'] === 'br' ? brotliDecompressSync(out.body).toString() : String(out.body ?? '');
  return out;
}

test('a page edited without any asset change is served compressed in its new version', async () => {
  const root = folder({ 'page.html': `<p>${'a'.repeat(2000)}</p>` });
  assert.match((await get(root, 'page.html', { 'accept-encoding': 'br' })).text, /<p>a/);
  writeFileSync(join(root, 'page.html'), `<p>${'b'.repeat(2000)}</p>`);
  const again = await get(root, 'page.html', { 'accept-encoding': 'br' });
  assert.equal(again.headers['Content-Encoding'], 'br');
  assert.match(again.text, /<p>b/);
});

test('one ETag per encoding, and the 304 says it varies', async () => {
  const root = folder({ 'assets/app.js': `// ${'x'.repeat(2000)}` });
  const br = await get(root, 'assets/app.js', { 'accept-encoding': 'br' });
  const plain = await get(root, 'assets/app.js');
  assert.notEqual(br.headers.ETag, plain.headers.ETag);
  assert.equal((await get(root, 'assets/app.js', { 'if-none-match': br.headers.ETag })).status, 200, 'the br tag does not validate the plain body');
  const hit = await get(root, 'assets/app.js', { 'accept-encoding': 'br', 'if-none-match': br.headers.ETag });
  assert.equal(hit.status, 304);
  assert.equal(hit.headers.Vary, 'Accept-Encoding');
});

test('/assets/ references in another folder (the supporter pack) carry the stamp of the public assets', async () => {
  const pub = folder({ 'page.html': '<img src="/assets/logo.svg">', 'assets/logo.svg': '<svg/>' });
  const pack = folder({ 'assets/decor.js': 'const u = "/assets/logo.svg";' });
  const stamp = (await get(pub, 'page.html')).text.match(/\?v=([\w-]+)/)[1];
  const decor = await get(pack, 'assets/decor.js', {}, pub);
  assert.match(decor.text, new RegExp(`/assets/logo\\.svg\\?v=${stamp}"`));
  assert.ok(decor.headers.ETag.includes(stamp), 'the tag changes when the public assets change');
});
