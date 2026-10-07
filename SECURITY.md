# Security policy / Politique de sécurité

## Reporting a vulnerability / Signaler une vulnérabilité

**Please do not open a public issue.** Use GitHub's private vulnerability reporting
(*Security → Report a vulnerability*) on this repository. You will get an answer within 7 days.

**Merci de ne pas ouvrir d'issue publique.** Utilise le signalement privé de GitHub
(*Security → Report a vulnerability*). Réponse sous 7 jours.

## Supported versions / Versions maintenues

Only the latest release receives security fixes. / Seule la dernière version reçoit des correctifs.

## How Tramevia Dock protects your accounts / Comment Tramevia Dock protège tes comptes

- Self-hosted: tokens never leave your machine/server except to talk to the platforms themselves.
- OAuth tokens and app secrets are encrypted at rest (AES-256-GCM, key from `TOKEN_KEY` or `data/secret.key`).
- Without `ADMIN_PASSWORD` the server only listens on `127.0.0.1` and only answers loopback requests.
  Any network exposure (cloud, LAN, tunnel) requires `ADMIN_PASSWORD`.
- Host header allow-list (DNS-rebinding protection), same-origin checks on every write and WebSocket,
  strict Content-Security-Policy, no third-party scripts.
- Dock links carry a revocable key; overlay links carry a separate **read-only** key. Rotate them from the dashboard.
- Kick webhooks are verified with Kick's RSA signature; replayed or stale events are rejected.
- Never share your `data/` folder, `.env`, dock links or overlay links with a key: treat them like passwords.
