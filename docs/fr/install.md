<p align="right"><a href="../en/install.md">🇬🇧 English</a></p>

# Installation

[← Retour au README](../../README.fr.md) · [Plateformes](platforms.md) · [OBS](obs.md) · [En ligne](cloud.md) · [FAQ](faq.md)

Tramevia Dock est un petit programme qui tourne sur ton ordinateur. Tu le lances, il ouvre une page dans ton navigateur, et OBS affiche ses pages sous forme de docks. Ce guide couvre Windows, macOS et Linux. Si tu préfères l’installer sur un serveur, va voir [l’hébergement en ligne](cloud.md).

## Prérequis

- **Node.js 24.15 ou plus récent.** C’est le moteur qui fait tourner Tramevia Dock. Prends la version **LTS** sur [nodejs.org](https://nodejs.org) : elle convient.
- **Une connexion internet**, au moins au premier lancement (installation des dépendances) et ensuite pour parler aux plateformes.
- **OBS Studio 31 ou plus récent**, pour les docks et l’overlay : le navigateur intégré d’OBS 30 est trop ancien pour le dock de chat.

Tu n’as pas besoin de savoir programmer. Les scripts de lancement vérifient la version de Node.js et installent le reste tout seuls.

## Windows

1. **Installe Node.js.** Sur [nodejs.org](https://nodejs.org), télécharge l’installateur Windows de la version **LTS** (fichier `.msi`). Lance-le et clique sur « Next » jusqu’au bout : les options par défaut suffisent.
2. **Télécharge Tramevia Dock.** Sur la [page des versions](https://github.com/Tramevia/Tramevia-Dock/releases/latest), prends le fichier ZIP de la dernière version (`tramevia-dock-X.Y.Z.zip`, dans **Assets**).
3. **Extrais le ZIP.** Clic droit sur le fichier → « Extraire tout… », puis choisis un dossier qui ne bougera pas, par exemple `Documents\Tramevia Dock`. Ne lance rien directement depuis l’intérieur du ZIP.
4. **Double-clique sur `start.bat`.** Une fenêtre noire intitulée « Tramevia Dock » s’ouvre.
   - Si tu as pris le ZIP du bouton vert **Code → Download ZIP** sur la page du dépôt, elle installe d’abord les dépendances la première fois : elle affiche `[FR] Installation des dependances... / [EN] Installing dependencies...`, et ça prend environ une minute.
   - Si Node.js manque, elle te le dit et ouvre nodejs.org. S’il est plus ancien que la version 24.15, elle te demande de le mettre à jour.
5. **Ton navigateur s’ouvre** sur <http://localhost:8787>. C’est ton tableau de bord.

Laisse la fenêtre noire ouverte tant que tu utilises Tramevia Dock : c’est le serveur. Pour l’arrêter, ferme cette fenêtre (ou appuie sur Ctrl+C dedans).

> [!NOTE]
> Il n’y a pas de fichier `.exe` à installer. `start.bat` est un simple fichier texte : tu peux l’ouvrir dans le Bloc-notes pour voir ce qu’il fait. Si Windows te demande une confirmation avant de l’exécuter, accepte.

## macOS

1. **Installe Node.js.** Sur [nodejs.org](https://nodejs.org), télécharge l’installateur macOS de la version **LTS** (fichier `.pkg`) et suis les étapes.
2. **Télécharge et décompresse Tramevia Dock** (ZIP de la dernière version sur la [page des versions](https://github.com/Tramevia/Tramevia-Dock/releases/latest)), puis range le dossier où tu veux, par exemple dans Documents.
3. **Double-clique sur `start.command`.** Le Terminal s’ouvre et lance Tramevia Dock, puis ton navigateur s’ouvre sur <http://localhost:8787>.

Si macOS refuse d’ouvrir `start.command` parce qu’il vient d’un développeur non identifié :

- fais un clic droit (ou Ctrl+clic) sur le fichier → « Ouvrir », puis confirme avec « Ouvrir » ;
- sur les versions récentes de macOS, si ce choix n’apparaît pas, va dans **Réglages Système → Confidentialité et sécurité** et clique sur « Ouvrir quand même » en bas de la page.

Tu peux aussi passer par le Terminal : place-toi dans le dossier et tape `./start.sh`.

## Linux

1. **Installe Node.js 24.15 ou plus récent**, avec le gestionnaire de paquets de ta distribution si sa version est assez récente, ou depuis [nodejs.org](https://nodejs.org) (ou avec un outil comme nvm).
2. **Récupère Tramevia Dock** et lance-le :

   ```bash
   git clone https://github.com/Tramevia/Tramevia-Dock.git
   cd Tramevia-Dock
   ./start.sh
   ```

3. Ouvre <http://localhost:8787> si ton navigateur ne s’ouvre pas tout seul.

Tu peux aussi télécharger le ZIP de la dernière version sur la [page des versions](https://github.com/Tramevia/Tramevia-Dock/releases/latest), l’extraire et lancer `./start.sh` dans ce dossier : une installation ZIP se met à jour en un clic, un dossier git avec `git pull` (voir [Mettre à jour](#mettre-à-jour)).

Si tu obtiens « Permission denied », rends les scripts exécutables avec `chmod +x start.sh start.command`.

> [!TIP]
> Sous Wayland, OBS peut ne pas proposer les docks de navigateur. Tu peux ouvrir les mêmes adresses dans une fenêtre de navigateur classique : voir le [guide OBS](obs.md).

## Premier lancement

Voici ce qui se passe la première fois :

1. Le script vérifie Node.js, puis installe les dépendances (dossier `node_modules`).
2. Tramevia Dock crée un dossier **`data`** à côté de `start.bat`, avec :
   - `tramevia-dock.db` : ta base de données (comptes, réglages, préréglages) ;
   - `secret.key` : la clé qui chiffre tes jetons d’accès et les secrets de tes apps.
3. Le terminal affiche une ligne du type `Tramevia Dock 1.0.0 — http://localhost:8787`, puis ton navigateur s’ouvre sur le tableau de bord.
4. L’écran « Bienvenue sur Tramevia Dock » te propose trois étapes : « Créer ton app développeur », « Connecter tes comptes » et « Ajouter les docks dans OBS ».

![Tableau de bord de Tramevia Dock : la vue d’ensemble avec les trois étapes de configuration, le total de spectateurs et la liste des chaînes en direct](../assets/screenshots/fr/dashboard.png)

Sans mot de passe (`ADMIN_PASSWORD`), le tableau de bord est accessible **uniquement depuis cet ordinateur**. C’est le fonctionnement normal en local : la section **Paramètres** du tableau de bord l’indique avec « Mode local sans mot de passe ».

> [!WARNING]
> **Sauvegarde le dossier `data`, et surtout `secret.key`.** Sans ce fichier, Tramevia Dock ne peut plus lire tes jetons ni les secrets de tes apps : il faudra ressaisir tes identifiants dans l’assistant et reconnecter tous tes comptes. Ne partage jamais ce dossier : il donne accès à tes chaînes.

Ensuite, suis le [guide des plateformes](platforms.md) pour connecter tes comptes, puis le [guide OBS](obs.md).

## Mettre à jour

Tramevia Dock vérifie une fois par jour si une nouvelle version est sortie, et te prévient sur le tableau de bord. **Paramètres → À propos** affiche ta version et propose un bouton « Vérifier maintenant ». Une mise à jour ne touche jamais à ton dossier `data` ni à ton fichier `.env` : tes comptes, tes réglages et tes clés restent tels quels, tout comme les adresses de tes docks dans OBS.

### Avec le ZIP (start.bat, start.command, start.sh)

Tramevia Dock se met à jour tout seul :

1. Quand une nouvelle version sort, le tableau de bord affiche un message. Clique sur « Nouveautés » pour lire ce qui change, puis sur « Installer maintenant ».
2. Tramevia Dock télécharge la nouvelle version, la vérifie et redémarre tout seul en une dizaine de secondes. Laisse sa fenêtre ouverte. Tes docks OBS et ton overlay se reconnectent d’eux-mêmes, et le tableau de bord affiche « Mis à jour vers X.Y.Z ».

Bon à savoir :

- **Jamais pendant un live.** Tant qu’un de tes comptes est en direct, le bouton affiche « Disponible après ton live ». Si Tramevia Dock ne sait pas dire si tu es en direct sur une plateforme, il te demande confirmation avant d’installer.
- **Installation automatique (facultatif).** Dans **Paramètres → À propos**, active « Installer les mises à jour automatiquement quand aucun compte n’est en live » : les nouvelles versions s’installent alors dès qu’aucun de tes comptes n’est en direct. Elle est désactivée par défaut.
- **Retour arrière automatique.** Si la nouvelle version ne démarre pas, Tramevia Dock remet tout seul la précédente et te le signale sur le tableau de bord. Tes données sont exactement comme avant la mise à jour, et l’installation automatique saute cette version.
- **Ce qu’il ne met pas à jour :** Node.js. Si une nouvelle version demande un Node.js plus récent, le tableau de bord te le dit : installe-le depuis [nodejs.org](https://nodejs.org), puis réessaie.
- **Pas de vérification du tout ?** Décoche « Vérifier les mises à jour automatiquement » dans **Paramètres → À propos**, ou mets `UPDATE_CHECK=0` dans `.env`. Tramevia Dock ne contacte alors plus jamais GitHub (la vérification révèle ton adresse IP à GitHub, comme n’importe quelle visite de site).
- La mise à jour en un clic ne marche que si tu lances Tramevia Dock avec `start.bat`, `start.command` ou `start.sh` (ce sont eux qui le relancent après la mise à jour). Lancé avec `npm start`, pm2 ou un service, il affiche seulement le message : mets à jour à la main comme ci-dessous.

> [!NOTE]
> La mise à jour intégrée est arrivée avec la première version publique. Si tu as téléchargé Tramevia Dock avant, mets-le à jour une fois à la main (ci-dessous). Ensuite, il se met à jour tout seul.

**À la main :**

1. Arrête Tramevia Dock (ferme la fenêtre).
2. Télécharge le ZIP de la dernière version sur la [page des versions](https://github.com/Tramevia/Tramevia-Dock/releases/latest) (`tramevia-dock-X.Y.Z.zip`, dans **Assets**) et extrais-le dans un **nouveau** dossier.
3. Copie le dossier `data` de l’ancienne installation (et ton fichier `.env` si tu en as créé un) dans le nouveau dossier.
4. Lance `start.bat` (ou `start.command`, `start.sh`) depuis le nouveau dossier.
5. Quand tout fonctionne, tu peux supprimer l’ancien dossier.

Si tu gardes le même port, les adresses déclarées sur les plateformes et les adresses des docks dans OBS restent valables.

### Avec git

```bash
git pull
```

puis relance Tramevia Dock avec `start.bat` ou `./start.sh` : à chaque démarrage, ils vérifient les dépendances et les réinstallent si elles manquent ou ne sont plus à jour. Si tu le lances avec `npm start`, fais `npm ci --omit=dev` après `git pull`. Dans un dossier git, le tableau de bord affiche seulement le message : il ne modifie jamais les fichiers lui-même.

### Docker et Railway

Voir [Mettre à jour avec Docker](cloud.md#mettre-à-jour-avec-docker) et [Mises à jour sur Railway](cloud.md#mises-à-jour-sur-railway). Ce qui change d’une version à l’autre est noté dans le [journal des versions](../../CHANGELOG.md).

## Désinstaller

1. Dans le tableau de bord, section **Comptes**, clique sur « Déconnecter » pour chaque compte : Tramevia Dock essaie aussi de révoquer son accès auprès de la plateforme.
2. Arrête Tramevia Dock, puis supprime son dossier (y compris `data`).
3. Dans OBS, retire les docks (**Docks → Docks de navigateur personnalisés…**) et la source Navigateur de l’overlay.
4. Si tu veux faire place nette : supprime tes apps développeur dans la console Twitch, dans Kick → Paramètres → Développeur et dans Google Cloud (supprime le projet). Tu peux aussi vérifier les accès accordés dans les [connexions Twitch](https://www.twitch.tv/settings/connections) et les [autorisations de ton compte Google](https://security.google.com/settings/security/permissions).
5. Désinstalle Node.js si tu ne t’en sers pas pour autre chose.

## Référence de configuration

Tout est facultatif en local. Pour changer un réglage, copie `.env.example` en `.env` dans le dossier de Tramevia Dock, modifie la ligne voulue (en retirant le `#` du début) et relance.

Sous Windows, le plus simple : ouvre `.env.example` dans le Bloc-notes, puis **Fichier → Enregistrer sous**, nom `.env`, type « Tous les fichiers ».

| Variable | Par défaut | À quoi ça sert |
|---|---|---|
| `PORT` | `8787` | Port d’écoute du serveur. |
| `PUBLIC_URL` | `http://localhost:<PORT>` (sur Railway : `https://` + le domaine public) | Adresse publique de Tramevia Dock, sans chemin à la fin. Les adresses de redirection déclarées sur chaque plateforme en découlent. |
| `ADMIN_PASSWORD` | vide | Mot de passe du tableau de bord, 12 caractères minimum. Obligatoire dès que l’app est joignable depuis le réseau (`HOST` différent de `127.0.0.1`, ou `PUBLIC_URL` qui n’est pas `localhost`). |
| `TOKEN_KEY` | vide | Clé de chiffrement des jetons, 32 caractères minimum. Si vide, une clé est générée dans `DATA_DIR/secret.key`. |
| `DATA_DIR` | `./data` (dans Docker et sur Railway : `/data`) | Dossier de la base de données et de `secret.key`. |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | vides | Identifiants de ton app Twitch. |
| `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | vides | Identifiants de ton app Kick. |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | vides | Identifiants de ton client OAuth Google. |
| `TIKTOK_SIGN_API_KEY` | vide | Clé API Euler Stream facultative pour le serveur de signature TikTok (non officiel). |
| `HOST` | `127.0.0.1` (dans Docker et sur Railway : `0.0.0.0`) | Interface d’écoute. `0.0.0.0` écoute sur le réseau et exige `ADMIN_PASSWORD`. |
| `ALLOWED_HOSTS` | vide | Noms d’hôte supplémentaires acceptés, séparés par des virgules (par exemple `monpc.local:8787`). |
| `OPEN_BROWSER` | activé | Mets `0` pour ne pas ouvrir le navigateur au démarrage. |
| `UPDATE_CHECK` | activé | Mets `0` pour couper la vérification quotidienne des mises à jour : Tramevia Dock ne contacte alors plus jamais GitHub (voir [Mettre à jour](#mettre-à-jour)). |

Les identifiants d’app sont plus simples à saisir dans l’assistant, où ils sont enregistrés chiffrés. Si tu les mets dans `.env` (Client ID et secret ensemble), ils sont prioritaires : la carte de la plateforme affiche alors « App (variables d’env.) » et les champs de l’assistant sont verrouillés.

Si un réglage est invalide, Tramevia Dock refuse de démarrer et affiche la raison sous « Configuration error / Erreur de configuration ».

## Mode démo

Le mode démo te permet de découvrir l’interface sans connecter aucun compte. Il crée cinq faux comptes (deux Twitch, un Kick, un YouTube, un TikTok) avec du faux chat, des événements, des statistiques et des infos de live. Rien n’est envoyé aux plateformes, et un bandeau « Mode démo : données fictives » s’affiche en haut des pages.

Pour le lancer :

- **Windows** : double-clique sur `demo.bat`.
- **macOS / Linux** : `./start.sh --demo` dans le Terminal.
- **Avec npm**, si les dépendances sont déjà installées : `npm run demo`.
- Ou ajoute `DEMO=1` dans ton fichier `.env`.

Les faux comptes ne sont pas enregistrés : ils disparaissent dès que tu relances sans le mode démo. Si tu as déjà connecté de vrais comptes, ils restent actifs à côté.

## Changer de port

Change de port si le 8787 est déjà pris par un autre logiciel.

1. Dans ton fichier `.env`, mets par exemple `PORT=9000`.
2. Relance Tramevia Dock : il est maintenant sur <http://localhost:9000>.
3. **Mets à jour les adresses de redirection** sur chaque plateforme. Elles contiennent le port (`http://localhost:9000/auth/twitch/callback`, etc.) : si elles ne correspondent plus exactement, la connexion des comptes échoue. L’assistant de chaque plateforme affiche les nouvelles adresses à copier.
4. **Recopie les adresses des docks et de l’overlay** dans OBS depuis la section OBS du tableau de bord : elles contiennent aussi le port.

Si `PUBLIC_URL` est défini dans ton `.env`, change aussi le port dedans.
