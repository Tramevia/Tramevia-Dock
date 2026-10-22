import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matcher, validate, createAutomod, DEFAULTS } from '../src/chat/automod.js';

const msg = (text, roles = [], flags = {}) => ({ id: 'm1', accountId: 'a1', text, author: { id: 'u1', login: 'bob', roles }, flags });

test('banned words: whole words, any case, accents ignored', () => {
  const m = matcher({ ...DEFAULTS, words: ['crétin', 'con', 'mot interdit'] });
  assert.equal(m(msg('quel CRETIN')), 'word');
  assert.equal(m(msg('con!')), 'word');
  assert.equal(m(msg('un Mot  interdit ici'.replace('  ', ' '))), 'word');
  assert.equal(m(msg('le contenu est top')), null);
  assert.equal(m(msg('rien à voir')), null);
});

test('links: scheme, www and spam domains, not plain sentences', () => {
  const m = matcher({ ...DEFAULTS, links: true });
  for (const t of ['https://x.y', 'va sur www.site.fr', 'bit.ly/abc', 'free-followers.xyz', 'PROMO.COM']) assert.equal(m(msg(t)), 'link', t);
  for (const t of ['salut.ca va', 'gg.', 'fin. Merci', '3.14']) assert.equal(m(msg(t)), null, t);
  assert.equal(matcher(DEFAULTS)(msg('https://x.y')), null); // links off
});

test('allowed links pass, with their subdomains, unless another link comes along', () => {
  const m = matcher({ ...DEFAULTS, links: true, allowedLinks: validate({ allowedLinks: ['https://www.YouTube.com/@moi', 'clips.twitch.tv'] }).settings.allowedLinks });
  for (const t of ['https://youtube.com/watch?v=1', 'www.youtube.com', 'm.youtube.com/x', 'clips.twitch.tv/Abc', 'youtube.com.']) assert.equal(m(msg(t)), null, t);
  for (const t of ['notyoutube.com', 'twitch.tv/x', 'youtube.com et bit.ly/x', 'https://evil.com/youtube.com']) assert.equal(m(msg(t)), 'link', t);
  assert.equal(m(msg('écris à moi@gmail.com')), null); // an e-mail is not a link
  assert.ok(validate({ allowedLinks: ['pas un lien'] }).error);
});

test('broadcaster, moderators, own messages and exempt roles pass', () => {
  const m = matcher({ ...DEFAULTS, words: ['nul'], exemptVip: true, exemptSub: false });
  assert.equal(m(msg('nul', ['broadcaster'])), null);
  assert.equal(m(msg('nul', ['moderator'])), null);
  assert.equal(m(msg('nul', [], { self: true })), null);
  assert.equal(m(msg('nul', ['vip'])), null);
  assert.equal(m(msg('nul', ['subscriber'])), 'word');
});

test('validate keeps defaults and rejects bad values', () => {
  assert.deepEqual(validate({}).settings, DEFAULTS);
  assert.deepEqual(validate({ words: [' a ', 'a', '', 'b  c'] }).settings.words, ['a', 'b c']);
  assert.ok(validate({ action: 'ban' }).error);
  assert.ok(validate({ duration: 0 }).error);
  assert.ok(validate({ links: 'yes' }).error);
  assert.ok(validate({ words: ['x'.repeat(51)] }).error);
});

test('check hides the message and deletes then times out on the platform', async () => {
  const calls = [];
  const store = new Map();
  const account = { id: 'a1' };
  const ctx = {
    settings: { get: (k, f) => store.get(k) ?? f, set: (k, v) => store.set(k, v) },
    accounts: { get: () => account, describe: () => ({ caps: { deleteMessage: true, timeout: true, limits: { timeoutMax: 300 } } }) },
    adapterFor: () => ({ moderate: async (c, a, action) => { calls.push(action); return { ok: true }; } }),
    log: { warn() {} },
  };
  const am = createAutomod(ctx);
  am.set({ ...DEFAULTS, words: ['nul'], action: 'timeout', duration: 600 });
  const m = msg('t nul');
  assert.equal(am.check(m), 'word');
  assert.equal(m.deleted, true);
  assert.equal(m.flags.filtered, 'word');
  assert.equal(calls.length, 0); // runs after the message is published
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls.map(c => [c.action, c.messageId || c.userId, c.duration]), [['delete', 'm1', undefined], ['timeout', 'u1', 300]]);
  assert.equal(am.check(msg('ok')), null);
  assert.deepEqual(store.get('automod').words, ['nul']);
});

test('anti-spam: capitals, repeats, emote and symbol floods', () => {
  let clock = 0;
  const m = matcher({ ...DEFAULTS, caps: true, repeat: true, emotes: true, symbols: true }, () => clock);
  assert.equal(m(msg('ARRÊTE DE CRIER COMME ÇA STP')), 'caps');
  assert.equal(m(msg('GG WP')), null); // too short to be shouting
  assert.equal(m({ ...msg('LUL LUL LUL LUL LUL ok'), tokens: [...Array(5)].map(() => ({ t: 'emote', name: 'LUL' })).concat({ t: 'text', v: ' ok' }) }), null); // emote names are not shouting
  const emotes = { ...msg('x'), tokens: [...Array(11)].map(() => ({ t: 'emote', name: 'Kappa' })) };
  assert.equal(m(emotes), 'emotes');
  assert.equal(m(msg('😂'.repeat(11))), 'emotes');
  assert.equal(m(msg('😂'.repeat(10))), null);
  assert.equal(m(msg('!!!!!!!!!!!!!!!!!!!!')), 'symbols');
  assert.equal(m(msg('ok... vraiment ?! :) (oui)')), null);
  const spam = { ...msg('achète mes follows'), author: { id: 'u9', roles: [] } };
  assert.equal(m(spam), null);
  clock = 30_000;
  assert.equal(m({ ...spam, text: 'Achète  mes follows' }), null);
  assert.equal(m(spam), 'repeat'); // 3rd copy within a minute
  clock = 200_000;
  assert.equal(m(spam), null); // a minute later it starts over
  assert.equal(matcher({ ...DEFAULTS, caps: true })(msg('ARRÊTE DE CRIER COMME ÇA STP', ['moderator'])), null);
  assert.equal(validate({ caps: true, repeat: false }).settings.caps, true);
  assert.ok(validate({ symbols: 1 }).error);
});
