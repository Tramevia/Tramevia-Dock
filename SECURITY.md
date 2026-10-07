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

## Updates / Mises à jour

**What the check reveals.** Once a day (and when you click *Check now*) the server sends one unauthenticated request to
`https://api.github.com/repos/Tramevia/Tramevia-Dock/releases/latest`, with the header `User-Agent: tramevia-dock/<version>`.
GitHub therefore sees your IP address and your current version. Nothing else is sent: no account, no token, no setting.
Turn it off with the dashboard toggle (automatic checks) or with `UPDATE_CHECK=0` in `.env` (no update network call at all).

**Ce que la vérification révèle.** Une fois par jour (et quand tu cliques sur *Vérifier maintenant*) le serveur envoie une
requête anonyme à l'adresse ci-dessus, avec l'en-tête `User-Agent: tramevia-dock/<version>`. GitHub voit donc ton adresse IP
et ta version. Rien d'autre n'est envoyé : ni compte, ni jeton, ni réglage. Désactive-la avec l'interrupteur du tableau de
bord (vérification automatique) ou avec `UPDATE_CHECK=0` dans `.env` (plus aucun appel réseau lié aux mises à jour).

**Integrity of in-app updates (zip installs started with `start.bat` / `start.sh`).**
- The download URL only comes from that GitHub API answer for this hard-coded repository, and must point to
  `https://github.com/Tramevia/Tramevia-Dock/releases/download/vX.Y.Z/tramevia-dock-X.Y.Z.tar.gz` (exact asset name).
- Drafts, pre-releases, older or equal versions and assets without a SHA-256 `digest` are ignored.
- The file is downloaded over HTTPS; its size and SHA-256 must match the values GitHub computed when the asset was uploaded.
  Releases are immutable (assets and tags locked once published) and maintainer accounts use 2FA.
- It is extracted inside the app folder (`.update/`), checked (version, files, required Node.js), then swapped in by renaming
  folders. `data/`, `.env`, `.git` and `.update/` are never touched, npm is never run, Node.js itself is never updated.
  The database is copied to `data/pre-update.db` first. If the new version doesn't start, the launcher restores the previous
  files and that database copy, and the version is never installed automatically again.
- Updates are never applied at startup, never while an account is live, never in demo mode, and never by Docker, Railway,
  git or `npm start` installs (they only show what to run).
- **Not covered:** a compromised GitHub account or CI could publish a malicious release with a correct checksum. That is why
  automatic installation is **off by default**: with it off, nothing is installed until you click *Install now*.

**Intégrité des mises à jour intégrées (installations zip lancées par `start.bat` / `start.sh`).** L'adresse de téléchargement
vient uniquement de la réponse de l'API GitHub pour ce dépôt codé en dur, avec le nom de fichier exact. Brouillons,
pré-versions, versions plus anciennes et fichiers sans empreinte SHA-256 sont ignorés. Taille et SHA-256 doivent correspondre
aux valeurs calculées par GitHub. `data/`, `.env`, `.git` et `.update/` ne sont jamais modifiés ; la base est copiée dans
`data/pre-update.db` avant ; si la nouvelle version ne démarre pas, le lanceur remet l'ancienne et cette copie de la base.
Jamais au démarrage, jamais pendant un live, jamais en mode démo, jamais pour Docker, Railway, git ou `npm start`.
**Non couvert :** un compte GitHub ou une CI compromis pourrait publier une version malveillante avec une empreinte correcte :
c'est pourquoi l'installation automatique est **désactivée par défaut**.
