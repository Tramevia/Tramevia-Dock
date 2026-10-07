// Stream info: read / apply title, category, tags… on several accounts at once, plus
// multi-platform presets. SPEC.md §6 (infoFields) and §7.3 (HTTP API).
import { HttpError, sendJson } from './http.js';
import { randomId } from './crypto.js';

// StreamInfo key -> infoFields key that makes it editable.
const FIELD_OF = {
  title: 'title', category: 'category', tags: 'tags', language: 'language', labels: 'labels',
  brandedContent: 'brandedContent', description: 'description', ytCategoryId: 'ytCategory',
};
const CONTROL = /[\u0000-\u001f\u007f]/;
const MAX_IDS = 50;
const len = s => [...s].length; // code points: an emoji counts once
const short = s => (len(s) > 40 ? [...s].slice(0, 40).join('') + '…' : s);

/** YouTube rule: commas between tags count, and a tag containing a space counts its quotes. */
export const tagsTotalLength = tags => tags.reduce((n, tag) => n + len(tag) + (tag.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1);

/**
 * Check `changes` (Partial<StreamInfo>) against a platform's infoFields.
 * Returns { errors: string[], clean } — `clean` is the normalized value to send (only valid keys).
 * `t(fr, en)` picks the message language (pass ctx.t); English by default.
 *
 * Limits rule, shared with the client mirror (problems() in public/assets/stream.js): a limit
 * (max, maxLength, pattern, totalLength, forbid) applies only when the adapter declares it in
 * infoFields. Undeclared = no limit here; the platform API stays the final judge, and the request
 * body limit (256 KB) bounds the input.
 */
export function validateChanges(fields = {}, changes, t = (fr, en) => en) {
  const errors = [];
  const clean = {};
  const fail = msg => errors.push(msg);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { errors: [t('Les modifications doivent être un objet.', 'Changes must be an object.')], clean };
  const keys = Object.keys(changes);
  if (!keys.length) fail(t('Rien à modifier.', 'Nothing to change.'));
  for (const key of keys) {
    const field = Object.hasOwn(FIELD_OF, key) ? fields[FIELD_OF[key]] : undefined;
    if (!field) { fail(t(`« ${short(key)} » n’est pas modifiable sur cette plateforme.`, `"${short(key)}" cannot be edited on this platform.`)); continue; }
    const v = changes[key];
    switch (key) {
      case 'title':
      case 'description': {
        const [Fr, En] = key === 'title' ? ['Le titre', 'Title'] : ['La description', 'Description'];
        if (typeof v !== 'string') { fail(t(`${Fr} doit être du texte.`, `${En} must be text.`)); break; }
        const s = key === 'title' ? v.trim() : v.replace(/\r\n?/g, '\n');
        // YouTube limits the description in UTF-8 bytes, titles in characters.
        const size = key === 'description' ? Buffer.byteLength(s) : len(s);
        const max = field.max ?? Infinity;
        const [uFr, uEn] = key === 'description' ? [' octets', ' bytes'] : ['', ''];
        if (key === 'title' && !s) fail(t('Le titre ne peut pas être vide.', 'Title cannot be empty.'));
        if (size > max) fail(t(`${Fr} est trop long${key === 'title' ? '' : 'ue'} (${size}/${max}${uFr}).`, `${En} is too long (${size}/${max}${uEn}).`));
        const bad = [...new Set([...(field.forbid || '')].filter(c => s.includes(c)))];
        if (bad.length) fail(t(`${Fr} ne peut pas contenir : ${bad.join(' ')}`, `${En} cannot contain: ${bad.join(' ')}`));
        if ((key === 'title' ? CONTROL : /[\u0000-\u0008\u000b-\u001f\u007f]/).test(s)) fail(t(`${Fr} contient des caractères de contrôle.`, `${En} contains control characters.`));
        clean[key] = s;
        break;
      }
      case 'category': {
        const shape = v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => ['id', 'name', 'image'].includes(k));
        const id = shape && ['string', 'number'].includes(typeof v.id) ? String(v.id) : '';
        const name = shape && typeof v.name === 'string' ? v.name.trim() : '';
        if (!/^[\w-]{1,64}$/.test(id) || !name || len(name) > 200 || CONTROL.test(name)) fail(t('La catégorie doit être choisie dans la recherche de catégories.', 'Category must be {id, name} picked from the category search.'));
        else clean.category = { id, name };
        break;
      }
      case 'tags': {
        if (!Array.isArray(v) || !v.every(x => typeof x === 'string')) { fail(t('Les tags doivent être une liste de textes.', 'Tags must be a list of text values.')); break; }
        const tags = v.map(x => x.trim());
        const max = field.max ?? Infinity;
        const maxLength = field.maxLength ?? Infinity;
        let pattern = null;
        try { if (field.pattern) pattern = new RegExp(field.pattern, 'u'); } catch { /* broken adapter pattern: skip that rule */ }
        if (tags.length > max) fail(t(`Trop de tags (${tags.length}/${max}).`, `Too many tags (${tags.length}/${max}).`));
        const seen = new Set();
        for (const tag of tags) {
          if (!tag) { fail(t('Un tag ne peut pas être vide.', 'Tags cannot be empty.')); continue; }
          const q = short(tag);
          if (len(tag) > maxLength) fail(t(`Le tag « ${q} » est trop long (${maxLength} caractères max).`, `Tag "${q}" is too long (max ${maxLength} characters).`));
          if (CONTROL.test(tag)) fail(t(`Le tag « ${q} » contient des caractères de contrôle.`, `Tag "${q}" contains control characters.`));
          else if (pattern && !pattern.test(tag)) fail(t(`Le tag « ${q} » contient des caractères refusés par cette plateforme.`, `Tag "${q}" contains characters this platform refuses.`));
          if (seen.has(tag.toLowerCase())) fail(t(`Tag en double : « ${q} ».`, `Duplicate tag "${q}".`));
          seen.add(tag.toLowerCase());
        }
        const total = tagsTotalLength(tags);
        if (field.totalLength && total > field.totalLength) fail(t(`Les tags sont trop longs au total (${total}/${field.totalLength} caractères).`, `Tags are too long in total (${total}/${field.totalLength} characters).`));
        clean.tags = tags;
        break;
      }
      case 'language':
        if (typeof v !== 'string' || v.length > 35 || !/^(?:[a-z]{2,3}(?:-[a-z0-9]{2,8})*|other)$/i.test(v)) fail(t('La langue doit être un code comme « fr » ou « en ».', 'Language must be a language code such as "fr" or "en".'));
        else clean.language = v;
        break;
      case 'labels': {
        const options = field.options || [];
        if (!Array.isArray(v) || v.some(x => !options.includes(x)) || new Set(v).size !== v.length) fail(t(`Les labels doivent être des valeurs distinctes parmi : ${options.join(', ')}.`, `Labels must be distinct values among: ${options.join(', ')}.`));
        else clean.labels = [...v];
        break;
      }
      case 'brandedContent':
        if (typeof v !== 'boolean') fail(t('Le contenu sponsorisé doit valoir true ou false.', 'Branded content must be true or false.'));
        else clean.brandedContent = v;
        break;
      case 'ytCategoryId':
        if (!['string', 'number'].includes(typeof v) || !/^\d{1,4}$/.test(String(v))) fail(t('La catégorie YouTube doit être un identifiant numérique.', 'YouTube category must be a numeric id.'));
        else clean.ytCategoryId = String(v);
        break;
    }
  }
  return { errors, clean };
}

function platformOf(ctx, account) {
  return ctx.adapters.get(account.platform) || {};
}

function capsOf(ctx, account) {
  const p = platformOf(ctx, account);
  return (typeof p.capabilities === 'function' ? p.capabilities(account, ctx) : p.capabilities) || {};
}

export function register(router, ctx) {
  const unknown = () => ctx.t('Compte inconnu.', 'Unknown account.');
  const failed = err => err?.message || ctx.t('Erreur', 'Error');

  // ------------------------------------------------------------- stream info
  router.get('/api/stream/info', async ({ query }) => {
    const ids = [...new Set(String(query.accounts || '').split(',').map(s => s.trim()).filter(Boolean))];
    if (!ids.length || ids.length > MAX_IDS) throw new HttpError(400, ctx.t(`« accounts » doit lister 1 à ${MAX_IDS} comptes.`, `"accounts" must list 1 to ${MAX_IDS} account ids.`), 'invalid');
    const results = await Promise.all(ids.map(async id => {
      const account = ctx.accounts.get(id);
      const adapter = account && ctx.adapterFor(account);
      if (!account) return [id, { ok: false, error: unknown() }];
      if (!adapter?.getInfo) return [id, { ok: false, error: ctx.t('Indisponible sur cette plateforme.', 'Not available on this platform.') }];
      try {
        return [id, { ok: true, info: await adapter.getInfo(ctx, account) }];
      } catch (err) {
        return [id, { ok: false, error: failed(err) }];
      }
    }));
    return { results: Object.fromEntries(results) };
  });

  router.get('/api/stream/categories', async ({ query }) => {
    const account = ctx.requireAccount(String(query.accountId || ''));
    const q = String(query.q || '').trim();
    if (len(q) < 2 || len(q) > 100) throw new HttpError(400, ctx.t('La recherche doit faire 2 à 100 caractères.', 'The search must be 2 to 100 characters long.'), 'invalid');
    const adapter = ctx.adapterFor(account);
    if (!platformOf(ctx, account).infoFields?.category?.search || !adapter?.searchCategories) {
      throw new HttpError(400, ctx.t('La recherche de catégorie n’est pas disponible sur cette plateforme.', 'Category search is not available on this platform.'), 'unsupported');
    }
    const list = await adapter.searchCategories(ctx, account, q);
    return {
      categories: (Array.isArray(list) ? list : []).slice(0, 30).map(c => ({
        id: String(c.id), name: String(c.name), image: /^https?:\/\//i.test(c.image || '') ? c.image : '',
      })),
    };
  });

  router.get('/api/stream/options', async ({ query }) => {
    const account = ctx.requireAccount(String(query.accountId || ''));
    const adapter = ctx.adapterFor(account);
    return (adapter?.infoOptions && await adapter.infoOptions(ctx, account)) || {};
  });

  router.post('/api/stream/apply', async ({ body, res }) => {
    const changes = body?.changes;
    const ids = changes && typeof changes === 'object' && !Array.isArray(changes) ? Object.keys(changes) : [];
    if (!ids.length || ids.length > MAX_IDS) throw new HttpError(400, ctx.t(`« changes » doit associer 1 à ${MAX_IDS} comptes à leurs modifications.`, `"changes" must map 1 to ${MAX_IDS} account ids to their changes.`), 'invalid');
    // Validate everything first: one invalid account means nothing is sent anywhere.
    const plan = [];
    const details = [];
    for (const id of ids) {
      const account = ctx.accounts.get(id);
      const adapter = account && ctx.adapterFor(account);
      if (!account) { details.push([id, [unknown()]]); continue; }
      if (!capsOf(ctx, account).editInfo || !adapter?.setInfo) { details.push([id, [ctx.t('Les infos du live ne sont pas modifiables sur cette plateforme.', 'Stream info cannot be edited on this platform.')]]); continue; }
      const { errors, clean } = validateChanges(platformOf(ctx, account).infoFields, changes[id], ctx.t);
      if (errors.length) details.push([id, errors]);
      else plan.push({ account, adapter, clean });
    }
    if (details.length) {
      return sendJson(res, 400, { error: ctx.t('Certaines modifications sont invalides : rien n’a été appliqué.', 'Some changes are invalid: nothing was applied.'), code: 'invalid', details: Object.fromEntries(details) });
    }
    const results = await Promise.all(plan.map(async ({ account, adapter, clean }) => {
      try {
        await adapter.setInfo(ctx, account, clean);
        const patch = {};
        if (clean.title !== undefined) patch.title = clean.title;
        if (clean.category) patch.category = clean.category.name;
        if (Object.keys(patch).length) ctx.accounts.pushStats?.(account, patch); // dashboards update right away
        return [account.id, { ok: true }];
      } catch (err) {
        ctx.log.warn(`[${account.platform}] ${account.login}: stream info update failed: ${err.message}`);
        return [account.id, { ok: false, error: failed(err) }];
      }
    }));
    return { results: Object.fromEntries(results) };
  });

  // ------------------------------------------------------------- presets
  const q = {
    list: ctx.db.prepare('select * from presets order by position, updated_at'),
    one: ctx.db.prepare('select * from presets where id = ?'),
    count: ctx.db.prepare('select count(*) as n from presets'),
    insert: ctx.db.prepare('insert into presets (id, name, data, position, updated_at) values (?, ?, ?, (select coalesce(max(position), 0) + 1 from presets), ?)'),
    update: ctx.db.prepare('update presets set name = ?, data = ?, updated_at = ? where id = ?'),
    remove: ctx.db.prepare('delete from presets where id = ?'),
  };
  const view = row => ({ id: row.id, name: row.name, data: JSON.parse(row.data), position: row.position, updatedAt: row.updated_at });
  const list = () => q.list.all().map(view);
  const changed = () => ctx.hub.publish('presets', { presets: list() }); // other open stream pages refresh
  const notFound = () => new HttpError(404, ctx.t('Preset inconnu.', 'Unknown preset.'), 'not_found');
  const presetName = v => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s || len(s) > 60 || CONTROL.test(s)) throw new HttpError(400, ctx.t('Le nom du preset doit faire 1 à 60 caractères.', 'Preset name must be 1 to 60 characters.'), 'invalid');
    return s;
  };
  const presetData = v => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, ctx.t('Les données du preset doivent être un objet.', 'Preset data must be an object.'), 'invalid');
    const s = JSON.stringify(v);
    if (Buffer.byteLength(s) > 32 * 1024) throw new HttpError(400, ctx.t('Preset trop volumineux (32 Ko max).', 'Preset is too large (max 32 KB).'), 'too_large');
    return s;
  };

  router.get('/api/presets', () => ({ presets: list() }));

  router.post('/api/presets', ({ body }) => {
    const name = presetName(body?.name);
    const data = presetData(body?.data);
    if (q.count.get().n >= 200) throw new HttpError(400, ctx.t('Trop de presets (200 max).', 'Too many presets (max 200).'), 'too_many');
    const id = randomId(9);
    q.insert.run(id, name, data, Date.now());
    changed();
    return view(q.one.get(id));
  });

  router.put('/api/presets/:id', ({ params, body }) => {
    const row = q.one.get(params.id);
    if (!row) throw notFound();
    if (body?.name === undefined && body?.data === undefined) throw new HttpError(400, ctx.t('Rien à mettre à jour.', 'Nothing to update.'), 'invalid');
    const name = body.name === undefined ? row.name : presetName(body.name);
    const data = body.data === undefined ? row.data : presetData(body.data);
    q.update.run(name, data, Date.now(), row.id);
    changed();
    return view(q.one.get(row.id));
  });

  router.delete('/api/presets/:id', ({ params }) => {
    if (!q.remove.run(params.id).changes) throw notFound();
    changed();
    return { ok: true };
  });
}
