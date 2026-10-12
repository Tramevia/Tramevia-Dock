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

There are three overlays, each with its own settings and its own address:

- **Chat**: your chat, message after message.
- **Featured message**: only the message you pick in the Chat dock (see below).
- **Alerts**: every follow, sub, gifted sub, tip (bits, KICKs, Super Chats, gifts), raid, channel point reward, TikTok like and share, one card at a time, from all your platforms (see below).

Their settings are saved in Tramevia Dock and **apply live**: change an option in the dashboard and the overlay in OBS follows right away. You paste each address into OBS **once**.

### Add the overlay

1. In the dashboard's **OBS** section, go to **Chat overlay** and pick **Chat**. Adjust the options; the **Live preview** on the right updates as you go (the checkerboard shows transparency). Changes are saved by themselves.
2. Copy the **Overlay address**.
3. In OBS: **Sources → + → Browser**. Give it a name, then paste the address in **URL**.
4. Set **Width 400** and **Height 600** (adjust to your layout), then click **OK**.

For the featured message, pick **Featured message** in the dashboard and add its address as a **second** Browser source.

### Alerts

Pick **Alerts** in the dashboard and add its address as another Browser source, sized like your scene (for example **Width 1920**, **Height 1080**): the alert appears centred at the **top**, **middle** or **bottom** of the source, as you choose. **Shape**: *Card* (sized to its text) or *Banner* (across the whole source). Each alert stays for the **duration** you set (6 seconds by default); the next ones wait their turn. A soft chime plays with every alert: set **Sound volume** to 0 to mute it. Under **Alerts shown**, turn off the kinds you don't want on screen. Click **Send a test alert** to see one in the preview and in OBS without waiting for a real follow.

> [!TIP]
> To hear the chime in your stream and not only on your PC, tick **Control audio via OBS** in the Browser source properties and make sure the source is not muted in the audio mixer.

Alerts are shown only as they happen: when OBS reloads the source, old alerts are not replayed.

After that, you never paste the address again when you change a setting. You only paste it again if the address itself changes: after you regenerate the overlay key (**Settings → Security → Overlay key**), or after you change the port or `PUBLIC_URL`.

The overlay address uses the **overlay key**, which is **read-only**: it can show your chat and read the overlay settings, but it cannot change them or act on your accounts.

**Reset** puts the selected overlay back to its default settings (live too): Dark theme, 20 messages, text size 16 px, bots and `!commands` hidden, text outline on, and 15 seconds for a featured message.

**Filters.** Platforms and accounts you untick are hidden. Everything else is shown, so an account you connect later shows up on the overlay by itself.

### Featured message

The Featured message overlay shows only one message at a time, chosen by you:

1. Add its address as a Browser source (see above).
2. In the Chat dock, hover a message and click **Show on overlay**. Click **Remove from overlay** to take it down.
3. **Duration (s, 0 = until removed)** controls how long it stays.

A message deleted by moderation is never shown again. If OBS reloads the source, the featured message comes back for the time it had left.

### Advanced: settings in the address

You can also put settings in the address itself. Two cases:

- **A variant of a saved overlay.** Add parameters to a saved address (the one with `&id=chat` or `&id=featured`): each parameter replaces that one setting, and the others still follow the dashboard live. For example, a smaller version for another scene: `…&id=chat&size=14&max=5`.
- **Older addresses without `&id=`** (made before saved overlays). They keep working exactly as before, configured only by their parameters, but they **do not follow the dashboard**. To get live settings, copy the new address once.

On/off options are on with `1`, `true` or `yes`; any other value, even empty, turns them off. A number outside its range is brought back into it. The "If missing" column applies to addresses without `&id=`; on a saved address, a missing parameter means the saved setting.

| Parameter | Builder option | Values | If missing from the address |
|---|---|---|---|
| `key` | (added automatically) | the overlay key | required |
| `id` | (added automatically) | `chat` or `featured`: the saved overlay to follow | none: settings come only from the address |
| `mode` | | `featured` for the Featured message mode, any other value for normal chat | normal chat (`featured` with `id=featured`) |
| `theme` | Theme | `transparent`, `dark`, `light` | `transparent` |
| `max` | Max messages | 1 to 100 | 12 |
| `fade` | Fade out (s, 0 = never) | 0 to 3600 seconds, 0 = messages never fade | 0 |
| `size` | Text size (px) | 8 to 120 pixels | 20 px |
| `align` | Alignment | `left`, `right` | `left` |
| `badges` | Badges | on / off | on |
| `icons` | Platform icons | on / off | on |
| `avatars` | Avatars | on / off | off |
| `bubble` | Bubbles | on / off | off |
| `outline` | Text outline | on / off | off |
| `credit` | Small “Chat via Tramevia Dock” credit under the chat, to help others find the project (never on unless you turn it on) | on / off | off |
| `hideBots` | Hide bots | on / off (hides well-known bots such as Nightbot or StreamElements) | off |
| `hideCommands` | Hide !commands | on / off (hides messages starting with `!`) | off |
| `events` | Events (follows, subs…) | on / off | on |
| `platforms` | | comma-separated platforms to **show**: `twitch,kick,youtube,tiktok` | all platforms |
| `accounts` | | comma-separated account ids to **show** | all accounts |
| `featureSeconds` | Duration (s, 0 = until removed) | 0 to 3600 seconds, 0 = until removed (Featured message mode) | 0 |

In the address, `platforms` and `accounts` list what to **show**, while the dashboard filters list what to hide. On a saved address both apply: a message must pass the dashboard filters and the address lists.

In Featured message mode, `max`, `fade`, `hideBots`, `hideCommands` and `events` are ignored and the author's avatar is always shown; `platforms` and `accounts` still apply.

## Tips

- **No custom CSS needed.** The overlay is transparent by itself. Leave the Browser source's *Custom CSS* field as OBS fills it.
- **Overlay not up to date after an update?** Open the Browser source's properties and click **Refresh cache of current page**.
- **Overlay not following your settings?** Check that its address contains `&id=` (see [Advanced: settings in the address](#advanced-settings-in-the-address)), then click **Refresh cache of current page**.
- **Several scenes.** Add the same overlay source to other scenes with **Add Existing** instead of creating copies. For a variant (smaller text, one platform only…), add a source with extra parameters in its address.
- **Reconnects by itself.** If the connection drops or Tramevia Dock restarts, docks and overlays reconnect on their own. After a reconnect or an OBS refresh, the overlay shows the recent messages again; messages from before an Tramevia Dock restart are gone, because they are only kept in memory. The small dot at the top right of each dock shows whether it is connected.
- **Start Tramevia Dock before OBS.** A dock opened while Tramevia Dock is not running stays blank. Close it and reopen it from the **Docks** menu once Tramevia Dock is running.
- **Language or theme for one dock.** Add `&lang=en` or `&lang=fr`, or `&theme=dark`, `&theme=light` or `&theme=auto`, at the end of a dock address to override the dashboard setting for that dock only.
