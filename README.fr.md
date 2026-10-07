<p align="right"><a href="README.md">🇬🇧 English</a></p>

<p align="center">
  <img src="public/assets/logo.svg" alt="Logo de Tramevia Dock" width="96" height="96">
</p>

<h1 align="center">Tramevia Dock</h1>

<p align="center">
  Ta régie multistream pour OBS, hébergée chez toi : chat unifié, événements, communauté, titre, catégorie et tags pour Twitch, Kick, YouTube Live et TikTok LIVE.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-AGPL--3.0-blue" alt="Licence AGPL-3.0"></a>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2024.15-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24.15 ou plus récent">
  <img src="https://img.shields.io/badge/plateformes-Twitch%20%C2%B7%20Kick%20%C2%B7%20YouTube%20%C2%B7%20TikTok-6441a5" alt="Plateformes : Twitch, Kick, YouTube, TikTok">
</p>

![Les quatre docks de Tramevia Dock côte à côte, comme dans OBS : chat unifié, événements, communauté et infos du live, en mode démo](docs/assets/screenshots/fr/docks.png)

- **Un seul chat pour toutes tes plateformes**, avec les émotes (natives, 7TV, BTTV, FFZ), les badges, les réponses et la modération.
- **Titre, catégorie et tags partout en une fois**, avec des préréglages multi-plateformes et un aperçu avant envoi.
- **Hébergé chez toi** : pas de compte ni de serveur Tramevia. Tes accès restent sur ton PC ou ton serveur, chiffrés.
- **Pensé pour OBS** : des docks légers, un overlay de chat transparent, une interface en français et en anglais.

## Fonctionnalités

### Chat et événements

- Chat unifié de tous tes comptes, avec filtre par compte, recherche, pause automatique au survol et pastille « N nouveaux messages ».
- Émotes natives, plus 7TV, BTTV et FFZ selon la plateforme. Badges, cheermotes Twitch, liens et mentions.
- Envoi sur plusieurs comptes à la fois (« Envoyer sur »), réponses, historique avec ↑ et autocomplétion des émotes avec Tab.
- Modération depuis le chat (supprimer, exclure temporairement, bannir, débannir), dans la limite de ce que chaque plateforme permet.
- Fiche utilisateur : ses messages de la session et, sur Twitch, la date de création du compte et de follow.
- Mise en évidence des premiers messages, des mentions et de tes mots-clés, avec un son facultatif quand on te mentionne.
- Flux d’événements : follows, abonnements, abonnements offerts, Bits, KICKs, Super Chats, Super Stickers, adhésions, Jewels, raids, points de chaîne, cadeaux TikTok…
- Marqueur et clip Twitch en un clic.

### Communauté

- Nombre total de spectateurs, et le détail par chaîne.
- Sur Twitch, la liste officielle des personnes présentes dans le chat, rangées par rôle (streamer, modérateurs, VIP, bots).
- Sur Kick, YouTube et TikTok, qui ne fournissent pas cette liste : les personnes actives ces 5, 15 ou 60 dernières minutes.

### Infos du live

- Titre, catégorie et tags sur tous tes comptes en une seule fois, avec personnalisation compte par compte.
- Une seule recherche de catégorie pour toutes les plateformes, avec les jaquettes.
- Les réglages propres à chaque plateforme : langue, classification du contenu et contenu de marque sur Twitch, description et catégorie sur YouTube.
- Préréglages réutilisables, aperçu des changements avant envoi, résultat par compte et bouton pour réessayer seulement les échecs.
- Une rubrique « À faire à la main » pour ce qui n’a pas d’API (texte de notification de live Twitch, jeu YouTube…), avec le texte à copier et le bon lien.

### Overlay

- Overlay de chat transparent pour une source Navigateur d’OBS, réglé entièrement par son adresse (thème, taille, disparition, filtres…).
- Mode « Message mis en avant » : tu choisis un message dans le dock Chat, il s’affiche à l’écran.
- Aperçu en direct dans le tableau de bord pendant que tu règles.

### Installation et sécurité

- Assistant pas à pas pour chaque plateforme, avec les adresses exactes à copier et un bouton « Tester ».
- Plusieurs comptes par plateforme (par exemple deux chaînes Twitch).
- Jetons chiffrés sur le disque, mot de passe obligatoire dès que l’app est joignable depuis le réseau, clés d’accès régénérables pour les docks et l’overlay.
- En local sur Windows, macOS ou Linux, ou en ligne avec Docker ou Railway.

## Plateformes prises en charge

Légende : ✅ officiel · 🟡 partiel ou limité · ⚠️ non officiel · ❌ indisponible

| | Twitch | Kick | YouTube | TikTok LIVE |
|---|---|---|---|---|
| Lire le chat | ✅ | ✅ webhooks (en ligne)<br>⚠️ Pusher (en local) | ✅ | ⚠️ |
| Envoyer des messages | ✅ 500 car. | ✅ 500 car. | 🟡 200 car., 50 unités de quota par message | ❌ |
| Répondre à un message | ✅ | ✅ | ❌ | ❌ |
| Modération (supprimer, exclure, bannir, débannir) | ✅ exclusion de 1 s à 14 j | ✅ exclusion de 1 min à 7 j | 🟡 50 unités par action, exclusion jusqu’à 24 h, débannissement limité | ❌ |
| Qui est dans le chat | ✅ liste officielle | 🟡 personnes actives | 🟡 personnes actives | 🟡 personnes actives |
| Spectateurs et statut du live | ✅ | ✅ | ✅ | ⚠️ |
| Titre | ✅ 140 car. | ✅ | ✅ 100 car. | ❌ |
| Catégorie | ✅ recherche et jaquettes | ✅ recherche et jaquettes | 🟡 liste fixe, le « Jeu » se règle dans YouTube Studio | ❌ |
| Tags | ✅ 10 tags de 25 car. | ✅ 10 tags | ✅ 500 car. au total | ❌ |
| Événements | ✅ | ✅ webhooks<br>⚠️ Pusher | 🟡 ni follows ni abonnements | ⚠️ |
| Marqueur et clip | ✅ | ❌ | ❌ | ❌ |

À savoir :

- **TikTok LIVE** n’a pas d’API pour les lives. Tramevia Dock lit ton chat, tes cadeaux et tes spectateurs en **lecture seule**, via la bibliothèque non officielle [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) et le serveur de signature d’Euler Stream. Ça peut cesser de fonctionner après une mise à jour de TikTok.
- **Kick en local** : le chat passe par le socket Pusher non officiel qu’utilise kick.com lui-même. Les webhooks officiels demandent une adresse publique en HTTPS, donc une installation en ligne. L’envoi de messages, la modération et les infos du live passent par l’API officielle dans les deux cas.
- **YouTube** : chaque action consomme du quota (10 000 unités par jour et par projet Google Cloud). Tramevia Dock affiche une estimation et met l’envoi en pause avant la limite.
- Aucune plateforme ne permet de modifier le texte de notification de live par API. Pour Twitch, le dock « Infos du live » te prépare le texte et le lien vers la bonne page.

Le détail plateforme par plateforme est dans le [guide des plateformes](docs/fr/platforms.md).

## Démarrage rapide

### Windows

1. Installe **Node.js LTS** (version 24.15 ou plus récente) depuis [nodejs.org](https://nodejs.org). Les options par défaut suffisent.
2. Télécharge Tramevia Dock en ZIP depuis la [page des versions](https://github.com/Tramevia/Tramevia-Dock/releases) (ou **Code → Download ZIP**), puis extrais-le dans un dossier, par exemple `Documents\Tramevia Dock`.
3. Double-clique sur `start.bat`. La première fois, il installe ce dont il a besoin : il faut une connexion internet.
4. Ton navigateur s’ouvre sur <http://localhost:8787>. Laisse la fenêtre noire ouverte tant que tu utilises Tramevia Dock.
5. Suis l’écran « Bienvenue sur Tramevia Dock » : trois étapes, environ 5 minutes par plateforme.

### macOS et Linux

```bash
git clone https://github.com/Tramevia/Tramevia-Dock.git
cd tramevia-dock
./start.sh
```

Sur macOS, tu peux aussi double-cliquer sur `start.command`. Tous les détails sont dans le [guide d’installation](docs/fr/install.md).

### Essayer sans aucun compte

Le mode démo affiche de faux comptes avec du faux chat, des événements et des statistiques. Rien n’est envoyé aux plateformes.

- Windows : double-clique sur `demo.bat`.
- macOS et Linux : `./start.sh --demo`.
- Si les dépendances sont déjà installées : `npm run demo`.

## Connecter tes plateformes

Tramevia Dock est auto-hébergé : il n’y a pas d’« app Tramevia » centrale. Pour Twitch, Kick et YouTube, tu crées toi-même une app développeur gratuite, et l’assistant te guide clic par clic. Compte environ 5 minutes par plateforme.

- **Twitch** : active la double authentification, crée une app dans la console développeur Twitch (type « Confidential »), colle le Client ID et le secret, puis connecte ton compte. Tu peux ajouter plusieurs chaînes. [Guide Twitch](docs/fr/platforms.md#twitch)
- **Kick** : active la double authentification, crée une app dans Kick → Paramètres → Développeur et coche les scopes indiqués. En local, le chat passe par Pusher (non officiel) ; en ligne, par les webhooks officiels. [Guide Kick](docs/fr/platforms.md#kick)
- **YouTube** : crée un projet Google Cloud, active YouTube Data API v3, crée un client « Application Web » et publie l’app. Google affichera « Cette application n’a pas été validée » : c’est normal, c’est ta propre app. [Guide YouTube](docs/fr/platforms.md#youtube)
- **TikTok** : rien à créer, saisis simplement ton @pseudo. Lecture seule, non officiel. [Guide TikTok](docs/fr/platforms.md#tiktok)

## Ajouter à OBS

Dans le tableau de bord, la section **OBS** te donne une adresse par dock (Chat unifié, Événements, Communauté, Infos du live, Tableau de bord) et un générateur d’overlay de chat avec aperçu en direct.

1. Dans OBS : **Docks → Docks de navigateur personnalisés…**, colle chaque adresse, puis « Appliquer ».
2. Pour l’overlay : **Sources → + → Navigateur**, colle l’adresse de l’overlay, largeur 400, hauteur 600.

![Overlay de chat transparent par-dessus une scène de jeu : messages de Twitch, Kick, YouTube et TikTok avec leurs icônes, et un follow](docs/assets/screenshots/fr/overlay.png)

Tous les réglages et paramètres d’adresse sont dans le [guide OBS](docs/fr/obs.md).

## Héberger en ligne

Tu peux aussi faire tourner Tramevia Dock sur un serveur, avec Docker ou sur Railway. Utile pour y accéder de partout et pour recevoir le chat Kick par les webhooks officiels. En ligne, un mot de passe (`ADMIN_PASSWORD`, 12 caractères minimum) est obligatoire. Voir le [guide d’hébergement en ligne](docs/fr/cloud.md).

## Sécurité et confidentialité

- **Auto-hébergé.** Tes jetons ne quittent ton PC ou ton serveur que pour parler aux plateformes elles-mêmes. Pas de télémétrie.
- **Chiffré.** Les jetons d’accès et les secrets de tes apps sont chiffrés sur le disque (AES-256-GCM), avec la clé `TOKEN_KEY` ou le fichier `data/secret.key` généré au premier lancement. Garde une copie de ce fichier.
- **Local par défaut.** Sans `ADMIN_PASSWORD`, le serveur n’écoute que sur `127.0.0.1` et ne répond qu’à ton ordinateur. Dès que Tramevia Dock est joignable depuis le réseau (en ligne, réseau local, tunnel), `ADMIN_PASSWORD` est obligatoire, avec 12 caractères minimum.
- **Clés d’accès.** Les adresses des docks contiennent une clé d’accès complet ; celle de l’overlay contient une clé séparée, en lecture seule. Traite-les comme des mots de passe et ne les montre pas en live. Tu peux les régénérer dans **Paramètres → Sécurité**.
- **Données enregistrées** (dans `data/tramevia-dock.db`) : tes réglages, tes préréglages, les identifiants chiffrés de tes apps, les clés des docks et de l’overlay, et pour chaque compte connecté son pseudo, son avatar, les permissions accordées et ses jetons chiffrés. S’y ajoutent les identifiants des personnes qui ont déjà écrit dans ton chat (pour repérer les premiers messages), ceux des bannissements YouTube faits depuis Tramevia Dock (pour pouvoir les lever), un compteur de quota YouTube et le numéro de ton salon de chat Kick. Les messages du chat et les événements restent en mémoire uniquement (les 400 derniers) et ne sont pas écrits sur le disque.
- **Connexions sortantes** : les plateformes elles-mêmes (Twitch, Kick, Google/YouTube, TikTok), le socket Pusher qu’utilise kick.com (chat Kick en mode non officiel), les services d’émotes 7TV, BTTV et FFZ (avec l’identifiant de ta chaîne), et le serveur de signature Euler Stream pour TikTok.
- **YouTube.** Tramevia Dock utilise les services d’API YouTube. En connectant ta chaîne, tu acceptes les [Conditions d’utilisation de YouTube](https://www.youtube.com/t/terms) ; les données sont traitées selon les [Règles de confidentialité de Google](https://policies.google.com/privacy). Tu peux retirer l’accès à tout moment depuis la [page des autorisations de ton compte Google](https://security.google.com/settings/security/permissions), ou avec le bouton « Déconnecter » du tableau de bord.
- **Signaler une faille** : voir [SECURITY.md](SECURITY.md). Merci de ne pas ouvrir d’issue publique.

Tramevia Dock n’est ni affilié à Twitch, Kick, YouTube, Google ou TikTok, ni approuvé par eux. Ces noms et logos sont des marques de leurs propriétaires respectifs ; les icônes servent uniquement à identifier les plateformes.

## Pour aller plus loin

- [FAQ et dépannage](docs/fr/faq.md) · [Signaler un problème](https://github.com/Tramevia/Tramevia-Dock/issues)
- [Contribuer](CONTRIBUTING.md) · [Journal des versions](CHANGELOG.md)
- Guides : [Installation](docs/fr/install.md) · [Plateformes](docs/fr/platforms.md) · [OBS](docs/fr/obs.md) · [En ligne](docs/fr/cloud.md)

### Licence

[AGPL-3.0](LICENSE). En clair : tu peux utiliser, étudier, modifier et partager Tramevia Dock librement. Si tu distribues une version modifiée, ou si tu la fais tourner pour d’autres personnes à travers un réseau (sur un serveur, par exemple), tu dois partager ton code source sous la même licence.

### Crédits

- [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) pour la lecture des lives TikTok (AGPL-3.0)
- [ws](https://github.com/websockets/ws) pour les WebSockets
- [Simple Icons](https://simpleicons.org) pour les icônes des plateformes (CC0)
- [7TV](https://7tv.app), [BetterTTV](https://betterttv.com) et [FrankerFaceZ](https://www.frankerfacez.com) pour leurs émotes
