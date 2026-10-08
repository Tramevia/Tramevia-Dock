# Changelog

## 1.2.0 — lighter docks

Docks use far less CPU in OBS, so OBS keeps more for your stream. Measured in Chrome with the demo mode (five live accounts):

| Dock | Before | After |
|---|---|---|
| Chat, live, quiet chat | 15–20 % of a CPU core | under 1 % |
| Stream info, live | about 17 % | under 0.1 % |
| Chat, busy chat (15 messages per second) | about 35 % | about 6 % |

- The red “live” dot no longer pulses: that animation redrew every dock without a break while you were live.
- New chat messages and events show up without a slide-in animation (the OBS chat overlay keeps its animations).
- The chat list scrolls without redrawing itself, and old messages are removed in batches instead of one by one.
- Overlay: optional small “Chat via Tramevia Dock” credit under the chat (`credit=1`, off by default).
- Overlay builder: says that the settings live in the address, so it must be pasted again into OBS after a change.
- GitHub: issue forms ask for the install type and version, warn against pasting keys, and send questions to Discussions.

## 1.0.0 — first public release

- Multi-account, multi-platform: Twitch (any number of accounts), Kick, YouTube Live, TikTok LIVE (read-only, unofficial).
- Unified multichat dock with emotes (native + 7TV/BTTV/FFZ), badges, replies, moderation, multi-target sending.
- Event feed (follows, subs, gifts, cheers, KICKs, Super Chats, memberships, raids, redemptions, TikTok gifts, YouTube Jewels).
- Community dock: real Twitch chatter lists with roles, active chatters elsewhere, combined viewer count.
- Stream info manager: title / category / tags for every platform at once (Kick no longer allows custom tags), per-platform overrides, presets, diff preview.
- Chat overlay for OBS browser sources (transparent, dark or light cards), configured by URL, with a featured-message mode.
- Setup wizard with exact redirect URIs, connection tests and OBS dock links.
- Local-first (localhost, no password) or cloud (Docker / Railway, password required); encrypted token storage.
- Updates: the dashboard checks GitHub once a day and tells you when a new version is out (`UPDATE_CHECK=0` turns it off). ZIP installs update in one click (or automatically when no account is live, off by default): the download is checked (size + SHA-256), the restart takes a few seconds, never happens while you are live, and the previous version comes back by itself if the new one fails to start. Your `data` folder and `.env` are never touched. Docker, Railway and git installs get a notice with the exact steps.
- Official Docker image `ghcr.io/tramevia/tramevia-dock` (linux/amd64 and linux/arm64, tags `1.0.0`, `1.0`, `1` and `latest`). `compose.yaml` uses it, with an optional nightly auto-update (Watchtower) profile.
- Railway: deploy the official image with Railway's Auto Updates (minor versions and patches) and a `/data` volume. A one-click Railway template is coming right after this release.
- French and English interface and documentation.
