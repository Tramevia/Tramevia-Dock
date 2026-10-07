<p align="right"><a href="../fr/cloud.md">🇫🇷 Français</a></p>

# Run it in the cloud (Docker, Railway)

[← Back to the README](../../README.md) · [Installation](install.md) · [Platforms](platforms.md) · [OBS](obs.md) · [FAQ](faq.md)

Most streamers can simply run Tramevia Dock on their streaming PC ([Installation](install.md)). This page is for running it on a server instead.

## When to use it

Run Tramevia Dock online if you want:

- **to reach it from anywhere**: another PC, a laptop, a phone (your moderator setup, a second room…);
- **Kick's official webhooks** for Kick chat and events. They need a public HTTPS address, which a home PC does not have;
- **it to keep running** when your streaming PC is off.

What changes compared to a local install:

- **`ADMIN_PASSWORD` is mandatory** (12 characters or more). Tramevia Dock refuses to start without it as soon as it is reachable from the network.
- Your address starts with `https://`, so the redirect addresses you register on each platform change. Add the new ones next to the local ones (see [Platforms](platforms.md#where-the-redirect-addresses-come-from)).
- When you connect an account from an OBS dock, Tramevia Dock cannot open the browser on your PC by itself: use **Open link** or **Copy link** in the waiting banner (or connect from a normal browser tab).

## Docker (compose)

You need [Docker](https://docs.docker.com/get-started/get-docker/) with Docker Compose, and the Tramevia Dock files (ZIP or `git clone`).

1. In the Tramevia Dock folder, create a file named `.env` containing at least:

   ```env
   ADMIN_PASSWORD=choose-a-long-password
   ```

   You can add any other variable from the [configuration reference](install.md#configuration-reference) (for example `TOKEN_KEY` or your app credentials).

2. Start it:

   ```bash
   docker compose up -d
   ```

3. Open http://localhost:8787 and sign in with your password.

What the provided `compose.yaml` does:

- builds the image from the `Dockerfile` (Node.js 24, runs as a non-root user, built-in healthcheck on `/healthz`);
- publishes the port on **`127.0.0.1:8787`** only, so it is reachable from this machine only;
- keeps your data in a Docker volume named `tramevia-data`, mounted at `/data` (database and `secret.key`);
- restarts the container automatically unless you stop it.

Useful commands:

| Command | What it does |
|---|---|
| `docker compose logs -f` | Shows the logs |
| `docker compose down` | Stops and removes the container (your data stays in the volume) |
| `git pull && docker compose up -d --build` | Updates to the latest version |

Without compose:

```bash
docker build -t tramevia-dock .
docker run -d --name tramevia-dock --restart unless-stopped \
  -p 127.0.0.1:8787:8787 -e ADMIN_PASSWORD='choose-a-long-password' \
  -v tramevia-data:/data tramevia-dock
```

## Railway

[Railway](https://railway.com) runs the Docker image for you, with HTTPS and a public address. It is a paid service (with a trial); check its current pricing. We recommend the Hobby plan.

You need the Tramevia Dock code in a GitHub repository you control (for example your fork of `Tramevia/Tramevia-Dock`).

1. **Create the service.** In Railway: **New Project → Deploy from GitHub repo** → pick your repository. Railway detects the `Dockerfile` and builds it.
2. **Add a volume.** Attach a volume to the service with the mount path **`/data`**. Without it, your accounts and settings are lost at every redeploy.
3. **Set the variables** (service → *Variables*):

   | Variable | Value | Required? |
   |---|---|---|
   | `ADMIN_PASSWORD` | your dashboard password, 12 characters or more | Yes |
   | `TOKEN_KEY` | a long random string, 32 characters or more. Keep a copy in your password manager. | Recommended (otherwise a key is generated in `/data/secret.key`) |
   | `PUBLIC_URL` | `https://` + your custom domain (or `https://${{RAILWAY_PUBLIC_DOMAIN}}`) | Optional: Tramevia Dock detects the Railway domain by itself. Set it if you use a custom domain, and only once that domain exists (step 4): an empty domain makes Tramevia Dock fail to start. |
   | `RAILWAY_RUN_UID` | `0` | Only if the logs show a permission error on `/data` (Railway mounts volumes as root, the image runs as a regular user) |

4. **Get a public address.** In the service's networking settings, generate a domain. You get something like `https://your-app.up.railway.app`. If Railway asks which port to route to, add a variable `PORT` = `8787` and enter `8787`. Then **redeploy** the service: Tramevia Dock reads its Railway address at startup, and until then it answers "Host not allowed" on that address.
5. **Healthcheck and scaling.** In the service settings, set the healthcheck path to **`/healthz`**. Keep **one replica** (Tramevia Dock keeps its data in a single SQLite file and its live connections in memory). Leave **Serverless** (app sleeping) **off**: it would cut your chat connections.
6. **Set up.** Open your Railway address, sign in with `ADMIN_PASSWORD` and follow the wizard. The redirect addresses it shows must start with your Railway domain (if they still show `localhost`, redeploy the service or set `PUBLIC_URL`): add them to your Twitch app and your Google client (they accept several), and set up Kick as described in [Platforms → Kick](platforms.md#kick), including **Enable Webhooks** with `https://your-app.up.railway.app/webhooks/kick`.
7. **Add to OBS.** Copy the dock and overlay addresses from the **OBS** section: they now point to your Railway address.

On a public HTTPS install, Kick accounts in **Automatic** mode read chat through the official webhooks.

## Other hosts and reverse proxies

Tramevia Dock runs on any host that can run a Docker image with a **persistent volume at `/data`** and **HTTPS** in front of it.

- **Render**: only with a paid instance and a persistent disk mounted at `/data`. The free tier has no disk and goes to sleep, which loses your data and cuts the chat.
- **Your own server or NAS**: use the Docker instructions above, behind a reverse proxy that handles HTTPS (Caddy, nginx, Traefik…).

Reverse proxy checklist:

- set `PUBLIC_URL` to the public address, for example `https://dock.example.com` (no path: Tramevia Dock must be served at the root of its domain);
- forward **WebSocket** upgrades (Tramevia Dock uses `/ws` for live updates);
- keep the original `Host` header. If Tramevia Dock is reached under another name too, list it in `ALLOWED_HOSTS` (otherwise it answers "Host not allowed");
- make the proxy add the client address to `X-Forwarded-For`. Tramevia Dock uses it to rate-limit login attempts (only when `HOST` is not `127.0.0.1`, as in Docker);
- run a single instance.

**Using it from another device on your home network.** Set `HOST=0.0.0.0` (or remove `127.0.0.1:` from the port line in `compose.yaml`), set `ADMIN_PASSWORD`, and add the address you will type to `ALLOWED_HOSTS`, for example `ALLOWED_HOSTS=192.168.1.20:8787`. Keep `PUBLIC_URL=http://localhost:8787` and connect your accounts from the PC that runs Tramevia Dock: platforms refuse `http://` redirect addresses other than localhost. On the other device, replace `localhost` with the PC's address in the dock links.

## Local install with a tunnel (Kick webhooks)

If you want Kick's official webhooks while still running Tramevia Dock on your PC, you can give it a public HTTPS address with a tunnel.

Use a **named tunnel with a fixed address** (for example a Cloudflare Tunnel on your own domain, ngrok with a reserved domain, or Tailscale Funnel). "Quick" tunnels that get a new random address at every start do not work here: the redirect addresses and the Kick webhook URL would change every time.

1. Set up the tunnel so that `https://dock.example.com` forwards to `http://localhost:8787`.
2. In `.env`, set:

   ```env
   PUBLIC_URL=https://dock.example.com
   ADMIN_PASSWORD=choose-a-long-password
   ```

3. Restart Tramevia Dock and open it through `https://dock.example.com`.
4. Add the new redirect addresses shown by the wizard to your apps, and turn on **Enable Webhooks** in your Kick app with `https://dock.example.com/webhooks/kick`.
5. Copy the dock and overlay addresses into OBS again (they now use the tunnel address).

Kick accounts in **Automatic** mode then switch to the official webhooks.

## Backups

Everything is in the data folder (`data/` locally, `/data` in Docker and on Railway):

- `tramevia-dock.db`: accounts, encrypted credentials, presets, settings;
- `secret.key`: the encryption key, unless you set `TOKEN_KEY`.

> [!WARNING]
> A backup of the database without its key is useless. Keep `secret.key` with it, or keep your `TOKEN_KEY` somewhere safe (a password manager).

How to back up:

- **Local install**: stop Tramevia Dock, then copy the whole `data` folder (and your `.env`).
- **Docker compose**: `docker compose stop`, then `docker compose cp tramevia-dock:/data ./tramevia-backup`, then `docker compose start`.
- **Railway**: use Railway's volume backups if your plan offers them, and keep `TOKEN_KEY` and `ADMIN_PASSWORD` in your password manager.

To restore, put the files back in the data folder (with the same `TOKEN_KEY` if you use one) and start Tramevia Dock.
