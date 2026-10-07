<p align="right"><a href="../fr/obs.md">🇫🇷 Français</a></p>

# Add Tramevia Dock to OBS

[← Back to the README](../../README.md) · [Installation](install.md) · [Platforms](platforms.md) · [Cloud](cloud.md) · [FAQ](faq.md)

Tramevia Dock gives OBS two kinds of things:

- **Docks**: panels inside the OBS window (chat, events, community, stream info, dashboard). Only you see them.
- **The chat overlay**: a Browser source that shows your chat **on stream**.

Everything you need is in the dashboard's **OBS** section (**Add to OBS**).

![The Chat, Events, Community and Stream info docks side by side](../assets/screenshots/en/docks.png)

## Docks

### Add the docks

You need OBS Studio 31 or newer: the docks rely on browser features that the older built-in browser of OBS 30 lacks (the chat dock would not work properly).

1. In the Tramevia Dock dashboard, open the **OBS** section. Under **OBS docks** you get one address per dock, each with a **Copy** button.
2. In OBS, open the **Docks** menu → **Custom Browser Docks…**.
3. For each dock: type a name in the left column, paste the copied address in the right column.
4. Click **Apply**. The docks appear as floating panels.
5. Drag them where you want them in the OBS window. They update by themselves.
6. Back in the dashboard, click **I added my docks** to finish the setup checklist.

### Which docks exist

| Dock (name in the dashboard) | Address | What it shows |
|---|---|---|
| **Unified chat** | `/chat` | Every chat in one list, the message box, moderation tools, Twitch marker and clip buttons, the live viewer counts |
| **Events** | `/events` | Follows, subs, gifts, cheers, KICKs, Super Chats, raids, redemptions… |
| **Community** | `/community` | Total viewers, the Twitch chatter list by role, active chatters on the other platforms |
| **Stream info** | `/stream` | Title, category and tags for all your channels, presets, preview and apply |
| **Dashboard** | `/` | The full dashboard: accounts, OBS addresses, settings |

Every dock works from about **300 px wide**. The Chat, Events and Community docks are made for a narrow column; Stream info and the Dashboard are more comfortable wider.

<p>
  <img src="../assets/screenshots/en/chat-dock.png" width="300" alt="The Unified chat dock in a narrow column: viewer counts per channel, messages from Twitch, Kick, YouTube and TikTok, and the message box with account selection">
  <img src="../assets/screenshots/en/community-dock.png" width="300" alt="The Community dock: total viewers per channel, and the official Twitch chatter list grouped by broadcaster, moderators, VIPs and subscribers">
</p>

### The key in the dock addresses

Each dock address ends with `?key=…`. This key gives **full access** to Tramevia Dock (it is what lets the docks work without a password). The dashboard hides it on screen; the **Copy** button copies the full address.

- Treat dock addresses like passwords. Do not show them on stream or share them.
- If one leaks: **Settings → Security → Dock key → Regenerate**. All your docks stop working until you paste their new addresses into OBS.

### Connecting an account from a dock

When you click a connect button inside an OBS dock, Tramevia Dock opens the platform's authorization page in your normal browser. If nothing opens (for example on an online install, which cannot open a browser on your PC), use **Open link** or **Copy link** in the "Waiting for authorization in your browser…" banner.

### Linux with Wayland

On Linux under Wayland, OBS may not offer custom browser docks. Open the dock addresses in a normal browser window instead: they work exactly the same.

## Chat overlay

![The chat overlay over a game scene: messages from Twitch, Kick and TikTok with platform icons, and a YouTube Super Sticker event card](../assets/screenshots/en/overlay.png)

### Add the overlay

1. In the dashboard's **OBS** section, go to **Chat overlay**. Adjust the options; the **Live preview** on the right updates as you go (the checkerboard shows transparency).
2. Copy the **Overlay address**.
3. In OBS: **Sources → + → Browser**. Give it a name, then paste the address in **URL**.
4. Set **Width 400** and **Height 600** (adjust to your layout), then click **OK**.

The overlay address uses the **overlay key**, which is **read-only**: it can show your chat but cannot act on your accounts. You can regenerate it in **Settings → Security → Overlay key**; then paste the new address into the Browser source.

### Featured message mode

Set **Type** to **Featured message** to make a second overlay that shows only one message at a time, chosen by you:

1. Add this address as another Browser source.
2. In the Chat dock, hover a message and click **Show on overlay**. Click **Remove from overlay** to take it down.
3. **Duration (s, 0 = until removed)** controls how long it stays.

A message deleted by moderation is never shown again.

### Overlay address parameters

The builder writes the address for you. If you prefer to edit it by hand, here is every parameter. On/off options accept `1` (on) or `0` (off).

| Parameter | Builder option | Values | If missing from the address |
|---|---|---|---|
| `key` | (added automatically) | the overlay key | required |
| `mode` | Type | `featured` for the Featured message mode | normal chat |
| `theme` | Theme | `transparent`, `dark`, `light` | `transparent` |
| `max` | Max messages | 1 to 100 | 12 |
| `fade` | Fade out (s, 0 = never) | seconds, 0 = messages never fade | 0 |
| `size` | Text size (px) | text size in pixels | overlay's default size |
| `align` | Alignment | `left`, `right` | `left` |
| `badges` | Badges | 1 / 0 | 1 |
| `icons` | Platform icons | 1 / 0 | 1 |
| `avatars` | Avatars | 1 / 0 | 0 |
| `bubble` | Bubbles | 1 / 0 | 0 |
| `outline` | Text outline | 1 / 0 | 0 |
| `hideBots` | Hide bots | 1 / 0 (hides well-known bots such as Nightbot or StreamElements) | 0 |
| `hideCommands` | Hide !commands | 1 / 0 (hides messages starting with `!`) | 0 |
| `events` | Events (follows, subs…) | 1 / 0 | 1 |
| `platforms` | Platforms | comma-separated list: `twitch,kick,youtube,tiktok` | all platforms |
| `accounts` | Accounts (shown when you have several) | comma-separated account ids | all accounts |
| `featureSeconds` | Duration (s, 0 = until removed) | seconds, 0 = until removed (Featured message mode) | 0 |

The builder starts from its own settings, which differ from the "if missing" column: Dark theme, 20 messages, text size 16 px, bots and `!commands` hidden, text outline on, and 15 seconds for a featured message. **Reset** goes back to them.

## Tips

- **No custom CSS needed.** The overlay is transparent by itself. Leave the Browser source's *Custom CSS* field as OBS fills it.
- **Overlay not up to date after an update?** Open the Browser source's properties and click **Refresh cache of current page**.
- **Several scenes.** Add the same overlay source to other scenes with **Add Existing** instead of creating copies.
- **Reconnects by itself.** If the connection drops or Tramevia Dock restarts, docks and overlays reconnect on their own. After a reconnect or an OBS refresh, the overlay shows the recent messages again; messages from before an Tramevia Dock restart are gone, because they are only kept in memory. The small dot at the top right of each dock shows whether it is connected.
- **Start Tramevia Dock before OBS.** A dock opened while Tramevia Dock is not running stays blank. Close it and reopen it from the **Docks** menu once Tramevia Dock is running.
- **Language or theme for one dock.** Add `&lang=en` or `&lang=fr`, or `&theme=dark`, `&theme=light` or `&theme=auto`, at the end of a dock address to override the dashboard setting for that dock only.
