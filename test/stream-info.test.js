import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, account } from './helpers.js';
import { createRouter } from '../src/http.js';
import { validateChanges, tagsTotalLength, register } from '../src/stream-info.js';

const TWITCH = {
  title: { max: 140 }, category: { search: true },
  tags: { max: 10, maxLength: 25, pattern: '^[\\p{L}\\p{N}]+$', replaceAll: true },
  language: {}, labels: { options: ['Gambling', 'ProfanityVulgarity'] }, brandedContent: {},
};
const YOUTUBE = { title: { max: 100, forbid: '<>' }, description: { max: 5000, forbid: '<>' }, ytCategory: {}, tags: { totalLength: 500, replaceAll: true } };
const KICK = { title: { max: 140 }, category: { search: true }, tags: { max: 10, maxLength: 20, replaceAll: true } };
const errs = (fields, changes) => validateChanges(fields, changes).errors;

test('validateChanges: Twitch tags (unicode letters/digits only, max 10, 25 chars)', () => {
  assert.deepEqual(errs(TWITCH, { tags: ['Français', 'FR', 'Jeu2024', 'Ñandú', '日本語'] }), []);
  assert.equal(errs(TWITCH, { tags: ['two words'] }).length, 1, 'space refused');
  assert.equal(errs(TWITCH, { tags: ['gg🎮'] }).length, 1, 'emoji refused');
  assert.equal(errs(TWITCH, { tags: ['c#'] }).length, 1, 'symbol refused');
  assert.equal(errs(TWITCH, { tags: ['a'.repeat(26)] }).length, 1, '26 chars refused');
  assert.deepEqual(errs(TWITCH, { tags: ['é'.repeat(25)] }), [], '25 accented chars accepted');
  assert.match(errs(TWITCH, { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })[0], /Too many tags \(11\/10\)/);
  assert.equal(errs(TWITCH, { tags: ['FR', 'fr'] }).length, 1, 'case-insensitive duplicate refused');
  assert.equal(errs(TWITCH, { tags: ['  '] }).length, 1, 'empty tag refused');
  assert.deepEqual(validateChanges(TWITCH, { tags: [' Chill '] }).clean, { tags: ['Chill'] });
  assert.deepEqual(errs(TWITCH, { tags: [] }), [], 'empty list clears tags');
});

test('validateChanges: titles (length, forbidden chars, control chars)', () => {
  assert.deepEqual(errs(YOUTUBE, { title: 'x'.repeat(100) }), []);
  assert.match(errs(YOUTUBE, { title: 'x'.repeat(101) })[0], /too long \(101\/100\)/);
  assert.match(errs(YOUTUBE, { title: 'a <b> c' })[0], /cannot contain: < >/);
  assert.deepEqual(errs(TWITCH, { title: 'a <b> c' }), [], 'Twitch accepts < >');
  assert.deepEqual(errs(TWITCH, { title: '🎮'.repeat(140) }), [], 'emoji count as one character');
  assert.equal(errs(TWITCH, { title: '   ' }).length, 1, 'empty title refused');
  assert.equal(errs(TWITCH, { title: 'a\nb' }).length, 1, 'newline refused');
  assert.equal(errs(TWITCH, { title: 42 }).length, 1);
  assert.deepEqual(validateChanges(TWITCH, { title: '  Ranked ce soir  ' }).clean, { title: 'Ranked ce soir' });
});

test('validateChanges: YouTube tags total length (commas + quotes) and description bytes', () => {
  assert.equal(tagsTotalLength(['Foo-Baz']), 7);
  assert.equal(tagsTotalLength(['Foo Baz']), 9);
  assert.equal(tagsTotalLength(['ab', 'cd']), 5);
  const tags = Array.from({ length: 50 }, (_, i) => 'abcdefg' + String(i).padStart(2, '0')); // 50*9 + 49 = 499
  assert.deepEqual(errs(YOUTUBE, { tags }), []);
  assert.match(errs(YOUTUBE, { tags: [...tags.slice(1), 'abcdefghij k'] })[0], /too long in total \(504\/500/);
  assert.deepEqual(errs(YOUTUBE, { tags: ['tag with spaces'] }), [], 'YouTube tags may contain spaces');
  assert.deepEqual(errs(YOUTUBE, { description: 'é'.repeat(2500) }), [], '5000 bytes accepted');
  assert.match(errs(YOUTUBE, { description: 'é'.repeat(2501) })[0], /5002\/5000 bytes/);
  assert.deepEqual(errs(YOUTUBE, { description: 'line 1\r\nline 2\ttab' }), []);
  assert.equal(validateChanges(YOUTUBE, { description: 'a\r\nb' }).clean.description, 'a\nb');
});

test('validateChanges: only declared limits apply (same rule as the client), messages follow t(fr, en)', () => {
  // YouTube declares only totalLength: a 120-char tag or 120 short tags pass if the total fits.
  assert.deepEqual(errs(YOUTUBE, { tags: ['x'.repeat(120)] }), []);
  assert.deepEqual(errs(YOUTUBE, { tags: Array.from({ length: 120 }, (_, i) => String(i)) }), []);
  assert.deepEqual(errs({ title: {} }, { title: 'x'.repeat(6000) }), [], 'no declared title max');
  const fr = (f, e) => f;
  assert.match(validateChanges(YOUTUBE, { title: 'x'.repeat(101) }, fr).errors[0], /^Le titre est trop long \(101\/100\)/);
  assert.match(validateChanges(TWITCH, { tags: ['a'.repeat(26)] }, fr).errors[0], /^Le tag « a+ » est trop long \(25 caractères max\)/);
  assert.match(validateChanges(TWITCH, { password: 'x' }, fr).errors[0], /n’est pas modifiable/);
});

test('validateChanges: other fields and unknown keys', () => {
  assert.deepEqual(errs(TWITCH, { language: 'fr' }), []);
  assert.deepEqual(errs(TWITCH, { language: 'other' }), []);
  assert.deepEqual(errs(TWITCH, { language: 'pt-BR' }), []);
  assert.equal(errs(TWITCH, { language: 'français' }).length, 1);
  assert.deepEqual(errs(TWITCH, { labels: ['Gambling'] }), []);
  assert.equal(errs(TWITCH, { labels: ['MatureGame'] }).length, 1, 'label outside options');
  assert.equal(errs(TWITCH, { labels: ['Gambling', 'Gambling'] }).length, 1);
  assert.deepEqual(errs(TWITCH, { brandedContent: false }), []);
  assert.equal(errs(TWITCH, { brandedContent: 'yes' }).length, 1);
  assert.deepEqual(validateChanges(TWITCH, { category: { id: 509658, name: 'Just Chatting', image: 'x' } }).clean, { category: { id: '509658', name: 'Just Chatting' } });
  assert.equal(errs(TWITCH, { category: { id: '1', name: 'X', evil: 1 } }).length, 1, 'unknown category key');
  assert.equal(errs(TWITCH, { category: '509658' }).length, 1);
  assert.equal(errs(TWITCH, { category: { id: '../x', name: 'X' } }).length, 1);
  assert.deepEqual(errs(YOUTUBE, { ytCategoryId: '20' }), []);
  assert.equal(errs(YOUTUBE, { ytCategoryId: 'gaming' }).length, 1);
  // Keys the platform cannot edit, or that do not exist, are rejected.
  assert.match(errs(YOUTUBE, { category: { id: '1', name: 'X' } })[0], /cannot be edited/);
  assert.match(errs(KICK, { language: 'fr' })[0], /cannot be edited/);
  assert.match(errs(TWITCH, { title: 'ok', password: 'x' })[0], /"password" cannot be edited/);
  assert.equal(errs(TWITCH, JSON.parse('{"__proto__": {"title": "x"}}')).length, 1, 'prototype key rejected');
  assert.equal(errs(TWITCH, {}).length, 1, 'nothing to change');
  assert.equal(errs(TWITCH, null).length, 1);
  assert.equal(errs(TWITCH, ['title']).length, 1);
});

/** Kernel ctx with a router, two accounts and recording adapters. */
function setup({ failOn = null } = {}) {
  const ctx = fakeCtx();
  const calls = [];
  const adapter = (platform, infoFields, caps) => ({
    id: platform, infoFields, capabilities: caps,
    async getInfo(c, a) { if (a.id === 'yt') throw new Error('No upcoming broadcast'); return { title: `t-${a.id}`, category: null, tags: [] }; },
    async setInfo(c, a, changes) { calls.push({ id: a.id, changes }); if (a.id === failOn) throw new ctx.ApiError(platform, 400, null, 'Tag refused by AutoMod'); },
    async searchCategories(c, a, q) { return [{ id: 1, name: `${q} result`, image: 'javascript:alert(1)' }, { id: '2', name: 'Two', image: 'https://cdn.example/2.jpg' }]; },
  });
  ctx.adapters = new Map([
    ['twitch', adapter('twitch', TWITCH, { editInfo: true })],
    ['youtube', adapter('youtube', YOUTUBE, { editInfo: true })],
    ['tiktok', { id: 'tiktok', infoFields: {}, capabilities: () => ({ editInfo: false }) }],
  ]);
  const accounts = { tw: account({ id: 'tw' }), yt: account({ id: 'yt', platform: 'youtube' }), tt: account({ id: 'tt', platform: 'tiktok' }) };
  ctx.accounts.get = id => (Object.hasOwn(accounts, id) ? accounts[id] : null);
  ctx.adapterFor = a => ctx.adapters.get(a.platform);
  ctx.requireAccount = id => { const a = ctx.accounts.get(id); if (!a) throw Object.assign(new Error('Unknown account'), { status: 404 }); return a; };
  const router = createRouter();
  register(router, ctx);
  const call = async (method, path, { body = {}, query = {} } = {}) => {
    const found = router.match(method, path);
    assert.ok(found, `${method} ${path} is routed`);
    const res = { headersSent: false, writeHead(status) { this.status = status; this.headersSent = true; }, end(data) { this.data = JSON.parse(data); } };
    const out = await found.route.handler({ params: found.params, query, body, res });
    return res.headersSent ? { status: res.status, ...res.data } : { status: 200, ...out };
  };
  return { ctx, calls, call };
}

test('apply validates every account before calling any setInfo', async () => {
  const { calls, call } = setup();
  const bad = await call('POST', '/api/stream/apply', { body: { changes: { tw: { title: 'Ranked' }, yt: { title: 'x'.repeat(101) } } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.code, 'invalid');
  assert.deepEqual(Object.keys(bad.details), ['yt']);
  assert.equal(calls.length, 0, 'nothing applied when one account is invalid');

  const refused = await call('POST', '/api/stream/apply', { body: { changes: { tt: { title: 'x' }, ghost: { title: 'x' } } } });
  assert.equal(refused.status, 400);
  assert.deepEqual(Object.keys(refused.details).sort(), ['ghost', 'tt']);

  await assert.rejects(call('POST', '/api/stream/apply', { body: { changes: {} } }), { status: 400 }, 'empty changes rejected');
});

test('apply sends cleaned changes in parallel and reports per-account results', async () => {
  const { ctx, calls, call } = setup({ failOn: 'yt' });
  const out = await call('POST', '/api/stream/apply', { body: { changes: {
    tw: { title: '  Ranked  ', category: { id: '1', name: 'Fortnite', image: 'https://x' }, tags: ['FR'] },
    yt: { title: 'Ranked', ytCategoryId: 20 },
  } } });
  assert.equal(out.status, 200);
  assert.deepEqual(out.results, { tw: { ok: true }, yt: { ok: false, error: 'Tag refused by AutoMod' } });
  assert.deepEqual(calls.find(c => c.id === 'tw').changes, { title: 'Ranked', category: { id: '1', name: 'Fortnite' }, tags: ['FR'] });
  assert.deepEqual(calls.find(c => c.id === 'yt').changes, { title: 'Ranked', ytCategoryId: '20' });
  assert.deepEqual(ctx.stats, [{ id: 'tw', title: 'Ranked', category: 'Fortnite' }], 'stats pushed for the successful account only');
});

test('info, categories and options routes', async () => {
  const { call } = setup();
  const info = await call('GET', '/api/stream/info', { query: { accounts: 'tw,yt,ghost,tw' } });
  assert.deepEqual(info.results.tw, { ok: true, info: { title: 't-tw', category: null, tags: [] } });
  assert.deepEqual(info.results.yt, { ok: false, error: 'No upcoming broadcast' });
  assert.equal(info.results.ghost.ok, false);
  await assert.rejects(call('GET', '/api/stream/info', { query: {} }), { status: 400 });

  const cats = await call('GET', '/api/stream/categories', { query: { accountId: 'tw', q: 'Fort' } });
  assert.deepEqual(cats.categories, [{ id: '1', name: 'Fort result', image: '' }, { id: '2', name: 'Two', image: 'https://cdn.example/2.jpg' }]);
  await assert.rejects(call('GET', '/api/stream/categories', { query: { accountId: 'tw', q: 'F' } }), { status: 400 });
  await assert.rejects(call('GET', '/api/stream/categories', { query: { accountId: 'yt', q: 'Fort' } }), { status: 400 });
  await assert.rejects(call('GET', '/api/stream/categories', { query: { accountId: 'nope', q: 'Fort' } }), { status: 404 });

  const options = await call('GET', '/api/stream/options', { query: { accountId: 'tw' } });
  assert.equal(options.status, 200);
});

test('presets CRUD', async () => {
  const { ctx, call } = setup();
  const data = { title: 'Ranked', tags: ['FR'], category: { query: 'Fortnite' }, perAccount: { tw: { enabled: true, language: 'fr' } } };
  const a = await call('POST', '/api/presets', { body: { name: '  Soirée ranked ', data } });
  assert.equal(a.name, 'Soirée ranked');
  assert.deepEqual(a.data, data);
  const b = await call('POST', '/api/presets', { body: { name: 'Chill', data: {} } });
  assert.ok(b.position > a.position);
  assert.deepEqual((await call('GET', '/api/presets')).presets.map(p => p.name), ['Soirée ranked', 'Chill']);
  assert.equal(ctx.published.filter(f => f.t === 'presets').length, 2, 'changes broadcast to other pages');

  const renamed = await call('PUT', `/api/presets/${a.id}`, { body: { name: 'Ranked FR' } });
  assert.equal(renamed.name, 'Ranked FR');
  assert.deepEqual(renamed.data, data, 'data kept on rename');
  const updated = await call('PUT', `/api/presets/${a.id}`, { body: { data: { title: 'New' } } });
  assert.deepEqual(updated.data, { title: 'New' });
  assert.equal(updated.name, 'Ranked FR');

  await assert.rejects(call('POST', '/api/presets', { body: { name: '', data } }), { status: 400 });
  await assert.rejects(call('POST', '/api/presets', { body: { name: 'x'.repeat(61), data } }), { status: 400 });
  await assert.rejects(call('POST', '/api/presets', { body: { name: 'ok', data: [] } }), { status: 400 });
  await assert.rejects(call('POST', '/api/presets', { body: { name: 'ok', data: { blob: 'x'.repeat(33 * 1024) } } }), { code: 'too_large' });
  await assert.rejects(call('PUT', `/api/presets/${a.id}`, { body: {} }), { status: 400 });
  await assert.rejects(call('PUT', '/api/presets/nope', { body: { name: 'x' } }), { status: 404 });

  assert.deepEqual(await call('DELETE', `/api/presets/${a.id}`), { status: 200, ok: true });
  await assert.rejects(call('DELETE', `/api/presets/${a.id}`), { status: 404 });
  assert.deepEqual((await call('GET', '/api/presets')).presets.map(p => p.id), [b.id]);
});
