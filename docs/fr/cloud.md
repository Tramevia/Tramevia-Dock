<p align="right"><a href="../en/cloud.md">🇬🇧 English</a></p>

# Héberger en ligne (Docker, Railway)

[← Retour au README](../../README.fr.md) · [Installation](install.md) · [Plateformes](platforms.md) · [OBS](obs.md) · [FAQ](faq.md)

Tramevia Dock fonctionne très bien sur ton PC. Ce guide est pour toi si tu veux le faire tourner sur un serveur, ou le rendre joignable depuis l’extérieur.

## Quand l’utiliser

Une installation en ligne est utile si :

- tu veux accéder à tes docks **depuis plusieurs appareils** ou depuis n’importe où ;
- tu veux lire le chat Kick par les **webhooks officiels**, qui demandent une adresse publique en HTTPS (en local, Tramevia Dock passe par le socket Pusher non officiel, voir [Kick](platforms.md#kick)) ;
- tu veux que le chat et les événements soient suivis **24 h/24**, même PC éteint.

Ce que ça change :

- **`ADMIN_PASSWORD` est obligatoire** (12 caractères minimum). Sans lui, Tramevia Dock refuse de démarrer dès qu’il est joignable depuis le réseau.
- Les **adresses de redirection** commencent par ton adresse publique (`https://ton-domaine/auth/…/callback`) : ajoute-les à tes apps. Twitch et Google acceptent plusieurs adresses dans la même app, tu peux donc garder l’adresse locale à côté.
- Une installation en ligne est **indépendante** de ton installation locale : elle a ses propres comptes, réglages et clés.
- Un serveur est en général payant, et c’est à toi de garder le mot de passe et les clés en sécurité.

## Docker (compose)

Il te faut Docker avec Compose (Docker Desktop sur Windows et macOS, ou Docker Engine sur Linux). Pas besoin du code de Tramevia Dock : chaque version publie une image prête à l’emploi, `ghcr.io/tramevia/tramevia-dock` (pour les PC et serveurs 64 bits classiques, et les cartes ARM 64 bits comme un Raspberry Pi).

1. Crée un dossier, par exemple `tramevia-dock`, et mets-y deux fichiers :
   - [`compose.yaml`](../../compose.yaml), téléchargé depuis ce dépôt ;
   - un fichier `.env` avec au minimum :

     ```env
     ADMIN_PASSWORD=choisis-un-mot-de-passe-long
     ```

   Tu peux ajouter dans `.env` n’importe quelle autre variable de la [référence de configuration](install.md#référence-de-configuration) (par exemple `TOKEN_KEY` ou les identifiants de tes apps).

2. Dans ce dossier, lance le conteneur :

   ```bash
   docker compose up -d
   ```

3. Ouvre <http://localhost:8787> et connecte-toi avec ton mot de passe.

À savoir :

- **Image.** `compose.yaml` utilise `ghcr.io/tramevia/tramevia-dock:1` : la dernière version 1.x, jamais une 2.0 qui pourrait casser ta configuration (Node.js 24, utilisateur non root, healthcheck intégré sur `/healthz`).
- **Le mot de passe est obligatoire, même en local.** Dans le conteneur, Tramevia Dock écoute sur toutes les interfaces (`HOST=0.0.0.0`). Sans `ADMIN_PASSWORD`, il s’arrête avec une « Configuration error / Erreur de configuration ». Lis le message avec `docker compose logs`.
- **Port.** `compose.yaml` publie le port sur `127.0.0.1:8787` : seule ta machine y a accès. Si tu changes le port côté machine (par exemple `127.0.0.1:9000:8787`), mets aussi `PUBLIC_URL=http://localhost:9000` dans `.env`.
- **Données.** Tout est dans le volume `tramevia-data` déclaré dans `compose.yaml` (Docker le préfixe du nom du dossier, par exemple `tramevia-dock_tramevia-data`), monté sur `/data` : base de données et `secret.key` (sauf si tu définis `TOKEN_KEY`). Lance donc toujours Docker Compose depuis le même dossier.
- **Journaux** : `docker compose logs -f`.
- **Navigateur.** En conteneur, Tramevia Dock n’ouvre pas ton navigateur. Quand tu connectes un compte, utilise « Ouvrir le lien » ou « Copier le lien » si l’onglet ne s’ouvre pas.

Sans Compose, l’équivalent avec `docker run` :

```bash
docker run -d --name tramevia-dock --restart unless-stopped \
  -p 127.0.0.1:8787:8787 -e ADMIN_PASSWORD='choisis-un-mot-de-passe-long' \
  -v tramevia-data:/data ghcr.io/tramevia/tramevia-dock:1
```

Pour le mettre à jour : `docker pull ghcr.io/tramevia/tramevia-dock:1`, puis `docker rm -f tramevia-dock`, puis relance la même commande `docker run`. Tes données restent dans le volume.

> [!TIP]
> Tu modifies le code toi-même ? Construis ta propre image avec `docker build -t tramevia-dock .` dans le dossier du code, et utilise `tramevia-dock` comme nom d’image.

### Mettre à jour avec Docker

Le tableau de bord te prévient quand une nouvelle version sort (**Paramètres → À propos** affiche ta version). Pour l’installer :

```bash
docker compose pull
docker compose up -d
```

Docker télécharge la nouvelle image et relance Tramevia Dock avec elle en quelques secondes. Tes données restent dans le volume `tramevia-data`, et tes docks OBS se reconnectent tout seuls.

- Le tag `:1` suit toutes les versions 1.x. Une 2.0 peut contenir des changements incompatibles : tu ne la reçois qu’en changeant toi-même le tag dans `compose.yaml` (les notes de version disent quoi vérifier avant).
- Pour rester sur une version précise, remplace `:1` par son numéro, par exemple `ghcr.io/tramevia/tramevia-dock:1.0.0`.
- Si une version pose problème, reviens à la précédente de la même façon (son numéro est sur la page [Releases](https://github.com/Tramevia/Tramevia-Dock/releases)).

**Mises à jour automatiques (facultatif).** `compose.yaml` contient un service [Watchtower](https://github.com/nicholas-fedor/watchtower) facultatif (un fork maintenu) qui vérifie chaque nuit à 4 h UTC et installe la nouvelle image 1.x s’il y en a une. Pour l’activer, ajoute cette ligne dans `.env`, puis relance `docker compose up -d` :

```env
COMPOSE_PROFILES=autoupdate
```

Pour le désactiver, retire la ligne et lance `docker compose --profile autoupdate rm -sf watchtower`.

> [!WARNING]
> Watchtower a accès au socket Docker, ce qui revient à contrôler entièrement la machine. Avec la configuration fournie, il ne met à jour que les conteneurs qui portent l’étiquette `com.centurylinklabs.watchtower.enable=true` (ici, Tramevia Dock seulement). Une mise à jour coupe Tramevia Dock quelques secondes : si tu streames à 4 h UTC, change `WATCHTOWER_SCHEDULE` dans `compose.yaml` (cron à 6 champs, secondes en premier, heure UTC).

## Railway

[Railway](https://railway.com) fait tourner l’image de Tramevia Dock pour toi, avec HTTPS, une adresse publique et des mises à jour automatiques. C’est un service payant : il te faut l’offre **Hobby** (vérifie ses tarifs actuels). L’essai gratuit limite les connexions sortantes, ce qui peut bloquer Twitch et Kick.

<!-- RAILWAY_BUTTON : remplacer ce commentaire par les lignes ci-dessous quand le modèle Railway existe (RELEASING.md, mise en place unique, étape 7), et retirer la note juste en dessous.
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/<CODE>?utm_medium=integration&utm_source=button&utm_campaign=tramevia-dock)
Il faut l’offre Hobby de Railway. Tu ne remplis qu’un mot de passe ; les mises à jour s’installent toutes seules la nuit (heure UTC). Tu peux changer le créneau dans Settings → Source → Auto Updates.
-->

> [!NOTE]
> Un bouton **Deploy on Railway** (déploiement en un clic) arrive avec la première version publique. D’ici là, suis les étapes ci-dessous (une dizaine de minutes).

1. **Crée le service.** Dans Railway : **New Project → Deploy a Docker Image**, puis saisis `ghcr.io/tramevia/tramevia-dock:` suivi du numéro de la dernière version indiqué sur la page [Releases](https://github.com/Tramevia/Tramevia-Dock/releases), par exemple `ghcr.io/tramevia/tramevia-dock:1.0.0`. Mets un numéro complet (pas `:1` ni `:latest`) : les mises à jour automatiques de Railway en ont besoin.
2. **Renseigne les variables** (onglet *Variables* du service) :

   | Variable | Valeur | Obligatoire ? |
   |---|---|---|
   | `ADMIN_PASSWORD` | le mot de passe du tableau de bord, 12 caractères minimum | Oui |
   | `RAILWAY_RUN_UID` | `0` | Oui. Railway monte les volumes en root alors que l’image tourne avec un utilisateur normal : sans cette variable, Tramevia Dock ne peut pas écrire dans `/data` (`EACCES` dans les journaux). |
   | `PORT` | `8787` | Oui |
   | `TOKEN_KEY` | une longue chaîne aléatoire, 32 caractères minimum (ton gestionnaire de mots de passe peut la générer). Gardes-en une copie en lieu sûr. | Conseillé (sinon une clé est générée dans `/data/secret.key`) |
   | `PUBLIC_URL` | `https://` + ton domaine personnalisé | Seulement avec ton propre domaine, et une fois ce domaine créé. Sans elle, Tramevia Dock utilise tout seul son domaine Railway. |

3. **Ajoute un volume.** Clic droit sur le service → **Attach Volume**, avec le point de montage **`/data`**. Sans lui, tes comptes et tes réglages disparaissent à chaque redéploiement.
4. **Obtiens une adresse publique.** Dans **Settings → Networking** du service, clique sur **Generate Domain** avec le port cible **8787**. Tu obtiens une adresse du type `https://ton-app.up.railway.app`. Applique ensuite tes changements avec **Deploy** (ou redéploie le service) : Tramevia Dock lit son adresse Railway au démarrage, et d’ici là il répond « Host not allowed » sur cette adresse.
5. **Healthcheck et instances.** Dans **Settings → Deploy**, mets le chemin de healthcheck sur **`/healthz`**. Garde **une seule instance** : Tramevia Dock garde ses données dans un seul fichier SQLite et ses connexions en direct en mémoire. Laisse **Serverless** (mise en veille de l’app) **désactivé** : la veille couperait tes connexions au chat.
6. **Active les mises à jour automatiques.** Dans **Settings → Source → Configure Auto Updates**, choisis **Minor updates and patches** et un créneau où tu ne streames pas (**Night**, c’est de 2 h à 6 h UTC ; tu peux aussi choisir un créneau personnalisé).
7. **Configure.** Ouvre ton adresse Railway, connecte-toi avec `ADMIN_PASSWORD` et suis l’assistant. Les adresses de redirection qu’il affiche doivent commencer par ton domaine Railway (si elles affichent encore `localhost`, redéploie le service ou définis `PUBLIC_URL`) : ajoute-les à ton app Twitch et à ton client Google, et configure Kick comme expliqué dans [Plateformes → Kick](platforms.md#kick), avec **Enable Webhooks** et l’adresse `https://ton-app.up.railway.app/webhooks/kick`.
8. **Ajoute à OBS.** Copie les adresses des docks et de l’overlay depuis la section **OBS** : elles pointent maintenant vers ton adresse Railway.

En ligne et en HTTPS, les comptes Kick en mode « Automatique » lisent le chat par les webhooks officiels.

> [!NOTE]
> Si tu ajoutes un domaine personnalisé, mets-le dans `PUBLIC_URL` et mets à jour les adresses de redirection sur chaque plateforme. L’ancienne adresse `….up.railway.app` répondra alors « Host not allowed », sauf si tu l’ajoutes dans `ALLOWED_HOSTS`.

### Mises à jour sur Railway

- **Avec les mises à jour automatiques** (étape 6), Railway installe tout seul chaque nouvelle version 1.x pendant ton créneau. Ton volume `/data` est conservé. Chaque mise à jour coupe Tramevia Dock quelques secondes ; tes docks et ton overlay se reconnectent tout seuls.
- **Une version pose problème ?** La notification de mise à jour de Railway propose **Skip this version**, et une version corrigée suit en général rapidement.
- **Les versions majeures (2.0)** ne s’installent jamais automatiquement, car elles peuvent demander une vérification de ta part. Le tableau de bord te prévient : change alors l’image dans **Settings → Source** pour la nouvelle version, par exemple `ghcr.io/tramevia/tramevia-dock:2.0.0`.
- **Mises à jour automatiques désactivées ?** Fais la même chose à la main : dans **Settings → Source**, mets l’image à la version indiquée dans le tableau de bord.

## Autres hébergeurs et reverse proxy

Tramevia Dock tourne chez n’importe quel hébergeur capable de lancer une image Docker avec un **volume persistant sur `/data`** et du **HTTPS** devant.

- **Render** : uniquement avec une instance payante et un disque persistant monté sur `/data`. L’offre gratuite n’a pas de disque et se met en veille : tu perdrais tes données et ton chat serait coupé.
- **Ton propre serveur ou NAS** : suis les instructions Docker ci-dessus, derrière un reverse proxy qui gère le HTTPS (Caddy, nginx, Traefik…).

Check-list pour le reverse proxy :

- mets dans `PUBLIC_URL` l’adresse publique, par exemple `https://dock.example.com`, **sans chemin** : Tramevia Dock doit être servi à la racine de son domaine ;
- transmets les connexions **WebSocket** (Tramevia Dock utilise `/ws` pour le temps réel) ;
- garde l’en-tête `Host` d’origine. Si Tramevia Dock est aussi joint sous un autre nom, ajoute-le dans `ALLOWED_HOSTS`, sinon il répond « Host not allowed » ;
- fais ajouter l’adresse du visiteur dans `X-Forwarded-For` : Tramevia Dock s’en sert pour limiter les tentatives de connexion ;
- laisse passer le corps des requêtes `/webhooks/kick` sans le modifier : Tramevia Dock vérifie la signature de Kick dessus ;
- ne fais tourner qu’une seule instance.

**Depuis un autre appareil de ton réseau local.** Mets `HOST=0.0.0.0` (ou, avec Docker, retire `127.0.0.1:` de la ligne du port dans `compose.yaml`), définis `ADMIN_PASSWORD`, et ajoute l’adresse que tu taperas dans `ALLOWED_HOSTS`, par exemple `ALLOWED_HOSTS=192.168.1.20:8787`. Garde `PUBLIC_URL=http://localhost:8787` et connecte tes comptes depuis le PC qui fait tourner Tramevia Dock : les plateformes refusent les adresses de redirection en `http://` autres que localhost. Sur l’autre appareil, remplace `localhost` par l’adresse du PC dans les liens des docks.

## En local avec un tunnel (webhooks Kick)

Tu veux les webhooks officiels de Kick tout en gardant Tramevia Dock sur ton PC ? Donne-lui une adresse publique en HTTPS grâce à un tunnel.

Utilise un **tunnel nommé, avec une adresse fixe** (par exemple un Cloudflare Tunnel sur ton propre domaine). Les tunnels « rapides », qui changent d’adresse à chaque démarrage, ne conviennent pas : les adresses de redirection et l’URL du webhook Kick changeraient à chaque fois.

1. Configure le tunnel pour que `https://dock.example.com` mène à `http://localhost:8787`.
2. Dans `.env`, mets :

   ```env
   PUBLIC_URL=https://dock.example.com
   ADMIN_PASSWORD=choisis-un-mot-de-passe-long
   ```

3. Relance Tramevia Dock et ouvre-le via `https://dock.example.com`. Un mot de passe est maintenant demandé, même depuis ton PC.
4. Ajoute à tes apps les nouvelles adresses de redirection affichées par l’assistant, et active **Enable Webhooks** dans ton app Kick avec `https://dock.example.com/webhooks/kick`.
5. Recopie les adresses des docks et de l’overlay dans OBS (elles utilisent maintenant l’adresse du tunnel). Astuce : dans OBS, tu peux remplacer le début de ces adresses par `http://localhost:8787` pour que les docks ne passent pas par internet.

Les comptes Kick en mode « Automatique » passent alors aux webhooks officiels. Ton tableau de bord est désormais joignable depuis internet : choisis un mot de passe long et unique.

## Sauvegardes

Tout est dans le dossier de données (`data/` en local, `/data` dans Docker et sur Railway) :

- `tramevia-dock.db` (et, pendant que l’app tourne, ses fichiers `-wal` et `-shm`) : comptes, identifiants chiffrés, préréglages, réglages ;
- `secret.key` : la clé de chiffrement, sauf si tu as défini `TOKEN_KEY`.

> [!WARNING]
> Une sauvegarde de la base sans sa clé ne sert à rien. Garde `secret.key` avec elle, ou conserve ton `TOKEN_KEY` en lieu sûr (dans un gestionnaire de mots de passe).

Comment sauvegarder :

- **En local** : arrête Tramevia Dock, puis copie tout le dossier `data` (et ton fichier `.env`).
- **Docker** : `docker compose stop`, puis `docker compose cp tramevia-dock:/data ./sauvegarde-tramevia`, puis `docker compose start`.
- **Railway** : note `ADMIN_PASSWORD` et `TOKEN_KEY` dans ton gestionnaire de mots de passe, et utilise les sauvegardes de volume de Railway si ton offre les propose.

Pour restaurer, remets les fichiers dans le dossier de données avec la même clé (`secret.key` ou `TOKEN_KEY`), puis démarre Tramevia Dock. Si la clé est perdue, il faut ressaisir les identifiants de tes apps dans l’assistant et reconnecter tous tes comptes ; avec un `ADMIN_PASSWORD`, la clé des docks est aussi régénérée.
