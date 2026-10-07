<p align="right"><a href="../en/platforms.md">🇬🇧 English</a></p>

# Connecter tes plateformes

[← Retour au README](../../README.fr.md) · [Installation](install.md) · [OBS](obs.md) · [En ligne](cloud.md) · [FAQ](faq.md)

- [Avant de commencer](#avant-de-commencer)
- [Twitch](#twitch)
- [Kick](#kick)
- [YouTube](#youtube)
- [TikTok](#tiktok)

## Avant de commencer

### Pourquoi créer ta propre app développeur

Tramevia Dock tourne chez toi : il n’existe pas d’« app Tramevia » centrale à laquelle tu donnerais accès à tes chaînes. À la place, tu crées sur chaque plateforme une **app développeur gratuite, à ton nom**. C’est elle que Tramevia Dock utilise pour lire ton chat et gérer ton live, sans jamais connaître ton mot de passe.

- C’est gratuit et ça prend environ 5 minutes par plateforme.
- Personne d’autre ne peut utiliser tes accès, et tu ne partages pas tes limites d’API avec d’autres streamers.
- TikTok n’a pas besoin d’app : tu saisis juste ton pseudo.

Dans le tableau de bord, section **Comptes**, clique sur « Configurer l’app Twitch » (ou Kick, YouTube). L’assistant te guide étape par étape, avec des boutons pour ouvrir les bonnes pages et des boutons « Copier » pour les adresses.

![Assistant « Configurer Twitch » : étapes numérotées avec le nom de l’app et l’adresse de redirection à copier, puis le formulaire « Colle tes identifiants ici »](../assets/screenshots/fr/wizard.png)

Le déroulé est toujours le même :

1. Tu crées l’app sur la plateforme en suivant les étapes de l’assistant.
2. Tu colles le **Client ID** et le **Client Secret** dans « Colle tes identifiants ici », puis tu cliques sur « Enregistrer et tester ». Le secret est chiffré sur ton serveur et n’est plus jamais réaffiché.
3. Tu cliques sur « Connecter mon compte Twitch » (ou Kick, YouTube). La page d’autorisation de la plateforme s’ouvre dans ton navigateur (en local, c’est ton navigateur habituel qui s’ouvre, même si tu as cliqué depuis un dock OBS).
4. Tu acceptes. La page « Compte connecté » s’affiche : tu peux fermer l’onglet, le tableau de bord et les docks se mettent à jour tout seuls.

Pendant ce temps, le tableau de bord affiche « En attente de l’autorisation dans ton navigateur… ». Si rien ne s’est ouvert, utilise les boutons « Ouvrir le lien » ou « Copier le lien ». Le lien reste valable 10 minutes.

### D’où viennent les adresses de redirection

Après l’autorisation, la plateforme renvoie ton navigateur vers Tramevia Dock. Cette adresse de retour (« redirect URI ») doit être déclarée **à l’identique** dans ton app. Elle se construit ainsi :

```text
PUBLIC_URL + /auth/<plateforme>/callback
```

En local, avec les réglages par défaut, ça donne :

| Plateforme | Adresse de redirection |
|---|---|
| Twitch | `http://localhost:8787/auth/twitch/callback` |
| Kick | `http://localhost:8787/auth/kick/callback` |
| YouTube | `http://localhost:8787/auth/youtube/callback` |

Quelques règles pour éviter les erreurs :

- **Copie toujours l’adresse depuis l’assistant**, avec son bouton « Copier » : elle tient compte de ton port et de ton `PUBLIC_URL`.
- Utilise **`localhost`**, jamais `127.0.0.1` : Kick refuse cette adresse IP. L’assistant t’avertit si ton adresse l’utilise.
- `http://` n’est accepté par les plateformes que pour `localhost`. En ligne, il faut une adresse en `https://`.
- Si tu changes de port ou d’adresse, mets à jour l’adresse de redirection dans chaque app.

### En local ou en ligne

| | En local | En ligne (Docker, Railway…) |
|---|---|---|
| Adresse | `http://localhost:8787` | `https://ton-domaine` |
| Adresses de redirection | `http://localhost:8787/auth/…/callback` | `https://ton-domaine/auth/…/callback` |
| Chat Kick | socket Pusher, non officiel | webhooks officiels |
| Mot de passe | facultatif | `ADMIN_PASSWORD` obligatoire |

Si tu utilises les deux, tu peux déclarer les deux adresses de redirection dans la même app Twitch et le même client Google. Chaque installation garde ses propres comptes et ses propres réglages. Voir [l’hébergement en ligne](cloud.md).

## Twitch

### Ce qu’il te faut

- Ton compte Twitch, avec la **double authentification (2FA)** activée : Twitch l’exige pour créer une app. Tu l’actives dans les [paramètres de sécurité Twitch](https://www.twitch.tv/settings/security).

### Créer l’app

1. Ouvre la [console développeur Twitch](https://dev.twitch.tv/console/apps/create) (bouton « Ouvrir la console Twitch » dans l’assistant) et connecte-toi. Le formulaire « Register Your Application » s’affiche.
2. **Name** : un nom unique sur tout Twitch, par exemple `Tramevia Dock - TonPseudo`. L’assistant te propose un nom à copier.
3. **OAuth Redirect URLs** : colle `http://localhost:8787/auth/twitch/callback`, puis clique sur « Add ». Si tu as aussi une installation en ligne, ajoute sa propre adresse à la suite.
4. **Category** : choisis « Broadcaster Suite ». **Client Type** : choisis « Confidential ».
5. Coche « I’m not a robot », puis clique sur « Create ».
6. Clique sur « Manage » à côté de ton app. Copie le **Client ID**, puis clique sur « New Secret » et copie le secret.

> [!NOTE]
> Un nouveau secret remplace l’ancien. Si tu cliques de nouveau sur « New Secret » plus tard, colle le nouveau dans l’assistant, sinon tes comptes Twitch ne pourront plus renouveler leur accès.

### Connecter ton compte

1. Dans l’assistant, colle le Client ID et le Client Secret, puis clique sur « Enregistrer et tester ». Le message « Client ID et secret acceptés par Twitch. » confirme que tout va bien.
2. Clique sur « Connecter mon compte Twitch ». La page d’autorisation de Twitch s’ouvre.
3. Vérifie le nom du compte affiché, puis accepte.
4. La page « Compte connecté » s’affiche. Ton compte apparaît dans la section **Comptes** avec le statut « Connecté ».

### Ajouter un deuxième compte Twitch

Tu peux connecter autant de chaînes Twitch que tu veux. Le piège : Twitch propose d’office le compte déjà connecté sur twitch.tv dans ton navigateur. Tramevia Dock force l’affichage de la page d’autorisation, alors regarde bien le nom avant d’accepter.

Pour connecter un autre compte, au choix :

- clique sur « Ce n’est pas vous ? » sur la page d’autorisation de Twitch ;
- ou déconnecte-toi de twitch.tv dans ton navigateur avant de cliquer sur « Ajouter un autre compte » ;
- ou clique sur « Copier le lien » dans le tableau de bord et colle-le dans une fenêtre de navigation privée.

Chaque compte Twitch gère sa propre chaîne. Twitch ne permet de modifier le titre, la catégorie et les tags d’une chaîne qu’avec le compte de cette chaîne : connecte donc chaque chaîne avec son propre compte.

### Permissions demandées

Tramevia Dock ne demande que ce dont il se sert :

| Permission | À quoi elle sert |
|---|---|
| `channel:manage:broadcast` | Modifier le titre, la catégorie, les tags, la langue, la classification et le contenu de marque ; poser des marqueurs. |
| `clips:edit` | Créer des clips. |
| `user:read:chat` | Lire le chat, les messages supprimés, et les notifications d’abonnements, d’abonnements offerts, de raids et d’annonces. |
| `user:write:chat` | Envoyer des messages. |
| `moderator:manage:chat_messages` | Supprimer des messages. |
| `moderator:manage:banned_users` | Exclure temporairement, bannir et débannir. |
| `moderator:read:chatters` | Afficher la liste des personnes présentes dans le chat. |
| `moderator:read:followers` | Recevoir les follows et afficher la date de follow dans la fiche utilisateur. |
| `bits:read` | Recevoir les Bits (cheers) et les Power-ups. |
| `channel:read:redemptions` | Recevoir les récompenses de points de chaîne. |
| `moderation:read` | Repérer tes modérateurs dans la liste de la communauté. |
| `channel:read:vips` | Repérer tes VIP dans la liste de la communauté. |

### Ce qui fonctionne sur Twitch

Tout passe par l’API officielle de Twitch et fonctionne aussi bien en local qu’en ligne.

- **Chat** : lecture en temps réel, envoi (500 caractères maximum), réponses, émotes Twitch, 7TV, BTTV et FFZ, badges et cheermotes.
- **Modération** : supprimer un message, exclure de 1 seconde à 14 jours, bannir, débannir.
- **Communauté** : la liste officielle des personnes présentes dans le chat, actualisée chaque minute (Twitch la fournit avec un peu de retard), avec les rôles.
- **Statistiques** : statut du live et nombre de spectateurs.
- **Événements** : follows, abonnements, réabonnements, abonnements offerts, Bits et Power-ups, raids, points de chaîne, annonces.
- **Infos du live** : titre (140 caractères), catégorie avec recherche et jaquettes, tags (10 maximum, 25 caractères chacun, lettres et chiffres uniquement), langue, classification du contenu, contenu de marque.
- **Actions rapides** : marqueur et clip.

À faire à la main : le **texte de notification de live**, que Twitch ne permet pas de modifier par API. Dans le dock « Infos du live », la rubrique « À faire à la main » te prépare le texte et ouvre les paramètres de diffusion Twitch.

## Kick

### Ce qu’il te faut

- Ton compte Kick, avec la **double authentification (2FA)** activée : l’onglet Développeur l’exige. Tu l’actives dans les [paramètres de sécurité Kick](https://kick.com/settings/security).

### Créer l’app

1. Ouvre [Kick → Paramètres → Développeur](https://kick.com/settings/developer) (bouton « Ouvrir la console Kick » dans l’assistant) et crée une nouvelle app.
2. Donne-lui un nom, par exemple `Tramevia Dock - TonPseudo`. La description est libre.
3. **Redirect URL** : colle exactement `http://localhost:8787/auth/kick/callback`.
4. **Scopes** : coche ceux du tableau ci-dessous, et aucun autre. Ne coche jamais `streamkey:read` : Tramevia Dock n’a pas besoin de ta clé de stream.
5. **Webhooks** : en local, laisse « Enable Webhooks » désactivé. En ligne, active-le et colle `https://ton-domaine/webhooks/kick` (l’assistant affiche l’adresse exacte).
6. Enregistre l’app, puis copie le **Client ID** et le **Client Secret**.

| Scope | À quoi il sert |
|---|---|
| `user:read` | Identifier ton compte. |
| `channel:read` | Lire ton titre, ta catégorie, tes tags, ton statut de live et tes spectateurs. |
| `channel:write` | Modifier le titre, la catégorie et les tags. |
| `chat:write` | Envoyer des messages. |
| `events:subscribe` | Recevoir le chat et les événements par webhooks (installation en ligne). |
| `moderation:ban` | Exclure temporairement, bannir et débannir. |
| `moderation:chat_message:manage` | Supprimer des messages. |
| `kicks:read` | Recevoir les KICKs. |

> [!NOTE]
> Kick n’a qu’une seule adresse de webhook par app, et ne documente pas s’il accepte plusieurs Redirect URL. Si tu utilises Tramevia Dock à la fois en local et en ligne et que Kick refuse une deuxième adresse, crée une deuxième app Kick pour l’installation en ligne.

### Connecter ton compte

1. Colle le Client ID et le Client Secret, puis clique sur « Enregistrer et tester ». Le message « Identifiants Kick valides. » confirme que tout va bien.
2. Clique sur « Connecter mon compte Kick », puis accepte sur la page de Kick.
3. Pour ajouter un autre compte Kick, déconnecte-toi d’abord de kick.com dans ton navigateur.

### Comment le chat Kick est lu

Kick ne propose officiellement le chat en temps réel que par **webhooks** : Kick envoie chaque message à ton serveur, ce qui demande une adresse publique en HTTPS. Sur ton PC, c’est impossible. Tramevia Dock utilise alors le **socket Pusher** qu’utilise le site kick.com lui-même : ça fonctionne en local, mais c’est non officiel et ça peut cesser de fonctionner sans préavis.

Tu choisis le mode dans **Comptes → ton compte Kick → « Options » → « Lecture du chat »** :

| Mode | Fonctionnement |
|---|---|
| Automatique (par défaut, recommandé) | Webhooks officiels si ton adresse publique est en HTTPS, sinon Pusher. |
| Webhooks | Officiel. Demande une installation en ligne en HTTPS, avec « Enable Webhooks » activé dans ton app Kick et l’adresse affichée sous « URL du webhook à coller dans Kick ». |
| Pusher | Non officiel, lecture seule, fonctionne en local. Peut cesser de fonctionner sans préavis. |
| Désactivé | Le chat Kick n’est pas lu. L’envoi de messages, le titre et les statistiques restent actifs. |

Dans tous les modes, l’envoi de messages, la modération et les infos du live passent par l’API officielle de Kick.

En mode webhooks, Tramevia Dock s’abonne lui-même aux événements et revérifie ces abonnements toutes les heures, car Kick les supprime après une journée d’échecs de livraison. Chaque webhook est vérifié avec la signature de Kick.

**Si le chat Pusher ne se connecte pas**, c’est souvent que Kick bloque la recherche automatique du numéro de ton salon de chat. Tu peux le saisir à la main :

1. Dans **Comptes**, ouvre « Options » sur ton compte Kick.
2. Clique sur le lien « Infos de ma chaîne Kick ». Une page de texte brut s’ouvre (adresse `https://kick.com/api/v2/channels/ton-pseudo`).
3. Repère le bloc `"chatroom"` et copie le nombre `"id"` qui s’y trouve. Colle-le dans « ID du chatroom (avancé) ».
4. Copie aussi le nombre `"id"` tout en haut de la page et colle-le dans « ID de la chaîne (facultatif) ». Sans lui, tu ne reçois ni le passage en live, ni les follows, ni les KICKs.
5. Clique sur « Enregistrer ». Le message « Options enregistrées : connexion relancée. » s’affiche.

### Ce qui fonctionne sur Kick, et les limites

- **Chat** : lecture (webhooks ou Pusher), envoi (500 caractères maximum), réponses, émotes Kick et 7TV.
- **Modération** : supprimer, exclure, bannir, débannir. Kick compte les exclusions en minutes entières : de 1 minute à 7 jours. Une durée qui ne tombe pas juste est arrondie à la minute supérieure, et le raccourci de 10 secondes n’est pas proposé.
- **Communauté** : Kick ne fournit pas la liste des spectateurs. Tramevia Dock affiche les personnes qui ont écrit récemment (« Actifs ces 15 dernières minutes », par exemple).
- **Statistiques** : statut du live et nombre de spectateurs.
- **Événements** : follows, abonnements, réabonnements, abonnements offerts, KICKs, récompenses de chaîne. En mode Pusher, les raids peuvent aussi apparaître.
- **Infos du live** : titre (Tramevia Dock le limite à 140 caractères, Kick ne publie pas de maximum), catégorie avec recherche et jaquettes, tags (10 maximum ; Tramevia Dock limite chaque tag à 20 caractères, Kick ne publie pas de maximum).
- **Messages supprimés ailleurs** (par un autre modérateur, par exemple) : seul le mode Pusher les signale. Les webhooks ne transmettent que les bannissements.

À faire à la main : la **langue** et le **contenu pour adultes**, réglables uniquement dans le [tableau de bord Kick](https://dashboard.kick.com/stream).

## YouTube

### Ce qu’il te faut

- Un compte Google avec une chaîne YouTube sur laquelle le direct est activé (YouTube Studio te le propose si ce n’est pas le cas).
- Un projet Google Cloud (gratuit).

### Créer l’app Google Cloud

1. **Crée un projet** sur la [page de création de projet](https://console.cloud.google.com/projectcreate), par exemple « Tramevia Dock ».
2. **Active l’API** : ouvre la page [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) et clique sur « Activer ». Vérifie en haut de l’écran que c’est bien ton nouveau projet qui est sélectionné.
3. **Configure l’écran de consentement** : ouvre [Google Auth Platform](https://console.cloud.google.com/auth/overview) et clique sur « Commencer ». Renseigne le nom de l’app, ton e-mail, l’audience « Externe » et un e-mail de contact. **N’ajoute pas de logo** : ça déclencherait une vérification par Google.
4. **Crée le client** : dans [Clients](https://console.cloud.google.com/auth/clients), clique sur « Créer un client », type « Application Web ». Dans « URI de redirection autorisés », ajoute exactement `http://localhost:8787/auth/youtube/callback` (et ton adresse en ligne si tu en as une).
5. Clique sur « Créer » et **copie tout de suite le Client ID et le code secret** : Google n’affiche le secret qu’une seule fois. Si tu l’as perdu, ajoute un nouveau secret au client ou crée un nouveau client.
6. **Publie l’app** : sur la [page Audience](https://console.cloud.google.com/auth/audience), clique sur « Publier l’application ». Ne demande pas de validation. Si tu restes en mode test, Google te déconnecte tous les 7 jours.

### Connecter ta chaîne

1. Colle le Client ID et le code secret, puis clique sur « Enregistrer et tester ». Le message « Client ID et secret acceptés par Google. » confirme que tout va bien. Si Google répond `redirect_uri_mismatch`, le message te donne l’adresse exacte à ajouter.
2. Clique sur « Connecter mon compte YouTube ». Le sélecteur de compte Google s’ouvre : choisis le bon compte, ou la bonne **chaîne de marque**.
3. Google affiche « Cette application n’a pas été validée ». C’est normal : c’est ta propre app. Clique sur « Paramètres avancés », puis sur « Accéder à … (non sécurisé) ».
4. Accepte l’accès demandé : c’est l’unique permission utilisée (`https://www.googleapis.com/auth/youtube`, gérer ton compte YouTube).
5. La page « Compte connecté » s’affiche avec le nom de la chaîne. Vérifie que c’est la bonne.

### Le quota quotidien

Google accorde **10 000 unités par jour et par projet Google Cloud**. Le compteur repart à zéro à minuit, heure du Pacifique (vers 9 h du matin en France). Chaque appel à l’API coûte des unités :

| Action | Coût |
|---|---|
| Lire le chat | Non documenté par Google. Tramevia Dock compte 1 unité par connexion. |
| Surveiller le passage en live, hors live | 1 unité environ toutes les 5 minutes, soit environ 290 par jour |
| Suivre le live (spectateurs, fin du live) | environ 80 unités par heure |
| Envoyer un message | 50 |
| Supprimer, exclure, bannir ou débannir | 50 par action |
| Modifier titre, description, catégorie ou tags | environ 51 (lecture + écriture) |

Une journée type avec un live de 4 heures consomme environ 830 unités sans compter tes envois de messages. Envoyer 40 messages, c’est 2 000 unités de plus.

Tramevia Dock tient un **compteur local** : il s’affiche sur ta carte de compte dans le tableau de bord (« Quota API : … unités ») et dans le dock Chat au moment d’écrire. Ce n’est qu’une estimation, partagée par tous les comptes YouTube qui utilisent ton app. À 95 % de la limite, l’envoi, la modération et la modification des infos se mettent en pause jusqu’à minuit, heure du Pacifique. Si Google annonce que le quota est épuisé, le compteur passe directement au maximum.

Pour voir la consommation réelle, ouvre la page de l’API YouTube Data API v3 dans Google Cloud : elle a un onglet consacré aux quotas.

### Modifier le titre sur YouTube

Sur YouTube, le titre, la description, la catégorie et les tags appartiennent à une vidéo de live précise. Tramevia Dock modifie **le direct en cours**, ou à défaut **le direct programmé le plus proche** dans le temps.

Si tu n’as ni direct en cours ni direct programmé, tu verras « Aucun direct en cours ou programmé sur YouTube : programmes-en un dans YouTube Studio d’abord. » Programme alors ton prochain direct dans YouTube Studio : tu pourras ensuite préparer son titre depuis Tramevia Dock.

Le champ **« Jeu »** de YouTube n’existe pas dans l’API, et Tramevia Dock ne gère ni la miniature ni la visibilité : règle-les dans YouTube Studio. La rubrique « À faire à la main » du dock « Infos du live » ouvre la bonne page.

### Ce qui fonctionne sur YouTube

- **Chat** : lecture en temps réel, envoi (200 caractères maximum, 50 unités par message), émotes BTTV et FFZ. Pas de réponse à un message (l’API YouTube ne le permet pas). Les emoji personnalisés des chaînes s’affichent sous forme de texte (`:nom:`).
- **Modération** : supprimer, exclure (jusqu’à 24 heures), bannir. Le débannissement ne marche que pour les bannissements faits depuis Tramevia Dock, car YouTube ne permet pas de lister les bannis. Pour les autres : YouTube Studio → Paramètres → Communauté.
- **Communauté** : les personnes actives dans le chat ces dernières minutes (YouTube ne fournit pas la liste des spectateurs).
- **Statistiques** : statut du live et nombre de spectateurs, sauf si tu l’as masqué sur YouTube.
- **Événements** : Super Chats, Super Stickers, nouveaux membres et paliers d’adhésion, adhésions offertes, cadeaux Jewels. YouTube ne fournit **ni les follows ni les abonnements** à la chaîne.
- **Infos du live** : titre (100 caractères, sans `<` ni `>`), description (5 000 octets), catégorie YouTube choisie dans une liste, tags (500 caractères au total).

### Bon à savoir

- **Le chat YouTube peut arriver avec quelques minutes de retard.** Pour économiser le quota, Tramevia Dock ne vérifie ton passage en live qu’environ toutes les 5 minutes quand rien ne se passe. Il vérifie bien plus souvent pendant 2 heures après une connexion, un clic sur « Relancer la connexion », l’utilisation du dock « Infos du live » ou la fin d’un live, et dès qu’un autre de tes comptes est en live.
- **Mode test = déconnexion tous les 7 jours.** Si l’app n’est pas publiée (étape 6), Google révoque l’accès au bout de 7 jours. Publie-la, puis clique sur « Reconnecter ».
- **Client supprimé après 6 mois sans usage.** Google supprime les clients OAuth inutilisés. Le test de l’assistant affiche alors `deleted_client` : tu peux restaurer le client dans Google Cloud pendant 30 jours, ou en créer un nouveau.

## TikTok

### Connecter ton compte

1. Dans **Comptes**, sur la carte TikTok, saisis ton pseudo dans le champ « @pseudo ».
2. Clique sur « Ajouter ».

Pas d’app à créer, pas de mot de passe. Le chat apparaît quand tu es en live.

### Comment ça marche, et les limites

TikTok ne propose aucune API pour les lives. Tramevia Dock lit ton live grâce à la bibliothèque non officielle [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector), qui se branche sur le même flux que l’app TikTok. Pour s’y connecter, chaque connexion doit être signée par un service tiers, [Euler Stream](https://www.eulerstream.com).

- **Lecture seule.** Chat (avec les stickers), cadeaux (avec leur valeur en diamants), follows, partages, abonnements et Super Fans, likes (regroupés par tranches de 30 secondes), nombre de spectateurs. Les meilleurs donateurs du live apparaissent avec le rôle VIP.
- **Pas d’envoi de messages, pas de modération, pas de titre.** Le titre et le sujet du live se règlent dans TikTok LIVE Studio ou dans l’app TikTok.
- **Pas de liste des spectateurs** : Tramevia Dock affiche les personnes actives dans le chat.
- **Économe en requêtes.** Hors live, Tramevia Dock vérifie toutes les 2 minutes si tu es en direct, et ne se connecte au chat que pendant le live. Chaque connexion consomme une requête de signature. L’offre gratuite d’Euler Stream permet environ 2 500 requêtes par jour, largement assez pour un usage normal.
- **Clé facultative.** Si tu atteins la limite (« Quota du serveur de signature Euler Stream atteint »), tu peux créer une clé API chez Euler Stream et la mettre dans `TIKTOK_SIGN_API_KEY` (voir la [référence de configuration](install.md#référence-de-configuration)).
- **Ça peut casser.** Quand TikTok modifie son app, la connexion peut cesser de fonctionner jusqu’à la sortie d’une mise à jour de Tramevia Dock.
