import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mockFetch } from './helpers.js';
import { tokenize, loadEmotes, _inject, _reset } from '../src/chat/emotes.js';

const U = (host, id) => `https://cdn.${host}/emote/${id}/2x.webp`;
const tw = (...fragments) => tokenize({ platform: 'twitch', channelId: '1234', fragments });
const text = v => ({ t: 'text', v });

beforeEach(() => {
  _reset();
  _inject({ provider: '7tv', emotes: [
    { name: 'catJAM', url: U('7tv.app', 'g1') },
    { name: 'RainTime', url: U('7tv.app', 'zw1'), zw: true },
    { name: 'SteerR', url: U('7tv.app', 'zw2'), zw: true },
  ] });
  _inject({ provider: '7tv', platform: 'twitch', channelId: '1234', emotes: [{ name: 'catJAM', url: U('7tv.app', 'chan') }] });
  _inject({ provider: 'bttv', emotes: [{ name: 'cvMask', url: U('betterttv.net', 'b1'), zw: true }, { name: 'monkaS', url: U('betterttv.net', 'b2') }] });
  _inject({ provider: 'ffz', emotes: [
    { name: 'ffzHyper', url: U('frankerfacez.com', 'f1'), zw: true, hide: true },
    { name: 'LookingOutAWreath', url: U('frankerfacez.com', 'f2'), zw: true },
  ] });
});

test('emoji / surrogate pairs before an emote', () => {
  assert.deepEqual(tw(text('😀👍🏽 monkaS 🇫🇷')), [text('😀👍🏽 '), { t: 'emote', name: 'monkaS', url: U('betterttv.net', 'b2') }, text(' 🇫🇷')]);
});

test('channel emote overrides a global one with the same name', () => {
  assert.equal(tw(text('catJAM'))[0].url, U('7tv.app', 'chan'));
  assert.equal(tokenize({ platform: 'twitch', channelId: '999', fragments: [text('catJAM')] })[0].url, U('7tv.app', 'g1'));
  assert.equal(tokenize({ platform: 'youtube', channelId: '1234', fragments: [text('catJAM')] })[0].t, 'text', '7TV does not apply to YouTube');
});

test('7TV zero-width emotes stack on the previous emote', () => {
  const out = tw(text('a catJAM RainTime SteerR b'));
  assert.deepEqual(out, [text('a '), { t: 'emote', name: 'catJAM', url: U('7tv.app', 'chan'), zw: [
    { name: 'RainTime', url: U('7tv.app', 'zw1') }, { name: 'SteerR', url: U('7tv.app', 'zw2') }] }, text(' b')]);
  // No emote right before → rendered as a normal emote
  assert.deepEqual(tw(text('hi RainTime')), [text('hi '), { t: 'emote', name: 'RainTime', url: U('7tv.app', 'zw1') }]);
});

test('BTTV zero-width by name, on a native Twitch emote', () => {
  const out = tw({ t: 'emote', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0' }, text(' cvMask'));
  assert.deepEqual(out, [{ t: 'emote', name: 'Kappa', url: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0', zw: [{ name: 'cvMask', url: U('betterttv.net', 'b1') }] }]);
});

test('FFZ hidden modifier is skipped on a target, shown alone, visible modifier stacks', () => {
  assert.deepEqual(tw(text('monkaS ffzHyper LookingOutAWreath !')), [
    { t: 'emote', name: 'monkaS', url: U('betterttv.net', 'b2'), zw: [{ name: 'LookingOutAWreath', url: U('frankerfacez.com', 'f2') }] }, text(' !')]);
  assert.equal(tw(text('ffzHyper'))[0].t, 'emote');
});

test('native Twitch and Kick-style fragments pass through, adjacent text merges', () => {
  const kick = { t: 'emote', name: 'HYPERCLAP', url: 'https://files.kick.com/emotes/4148074/fullsize' };
  const frags = [text('Hello '), kick, text(' a'), text('b '), { t: 'mention', v: '@Tramevia' }, { t: 'cheer', name: 'Cheer', amount: 100, url: 'https://x.test/c.gif' }];
  const out = tokenize({ platform: 'kick', channelId: '676', fragments: frags });
  assert.deepEqual(out, [text('Hello '), kick, text(' ab '), { t: 'mention', v: '@Tramevia' }, frags[5]]);
  assert.notEqual(out[1], kick, 'native tokens are copied, never mutated');
  assert.deepEqual(tw({ t: 'emote', name: 'Bad', url: 'javascript:alert(1)' }), [text('Bad')]);
  assert.deepEqual(tw({ t: 'gif', text: 'gif!' }), [text('gif!')]);
});

test('HTML injection stays text', () => {
  const v = '<img src=x onerror=alert(1)>';
  assert.deepEqual(tw(text(v)), [text(v)]);
});

test('links: only strict http(s)', () => {
  assert.deepEqual(tw(text('javascript:alert(1)')), [text('javascript:alert(1)')]);
  assert.deepEqual(tw(text('voir https://example.com/a?b=c.')), [text('voir '), { t: 'link', v: 'https://example.com/a?b=c', href: 'https://example.com/a?b=c' }, text('.')]);
  assert.deepEqual(tw(text('http://example.org/x)')), [{ t: 'link', v: 'http://example.org/x', href: 'http://example.org/x' }, text(')')]);
  assert.deepEqual(tw(text('HTTPS://Example.com')), [{ t: 'link', v: 'HTTPS://Example.com', href: 'https://example.com/' }]);
  assert.equal(tw(text('https://twitch.tv@evil.example/x'))[0].t, 'text', 'credentials in URL are not linkified');
  assert.equal(tw(text('https://localhost'))[0].t, 'text');
});

test('@mentions', () => {
  assert.deepEqual(tw(text('yo @Tramevia_TV, ça va @Zéphyr? @ mail@x.fr')), [
    text('yo '), { t: 'mention', v: '@Tramevia_TV' }, text(', ça va '), { t: 'mention', v: '@Zéphyr' }, text('? @ mail@x.fr')]);
});

test('empty and odd inputs never throw', () => {
  for (const input of [undefined, null, {}, { fragments: null }, { fragments: 'plain @a' }, { fragments: [null, 1, 'x', {}, { t: 'text' }, { t: 'text', v: 42 }] },
    { platform: 'nope', channelId: {}, fragments: [text('')] }, { platform: 'twitch', channelId: '../x', fragments: [text('   ')] },
    { fragments: [{ t: 'text', v: { toString() { throw new Error('boom'); } } }] }]) {
    assert.ok(Array.isArray(tokenize(input)));
  }
  assert.deepEqual(tokenize({ fragments: [{ t: 'text', v: 42 }] }), [text('42')]);
  assert.deepEqual(tokenize({ fragments: 'plain @a' }), [text('plain '), { t: 'mention', v: '@a' }]);
});

test('loadEmotes: URLs, response shapes, cache and dedupe', async () => {
  _reset();
  const warn = console.warn; const warnings = [];
  console.warn = m => warnings.push(m);
  const bodies = {
    '/v3/emote-sets/global': { emotes: [{ name: 'RainTime', flags: 1, data: { flags: 256, host: { url: '//cdn.7tv.app/emote/Z1', files: [{ name: '1x.webp', format: 'WEBP' }, { name: '2x.webp', format: 'WEBP' }] } } }] },
    '/v3/users/twitch/42': { emote_set: { emotes: [
      { name: 'reeferSad', flags: 0, data: { name: 'TriSad', flags: 0, host: { url: '//cdn.7tv.app/emote/A1', files: [{ name: '2x.avif', format: 'AVIF' }, { name: '2x.webp', format: 'WEBP' }] } } },
      { name: 'evil', flags: 0, data: { flags: 0, host: { url: '//evil.example/emote/x', files: [{ name: '2x.webp', format: 'WEBP' }] } } },
    ] } },
    '/3/cached/emotes/global': [{ id: 'g1', code: 'cvHazmat', modifier: false }, { id: 'g2', code: 'w!', modifier: true }],
    '/3/cached/users/twitch/42': { channelEmotes: [{ id: 'c1', code: 'forsenE' }], sharedEmotes: [{ id: 's1', code: 'RebeccaBlack' }] },
    '/v1/set/global': { default_sets: [3], sets: {
      3: { emoticons: [{ name: 'ZreknarF', urls: { 1: '//cdn.frankerfacez.com/emote/1/1', 2: '//cdn.frankerfacez.com/emote/1/2' }, modifier: false, modifier_flags: 0 },
        { name: 'ffzX', urls: { 1: 'https://cdn.frankerfacez.com/emote/9/1' }, modifier: true, modifier_flags: 3 }] },
      99: { emoticons: [{ name: 'NotDefault', urls: { 1: 'https://cdn.frankerfacez.com/emote/5/1' } }] } } },
  };
  const m = mockFetch(async url => {
    await new Promise(r => setTimeout(r, 5));
    if (url.pathname === '/v1/room/id/42') return { status: 404, body: { message: 'not found' } };
    return bodies[url.pathname] ? { body: bodies[url.pathname] } : { status: 500, body: {} };
  });
  try {
    await Promise.all([loadEmotes('twitch', '42'), loadEmotes('twitch', 42)]);
    assert.equal(m.calls.length, 6, 'concurrent loads are deduped');
    assert.deepEqual(m.calls.map(c => c.url.host).sort(), ['7tv.io', '7tv.io', 'api.betterttv.net', 'api.betterttv.net', 'api.frankerfacez.com', 'api.frankerfacez.com']);
    assert.deepEqual(warnings, [], '404 = channel without emotes, not an error');
    const t = s => tokenize({ platform: 'twitch', channelId: '42', fragments: [text(s)] });
    assert.deepEqual(t('reeferSad RainTime'), [{ t: 'emote', name: 'reeferSad', url: 'https://cdn.7tv.app/emote/A1/2x.webp', zw: [{ name: 'RainTime', url: 'https://cdn.7tv.app/emote/Z1/2x.webp' }] }]);
    assert.equal(t('evil')[0].t, 'text', 'non-CDN host rejected');
    assert.deepEqual(t('forsenE cvHazmat'), [{ t: 'emote', name: 'forsenE', url: 'https://cdn.betterttv.net/emote/c1/2x.webp', zw: [{ name: 'cvHazmat', url: 'https://cdn.betterttv.net/emote/g1/2x.webp' }] }]);
    assert.equal(t('RebeccaBlack')[0].t, 'emote');
    assert.equal(t('w!')[0].t, 'text', 'BTTV text modifiers are not images');
    assert.deepEqual(t('ZreknarF ffzX'), [{ t: 'emote', name: 'ZreknarF', url: 'https://cdn.frankerfacez.com/emote/1/2' }]);
    assert.equal(t('NotDefault')[0].t, 'text', 'only FFZ default_sets');

    await loadEmotes('twitch', '42');
    assert.equal(m.calls.length, 6, 'cached for the TTL');
    await loadEmotes('kick', '676');
    assert.deepEqual(m.calls.slice(6).map(c => c.url.pathname), ['/v3/users/kick/676'], 'Kick: 7TV only, global already cached');
    await loadEmotes('kick', '677');
    assert.equal(warnings.length, 1, 'failures logged once per provider');
    assert.equal(tokenize({ platform: 'kick', channelId: '676', fragments: [text('RainTime')] })[0].t, 'emote', 'global still usable');
    await loadEmotes('youtube', 'UCabc');
    assert.deepEqual(m.calls.slice(8).map(c => c.url.pathname).sort(), ['/3/cached/users/youtube/UCabc', '/v1/room/yt/UCabc']);
    await loadEmotes('twitch', '../../x');
    await loadEmotes('tiktok', 'x');
    assert.equal(m.calls.length, 10, 'invalid ids and unsupported platforms fetch nothing');
  } finally {
    m.restore();
    console.warn = warn;
  }
});
