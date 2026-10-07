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

Il te faut Docker avec Compose (Docker Desktop sur Windows et macOS, ou Docker Engine sur Linux).

1. Récupère le code :

   ```bash
   git clone https://github.com/Tramevia/Tramevia-Dock.git
   cd Tramevia-Dock
   ```

2. Crée un fichier `.env` à côté de `compose.yaml`, avec au minimum :

   ```env
   ADMIN_PASSWORD=choisis-un-mot-de-passe-long
   ```

3. Lance le conteneur :

   ```bash
   docker compose up -d
   ```

4. Ouvre <http://localhost:8787> et connecte-toi avec ton mot de passe.

À savoir :

- **Le mot de passe est obligatoire, même en local.** Dans le conteneur, Tramevia Dock écoute sur toutes les interfaces (`HOST=0.0.0.0`). Sans `ADMIN_PASSWORD`, il s’arrête avec une « Configuration error / Erreur de configuration ». Lis le message avec `docker compose logs`.
- **Port.** `compose.yaml` publie le port sur `127.0.0.1:8787` : seule ta machine y a accès. Si tu changes le port côté machine (par exemple `127.0.0.1:9000:8787`), mets aussi `PUBLIC_URL=http://localhost:9000` dans `.env`.
- **Données.** Tout est dans le volume `tramevia-data` déclaré dans `compose.yaml` (Docker le préfixe du nom du projet, par exemple `tramevia-dock_tramevia-data`), monté sur `/data` : base de données et `secret.key` (sauf si tu définis `TOKEN_KEY`).
- **Journaux** : `docker compose logs -f`.
- **Mise à jour** : `git pull`, puis `docker compose up -d --build`. Tes données restent dans le volume.
- **Navigateur.** En conteneur, Tramevia Dock n’ouvre pas ton navigateur. Quand tu connectes un compte, utilise « Ouvrir le lien » ou « Copier le lien » si l’onglet ne s’ouvre pas.

Sans Compose, l’équivalent avec `docker run` :

```bash
docker build -t tramevia-dock .
docker run -d --name tramevia-dock --restart unless-stopped \
  -p 127.0.0.1:8787:8787 -e ADMIN_PASSWORD='choisis-un-mot-de-passe-long' \
  -v tramevia-data:/data tramevia-dock
```

## Railway

[Railway](https://railway.com) fait tourner l’image Docker pour toi, avec HTTPS et une adresse publique. C’est un service payant : vérifie ses tarifs actuels.

Il te faut le code de Tramevia Dock dans un dépôt GitHub que tu contrôles (par exemple ton fork de `Tramevia/Tramevia-Dock`).

1. **Crée le service.** Dans Railway : **New Project → Deploy from GitHub repo**, puis choisis ton dépôt. Railway repère le `Dockerfile` et construit l’image.
2. **Ajoute un volume.** Attache un volume au service, avec le point de montage **`/data`**. Sans lui, tes comptes et tes réglages disparaissent à chaque redéploiement.
3. **Renseigne les variables** (onglet *Variables* du service) :

   | Variable | Valeur | Obligatoire ? |
   |---|---|---|
   | `ADMIN_PASSWORD` | le mot de passe du tableau de bord, 12 caractères minimum | Oui |
   | `TOKEN_KEY` | une longue chaîne aléatoire, 32 caractères minimum (ton gestionnaire de mots de passe peut la générer). Gardes-en une copie en lieu sûr. | Conseillé (sinon une clé est générée dans `/data/secret.key`) |
   | `PUBLIC_URL` | `https://` + ton domaine personnalisé (ou `https://${{RAILWAY_PUBLIC_DOMAIN}}`) | Facultatif : Tramevia Dock détecte seul le domaine Railway. À définir si tu utilises ton propre domaine, et seulement une fois ce domaine créé (étape 4) : avec un domaine vide, Tramevia Dock ne démarre pas. |
   | `RAILWAY_RUN_UID` | `0` | Seulement si les journaux montrent une erreur de permission sur `/data` (Railway monte les volumes en root, l’image tourne avec un utilisateur normal) |

4. **Obtiens une adresse publique.** Dans les réglages réseau du service, génère un domaine. Tu obtiens une adresse du type `https://ton-app.up.railway.app`. Si Railway te demande vers quel port diriger le trafic, ajoute la variable `PORT` = `8787` et indique `8787`. Ensuite, **redéploie** le service : Tramevia Dock lit son adresse Railway au démarrage, et d’ici là il répond « Host not allowed » sur cette adresse.
5. **Healthcheck et instances.** Dans les réglages du service, mets le chemin de healthcheck sur **`/healthz`**. Garde **une seule instance** : Tramevia Dock garde ses données dans un seul fichier SQLite et ses connexions en direct en mémoire. Laisse **Serverless** (mise en veille de l’app) **désactivé** : la veille couperait tes connexions au chat.
6. **Configure.** Ouvre ton adresse Railway, connecte-toi avec `ADMIN_PASSWORD` et suis l’assistant. Les adresses de redirection qu’il affiche doivent commencer par ton domaine Railway (si elles affichent encore `localhost`, redéploie le service ou définis `PUBLIC_URL`) : ajoute-les à ton app Twitch et à ton client Google, et configure Kick comme expliqué dans [Plateformes → Kick](platforms.md#kick), avec **Enable Webhooks** et l’adresse `https://ton-app.up.railway.app/webhooks/kick`.
7. **Ajoute à OBS.** Copie les adresses des docks et de l’overlay depuis la section **OBS** : elles pointent maintenant vers ton adresse Railway.

En ligne et en HTTPS, les comptes Kick en mode « Automatique » lisent le chat par les webhooks officiels.

> [!NOTE]
> Si tu ajoutes un domaine personnalisé, mets-le dans `PUBLIC_URL` et mets à jour les adresses de redirection sur chaque plateforme. L’ancienne adresse `….up.railway.app` répondra alors « Host not allowed », sauf si tu l’ajoutes dans `ALLOWED_HOSTS`.

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
