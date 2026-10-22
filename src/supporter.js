// Supporter code (settings key 'supporter'): unlocks the supporter alert styles (SUPPORTER_STYLES in overlay-settings.js).
// A code is TD1-<payload>.<signature>: payload = base64url JSON { n: name, x?: 'YYYY-MM-DD' expiry }, signed with the
// project's Ed25519 key. Only the public key ships here; codes are made with a tool kept outside the repository.
import { createPublicKey, verify } from 'node:crypto';

const KEY = createPublicKey({ key: Buffer.from('MCowBQYDK2VwAyEAdvavBS8S4ZVmxBzSs1oBUyyP4FWoKegehePBmJmNoPE=', 'base64'), format: 'der', type: 'spki' });

/** { name, until, expired } for a genuine code, else null. */
export function readCode(code, { key = KEY, now = Date.now() } = {}) {
  const m = /^TD1-([\w-]{4,400})\.([\w-]{40,200})$/.exec(String(code ?? '').trim());
  if (!m) return null;
  try {
    if (!verify(null, Buffer.from(m[1]), key, Buffer.from(m[2], 'base64url'))) return null;
    const p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    const until = typeof p.x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.x) ? p.x : null;
    return { name: String(p.n ?? '').slice(0, 80), until, expired: Boolean(until && now >= Date.parse(until)) };
  } catch {
    return null;
  }
}

export function createSupporter({ settings, key = KEY }) {
  const info = () => readCode(settings.get('supporter'), { key });
  return {
    info,
    unlocked: () => { const i = info(); return Boolean(i && !i.expired); },
    /** Info of the code; stored only when genuine and not expired. */
    set(code) { const i = readCode(code, { key }); if (i && !i.expired) settings.set('supporter', String(code).trim()); return i; },
    clear() { settings.set('supporter', null); },
  };
}
