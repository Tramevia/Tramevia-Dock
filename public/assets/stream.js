// Stream info page (/stream): title, category and tags for every account at once, per-account overrides,
// multi-platform presets and a diff preview before anything is sent. SPEC.md §6, §7.3.
import { boot, h, api, t, addI18n, lang, store, toast, copy, busy, confirmDialog, icon, platformIcon, PLATFORM_NAMES, withKey, fmt } from '/assets/core.js';

const TWITCH_LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'uk', 'tr', 'ar', 'ja', 'ko', 'zh', 'sv', 'no', 'da', 'fi',
  'cs', 'hu', 'ro', 'el', 'he', 'hi', 'th', 'vi', 'id', 'ms', 'tl', 'bg', 'sk', 'ca', 'asl', 'other'];
const YT_FALLBACK = ['1', '2', '10', '15', '17', '19', '20', '22', '23', '24', '25', '26', '27', '28', '29'];
const NOTIFY_MAX = 140; // Twitch go-live notification text
const OVERRIDES = ['title', 'category', 'ytCategoryId', 'tags'];
const SPECIFIC = ['language', 'labels', 'brandedContent', 'description'];

let platforms = new Map();
let accounts = [];
let presets = [];
let presetsState = 'loading'; // loading | ok | error message
let presetId = null;
let form;
const current = new Map(); // accountId -> { status: loading|ok|error, info?, error? }
const ytCats = new Map();  // accountId -> [{id, title}] | null (loading / unavailable)
const watchers = new Set();
const openPanels = new Set(); // per-account panels the user opened (kept across re-renders)
let presetFilter = '';
let hellos = 0;
const ui = {};

// ------------------------------------------------------------------ helpers
const len = s => [...s].length;
const bytes = s => new TextEncoder().encode(s).length;
const norm = s => String(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim();
const uniq = list => [...new Set(list)];
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : '');
const pfName = p => PLATFORM_NAMES[p] || p;
const own = (o, k) => Object.hasOwn(o, k);
const fieldsOf = a => platforms.get(a.platform)?.infoFields || {};
const has = (a, key) => Boolean(fieldsOf(a)[key === 'ytCategoryId' ? 'ytCategory' : key]);
const editable = a => Boolean(a.caps?.editInfo) && Object.keys(fieldsOf(a)).length > 0;
const pa = a => form.perAccount[a.id] || { enabled: true };
const paw = a => (form.perAccount[a.id] ||= { enabled: true });
const isOn = a => editable(a) && pa(a).enabled !== false;
const selected = () => accounts.filter(isOn);
const infoOf = a => (current.get(a.id)?.status === 'ok' ? current.get(a.id).info || {} : null);
const forbidden = (s, chars = '') => uniq([...chars].filter(c => s.includes(c))).join(' ');
const totalLength = tags => tags.reduce((n, tag) => n + len(tag) + (tag.includes(' ') ? 2 : 0), 0) + Math.max(0, tags.length - 1);
/** replaceChildren that skips null/false and flattens arrays, like h(). */
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
const watch = (el, fn) => { fn.el = el; watchers.add(fn); return el; };
const iconBtn = (name, label, onclick, extra = '', focus) => h(`button.icon-btn${extra}`, { type: 'button', title: label, attrs: { 'aria-label': label }, dataset: focus && { focus }, onclick }, icon(name));
/** Server rules (src/stream-info.js): no C0/DEL control character in titles and tags; descriptions keep \t \r \n. */
const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_DESC = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Re-render without dropping keyboard focus (same idea as community.js): the focused control's data-focus key
 * (or id) is looked up in the new DOM, then each fallback key, and the first enabled match gets focus back.
 */
function keepFocus(render, fallbacks = []) {
  const was = document.activeElement;
  const key = was?.dataset?.focus || was?.id;
  render();
  if (!key || document.activeElement === was) return;
  for (const k of [key, ...fallbacks]) {
    const next = document.querySelector(`[data-focus="${CSS.escape(k)}"]`) || document.getElementById(k);
    if (next && !next.disabled && !next.closest('[hidden]')) { next.focus(); return; }
  }
}

const regexes = new Map();
function regex(src) {
  if (!regexes.has(src)) { let re = null; try { re = new RegExp(src, 'u'); } catch { /* broken pattern: rule skipped */ } regexes.set(src, re); }
  return regexes.get(src);
}

function langName(code) {
  if (code === 'other' || code === 'asl') return t(`stream.lang.${code}`);
  try { const n = new Intl.DisplayNames([lang()], { type: 'language' }).of(code); return n ? n[0].toUpperCase() + n.slice(1) : code; } catch { return code; }
}
function labelName(id) {
  const key = `stream.label.${id}`;
  return t(key) === key ? id : t(key);
}
function ytList(a) {
  if (!ytCats.has(a.id)) {
    ytCats.set(a.id, null);
    api(`/api/stream/options?accountId=${encodeURIComponent(a.id)}`)
      .then(o => { if (Array.isArray(o?.ytCategories) && o.ytCategories.length) ytCats.set(a.id, o.ytCategories.map(c => ({ id: String(c.id), title: String(c.title) }))); })
      .catch(() => { /* fallback list below */ })
      .finally(() => refresh(false));
  }
  return ytCats.get(a.id) || YT_FALLBACK.map(id => ({ id, title: t(`stream.ytcat.${id}`) }));
}
const ytName = (a, id) => ytList(a).find(c => c.id === String(id))?.title || `#${id}`;

function avatar(a) {
  return safeUrl(a.avatar)
    ? h('img.avatar', { src: a.avatar, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' })
    : h('span.avatar.st-initial', { attrs: { 'aria-hidden': 'true' } }, (a.displayName || a.login || '?').slice(0, 1).toUpperCase());
}
const avatarWithIcon = a => h(`span.st-avatar.pf-${a.platform}`, avatar(a), platformIcon(a.platform));

// ------------------------------------------------------------------ form model
// form = { title, tags, category: {query, picks: {[platform]: Category}, yt}, perAccount: {[id]: {enabled, …overrides}}, notification }
// A per-account key that is present overrides the common value ("" / null / [] = explicit), absent = inherit.
const blank = () => ({ title: '', tags: [], category: { query: '', picks: {}, yt: '' }, perAccount: {}, notification: null });

/** Sanitize stored/preset data into a form (fixed key order, so JSON.stringify can compare two forms). */
function toForm(d) {
  d = d && typeof d === 'object' ? d : {};
  const str = v => (typeof v === 'string' ? v : '');
  const list = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : null);
  const cat = v => (v && typeof v === 'object' && v.id != null && typeof v.name === 'string' ? { id: String(v.id), name: v.name, image: safeUrl(v.image) } : null);
  const keys = o => (o && typeof o === 'object' ? Object.keys(o).filter(k => k !== '__proto__').sort() : []);
  const f = blank();
  f.title = str(d.title);
  f.tags = list(d.tags) || [];
  f.category.query = str(d.category?.query);
  f.category.yt = str(d.category?.yt);
  for (const p of keys(d.category?.picks)) if (cat(d.category.picks[p])) f.category.picks[p] = cat(d.category.picks[p]);
  for (const id of keys(d.perAccount)) {
    const v = d.perAccount[id];
    if (!v || typeof v !== 'object') continue;
    const o = { enabled: v.enabled !== false };
    if (typeof v.title === 'string') o.title = v.title;
    if (own(v, 'category') && (v.category === null || cat(v.category))) o.category = cat(v.category);
    if (typeof v.ytCategoryId === 'string') o.ytCategoryId = v.ytCategoryId;
    if (list(v.tags)) o.tags = list(v.tags);
    if (typeof v.language === 'string' && v.language) o.language = v.language;
    if (list(v.labels)) o.labels = list(v.labels);
    if (typeof v.brandedContent === 'boolean') o.brandedContent = v.brandedContent;
    if (typeof v.description === 'string') o.description = v.description;
    if (Object.keys(o).length > 1 || !o.enabled) f.perAccount[id] = o;
  }
  if (typeof d.notification === 'string') f.notification = d.notification;
  return f;
}
const snapshot = d => JSON.stringify(toForm(d));

/** Preset payload: the form plus the explicit selection of every editable account. */
function presetData() {
  const d = toForm(form);
  for (const a of accounts.filter(editable)) d.perAccount[a.id] = { ...d.perAccount[a.id], enabled: isOn(a) };
  return d;
}

/** What would be sent to an account if nothing were known about its current info. */
function effective(a) {
  const o = pa(a);
  const out = {};
  if (has(a, 'title')) { const v = (own(o, 'title') ? o.title : form.title).trim(); if (v) out.title = v; }
  if (has(a, 'category')) { const c = own(o, 'category') ? o.category : form.category.picks[a.platform]; if (c) out.category = { id: c.id, name: c.name }; }
  if (has(a, 'ytCategoryId')) { const v = own(o, 'ytCategoryId') ? o.ytCategoryId : form.category.yt; if (v) out.ytCategoryId = v; }
  if (has(a, 'tags')) { const v = own(o, 'tags') ? o.tags : form.tags.length ? form.tags : null; if (v) out.tags = [...v]; }
  for (const k of SPECIFIC) if (has(a, k) && o[k] !== undefined) out[k] = structuredClone(o[k]);
  return out;
}

function same(key, a, b) {
  if (key === 'category') return String(a?.id ?? '') === String(b?.id ?? '');
  if (key === 'labels') return [...(a || [])].sort().join() === [...(b || [])].sort().join();
  if (key === 'tags') return (a || []).join('\u0000') === (b || []).join('\u0000');
  return String(a ?? '') === String(b ?? '');
}

/** Only the fields that differ from the loaded current info (everything when it is unknown). */
function diffOf(a) {
  const info = infoOf(a);
  return Object.fromEntries(Object.entries(effective(a)).filter(([k, v]) => !info || !same(k, v, info[k])));
}

function tagIssue(tag, f) {
  if (f.maxLength && len(tag) > f.maxLength) return t('stream.err.tagLong', { max: f.maxLength });
  if (CONTROL.test(tag)) return t('stream.err.controlShort');
  const re = f.pattern && regex(f.pattern);
  if (re && !re.test(tag)) return t('stream.err.tagPattern');
  return '';
}

/**
 * Client-side mirror of src/stream-info.js validateChanges, with translated messages.
 * Same rule as the server: a limit applies only when the adapter declares it in infoFields.
 */
function problems(a, ch = effective(a)) {
  const f = fieldsOf(a);
  const out = [];
  const add = (key, code, vars) => out.push({ key, msg: t(`stream.err.${code}`, { platform: pfName(a.platform), ...vars }) });
  for (const key of ['title', 'description']) {
    if (ch[key] === undefined) continue;
    const size = key === 'title' ? len(ch[key]) : bytes(ch[key]);
    if (f[key].max && size > f[key].max) add(key, `${key}Long`, { n: size, max: f[key].max });
    const bad = forbidden(ch[key], f[key].forbid);
    if (bad) add(key, 'forbid', { field: t(`stream.field.${key}`), chars: bad });
    if ((key === 'title' ? CONTROL : CONTROL_DESC).test(ch[key])) add(key, 'control', { field: t(`stream.field.${key}`) });
  }
  if (ch.tags) {
    if (f.tags.max && ch.tags.length > f.tags.max) add('tags', 'tagsMax', { n: ch.tags.length, max: f.tags.max });
    for (const tag of ch.tags) { const error = tagIssue(tag, f.tags); if (error) add('tags', 'tag', { tag, error }); }
    const total = totalLength(ch.tags);
    if (f.tags.totalLength && total > f.tags.totalLength) add('tags', 'tagsTotal', { n: total, max: f.tags.totalLength });
  }
  return out;
}

// ------------------------------------------------------------------ refresh / persistence
let saveTimer;
const save = () => store.set('stream.draft', { v: 1, form: toForm(form), presetId });
/** Update every derived view (counters, chips, badges…) after a state change; inputs are never rebuilt here. */
function refresh(persist = true) {
  for (const fn of watchers) {
    if (fn.el.isConnected) fn(); else watchers.delete(fn);
  }
  if (persist) { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }
}
function setForm(next, pid = null) {
  form = next;
  presetId = pid;
  renderAll();
  save();
}
function undoable(message, prev) {
  const button = h('button.btn.sm', { type: 'button', onclick: () => { setForm(prev.form, prev.presetId); button.closest('.toast')?.remove(); } }, t('stream.undo'));
  toast(h('span.st-toast', h('span', message), button), 'ok', 7000);
}
const isDirty = () => { const p = presets.find(x => x.id === presetId); return Boolean(p) && snapshot(form) !== snapshot(p.data); };

// ------------------------------------------------------------------ inputs
/** Title-like textarea: grows with the text, Enter never inserts a newline unless multiline. */
function textInput({ id, value = '', label, placeholder, multiline = false, maxLength = 300, oninput }) {
  const ta = h(`textarea.st-text${multiline ? '.multi' : ''}`, { id, value, placeholder, maxLength, rows: multiline ? 4 : 1, attrs: label ? { 'aria-label': label } : {} });
  if (!multiline) ta.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  ta.addEventListener('input', () => {
    // Single line: pasted tabs/newlines (spreadsheets…) become spaces; the server refuses control characters.
    if (!multiline && CONTROL.test(ta.value)) ta.value = ta.value.replace(/\s*[\u0000-\u001f\u007f]+\s*/g, ' ');
    oninput(ta.value);
  });
  return ta;
}

/** Per-platform counters ("Twitch 37/140"); returns true when a limit is broken. */
function counters(el, value, plats, key, unit = '') {
  let bad = false;
  const parts = [];
  for (const p of plats) {
    const f = platforms.get(p)?.infoFields?.[key];
    if (!f) continue;
    const n = key === 'description' ? bytes(value) : len(value);
    if (f.max) {
      const over = n > f.max;
      bad ||= over;
      parts.push(h(`span.counter.st-count.pf-${p}${over ? '.over' : ''}`, `${pfName(p)} ${n}/${f.max}${unit}`));
    }
    const chars = forbidden(value, f.forbid);
    if (chars) { bad = true; parts.push(h('span.counter.over', t('stream.err.forbidShort', { platform: pfName(p), chars }))); }
  }
  if (plats.length && (key === 'description' ? CONTROL_DESC : CONTROL).test(value)) { bad = true; parts.push(h('span.counter.over', t('stream.err.controlShort'))); }
  fill(el, ...parts);
  return bad;
}

function tagCounters(el, tags, plats) {
  const parts = [];
  for (const p of plats) {
    const f = platforms.get(p)?.infoFields?.tags;
    if (f?.max) parts.push(h(`span.counter.st-count.pf-${p}${tags.length > f.max ? '.over' : ''}`, `${pfName(p)} ${tags.length}/${f.max}`));
    if (f?.totalLength) { const n = totalLength(tags); parts.push(h(`span.counter.st-count.pf-${p}${n > f.totalLength ? '.over' : ''}`, `${pfName(p)} ${n}/${f.totalLength} ${t('stream.chars')}`)); }
  }
  fill(el, ...parts);
}

/** Tag chips: Enter/comma adds, Backspace removes the last one, pasted lists are split. */
function chipInput({ id, label, get, set, check }) {
  const input = h('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, placeholder: t('stream.tags.placeholder'), attrs: { 'aria-label': label, enterkeyhint: 'done' } });
  const box = h('div.chips-input.st-chips', { onclick: e => { if (e.target === box) input.focus(); } }, input);
  const flash = tag => {
    const chip = [...box.querySelectorAll('.chip')].find(c => c.dataset.tag.toLowerCase() === tag.toLowerCase());
    if (!chip) return;
    chip.classList.remove('st-flash');
    void chip.offsetWidth; // restart the animation
    chip.classList.add('st-flash');
  };
  const add = text => {
    const tags = [...get()];
    let dup = null;
    for (const raw of text.split(/[,;\n\r\t]+/)) {
      const tag = raw.trim().replace(/^#+/, '').trim();
      if (!tag) continue;
      if (tags.some(x => x.toLowerCase() === tag.toLowerCase())) { dup = tag; continue; }
      tags.push(tag);
    }
    input.value = '';
    if (tags.length !== get().length) set(tags);
    if (dup) flash(dup);
  };
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); }
    else if (e.key === 'Backspace' && !input.value && get().length) { e.preventDefault(); set(get().slice(0, -1)); }
  });
  input.addEventListener('paste', e => {
    const text = e.clipboardData?.getData('text') || '';
    if (/[,;\n\t]/.test(text)) { e.preventDefault(); add(input.value + text); }
  });
  input.addEventListener('blur', () => { if (input.value.trim()) add(input.value); });
  let key;
  return watch(box, () => {
    const tags = get();
    const issues = tags.map(check);
    const k = tags.join('\u0000') + '|' + issues.join('|');
    if (k === key) return;
    key = k;
    for (const c of box.querySelectorAll('.chip')) c.remove();
    input.before(...tags.map((tag, i) => h(`span.chip${issues[i] ? '.invalid' : ''}`, { title: issues[i] || tag, dataset: { tag } },
      issues[i] ? icon('alert', 12) : null,
      h('span.st-chip-text', tag),
      issues[i] ? h('span.sr-only', `(${issues[i]})`) : null,
      h('button', { type: 'button', attrs: { 'aria-label': t('stream.tags.remove', { tag }) }, onclick: e => { e.stopPropagation(); const next = [...get()]; next.splice(i, 1); set(next); input.focus(); } }, '×'))));
    box.classList.toggle('invalid', issues.some(Boolean));
  });
}

/**
 * Category search over one or several platforms at once (debounced, in parallel), results grouped per
 * platform with box art; an exact name match is preselected on each platform.
 */
function categoryPicker({ list, accountFor, getPick, setPick, query = '', onQuery, label }) {
  const results = new Map();
  let seq = 0;
  let timer;
  let platformsKey = list().join();
  let picksKey;
  const input = h('input', { type: 'search', value: query, placeholder: t('stream.category.placeholder'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': label } });
  const status = h('span.sr-only', { attrs: { role: 'status' } });
  const picks = h('div.st-picks');
  const box = h('div.st-results', { hidden: true });

  const syncTiles = () => {
    for (const b of box.querySelectorAll('.st-cat[data-id]')) {
      const on = getPick(b.dataset.p)?.id === b.dataset.id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  const tile = (p, c) => h('button.st-cat', { type: 'button', title: c.name, dataset: { p, id: c.id }, attrs: { 'aria-pressed': 'false' }, onclick: () => setPick(p, c) },
    h('span.st-art', c.image ? h('img', { src: c.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : icon('film', 18)),
    h('span.st-cat-name', c.name));
  const drawResults = () => {
    box.hidden = !results.size;
    fill(box, ...[...results].map(([p, r]) => h(`div.st-group.pf-${p}`,
      h('div.st-group-head', platformIcon(p), h('span', pfName(p)), r.status === 'ok' ? h('span.faint', String(r.items.length)) : null),
      r.status === 'loading' ? h('div.st-cat-row', { attrs: { 'aria-busy': 'true' } }, Array.from({ length: 4 }, () => h('div.st-cat.skel', h('span.st-art.skeleton'), h('span.skeleton.st-skel-line'))))
        : r.status === 'error' ? h('p.small.st-err', icon('alert', 14), h('span', r.error))
          : !r.items.length ? h('p.small.faint', t('stream.category.noResult', { platform: pfName(p) }))
            : h('div.st-cat-row', { attrs: { role: 'group', 'aria-label': `${label} · ${pfName(p)}` } }, r.items.map(c => tile(p, c))))));
    syncTiles();
  };
  const run = async () => {
    const q = input.value.trim();
    const mine = ++seq;
    results.clear();
    const plats = list();
    if (len(q) < 2 || !plats.length) { drawResults(); return; }
    for (const p of plats) results.set(p, { status: 'loading' });
    drawResults();
    await Promise.all(plats.map(async p => {
      let r;
      try {
        const { categories } = await api(`/api/stream/categories?accountId=${encodeURIComponent(accountFor(p).id)}&q=${encodeURIComponent(q)}`);
        r = { status: 'ok', items: categories || [] };
      } catch (err) { r = { status: 'error', error: err.message }; }
      if (mine !== seq) return;
      results.set(p, r);
      if (r.status === 'ok') {
        const exact = r.items.find(c => norm(c.name) === norm(q));
        const pick = getPick(p);
        if (exact) { if (pick?.id !== exact.id) setPick(p, exact); }
        else if (pick && !r.items.some(c => c.id === pick.id)) setPick(p, null); // stale pick from another search
      }
      drawResults();
    }));
    if (mine === seq) status.textContent = t('stream.category.found', { n: [...results.values()].reduce((n, r) => n + (r.items?.length || 0), 0) });
  };
  input.addEventListener('input', () => { onQuery?.(input.value); clearTimeout(timer); timer = setTimeout(run, 350); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(); }
    else if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); results.clear(); drawResults(); }
  });

  const el = h('div.st-picker', h('div.st-search', icon('search'), input), picks, box, status);
  return watch(el, () => {
    const plats = list();
    const k = plats.map(p => `${p}:${getPick(p)?.id || ''}`).join();
    if (k !== picksKey) {
      picksKey = k;
      fill(picks, ...(plats.length ? plats.map(p => {
        const c = getPick(p);
        return h(`div.st-pick.pf-${p}${c ? '' : '.empty'}`, platformIcon(p),
          c ? [c.image ? h('img.st-pick-art', { src: c.image, alt: '', referrerPolicy: 'no-referrer' }) : null, h('span.ellipsis', { title: c.name }, c.name),
            iconBtn('x', t('stream.category.clear', { platform: pfName(p) }), () => setPick(p, null), '.st-pick-x')]
            : h('span.faint', t('stream.category.unchanged')));
      }) : [h('span.small.faint', t('stream.category.allCustom'))]));
      syncTiles();
    }
    if (plats.join() !== platformsKey) { platformsKey = plats.join(); if (results.size) run(); }
  });
}

function ytSelect({ id, account, get, set, label }) {
  const sel = h('select', { id, attrs: label ? { 'aria-label': label } : {}, onchange: () => set(sel.value) });
  let key;
  return watch(sel, () => {
    const a = account();
    const cats = a ? ytList(a) : [];
    const v = get();
    const k = cats.map(c => c.id + c.title).join() + '|' + v;
    if (k === key) return;
    key = k;
    fill(sel, h('option', { value: '' }, t('stream.unchanged')), ...cats.map(c => h('option', { value: c.id }, c.title)),
      v && !cats.some(c => c.id === v) ? h('option', { value: v }, `#${v}`) : null);
    sel.value = v;
  });
}

// ------------------------------------------------------------------ accounts card
function liveLine(el, a) {
  const s = a.stats;
  // SPEC §5 freshness: live undefined + error = unknown; error alone = values kept from an earlier poll.
  const state = a.status === 'needs_reconnect' ? 'reconnect' : a.status === 'error' ? 'error' : s?.live === undefined && s?.error ? 'unknown' : s?.live ? 'live' : 'off';
  const k = [state, s?.viewers ?? '', s?.error || ''].join('|');
  if (el.dataset.k === k) return;
  el.dataset.k = k;
  const dot = { live: '.live', reconnect: '.warn', error: '.danger', unknown: '.warn', off: '' }[state];
  const text = state === 'live' ? `${t('stream.live')} · ${fmt.number(s.viewers ?? null)}` : state === 'reconnect' ? t('stream.accounts.reconnect')
    : state === 'error' ? t('common.error') : state === 'unknown' ? t('stream.statsUnknown') : t('common.offlineStream');
  const stale = Boolean(s?.error) && !['reconnect', 'error'].includes(state);
  el.classList.toggle('st-stale', stale);
  if (stale) el.title = t('stream.statsStale', { error: s.error }); else el.removeAttribute('title');
  fill(el, h(`span.status-dot${dot}`), h('span.ellipsis', text), stale && h('span.sr-only', ` (${t('stream.statsStale', { error: s.error })})`));
}

function tile(a) {
  const sub = h('span.st-tile-sub');
  const el = h(`button.st-tile.pf-${a.platform}`, { type: 'button', title: `${pfName(a.platform)} · ${a.displayName}`, dataset: { id: a.id, focus: `tile:${a.id}` }, onclick: () => { paw(a).enabled = !isOn(a); refresh(); } },
    avatarWithIcon(a),
    h('span.st-tile-text', h('span.st-tile-name.ellipsis', a.displayName), sub),
    h('span.st-check', { attrs: { 'aria-hidden': 'true' } }, icon('check', 12)));
  return watch(el, () => { el.setAttribute('aria-pressed', String(isOn(a))); liveLine(sub, a); });
}

function renderAccounts() {
  const editables = accounts.filter(editable);
  const others = accounts.filter(a => !editable(a));
  const toggleAll = h('button.btn.ghost.sm', { type: 'button', dataset: { focus: 'toggleAll' }, onclick: () => { const on = !editables.every(isOn); for (const a of editables) paw(a).enabled = on; refresh(); } });
  const loadBtn = h('button.btn.sm', { type: 'button', dataset: { focus: 'load' }, onclick: () => loadAndFill(loadBtn) }, icon('refresh'), t('stream.load'));
  fill(ui.accounts,
    h('div.card-head', h('h2', { id: 'st-accounts-title' }, t('stream.accounts.title')),
      editables.length > 1 ? watch(toggleAll, () => { toggleAll.textContent = t(editables.every(isOn) ? 'stream.accounts.none' : 'stream.accounts.all'); }) : null),
    !accounts.length ? h('div.empty', h('div.big', icon('users', 28)), h('p', t('common.noAccounts')), h('a.btn.primary.sm', { href: withKey('/') }, t('common.connectAccounts'))) : null,
    editables.length ? h('div.st-tiles', { attrs: { role: 'group', 'aria-labelledby': 'st-accounts-title' } }, editables.map(tile))
      : accounts.length ? h('p.small.muted', t('stream.accounts.noneEditable')) : null,
    others.length ? h('ul.st-readonly', others.map(a => h(`li.pf-${a.platform}`, avatarWithIcon(a),
      h('span.st-readonly-text', h('span.ellipsis', a.displayName), h('span.tiny.faint', t(a.platform === 'tiktok' ? 'stream.accounts.tiktok' : 'stream.accounts.readonly')))))) : null,
    editables.length ? h('div.st-load', watch(loadBtn, () => { if (!loadBtn.classList.contains('busy')) loadBtn.disabled = !selected().length; }),
      h('span.tiny.faint', t('stream.load.hint'))) : null);
}

// ------------------------------------------------------------------ common fields card
function titleField() {
  const ta = textInput({ id: 'st-title', value: form.title, placeholder: t('stream.title.placeholder'), oninput: v => { form.title = v; refresh(); } });
  const count = h('div.st-counters');
  const hint = h('span.hint.st-hint');
  const wrap = h('div.field', h('label', { htmlFor: 'st-title' }, t('stream.field.title')), ta, h('div.st-meta', hint, count));
  return watch(wrap, () => {
    const targets = selected().filter(a => has(a, 'title') && !own(pa(a), 'title'));
    wrap.hidden = !selected().some(a => has(a, 'title'));
    const bad = counters(count, form.title.trim(), uniq(targets.map(a => a.platform)), 'title');
    ta.setAttribute('aria-invalid', String(bad));
    hint.textContent = !targets.length ? t('stream.title.allCustom') : form.title.trim() ? '' : t('stream.title.emptyHint');
  });
}

function categoryField() {
  const searchable = () => selected().filter(a => fieldsOf(a).category?.search && !own(pa(a), 'category'));
  const picker = categoryPicker({
    list: () => uniq(searchable().map(a => a.platform)),
    accountFor: p => searchable().find(a => a.platform === p),
    getPick: p => form.category.picks[p] || null,
    setPick: (p, c) => { if (c) form.category.picks[p] = c; else delete form.category.picks[p]; refresh(); },
    query: form.category.query,
    onQuery: v => { form.category.query = v; refresh(); },
    label: t('stream.field.category'),
  });
  const ytAccount = () => selected().find(a => has(a, 'ytCategoryId') && !own(pa(a), 'ytCategoryId'));
  const yt = h('div.st-yt',
    h('label.st-yt-label', { htmlFor: 'st-ytcat' }, platformIcon('youtube'), t('stream.yt.label')),
    ytSelect({ id: 'st-ytcat', account: ytAccount, get: () => form.category.yt, set: v => { form.category.yt = v; refresh(); } }),
    h('p.hint', icon('info', 13), h('span', t('stream.yt.gameHint'))));
  const wrap = h('div.field', h('div.label', t('stream.field.category')), picker, h('p.hint.st-cat-hint', t('stream.category.hint')), yt);
  return watch(wrap, () => {
    const search = selected().some(a => fieldsOf(a).category?.search);
    picker.hidden = !search;
    wrap.querySelector('.st-cat-hint').hidden = !search;
    yt.hidden = !ytAccount();
    wrap.hidden = !search && yt.hidden;
  });
}

function tagsField() {
  const targets = () => selected().filter(a => has(a, 'tags') && !own(pa(a), 'tags'));
  const chips = chipInput({
    id: 'st-tags', label: t('stream.field.tags'), get: () => form.tags, set: v => { form.tags = v; refresh(); },
    check: tag => uniq(targets().map(a => a.platform)).map(p => { const e = tagIssue(tag, platforms.get(p).infoFields.tags); return e && `${pfName(p)} : ${e}`; }).filter(Boolean).join(' · '),
  });
  const count = h('div.st-counters');
  const wrap = h('div.field', h('label', { htmlFor: 'st-tags' }, t('stream.field.tags')), chips, h('div.st-meta', h('span.hint.st-hint', t('stream.tags.hint')), count));
  return watch(wrap, () => {
    wrap.hidden = !selected().some(a => has(a, 'tags'));
    tagCounters(count, form.tags, uniq(targets().map(a => a.platform)));
  });
}

function renderFields() {
  fill(ui.fields,
    h('div.card-head', h('div.st-head-text', h('h2', t('stream.common.title')), h('p.small.muted', t('stream.common.hint'))),
      h('button.btn.ghost.sm', { type: 'button', dataset: { focus: 'reset' }, onclick: reset }, icon('x'), t('stream.reset'))),
    h('div.st-fields-body', titleField(), categoryField(), tagsField()));
}

// ------------------------------------------------------------------ per-account panels
function show(a, key, v) {
  if (key === 'labels' && Array.isArray(v) && !v.length) return h('span.faint', t('stream.labels.none'));
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return h('span.faint', t('stream.empty'));
  if (key === 'category') return v.name;
  if (key === 'tags') return h('span.st-chip-list', v.map(x => h('span.chip.st-static', x)));
  if (key === 'labels') return v.map(labelName).join(', ');
  if (key === 'language') return langName(v);
  if (key === 'brandedContent') return t(v ? 'stream.yes' : 'stream.no');
  if (key === 'ytCategoryId') return ytName(a, v);
  return String(v);
}

/** One overridable row: a switch flips between the inherited/unchanged view and an editor. */
function fieldRow(a, key, { kind, init, preview, editor }) {
  const label = t(`stream.field.${key}`);
  const sw = h('input', { type: 'checkbox', dataset: { focus: `sw:${a.id}:${key}` }, attrs: { role: 'switch', 'aria-label': `${t(kind === 'inherit' ? 'stream.per.custom' : 'stream.per.modify')} · ${label}` } });
  const body = h('div.st-row-body');
  let mode = '';
  sw.addEventListener('change', () => {
    if (sw.checked) paw(a)[key] = structuredClone(init());
    else delete paw(a)[key];
    refresh();
  });
  const row = h('div.st-row', h('div.st-row-head', h('span.label', label), h('label.switch.st-switch', sw, h('span'), h('span.tiny.muted', t(kind === 'inherit' ? 'stream.per.custom' : 'stream.per.modify')))), body);
  return watch(row, () => {
    const on = own(pa(a), key);
    sw.checked = on;
    row.classList.toggle('on', on);
    if (on) { if (mode !== 'edit') { mode = 'edit'; fill(body, editor()); } return; }
    mode = 'view';
    fill(body, h('div.st-inherit', h(`span.badge${kind === 'inherit' ? '.accent' : ''}`, t(kind === 'inherit' ? 'stream.per.inherited' : 'stream.per.unchanged')), h('span.st-inherit-val', preview())));
  });
}

function overrideRows(a) {
  const name = a.displayName;
  const rows = [];
  if (has(a, 'title')) rows.push(fieldRow(a, 'title', {
    kind: 'inherit', init: () => form.title,
    preview: () => form.title.trim() || h('span.faint', t('stream.per.noCommon')),
    editor: () => {
      const ta = textInput({ value: pa(a).title, label: `${t('stream.field.title')} · ${name}`, placeholder: t('stream.title.placeholder'), oninput: v => { paw(a).title = v; refresh(); } });
      const count = h('div.st-counters');
      watch(count, () => ta.setAttribute('aria-invalid', String(counters(count, (pa(a).title || '').trim(), [a.platform], 'title'))));
      return h('div.st-editor', ta, count);
    },
  }));
  if (fieldsOf(a).category?.search) rows.push(fieldRow(a, 'category', {
    kind: 'inherit', init: () => form.category.picks[a.platform] || null,
    preview: () => form.category.picks[a.platform]?.name || h('span.faint', t('stream.per.noCommon')),
    editor: () => categoryPicker({
      list: () => [a.platform], accountFor: () => a, getPick: () => pa(a).category || null,
      setPick: (p, c) => { paw(a).category = c; refresh(); }, query: pa(a).category?.name || '', label: `${t('stream.field.category')} · ${name}`,
    }),
  }));
  if (has(a, 'ytCategoryId')) rows.push(fieldRow(a, 'ytCategoryId', {
    kind: 'inherit', init: () => form.category.yt,
    preview: () => (form.category.yt ? ytName(a, form.category.yt) : h('span.faint', t('stream.per.noCommon'))),
    editor: () => ytSelect({ account: () => a, get: () => pa(a).ytCategoryId || '', set: v => { paw(a).ytCategoryId = v; refresh(); }, label: `${t('stream.field.ytCategoryId')} · ${name}` }),
  }));
  if (has(a, 'tags')) rows.push(fieldRow(a, 'tags', {
    kind: 'inherit', init: () => form.tags,
    preview: () => (form.tags.length ? show(a, 'tags', form.tags) : h('span.faint', t('stream.per.noCommon'))),
    editor: () => {
      const count = h('div.st-counters');
      const chips = chipInput({ label: `${t('stream.field.tags')} · ${name}`, get: () => pa(a).tags || [], set: v => { paw(a).tags = v; refresh(); }, check: tag => tagIssue(tag, fieldsOf(a).tags) });
      watch(count, () => tagCounters(count, pa(a).tags || [], [a.platform]));
      return h('div.st-editor', chips, h('div.st-meta', h('span.hint.st-hint', t('stream.tags.overrideHint')), count));
    },
  }));
  const currentPreview = key => () => { const i = infoOf(a); return i && i[key] !== undefined ? h('span', t('stream.per.current'), ' ', show(a, key, i[key])) : ''; };
  if (has(a, 'language')) rows.push(fieldRow(a, 'language', {
    kind: 'modify', init: () => infoOf(a)?.language || lang(), preview: currentPreview('language'),
    editor: () => {
      const codes = uniq([...TWITCH_LANGS, pa(a).language, infoOf(a)?.language].filter(Boolean));
      const sel = h('select', { attrs: { 'aria-label': `${t('stream.field.language')} · ${name}` }, onchange: () => { paw(a).language = sel.value; refresh(); } }, codes.map(c => h('option', { value: c }, langName(c))));
      sel.value = pa(a).language;
      return sel;
    },
  }));
  if (has(a, 'labels')) rows.push(fieldRow(a, 'labels', {
    kind: 'modify', init: () => infoOf(a)?.labels || [], preview: currentPreview('labels'),
    editor: () => {
      const options = fieldsOf(a).labels.options || [];
      return h('div.st-editor', h('div.st-labels', options.map(id => {
        const cb = h('input', { type: 'checkbox', checked: (pa(a).labels || []).includes(id), onchange: () => {
          const on = new Set(pa(a).labels || []);
          if (cb.checked) on.add(id); else on.delete(id);
          paw(a).labels = options.filter(x => on.has(x));
          refresh();
        } });
        return h('label.check.small', cb, h('span', labelName(id)));
      })), h('p.hint', t('stream.labels.hint')));
    },
  }));
  if (has(a, 'brandedContent')) rows.push(fieldRow(a, 'brandedContent', {
    kind: 'modify', init: () => Boolean(infoOf(a)?.brandedContent), preview: currentPreview('brandedContent'),
    editor: () => {
      const buttons = [false, true].map(v => h('button', { type: 'button', onclick: () => { paw(a).brandedContent = v; refresh(); } }, t(v ? 'stream.yes' : 'stream.no')));
      const seg = h('div.segmented', { attrs: { role: 'group', 'aria-label': `${t('stream.field.brandedContent')} · ${name}` } }, buttons);
      watch(seg, () => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(pa(a).brandedContent === Boolean(i)))));
      return h('div.st-editor', seg, h('p.hint', t('stream.branded.hint')));
    },
  }));
  if (has(a, 'description')) rows.push(fieldRow(a, 'description', {
    kind: 'modify', init: () => infoOf(a)?.description ?? '', preview: () => (infoOf(a)?.description !== undefined ? h('span.st-clamp', t('stream.per.current'), ' ', show(a, 'description', infoOf(a).description)) : ''),
    editor: () => {
      const ta = textInput({ value: pa(a).description, multiline: true, maxLength: 10000, label: `${t('stream.field.description')} · ${name}`, oninput: v => { paw(a).description = v; refresh(); } });
      const count = h('div.st-counters');
      watch(count, () => ta.setAttribute('aria-invalid', String(counters(count, pa(a).description || '', [a.platform], 'description', ` ${t('stream.bytes')}`))));
      return h('div.st-editor', ta, h('div.st-meta', h('span.hint.st-hint', t('stream.desc.hint')), count));
    },
  }));
  return rows;
}

function panel(a) {
  const sub = h('span.st-acct-sub');
  const badges = h('span.st-badges');
  const cur = h('div.st-current');
  const errors = h('ul.st-errors');
  const el = h(`details.card.flush.st-acct.pf-${a.platform}`, { dataset: { id: a.id }, open: openPanels.has(a.id), ontoggle: () => openPanels[el.open ? 'add' : 'delete'](a.id) },
    h('summary', { dataset: { focus: `acct:${a.id}` } }, avatarWithIcon(a), h('span.st-acct-text', h('span.st-acct-name.ellipsis', a.displayName), sub), badges),
    h('div.st-acct-body', cur, ...overrideRows(a), errors));
  watch(sub, () => {
    const c = current.get(a.id);
    const text = !c ? a.stats?.title || pfName(a.platform) : c.status === 'ok' ? c.info.title || t('stream.empty') : c.error || '';
    const k = (c?.status || 'none') + text;
    if (sub.dataset.k === k) return;
    sub.dataset.k = k;
    sub.title = text;
    fill(sub, c?.status === 'loading' ? h('span.skeleton.st-skel-line')
      : c?.status === 'error' ? h('span.st-err.ellipsis', icon('alert', 12), h('span.ellipsis', text))
        : h(`span.ellipsis${c ? '.muted' : '.faint'}`, text));
  });
  watch(cur, () => {
    const c = current.get(a.id);
    const k = c ? c.status + JSON.stringify(c.info || c.error || '') : '';
    if (cur.dataset.k === k) return;
    cur.dataset.k = k;
    cur.hidden = !c;
    if (!c) return;
    const keys = ['title', 'category', 'ytCategoryId', 'tags'].filter(key => has(a, key));
    fill(cur, h('div.section-title', t('stream.per.currentTitle')),
      c.status === 'loading' ? h('div.stack.st-tight', h('span.skeleton'), h('span.skeleton.st-short'))
        : c.status === 'error' ? h('div.banner.warn.small', icon('alert'), h('span', t('stream.per.loadError', { error: c.error })))
          : h('dl.st-dl', keys.flatMap(key => [h('dt', t(`stream.field.${key}`)), h('dd', show(a, key, c.info[key]))])));
  });
  watch(el, () => {
    el.hidden = !isOn(a);
    const issues = problems(a);
    const custom = [...OVERRIDES, ...SPECIFIC].filter(k => own(pa(a), k)).length;
    fill(badges,
      issues.length ? h('span.badge.danger', icon('alert', 11), t('stream.per.errors', { n: issues.length })) : null,
      custom ? h('span.badge.accent', t('stream.per.customized', { n: custom })) : null);
    fill(errors, ...issues.map(i => h('li', icon('alert', 13), h('span', i.msg))));
  });
  return el;
}

function renderPer() {
  const list = accounts.filter(editable);
  ui.per.hidden = !list.length;
  fill(ui.per, h('div.st-per-head', h('h2.section-title', t('stream.per.title')), h('span.tiny.faint', t('stream.per.hint'))), ...list.map(panel));
}

// ------------------------------------------------------------------ manual helpers card
const helperBlock = (p, title, children) => h(`div.st-helper.pf-${p}`, h('div.st-helper-head', platformIcon(p), h('h3', title)), children);

function linkRow(a, url, label) {
  return h('div.st-link-row', a ? avatarWithIcon(a) : null, h('span.ellipsis.st-link-name', a ? a.displayName : label),
    h('a.btn.sm', { href: url, target: '_blank', rel: 'noopener noreferrer', title: label }, icon('external'), t('stream.manual.open')),
    iconBtn('link', t('stream.manual.copyLink'), () => copy(url, t('stream.manual.linkCopied'))));
}

function notifyBlock(list) {
  const ta = textInput({ id: 'st-notify', value: form.notification ?? form.title, maxLength: 500, placeholder: t('stream.title.placeholder'), oninput: v => { form.notification = v; refresh(); } });
  const count = h('span.counter');
  const sync = h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'notify:sync' }, onclick: () => { form.notification = null; ta.value = form.title; refresh(); } }, icon('refresh'), t('stream.manual.fromTitle'));
  watch(ta, () => {
    if (form.notification === null && document.activeElement !== ta) ta.value = form.title;
    const n = len(ta.value);
    count.textContent = `${n}/${NOTIFY_MAX}`;
    count.classList.toggle('over', n > NOTIFY_MAX);
    ta.setAttribute('aria-invalid', String(n > NOTIFY_MAX));
    sync.hidden = form.notification === null;
  });
  return helperBlock('twitch', t('stream.manual.notifyTitle'), [
    h('label.small.st-helper-label', { htmlFor: 'st-notify' }, t('stream.manual.notifyLabel')), ta,
    h('div.st-notify-actions', count, h('span.spacer'), sync,
      h('button.btn.sm', { type: 'button', dataset: { focus: 'notify:copy' }, onclick: () => copy(ta.value.trim()) }, icon('copy'), t('common.copy'))),
    ...list.filter(a => /^\w{1,25}$/.test(a.login)).map(a => linkRow(a, `https://dashboard.twitch.tv/u/${encodeURIComponent(a.login)}/settings/stream`, t('stream.manual.twitchOpen'))),
    h('p.tiny.faint', t('stream.manual.notifyHint'))]);
}

function renderHelpers() {
  const by = p => accounts.filter(a => a.platform === p);
  const yt = by('youtube');
  ui.helpers.hidden = !accounts.length;
  fill(ui.helpers,
    h('div.card-head', h('div.st-head-text', h('h2', t('stream.manual.title')), h('p.small.muted', t('stream.manual.hint')))),
    by('twitch').length ? notifyBlock(by('twitch')) : null,
    yt.length ? helperBlock('youtube', t('stream.manual.yt'), [h('p.small.muted', t('stream.manual.ytHint')),
      ...yt.map(a => linkRow(a, /^UC[\w-]{22}$/.test(a.platformUserId || '') ? `https://studio.youtube.com/channel/${a.platformUserId}/livestreaming` : 'https://studio.youtube.com/', t('stream.manual.ytOpen')))]) : null,
    by('kick').length ? helperBlock('kick', 'Kick', [h('p.small.muted', t('stream.manual.kickHint')), linkRow(null, 'https://dashboard.kick.com/stream', t('stream.manual.kickOpen'))]) : null,
    by('tiktok').length ? helperBlock('tiktok', 'TikTok', [h('p.small.muted', t('stream.manual.tiktokHint'))]) : null);
}

// ------------------------------------------------------------------ presets
function presetPlatforms(p) {
  const ids = Object.entries(p.data?.perAccount || {}).filter(([, v]) => v?.enabled !== false).map(([id]) => id);
  return uniq(accounts.filter(a => ids.includes(a.id)).map(a => a.platform));
}

function renderPresets() {
  // Focus fallbacks when the focused control is gone or disabled (deleted preset, "Update" once saved…).
  keepFocus(drawPresets, [`p:${presetId}`, 'preset:save']);
}

function drawPresets() {
  const el = ui.presets;
  const active = presets.find(p => p.id === presetId) || null;
  const filter = h('input', { type: 'search', value: presetFilter, placeholder: t('stream.presets.search'), dataset: { focus: 'preset:filter' }, attrs: { 'aria-label': t('stream.presets.search') } });
  const list = h('ul.st-preset-list');
  const drawList = () => {
    const q = presets.length > 5 ? norm(filter.value) : ''; // the search box only shows above 5 presets
    const items = presets.filter(p => !q || norm(p.name).includes(q) || norm(p.data?.title || '').includes(q));
    fill(list, ...items.map(p => h('li', h(`button.st-preset${p.id === presetId ? '.on' : ''}`, { type: 'button', dataset: { focus: `p:${p.id}` }, attrs: { 'aria-current': p.id === presetId ? 'true' : false }, onclick: () => loadPreset(p) },
      h('span.st-preset-top', h('span.st-preset-name.ellipsis', p.name), h('span.st-preset-pf', presetPlatforms(p).map(x => platformIcon(x)))),
      typeof p.data?.title === 'string' && p.data.title ? h('span.st-preset-sub.ellipsis', p.data.title) : null))));
    if (!items.length) fill(list, h('li.st-preset-empty.small.muted', q ? t('stream.presets.noMatch') : t('stream.presets.empty')));
  };
  filter.addEventListener('input', () => { presetFilter = filter.value; drawList(); });
  const badge = watch(h('span.badge.warn', t('stream.presets.modified')), () => { badge.hidden = !isDirty(); });
  const updateBtn = h('button.btn.sm.primary', { type: 'button', disabled: !isDirty(), dataset: { focus: 'preset:update' }, onclick: () => updatePreset(updateBtn, active) }, t('stream.presets.update'));
  fill(el,
    h('summary', { dataset: { focus: 'presets' } }, icon('bookmark'), h('span.st-presets-title', t('stream.presets.title')), h('span.st-presets-current.ellipsis', active?.name || ''), badge),
    h('div.st-presets-body',
      presetsState === 'loading' ? h('div.stack.st-tight', h('span.skeleton'), h('span.skeleton'), h('span.skeleton.st-short'))
        : presetsState !== 'ok' ? h('div.banner.danger.small', icon('alert'), h('span', t('stream.presets.error', { error: presetsState })), h('button.btn.sm', { type: 'button', dataset: { focus: 'preset:retry' }, onclick: () => loadPresets() }, t('common.retry')))
          : [
            active ? h('div.st-preset-active',
              h('div.st-preset-active-name', h('span.tiny.faint', t('stream.presets.loaded')), h('strong.ellipsis', active.name)),
              h('div.st-preset-actions', watch(updateBtn, () => { if (!updateBtn.classList.contains('busy')) updateBtn.disabled = !isDirty(); }),
                iconBtn('edit', t('stream.presets.rename'), () => renamePreset(active), '', 'preset:rename'),
                iconBtn('copy', t('stream.presets.duplicate'), () => duplicatePreset(active), '', 'preset:duplicate'),
                iconBtn('trash', t('stream.presets.delete'), () => deletePreset(active), '.st-danger', 'preset:delete'))) : null,
            h('button.btn.sm.block', { type: 'button', dataset: { focus: 'preset:save' }, onclick: e => savePreset(e.currentTarget) }, icon('plus'), t('stream.presets.save')),
            presets.length > 5 ? filter : null,
            list,
          ]));
  if (presetsState === 'ok') drawList();
}

/** quiet: background reload after a reconnect (no skeleton; a failure keeps the list already shown). */
async function loadPresets(quiet = false) {
  if (!quiet) { presetsState = 'loading'; renderPresets(); }
  try {
    presets = (await api('/api/presets')).presets || [];
    presetsState = 'ok';
  } catch (err) {
    if (quiet && presetsState === 'ok') return;
    presetsState = err.message;
  }
  renderPresets();
  refresh(false);
}

function upsertPreset(p) {
  const i = presets.findIndex(x => x.id === p.id);
  if (i >= 0) presets[i] = p; else presets.push(p);
}

async function askName(title, value = '') {
  const input = h('input', { id: 'st-preset-name', type: 'text', value, maxLength: 60, placeholder: t('stream.presets.namePlaceholder'), autocomplete: 'off' });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()) { e.preventDefault(); input.closest('dialog')?.close('yes'); } });
  setTimeout(() => input.select());
  const ok = await confirmDialog({ title, body: h('div.field', h('label', { htmlFor: 'st-preset-name' }, t('stream.presets.name')), input), confirm: t('common.save') });
  return ok ? input.value.trim().slice(0, 60) || null : null;
}

function loadPreset(p) {
  const prev = { form: toForm(form), presetId };
  const next = toForm(p.data);
  const raw = p.data?.perAccount || {};
  // Accounts the preset does not know (connected later) keep their current selection.
  for (const a of accounts) if (!own(raw, a.id) && pa(a).enabled === false) next.perAccount[a.id] = { enabled: false };
  if (snapshot(next) !== snapshot(form) || presetId !== p.id) {
    setForm(next, p.id);
    undoable(t('stream.presets.loadedToast', { name: p.name }), prev);
  }
}

async function savePreset(button) {
  const name = await askName(t('stream.presets.saveTitle'), [...form.title.trim()].slice(0, 60).join(''));
  if (!name) return;
  await busy(button, async () => {
    const p = await api('/api/presets', { body: { name, data: presetData() } });
    upsertPreset(p);
    presetId = p.id;
    renderPresets();
    refresh();
    toast(t('stream.presets.saved', { name: p.name }), 'ok');
  });
}

async function updatePreset(button, p) {
  await busy(button, async () => {
    upsertPreset(await api(`/api/presets/${encodeURIComponent(p.id)}`, { method: 'PUT', body: { data: presetData() } }));
    renderPresets();
    refresh(false);
    toast(t('stream.presets.updated', { name: p.name }), 'ok');
  });
}

async function renamePreset(p) {
  const name = await askName(t('stream.presets.renameTitle'), p.name);
  if (!name || name === p.name) return;
  await busy(null, async () => { upsertPreset(await api(`/api/presets/${encodeURIComponent(p.id)}`, { method: 'PUT', body: { name } })); renderPresets(); });
}

async function duplicatePreset(p) {
  const name = `${[...p.name].slice(0, 50).join('')} ${t('stream.presets.copySuffix')}`;
  await busy(null, async () => {
    const copyOf = await api('/api/presets', { body: { name, data: p.data } });
    upsertPreset(copyOf);
    renderPresets();
    toast(t('stream.presets.saved', { name: copyOf.name }), 'ok');
  });
}

async function deletePreset(p) {
  if (!await confirmDialog({ title: t('stream.presets.delete'), body: t('stream.presets.deleteConfirm', { name: p.name }), confirm: t('common.delete'), danger: true })) return;
  await busy(null, async () => {
    await api(`/api/presets/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    presets = presets.filter(x => x.id !== p.id);
    if (presetId === p.id) presetId = null;
    renderPresets();
    refresh();
    toast(t('stream.presets.deleted'), 'ok');
  });
}

// ------------------------------------------------------------------ current info
async function loadCurrent(list) {
  for (const a of list) current.set(a.id, { status: 'loading' });
  refresh(false);
  try {
    const { results } = await api(`/api/stream/info?accounts=${list.map(a => encodeURIComponent(a.id)).join(',')}`);
    for (const a of list) {
      const r = results?.[a.id];
      current.set(a.id, r?.ok ? { status: 'ok', info: r.info || {} } : { status: 'error', error: r?.error || t('common.error') });
    }
  } catch (err) {
    for (const a of list) current.set(a.id, { status: 'error', error: err.message });
  }
  refresh(false);
}

/**
 * Form mirroring the current info: common values from the first account, overrides where an account differs.
 * Platform-specific fields (language, labels…) stay "unchanged": their current value is shown next to them.
 */
function fillFrom(list) {
  const next = toForm(form);
  const info = a => infoOf(a);
  const lead = key => list.find(a => has(a, key) && info(a)[key] != null);
  next.title = lead('title') ? info(lead('title')).title : '';
  const tagLead = list.find(a => has(a, 'tags') && !fieldsOf(a).tags.totalLength && info(a).tags?.length) || lead('tags');
  next.tags = tagLead ? [...info(tagLead).tags] : [];
  next.category = { query: '', picks: {}, yt: lead('ytCategoryId') ? String(info(lead('ytCategoryId')).ytCategoryId) : '' };
  for (const a of list) if (has(a, 'category') && info(a).category && !next.category.picks[a.platform]) next.category.picks[a.platform] = { image: '', ...info(a).category };
  next.category.query = Object.values(next.category.picks)[0]?.name || '';
  for (const a of list) {
    const i = info(a);
    const o = { enabled: true };
    for (const k of SPECIFIC) if (own(pa(a), k)) o[k] = pa(a)[k]; // keep explicit choices
    if (has(a, 'title') && typeof i.title === 'string' && i.title !== next.title) o.title = i.title;
    if (has(a, 'category') && !same('category', i.category, next.category.picks[a.platform])) o.category = i.category ? { image: '', ...i.category } : null;
    if (has(a, 'tags') && Array.isArray(i.tags) && !same('tags', i.tags, next.tags)) o.tags = [...i.tags];
    if (has(a, 'ytCategoryId') && i.ytCategoryId && String(i.ytCategoryId) !== next.category.yt) o.ytCategoryId = String(i.ytCategoryId);
    next.perAccount[a.id] = o;
  }
  return toForm(next);
}

async function loadAndFill(button) {
  const list = selected();
  if (!list.length) return;
  await busy(button, () => loadCurrent(list));
  const ok = list.filter(infoOf);
  if (!ok.length) { toast(t('stream.load.failed'), 'error', 6000); return; }
  const prev = { form: toForm(form), presetId };
  setForm(fillFrom(ok), presetId);
  const failed = list.length - ok.length;
  undoable(failed ? t('stream.load.partial', { n: failed }) : t('stream.load.done'), prev);
}

function reset() {
  const prev = { form: toForm(form), presetId };
  const next = blank();
  for (const [id, v] of Object.entries(form.perAccount)) if (v.enabled === false) next.perAccount[id] = { enabled: false };
  setForm(next, null);
  undoable(t('stream.reset.done'), prev);
}

// ------------------------------------------------------------------ apply bar + preview dialog
function renderBar() {
  const btn = h('button.btn.primary.st-preview-btn', { type: 'button', dataset: { focus: 'preview' }, onclick: () => preview(btn) }, icon('eye'), t('stream.preview'));
  const info = h('div.st-bar-info');
  fill(ui.bar, h('div.st-bar-text', h('strong.st-bar-title', t('stream.bar.title')), info), btn);
  watch(ui.bar, () => {
    const sel = selected();
    const errors = sel.reduce((n, a) => n + problems(a).length, 0);
    if (!btn.classList.contains('busy')) btn.disabled = !sel.length;
    ui.bar.hidden = !accounts.some(editable);
    keepFocus(() => fill(info,
      !sel.length ? h('span.muted', t('stream.bar.none'))
        : h('span.muted', t('stream.bar.accounts', { n: sel.length })),
      errors ? h('button.st-bar-err', { type: 'button', dataset: { focus: 'barErr' }, onclick: jumpToError }, icon('alert', 13), t('stream.bar.errors', { n: errors })) : null,
      sel.length && !errors ? h('span.faint.st-bar-safe', t('stream.bar.safe')) : null));
  });
}

function jumpToError() {
  const target = [...document.querySelectorAll('.st-main [aria-invalid="true"], .st-main .chip.invalid, .st-main .st-errors li')].find(el => !el.closest('[hidden]'));
  if (!target) return;
  const details = target.closest('details');
  if (details) details.open = true;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  (target.matches('textarea, input') ? target : target.closest('.chips-input')?.querySelector('input'))?.focus({ preventScroll: true });
}

async function preview(button) {
  const list = selected();
  if (!list.length) return;
  const missing = list.filter(a => !infoOf(a));
  if (missing.length) await busy(button, () => loadCurrent(missing));
  openPreview(list);
}

function warnings(a, ch) {
  const f = fieldsOf(a);
  const platform = pfName(a.platform);
  const out = [];
  if (ch.tags && f.tags?.replaceAll) out.push(t(ch.tags.length ? 'stream.warn.tagsReplace' : 'stream.warn.tagsClear', { platform }));
  if (ch.labels) out.push(t('stream.warn.labels'));
  if (ch.brandedContent !== undefined) out.push(t('stream.warn.branded', { platform }));
  if (a.caps?.quota) out.push(t('stream.warn.quota'));
  return out;
}

function diffRow(a, key, next, info) {
  let before = null;
  let after;
  if (key === 'tags') {
    const prev = info?.tags || [];
    const lower = l => new Set(l.map(x => x.toLowerCase()));
    const n = lower(next);
    const o = info ? lower(prev) : null;
    if (info) before = prev.length ? h('span.st-chip-list', prev.map(x => h(`span.chip.st-static${n.has(x.toLowerCase()) ? '' : '.st-removed'}`, x))) : h('span.faint', t('stream.empty'));
    after = next.length ? h('span.st-chip-list', next.map(x => h(`span.chip.st-static${!o || o.has(x.toLowerCase()) ? '' : '.st-added'}`, x))) : h('span.faint', t('stream.tags.cleared'));
  } else {
    if (info) before = show(a, key, info[key]);
    after = show(a, key, next);
  }
  return h('div.st-diff-row', h('div.st-diff-label', t(`stream.field.${key}`)),
    h('div.st-diff-vals',
      before !== null ? h(`div.st-old${key === 'tags' ? '.is-tags' : ''}`, h('span.sr-only', t('stream.preview.before')), before) : null,
      h('div.st-new', h('span.st-arrow', { attrs: { 'aria-hidden': 'true' } }, '→'), h('span.sr-only', t('stream.preview.after')), h('span.st-new-val', after))));
}

function resultChip(r) {
  if (!r) return null;
  if (r.status === 'pending') return h('span.badge.st-pending', h('span.st-spin', { attrs: { 'aria-hidden': 'true' } }), t('stream.result.pending'));
  return r.status === 'ok' ? h('span.badge.ok', icon('check', 12), t('stream.result.ok')) : h('span.badge.danger', icon('x', 12), t('stream.result.error'));
}

function diffCard({ a, changes, errors, info }, r) {
  const c = current.get(a.id);
  const warn = warnings(a, changes);
  return h(`section.st-diff.pf-${a.platform}`,
    h('header.st-diff-head', avatarWithIcon(a), h('span.st-diff-name', h('strong.ellipsis', a.displayName), h('span.tiny.faint', pfName(a.platform))), resultChip(r)),
    c?.status === 'error' ? h('p.small.st-note', icon('info', 14), h('span', t('stream.preview.noCurrent', { error: c.error }))) : null,
    Object.entries(changes).map(([k, v]) => diffRow(a, k, v, info)),
    warn.length ? h('ul.st-warn', warn.map(w => h('li', icon('alert', 13), h('span', w)))) : null,
    errors.length ? h('ul.st-errors', errors.map(e => h('li', icon('alert', 13), h('span', e.msg)))) : null,
    r?.status === 'error' ? h('p.st-result-error', { attrs: { role: 'alert' } }, icon('x', 14), h('span', r.error)) : null);
}

function openPreview(list) {
  const plans = list.map(a => ({ a, changes: diffOf(a), errors: problems(a), info: structuredClone(infoOf(a)) })); // info: frozen 'before'
  const todo = plans.filter(p => Object.keys(p.changes).length);
  const unchanged = plans.filter(p => !Object.keys(p.changes).length);
  const blocked = todo.some(p => p.errors.length);
  const results = new Map();
  const body = h('div.st-preview');
  const cancel = h('button.btn', { type: 'button', onclick: () => dlg.close() });
  const go = h('button.btn.primary', { type: 'button' });
  const dlg = h('dialog.st-dialog', { attrs: { 'aria-labelledby': 'st-preview-title' } },
    h('div.dialog-body', h('h2', { id: 'st-preview-title', tabIndex: -1 }, t('stream.preview.title')), body),
    h('div.dialog-actions', cancel, go));
  const failed = () => todo.filter(p => results.get(p.a.id)?.status === 'error');
  // Refused by validation (400 'invalid'): retrying the same changes cannot succeed.
  const retryable = () => failed().filter(p => !results.get(p.a.id).final);
  const draw = () => {
    const done = [...results.values()];
    const pending = done.some(r => r.status === 'pending');
    const bad = failed();
    const again = retryable();
    const counts = { ok: t('stream.result.okCount', { n: done.filter(r => r.status === 'ok').length }), failed: t('stream.result.failedCount', { n: bad.length }) };
    fill(body,
      done.length && !pending ? h(`div.banner.${bad.length ? 'warn' : 'ok'}`, { attrs: { role: 'status' } }, icon(bad.length ? 'alert' : 'check'),
        h('span', !bad.length ? t('stream.result.allOk', { n: done.length }) : t(again.length ? 'stream.result.partial' : 'stream.result.invalid', counts))) : null,
      blocked && !done.length ? h('div.banner.danger.small', icon('alert'), h('span', t('stream.preview.blocked', { names: todo.filter(p => p.errors.length).map(p => p.a.displayName).join(', ') }))) : null,
      !todo.length ? h('div.empty', h('div.big', icon('check', 26)), h('p', t(plans.some(p => Object.keys(effective(p.a)).length) ? 'stream.preview.nothing' : 'stream.preview.emptyForm'))) : null,
      ...todo.map(p => diffCard(p, results.get(p.a.id))),
      unchanged.length && todo.length ? h('p.small.faint.st-same', t('stream.preview.same', { names: unchanged.map(p => p.a.displayName).join(', ') })) : null);
    cancel.textContent = done.length || !todo.length ? t('common.close') : t('common.cancel');
    go.hidden = !todo.length || (done.length > 0 && !pending && !again.length);
    go.disabled = blocked || pending;
    go.classList.toggle('busy', pending);
    fill(go, icon(done.length ? 'refresh' : 'send'),
      done.length ? t('stream.result.retry', { n: again.length || todo.length }) : blocked ? t('stream.preview.fix') : t('stream.preview.apply', { n: todo.length }));
  };
  const run = async targets => {
    for (const p of targets) results.set(p.a.id, { status: 'pending' });
    draw();
    let out = {};
    let failure = null;
    try {
      out = (await api('/api/stream/apply', { body: { changes: Object.fromEntries(targets.map(p => [p.a.id, p.changes])) } })).results || {};
    } catch (err) { failure = err; }
    for (const p of targets) {
      const details = failure?.code === 'invalid' ? failure.data?.details?.[p.a.id] : null;
      const r = failure ? { ok: false, error: (details || []).join(' · ') || failure.message, final: Boolean(details?.length) } : out[p.a.id] || { ok: false, error: t('common.error') };
      results.set(p.a.id, r.ok ? { status: 'ok' } : { status: 'error', error: r.error || t('common.error'), final: r.final });
      if (r.ok) applied(p.a, p.changes);
    }
    draw();
    refresh(false);
    if (dlg.open) (go.hidden ? cancel : go).focus();
  };
  go.addEventListener('click', () => run(results.size ? retryable() : todo));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  draw();
  dlg.showModal();
  dlg.querySelector('#st-preview-title').focus();
}

/** After a successful apply the sent values become the known current info (so the diff is empty). */
function applied(a, changes) {
  const info = { ...(infoOf(a) || {}), ...structuredClone(changes) };
  if (changes.category) {
    const pick = own(pa(a), 'category') ? pa(a).category : form.category.picks[a.platform];
    info.category = { ...changes.category, image: pick?.id === changes.category.id ? pick.image : '' };
  }
  current.set(a.id, { status: 'ok', info });
}

// ------------------------------------------------------------------ page
function renderAll() {
  keepFocus(() => {
    renderAccounts();
    renderFields();
    renderPer();
    renderHelpers();
    renderPresets();
    renderBar();
    refresh(false); // watchers set disabled/hidden states before focus is given back
  });
}

const shape = list => list.map(a => [a.id, a.status, a.displayName, a.avatar, a.caps?.editInfo].join('|')).join();
function setAccounts(list) {
  if (shape(list) !== shape(accounts)) {
    keepFocus(() => {
      accounts = list;
      renderAccounts(); renderPer(); renderHelpers(); renderBar();
      refresh(false);
    });
  } else {
    for (const a of list) Object.assign(accounts.find(x => x.id === a.id), a); // watchers keep their objects
    refresh(false);
  }
}

function onFrame({ t: topic, d }) {
  // Presets only arrive as live frames: after a reconnect, reload them (changes made meanwhile were missed).
  if (topic === 'hello' && hellos++) loadPresets(true);
  if ((topic === 'hello' && Array.isArray(d?.accounts)) || (topic === 'accounts' && Array.isArray(d))) setAccounts(topic === 'hello' ? d.accounts : d);
  else if (topic === 'stats') {
    const a = accounts.find(x => x.id === d?.accountId);
    if (a) { a.stats = d; refresh(false); }
  } else if (topic === 'presets' && Array.isArray(d?.presets)) {
    presets = d.presets;
    presetsState = 'ok';
    renderPresets();
    refresh(false);
  }
}


addI18n({
  fr: {
    'stream.heading': 'Infos du live', 'stream.subtitle': 'Titre, catégorie et tags sur toutes tes plateformes en une seule fois.',
    'stream.live': 'En direct', 'stream.statsUnknown': 'Statut inconnu', 'stream.statsStale': 'Statistiques pas à jour (dernière mise à jour en échec) : {error}',
    'stream.undo': 'Annuler', 'stream.empty': '(vide)', 'stream.yes': 'Oui', 'stream.no': 'Non',
    'stream.unchanged': '— Ne pas modifier —', 'stream.chars': 'car.', 'stream.bytes': 'octets',
    'stream.accounts.title': 'Comptes', 'stream.accounts.all': 'Tout sélectionner', 'stream.accounts.none': 'Tout désélectionner',
    'stream.accounts.noneEditable': 'Aucun compte connecté ne permet de modifier les infos du live.',
    'stream.accounts.tiktok': 'Modifiable seulement dans TikTok LIVE Studio', 'stream.accounts.readonly': 'Non modifiable via l’API',
    'stream.accounts.reconnect': 'À reconnecter',
    'stream.load': 'Charger les infos actuelles', 'stream.load.hint': 'Remplit le formulaire, n’envoie rien.',
    'stream.load.done': 'Formulaire rempli avec les infos actuelles.', 'stream.load.failed': 'Impossible de lire les infos actuelles.',
    'stream.load.partial': 'Formulaire rempli. {n} compte n’a pas pu être lu.', 'stream.load.partial|plural': 'Formulaire rempli. {n} comptes n’ont pas pu être lus.',
    'stream.common.title': 'Pour tous les comptes', 'stream.common.hint': 'Un champ vide ne modifie rien.',
    'stream.reset': 'Réinitialiser', 'stream.reset.done': 'Formulaire réinitialisé.',
    'stream.field.title': 'Titre', 'stream.field.category': 'Catégorie', 'stream.field.tags': 'Tags', 'stream.field.language': 'Langue',
    'stream.field.labels': 'Classification du contenu', 'stream.field.brandedContent': 'Contenu de marque', 'stream.field.description': 'Description',
    'stream.field.ytCategoryId': 'Catégorie YouTube',
    'stream.title.placeholder': 'Titre du live…', 'stream.title.emptyHint': 'Vide = titre inchangé.', 'stream.title.allCustom': 'Chaque compte a un titre personnalisé.',
    'stream.category.placeholder': 'Rechercher une catégorie ou un jeu…', 'stream.category.unchanged': 'inchangée',
    'stream.category.clear': 'Retirer la catégorie {platform}', 'stream.category.noResult': 'Aucun résultat sur {platform}.',
    'stream.category.found': '{n} résultat', 'stream.category.found|plural': '{n} résultats',
    'stream.category.allCustom': 'Chaque compte a une catégorie personnalisée.',
    'stream.category.hint': 'Tape une fois : chaque plateforme est cherchée et la correspondance exacte est présélectionnée. Clique pour choisir une autre catégorie.',
    'stream.yt.label': 'Catégorie YouTube', 'stream.yt.gameHint': 'Le champ « Jeu » de YouTube ne se règle que dans YouTube Studio.',
    'stream.ytcat.1': 'Films et animations', 'stream.ytcat.2': 'Auto/Moto', 'stream.ytcat.10': 'Musique', 'stream.ytcat.15': 'Animaux',
    'stream.ytcat.17': 'Sport', 'stream.ytcat.19': 'Voyages et événements', 'stream.ytcat.20': 'Jeux vidéo', 'stream.ytcat.22': 'People et blogs',
    'stream.ytcat.23': 'Humour', 'stream.ytcat.24': 'Divertissement', 'stream.ytcat.25': 'Actualités et politique', 'stream.ytcat.26': 'Vie pratique et style',
    'stream.ytcat.27': 'Éducation', 'stream.ytcat.28': 'Science et technologie', 'stream.ytcat.29': 'Associations et militantisme',
    'stream.tags.placeholder': 'Ajouter un tag…', 'stream.tags.hint': 'Entrée ou virgule pour ajouter · vide = tags inchangés.',
    'stream.tags.remove': 'Retirer le tag {tag}', 'stream.tags.cleared': 'Aucun tag (tous retirés)',
    'stream.tags.overrideHint': 'Liste vide = tous les tags de ce compte seront retirés.',
    'stream.per.title': 'Par compte', 'stream.per.hint': 'Personnalise un compte sans toucher aux autres.',
    'stream.per.inherited': 'hérité', 'stream.per.unchanged': 'inchangé', 'stream.per.custom': 'Personnaliser', 'stream.per.modify': 'Modifier',
    'stream.per.customized': '{n} personnalisé', 'stream.per.customized|plural': '{n} personnalisés',
    'stream.per.errors': '{n} erreur', 'stream.per.errors|plural': '{n} erreurs',
    'stream.per.current': 'Actuel :', 'stream.per.currentTitle': 'Infos actuelles', 'stream.per.loadError': 'Lecture impossible : {error}',
    'stream.per.noCommon': 'champ commun vide : inchangé',
    'stream.lang.other': 'Autre', 'stream.lang.asl': 'Langue des signes américaine',
    'stream.label.DebatedSocialIssuesAndPolitics': 'Politique et questions sociales sensibles',
    'stream.label.DrugsIntoxication': 'Drogues, intoxication ou consommation excessive de tabac',
    'stream.label.Gambling': 'Jeux d’argent', 'stream.label.ProfanityVulgarity': 'Grossièretés ou vulgarité importantes',
    'stream.label.SexualThemes': 'Thèmes sexuels', 'stream.label.ViolentGraphic': 'Représentations violentes et explicites',
    'stream.labels.none': 'aucune', 'stream.labels.hint': 'Les cases décochées seront désactivées. « Jeu pour adultes » dépend de la catégorie et ne se règle pas ici.',
    'stream.branded.hint': 'Signale une promotion rémunérée (sponsor, partenariat).',
    'stream.desc.hint': 'Limite en octets : accents et emoji comptent pour 2 à 4.',
    'stream.err.titleLong': '{platform} : titre trop long ({n}/{max})',
    'stream.err.descriptionLong': '{platform} : description trop longue ({n}/{max} octets)',
    'stream.err.forbid': '{platform} : « {field} » ne peut pas contenir {chars}', 'stream.err.forbidShort': '{platform} : {chars} interdits',
    'stream.err.tagsMax': '{platform} : {max} tags maximum ({n})', 'stream.err.tagsTotal': '{platform} : tags trop longs au total ({n}/{max} caractères)',
    'stream.err.tag': '{platform} · « {tag} » : {error}', 'stream.err.tagLong': '{max} caractères maximum',
    'stream.err.tagPattern': 'lettres et chiffres uniquement, sans espace ni symbole',
    'stream.err.control': '{platform} : « {field} » contient des caractères de contrôle (tabulation…)', 'stream.err.controlShort': 'caractères de contrôle interdits',
    'stream.bar.title': 'Prêt à appliquer ?', 'stream.bar.none': 'Sélectionne au moins un compte.',
    'stream.bar.accounts': '{n} compte sélectionné', 'stream.bar.accounts|plural': '{n} comptes sélectionnés',
    'stream.bar.errors': '{n} erreur à corriger', 'stream.bar.errors|plural': '{n} erreurs à corriger',
    'stream.bar.safe': 'Rien n’est envoyé sans ta confirmation.',
    'stream.preview': 'Aperçu des changements', 'stream.preview.title': 'Aperçu des changements',
    'stream.preview.nothing': 'Rien à modifier : tout correspond déjà aux infos actuelles.', 'stream.preview.emptyForm': 'Le formulaire est vide : remplis au moins un champ.',
    'stream.preview.same': 'Aucun changement pour : {names}',
    'stream.preview.apply': 'Appliquer à {n} compte', 'stream.preview.apply|plural': 'Appliquer à {n} comptes',
    'stream.preview.fix': 'Corrige les erreurs d’abord', 'stream.preview.blocked': 'Rien ne sera envoyé tant que ces comptes ont des erreurs : {names}.',
    'stream.preview.noCurrent': 'Infos actuelles indisponibles ({error}) : les anciennes valeurs ne sont pas affichées.',
    'stream.preview.before': 'Avant :', 'stream.preview.after': 'Après :',
    'stream.warn.tagsReplace': 'Les tags {platform} seront entièrement remplacés par cette liste.',
    'stream.warn.tagsClear': 'Tous les tags {platform} seront retirés.',
    'stream.warn.labels': 'Les classifications non cochées seront désactivées.',
    'stream.warn.branded': '{platform} refuse les changements trop fréquents de ce réglage.',
    'stream.warn.quota': 'Consomme environ 51 unités de quota YouTube (lecture + écriture).',
    'stream.result.pending': 'Envoi…', 'stream.result.ok': 'Appliqué', 'stream.result.error': 'Échec',
    'stream.result.allOk': '{n} compte mis à jour.', 'stream.result.allOk|plural': '{n} comptes mis à jour.',
    'stream.result.okCount': '{n} réussi', 'stream.result.okCount|plural': '{n} réussis', 'stream.result.failedCount': '{n} en échec',
    'stream.result.partial': '{ok}, {failed} : tu peux réessayer seulement les échecs.',
    'stream.result.invalid': '{ok}, {failed} : corrige les erreurs indiquées puis rouvre l’aperçu.',
    'stream.result.retry': 'Réessayer les échecs ({n})',
    'stream.presets.title': 'Préréglages', 'stream.presets.loaded': 'Préréglage chargé', 'stream.presets.modified': 'modifié',
    'stream.presets.update': 'Mettre à jour', 'stream.presets.updated': 'Préréglage « {name} » mis à jour.',
    'stream.presets.rename': 'Renommer', 'stream.presets.renameTitle': 'Renommer le préréglage',
    'stream.presets.duplicate': 'Dupliquer', 'stream.presets.copySuffix': '(copie)',
    'stream.presets.delete': 'Supprimer le préréglage', 'stream.presets.deleteConfirm': 'Supprimer « {name} » ? Cette action est définitive.',
    'stream.presets.deleted': 'Préréglage supprimé.',
    'stream.presets.save': 'Enregistrer comme préréglage', 'stream.presets.saveTitle': 'Nouveau préréglage',
    'stream.presets.saved': 'Préréglage « {name} » enregistré.', 'stream.presets.name': 'Nom du préréglage',
    'stream.presets.namePlaceholder': 'Ex. Soirée ranked', 'stream.presets.search': 'Rechercher un préréglage…',
    'stream.presets.empty': 'Aucun préréglage. Enregistre ce formulaire pour le réappliquer en un clic.',
    'stream.presets.noMatch': 'Aucun préréglage trouvé.',
    'stream.presets.loadedToast': 'Préréglage « {name} » chargé dans le formulaire (rien n’est envoyé).',
    'stream.presets.error': 'Préréglages indisponibles : {error}',
    'stream.manual.title': 'À faire à la main', 'stream.manual.hint': 'Ces réglages n’ont pas d’API : copie le texte et ouvre la bonne page.',
    'stream.manual.notifyTitle': 'Notification de live Twitch', 'stream.manual.notifyLabel': 'Texte de la notification',
    'stream.manual.fromTitle': 'Reprendre le titre', 'stream.manual.open': 'Ouvrir', 'stream.manual.copyLink': 'Copier le lien',
    'stream.manual.linkCopied': 'Lien copié', 'stream.manual.twitchOpen': 'Paramètres de diffusion Twitch',
    'stream.manual.notifyHint': 'Twitch › Paramètres › Diffusion : colle le texte puis enregistre. Ouvre le lien dans le navigateur connecté au bon compte (un lien ne change pas de compte).',
    'stream.manual.yt': 'YouTube Studio', 'stream.manual.ytHint': 'Jeu, miniature et visibilité se règlent dans YouTube Studio.',
    'stream.manual.ytOpen': 'Gestion du direct YouTube',
    'stream.manual.kickHint': 'Langue et contenu pour adultes : uniquement dans le tableau de bord Kick. Les tags ne sont plus modifiables sur Kick (seuls ses tags par défaut s’affichent).', 'stream.manual.kickOpen': 'Tableau de bord Kick',
    'stream.manual.tiktokHint': 'Titre et sujet du live : dans TikTok LIVE Studio ou l’app TikTok (pas d’API).',
  },
  en: {
    'stream.heading': 'Stream info', 'stream.subtitle': 'Title, category and tags on all your platforms at once.',
    'stream.live': 'Live', 'stream.statsUnknown': 'Status unknown', 'stream.statsStale': 'Stats out of date (last update failed): {error}',
    'stream.undo': 'Undo', 'stream.empty': '(empty)', 'stream.yes': 'Yes', 'stream.no': 'No',
    'stream.unchanged': '— Leave unchanged —', 'stream.chars': 'chars', 'stream.bytes': 'bytes',
    'stream.accounts.title': 'Accounts', 'stream.accounts.all': 'Select all', 'stream.accounts.none': 'Deselect all',
    'stream.accounts.noneEditable': 'None of your connected accounts can edit stream info.',
    'stream.accounts.tiktok': 'Only editable in TikTok LIVE Studio', 'stream.accounts.readonly': 'Not editable through the API',
    'stream.accounts.reconnect': 'Needs reconnecting',
    'stream.load': 'Load current info', 'stream.load.hint': 'Fills the form, sends nothing.',
    'stream.load.done': 'Form filled with the current info.', 'stream.load.failed': 'Could not read the current info.',
    'stream.load.partial': 'Form filled. {n} account could not be read.', 'stream.load.partial|plural': 'Form filled. {n} accounts could not be read.',
    'stream.common.title': 'For all accounts', 'stream.common.hint': 'An empty field changes nothing.',
    'stream.reset': 'Reset', 'stream.reset.done': 'Form reset.',
    'stream.field.title': 'Title', 'stream.field.category': 'Category', 'stream.field.tags': 'Tags', 'stream.field.language': 'Language',
    'stream.field.labels': 'Content classification', 'stream.field.brandedContent': 'Branded content', 'stream.field.description': 'Description',
    'stream.field.ytCategoryId': 'YouTube category',
    'stream.title.placeholder': 'Stream title…', 'stream.title.emptyHint': 'Empty = title unchanged.', 'stream.title.allCustom': 'Every account has a custom title.',
    'stream.category.placeholder': 'Search a category or game…', 'stream.category.unchanged': 'unchanged',
    'stream.category.clear': 'Remove the {platform} category', 'stream.category.noResult': 'No result on {platform}.',
    'stream.category.found': '{n} result', 'stream.category.found|plural': '{n} results',
    'stream.category.allCustom': 'Every account has a custom category.',
    'stream.category.hint': 'Type once: every platform is searched and exact matches are preselected. Click to pick another category.',
    'stream.yt.label': 'YouTube category', 'stream.yt.gameHint': 'YouTube’s “Game” field can only be set in YouTube Studio.',
    'stream.ytcat.1': 'Film & Animation', 'stream.ytcat.2': 'Autos & Vehicles', 'stream.ytcat.10': 'Music', 'stream.ytcat.15': 'Pets & Animals',
    'stream.ytcat.17': 'Sports', 'stream.ytcat.19': 'Travel & Events', 'stream.ytcat.20': 'Gaming', 'stream.ytcat.22': 'People & Blogs',
    'stream.ytcat.23': 'Comedy', 'stream.ytcat.24': 'Entertainment', 'stream.ytcat.25': 'News & Politics', 'stream.ytcat.26': 'Howto & Style',
    'stream.ytcat.27': 'Education', 'stream.ytcat.28': 'Science & Technology', 'stream.ytcat.29': 'Nonprofits & Activism',
    'stream.tags.placeholder': 'Add a tag…', 'stream.tags.hint': 'Enter or comma to add · empty = tags unchanged.',
    'stream.tags.remove': 'Remove tag {tag}', 'stream.tags.cleared': 'No tags (all removed)',
    'stream.tags.overrideHint': 'Empty list = all tags of this account are removed.',
    'stream.per.title': 'Per account', 'stream.per.hint': 'Customize one account without touching the others.',
    'stream.per.inherited': 'inherited', 'stream.per.unchanged': 'unchanged', 'stream.per.custom': 'Customize', 'stream.per.modify': 'Change',
    'stream.per.customized': '{n} customized', 'stream.per.customized|plural': '{n} customized',
    'stream.per.errors': '{n} error', 'stream.per.errors|plural': '{n} errors',
    'stream.per.current': 'Current:', 'stream.per.currentTitle': 'Current info', 'stream.per.loadError': 'Could not read: {error}',
    'stream.per.noCommon': 'common field empty: unchanged',
    'stream.lang.other': 'Other', 'stream.lang.asl': 'American Sign Language',
    'stream.label.DebatedSocialIssuesAndPolitics': 'Politics and Sensitive Social Issues',
    'stream.label.DrugsIntoxication': 'Drugs, Intoxication, or Excessive Tobacco Use',
    'stream.label.Gambling': 'Gambling', 'stream.label.ProfanityVulgarity': 'Significant Profanity or Vulgarity',
    'stream.label.SexualThemes': 'Sexual Themes', 'stream.label.ViolentGraphic': 'Violent and Graphic Depictions',
    'stream.labels.none': 'none', 'stream.labels.hint': 'Unchecked boxes are turned off. “Mature-rated game” comes from the category and cannot be set here.',
    'stream.branded.hint': 'Flags paid promotion (sponsorship, partnership).',
    'stream.desc.hint': 'Limit in bytes: accented letters and emoji count 2 to 4.',
    'stream.err.titleLong': '{platform}: title too long ({n}/{max})',
    'stream.err.descriptionLong': '{platform}: description too long ({n}/{max} bytes)',
    'stream.err.forbid': '{platform}: “{field}” cannot contain {chars}', 'stream.err.forbidShort': '{platform}: {chars} not allowed',
    'stream.err.tagsMax': '{platform}: {max} tags max ({n})', 'stream.err.tagsTotal': '{platform}: tags too long in total ({n}/{max} characters)',
    'stream.err.tag': '{platform} · “{tag}”: {error}', 'stream.err.tagLong': '{max} characters max',
    'stream.err.tagPattern': 'letters and digits only, no space or symbol',
    'stream.err.control': '{platform}: “{field}” contains control characters (tab…)', 'stream.err.controlShort': 'control characters not allowed',
    'stream.bar.title': 'Ready to apply?', 'stream.bar.none': 'Select at least one account.',
    'stream.bar.accounts': '{n} account selected', 'stream.bar.accounts|plural': '{n} accounts selected',
    'stream.bar.errors': '{n} error to fix', 'stream.bar.errors|plural': '{n} errors to fix',
    'stream.bar.safe': 'Nothing is sent without your confirmation.',
    'stream.preview': 'Preview changes', 'stream.preview.title': 'Preview changes',
    'stream.preview.nothing': 'Nothing to change: everything already matches the current info.', 'stream.preview.emptyForm': 'The form is empty: fill in at least one field.',
    'stream.preview.same': 'No change for: {names}',
    'stream.preview.apply': 'Apply to {n} account', 'stream.preview.apply|plural': 'Apply to {n} accounts',
    'stream.preview.fix': 'Fix the errors first', 'stream.preview.blocked': 'Nothing will be sent while these accounts have errors: {names}.',
    'stream.preview.noCurrent': 'Current info unavailable ({error}): previous values are not shown.',
    'stream.preview.before': 'Before:', 'stream.preview.after': 'After:',
    'stream.warn.tagsReplace': 'The {platform} tags will be fully replaced by this list.',
    'stream.warn.tagsClear': 'All {platform} tags will be removed.',
    'stream.warn.labels': 'Unchecked classifications will be turned off.',
    'stream.warn.branded': '{platform} refuses changing this setting too often.',
    'stream.warn.quota': 'Uses about 51 YouTube quota units (read + write).',
    'stream.result.pending': 'Sending…', 'stream.result.ok': 'Applied', 'stream.result.error': 'Failed',
    'stream.result.allOk': '{n} account updated.', 'stream.result.allOk|plural': '{n} accounts updated.',
    'stream.result.okCount': '{n} succeeded', 'stream.result.failedCount': '{n} failed',
    'stream.result.partial': '{ok}, {failed}: you can retry only the failed ones.',
    'stream.result.invalid': '{ok}, {failed}: fix the errors shown, then open the preview again.',
    'stream.result.retry': 'Retry failed ({n})',
    'stream.presets.title': 'Presets', 'stream.presets.loaded': 'Loaded preset', 'stream.presets.modified': 'modified',
    'stream.presets.update': 'Update', 'stream.presets.updated': 'Preset “{name}” updated.',
    'stream.presets.rename': 'Rename', 'stream.presets.renameTitle': 'Rename preset',
    'stream.presets.duplicate': 'Duplicate', 'stream.presets.copySuffix': '(copy)',
    'stream.presets.delete': 'Delete preset', 'stream.presets.deleteConfirm': 'Delete “{name}”? This cannot be undone.',
    'stream.presets.deleted': 'Preset deleted.',
    'stream.presets.save': 'Save as preset', 'stream.presets.saveTitle': 'New preset',
    'stream.presets.saved': 'Preset “{name}” saved.', 'stream.presets.name': 'Preset name',
    'stream.presets.namePlaceholder': 'e.g. Ranked night', 'stream.presets.search': 'Search presets…',
    'stream.presets.empty': 'No presets yet. Save this form to reapply it in one click.',
    'stream.presets.noMatch': 'No preset found.',
    'stream.presets.loadedToast': 'Preset “{name}” loaded into the form (nothing sent).',
    'stream.presets.error': 'Presets unavailable: {error}',
    'stream.manual.title': 'Manual steps', 'stream.manual.hint': 'These settings have no API: copy the text and open the right page.',
    'stream.manual.notifyTitle': 'Twitch go-live notification', 'stream.manual.notifyLabel': 'Notification text',
    'stream.manual.fromTitle': 'Use the title', 'stream.manual.open': 'Open', 'stream.manual.copyLink': 'Copy link',
    'stream.manual.linkCopied': 'Link copied', 'stream.manual.twitchOpen': 'Twitch stream settings',
    'stream.manual.notifyHint': 'Twitch › Settings › Stream: paste the text and save. Open the link in the browser signed in to the right account (a link does not switch accounts).',
    'stream.manual.yt': 'YouTube Studio', 'stream.manual.ytHint': 'Game, thumbnail and visibility are set in YouTube Studio.',
    'stream.manual.ytOpen': 'YouTube live control room',
    'stream.manual.kickHint': 'Language and mature flag: only in the Kick dashboard. Tags can no longer be changed on Kick (it only shows its default tags).', 'stream.manual.kickOpen': 'Kick dashboard',
    'stream.manual.tiktokHint': 'Live title and topic: in TikTok LIVE Studio or the TikTok app (no API).',
  },
});

boot({
  page: '/stream',
  title: t('nav.stream'),
  onFrame,
  onReady(state, root) {
    platforms = new Map((state.platforms || []).map(p => [p.id, p]));
    accounts = state.accounts || [];
    const draft = store.get('stream.draft');
    form = toForm(draft?.form);
    presetId = typeof draft?.presetId === 'string' ? draft.presetId : null;
    root.classList.add('page', 'stream-page');
    fill(root, h('div.st-layout',
      h('div.st-main',
        h('header.st-heading', h('h1', t('stream.heading')), h('p.small.muted', t('stream.subtitle'))),
        ui.accounts = h('section.card.st-accounts', { attrs: { 'aria-labelledby': 'st-accounts-title' } }),
        ui.fields = h('section.card.st-fields'),
        ui.per = h('section.st-per')),
      h('div.st-side',
        ui.bar = h('section.st-bar', { attrs: { 'aria-label': t('stream.preview') } }),
        ui.presets = h('details.card.st-presets'),
        ui.helpers = h('section.card.st-helpers'))));
    ui.presets.open = store.get('stream.presetsOpen', matchMedia('(min-width: 900px)').matches);
    ui.presets.addEventListener('toggle', () => store.set('stream.presetsOpen', ui.presets.open));
    renderAll();
    loadPresets();
    addEventListener('pagehide', save);
  },
});
