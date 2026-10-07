# Tramevia Dock — technical specification

Contract shared by every module: read it before contributing. When this spec and the code disagree,
the kernel code (`src/server.js`, `src/accounts.js`, `src/hub.js`, `src/http.js`, `public/assets/core.js`,
`public/assets/ui.css`) is the source of truth — please open an issue so the spec gets fixed.

Platform behaviour was researched from the official docs (Twitch, Kick, YouTube, TikTok) in October 2026;
when in doubt, check the official documentation linked from each adapter.

## 1. Principles

- **Self-hosted, local-first.** Runs on the streamer's PC (`http://localhost:8787`, default) or in Docker/Railway
  (`https://…`, `ADMIN_PASSWORD` mandatory). Each user registers their **own** app on each platform.
- **Server is the source of truth.** All platform connections (chat, events, stats) run in the Node server.
  Pages (OBS docks, overlays, browser tabs) are thin views: one WebSocket (`/ws`) + JSON HTTP API.
- **Minimal dependencies.** Node ≥ 24.15 built-ins (`node:http`, `node:sqlite`, `fetch`, global `WebSocket`
  client, `node:crypto`, `node:test`). Runtime deps: `ws` (WS server) and `tiktok-live-connector` (TikTok only).
  **Do not add dependencies.** Front-end: vanilla ES modules, no build step, no framework, no CDN.
- **Honest UI.** Every feature is gated by adapter **capabilities**; unsupported actions are hidden or disabled
  with an explanation. Unofficial integrations (TikTok, Kick Pusher) are labelled as such.
- **Bilingual.** Every user-visible string exists in French and English (`addI18n({fr:{…}, en:{…}})`).
- **Security rules (non-negotiable).** Never log or return tokens/secrets. Never build HTML from untrusted
  strings: use `h()`/`textContent` (core.js); `innerHTML` only via `svg()` for static icons. Only `<img>` for
  URLs coming from platform CDNs (http/https only). No inline `<script>`/`<style>`/`style=""` in HTML (CSP);
  setting `el.style.setProperty()` from JS is fine. Validate every API input server-side.
- **Ponytail.** Shortest code that is correct. No speculative abstractions. One file per module where possible.

## 2. Layout

```
src/server.js              entry, kernel ctx, core routes, static pages, WS upgrade
src/{config,db,crypto,http,auth,hub,accounts,net}.js   kernel
src/platforms/index.js     registry (loads adapters independently: a broken adapter is skipped, not fatal)
src/platforms/demo.js      demo data (DEMO=1 / --demo)
src/platforms/twitch.js    Twitch adapter                 + test/twitch.test.js
src/platforms/kick.js      Kick adapter                   + test/kick.test.js
src/platforms/youtube.js   YouTube adapter                + test/youtube.test.js
src/platforms/tiktok.js    TikTok adapter                 + test/tiktok.test.js
src/chat/emotes.js         tokenizer + 7TV/BTTV/FFZ       + test/emotes.test.js
src/chat/routes.js         chat HTTP API                  + test/chat-routes.test.js
src/community.js           community HTTP API             + test/community.test.js
src/stream-info.js         stream info + presets          + test/stream-info.test.js
src/update.js              update check + self-update (node: built-ins only) + test/update.test.js
public/index.html + assets/index.{js,css}                 dashboard
public/chat.html + assets/chat.{js,css}, assets/chat-render.js, overlay.html + assets/overlay.{js,css}   chat dock + overlay
public/community.html + assets/community.{js,css}         community dock
public/stream.html + assets/stream.{js,css}               stream info dock
```

Keep every module **importable at all times**: the server loads adapters and feature modules independently.

## 3. Kernel context (`ctx`)

Built in `src/server.js`, passed to adapters and modules:

| member | description |
|---|---|
| `config` | see `src/config.js` (`publicUrl`, `secure`, `loopbackOnly`, `demo`, `dataDir`, …) |
| `db`, `settings` | `node:sqlite` DatabaseSync; `settings.get(key, fallback)` / `settings.set(key, value)` (JSON; `null` deletes) |
| `hub` | `publish(topic, data)`, `on(fn(topic, data)) → unsubscribe`, `backlog()` |
| `log` | `info/warn/error(...)` — never pass secrets |
| `request(url, opts)` | `src/net.js` — JSON fetch; throws `ApiError {platform, status, body, message}` |
| `ApiError` | class from `src/net.js` |
| `app(platform)` | `{clientId, clientSecret, source}` or `null` |
| `redirectUri(platform)` | `${publicUrl}/auth/${platform}/callback` |
| `accounts` | manager (`src/accounts.js`): `list() get(id) describe(a) upsert(…) setStatus(id, status, error) setOptions(id, patch) tokens(a) withToken(a, fn(accessToken, tokens)) saveTokens(a, tokens) pushStats(a, patch) stats(id) restart(a)` |
| `adapterFor(account)` | adapter for an account (demo accounts → demo adapter) |
| `requireAccount(id)` | account or `HttpError 404` |
| `tokenize({platform, channelId, fragments})` | → `Token[]` (src/chat/emotes.js) |
| `emotes.load(platform, channelId)` | preload third-party emote sets (fire and forget) |
| `emitChat(msg)`, `emitEvent(evt)`, `emitDelete({accountId, messageId?, userId?})` | publish to the hub; `emitChat` fills `flags.first` |
| `t(fr, en)` | server-side user-visible text in the dashboard language (account errors, test results, send/moderate errors). Never write combined "FR / EN" strings. |
| `router` | for `routes(router, ctx)` hooks |

Account statuses: `ok | needs_reconnect | error | disabled`. Use `ctx.accounts.setStatus(id, 'needs_reconnect', msg)`
when credentials are rejected, `'error'` for transient failures you surface, back to `'ok'` when healthy.

## 4. Adapter contract (`src/platforms/<id>.js`, `export default {…}`)

Keep the existing metadata (`id name color auth app capabilities infoFields notes`) — you may refine values.

```js
{
  id, name, color, auth: 'oauth' | 'username', app: {consoleUrl, docsUrl, localhost} | null,
  capabilities: {…} | (account|null, ctx) => ({…}),   // flags, see below
  infoFields: {…},                                     // editable stream fields + limits, see §6
  notes,                                               // optional { unofficial: true, … }
  statsInterval: 30000,                                // ms between stats() polls (optional)

  testApp(ctx, app) → {ok: true, message}             // checks client id/secret (e.g. client_credentials); throw ApiError otherwise
  authorize(ctx, {state, redirectUri, app, pkce: {verifier, challenge}, reconnect}) → {url, pending?}
  callback(ctx, {code, redirectUri, app, pending, query}) →
      {platformUserId, login, displayName, avatar, scopes: [], tokens: {access, refresh, expiresAt /*ms*/ , …}, options?}
  resolveUsername(ctx, username) → same shape with tokens: null        // 'username' platforms (TikTok)
  refresh(ctx, account, tokens) → {access, refresh?, expiresAt}       // persisted by the manager before use
  revoke?(ctx, account, tokens)

  connect(ctx, account) → {stop()}   // realtime chat + events. Must reconnect by itself on drops (backoff),
                                     // throw only on setup failure (the manager retries with backoff).
  stats(ctx, account) → {live, viewers, startedAt, title, category, …extra}
  chatters?(ctx, account) → Chatter[]                 // real chatter list (capability `chatters`)
  getInfo(ctx, account) → StreamInfo
  setInfo(ctx, account, changes: Partial<StreamInfo>) // throw ApiError/Error with a readable message
  searchCategories(ctx, account, query) → Category[]
  infoOptions?(ctx, account) → {ytCategories?: [{id, title}], …}
  send(ctx, account, {text, replyTo}) → {ok, id?, error?}
  moderate(ctx, account, {action, messageId, userId, userLogin, duration, reason}) → {ok}
  userInfo?(ctx, account, userId) → {createdAt?, avatar?, followedAt?, description?}
  marker?(ctx, account, {description}) → {ok}
  clip?(ctx, account) → {ok, url}
  routes?(router, ctx)                                // extra routes (e.g. Kick webhook)
}
```

**Capability flags** (booleans): `chatRead chatSend reply deleteMessage timeout ban unban chatters activeChatters
viewers events editInfo categorySearch markers clips quota unofficial needsPublicUrl`.
**Capability limits** (numbers, inside `capabilities.limits`): `chatMaxLength` (Twitch 500, Kick 500, YouTube 200),
`timeoutMin` / `timeoutMax` in seconds (Twitch 1 / 1209600, Kick 60 / 604800, YouTube 1 / 86400). UIs read them
instead of hard-coding platform rules (e.g. hide the 10 s timeout preset on Kick, counter 200 for YouTube).
Per-account variants (e.g. Kick chat mode) → make `capabilities` a function of `(account, ctx)`.
Account options (`PATCH /api/accounts/:id {options}`, ≤ 2 KB): Kick `{chatMode: auto|webhook|pusher|off, chatroomId?, channelId?}`.

API calls with a user token: `ctx.accounts.withToken(account, token => ctx.request(url, {platform, token, clientId}))`
(auto refresh + one retry on 401). `connect()` must be idempotent and clean (timers, sockets) in `stop()`.

## 5. Data models

```js
// Chat message (topic 'chat')
{ id, platform, accountId, channel /* login of the account */, ts /* ms */,
  author: { id, login, name, color /* '#rrggbb' or '' */, avatar, badges: [{id, title, url, role?}],
            roles: [] /* broadcaster moderator vip subscriber member verified bot staff */ },
  text,                                   // plain text (search, copy, TTS)
  tokens: Token[],                        // render tokens (see below)
  reply: { id, author, text } | null,     // message being replied to
  flags: { first, action, highlight, self },  // self = sent by the account owner; highlight = paid/announcement/etc.
  deleted: false }

// Token
{ t: 'text', v } | { t: 'emote', name, url, zw?: [{name, url}] } | { t: 'mention', v } | { t: 'link', v, href }
| { t: 'cheer', name, amount, url, color? }

// Adapter → tokenizer fragments (before 3rd-party emotes / links / mentions)
{ t: 'text', v } | { t: 'emote', name, url } | { t: 'mention', v } | { t: 'cheer', name, amount, url, color? }

// Event (topic 'event'). The same id may be re-sent with updated values (YouTube Jewels combos):
// consumers UPSERT events by id (replace in place), never duplicate.
{ id, platform, accountId, channel, ts, type, user: {id, name, avatar?} | null,
  amount?, currency?, unit?, count?, tier?, months?, label?, text?, tokens?, image? /* https URL */ }
// type ∈ follow sub resub giftsub cheer kicks superchat supersticker membership giftmembership raid redemption
//        gift like share announcement stream_online stream_offline
// gift = platform virtual gift (TikTok gifts, YouTube Jewels): label (gift name), count, amount + unit
//        ('diamonds' TikTok, 'jewels' YouTube; no currency). like = aggregated (≤1 per 30 s per account, summed count,
//        user null when several people liked). TikTok "top gifter" maps to role 'vip'.

// Delete (topic 'chat:delete')   { accountId, messageId? , userId? }   (userId → all messages of that user)
// Stats (topic 'stats')          { accountId, platform, live, viewers, startedAt, title, category, at, error, …extra }
//                                 extra: quota {used, limit} (YouTube), likes (TikTok room total), subscribers (Kick)
// All timestamps (ts, startedAt, createdAt, followedAt, lastSeen, at) are milliseconds since epoch, or null.
// Stats freshness: when a poll fails the last values are kept and re-published with error (message) and fails (count).
// fails ≥ 3 ⇒ live undefined and viewers null (state unknown). UIs show stale data as such (dimmed + tooltip).
// Chatter                        { id, login, name, roles: [] }
// Category                       { id, name, image /* box art URL or '' */ }
// StreamInfo                     { title, category: Category|null, tags: [], language?, labels?: [], brandedContent?,
//                                  description?, ytCategoryId? }
```

## 6. Stream info fields (`infoFields`)

Keys present = editable on that platform. Limits are enforced client-side (UX) **and** in `src/stream-info.js`.
A limit applies only when the adapter declares it in `infoFields`; an undeclared limit means no limit, on both sides.

| key | options |
|---|---|
| `title` | `{max, forbid?}` (chars; `forbid` = forbidden characters) |
| `category` | `{search: true}` |
| `tags` | `{max?, maxLength?, pattern? (unicode regex source), totalLength?, replaceAll: true}` |
| `language` | `{}` (BCP-47, Twitch `broadcaster_language`) |
| `labels` | `{options: [...]}` (Twitch content classification label ids) |
| `brandedContent` | `{}` (boolean) |
| `description` | `{max}` (YouTube) |
| `ytCategory` | `{}` (YouTube `categoryId`, options from `infoOptions`) |

## 7. HTTP API

Core (implemented in `src/server.js`): `GET /healthz`, `GET /api/session`, `POST /api/login|logout`, `GET /api/state`
(`{access, version, demo, publicUrl, platforms: meta[], accounts: describe[] (admin) | {id, platform, login, displayName, avatar, stats}[] (read), ui}`), `GET|PUT /api/settings` (UI
settings object, ≤32 KB, broadcast as topic `settings`; `updateCheck` / `updateAuto` must be booleans or `null`), `GET /api/apps`, `PUT|DELETE /api/apps/:platform`,
`POST /api/apps/:platform/test`, `POST /api/accounts/:platform/connect {reconnect?, openOnServer?} → {url, opened}`,
`GET /auth/:platform/callback`, `POST /api/accounts/username/:platform {username}`,
`PATCH /api/accounts/:id {options}`, `POST /api/accounts/:id/restart`, `DELETE /api/accounts/:id`,
`GET /api/keys → {dock, overlay}`, `POST /api/security/rotate {what: dock|overlay|sessions}` (open WebSockets whose
credential lost access are closed with code 4001). Changing `ADMIN_PASSWORD` signs out every session and regenerates the dock key at the next start.
Updates (admin, §11): `GET /api/update` → `UpdateStatus`, `POST /api/update/check` → `UpdateStatus` (GitHub asked at most once
per 60 s, otherwise the cached status), `POST /api/update/install {version, force?}` → `{ok: true}` (the install continues in the
background) or `409 {code}`: `demo`, `not_zip`, `busy`, `no_update`, `version_mismatch` (body version ≠ `latest.version`),
`live` (an account is live), `live_unknown` (live state unknown and `force !== true`).

Handlers: `router.get(path, async ({req, res, url, params, query, body, access}) => result, {access: 'admin'|'read'|'public', raw, csrf})`.
Return a JSON-serialisable value; throw `HttpError(status, message, code)` (from `src/http.js`) for client errors.
`raw: true` gives `body` as a Buffer (webhooks). `csrf: false` for server-to-server POSTs (webhooks).
Errors: `{error, code}`; an `ApiError` thrown by a handler becomes `502 {error, code: 'platform_error', platform, status}`.

### 7.1 Chat (`src/chat/routes.js`)
- `POST /api/chat/send {text, targets: [accountId], replyTo?: {accountId, messageId}}` → `{results: {[accountId]: {ok, error?, code?}}}`
  (text 1–500 chars after trim, and ≤ `caps.limits.chatMaxLength` per target, else `{ok:false, code:'too_long'}`;
  only accounts whose caps include `chatSend`; send in parallel).
- `POST /api/chat/moderate {accountId, action: delete|timeout|ban|unban, messageId?, userId, userLogin?, duration?, reason?}` → `{ok}`
  (check caps; timeout duration within `caps.limits.timeoutMin`–`timeoutMax` seconds, default 1–1 209 600).
- `GET /api/chat/user?accountId&userId` → `{user, messages: Message[] (from hub backlog), info?: userInfo(), infoError?}`.
- `POST /api/chat/feature {message|null}` → publishes topic `feature` (overlay featured slot) with `featuredAt` (ms);
  `409 {code:'deleted'}` for a deleted message. The hub clears the slot (`feature null`) when a `chat:delete` matches it.
- `POST /api/actions/marker {accountId, description?}`, `POST /api/actions/clip {accountId}` → adapter result.

### 7.2 Community (`src/community.js`)
- `GET /api/community?window=15` → `{totalViewers, partial, window, accounts: [{accountId, platform, login, displayName, avatar, status,
  live /* true|false|null = unknown */, viewers, statsError?, statsFails?, kind: 'chatters'|'active', chatters: [{id, login, name, roles, lastSeen?, count?}], updatedAt, unavailable?, error?}]}`.
  `chatters` capability → `adapter.chatters()` (cached ≥ 60 s per account); otherwise "active chatters" collected
  from the hub `chat` topic (window minutes, 1–240).

### 7.3 Stream info (`src/stream-info.js`)
- `GET /api/stream/info?accounts=id,id` → `{results: {[accountId]: {ok, info?, error?}}}`
- `GET /api/stream/categories?accountId&q` → `{categories: Category[]}` (q 2–100 chars)
- `GET /api/stream/options?accountId` → `infoOptions()` result or `{}`
- `POST /api/stream/apply {changes: {[accountId]: Partial<StreamInfo>}}` → validate everything first
  (`400 {error, code:'invalid', details: {[accountId]: [msg]}}`), then apply in parallel →
  `{results: {[accountId]: {ok, error?}}}`.
- Presets: `GET /api/presets`, `POST /api/presets {name, data}`, `PUT /api/presets/:id {name?, data?}`,
  `DELETE /api/presets/:id`. `data = {title?, tags?, category?: {query, picks?: {[platform]: Category}, yt?: categoryId}, notification?: string|null, perAccount: {[accountId]: {enabled,
  title?, category?, tags?, language?, labels?, brandedContent?, description?, ytCategoryId?}}}` — absent/`null`
  per-account field = inherit the common value.

## 8. Realtime (`/ws`)

Frames `{t, d}`. First frame `hello {access, version, accounts, ui, backlog: [{t, d}]}` (backlog = last 400 chat/event). `version` is sent
to every access level: `connectHub` reloads the page when it differs from the first one seen (an update was installed).
Close code `4001` = credentials rotated/revoked: pages with a header reload (login screen), overlays stop.
Topics: `chat`, `chat:delete`, `event`, `stats`, `feature` (read-only clients get only these; the last featured
message is replayed after `hello`) and admin-only `accounts` (full list), `settings` (merged UI settings object;
`PUT /api/settings` is a shallow merge, `null` deletes a key), `presets` (`{presets}` after any preset change), `update` (`UpdateStatus`, §11, on every change). Pages act through HTTP, never by sending WS frames.

## 9. Front-end conventions

- Page module: `import { boot, h, api, t, addI18n, … } from '/assets/core.js'` then
  `boot({ page: '/chat', title, onReady(state, root), onFrame(frame) })`. `root` is `<main id="app">`.
- Use `ui.css` components (`.btn .card .chip .badge .switch .segmented .field .copy-field .banner .pf-icon …`) and
  CSS variables; page CSS only for layout. Must work at **300 px wide** (OBS dock) up to desktop; dark default.
- i18n keys prefixed by page (`chat.*`, `community.*`, `stream.*`, `home.*`). FR and EN complete.
- Persist per-dock UI preferences with `store` (prefixed localStorage), never secrets.
- `inObs` is true inside OBS; OAuth always through `openAuth()` (server opens the system browser in OBS).
- Accessibility: keyboard reachable, visible focus, `aria-label` on icon buttons, `role=status` for live regions.
- Run the demo for manual checks: `PORT=<yours> DATA_DIR=./.data-<you> NO_OPEN=1 node src/server.js --demo`
  (demo adapter: 2 Twitch + Kick + YouTube + TikTok accounts with fake chat/events/stats/info).

## 10. Tests

`npm test` (= `node --test "test/*.test.js"`) — `node:test` + `node:assert/strict`, no framework. Mock network with
`globalThis.fetch = async (url, init) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}})`
and restore it afterwards. Build a minimal fake `ctx` per test (see `test/helpers.js`). Never hit real platforms in tests.

## 11. Updates (`src/update.js`)

`UpdateStatus` = `{type: 'zip'|'git'|'docker'|'railway'|'manual', current, latest: {version, notesUrl}|null, checkedAt /* ms, 0 = never */,
state: 'idle'|'installing'|'error', error: string|null, failed: {version, reason}|null, live: 'live'|'off'|'unknown', checks: bool,
auto: bool, image: 'ghcr.io/tramevia/tramevia-dock'}`.

- **Install type** (first match): `railway` (`RAILWAY_ENVIRONMENT`/`RAILWAY_PUBLIC_DOMAIN`), `docker` (`CONTAINER`), `git` (`.git` in the
  app folder), `manual` (not started by start.bat/start.sh, i.e. `TRAMEVIA_LAUNCHER !== '1'`, or folder not writable), else `zip`.
  Only `zip` installs itself; the others only show what to run.
- **Check:** `GET https://api.github.com/repos/Tramevia/Tramevia-Dock/releases/latest`, 60 s after start then every 24 h while
  `checks` (`UPDATE_CHECK !== '0'` and `ui.updateCheck !== false`). `UPDATE_CHECK=0` = no update network call at all (manual check
  included). 404 = no update; other non-2xx (rate limit, outage) = check failed, last result kept, manual check answers
  502 `check_failed`. Ignored: drafts, pre-releases, tags other than `vX.Y.Z`, versions not newer, no asset named exactly
  `tramevia-dock-X.Y.Z.tar.gz` with a `sha256:` digest and a `https://github.com/Tramevia/Tramevia-Dock/releases/download/vX.Y.Z/` URL.
- **Live state:** over accounts not `disabled`: any `stats.live === true` → `live`; all `false` (or none) → `off`; else `unknown`.
- **Install (zip):** download (size + SHA-256 = GitHub `digest`), extract with the system tar into `.update/staging`, check
  version / `src/server.js` / `node_modules` / `engines.node`, copy the DB to `<DATA_DIR>/pre-update.db` (node:sqlite `backup`), stop the
  server, copy `src/update.js` to `.update/rollback.mjs`, rename each top-level entry (old one → `.update/rollback/`; `data`, `.env`,
  `.git`, `.update` never touched), mark `.update/unconfirmed` `done` (only then does it carry the DB snapshot), exit **75**.
  Errors before the swap → `state: 'error'`, nothing changed. A swap error → restore (or at least `failed.json`), exit 75.
  Marker present but not `done` at startup (swap cut halfway) → restore before opening the DB, exit 75.
- **Automatic install** (`auto` = zip and `ui.updateAuto === true`, default off): after each check and every 10 min, only when
  `live === 'off'`, not in demo mode, and `latest.version !== failed.version`.
- **Launchers** (frozen contract, see the comments in start.bat / start.sh): exit 75 → start again; another non-zero exit except **98**
  (port in use: another instance runs) while `.update/unconfirmed` exists → `node .update/rollback.mjs rollback` (restores the files and the DB snapshot, writes
  `.update/failed.json`) → start again. The new version deletes `.update/unconfirmed` 30 s after listening and does not open a
  browser tab on that first start. `src/update.js` must import only `node:` built-ins (its copy `.update/rollback.mjs` runs alone).
- **Schema guard:** `openDb` refuses to open data whose `user_version` is higher than `MIGRATIONS.length` (newer version's data).
- **After an update** every page reloads by itself (`hello.version` changed) and pages with a header show "Updated to X".
