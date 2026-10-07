// Runtime configuration. Everything comes from environment variables (or .env);
// platform app credentials can also be entered in the setup wizard (stored sealed in the DB).
import { readFileSync } from 'node:fs';

try { process.loadEnvFile(); } catch { /* no .env file: fine */ }

const env = process.env;
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const port = Number(env.PORT) || 8787;
const cloud = Boolean(env.RAILWAY_PUBLIC_DOMAIN || env.RAILWAY_ENVIRONMENT || env.CONTAINER);
const host = env.HOST || (cloud ? '0.0.0.0' : '127.0.0.1');
const fallbackUrl = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${port}`;
const publicUrl = (env.PUBLIC_URL || fallbackUrl).trim().replace(/\/+$/, '');

export const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

export const config = {
  version: pkg.version,
  port,
  host,
  publicUrl,
  publicHost: new URL(publicUrl).host.toLowerCase(),
  secure: publicUrl.startsWith('https://'),
  loopbackOnly: LOOPBACK.has(host),
  dataDir: env.DATA_DIR || (cloud ? '/data' : './data'),
  adminPassword: env.ADMIN_PASSWORD || env.DOCK_PASSWORD || '', // DOCK_PASSWORD = v1 name
  tokenKey: env.TOKEN_KEY || '',
  allowedHosts: (env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  demo: env.DEMO === '1' || process.argv.includes('--demo'),
  openBrowser: env.OPEN_BROWSER !== '0' && !cloud,
  // Trust X-Forwarded-For only behind a known reverse proxy (Railway sets it; TRUST_PROXY=1 for nginx/Caddy/Traefik).
  trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === '1' : Boolean(env.RAILWAY_PUBLIC_DOMAIN || env.RAILWAY_ENVIRONMENT),
  // Platform app credentials from env take precedence over the wizard.
  apps: {
    twitch: { clientId: env.TWITCH_CLIENT_ID, clientSecret: env.TWITCH_CLIENT_SECRET },
    kick: { clientId: env.KICK_CLIENT_ID, clientSecret: env.KICK_CLIENT_SECRET },
    youtube: { clientId: env.YOUTUBE_CLIENT_ID, clientSecret: env.YOUTUBE_CLIENT_SECRET },
  },
};

export function checkConfig() {
  const problems = [];
  if (!/^https?:\/\/[^/]+$/.test(config.publicUrl)) problems.push('PUBLIC_URL must look like https://example.com (no path).');
  const publicName = config.publicHost.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if ((!config.loopbackOnly || !LOOPBACK.has(publicName)) && !config.adminPassword) {
    problems.push('ADMIN_PASSWORD is required when the server is reachable from the network (HOST is not 127.0.0.1 or PUBLIC_URL is not localhost).');
  }
  if (config.adminPassword && config.adminPassword.length < 12) problems.push('ADMIN_PASSWORD must be at least 12 characters.');
  if (config.tokenKey && config.tokenKey.length < 32) problems.push('TOKEN_KEY must be at least 32 characters.');
  return problems;
}
