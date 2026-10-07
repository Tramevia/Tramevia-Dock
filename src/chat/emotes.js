// Chat tokenizer + third-party emotes (7TV, BTTV, FFZ). SPEC.md §3 / §5.
// Dependency-free. Emote sets are fetched by loadEmotes() (adapters call ctx.emotes.load at connect)
// and cached per provider × scope; tokenize() is synchronous and only reads the cache.
// ponytail: no 7TV EventAPI / BTTV socket live updates — sets refresh every TTL; add EventAPI if users ask.

const TTL = 10 * 60_000;
// Providers per platform, in precedence order (7TV beats BTTV beats FFZ within the same scope).
// 7TV rejects YouTube ('invalid platform'); BTTV and FFZ have no Kick support (verified 2026-10-07).
const PROVIDERS = { __proto__: null, twitch: ['7tv', 'bttv', 'ffz'], kick: ['7tv'], youtube: ['bttv', 'ffz'] };
const GLOBAL_URL = {
  '7tv': 'https://7tv.io/v3/emote-sets/global',
  bttv: 'https://api.betterttv.net/3/cached/emotes/global',
  ffz: 'https://api.frankerfacez.com/v1/set/global',
};
const CHANNEL_URL = {
  '7tv': (p, id) => `https://7tv.io/v3/users/${p}/${id}`,
  bttv: (p, id) => `https://api.betterttv.net/3/cached/users/${p}/${id}`,
  ffz: (p, id) => `https://api.frankerfacez.com/v1/room/${p === 'youtube' ? 'yt' : 'id'}/${id}`,
};
// BTTV has no zero-width flag in its API: community-standard hardcoded overlay list.
const BTTV_ZW = new Set(['cvHazmat', 'cvMask', 'IceCold', 'SoSnowy', 'TopHat', 'SantaHat', 'CandyCane', 'ReinDeer']);
const CDN = /^https:\/\/cdn\.(?:7tv\.app|betterttv\.net|frankerfacez\.com)\/[\w\-./]+$/;
const CHANNEL_ID = /^[\w-]{1,64}$/;

const cdnUrl = u => {
  if (typeof u !== 'string') return null;
  if (u.startsWith('//')) u = 'https:' + u;
  return CDN.test(u) ? u : null;
};

// Each parser returns [{name, url, zw?, hide?}] (zw = stacks on the previous emote, hide = applies but is not drawn).
const PARSE = {
  '7tv': d => (d?.emote_set ? d.emote_set.emotes : d?.emotes)?.map(e => {
    const files = e?.data?.host?.files || [];
    const f = files.find(f => f.name === '2x.webp') || files.find(f => f.format === 'WEBP');
    return f && { name: e.name, url: cdnUrl(`${e.data.host.url}/${f.name}`), zw: !!(e.flags & 1 || e.data.flags & 256) };
  }),
  bttv: d => (Array.isArray(d) ? d : [...(d?.channelEmotes || []), ...(d?.sharedEmotes || [])])
    .filter(e => !e?.modifier) // modifier:true = text modifiers (w!, h!…), not images
    .map(e => ({ name: e.code, url: cdnUrl(`https://cdn.betterttv.net/emote/${e.id}/2x.webp`), zw: BTTV_ZW.has(e.code) })),
  ffz: d => (d?.default_sets ? d.default_sets.map(id => d.sets?.[id]) : Object.values(d?.sets || {}))
    .flatMap(s => s?.emoticons || []).map(e => {
      const anim = e?.animated && (e.animated[2] || e.animated[1]);
      return {
        name: e?.name, url: cdnUrl(anim ? anim + '.webp' : e?.urls?.[2] || e?.urls?.[1]),
        zw: !!e?.modifier, hide: !!(e?.modifier && e.modifier_flags & 1), // FFZ "Hidden" effect flag
      };
    }),
};

const toMap = list => new Map((list || [])
  .filter(e => e?.url && typeof e.name === 'string' && e.name && !/\s/.test(e.name))
  .map(e => [e.name, { name: e.name, url: e.url, zw: !!e.zw, hide: !!e.hide }]));

const cache = new Map(); // key ('7tv' = global, '7tv:twitch:123' = channel) → {at, map, pending?}
const warned = new Set();
const EMPTY = new Map();

async function fetchSet(provider, platform, channelId) {
  const res = await fetch(channelId ? CHANNEL_URL[provider](platform, channelId) : GLOBAL_URL[provider], {
    headers: { Accept: 'application/json', 'User-Agent': 'TrameviaDock/1 (+https://github.com/Tramevia/Tramevia-Dock)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return EMPTY; // channel not registered with this provider: normal
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return toMap(PARSE[provider](await res.json()));
}

function load(provider, platform, channelId) {
  const key = channelId ? `${provider}:${platform}:${channelId}` : provider;
  const old = cache.get(key);
  if (old?.pending) return old.pending;
  if (old && Date.now() - old.at < TTL) return;
  const pending = fetchSet(provider, platform, channelId).then(map => {
    cache.set(key, { at: Date.now(), map });
    warned.delete(provider);
  }, err => {
    if (!warned.has(provider)) { warned.add(provider); console.warn(`[emotes] ${provider} unavailable (${err.message}); retry in 10 min`); }
    cache.set(key, { at: Date.now(), map: old?.map || EMPTY }); // keep stale emotes on failure
  });
  cache.set(key, { at: old?.at ?? 0, map: old?.map || EMPTY, pending });
  return pending;
}

const validId = id => (typeof id === 'string' || typeof id === 'number') && CHANNEL_ID.test(String(id)) ? String(id) : '';

/** Fetch + cache the global and channel emote sets for a platform channel. Never throws. */
export async function loadEmotes(platform, channelId) {
  const providers = PROVIDERS[platform];
  if (!providers) return;
  const id = validId(channelId);
  await Promise.all(providers.flatMap(p => [load(p, platform), id && load(p, platform, id)]));
}

// Cached maps for a channel, channel scope first. Stale entries refresh in the background.
function mapsFor(platform, channelId) {
  const providers = PROVIDERS[platform];
  if (!providers) return [];
  const id = validId(channelId);
  const maps = [];
  for (const [p, cid] of [...(id ? providers.map(p => [p, id]) : []), ...providers.map(p => [p, ''])]) {
    const e = cache.get(cid ? `${p}:${platform}:${cid}` : p);
    if (!e) continue;
    if (e.map.size) maps.push(e.map);
    if (!e.pending && Date.now() - e.at > TTL) load(p, platform, cid);
  }
  return maps;
}

const MENTION = /^(@[\p{L}\p{N}_](?:[\p{L}\p{N}_.-]*[\p{L}\p{N}_])?)(.*)$/su;
const LINK = /^https?:\/\/\S+$/i;

function link(word) {
  if (!LINK.test(word)) return null;
  let v = word.replace(/[.,!?;:]+$/, '');
  if (v.endsWith(')') && !v.includes('(')) v = v.slice(0, -1);
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes('.')) return null;
    return { token: { t: 'link', v, href: u.href }, rest: word.slice(v.length) };
  } catch { return null; }
}

function pushText(out, v) {
  if (!v) return;
  const last = out[out.length - 1];
  if (last?.t === 'text') last.v += v;
  else out.push({ t: 'text', v });
}

function text(out, str, maps) {
  for (const word of str.split(/(\s+)/)) {
    if (!word) continue;
    if (/^\s/.test(word)) { pushText(out, word); continue; }
    let e;
    for (const m of maps) if ((e = m.get(word))) break;
    if (e) {
      // Zero-width / modifier: stacks on the emote right before it (only whitespace in between).
      const gap = out[out.length - 1]?.t === 'text' && !out[out.length - 1].v.trim() ? 1 : 0;
      const prev = out[out.length - 1 - gap];
      if (e.zw && prev?.t === 'emote') {
        if (gap) out.pop();
        if (!e.hide) prev.zw = [...(prev.zw || []), { name: e.name, url: e.url }];
        continue;
      }
      out.push({ t: 'emote', name: e.name, url: e.url });
      continue;
    }
    const l = link(word);
    if (l) { out.push(l.token); pushText(out, l.rest); continue; }
    const m = word[0] === '@' && MENTION.exec(word);
    if (m) { out.push({ t: 'mention', v: m[1] }); pushText(out, m[2]); continue; }
    pushText(out, word);
  }
}

const NATIVE = new Set(['emote', 'mention', 'link', 'cheer']);
const plain = f => (f?.t === 'emote' || f?.t === 'cheer' ? f.name : f?.v ?? f?.text ?? '');

/** Turn adapter fragments into render tokens (SPEC §5). Never throws. */
export function tokenize(input) {
  let fragments = input?.fragments;
  try {
    if (typeof fragments === 'string') fragments = [{ t: 'text', v: fragments }];
    if (!Array.isArray(fragments)) return [];
    const maps = mapsFor(input.platform, input.channelId);
    const out = [];
    for (const f of fragments) {
      if (!f || typeof f !== 'object') continue;
      if (f.t === 'text') text(out, String(f.v ?? ''), maps);
      else if (f.t === 'emote' && !/^https?:\/\//i.test(f.url)) pushText(out, String(f.name ?? '')); // no image without an http(s) URL
      else if (NATIVE.has(f.t)) out.push({ ...f });
      else pushText(out, String(plain(f))); // unknown fragment type (e.g. a future Twitch type): keep its text
    }
    return out;
  } catch {
    try { return [{ t: 'text', v: fragments.map(f => String(plain(f))).join('') }]; } catch { return []; }
  }
}

/** Test helper: inject an emote set without network. No platform → global set of that provider. */
export function _inject({ provider, platform, channelId, emotes }) {
  cache.set(platform ? `${provider}:${platform}:${channelId}` : provider, { at: Infinity, map: toMap(emotes) });
}

/** Test helper: clear every cached set and the warning memory. */
export function _reset() { cache.clear(); warned.clear(); }
