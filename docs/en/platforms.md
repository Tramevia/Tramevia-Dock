<p align="right"><a href="../fr/platforms.md">🇫🇷 Français</a></p>

# Connect your platforms

[← Back to the README](../../README.md) · [Installation](install.md) · [OBS](obs.md) · [Cloud](cloud.md) · [FAQ](faq.md)

- [Before you start](#before-you-start)
- [Twitch](#twitch)
- [Kick](#kick)
- [YouTube](#youtube)
- [TikTok](#tiktok)

## Before you start

### Why you create your own developer app

Tramevia Dock is self-hosted: there is no central Tramevia server holding everyone's access. So for Twitch, Kick and YouTube, you create a small developer "app" in your own name. It is free, takes about 5 minutes per platform, and needs no review. The app is what lets Tramevia Dock read your chat and update your stream for you, without ever knowing your password. TikTok does not need one.

You do everything from the dashboard: **Accounts** section → the platform's card → **Set up the … app** (or the gear icon). The wizard opens with numbered steps, buttons to the right console pages, and copy buttons for every address.

![The "Set up Twitch" wizard: numbered steps, the app name and redirect address with Copy buttons, and the credentials form](../assets/screenshots/en/wizard.png)

The last step of the wizard is always the same:

1. Paste the **Client ID** and **Client Secret** under **Paste your credentials here**.
2. Click **Save and test**. Tramevia Dock checks them with the platform right away.
3. Click **Connect my … account**. Your browser opens the platform's authorization page. Approve, and you get an "Account connected" page that you can close.

The secret is encrypted on your machine and never shown again. Leave the field empty later to keep it.

### Where the redirect addresses come from

After you approve access, the platform sends you back to Tramevia Dock at a "redirect" address. The platform only accepts addresses you registered in your app, and they must match **exactly** (http or https, host name, port, no trailing slash).

Tramevia Dock builds them from `PUBLIC_URL`: `PUBLIC_URL/auth/<platform>/callback`.

| Platform | Local install (default) | Online install (example) |
|---|---|---|
| Twitch | `http://localhost:8787/auth/twitch/callback` | `https://dock.example.com/auth/twitch/callback` |
| Kick | `http://localhost:8787/auth/kick/callback` | `https://dock.example.com/auth/kick/callback` |
| YouTube | `http://localhost:8787/auth/youtube/callback` | `https://dock.example.com/auth/youtube/callback` |

The wizard always shows the exact address for your install, with a **Copy** button. Use that one.

### Local or cloud

- **Local install** (`http://localhost:8787`): everything works except Kick's official webhooks, which need a public HTTPS address. Kick chat then uses an unofficial connection (see [Kick](#kick)).
- **Online install** (Docker, Railway, a tunnel… see [Cloud](cloud.md)): the addresses start with `https://` and your own domain. Platforms reject `http://` addresses other than localhost.

If you use both, add both redirect addresses to the same Twitch app and the same Google client: they accept several. The wizard reminds you of this.

## Twitch

### What you need

- A Twitch account with **two-factor authentication (2FA)** turned on. Twitch requires it to create an app: [Twitch security settings](https://www.twitch.tv/settings/security).

### Create the app

1. Open the [Twitch developer console](https://dev.twitch.tv/console/apps/create) and sign in. The **Register Your Application** form shows up.
2. **Name**: a name nobody else uses on Twitch, for example `Tramevia Dock - YourName`.
3. **OAuth Redirect URLs**: paste the address from the wizard (`http://localhost:8787/auth/twitch/callback` on a local install), then click **Add**. Add your online address too if you have one.
4. **Category**: pick **Broadcaster Suite**. **Client Type**: pick **Confidential**.
5. Tick **I'm not a robot** and click **Create**.
6. Click **Manage** on your app. Copy the **Client ID**, then click **New Secret** and copy the secret. A new secret replaces the old one, so if you click it again, paste the new secret in Tramevia Dock too.

### Connect

1. In the wizard, paste the Client ID and the secret, click **Save and test**. You should see "Client ID and secret accepted by Twitch."
2. Click **Connect my Twitch account** and click **Authorize** on the Twitch page.

### Add a second Twitch account

Click **Add another account** on the Twitch card. Twitch suggests the account already signed in on twitch.tv in your browser, so before approving:

- click **Not you?** on the Twitch authorization page, or
- log out of twitch.tv in that browser, or
- use **Copy link** in the "Waiting for authorization" banner and open the link in a private window.

You can connect as many Twitch accounts as you like. Each one gets its own chat, events and stream info.

### Permissions requested

| Permission (scope) | Used for |
|---|---|
| `channel:manage:broadcast` | Changing the title, category, tags, language, content classification and branded content; creating stream markers |
| `clips:edit` | Creating clips |
| `user:read:chat` | Reading your chat, plus subs, resubs, gifts, raids and announcements |
| `user:write:chat` | Sending messages |
| `moderator:manage:chat_messages` | Deleting messages |
| `moderator:manage:banned_users` | Timeouts, bans and unbans |
| `moderator:read:chatters` | The chatter list in the Community dock |
| `moderator:read:followers` | Follow events, and "Following since" on the user card |
| `bits:read` | Cheers and Power-ups |
| `channel:read:redemptions` | Channel point redemptions |
| `moderation:read` | Knowing who your moderators are (chatter roles) |
| `channel:read:vips` | Knowing who your VIPs are (chatter roles) |

### What works on Twitch

- Chat: read, send (500 characters), reply, emotes (Twitch, 7TV, BetterTTV, FrankerFaceZ), badges.
- Moderation: delete, timeout (1 second to 14 days), ban, unban.
- Community: the official chatter list with roles, refreshed every minute (Twitch's list can lag slightly).
- Live status and viewer count.
- Stream info: title (140 characters), category search with box art, tags (up to 10, 25 characters each, letters and digits only), language, content classification labels, branded content.
- Events: follows, subs, resubs, gifted subs, cheers and Power-ups, raids, channel point redemptions, announcements, going live and offline.
- Quick actions in the Chat dock: **Stream marker** and **Clip**.

Tramevia Dock edits the stream info of the channels you connect. It cannot edit a channel where you are only an editor or a moderator.

The **go-live notification** text has no API. In the Stream info page, **Manual steps → Twitch go-live notification** lets you copy the text and open the right Twitch settings page.

## Kick

### What you need

- A Kick account with **two-factor authentication (2FA)** turned on. The Developer tab requires it: [Kick security settings](https://kick.com/settings/security).

### Create the app

1. Open [Kick → Settings → Developer](https://kick.com/settings/developer) and create a new app.
2. **App name**: for example `Tramevia Dock - YourName`. The description is up to you.
3. **Redirect URL**: paste the address from the wizard (`http://localhost:8787/auth/kick/callback` on a local install). Use `localhost`, not `127.0.0.1`.
4. **Scopes**: tick these eight:

   `user:read` · `channel:read` · `channel:write` · `chat:write` · `events:subscribe` · `moderation:ban` · `moderation:chat_message:manage` · `kicks:read`

   Never tick `streamkey:read`. Tramevia Dock does not need your stream key.
5. **Webhooks**:
   - local install: leave **Enable Webhooks** off;
   - online install (public HTTPS): turn on **Enable Webhooks** and paste the webhook URL from the wizard, `PUBLIC_URL/webhooks/kick` (for example `https://dock.example.com/webhooks/kick`).
6. Save the app, then copy the **Client ID** and **Client Secret**.

If you run Tramevia Dock both locally and online, the simplest is one Kick app per install. A Kick app has only one webhook URL, and it should point to your online install.

### Connect

1. Paste the Client ID and Client Secret in the wizard and click **Save and test** ("Kick credentials are valid.").
2. Click **Connect my Kick account** and approve on Kick.

For another Kick account, log out of kick.com in your browser first, then click **Add another account**.

### How Kick chat is read

Kick only offers chat officially through webhooks, which need a public HTTPS address. You choose the mode per account: **Accounts** → your Kick account → **Options** (gear icon) → **Chat reading**.

| Mode | What it does |
|---|---|
| **Automatic** (default) | Official webhooks when your public address is HTTPS, Pusher otherwise. Recommended. |
| **Webhooks** (official) | Kick sends chat and events to `PUBLIC_URL/webhooks/kick`. Needs an online HTTPS install and **Enable Webhooks** set in your Kick app. Tramevia Dock checks every webhook's signature. |
| **Pusher** (unofficial) | Reads the same chat socket that kick.com uses. Works locally, read-only. Kick does not support it officially, so it may stop working without notice. |
| **Off** | Kick chat, events and active chatters are not read. Sending messages, the title and stats keep working. |

**If Pusher chat does not connect**, Tramevia Dock may not have found your chat room automatically. In the Options window:

1. Click **My Kick channel info** (it opens `kick.com/api/v2/channels/<your name>`).
2. Find the `"chatroom"` part and copy the `"id"` number inside it into **Chatroom ID (advanced)**.
3. Copy the top-level `"id"` number of the same page into **Channel ID (optional)**. Without it, going live/offline, follows and KICKs are not received.
4. Click **Save**. The connection restarts.

### What works on Kick, and the limits

- Chat: read (see the modes above), send (500 characters), reply, emotes (Kick and 7TV).
- Moderation: delete, timeout, ban, unban. Kick counts timeouts in **whole minutes**, from 1 minute to 7 days, so there is no 10-second timeout on Kick.
- Community: no official viewer list, so the Community dock shows **active chatters** (people who wrote recently).
- Live status and viewer count.
- Stream info: title and category search with box art. Tags can no longer be changed on Kick (it only shows its default tags), so Tramevia Dock does not offer them.
- Events: follows, new subs and renewals, gifted subs, KICKs, reward redemptions, going live and offline. In Pusher mode, hosts/raids too.
- No stream markers or clips.
- Language and the mature flag can only be changed in the Kick dashboard (Stream info → **Manual steps** has a link).
- Messages deleted on kick.com by someone else only disappear from the dock in Pusher mode. Kick has also had webhook delivery issues on its side; if events stop arriving, use **Restart connection** on the account.

## YouTube

### What you need

- A Google account with a YouTube channel that can stream (live streaming enabled in YouTube Studio).
- A free Google Cloud project (created in step 1 below).

### Create the Google Cloud app

1. [Create a project](https://console.cloud.google.com/projectcreate), for example "Tramevia Dock".
2. Open [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) for that project and click **Enable**.
3. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) → **Get started**: app name, your email, audience **External**, contact email. **Do not upload a logo**: it would trigger a verification by Google.
4. Open [Clients](https://console.cloud.google.com/auth/clients) → **Create client** → type **Web application**. Under **Authorized redirect URIs**, add the address from the wizard (`http://localhost:8787/auth/youtube/callback` on a local install), plus your online address if you have one.
5. Click **Create** and **copy the Client ID and the client secret right away**. Google shows the secret only once.
6. Open the [Audience page](https://console.cloud.google.com/auth/audience) and click **Publish app**. Do not submit it for verification. If you skip this step, the app stays in "Testing" mode and Google signs you out every 7 days.

### Connect

1. Paste the Client ID and the secret in the wizard and click **Save and test** ("Client ID and secret accepted by Google.").
2. Click **Connect my YouTube account**. In the Google account chooser, pick the account or the **brand channel** you stream on.
3. Google shows "Google hasn't verified this app". That is expected: it is your own app. Click **Advanced**, then **Go to … (unsafe)**, and allow access.

Tramevia Dock asks for a single permission, `https://www.googleapis.com/auth/youtube`, which covers live chat, moderation and editing your broadcast.

### The daily quota

Google gives each Cloud project **10,000 units per day**, reset at midnight Pacific time. Every connected YouTube channel that uses the same app shares them.

| Action | Cost |
|---|---|
| Checking whether you are live, reading the viewer count | 1 unit per check |
| Reading chat | about 1 unit per connection (Google does not document the exact cost) |
| Sending a message | 50 units |
| Delete, timeout, ban or unban | 50 units each |
| Applying stream info | about 51 units (one read + one write) |

To save quota, Tramevia Dock checks for a live broadcast about every 5 minutes when nothing is happening, and about every 45 seconds while you are live, for 2 hours after you connect or restart the account or load or apply stream info, and while another of your accounts is live. That background work costs roughly 80 units per hour while live.

You can follow your usage:

- on the YouTube account in **Accounts**: **API quota: used / limit units (%)**;
- in the Chat dock: **YouTube quota: … units today**.

It is a local estimate. When it reaches 95%, Tramevia Dock pauses sending, moderation and stream info changes on YouTube until midnight Pacific time. If Google itself reports the quota as used up, the meter shows it as full. Tramevia Dock never moderates automatically, so nothing spends quota behind your back.

### Editing the title on YouTube

YouTube stores the title on a **broadcast**, so there must be one:

- while you are live, Tramevia Dock edits the current broadcast;
- otherwise it edits the upcoming broadcast scheduled closest to now. Schedule one in YouTube Studio (**Create → Go live**) before you prepare your stream info.

If there is neither, you get "No live or scheduled broadcast on YouTube — schedule one in YouTube Studio first."

You can change the title (100 characters, no `<` or `>`), the description (5,000 bytes), the tags (500 characters in total) and the **YouTube category** (from YouTube's list, for example Gaming). The **"Game"** field has no API, and Tramevia Dock does not change the thumbnail or the visibility: set them in YouTube Studio (Stream info → **Manual steps** has a link).

### What works on YouTube

- Chat: read, send (200 characters, 50 units each), emotes from BetterTTV and FrankerFaceZ. No replies: YouTube's API has none.
- Moderation: delete, timeout (up to 24 hours), ban, unban, 50 units each. YouTube cannot list bans, so Tramevia Dock can only lift bans made from Tramevia Dock. For the others, use YouTube Studio → Settings → Community.
- Community: active chatters.
- Live status and viewer count (not shown if you hide the count on YouTube).
- Events: Super Chats, Super Stickers, new members, member milestones, gifted memberships and Jewels gifts. YouTube's API has no follow or subscriber events.

### Good to know

- If the app stays in "Testing" mode, Google expires your access after 7 days. Publish it (step 6), then click **Reconnect** on the account.
- Google may delete an OAuth client that has not been used for 6 months. The **Test** button then reports `deleted_client`: restore it in Google Cloud → Clients → Deleted clients (possible for 30 days) or create a new "Web application" client.
- You can revoke Tramevia Dock's access at any time in your [Google account permissions](https://security.google.com/settings/security/permissions).

## TikTok

### Connect

1. In **Accounts**, find the TikTok card.
2. Type your username in **TikTok username** (with or without the `@`) and click **Add**.

That is all: no developer app, no password. Your chat shows up when you are live.

### How it works, and the limits

TikTok has no public API for LIVE. Tramevia Dock uses the open-source library [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector), which reads the same feed as the TikTok app. That is why the TikTok card is labelled **Unofficial**.

- **Read-only.** You get chat (with TikTok emotes), gifts (with their diamond value), follows, shares, subscriptions, Super Fan, likes (grouped every 30 seconds), the viewer count and active chatters. Top gifters are shown as VIPs.
- **No sending, no moderation, no stream info.** The LIVE title and topic are set in TikTok LIVE Studio or the TikTok app.
- **Signing server.** To connect, the library needs a signature from the Euler Stream server. Its free tier allows about 2,500 requests per day. Tramevia Dock spares it: while you are offline it checks every 2 minutes whether you went live (TikTok's own page first), and it only opens the chat connection while you are live. If the limit is reached, the account shows "Euler Stream sign server quota reached". You can set an Euler Stream API key in `TIKTOK_SIGN_API_KEY` (see [Configuration](install.md#configuration-reference)).
- **May break.** When TikTok changes its systems, the connection can stop working until the library and Tramevia Dock are updated.
