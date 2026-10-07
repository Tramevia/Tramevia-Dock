<p align="right"><a href="../en/faq.md">🇬🇧 English</a></p>

# FAQ et dépannage

[← Retour au README](../../README.fr.md) · [Installation](install.md) · [Plateformes](platforms.md) · [OBS](obs.md) · [En ligne](cloud.md)

Cherche ton symptôme ci-dessous. Les messages entre guillemets sont ceux qu’affiche Tramevia Dock en français. Le statut de chaque compte (« Connecté », « À reconnecter », « Erreur ») se trouve dans la section **Comptes** du tableau de bord, avec le message d’erreur juste en dessous.

**Dépannage**

- [Tramevia Dock ne démarre pas, le port 8787 est déjà utilisé](#tramevia-dock-ne-démarre-pas-le-port-8787-est-déjà-utilisé)
- [Erreur Host not allowed](#erreur-host-not-allowed)
- [Autres erreurs au démarrage](#autres-erreurs-au-démarrage)
- [La plateforme refuse l’adresse de redirection](#la-plateforme-refuse-ladresse-de-redirection)
- [Un compte est à reconnecter ou en erreur](#un-compte-est-à-reconnecter-ou-en-erreur)
- [Twitch, le deuxième compte reconnecte le premier](#twitch-le-deuxième-compte-reconnecte-le-premier)
- [Kick, pas de chat en local](#kick-pas-de-chat-en-local)
- [YouTube, aucun direct en cours ou programmé](#youtube-aucun-direct-en-cours-ou-programmé)
- [YouTube, quota épuisé](#youtube-quota-épuisé)
- [YouTube, déconnecté au bout de 7 jours](#youtube-déconnecté-au-bout-de-7-jours)
- [TikTok, hors ligne, introuvable ou limité](#tiktok-hors-ligne-introuvable-ou-limité)
- [Docks vides ou qui demandent un mot de passe dans OBS](#docks-vides-ou-qui-demandent-un-mot-de-passe-dans-obs)
- [L’overlay n’affiche rien](#loverlay-naffiche-rien)
- [J’ai perdu le mot de passe du tableau de bord](#jai-perdu-le-mot-de-passe-du-tableau-de-bord)
- [J’ai changé de PC](#jai-changé-de-pc)

**Questions**

- [Est-ce que c’est sûr ?](#est-ce-que-cest-sûr-)
- [Est-ce que c’est payant ?](#est-ce-que-cest-payant-)
- [Pourquoi la licence AGPL ?](#pourquoi-la-licence-agpl-)
- [Pourquoi « non officiel » ?](#pourquoi-non-officiel-)

## Dépannage

### Tramevia Dock ne démarre pas, le port 8787 est déjà utilisé

La fenêtre affiche « Le port 8787 est déjà utilisé : Tramevia Dock tourne probablement déjà ». C’est le cas le plus fréquent : une autre fenêtre de `start.bat` est restée ouverte, ou Tramevia Dock tourne dans Docker. Ouvre simplement <http://localhost:8787>, ou ferme l’autre fenêtre avant de relancer.

Si c’est un autre logiciel qui occupe ce port, change de port avec `PORT=9000` dans ton `.env`. Il faudra alors mettre à jour les adresses de redirection sur les plateformes et les adresses dans OBS : voir [Changer de port](install.md#changer-de-port).

### Erreur Host not allowed

La page affiche « Host not allowed. Set PUBLIC_URL or ALLOWED_HOSTS. » (erreur 421). Tramevia Dock ne répond qu’aux adresses qu’il connaît : `localhost`, `127.0.0.1` et `[::1]` sur son propre port, le nom d’hôte de `PUBLIC_URL`, et ceux listés dans `ALLOWED_HOSTS`. C’est une protection contre certaines attaques passant par le navigateur.

Tu vois cette erreur si :

- tu passes par une autre adresse, par exemple l’IP de ton PC sur le réseau local ou un nom comme `monpc.local` : ajoute-la dans `ALLOWED_HOSTS` (par exemple `ALLOWED_HOSTS=192.168.1.20:8787`), avec un `ADMIN_PASSWORD` ;
- le port que tu tapes n’est pas celui de Tramevia Dock, par exemple avec Docker publié sur un autre port : mets `PUBLIC_URL=http://localhost:<ton port>` ;
- tu as ajouté un domaine personnalisé et tu passes encore par l’ancienne adresse : ajoute-la dans `ALLOWED_HOSTS` ;
- un reverse proxy modifie l’en-tête `Host` : voir la [check-list du reverse proxy](cloud.md#autres-hébergeurs-et-reverse-proxy).

### Autres erreurs au démarrage

Si la configuration est invalide, Tramevia Dock s’arrête et affiche la raison sous « Configuration error / Erreur de configuration » :

- `ADMIN_PASSWORD` manque alors que l’app est joignable depuis le réseau (`HOST` n’est pas `127.0.0.1`, `PUBLIC_URL` n’est pas `localhost`, ou tu es dans Docker) ;
- `ADMIN_PASSWORD` fait moins de 12 caractères, ou `TOKEN_KEY` moins de 32 ;
- `PUBLIC_URL` contient un chemin : il doit ressembler à `https://example.com`, sans rien après le domaine.

Le navigateur ne s’ouvre pas tout seul ? Ouvre <http://localhost:8787> à la main. Il ne s’ouvre pas avec `OPEN_BROWSER=0`, dans Docker, sur Railway, ni quand Tramevia Dock n’est pas lancé depuis un terminal.

Sur macOS ou Linux, « Permission denied » ? Rends les scripts exécutables avec `chmod +x start.sh start.command`.

### La plateforme refuse l’adresse de redirection

Selon la plateforme, l’erreur s’appelle `redirect_mismatch`, `redirect_uri_mismatch` ou parle d’une adresse de redirection invalide. L’adresse déclarée dans ton app ne correspond pas **exactement** à celle qu’utilise Tramevia Dock. Recopie-la depuis l’assistant avec le bouton « Copier », et vérifie :

- `http` ou `https` ;
- `localhost` et non `127.0.0.1` ;
- le port (`8787` par défaut) ;
- pas de `/` en trop à la fin.

Où la corriger :

- **Twitch** : console développeur → ton app → « Manage » → « OAuth Redirect URLs ». Tu peux y mettre plusieurs adresses.
- **Kick** : Paramètres → Développeur → ton app → « Redirect URL ».
- **YouTube** : Google Cloud → Clients → ton client → « URI de redirection autorisés ». Si le bouton « Tester » de l’assistant reçoit `redirect_uri_mismatch` de Google, le message te donne l’adresse exacte à ajouter. Le changement peut mettre quelques minutes à s’appliquer chez Google.

Si tu vois « Lien de connexion expiré ou déjà utilisé », c’est autre chose : le lien de connexion n’est valable que 10 minutes et une seule fois. Relance la connexion depuis le tableau de bord ou le dock.

### Un compte est à reconnecter ou en erreur

**« À reconnecter »** : l’accès a expiré ou a été révoqué (mot de passe changé sur la plateforme, accès retiré, secret de l’app régénéré, app YouTube restée en mode test…). Clique sur « Reconnecter » sur la carte du compte. Si tu as régénéré le secret de ton app (par exemple « New Secret » sur Twitch), colle d’abord le nouveau dans l’assistant, puis reconnecte.

**« Ce n’est pas le même compte (attendu : …) »** : tu as cliqué sur « Reconnecter », mais tu as autorisé un autre compte sur la plateforme. Déconnecte-toi de la plateforme dans ce navigateur (ou utilise une fenêtre privée), puis recommence.

**« Erreur »** : le message sous le compte en donne la raison. Souvent c’est passager (plateforme injoignable) et Tramevia Dock réessaie tout seul. Tu peux aussi cliquer sur « Relancer la connexion ».

### Twitch, le deuxième compte reconnecte le premier

Twitch propose d’office le compte déjà connecté sur twitch.tv dans ton navigateur. Sur la page d’autorisation, clique sur « Ce n’est pas vous ? », ou déconnecte-toi de twitch.tv avant d’ajouter le compte, ou utilise « Copier le lien » et colle-le dans une fenêtre de navigation privée. Détails dans [Ajouter un deuxième compte Twitch](platforms.md#ajouter-un-deuxième-compte-twitch).

Le test de l’app Twitch échoue ? Recopie le Client ID et le secret depuis la console Twitch (« Manage »), sachant qu’un nouveau secret remplace l’ancien, et vérifie que le « Client Type » est bien « Confidential ».

### Kick, pas de chat en local

En local, le chat Kick passe par le socket Pusher non officiel.

1. Dans **Comptes → ton compte Kick → « Options »**, vérifie que la « Lecture du chat » est sur « Automatique » ou « Pusher ».
2. Si le compte affiche « Impossible de trouver le salon de chat Kick », Kick bloque la recherche automatique : saisis l’ID du chatroom à la main, comme expliqué dans [Comment le chat Kick est lu](platforms.md#comment-le-chat-kick-est-lu).
3. Pas de follows, de KICKs ni de passage en live ? Remplis aussi « ID de la chaîne (facultatif) ».
4. « Kick a refusé le socket de chat non officiel (code …) » : Kick a changé quelque chose de son côté. Mets Tramevia Dock à jour. En attendant, seuls les webhooks officiels permettent de lire le chat Kick : installation en ligne, ou [en local avec un tunnel](cloud.md#en-local-avec-un-tunnel-webhooks-kick).

En ligne, si tu vois « Kick a refusé les abonnements webhook », active « Enable Webhooks » dans ton app Kick avec l’adresse donnée dans le message (`https://ton-domaine/webhooks/kick`), vérifie que l’app a le scope `events:subscribe`, puis clique sur « Relancer la connexion ».

À noter : Kick compte les exclusions en minutes entières (de 1 minute à 7 jours). Une durée en secondes est arrondie à la minute supérieure.

### YouTube, aucun direct en cours ou programmé

Le message est « Aucun direct en cours ou programmé sur YouTube : programmes-en un dans YouTube Studio d’abord. » Tramevia Dock modifie le direct en cours, ou à défaut le direct programmé le plus proche dans le temps. Programme ton direct dans YouTube Studio, puis réessaie. Voir [Modifier le titre sur YouTube](platforms.md#modifier-le-titre-sur-youtube).

Le chat YouTube arrive avec quelques minutes de retard ? Pour économiser le quota, Tramevia Dock ne vérifie ton passage en live qu’environ toutes les 5 minutes quand rien ne se passe. Clique sur « Relancer la connexion » juste avant ton live : il vérifie alors bien plus souvent pendant 2 heures. Il le fait aussi dès qu’un autre de tes comptes passe en live.

### YouTube, quota épuisé

Les messages sont « Quota de l’API YouTube presque épuisé… » ou « Quota quotidien de l’API YouTube épuisé… ». Tu as utilisé (presque) toutes tes 10 000 unités du jour. L’envoi, la modération et la modification des infos YouTube sont en pause jusqu’à minuit, heure du Pacifique (vers 9 h du matin en France). Si Google a réellement épuisé ton quota, la lecture du chat YouTube peut elle aussi s’arrêter jusqu’à la remise à zéro.

Chaque message envoyé coûte 50 unités : pendant les longs lives, évite d’envoyer beaucoup de messages vers YouTube depuis Tramevia Dock. Voir [Le quota quotidien](platforms.md#le-quota-quotidien).

Autres messages de Google :

- `invalid_client` : le Client ID ou le secret est faux. Recopie-les tous les deux depuis Google Cloud → Clients.
- `deleted_client` : Google a supprimé ton client, par exemple après 6 mois sans utilisation. Restaure-le dans Google Cloud (possible pendant 30 jours) ou crée un nouveau client « Application Web ».
- « Ce compte Google n’a pas de chaîne YouTube » : reconnecte-toi en choisissant le bon compte, ou la bonne chaîne de marque.
- Impossible de débannir quelqu’un : YouTube ne permet pas de lister les bannis, donc Tramevia Dock ne peut lever que les bannissements faits depuis Tramevia Dock. Pour les autres, passe par YouTube Studio → Paramètres → Communauté.

### YouTube, déconnecté au bout de 7 jours

Ton app Google est restée en mode test. Sur la [page Audience](https://console.cloud.google.com/auth/audience) de Google Cloud, clique sur « Publier l’application » (sans demander de validation), puis clique sur « Reconnecter » dans Tramevia Dock.

### TikTok, hors ligne, introuvable ou limité

- **Pas de chat** : le chat TikTok n’apparaît que pendant un live. Hors live, Tramevia Dock vérifie toutes les 2 minutes si tu as commencé : attends un peu après le début de ton live.
- **« Compte TikTok @… introuvable »** : vérifie l’orthographe de ton pseudo (2 à 24 caractères : lettres, chiffres, points et _). Supprime le compte avec « Déconnecter » et ajoute-le de nouveau avec le bon pseudo.
- **« Quota du serveur de signature Euler Stream atteint »** : l’offre gratuite d’Euler Stream (environ 2 500 requêtes par jour) est épuisée. Tramevia Dock réessaie plus tard tout seul. Si ça arrive souvent, crée une clé API chez [Euler Stream](https://www.eulerstream.com) et mets-la dans `TIKTOK_SIGN_API_KEY`.

La connexion à TikTok est non officielle et en lecture seule : une mise à jour de TikTok peut la casser. Dans ce cas, vérifie s’il existe une nouvelle version de Tramevia Dock.

### Docks vides ou qui demandent un mot de passe dans OBS

- **Tramevia Dock ne tourne pas.** Les docks en ont besoin. Lance-le, puis ferme et rouvre le dock depuis le menu **Docks** d’OBS.
- **Le dock affiche l’écran de connexion.** L’adresse du dock ne contient plus une clé valable. C’est le cas après un clic sur « Régénérer » à côté de « Clé des docks », et après un changement d’`ADMIN_PASSWORD` (Tramevia Dock régénère alors la clé des docks au démarrage suivant). Recopie les adresses depuis la section **OBS** du tableau de bord et colle-les dans **Docks → Docks de navigateur personnalisés…**.
- **Le dock refuse les actions et parle d’une clé non autorisée.** Tu as collé l’adresse de l’overlay (clé en lecture seule) dans un dock. Utilise les adresses de la carte « Docks OBS ».
- **Tu as changé de port ou de `PUBLIC_URL`.** Les adresses des docks ont changé aussi : recopie-les.

Sous Linux avec Wayland, OBS peut ne pas proposer les docks de navigateur : ouvre leurs adresses dans une fenêtre de navigateur classique.

### L’overlay n’affiche rien

- Regarde l’« Aperçu en direct » dans le tableau de bord : s’il fonctionne, recopie l’adresse dans la source Navigateur.
- Tu as régénéré la clé de l’overlay ? Recopie l’adresse. (Elle ne change pas quand tu changes de mot de passe.)
- Vérifie les filtres : plateformes ou comptes décochés, bots et !commandes masqués.
- En mode « Message mis en avant », rien ne s’affiche tant que tu n’as pas cliqué sur l’étoile d’un message dans le dock Chat.
- Dans les propriétés de la source, clique sur « Actualiser le cache de la page actuelle ».

### J’ai perdu le mot de passe du tableau de bord

Le mot de passe, c’est la valeur d’`ADMIN_PASSWORD` : dans `.env` pour une installation locale ou Docker, dans les variables du service sur Railway.

1. Choisis un nouveau `ADMIN_PASSWORD` (12 caractères minimum).
2. Redémarre Tramevia Dock.
3. Au démarrage, Tramevia Dock déconnecte toutes les sessions et régénère la clé des docks : recopie les adresses des docks dans OBS. La clé de l’overlay ne change pas.

En local sans `ADMIN_PASSWORD`, il n’y a pas de mot de passe : le tableau de bord est ouvert depuis ton ordinateur uniquement.

### J’ai changé de PC

1. Sur l’ancien PC, arrête Tramevia Dock.
2. Installe Tramevia Dock sur le nouveau PC (voir l’[installation](install.md)).
3. Copie le dossier `data` **en entier**, avec `secret.key`, ainsi que ton fichier `.env` si tu en as un. Si tu utilises `TOKEN_KEY`, garde exactement la même valeur.
4. Garde le même port : les adresses de redirection restent valables.
5. Lance Tramevia Dock, puis recopie les adresses des docks et de l’overlay dans l’OBS du nouveau PC.

Sans `secret.key`, tes comptes passent en « À reconnecter » et tu dois ressaisir les identifiants de tes apps. Si tu as un `ADMIN_PASSWORD`, la clé des docks est aussi régénérée : recopie leurs adresses dans OBS.

## Questions

### Est-ce que c’est sûr ?

- Tramevia Dock tourne chez toi. Tes jetons ne sont envoyés qu’aux plateformes elles-mêmes, et il n’y a pas de télémétrie.
- Les jetons et les secrets de tes apps sont chiffrés sur le disque (AES-256-GCM).
- En local sans mot de passe, le serveur n’écoute que sur ta machine. Dès qu’il est joignable depuis le réseau, un mot de passe de 12 caractères minimum est obligatoire, et les tentatives de connexion sont limitées.
- Les docks utilisent une clé régénérable ; l’overlay, une clé séparée en lecture seule.
- Tramevia Dock ne demande jamais ta clé de stream ni le mot de passe de tes comptes.
- Les messages du chat restent en mémoire et ne sont pas écrits sur le disque. Le détail de ce qui est enregistré est dans la section [Sécurité et confidentialité du README](../../README.fr.md#sécurité-et-confidentialité).

Ce qui reste de ta responsabilité : ne montre pas les adresses des docks en live, ne partage ni ton dossier `data` ni ton `.env`, et garde Tramevia Dock à jour. Pour signaler une faille, voir [SECURITY.md](../../SECURITY.md).

### Est-ce que c’est payant ?

Non. Tramevia Dock est gratuit et libre. Les apps développeur de Twitch, Kick et Google sont gratuites, l’API YouTube aussi dans la limite du quota quotidien, et l’offre gratuite d’Euler Stream suffit en général pour TikTok. Seul un hébergement en ligne (Railway, serveur…) peut te coûter quelque chose ; sur ton PC, tout est gratuit.

### Pourquoi la licence AGPL ?

L’AGPL-3.0 garantit que Tramevia Dock reste libre : tout le monde peut l’utiliser, l’étudier et le modifier. En contrepartie, quiconque distribue une version modifiée, ou la fait tourner pour d’autres personnes à travers un réseau, doit partager son code source sous la même licence. C’est aussi la licence de [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector), la bibliothèque utilisée pour TikTok.

Pour un usage personnel, ça ne change rien pour toi : installe-le et modifie-le comme tu veux.

### Pourquoi non officiel ?

TikTok n’a pas d’API pour les lives, et Kick ne propose officiellement le chat que par webhooks, impossibles à recevoir sur un PC sans adresse publique. Pour ces deux cas, Tramevia Dock utilise des connexions non officielles, en lecture seule, signalées comme telles dans l’interface. Elles peuvent cesser de fonctionner après un changement de la plateforme.
