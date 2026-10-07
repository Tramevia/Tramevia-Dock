<p align="right"><a href="../fr/faq.md">🇫🇷 Français</a></p>

# FAQ and troubleshooting

[← Back to the README](../../README.md) · [Installation](install.md) · [Platforms](platforms.md) · [OBS](obs.md) · [Cloud](cloud.md)

Find your symptom below. Error messages are quoted as Tramevia Dock shows them in English. The status of each account (**Connected**, **Reconnect needed**, **Error**) is in the dashboard's **Accounts** section, with the error message just below the account.

**Troubleshooting**

- [Tramevia Dock does not start: "Port 8787 is already in use"](#tramevia-dock-does-not-start-port-8787-is-already-in-use)
- ["Host not allowed"](#host-not-allowed)
- [The platform says the redirect address does not match](#the-platform-says-the-redirect-address-does-not-match)
- [Twitch: adding a second account connects the first one again](#twitch-adding-a-second-account-connects-the-first-one-again)
- [Kick: no chat on a local install](#kick-no-chat-on-a-local-install)
- [YouTube: "No live or scheduled broadcast"](#youtube-no-live-or-scheduled-broadcast)
- [YouTube: quota used up](#youtube-quota-used-up)
- [YouTube: disconnected after 7 days](#youtube-disconnected-after-7-days)
- [TikTok: offline, not found or rate limited](#tiktok-offline-not-found-or-rate-limited)
- [Docks are blank or ask for a password in OBS](#docks-are-blank-or-ask-for-a-password-in-obs)
- [I lost the dashboard password](#i-lost-the-dashboard-password)
- [I moved to a new PC](#i-moved-to-a-new-pc)

**Questions**

- [Is it safe?](#is-it-safe)
- [Does it cost money?](#does-it-cost-money)
- [Why the AGPL license?](#why-the-agpl-license)

## Troubleshooting

### Tramevia Dock does not start: "Port 8787 is already in use"

The full message is "Port 8787 is already in use: Tramevia Dock is probably already running".

- Most of the time, Tramevia Dock is **already running** in another window. Look for it in your taskbar, or just open http://localhost:8787.
- If another program uses that port, choose another one with `PORT` in `.env`. Remember to update the redirect addresses and the OBS addresses afterwards: see [Changing the port](install.md#changing-the-port).

If the window shows "Configuration error" instead, read the line below it. The usual one is "ADMIN_PASSWORD is required when the server is reachable from the network": you set `HOST`, or a `PUBLIC_URL` that is not localhost, without a password. Add `ADMIN_PASSWORD` (12 characters or more) to `.env`.

### "Host not allowed"

Tramevia Dock only answers the addresses it knows: `localhost`, `127.0.0.1` on its own port, the host of `PUBLIC_URL`, and the hosts in `ALLOWED_HOSTS`. This protects you against malicious websites.

You see "Host not allowed. Set PUBLIC_URL or ALLOWED_HOSTS." when you open it through another address (your PC's network name or IP, a new domain…). Fix:

- if it is now your main address, set `PUBLIC_URL` to it;
- otherwise, add it to `ALLOWED_HOSTS` with its port, for example `ALLOWED_HOSTS=192.168.1.20:8787`.

Restart Tramevia Dock after changing `.env`.

### The platform says the redirect address does not match

Twitch, Kick and Google show an error (Google: `redirect_uri_mismatch`) when the redirect address registered in your app is not **exactly** the one Tramevia Dock uses.

1. Open the wizard (**Accounts** → the platform's gear icon) and copy the address it shows with the **Copy** button.
2. Compare it with the one in your app, character by character:
   - `http` vs `https`;
   - `localhost` vs `127.0.0.1` (always use `localhost`);
   - the port (`8787` by default);
   - no trailing `/`.
3. Fix it in the app (Twitch developer console, Kick → Settings → Developer, Google Cloud → Clients) and save. Google warns that a change can take from 5 minutes to a few hours to apply.

This also happens after you change `PORT` or `PUBLIC_URL`, or move to the cloud: the addresses change with them.

If you see "Login link expired or already used", start the connection again from the dashboard. A login link is valid for 10 minutes and only once, and restarting Tramevia Dock cancels it.

### Twitch: adding a second account connects the first one again

Twitch offers the account that is already signed in on twitch.tv in your browser. When you click **Add another account**:

- click **Not you?** on the Twitch authorization page and sign in with the other account, or
- log out of twitch.tv in that browser first, or
- click **Copy link** in the "Waiting for authorization in your browser…" banner and open the link in a private window.

When you **Reconnect** an account and sign in with a different one, Tramevia Dock refuses with "Wrong account (expected: …)". Log out of the platform in that browser and try again.

### Kick: no chat on a local install

On a local install, Kick chat goes through the unofficial Pusher socket (see [How Kick chat is read](platforms.md#how-kick-chat-is-read)).

1. Open **Accounts** → your Kick account → **Options**. Under **Chat reading**, choose **Automatic** or **Pusher** (not **Off**, and not **Webhooks**, which cannot work locally).
2. If the account shows "Could not find the Kick chat room…", fill in **Chatroom ID (advanced)** and **Channel ID (optional)** by hand: the **My Kick channel info** link in the same window shows both numbers. Click **Save**.
3. If it shows "Kick rejected the unofficial chat socket (code …)", Kick changed something on its side. Update Tramevia Dock, or use the official webhooks with an [online install or a tunnel](cloud.md).
4. If it shows "Kick chat (unofficial) unreachable, retrying…", something on your network (firewall, VPN, antivirus) may block the connection.

On an online install, if you see "Kick refused the webhook subscriptions", turn on **Enable Webhooks** in your Kick app with the URL given in the message (`PUBLIC_URL/webhooks/kick`), then click **Restart connection** on the account.

### YouTube: "No live or scheduled broadcast"

The full message is "No live or scheduled broadcast on YouTube — schedule one in YouTube Studio first." YouTube keeps the title on a broadcast, so Tramevia Dock needs one to edit: schedule your stream in YouTube Studio (**Create → Go live**), then try again. See [Editing the title on YouTube](platforms.md#editing-the-title-on-youtube).

**Chat shows up a few minutes after going live?** To save quota, Tramevia Dock only checks about every 5 minutes when nothing is happening. It checks much more often (about every 45 seconds) for 2 hours after you connect the account, load or apply stream info, and while another of your accounts is live. To make it check sooner, click **Restart connection** on the YouTube account.

### YouTube: quota used up

You see "YouTube API quota almost used up (… units today): actions are paused until midnight Pacific time" or "YouTube API daily quota exhausted: it resets at midnight Pacific time."

Your Google Cloud project has 10,000 units per day, shared by every YouTube channel connected with it. Each message sent, moderation action or stream info change costs about 50 units (see [The daily quota](platforms.md#the-daily-quota)). Tramevia Dock pauses those actions at 95% to keep some margin. If Google's quota is really exhausted, reading the chat stops as well until the reset.

What you can do:

- wait for the reset (midnight Pacific time);
- send YouTube messages and moderate from YouTube itself during long streams;
- untick YouTube in the **Send to** accounts of the Chat dock when you do not need to send there.

### YouTube: disconnected after 7 days

If your YouTube account shows **Reconnect needed** about a week after connecting, your Google app is still in "Testing" mode. Open the [Audience page](https://console.cloud.google.com/auth/audience), click **Publish app**, then click **Reconnect** on the account.

If the **Test** button reports `deleted_client`, Google deleted the OAuth client after 6 months without use: see [YouTube → Good to know](platforms.md#good-to-know).

### TikTok: offline, not found or rate limited

- **The account says offline while you are live.** Tramevia Dock checks every 2 minutes whether you went live, so chat can take up to about 2 minutes to appear.
- **"TikTok account @… not found: check the username"**: remove the account and add it again with the right username.
- **"Euler Stream sign server quota reached (free tier: ~2,500 requests/day)"**: the free signing server limit is reached. Tramevia Dock waits before trying again. If it happens often, set an Euler Stream API key in `TIKTOK_SIGN_API_KEY` (see [TikTok](platforms.md#tiktok)).
- **"Could not connect to TikTok chat (…)"**: Tramevia Dock retries on its own. If it lasts after a TikTok update, update Tramevia Dock.

TikTok is an unofficial, read-only integration: it can stop working when TikTok changes its systems.

### Docks are blank or ask for a password in OBS

- **Tramevia Dock is not running.** The docks need it. Start it, then close and reopen the dock from the OBS **Docks** menu.
- **The dock shows a login screen.** The dock address does not contain a valid key. This happens after you click **Regenerate** next to **Dock key**, and after a change of `ADMIN_PASSWORD` (Tramevia Dock then regenerates the dock key at the next start). Copy the dock addresses again from the dashboard's **OBS** section and paste them into **Docks → Custom Browser Docks…**.
- **The dock says "Not allowed with this key (read-only)."** You pasted the overlay address (read-only key) into a dock. Use the dock addresses from **OBS docks**.
- **You changed the port or `PUBLIC_URL`.** The dock addresses changed too: copy them again.

The overlay works the same way, with its own read-only key (**Settings → Security → Overlay key**). It does not change when you change the password.

### I lost the dashboard password

The password is the `ADMIN_PASSWORD` value you set: in `.env` for a local or Docker install, in the service variables on Railway.

1. Set a new `ADMIN_PASSWORD` (12 characters or more).
2. Restart Tramevia Dock (on Railway, redeploy the service).

For your safety, changing the password signs out every browser and regenerates the dock key. Copy the dock addresses into OBS again. The overlay address keeps working.

### I moved to a new PC

1. Install Node.js 24.15 or newer on the new PC.
2. Copy the Tramevia Dock folder, **including the `data` folder** (with `secret.key`) and your `.env` if you have one. You can leave out `node_modules`: the start script reinstalls it.
3. If you use `TOKEN_KEY`, keep the same value.
4. Start Tramevia Dock as usual.

With the same port, your redirect addresses and OBS dock addresses stay the same. If you lose `secret.key` (or change `TOKEN_KEY`), the saved credentials cannot be read: accounts show "Stored credentials cannot be decrypted (TOKEN_KEY changed?). Reconnect this account." Enter your app credentials again in the wizard and reconnect each account. If you use `ADMIN_PASSWORD`, the dock key is also regenerated: copy the dock addresses into OBS again.

## Questions

### Is it safe?

Tramevia Dock was built to keep your accounts safe:

- it runs on **your** computer or server, and talks directly to the platforms. There is no Tramevia server in between;
- you sign in on each platform's own page; Tramevia Dock never sees your passwords;
- tokens and app secrets are encrypted on disk;
- without a password, it only answers your own computer; any network access requires `ADMIN_PASSWORD`;
- dock and overlay keys can be regenerated at any time, and **Disconnect** revokes an account's access.

Two integrations are unofficial, and labelled as such in the app: TikTok LIVE and Kick chat through Pusher. They are read-only and need no password, but the platforms do not support them and they can stop working at any time.

The source code is open: anyone can check what it does. Details in [Security & privacy](../../README.md#security--privacy) and [SECURITY.md](../../SECURITY.md).

### Does it cost money?

Tramevia Dock itself is free.

- The developer apps on Twitch, Kick and Google are free, and so is the YouTube API within its daily quota.
- A local install costs nothing more.
- Online hosting (Railway, Render, your own server) is paid by you, to the host.
- TikTok works with the free tier of the Euler Stream signing server; an Euler Stream API key is optional.

### Why the AGPL license?

Tramevia Dock uses [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector), which is under the AGPL-3.0, and the AGPL also makes sure improvements to Tramevia Dock stay open for everyone.

For you as a streamer, nothing changes: you can use Tramevia Dock for free, on as many channels as you like, and modify it for yourself. The AGPL only asks one thing: if you distribute a modified version, or host one for other people to use over a network, you must share its source code under the same license. See [LICENSE](../../LICENSE).
