// Chat HTTP API: send, moderate, user card, featured message, Twitch-style quick actions. SPEC.md §7.1.
import { HttpError } from '../http.js';

const MOD_CAPS = { delete: 'deleteMessage', timeout: 'timeout', ban: 'ban', unban: 'unban' };
const MAX_TIMEOUT = 1_209_600; // 14 days, in seconds
const MAX_TEXT = 500;

/** Request bodies may be any JSON value: treat non-objects as empty. */
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function register(router, ctx) {
  const caps = account => ctx.accounts.describe(account).caps || {};
  const invalid = (fr, en) => new HttpError(400, ctx.t(fr, en), 'invalid');

  /** Optional bounded string: undefined when absent, HttpError when not a string or too long. */
  function optStr(value, max, name) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || value.length > max) throw invalid(`Champ invalide : ${name}`, `Invalid ${name}`);
    return value;
  }
  function reqStr(value, max, name) {
    const s = optStr(value, max, name);
    if (s === undefined) throw invalid(`Champ manquant : ${name}`, `Missing ${name}`);
    return s;
  }

  /** Keep only the fields the overlay renders (the dock is trusted, but the overlay is on stream). */
  function cleanMessage(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || JSON.stringify(m).length > 16_000) throw invalid('Message invalide', 'Invalid message');
    const { id, platform, accountId, channel, ts, author, text, tokens, reply, flags } = m;
    return {
      id, platform: String(platform || ''), accountId: String(accountId || ''), channel: String(channel || ''), ts: Number(ts) || Date.now(),
      author: author && typeof author === 'object' ? author : { id: '', login: '', name: '', color: '', avatar: '', badges: [], roles: [] },
      text: String(text || ''), tokens: Array.isArray(tokens) ? tokens : [], reply: reply && typeof reply === 'object' ? reply : null,
      flags: flags && typeof flags === 'object' ? flags : {}, deleted: false,
    };
  }

  /** Account that has `cap` and whose adapter implements `method`, or an HttpError. */
  function capable(id, cap, method) {
    const account = ctx.requireAccount(reqStr(id, 100, 'accountId'));
    if (!caps(account)[cap] || typeof ctx.adapterFor(account)?.[method] !== 'function') {
      throw new HttpError(400, ctx.t('Ce compte ne permet pas cette action.', 'This account does not support this action.'), 'unsupported');
    }
    return account;
  }

  router.post('/api/chat/send', async ({ body: raw }) => {
    const body = obj(raw);
    const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
    const length = [...text].length;
    if (!text || length > MAX_TEXT) throw invalid(`Le message doit faire de 1 à ${MAX_TEXT} caractères.`, `Message must be 1–${MAX_TEXT} characters.`);
    const targets = Array.isArray(body.targets) ? [...new Set(body.targets)] : [];
    if (!targets.length || targets.length > 20 || targets.some(id => typeof id !== 'string' || id.length > 100)) {
      throw invalid('Choisis au moins un compte.', 'Choose at least one account.');
    }
    let replyTo = null;
    if (body.replyTo) {
      const r = obj(body.replyTo);
      replyTo = { accountId: reqStr(r.accountId, 100, 'replyTo'), messageId: reqStr(r.messageId, 200, 'replyTo') };
    }
    const notSent = ctx.t('Message non envoyé.', 'Message not sent.');
    const results = {};
    await Promise.all(targets.map(async id => {
      try {
        const account = ctx.accounts.get(id);
        if (!account) return void (results[id] = { ok: false, error: ctx.t('Compte inconnu', 'Unknown account'), code: 'unknown_account' });
        const adapter = ctx.adapterFor(account);
        const c = caps(account);
        if (!c.chatSend || typeof adapter?.send !== 'function') {
          return void (results[id] = { ok: false, error: ctx.t('Ce compte ne peut pas envoyer de message.', 'Sending is not supported on this account.'), code: 'unsupported' });
        }
        const max = c.limits?.chatMaxLength;
        if (max && length > max) {
          return void (results[id] = { ok: false, error: ctx.t(`Message trop long pour cette plateforme (${max} caractères max).`, `Message too long for this platform (${max} characters max).`), code: 'too_long' });
        }
        const reply = replyTo?.accountId === id && c.reply ? replyTo.messageId : undefined;
        const r = await adapter.send(ctx, account, { text, replyTo: reply });
        results[id] = r?.ok === false ? { ok: false, error: r.error || notSent, code: 'rejected' } : { ok: true, ...(r?.id && { id: r.id }) };
      } catch (err) {
        ctx.log.warn(`[chat] send failed on ${id}: ${err.message}`);
        results[id] = { ok: false, error: err.message || notSent, code: 'platform_error' };
      }
    }));
    return { results };
  });

  router.post('/api/chat/moderate', async ({ body: raw }) => {
    const body = obj(raw);
    const cap = MOD_CAPS[body.action];
    if (!cap) throw invalid('Action inconnue', 'Unknown action');
    const account = capable(body.accountId, cap, 'moderate');
    const action = {
      action: body.action,
      messageId: optStr(body.messageId, 200, 'messageId'),
      userId: optStr(body.userId, 200, 'userId'),
      userLogin: optStr(body.userLogin, 100, 'userLogin'),
      reason: optStr(body.reason, 500, 'reason'),
      duration: undefined,
    };
    if (body.action === 'delete' && !action.messageId) throw invalid('Champ manquant : messageId', 'Missing messageId');
    if (body.action !== 'delete' && !action.userId) throw invalid('Champ manquant : userId', 'Missing userId');
    if (body.action === 'timeout') {
      const { timeoutMin = 1, timeoutMax = MAX_TIMEOUT } = caps(account).limits || {};
      const min = Math.max(1, timeoutMin), max = Math.min(MAX_TIMEOUT, timeoutMax);
      action.duration = Number(body.duration);
      if (!Number.isInteger(action.duration) || action.duration < min || action.duration > max) {
        throw invalid(`Sur cette plateforme, l’exclusion doit durer de ${min} à ${max} secondes.`, `Timeout must be ${min}–${max} seconds on this platform.`);
      }
    }
    const r = await ctx.adapterFor(account).moderate(ctx, account, action);
    if (r?.ok === false) throw new HttpError(502, r.error || ctx.t('La plateforme a refusé cette action.', 'The platform refused this action.'), 'platform_error');
    return { ok: true };
  });

  router.get('/api/chat/user', async ({ query }) => {
    const account = ctx.requireAccount(reqStr(query.accountId, 100, 'accountId'));
    const userId = reqStr(query.userId, 200, 'userId');
    // Same platform user across every connected channel of that platform (e.g. two Twitch accounts).
    const messages = ctx.hub.backlog()
      .filter(f => f.t === 'chat' && f.d.platform === account.platform && String(f.d.author?.id) === userId)
      .map(f => f.d).slice(-100);
    const user = messages.at(-1)?.author || null;
    const adapter = ctx.adapterFor(account);
    let info, infoError;
    if (typeof adapter?.userInfo === 'function') {
      try { info = await adapter.userInfo(ctx, account, userId); } catch (err) { infoError = err.message; }
    }
    return { user, messages, ...(info && { info }), ...(infoError && { infoError }) };
  });

  router.post('/api/chat/feature', ({ body: raw }) => {
    const body = obj(raw);
    if (body.message === null || body.message === undefined) {
      ctx.hub.publish('feature', null);
      return { ok: true };
    }
    const wanted = cleanMessage(body.message);
    // Prefer the server's own copy when it is still in the backlog: it knows whether the message was deleted.
    const known = ctx.hub.backlog().find(f => f.t === 'chat' && f.d.id === wanted.id && f.d.accountId === wanted.accountId)?.d;
    if (known?.deleted || body.message.deleted === true) {
      throw new HttpError(409, ctx.t('Ce message a été supprimé : il ne peut pas être affiché sur l’overlay.', 'This message was deleted: it cannot be shown on the overlay.'), 'deleted');
    }
    // featuredAt lets an overlay that reconnects skip a card whose featureSeconds already ran out.
    ctx.hub.publish('feature', { ...(known || wanted), featuredAt: Date.now() });
    return { ok: true };
  });

  router.post('/api/actions/marker', async ({ body: raw }) => {
    const body = obj(raw);
    const account = capable(body.accountId, 'markers', 'marker');
    const description = optStr(body.description, 140, 'description') || '';
    return ctx.adapterFor(account).marker(ctx, account, { description });
  });

  router.post('/api/actions/clip', async ({ body: raw }) => {
    const body = obj(raw);
    const account = capable(body.accountId, 'clips', 'clip');
    return ctx.adapterFor(account).clip(ctx, account);
  });
}
