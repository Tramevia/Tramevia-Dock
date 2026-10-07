<p align="right"><a href="../en/obs.md">🇬🇧 English</a></p>

# Ajouter Tramevia Dock à OBS

[← Retour au README](../../README.fr.md) · [Installation](install.md) · [Plateformes](platforms.md) · [En ligne](cloud.md) · [FAQ](faq.md)

Tramevia Dock s’intègre à OBS de deux façons :

- des **docks** : des panneaux dans la fenêtre d’OBS, visibles par toi seul (chat, événements, communauté, infos du live) ;
- un **overlay de chat** : une source Navigateur dans ta scène, visible par tes spectateurs.

Tout se prépare dans le tableau de bord, section **OBS** (<http://localhost:8787>, menu de gauche).

![Les docks Chat, Événements, Communauté et Infos du live côte à côte, comme dans OBS](../assets/screenshots/fr/docks.png)

## Docks

### Ajouter les docks

1. Dans le tableau de bord, ouvre la section **OBS**. La carte « Docks OBS » liste une adresse par dock. Clique sur « Copier » à côté du premier.
2. Dans OBS (version 31 ou plus récente), ouvre le menu **Docks → Docks de navigateur personnalisés…**.
3. Saisis un nom (par exemple « Chat »), colle l’adresse dans la colonne URL, puis clique sur « Appliquer ».
4. Recommence pour chaque dock qui t’intéresse.
5. Place les docks où tu veux dans la fenêtre d’OBS, puis clique sur « J’ai ajouté mes docks » dans le tableau de bord.

Les docks se mettent à jour tout seuls, et se reconnectent tout seuls si tu relances Tramevia Dock. Le petit point en haut à droite de chaque dock indique si la connexion au serveur est active.

### Les docks disponibles

| Dock | Adresse | Contenu |
|---|---|---|
| Chat unifié | `/chat` | Tous tes chats au même endroit : lecture, envoi, réponses, modération, mise en avant d’un message sur l’overlay, marqueur et clip Twitch. |
| Événements | `/events` | Follows, abonnements, dons, Bits, KICKs, Super Chats, raids, cadeaux… |
| Communauté | `/community` | Total de spectateurs et qui est présent dans ton chat, plateforme par plateforme. |
| Infos du live | `/stream` | Titre, catégorie et tags sur toutes tes plateformes, préréglages et rubrique « À faire à la main ». |
| Tableau de bord | `/` | Vue d’ensemble, comptes, réglages OBS et paramètres. |

Tous les docks fonctionnent dès 300 pixels de large. Pour le chat, 350 à 450 pixels sont confortables. « Infos du live » et le tableau de bord ont plus de champs : donne-leur plus de place, ou ouvre-les dans ton navigateur.

![Le dock Chat unifié en largeur étroite : messages de Twitch, Kick, YouTube et TikTok, choix des comptes destinataires et zone d’envoi](../assets/screenshots/fr/chat-dock.png)

### La clé dans l’adresse des docks

Chaque adresse de dock se termine par `?key=…`. Cette clé donne un **accès complet** à Tramevia Dock, sans mot de passe : c’est ce qui permet aux docks de fonctionner dans OBS.

- Le tableau de bord la masque à l’écran (« Clé masquée : utilise le bouton Copier »). Utilise toujours le bouton « Copier ».
- Ne montre jamais ces adresses en live, et ne les partage pas.
- En cas de fuite : **Paramètres → Sécurité → Clé des docks → « Régénérer »**. L’ancienne clé ne donne plus accès à rien : recopie les nouvelles adresses de tous tes docks depuis la section OBS.

### Connecter un compte depuis un dock

Les connexions aux plateformes ne se font jamais dans le dock lui-même. En local, quand tu cliques sur « Reconnecter » ou « Connecter mon compte … » dans un dock, Tramevia Dock ouvre la page d’autorisation dans ton navigateur habituel. Une fois l’accès accepté, tu peux fermer l’onglet : le dock se met à jour tout seul.

Si rien ne s’ouvre (par exemple avec une installation en ligne), utilise « Copier le lien » et colle-le dans ton navigateur.

### Linux avec Wayland

Sous Linux avec Wayland, OBS peut ne pas proposer les docks de navigateur. Ouvre simplement les mêmes adresses dans une fenêtre de navigateur classique, à côté d’OBS. L’overlay, lui, fonctionne normalement.

## Overlay de chat

L’overlay affiche ton chat sur le stream, avec un fond transparent. Il utilise une clé à part, **en lecture seule** : son adresse ne permet aucune action sur tes comptes.

### Ajouter l’overlay

1. Dans le tableau de bord, section **OBS**, trouve la carte « Overlay de chat ».
2. Règle l’apparence : type, thème, alignement, nombre de messages, disparition, taille du texte, badges, icônes, avatars, bulles, contour, filtres. L’« Aperçu en direct » se met à jour au fur et à mesure (le damier représente la transparence).
3. Copie l’« Adresse de l’overlay ».
4. Dans OBS : **Sources → + → Navigateur**, donne un nom à la source, colle l’adresse dans le champ URL, mets la largeur à **400** et la hauteur à **600**, puis valide.

![Overlay de chat sur une scène de jeu : bulles de messages avec l’icône de chaque plateforme, réponses et un follow](../assets/screenshots/fr/overlay.png)

Les réglages font partie de l’adresse. Si tu les modifies dans le tableau de bord, recopie l’adresse dans les propriétés de la source.

### Mode « Message mis en avant »

Ce mode affiche un seul message, celui que tu choisis pendant le live : une question, un bon mot, un message de soutien…

1. Dans la carte « Overlay de chat », choisis le type « Message mis en avant », règle la « Durée (s, 0 = jusqu’au retrait) », puis copie l’adresse.
2. Ajoute-la dans OBS comme **deuxième** source Navigateur (garde ta source de chat classique à côté si tu veux les deux).
3. Pendant le live, dans le dock Chat, survole un message et clique sur l’étoile « Afficher sur l’overlay ». Clique de nouveau dessus (« Retirer de l’overlay ») pour l’enlever avant la fin de la durée.

Un message supprimé par la modération n’est jamais affiché. Si OBS recharge la source, le message mis en avant revient pour le temps qu’il lui restait.

### Paramètres de l’adresse de l’overlay

L’overlay se règle uniquement par son adresse : `/overlay/chat?key=…&theme=…`. Le générateur du tableau de bord écrit ces paramètres pour toi ; ce tableau sert si tu veux ajuster une adresse à la main.

Pour les interrupteurs, `1`, `true` ou `yes` activent l’option, toute autre valeur la désactive. La colonne « Si absent » donne la valeur utilisée quand le paramètre ne figure pas dans l’adresse ; le générateur, lui, écrit toujours ses propres valeurs (colonne « Générateur »).

| Paramètre | Valeurs | Si absent | Générateur | Effet |
|---|---|---|---|---|
| `key` | clé de l’overlay | — | ajoutée automatiquement | Obligatoire. La clé en lecture seule. |
| `mode` | `featured` | chat classique | ajouté en mode « Message mis en avant » | Affiche seulement le message mis en avant depuis le dock Chat. |
| `theme` | `transparent`, `dark`, `light` | `transparent` | `dark` | Thème : transparent, sombre ou clair. |
| `max` | 1 à 100 | `12` | `20` | Nombre maximal de messages à l’écran. |
| `fade` | 0 à 3600 secondes (générateur : 0 à 600) | `0` | `0` | Durée avant qu’un message disparaisse. `0` = jamais. |
| `size` | 8 à 120 pixels (générateur : 10 à 48) | 20 px | `16` | Taille du texte. |
| `align` | `left`, `right` | `left` | `left` | Alignement à gauche ou à droite. |
| `platforms` | liste séparée par des virgules : `twitch,kick,youtube,tiktok` | toutes | ajouté seulement si tu en décoches | Plateformes affichées. |
| `accounts` | identifiants de comptes, séparés par des virgules | tous | ajouté seulement si tu en décoches | Comptes affichés. Utilise le générateur : les identifiants sont internes. |
| `hideBots` | interrupteur | désactivé | `1` | Masque les bots connus (Nightbot, StreamElements, Moobot…). |
| `hideCommands` | interrupteur | désactivé | `1` | Masque les messages qui commencent par `!`. |
| `events` | interrupteur | activé | `1` | Affiche aussi les événements (follows, abonnements…). |
| `badges` | interrupteur | activé | `1` | Badges des auteurs. |
| `icons` | interrupteur | activé | `1` | Icône de la plateforme devant chaque message. |
| `avatars` | interrupteur | désactivé | `0` | Avatars des auteurs. |
| `bubble` | interrupteur | désactivé | `0` | Chaque message dans une bulle. |
| `outline` | interrupteur | désactivé | `1` | Contour autour du texte, pour le lire sur n’importe quel fond. |
| `featureSeconds` | 0 à 3600 secondes (générateur : 0 à 300) | `0` | `15` | Mode mis en avant : durée d’affichage. `0` = jusqu’à ce que tu le retires. |

En mode `featured`, les paramètres `max`, `fade`, `hideBots`, `hideCommands` et `events` sont ignorés, et l’avatar de l’auteur est toujours affiché.

## Astuces

- **Pas besoin de CSS personnalisé.** Thème, taille, bulles et contour se règlent dans l’adresse. Tu peux laisser le champ CSS de la source Navigateur tel qu’OBS le propose.
- **L’overlay n’a pas pris tes nouveaux réglages ?** Vérifie que tu as bien recollé la nouvelle adresse, puis, dans les propriétés de la source, clique sur « Actualiser le cache de la page actuelle ».
- **Plusieurs scènes.** Pour utiliser le même overlay dans plusieurs scènes, ajoute-le comme source existante (**Sources → + → Navigateur → Ajouter une source existante**) plutôt que d’en créer une nouvelle. Pour des variantes (un overlay par plateforme, par exemple), crée une source par adresse.
- **Après un rechargement**, l’overlay réaffiche les derniers messages récents. Avec `fade`, seuls ceux qui n’auraient pas encore disparu reviennent.
- **Clé de l’overlay compromise ?** **Paramètres → Sécurité → Clé de l’overlay → « Régénérer »**, puis recopie la nouvelle adresse dans la source Navigateur.
- **Les docks ne répondent plus ?** Vérifie que Tramevia Dock tourne toujours (la fenêtre noire est ouverte). Les autres causes sont dans la [FAQ](faq.md#docks-vides-ou-qui-demandent-un-mot-de-passe-dans-obs).
