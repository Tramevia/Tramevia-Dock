# Changelog

## Unreleased

- **Alerts overlay**: a third overlay (OBS → Overlay → *Alerts*) shows every follow, sub, gifted sub, tip (bits, KICKs, Super Chats, TikTok and YouTube gifts), raid, channel point reward, TikTok like and share on screen, one card at a time, for Twitch, Kick, YouTube and TikTok together. Settings: theme, position (top / middle / bottom), shape, duration of each alert, sound volume, text size, which alerts to show, platforms and accounts. Motion in the kinetic style: a soft blurred glow in the event colour breathes behind the alert, the words of the title rise one after the other, the user's name is swept by a marker highlight, a small bright dash flicks past, and the icon pops in. Four styles: **Card** (a glass card floating in 3D, with a burst of sparks and a reflection when it lands), **Big text** (large words right on the scene, no frame, the icon on a small tilted white card), **Impact** (a product shot: the alert falls in as a can label cut in three slices that spin on their own, slam together onto the floor with a splash of droplets and a studio light sweep, and leave with a whip pan) and **Eclipse** (light is the only material: two folded beams converge on a ring around the icon, a dark corridor opens between two curved walls of light, a bead flares into an eclipse rim under the text, and it all closes like an eyelid). Changing the style while an alert is on screen rebuilds it in the new style. Numbers with a thin space ("5 000") never split across lines; long names wrap at their seams (NoxModo / LeRetour) before breaking anywhere. The text scales with the source width, so a narrow source never breaks words. A crystalline glockenspiel chime plays with every alert (built in; volume 0 = silent). The overlay page ignores the system "reduce motion" setting: it is stream output for the viewers, not the streamer's own interface. Like the other overlays, it has one fixed address and follows the dashboard live. A **Send a test alert** button shows a sample alert in the preview and in OBS. Old alerts are never replayed when the source reconnects.

## 1.3.0 — faster docks, live overlay settings

Switching tabs in a dock (Chat, Community, Stream info, Dashboard) is about twice as fast when Tramevia Dock runs on a server such as Railway. Measured with 200 ms of network delay: 1.3 s → 0.6 s on average, and the chat 1.1 s → 0.46 s.

- The browser now keeps the dock's scripts, styles and logo between tabs. Their addresses change with every update, so a dock never mixes old and new files.
- A page asks the server for the session, its data and the live connection at the same time, instead of one after the other.
- Overlay: settings are saved in Tramevia Dock and apply live. Chat and Featured message each have one fixed address: paste it into OBS once, then every change in the dashboard shows up on stream right away (paste again only after regenerating the overlay key or changing the port or `PUBLIC_URL`). The first time you open the dashboard, the overlay settings it had remembered in your browser are saved for you. Older overlay addresses (without `&id=`) work exactly as before but don't follow the dashboard; parameters added to a new address still override one setting, for a variant in another scene. Filters now hide the platforms and accounts you untick, so an account connected later shows up by itself.

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
