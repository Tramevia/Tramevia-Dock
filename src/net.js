// Outbound HTTP helper for platform APIs (global fetch, no dependency).

export class ApiError extends Error {
  constructor(platform, status, body, message) {
    super(message || `${platform} API error ${status}`);
    this.platform = platform;
    this.status = status;
    this.body = body;
  }
}

function errorMessage(body) {
  if (!body || typeof body !== 'object') return typeof body === 'string' ? body.slice(0, 300) : '';
  const e = body.error;
  return body.message || body.error_description || (typeof e === 'object' ? e?.message : e) || '';
}

/**
 * request(url, { platform, method, token, clientId, headers, json, form, timeout })
 * Returns parsed JSON (or text / null for empty bodies). Throws ApiError on non-2xx.
 * GET requests are retried once on 429/502/503 (waiting Retry-After, max 5 s).
 */
export async function request(url, opts = {}) {
  const { platform = 'http', method = 'GET', token, clientId, json, form, timeout = 15000 } = opts;
  const headers = { Accept: 'application/json', 'User-Agent': 'TrameviaDock/1 (+https://github.com/Tramevia/Tramevia-Dock)', ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (clientId) headers['Client-Id'] = clientId;
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form !== undefined) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeout) });
    const text = await res.text();
    let data = text;
    if (text && (res.headers.get('content-type') || '').includes('json')) {
      try { data = JSON.parse(text); } catch { /* keep text */ }
    }
    if (res.ok) return text ? data : null;
    if (method === 'GET' && attempt === 0 && [429, 502, 503].includes(res.status)) {
      const wait = Math.min(5, Number(res.headers.get('retry-after')) || 1);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    throw new ApiError(platform, res.status, data, errorMessage(data) || `${platform} HTTP ${res.status}`);
  }
}
