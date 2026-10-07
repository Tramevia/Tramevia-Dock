// Dashboard access: password session cookie, dock key (full access) and overlay key (read-only).
// Without ADMIN_PASSWORD the app is only reachable on loopback and is open to local requests.
import { LOOPBACK } from './config.js';
import { HttpError, parseCookies } from './http.js';
import { randomId, safeEqual, sign } from './crypto.js';

const SESSION_DAYS = 30;
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function createAuth({ config, settings, log = console, t = (fr, en) => en }) {
  const cookieName = config.secure ? '__Host-od_session' : 'od_session';
  const publicName = String(config.publicHost || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const failures = new Map(); // client key -> [timestamps] (per client, so nobody can lock the owner out)

  let keys = settings.get('keys');
  if (!keys) {
    keys = { dock: randomId(24), overlay: randomId(24) };
    settings.set('keys', keys);
  }
  const epoch = () => settings.get('sessionEpoch', 0);

  // ADMIN_PASSWORD changed since last start → sign out every session and regenerate the dock key
  // (anyone who knew the old password could read it). The read-only overlay key is kept.
  const fingerprint = config.adminPassword ? sign(`pw.${config.adminPassword}`) : '';
  const previous = settings.get('pwFingerprint');
  if (previous !== null && previous !== fingerprint) {
    settings.set('sessionEpoch', epoch() + 1);
    keys = { ...keys, dock: randomId(24) };
    settings.set('keys', keys);
    log.warn?.('ADMIN_PASSWORD changed: all sessions signed out and the dock key regenerated (copy the new OBS dock URLs).');
  }
  if (previous !== fingerprint) settings.set('pwFingerprint', fingerprint);

  /**
   * Rate-limit key. X-Forwarded-For is trusted only from a configured proxy (TRUST_PROXY / Railway) or from a
   * same-host tunnel (loopback peer while PUBLIC_URL is public); otherwise the socket address is used, so a
   * client exposed directly (LAN, Docker) cannot pick a fresh bucket per request.
   */
  function clientKey(req) {
    const peer = req.socket.remoteAddress || '?';
    const viaProxy = config.trustProxy || (LOOPBACK_IPS.has(peer) && !LOOPBACK.has(publicName));
    const hop = viaProxy ? String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean).at(-1) : '';
    return hop || peer;
  }

  function sessionValue(exp) {
    return `${exp}.${sign(`session.${exp}.${epoch()}`)}`;
  }

  function validSession(value) {
    const [exp, sig] = String(value || '').split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    return safeEqual(sig, sign(`session.${exp}.${epoch()}`));
  }

  /** Password-less mode applies only to genuine loopback requests on a loopback-only install. */
  function openLocal(req) {
    if (config.adminPassword || !config.loopbackOnly) return false;
    const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    return LOOPBACK_IPS.has(req.socket.remoteAddress) && LOOPBACK.has(host) && !req.headers['x-forwarded-for'];
  }

  /** Returns 'admin' | 'read' | 'public'. */
  function access(req, url) {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    const key = bearer || url.searchParams.get('key') || '';
    if (key) {
      if (safeEqual(key, keys.dock)) return 'admin';
      if (safeEqual(key, keys.overlay)) return 'read';
    }
    if (validSession(parseCookies(req)[cookieName])) return 'admin';
    if (openLocal(req)) return 'admin';
    return 'public';
  }

  function login(req, res, password) {
    const now = Date.now();
    const key = clientKey(req);
    const recent = (failures.get(key) || []).filter(t => now - t < 5 * 60_000);
    if (recent.length >= 10) throw new HttpError(429, t('Trop de tentatives. Réessaie dans 5 minutes.', 'Too many attempts. Try again in 5 minutes.'), 'rate_limited');
    if (!config.adminPassword || typeof password !== 'string' || !safeEqual(password, config.adminPassword)) {
      recent.push(now);
      failures.delete(key); // re-insert at the end: eviction removes the stalest key, not an active attacker's
      failures.set(key, recent);
      if (failures.size > 10_000) failures.delete(failures.keys().next().value);
      throw new HttpError(403, t('Mot de passe incorrect.', 'Wrong password.'), 'bad_password');
    }
    failures.delete(key);
    const exp = now + SESSION_DAYS * 86400_000;
    res.setHeader('Set-Cookie', `${cookieName}=${sessionValue(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${config.secure ? '; Secure' : ''}`);
  }

  function logout(res) {
    res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.secure ? '; Secure' : ''}`);
  }

  function rotate(what) {
    if (what === 'sessions') settings.set('sessionEpoch', epoch() + 1);
    else if (what === 'dock' || what === 'overlay') {
      keys = { ...keys, [what]: randomId(24) };
      settings.set('keys', keys);
    } else throw new HttpError(400, 'Unknown key');
  }

  return {
    access,
    login,
    logout,
    rotate,
    keys: () => ({ ...keys }),
    passwordRequired: () => Boolean(config.adminPassword),
  };
}
