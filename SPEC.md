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
src/chat/automod.js        auto filters (§7.1)            + test/automod.test.js
src/chat/bot.js            commands and reminders (§7.5)  + test/live.test.js
src/live.js                live sessions, summary, Discord (§7.6)   + test/live.test.js
src/poll.js                poll on every platform (§7.7)  + test/live.test.js
src/goals.js               follow / sub goals (§7.8)      + test/live.test.js
src/community.js           community HTTP API             + test/community.test.js
src/stream-info.js         stream info + presets          + test/stream-info.test.js
src/overlays.js            saved overlay settings (§7.4)
src/update.js              update check + self-update (node: built-ins only) + test/update.test.js
public/index.html + assets/index.{js,css}                 dashboard
public/chat.html + assets/chat.{js,css}, assets/chat-render.js, overlay.html + assets/overlay.{js,css}   chat dock + overlay
public/assets/overlay-settings.js                         overlay settings rules (pure, shared by server, overlay and dashboard)
public/assets/overlay-widgets.js                          poll card and goal bars (overlay ids poll and goal)
public/assets/alerts.css + alert-card.js, viewer-badge.js alerts and viewers overlays: overlay.js imports a module (and alerts.css)
                                                          only for its own overlay id, so a chat overlay never loads them
src/premium.js                                            supporter styles pack: downloaded with the supporter code into
                                                          <data>/premium/, served at /premium/ (decor.js + alerts.css) to alerts
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
| `emitChat(msg)`, `emitEvent(evt)`, `emitDelete({accountId, messageId?, userId?})` | publish to the hub; `emitChat` fills `flags.first` and runs the auto filters (§7.1) |
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
  flags: { first, action, highlight, self, filtered? },  // self = sent by the account owner; highlight = paid/announcement/etc.; filtered = 'word' | 'link' (auto filters, then deleted: true)
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
(`{access, version, demo, publicUrl, platforms: meta[], accounts: describe[] (admin) | {id, platform, login, displayName, avatar, stats}[] (read), ui, overlays, overlaysSaved, automod, poll, goals, bot, discord, live}`;
`overlays` and `overlaysSaved` for read and admin access, §7.4; `automod` admin only, §7.1; `poll` §7.7 and `goals` §7.8 for both; `bot`, `discord` and `live` admin only, as their own routes return them, or `null`), `GET|PUT /api/settings` (UI
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
- `POST /api/chat/clear` → `{ok}`: empties the hub backlog (chat + events) and publishes topic `chat:clear` (`{}`): docks and the chat overlay empty their lists. The server does the same on its own when the live state goes from `off` to `live` (a new stream starts).
- `GET /api/automod` → `{words, links, allowedLinks, caps, repeat, emotes, symbols, action: delete|timeout, duration, exemptVip, exemptSub}`; `PUT /api/automod` with the whole object (missing fields go back to their defaults; 400 on bad values). Also in `/api/state` as `automod` (admin only). `src/chat/automod.js`: every incoming chat message is checked before it is published. Banned words match whole words, ignoring case and accents; `links` catches `http(s)://`, `www.` and bare domains on common TLDs; `allowedLinks` (domains, up to 100, stored as `youtube.com`) let a link through, subdomains included, unless the message carries another link. Anti-spam (booleans, off by default): `caps` = 15+ letters, 70 % of them capitals; `repeat` = the 3rd identical message (case, accents and spaces ignored) from one person within 60 s; `emotes` = more than 10 emotes or emoji; `symbols` = 15+ symbols making over half the message. Broadcaster, moderators and `flags.self` are never filtered; VIPs (`exemptVip`) and subscribers/members (`exemptSub`) optionally. A match is published with `deleted: true` and `flags.filtered`, so docks show it struck through and overlays skip it; then, when the account's caps allow it, the message is deleted on the platform and, with `action: timeout`, its author is timed out for `duration` seconds (clamped to the platform limits).
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

### 7.4 Overlays (`src/overlays.js`)
Six saved overlays, ids `chat`, `featured`, `alerts`, `viewers`, `poll` and `goal` (`OVERLAY_IDS`), stored in the settings key `overlays` (`{chat, featured, alerts, viewers, poll, goal}`;
absent = defaults, no migration; a missing id = its defaults). Validation is `cleanOverlay()` from `public/assets/overlay-settings.js`: complete object, unknown keys
dropped, numbers rounded and clamped (`max` 1–100, `fade` 0–3600, `size` 8–120, `featureSeconds` 0–3600, `alertSeconds` 1–60), enums whitelisted
(`position` top|center|bottom, `style` card|text|impact|eclipse|glass|switch|wave|prism|silk|neon, `align` left|center|right: chat = left|right, anything else drawn left, `goal` subs|follows|both, `look` bars|ring = how the poll and goal overlays draw, goal only: `color` tramevia|#rrggbb, `subsIcon` / `followsIcon` one of `GOAL_ICONS` (18 line icons)), `volume` 0–100 (alert chime, /assets/chime.wav), `offPlatforms` / `offAccounts` / `offTypes` = **exclusion** lists of ids (an account added later is shown).
`offTypes` holds alert categories (`ALERT_TYPES`: follow, sub, giftsub, tip, raid, redemption, like, share; `alertCategory(type)` maps an event
type to its category, null = never alerts: announcements, stream on/off).
- `GET /api/overlays` (read) → `{overlays: {chat, featured, alerts, viewers, poll, goal}, saved}` (`saved` = the settings key exists).
- `POST /api/overlays/alerts/test` (admin) → `{ok, type}`: publishes a sample event (`test: true`) on topic `alert:test`, picked among the
  categories not in `offTypes`. Not stored, not an `event` (the docks never see it).
- `POST /api/overlays/viewers/test` (admin) → `{ok, delta}`: publishes `{delta}` (±1–12) on topic `viewers:test`; viewer overlays show the
  total + delta for 3.5 s, then the real total (a drop below 0 is shown as a rise).
- `POST /api/overlays/poll/test` (admin) → `{ok}`: publishes `{question, options}` on topic `poll:test`; poll overlays play it on their own
  (votes for 12 s, the result for 6 s), then show the real poll again. `POST /api/overlays/goal/test` (admin) → `{ok, follows: 1, subs: 5}`:
  publishes `{follows, subs}` on topic `goal:test`; goal overlays show the counts plus that gain for 4 s. Neither is stored or counted.
- `PUT /api/overlays/:id {…patch}` (admin) → `{id, settings}`: merged over the current settings, cleaned, saved, published as
  topic `overlay`. `400 {code:'invalid_overlay'}` if the body is not a plain object or its JSON is over 4000 chars;
  `404 {code:'unknown_overlay'}` for another id.
- `DELETE /api/overlays/:id` (admin) → `{id, settings}`: back to the defaults, saved and published.

Overlay page (`/overlay/chat`): `?key=…&id=chat|featured|alerts|viewers|poll|goal` = saved settings, applied live from `overlay` frames; any setting param
also in the URL overrides that one setting. Without `id` (legacy URL) the page is configured only by its params, exactly as in 1.2,
and ignores `overlay` frames. URL `platforms=` / `accounts=` are **inclusion** lists; a message is shown when it passes both lists.
`id=alerts`: live `event` and `alert:test` frames only (the hello backlog is ignored, so nothing replays after a reconnect), one card at
a time for `alertSeconds`, a queue of 20 (oldest waiting dropped beyond that), centred at `position`; `mode=` is ignored.
`id=viewers`: the sum of `viewers` over the shown accounts that are live with a count (from hello `accounts[].stats`, then `stats`
frames, coalesced over 1.2 s so one poll = one change), drawn by `public/assets/viewer-badge.js` (`viewerBadge({h, svg, format}).set(total)`:
entry on the first call, +x / −x animation on every change, none after a settings change); `align` = the number inside the orb or beside it.
`id=poll`: the poll from hello / `/api/state`, then `poll` and `poll:test` frames (`pollCard({t}).set(poll, platforms)` in
`public/assets/overlay-widgets.js`): open = live shares and the time left; closed = the result for 15 s after `closedAt`, then the card leaves.
`id=goal`: `goals` from hello, then `goal` and `goal:test` frames (`goalBars({t}).set(goals, kinds, gain)`), `goal` setting = which bars. `look` (both): `bars`, or `ring` (the poll's answers as arcs of one ring with the time
round it and in its centre, where the winner shows at the end; each goal as a ring gauge round its medal, goals side by side);
a change of `look` rebuilds the card, which enters again. Goal `color`: `tramevia` = the stream gradients, a hex colour tints the bar or ring
(shades of it), the medal (dark disc ringed in it) and the reached state (instead of gold); `subsIcon` / `followsIcon` = the medal icon of
each goal; a change of colour or icon rebuilds the card too. URL overrides: `look`, `color` (`tramevia`, `%23ff8800` or `ff8800`), `subsIcon`, `followsIcon`.
Both draw at rest without any running animation (one-shot effects only; the poll's time line runs while it is open).
Chat overlays skip messages with `flags.vote` (poll votes, §7.7).

### 7.5 Commands and reminders (`src/chat/bot.js`)
Settings key `bot` = `{commands: [{name, text}], timers: [{text, minutes}], offAccounts: [accountId]}`. `GET /api/bot`, `PUT /api/bot` (whole
object; 400 on bad values). `name` 1–25 letters, digits, `-` or `_` (a leading `!` is dropped, stored lowercase, unique ignoring case and
accents), at most 50 commands; `text` 1–500 chars, never starting with `!` or `/`; `minutes` 5–240, at most 10 timers. Only accounts whose caps
include `chatSend` answer; `offAccounts` never do. A command (`!name` as the first word of a message) is answered in the chat it was typed in,
`{user}` = the author's name, once per 30 s per command and account; a filtered (deleted) message gets no answer. A timer posts to
every live channel every `minutes` (first post one interval after going live, timers staggered by one minute), and only to a channel where
someone wrote since its last post. Texts are cut to the account's `caps.limits.chatMaxLength`. YouTube: each message costs 50 quota units.
`ctx.bot.sayLive(text)` sends a text to every live channel that can send (used by the poll).

### 7.6 Live sessions and Discord (`src/live.js`)
A session starts when the first channel goes live (`startedAt` = the earliest live channel's start) and ends once every channel has been off
for 5 min (a stream back within 5 min stays one session; `endedAt` = when it went off). It counts the peak of the total viewers, messages,
distinct chatters (not the broadcaster, not bots), follows and subs per platform (`gains()` from goals.js, an event id counted once, test
events never) and the 5 most active chatters. `GET /api/live` → `{current, last}` (`{startedAt, endedAt, peak, messages, chatters, top:
[{name, platform, n}], platforms: [{platform, follows, subs, messages, peak}]}`; `last` stored in the settings key `live:last`). Admin topic
`live` (the current session, at most every 5 s). Discord (settings key `discord`, webhook sealed with aad `discord`): `GET /api/discord` →
`{announce, summary, message, webhook: bool, hint}`; `PUT /api/discord` (partial; `webhook` must be a `discord.com/api/webhooks/<id>/<token>` URL,
`''` or `null` removes it); `POST /api/discord/test` → `{ok}` (400 without a webhook, 502 when Discord refuses). The announcement goes 60 s
after a session starts (not in demo, not for a session started over 15 min ago: a restart mid-stream never announces again): `message`
(`{name}`, `{title}`, `{category}`; `''` = built-in text) and an embed with every live channel's link. The summary goes when a session of
1 min or more ends. The streamer's own `message` may mention (`@everyone`, roles, users); values from the platforms never do (`@` neutralised).

### 7.7 Poll (`src/poll.js`)
`POST /api/poll {question (1–120), options: [2–5 × 1–40 chars], seconds (15–1800), announce?}` → the poll (`409 poll_running` while one is
open); `GET /api/poll` (read) → poll or `null`; `POST /api/poll/close` ends it now; `DELETE /api/poll` clears it. Poll = `{id, question,
options: [{label, votes}], total, startedAt, endsAt, closedAt, announce}`, published on topic `poll` (read) on every change (votes at most every
400 ms) and in hello / `/api/state`. `emitChat` hands every message to `ctx.poll.vote(msg)` before publishing: a message that is exactly one digit
between 1 and the number of answers, while the poll is open, is a vote (`flags.vote = n`), one per `platform:author.id`, the first counts; deleted,
filtered and own messages never vote. TikTok included. `announce`: the question at the start and the result at the end through `ctx.bot.sayLive`.
Not stored: a restart forgets the poll.

### 7.8 Goals (`src/goals.js`)
Settings key `goals` = `{follows: {label, target, count}, subs: {label, target, count}}` (label ≤ 40 chars, target 1–10 000 000, count
0–10 000 000). `GET /api/goals` (read), `PUT /api/goals` (partial by kind) → published on topic `goal` (read) and in hello / `/api/state`.
Every `event` adds `gains(evt)`: follow → 1 follow; sub, resub, membership → 1 sub; giftsub, giftmembership → `count` subs (1–1000).
An event id is counted once, test events never.

## 8. Realtime (`/ws`)

Frames `{t, d}`. First frame `hello {access, version, accounts, ui, overlays, overlaysSaved, unlocked, poll, goals, backlog: [{t, d}]}` (backlog = last 400 chat/event;
`overlays`/`overlaysSaved` as in `GET /api/overlays`, for every access level). `version` is sent
to every access level: `connectHub` reloads the page when it differs from the first one seen (an update was installed).
Close code `4001` = credentials rotated/revoked: pages with a header reload (login screen), overlays stop.
Topics: `chat`, `chat:delete`, `chat:clear`, `event`, `stats`, `feature`, `overlay` (`{id, settings}` after a save or reset, §7.4), `alert:test`, `viewers:test`, `poll`, `poll:test`, `goal`, `goal:test` (§7.4, §7.7, §7.8) (read-only
clients get only these; the last featured message is replayed after `hello`) and admin-only `accounts` (full list), `live` (§7.6), `settings` (merged UI settings object;
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
