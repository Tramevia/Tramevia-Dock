// Secrets at rest: AES-256-GCM with a key derived (HKDF) from TOKEN_KEY or a generated key file.
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let sealKey;
let macKey;

export function initKeys(tokenKey, dataDir) {
  let material = tokenKey;
  if (!material) {
    const file = join(dataDir, 'secret.key');
    try {
      material = readFileSync(file, 'utf8').trim();
    } catch {
      material = randomBytes(32).toString('hex');
      writeFileSync(file, material, { flag: 'wx', mode: 0o600 });
    }
  }
  sealKey = Buffer.from(hkdfSync('sha256', material, 'tramevia-dock', 'seal-v1', 32));
  macKey = Buffer.from(hkdfSync('sha256', material, 'tramevia-dock', 'mac-v1', 32));
}

/** Encrypt a JSON value. `aad` binds the ciphertext to its owner (e.g. "account:<id>"). */
export function seal(value, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey, iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return 'v1.' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

/** Decrypt a value produced by seal(). Throws if the key, AAD or data do not match. */
export function unseal(text, aad) {
  if (typeof text !== 'string' || !text.startsWith('v1.')) throw new Error('Unknown sealed format');
  const raw = Buffer.from(text.slice(3), 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', sealKey, raw.subarray(0, 12), { authTagLength: 16 });
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
}

export function sign(text) {
  return createHmac('sha256', macKey).update(text).digest('base64url');
}

export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export const randomId = (bytes = 16) => randomBytes(bytes).toString('base64url');

export function pkcePair() {
  const verifier = randomId(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
