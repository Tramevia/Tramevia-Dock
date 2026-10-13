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

L’overlay affiche ton chat sur le stream, avec un fond transparent. Il utilise une clé à part, **en lecture seule** : elle permet d’afficher ton chat et de lire les réglages de l’overlay, jamais de les modifier ni d’agir sur tes comptes.

Il y a quatre overlays, chacun avec ses réglages et son adresse :

- **Chat** : ton chat, message après message ;
- **Message mis en avant** : seulement le message que tu choisis dans le dock Chat (voir plus bas) ;
- **Alertes** : chaque follow, sub, sub offert, don (bits, KICKs, Super Chats, cadeaux), raid, récompense de points, j’aime et partage TikTok, une alerte à la fois, sur toutes tes plateformes (voir plus bas) ;
- **Spectateurs** : le total de tes spectateurs en direct, toutes plateformes confondues, avec chaque variation animée (voir plus bas).

Leurs réglages sont enregistrés dans Tramevia Dock et **s’appliquent en direct** : change une option dans le tableau de bord, l’overlay suit tout de suite dans OBS. Tu colles chaque adresse dans OBS **une seule fois**.

### Ajouter l’overlay

1. Dans le tableau de bord, section **OBS**, trouve la carte « Overlay de chat » et choisis « Chat ».
2. Règle l’apparence : thème, alignement, nombre de messages, disparition, taille du texte, badges, icônes, avatars, bulles, contour, mention Tramevia Dock, filtres. L’« Aperçu en direct » se met à jour au fur et à mesure (le damier représente la transparence). Tout s’enregistre tout seul.
3. Copie l’« Adresse de l’overlay ».
4. Dans OBS : **Sources → + → Navigateur**, donne un nom à la source, colle l’adresse dans le champ URL, mets la largeur à **400** et la hauteur à **600**, puis valide.

![Overlay de chat sur une scène de jeu : bulles de messages avec l’icône de chaque plateforme, réponses et un follow](../assets/screenshots/fr/overlay.png)

Pour le message mis en avant, choisis « Message mis en avant » dans le tableau de bord et ajoute son adresse comme **deuxième** source Navigateur.

### Alertes

Choisis « Alertes » dans le tableau de bord et ajoute son adresse comme une autre source Navigateur, à la taille de ta scène (par exemple largeur **1920**, hauteur **1080**) : l’alerte apparaît centrée en **haut**, au **milieu** ou en **bas** de la source, à ton choix. **Style** : « Carte » (une carte en verre qui flotte en 3D), « Grand texte » (de grands mots posés sur ta scène, sans cadre), « Impact » (un plan produit : l’alerte tombe comme une étiquette de canette coupée en trois tranches qui tournent, se recollent d’un coup et éclaboussent), « Éclipse » (rien que de la lumière : deux faisceaux convergent sur un anneau, un couloir sombre s’ouvre entre deux parois de lumière courbes), « Plasma » (une étoile thermique qui chauffe jusqu’au blanc, gonfle en sphère et s’étire en alerte) ou « Verre » (une capsule de verre dépoli devient une carte pendant qu’une lumière chaude passe dessous et reste allumée derrière le verre). Le texte se réduit tout seul dans une source étroite. Chaque alerte reste le temps de la **durée** réglée (6 secondes par défaut) ; les suivantes attendent leur tour. Un petit carillon accompagne chaque alerte : mets le **volume du son** à 0 pour le couper. Dans « Alertes affichées », désactive celles que tu ne veux pas à l’écran. Clique sur « Envoyer une alerte de test » pour en voir une dans l’aperçu et dans OBS sans attendre un vrai follow.

Les alertes s’affichent seulement au moment où elles arrivent : quand OBS recharge la source, les anciennes ne repassent pas.

> [!TIP]
> Pour que le carillon s’entende dans ton stream et pas seulement sur ton PC, coche « Contrôler l’audio via OBS » dans les propriétés de la source Navigateur, et vérifie que la source n’est pas coupée dans le mixeur audio.

### Spectateurs

Choisis « Spectateurs » dans le tableau de bord et ajoute son adresse comme une autre source Navigateur (par exemple largeur **400**, hauteur **400**). Elle affiche un orbe de particules lumineuses avec le total de tes spectateurs en direct sur toutes tes plateformes. Quand il monte, un **+x** vert s’anime ; quand il baisse, un **−x** rouge. **Nombre** : dans l’orbe (« Au centre »), ou à sa gauche ou à sa droite. Dans « Plateformes » et « Comptes », retire ceux que tu ne veux pas compter. Le total se met à jour à chaque relevé des plateformes (toutes les 30 à 60 secondes environ). Clique sur « Tester une variation » pour voir une hausse puis une baisse dans l’aperçu et dans OBS.

Ensuite, plus besoin de recoller l’adresse quand tu changes un réglage. Tu ne la recolles que si l’adresse elle-même change : après avoir régénéré la clé de l’overlay (**Paramètres → Sécurité → Clé de l’overlay**), ou après un changement de port ou de `PUBLIC_URL`.

« Réinitialiser » remet l’overlay choisi à ses réglages par défaut (en direct, lui aussi) : thème sombre, 20 messages, texte de 16 px, bots et !commandes masqués, contour du texte activé, et 15 secondes pour un message mis en avant.

**Filtres.** Les plateformes et les comptes que tu décoches sont masqués. Tout le reste s’affiche : un compte que tu connectes plus tard apparaît tout seul sur l’overlay.

### Mode « Message mis en avant »

Ce mode affiche un seul message, celui que tu choisis pendant le live : une question, un bon mot, un message de soutien…

1. Ajoute l’adresse du « Message mis en avant » comme source Navigateur (voir plus haut) et règle sa « Durée (s, 0 = jusqu’au retrait) ».
2. Pendant le live, dans le dock Chat, survole un message et clique sur l’étoile « Afficher sur l’overlay ». Clique de nouveau dessus (« Retirer de l’overlay ») pour l’enlever avant la fin de la durée.

Un message supprimé par la modération n’est jamais affiché. Si OBS recharge la source, le message mis en avant revient pour le temps qu’il lui restait.

### Avancé : des réglages dans l’adresse

Tu peux aussi écrire des réglages dans l’adresse elle-même. Deux cas :

- **Une variante d’un overlay enregistré.** Ajoute des paramètres à une adresse enregistrée (celle qui contient `&id=chat` ou `&id=featured`) : chaque paramètre remplace ce réglage-là, les autres suivent toujours le tableau de bord en direct. Par exemple, une version plus petite pour une autre scène : `…&id=chat&size=14&max=5`.
- **Les anciennes adresses sans `&id=`** (créées avant les overlays enregistrés). Elles marchent exactement comme avant, réglées uniquement par leurs paramètres, mais elles **ne suivent pas le tableau de bord**. Pour profiter des réglages en direct, copie la nouvelle adresse une fois.

Pour les interrupteurs, `1`, `true` ou `yes` activent l’option ; toute autre valeur, même vide, la désactive. Un nombre hors limites est ramené dans les limites. La colonne « Si absent » vaut pour les adresses sans `&id=` ; sur une adresse enregistrée, un paramètre absent veut dire « le réglage enregistré ».

| Paramètre | Valeurs | Si absent | Effet |
|---|---|---|---|
| `key` | clé de l’overlay | — | Obligatoire. La clé en lecture seule. Ajoutée automatiquement. |
| `id` | `chat`, `featured` | aucun : réglages seulement depuis l’adresse | L’overlay enregistré à suivre. Ajouté automatiquement. |
| `mode` | `featured` | chat classique (`featured` avec `id=featured`) | Affiche seulement le message mis en avant depuis le dock Chat. Toute autre valeur : chat classique. |
| `theme` | `transparent`, `dark`, `light` | `transparent` | Thème : transparent, sombre ou clair. |
| `max` | 1 à 100 | `12` | Nombre maximal de messages à l’écran. |
| `fade` | 0 à 3600 secondes | `0` | Durée avant qu’un message disparaisse. `0` = jamais. |
| `size` | 8 à 120 pixels | 20 px | Taille du texte. |
| `align` | `left`, `right` | `left` | Alignement à gauche ou à droite. |
| `platforms` | liste séparée par des virgules : `twitch,kick,youtube,tiktok` | toutes | Plateformes **affichées**. |
| `accounts` | identifiants de comptes, séparés par des virgules | tous | Comptes **affichés**. Les identifiants sont internes : préfère les filtres du tableau de bord. |
| `hideBots` | interrupteur | désactivé | Masque les bots connus (Nightbot, StreamElements, Moobot…). |
| `hideCommands` | interrupteur | désactivé | Masque les messages qui commencent par `!`. |
| `events` | interrupteur | activé | Affiche aussi les événements (follows, abonnements…). |
| `badges` | interrupteur | activé | Badges des auteurs. |
| `icons` | interrupteur | activé | Icône de la plateforme devant chaque message. |
| `avatars` | interrupteur | désactivé | Avatars des auteurs. |
| `bubble` | interrupteur | désactivé | Chaque message dans une bulle. |
| `outline` | interrupteur | désactivé | Contour autour du texte, pour le lire sur n’importe quel fond. |
| `credit` | interrupteur | désactivé | Petite mention « Chat via Tramevia Dock » sous le chat, pour faire connaître le projet. Jamais activée sans toi. |
| `featureSeconds` | 0 à 3600 secondes | `0` | Mode mis en avant : durée d’affichage. `0` = jusqu’à ce que tu le retires. |

Dans l’adresse, `platforms` et `accounts` listent ce qu’il faut **afficher**, alors que les filtres du tableau de bord listent ce qu’il faut masquer. Sur une adresse enregistrée, les deux s’appliquent : un message doit passer les filtres du tableau de bord et les listes de l’adresse.

En mode `featured`, les paramètres `max`, `fade`, `hideBots`, `hideCommands` et `events` sont ignorés, et l’avatar de l’auteur est toujours affiché ; `platforms` et `accounts` s’appliquent toujours.

## Astuces

- **Pas besoin de CSS personnalisé.** Thème, taille, bulles et contour se règlent dans le tableau de bord. Tu peux laisser le champ CSS de la source Navigateur tel qu’OBS le propose.
- **L’overlay n’a pas pris tes nouveaux réglages ?** Vérifie que son adresse contient `&id=` (voir [Avancé : des réglages dans l’adresse](#avancé--des-réglages-dans-ladresse)), puis, dans les propriétés de la source, clique sur « Actualiser le cache de la page actuelle ».
- **Plusieurs scènes.** Pour utiliser le même overlay dans plusieurs scènes, ajoute-le comme source existante (**Sources → + → Navigateur → Ajouter une source existante**) plutôt que d’en créer une nouvelle. Pour des variantes (un overlay par plateforme, par exemple), crée une source avec des paramètres en plus dans son adresse.
- **Après un rechargement**, l’overlay réaffiche les derniers messages récents. Avec `fade`, seuls ceux qui n’auraient pas encore disparu reviennent.
- **Clé de l’overlay compromise ?** **Paramètres → Sécurité → Clé de l’overlay → « Régénérer »**, puis recopie les nouvelles adresses dans tes sources Navigateur.
- **Les docks ne répondent plus ?** Vérifie que Tramevia Dock tourne toujours (la fenêtre noire est ouverte). Les autres causes sont dans la [FAQ](faq.md#docks-vides-ou-qui-demandent-un-mot-de-passe-dans-obs).
