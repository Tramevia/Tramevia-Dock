// Tramevia Dock — dashboard (home + onboarding): overview, live tools, accounts, setup wizards, OBS docks & overlay builder, settings.
import {
  boot, h, api, t, addI18n, lang, setLang, applyTheme, openAuth, copy, copyField, toast, busy,
  confirmDialog, fmt, icon, platformIcon, store, withKey, accessKey, query, $, $$, supportButton,
} from '/assets/core.js';
import { OVERLAY_IDS, ALERT_TYPES, STYLES, GOALS, LOOKS, GOAL_COLORS, GOAL_ICONS, isLocked, DEFAULTS as OV_DEFAULTS, cleanOverlay } from '/assets/overlay-settings.js';
import { goalIcon } from '/assets/overlay-widgets.js';

addI18n({
  fr: {
    'home.nav.label': 'Sections du tableau de bord',
    'home.nav.overview': 'Vue d’ensemble', 'home.nav.accounts': 'Comptes', 'home.nav.obs': 'OBS', 'home.nav.settings': 'Paramètres',
    'home.loadError': 'Impossible de charger le tableau de bord.',
    'home.hello.morning': 'Bonjour', 'home.hello.afternoon': 'Bonjour', 'home.hello.evening': 'Bonsoir',
    'home.hello.sub': 'Voici où en sont tes lives, en temps réel.',
    'home.ov.total': 'Spectateurs au total',
    'home.ov.liveCount': '{n} compte en direct sur {total}', 'home.ov.liveCount|plural': '{n} comptes en direct sur {total}',
    'home.ov.channels': 'Tes chaînes', 'home.ov.manage': 'Gérer', 'home.ov.since': 'depuis {d}',
    'home.ov.waiting': 'En attente des statistiques…', 'home.ov.statsError': 'Statistiques indisponibles',
    'home.ov.stale': 'La dernière mise à jour a échoué, valeurs précédentes affichées : {error}',
    'home.ov.stale|plural': '{n} mises à jour de suite ont échoué, valeurs précédentes affichées : {error}',
    'home.ov.partial': 'total partiel', 'home.ov.partialTip': 'Le nombre de spectateurs d’au moins une chaîne est inconnu : il n’est pas compté.',
    'home.acc.quota': 'Quota API : {used} / {limit} unités ({pct} %)',
    'home.acc.quotaTip': 'Estimation locale des unités de l’API YouTube utilisées aujourd’hui, partagées par tous les comptes YouTube de ton app. Remise à zéro à minuit, heure du Pacifique.',
    'home.links.title': 'Accès rapide',
    'home.links.chat': 'Chat unifié', 'home.links.chatDesc': 'Tous tes chats au même endroit',
    'home.links.events': 'Événements', 'home.links.eventsDesc': 'Follows, subs, dons, raids…',
    'home.links.community': 'Communauté', 'home.links.communityDesc': 'Qui est présent dans ton chat',
    'home.links.stream': 'Infos du live', 'home.links.streamDesc': 'Titre, catégorie et tags partout',
    'home.links.overlay': 'Overlay de chat', 'home.links.overlayDesc': 'Ton chat affiché sur le stream',
    'home.links.home': 'Tableau de bord',
    'home.onb.title': 'Bienvenue sur Tramevia Dock',
    'home.onb.resume': 'Termine la configuration',
    'home.onb.sub': 'Trois étapes pour tout connecter, sans connaissances techniques. Compte environ 5 minutes par plateforme.',
    'home.onb.progress': '{n} étape sur 3 terminée', 'home.onb.progress|plural': '{n} étapes sur 3 terminées',
    'home.onb.progressLabel': 'Progression de la configuration',
    'home.onb.s1': 'Créer ton app développeur',
    'home.onb.s1Desc': 'Chaque plateforme demande une « app » gratuite à ton nom. On te guide clic par clic. TikTok n’en a pas besoin.',
    'home.onb.s2': 'Connecter tes comptes',
    'home.onb.s2Desc': 'Autorise Tramevia Dock sur chacune de tes chaînes. Plusieurs comptes par plateforme, c’est possible.',
    'home.onb.s3': 'Ajouter les docks dans OBS',
    'home.onb.s3Desc': 'Copie les adresses des docks dans OBS et ajoute l’overlay de chat à ta scène.',
    'home.onb.s3Cta': 'Voir les instructions', 'home.onb.done': 'Terminé',
    'home.acc.title': 'Comptes',
    'home.acc.sub': 'Connecte une ou plusieurs chaînes par plateforme. Les statuts se mettent à jour en direct.',
    'home.acc.add': 'Ajouter un compte', 'home.acc.addAnother': 'Ajouter un autre compte',
    'home.acc.empty': 'Aucun compte {name} connecté.',
    'home.acc.appMissing': 'App à configurer', 'home.acc.appReady': 'App configurée', 'home.acc.appEnv': 'App (variables d’env.)',
    'home.acc.setup': 'Configurer l’app {name}',
    'home.acc.status.ok': 'Connecté', 'home.acc.status.needs_reconnect': 'À reconnecter', 'home.acc.status.error': 'Erreur', 'home.acc.status.disabled': 'Désactivé',
    'home.acc.needsReconnect': 'L’accès a expiré ou a été révoqué. Reconnecte ce compte.',
    'home.acc.reconnect': 'Reconnecter', 'home.acc.restart': 'Relancer la connexion', 'home.acc.options': 'Options', 'home.acc.disconnect': 'Déconnecter',
    'home.acc.restarted': 'Connexion relancée.',
    'home.acc.disconnectTitle': 'Déconnecter {name} ?',
    'home.acc.disconnectBody': 'Tramevia Dock arrêtera de lire ce chat et oubliera ses accès. Tu pourras le reconnecter quand tu veux.',
    'home.acc.disconnected': 'Compte déconnecté.', 'home.acc.connected': 'Compte connecté : {name}',
    'home.acc.waiting': 'En attente de l’autorisation dans ton navigateur…',
    'home.acc.waitingHint': 'Valide l’accès dans l’onglet qui vient de s’ouvrir. Rien ne s’est ouvert ? Ouvre ou copie le lien.',
    'home.acc.waitingExpired': 'Délai dépassé : relance la connexion.',
    'home.acc.openLink': 'Ouvrir le lien', 'home.acc.copyLink': 'Copier le lien',
    'home.acc.multi.twitch': 'Autre compte Twitch ? Twitch reprend le compte déjà ouvert sur twitch.tv : déconnecte-toi de twitch.tv dans ton navigateur (ou clique « Ce n’est pas vous ? » sur la page d’autorisation), puis ajoute-le.',
    'home.acc.multi.kick': 'Autre compte Kick ? Déconnecte-toi d’abord de kick.com dans ton navigateur, puis ajoute-le.',
    'home.acc.multi.youtube': 'Chaîne de marque ou autre compte Google ? Choisis-le dans le sélecteur de compte Google à la connexion.',
    'home.acc.why': 'Pourquoi « non officiel » ?',
    'home.unofficial.tiktok': 'TikTok ne propose pas d’API pour les lives. Tramevia Dock lit ton chat, tes cadeaux et tes spectateurs via une connexion non officielle, en lecture seule : pas d’envoi de messages ni de modération. Aucun mot de passe n’est demandé, mais cela peut cesser de fonctionner après une mise à jour de TikTok.',
    'home.unofficial.generic': 'Cette plateforme n’a pas d’API officielle pour cet usage : la connexion peut cesser de fonctionner sans préavis.',
    'home.user.label': 'Pseudo {name}', 'home.user.placeholder': '@pseudo', 'home.user.add': 'Ajouter',
    'home.user.invalid': 'Pseudo invalide : 2 à 24 lettres, chiffres, points ou _.',
    'home.user.hint': 'Juste ton pseudo, aucun mot de passe. Le chat apparaît quand tu es en live.',
    'home.user.added': 'Compte ajouté : {name}',
    'home.kick.title': 'Options Kick', 'home.kick.mode': 'Lecture du chat',
    'home.kick.auto': 'Automatique', 'home.kick.autoDesc': 'Recommandé : webhooks officiels si ton adresse publique est en HTTPS, sinon Pusher.',
    'home.kick.webhook': 'Webhooks', 'home.kick.webhookDesc': 'Officiel, nécessite une URL publique HTTPS (installation en ligne).',
    'home.kick.pusher': 'Pusher', 'home.kick.pusherDesc': 'Non officiel, fonctionne en local. Peut cesser de fonctionner sans préavis.',
    'home.kick.off': 'Désactivé', 'home.kick.offDesc': 'Pas de lecture du chat Kick. L’envoi de messages, le titre et les statistiques restent actifs.',
    'home.kick.official': 'officiel', 'home.kick.unofficial': 'non officiel',
    'home.kick.webhookUrl': 'URL du webhook à coller dans Kick',
    'home.kick.webhookHow': 'Sur kick.com → Paramètres → Développeur : modifie ton app, active « Enable Webhooks » et colle cette URL.',
    'home.kick.webhookLocal': 'Ton adresse ({url}) n’est pas une URL publique en HTTPS : Kick ne pourra pas envoyer de webhooks à ce serveur. Choisis Automatique ou Pusher.',
    'home.kick.chatroom': 'ID du chatroom (avancé)',
    'home.kick.chatroomHint': 'Laisse vide : il est trouvé automatiquement. Si le chat Pusher ne se connecte pas, ouvre ce lien et recopie le nombre « id » situé dans « chatroom ».',
    'home.kick.chatroomLink': 'Infos de ma chaîne Kick',
    'home.kick.chatroomInvalid': 'Uniquement des chiffres.',
    'home.kick.channel': 'ID de la chaîne (facultatif)',
    'home.kick.channelHint': 'Utile seulement si tu saisis l’ID du chat à la main : c’est le nombre « id » tout en haut de la même page. Il permet de recevoir le passage en live, les follows et les KICKs.',
    'home.kick.saved': 'Options enregistrées : connexion relancée.',
    'home.wiz.title': 'Configurer {name}',
    'home.wiz.intro': 'Tu vas créer une « app » développeur gratuite à ton nom sur {name}. Elle permet à Tramevia Dock de lire ton chat et de gérer ton live pour toi, sans jamais connaître ton mot de passe.',
    'home.wiz.duration': 'Environ 5 minutes',
    'home.wiz.p.saved': 'Identifiants enregistrés', 'home.wiz.p.tested': 'Test réussi', 'home.wiz.p.connected': 'Compte connecté',
    'home.wiz.envLocal': 'Installation locale : les adresses utilisent {url}. Si tu installes aussi Tramevia Dock en ligne plus tard, ajoute sa propre adresse de redirection dans la même app.',
    'home.wiz.envPublic': 'Installation en ligne : adresse publique {url}.',
    'home.wiz.envHttp': 'Ton adresse publique {url} n’est pas en HTTPS : les plateformes refusent les adresses http:// autres que localhost. Configure PUBLIC_URL avec une adresse https://.',
    'home.wiz.env127': 'Ton adresse utilise une IP (127.0.0.1) que certaines plateformes (Kick) refusent. Relance Tramevia Dock avec PUBLIC_URL=http://localhost:{port}.',
    'home.wiz.kickLocal': 'En local, Kick ne peut pas envoyer de webhooks à ton PC : le chat Kick passera par une connexion non officielle (Pusher). Les webhooks officiels demandent une installation en ligne en HTTPS.',
    'home.wiz.envLocked': 'Identifiants fournis par les variables d’environnement {vars}. Modifie-les à cet endroit puis redémarre Tramevia Dock.',
    'home.wiz.yourName': 'TonPseudo', 'home.wiz.openConsole': 'Ouvrir la console {name}', 'home.wiz.docs': 'Documentation officielle',
    'home.wiz.credsTitle': 'Colle tes identifiants ici',
    'home.wiz.secretKeep': 'Déjà enregistré : laisse vide pour le garder',
    'home.wiz.secretHint': 'Chiffré sur ce serveur et jamais réaffiché.',
    'home.wiz.save': 'Enregistrer et tester', 'home.wiz.test': 'Tester', 'home.wiz.testing': 'Test en cours…',
    'home.wiz.testOk': 'Les identifiants fonctionnent.', 'home.wiz.testFail': 'Le test a échoué : {msg}',
    'home.wiz.saved': 'Identifiants enregistrés.', 'home.wiz.connect': 'Connecter mon compte {name}',
    'home.wiz.idInvalid': 'Client ID invalide : au moins 6 caractères, sans espace.',
    'home.wiz.secretInvalid': 'Client Secret invalide : au moins 6 caractères.',
    'home.wiz.remove': 'Effacer les identifiants', 'home.wiz.removeTitle': 'Effacer les identifiants {name} ?',
    'home.wiz.removeBody': 'Les comptes {name} déjà connectés ne pourront plus renouveler leur accès tant que de nouveaux identifiants ne sont pas enregistrés.',
    'home.wiz.removed': 'Identifiants effacés.',
    'home.wiz.twitch.s1': 'Active la double authentification (2FA) sur ton compte Twitch : Twitch l’exige pour créer une app.',
    'home.wiz.twitch.s1Link': 'Sécurité Twitch',
    'home.wiz.twitch.s2': 'Ouvre la console développeur Twitch (connecte-toi si besoin) : le formulaire « Register Your Application » s’affiche.',
    'home.wiz.twitch.s3': '« Name » : un nom unique sur tout Twitch, par exemple :',
    'home.wiz.twitch.s4': '« OAuth Redirect URLs » : colle exactement cette adresse puis clique « Add ».',
    'home.wiz.twitch.s5': '« Category » : choisis « Broadcaster Suite ». « Client Type » : choisis « Confidential ». Coche « I’m not a robot » puis clique « Create ».',
    'home.wiz.twitch.s6': 'Clique « Manage » sur ton app. Copie le « Client ID », puis clique « New Secret » et copie le secret (un nouveau secret remplace l’ancien).',
    'home.wiz.kick.s1': 'Active la double authentification (2FA) sur ton compte Kick : l’onglet Développeur l’exige.',
    'home.wiz.kick.s1Link': 'Sécurité Kick',
    'home.wiz.kick.s2': 'Ouvre Kick → Paramètres → Développeur et crée une nouvelle app.',
    'home.wiz.kick.s3': 'Nom de l’app, par exemple (la description est libre) :',
    'home.wiz.kick.s4': '« Redirect URL » : colle exactement cette adresse.',
    'home.wiz.kick.s5': 'Scopes : coche ceux-ci. Ne coche jamais « streamkey:read » (Tramevia Dock n’a pas besoin de ta clé de stream).',
    'home.wiz.kick.s6Local': 'Webhooks : laisse « Enable Webhooks » désactivé (installation locale).',
    'home.wiz.kick.s6Public': 'Webhooks : active « Enable Webhooks » et colle cette URL :',
    'home.wiz.kick.s7': 'Enregistre l’app, puis copie le Client ID et le Client Secret.',
    'home.wiz.youtube.s1': 'Crée un projet Google Cloud gratuit, par exemple « Tramevia Dock ».',
    'home.wiz.youtube.s1Link': 'Créer un projet',
    'home.wiz.youtube.s2': 'Active « YouTube Data API v3 » pour ce projet (bouton « Activer »).',
    'home.wiz.youtube.s2Link': 'YouTube Data API v3',
    'home.wiz.youtube.s3': 'Google Auth Platform → « Commencer » : nom de l’app, ton e-mail, audience « Externe », e-mail de contact. N’ajoute pas de logo (cela déclencherait une vérification par Google).',
    'home.wiz.youtube.s3Link': 'Google Auth Platform',
    'home.wiz.youtube.s4': 'Clients → « Créer un client » → type « Application Web ». Dans « URI de redirection autorisés », ajoute exactement cette adresse :',
    'home.wiz.youtube.s4Link': 'Clients OAuth',
    'home.wiz.youtube.s5': 'Clique « Créer » et copie tout de suite le Client ID et le code secret : Google n’affiche le secret qu’une seule fois.',
    'home.wiz.youtube.s6': 'Audience → « Publier l’application » (ne demande pas de validation). Sinon Google te déconnecte tous les 7 jours.',
    'home.wiz.youtube.s6Link': 'Page Audience',
    'home.wiz.youtube.s7': 'À la connexion, Google affichera « Cette application n’a pas été validée » : c’est normal, c’est ta propre app. Clique « Paramètres avancés » puis « Accéder à … (non sécurisé) ».',
    'home.wiz.generic.s1': 'Ouvre la console développeur et crée une app.',
    'home.wiz.generic.s2': 'Ajoute exactement cette adresse de redirection :',
    'home.wiz.generic.s3': 'Copie le Client ID et le Client Secret.',
    'home.obs.title': 'Ajouter à OBS',
    'home.obs.sub': 'Les docks s’affichent dans la fenêtre d’OBS, l’overlay apparaît sur ton stream.',
    'home.obs.docks': 'Docks OBS',
    'home.obs.s1': 'Dans OBS, ouvre le menu « Docks » → « Docks de navigateur personnalisés… ».',
    'home.obs.s2': 'Pour chaque dock : saisis un nom, colle l’adresse copiée ci-dessous, puis clique « Appliquer ».',
    'home.obs.s3': 'Place les docks où tu veux dans OBS : ils se mettent à jour tout seuls.',
    'home.obs.keyWarn': 'Ces adresses contiennent ta clé d’accès complète (masquée à l’écran). Ne les montre pas en live ; en cas de fuite, régénère la clé dans Paramètres → Sécurité.',
    'home.obs.masked': 'Clé masquée : utilise le bouton Copier',
    'home.obs.done': 'J’ai ajouté mes docks', 'home.obs.doneState': 'Docks ajoutés', 'home.obs.doneToast': 'Parfait, tout est prêt !',
    'home.ovl.title': 'Overlay de chat',
    'home.ovl.sub': 'Affiche ton chat sur le stream. Tes réglages sont enregistrés ici et s’appliquent en direct.',
    'home.ovl.scene': ' (la taille de ta scène)',
    'home.ovl.how': 'Dans OBS : Sources → + → Navigateur → colle l’adresse, largeur {w}, hauteur {h}{scene}. Chaque overlay a sa propre adresse : une source Navigateur pour chacun. Colle-la une seule fois, ensuite tes changements s’appliquent en direct. Une ancienne adresse qui contient des réglages marche toujours, mais ne suit plus le tableau de bord.',
    'home.ovl.readonly': 'Cette adresse utilise la clé overlay, en lecture seule : elle ne permet aucune action sur tes comptes.',
    'home.ovl.mode': 'Overlay à régler', 'home.ovl.mode.chat': 'Chat', 'home.ovl.mode.featured': 'Message mis en avant', 'home.ovl.mode.alerts': 'Alertes', 'home.ovl.mode.viewers': 'Spectateurs',
    'home.ovl.hint.chat': 'Affiche les messages de tes chats.', 'home.ovl.hint.featured': 'Affiche seulement le message que tu mets en avant depuis le dock Chat.',
    'home.ovl.hint.alerts': 'Affiche chaque follow, sub, don ou raid à l’écran, une alerte à la fois, sur toutes tes plateformes.',
    'home.ovl.hint.viewers': 'Affiche le total de tes spectateurs en direct, toutes plateformes confondues : chaque hausse s’anime en vert (+x), chaque baisse en rouge (−x).',
    'home.ovl.number': 'Nombre', 'home.ovl.number.left': 'À gauche', 'home.ovl.number.center': 'Au centre', 'home.ovl.number.right': 'À droite',
    'home.ovl.testViewers': 'Tester une variation', 'home.ovl.testedViewers': 'Variation de test envoyée : le total change quelques secondes dans l’aperçu et ta source OBS, puis revient.',
    'home.ovl.alertSeconds': 'Durée de chaque alerte (s)', 'home.ovl.position': 'Position', 'home.ovl.position.top': 'Haut', 'home.ovl.position.center': 'Milieu', 'home.ovl.position.bottom': 'Bas',
    'home.ovl.types': 'Alertes affichées', 'home.ovl.type.follow': 'Follows', 'home.ovl.type.sub': 'Subs et membres', 'home.ovl.type.giftsub': 'Subs offerts',
    'home.ovl.type.tip': 'Bits, KICKs, Super Chats, cadeaux', 'home.ovl.type.raid': 'Raids', 'home.ovl.type.redemption': 'Récompenses de points', 'home.ovl.type.like': 'J’aime TikTok', 'home.ovl.type.share': 'Partages TikTok',
    'home.ovl.test': 'Envoyer une alerte de test', 'home.ovl.tested': 'Alerte de test envoyée : regarde l’aperçu et ta source OBS.',
    'home.ovl.style': 'Style', 'home.ovl.style.card': 'Carte', 'home.ovl.style.text': 'Grand texte', 'home.ovl.style.impact': 'Impact', 'home.ovl.style.eclipse': 'Éclipse', 'home.ovl.style.glass': 'Verre', 'home.ovl.style.switch': 'Interrupteur', 'home.ovl.style.wave': 'Vague', 'home.ovl.style.prism': 'Prisme', 'home.ovl.style.silk': 'Soie', 'home.ovl.style.neon': 'Néon', 'home.ovl.volume': 'Volume du son (0 = muet)',
    'home.ovl.theme': 'Thème', 'home.ovl.theme.dark': 'Sombre', 'home.ovl.theme.light': 'Clair', 'home.ovl.theme.transparent': 'Transparent',
    'home.ovl.themeHint.transparent': 'Texte seul, posé directement sur ta scène. Active « Bulles » ou « Contour du texte » si ton fond est chargé.',
    'home.ovl.themeHint.dark': 'Chaque message dans une carte sombre, avec la couleur de sa plateforme : lisible sur n’importe quel fond.',
    'home.ovl.themeHint.light': 'Chaque message dans une carte claire à texte foncé, avec la couleur de sa plateforme.',
    'home.ovl.max': 'Messages max', 'home.ovl.fade': 'Disparition (s, 0 = jamais)', 'home.ovl.size': 'Taille du texte (px)',
    'home.ovl.featureSeconds': 'Durée (s, 0 = jusqu’au retrait)',
    'home.ovl.align': 'Alignement', 'home.ovl.align.left': 'Gauche', 'home.ovl.align.right': 'Droite',
    'home.ovl.display': 'Affichage', 'home.ovl.filters': 'Filtres', 'home.ovl.platforms': 'Plateformes', 'home.ovl.accounts': 'Comptes',
    'home.ovl.hideBots': 'Masquer les bots', 'home.ovl.hideCommands': 'Masquer les !commandes', 'home.ovl.badges': 'Badges',
    'home.ovl.icons': 'Icônes des plateformes', 'home.ovl.avatars': 'Avatars', 'home.ovl.bubble': 'Bulles', 'home.ovl.outline': 'Contour du texte', 'home.ovl.credit': 'Petite mention « Chat via Tramevia Dock » (merci 💜)',
    'home.ovl.events': 'Événements (follows, subs…)',
    'home.ovl.url': 'Adresse de l’overlay « {name} »', 'home.ovl.preview': 'Aperçu en direct', 'home.ovl.saved': 'Enregistré · appliqué en direct',
    'home.ovl.previewHint': 'Le damier représente la transparence.', 'home.ovl.previewTitle': 'Aperçu de l’overlay de chat',
    'home.ovl.reset': 'Réinitialiser',
    'home.set.title': 'Paramètres', 'home.set.appearance': 'Apparence',
    'home.set.langDesc': 'Langue de l’interface.', 'home.set.themeDesc': 'Sombre conseillé dans OBS.',
    'home.set.dark': 'Sombre', 'home.set.light': 'Clair', 'home.set.auto': 'Auto',
    'home.am.title': 'Filtres automatiques',
    'home.am.desc': 'Un message filtré est masqué dans les docks et sur l’overlay, et supprimé sur la plateforme quand elle le permet. Toi et tes modérateurs n’êtes jamais filtrés.',
    'home.am.words': 'Mots interdits', 'home.am.wordsPlaceholder': 'Un mot ou une expression par ligne',
    'home.am.wordsHint': 'Mots entiers, sans tenir compte des majuscules ni des accents : « cretin » bloque aussi « Crétin », mais « con » ne bloque pas « contenu ».',
    'home.am.links': 'Bloquer les liens', 'home.am.linksDesc': 'Adresses web, y compris sans « https:// » (bit.ly/…, site.com).',
    'home.am.allowed': 'Liens autorisés', 'home.am.allowedHint': 'Un site par ligne. youtube.com autorise aussi www.youtube.com et m.youtube.com.',
    'home.am.action': 'Action', 'home.am.actionDesc': 'Ce qui se passe sur la plateforme.',
    'home.am.delete': 'Supprimer le message', 'home.am.timeout': 'Supprimer et exclure',
    'home.am.duration': 'Durée de l’exclusion', 'home.am.1m': '1 min', 'home.am.10m': '10 min', 'home.am.1h': '1 h', 'home.am.24h': '24 h',
    'home.am.vip': 'Ne pas filtrer les VIP', 'home.am.vipDesc': 'Les VIP de Twitch et Kick, et les meilleurs donateurs du live TikTok.',
    'home.am.sub': 'Ne pas filtrer les abonnés', 'home.am.subDesc': 'Abonnés Twitch, Kick et TikTok, et membres de la chaîne YouTube.',
    'home.am.spam': 'Anti-spam',
    'home.am.caps': 'Trop de majuscules', 'home.am.capsDesc': 'Au moins 15 lettres, dont 70 % en majuscules.',
    'home.am.repeat': 'Message répété', 'home.am.repeatDesc': 'La même personne envoie le même message 3 fois en 1 minute : la 3e copie et les suivantes sont filtrées.',
    'home.am.emotes': 'Flood d’émotes', 'home.am.emotesDesc': 'Plus de 10 émotes ou emojis dans un message.',
    'home.am.symbols': 'Flood de symboles', 'home.am.symbolsDesc': 'Au moins 15 symboles, plus de la moitié du message (!!!!!, ░▒▓…).',
    'home.nav.live': 'Live',
    'home.live.title': 'Outils du live', 'home.live.sub': 'Sondage, objectifs, commandes et Discord, sur toutes tes plateformes à la fois.',
    'home.sum.current': 'Live en cours', 'home.sum.last': 'Dernier live', 'home.sum.since': 'depuis {d}', 'home.sum.when': '{date} · {d}',
    'home.sum.peak': 'Pic de spectateurs', 'home.sum.messages': 'Messages', 'home.sum.chatters': 'Personnes dans le chat',
    'home.sum.follows': 'follows', 'home.sum.subs': 'abonnements', 'home.sum.top': 'Les plus actifs',
    'home.poll.title': 'Sondage',
    'home.poll.desc': 'Tes spectateurs votent en tapant 1, 2… dans n’importe quel chat, TikTok compris. Une voix par personne. À l’écran avec l’overlay Sondage (section OBS).',
    'home.poll.question': 'Question', 'home.poll.questionPh': 'On joue à quoi après ?', 'home.poll.option': 'Réponse {n}',
    'home.poll.add': 'Ajouter une réponse', 'home.poll.remove': 'Retirer la réponse {n}', 'home.poll.duration': 'Durée',
    'home.poll.announce': 'Annoncer dans les chats',
    'home.poll.announceDesc': 'La question au début et le résultat à la fin, dans chaque chat en live qui accepte les messages (pas TikTok). Sur YouTube, chaque message coûte 50 unités de quota.',
    'home.poll.start': 'Lancer le sondage', 'home.poll.end': 'Terminer maintenant', 'home.poll.new': 'Nouveau sondage',
    'home.poll.left': 'encore {d}', 'home.poll.closed': 'Terminé', 'home.poll.votes': '{n} vote', 'home.poll.votes|plural': '{n} votes',
    'home.poll.s': '{n} s', 'home.poll.min': '{n} min',
    'home.goal.title': 'Objectifs',
    'home.goal.desc': 'Comptés sur toutes tes plateformes depuis que tu as fixé l’objectif. À l’écran avec l’overlay Objectif (section OBS).',
    'home.goal.follows': 'Follows', 'home.goal.followsDesc': 'Twitch, Kick et TikTok.',
    'home.goal.subs': 'Abonnements', 'home.goal.subsDesc': 'Subs Twitch et Kick (un sub offert compte pour un), membres YouTube, abonnés TikTok.',
    'home.goal.label': 'Titre affiché', 'home.goal.target': 'Objectif', 'home.goal.count': 'Compteur', 'home.goal.reset': 'Remettre à zéro',
    'home.goal.resetTitle': 'Remettre ce compteur à zéro ?', 'home.goal.resetBody': 'Le compteur repart de 0. L’objectif et son titre ne changent pas.',
    'home.goal.labelPh.follows': 'Objectif follows', 'home.goal.labelPh.subs': 'Objectif abonnés',
    'home.bot.title': 'Commandes et rappels', 'home.bot.desc': 'Réponses automatiques aux !commandes et messages réguliers, envoyés depuis tes comptes connectés.',
    'home.bot.commands': 'Commandes', 'home.bot.name': 'Commande', 'home.bot.text': 'Réponse', 'home.bot.namePh': 'discord',
    'home.bot.textPh': 'Rejoins le Discord : https://discord.gg/…', 'home.bot.addCommand': 'Ajouter une commande',
    'home.bot.cmdHint': 'La réponse part dans le chat où la commande a été tapée, au plus une fois toutes les 30 secondes. {user} = le nom de la personne.',
    'home.bot.timers': 'Rappels', 'home.bot.timerPh': 'Pense à suivre la chaîne 💜', 'home.bot.every': 'Fréquence', 'home.bot.addTimer': 'Ajouter un rappel',
    'home.bot.timerHint': 'Envoyés partout en même temps pendant le live, et seulement dans les chats où quelqu’un a écrit depuis le rappel précédent.',
    'home.bot.channels': 'Comptes qui répondent', 'home.bot.remove': 'Supprimer', 'home.bot.noSend': 'Aucun compte connecté ne peut envoyer de message.',
    'home.bot.quota': 'YouTube : chaque message coûte 50 unités de quota, sur 10 000 par jour. Un rappel toutes les 15 minutes pendant 4 h = 16 messages = 800 unités.',
    'home.dc.title': 'Discord',
    'home.dc.desc': 'Un message dans ton salon Discord quand ton live commence, avec le lien de chaque chaîne en live, et le résumé quand il se termine.',
    'home.dc.webhook': 'Adresse du webhook', 'home.dc.how': 'Dans Discord : Modifier le salon → Intégrations → Webhooks → Nouveau webhook → Copier l’URL du webhook.',
    'home.dc.save': 'Enregistrer', 'home.dc.linked': 'Webhook relié ({hint})', 'home.dc.test': 'Envoyer un test', 'home.dc.remove': 'Retirer',
    'home.dc.tested': 'Message de test envoyé : regarde ton salon Discord.', 'home.dc.saved': 'Webhook enregistré.',
    'home.dc.announce': 'Annoncer le début du live', 'home.dc.announceDesc': 'Une minute après le début, le temps que le titre arrive. Pas si Tramevia Dock démarre en plein live.',
    'home.dc.summary': 'Publier le résumé à la fin', 'home.dc.summaryDesc': 'Durée, pic de spectateurs, follows et abonnements par plateforme, les plus actifs du chat. Cinq minutes après la fin.',
    'home.dc.message': 'Message d’annonce', 'home.dc.messagePh': '🔴 {name} est en live : {title}',
    'home.dc.messageHint': '{name} = ta chaîne, {title} = le titre du live, {category} = la catégorie. @everyone et les mentions de rôles marchent.',
    'home.ovl.mode.poll': 'Sondage', 'home.ovl.mode.goal': 'Objectif',
    'home.ovl.hint.poll': 'Affiche le sondage en cours et ses votes en direct, puis le résultat pendant 15 secondes. Lance-le depuis la section Live.',
    'home.ovl.hint.goal': 'Affiche la progression de ton objectif de follows ou d’abonnements, toutes plateformes confondues. Règle-le depuis la section Live.',
    'home.ovl.goal': 'Objectif affiché', 'home.ovl.goal.subs': 'Abonnements', 'home.ovl.goal.follows': 'Follows', 'home.ovl.goal.both': 'Les deux',
    'home.ovl.look': 'Style', 'home.ovl.look.bars': 'Barres', 'home.ovl.look.ring': 'Anneau',
    'home.ovl.color': 'Couleur', 'home.ovl.color.tramevia': 'Dégradé Tramevia', 'home.ovl.color.custom': 'Couleur libre',
    'home.ovl.icon.subs': 'Icône abonnements', 'home.ovl.icon.follows': 'Icône follows',
    'home.ovl.ic.star': 'Étoile', 'home.ovl.ic.heart': 'Cœur', 'home.ovl.ic.user-plus': 'Nouvel abonné', 'home.ovl.ic.users': 'Communauté', 'home.ovl.ic.trophy': 'Trophée', 'home.ovl.ic.crown': 'Couronne', 'home.ovl.ic.award': 'Médaille', 'home.ovl.ic.flag': 'Drapeau', 'home.ovl.ic.target': 'Cible', 'home.ovl.ic.rocket': 'Fusée', 'home.ovl.ic.zap': 'Éclair', 'home.ovl.ic.flame': 'Flamme', 'home.ovl.ic.gem': 'Diamant', 'home.ovl.ic.sparkles': 'Étincelles', 'home.ovl.ic.gamepad': 'Manette', 'home.ovl.ic.music': 'Musique', 'home.ovl.ic.coffee': 'Café', 'home.ovl.ic.gift': 'Cadeau',
    'home.ovl.testPoll': 'Tester un sondage', 'home.ovl.testedPoll': 'Sondage de test envoyé : il se joue dans l’aperçu et ta source OBS, sans rien compter.',
    'home.ovl.testGoal': 'Tester une progression', 'home.ovl.testedGoal': 'Progression de test envoyée : la barre avance quelques secondes dans l’aperçu et ta source OBS, puis revient.',
    'home.sec.title': 'Sécurité',
    'home.sec.local': 'Mode local sans mot de passe : le tableau de bord n’est accessible que depuis cet ordinateur.',
    'home.sec.password': 'Accès protégé par mot de passe (ADMIN_PASSWORD).',
    'home.sec.dock': 'Clé des docks', 'home.sec.dockDesc': 'Accès complet, incluse dans les adresses des docks OBS.',
    'home.sec.overlay': 'Clé de l’overlay', 'home.sec.overlayDesc': 'Lecture seule, incluse dans l’adresse de l’overlay.',
    'home.sec.sessions': 'Sessions', 'home.sec.sessionsDesc': 'Déconnecte tous les navigateurs connectés avec le mot de passe.',
    'home.sec.sessionsLocal': 'Sans objet en mode local (aucun mot de passe).',
    'home.sec.rotate': 'Régénérer', 'home.sec.signOut': 'Tout déconnecter',
    'home.sec.dockTitle': 'Régénérer la clé des docks ?',
    'home.sec.dockBody': 'L’ancienne clé ne donnera plus accès : recopie les nouvelles adresses des docks depuis la section OBS. (Sans mot de passe, les docks ouverts sur ce PC continuent de marcher ; ce sont les autres appareils qui sont coupés.)',
    'home.sec.overlayTitle': 'Régénérer la clé de l’overlay ?',
    'home.sec.overlayBody': 'Les anciennes adresses des overlays ne donneront plus accès : recopie les nouvelles dans tes sources Navigateur d’OBS (Chat et Message mis en avant).',
    'home.sec.sessionsTitle': 'Déconnecter toutes les sessions ?',
    'home.sec.sessionsBody': 'Tous les navigateurs, y compris celui-ci, devront ressaisir le mot de passe. Les docks OBS (clé) ne sont pas concernés.',
    'home.sec.rotated': 'Nouvelle clé générée : mets à jour les adresses dans OBS.',
    'home.sec.signedOut': 'Toutes les sessions ont été déconnectées.',
    'home.about.title': 'À propos', 'home.about.version': 'Version {v}',
    'home.about.desc': 'Logiciel libre et auto-hébergé : tes identifiants restent sur ton serveur.',
    'home.about.repo': 'Code source sur GitHub', 'home.about.docs': 'Documentation', 'home.about.issues': 'Signaler un problème',
    'home.sup.title': 'Soutenir Tramevia Dock', 'home.sup.desc': 'Tramevia Dock est gratuit et le restera. En le soutenant sur Buy Me a Coffee, tu reçois un code soutien : il débloque les styles d’alertes réservés aux soutiens.',
    'home.sup.code': 'Code soutien', 'home.sup.activate': 'Activer', 'home.sup.remove': 'Retirer le code',
    'home.sup.active': 'Code soutien actif. Merci {name} !', 'home.sup.activeUntil': 'Code soutien actif jusqu’au {date}. Merci {name} !',
    'home.sup.expired': 'Ton code soutien a expiré le {date}.', 'home.sup.ok': 'Code activé : les styles réservés aux soutiens sont débloqués.', 'home.sup.removed': 'Code soutien retiré.',
    'home.sup.pack.ok': 'Styles soutiens téléchargés (version {v}).', 'home.sup.pack.offline': 'Serveur Tramevia injoignable : les styles soutiens se téléchargeront au prochain essai (au démarrage, puis chaque jour).',
    'home.sup.pack.refused': 'Le serveur Tramevia refuse ce code (expiré ou révoqué) : les styles soutiens ne sont pas téléchargés.', 'home.sup.pack.outdated': 'Mets Tramevia Dock à jour pour télécharger les styles soutiens.',
    'home.sup.pack.none': 'Téléchargement des styles soutiens désactivé sur ce dock (PREMIUM_URL).',
    'home.ovl.early': '{styles} sont réservés aux soutiens.',
    'home.ovl.locked': '{style} est réservé aux soutiens. Ajoute ton code soutien dans Paramètres → À propos.',
    'home.upd.upToDate': 'à jour', 'home.upd.availableShort': 'mise à jour {v} disponible',
    'home.upd.checked': 'dernière vérification {ago}', 'home.upd.never': 'pas encore vérifiée',
    'home.upd.check': 'Vérifier maintenant', 'home.upd.upToDateToast': 'Tramevia Dock est à jour.',
    'home.upd.disabledEnv': 'Les vérifications de mises à jour sont désactivées (UPDATE_CHECK=0).',
    'home.upd.autoCheck': 'Vérifier les mises à jour automatiquement', 'home.upd.autoCheckDesc': 'Une fois par jour, auprès de GitHub.',
    'home.upd.autoInstall': 'Installer les mises à jour automatiquement quand aucun compte n’est en live',
    'home.upd.autoInstallDesc': 'Jamais pendant un live, ni pour une version qui a déjà échoué. Tramevia Dock redémarre alors une dizaine de secondes.',
    'home.upd.title': 'Tramevia Dock {v} est disponible.',
    'home.upd.notes': 'Nouveautés', 'home.upd.download': 'Page de la version',
    'home.upd.install': 'Installer maintenant', 'home.upd.afterLive': 'Disponible après ton live',
    'home.upd.confirmTitle': 'Installer Tramevia Dock {v} ?',
    'home.upd.confirmBody': 'Tramevia Dock redémarre pendant une dizaine de secondes, puis tes docks OBS se reconnectent tout seuls. Tes données et tes réglages sont conservés.',
    'home.upd.unknownTitle': 'Statut du live inconnu',
    'home.upd.unknownBody': 'Impossible de savoir si tu es en live sur {names}. Installer quand même ? (redémarrage d’environ 10 s)',
    'home.upd.someAccount': 'un de tes comptes', 'home.upd.installAnyway': 'Installer quand même',
    'home.upd.installing': 'Installation de {v}… Tramevia Dock redémarre dans quelques secondes. Tes docks OBS se reconnectent tout seuls.',
    'home.upd.error': 'La mise à jour a échoué : {reason}. Rien n’a été modifié.',
    'home.upd.failed': 'La version {v} n’a pas démarré et a été annulée. Tes données sont comme avant la mise à jour.',
    'home.upd.report': 'Signaler le problème',
    'home.upd.docker': 'Lance cette commande dans le dossier de ton compose.yaml :',
    'home.upd.dockerMajor': 'Nouvelle version majeure : dans compose.yaml, remplace la ligne image par celle-ci, puis lance la commande.',
    'home.upd.railway': 'Railway l’installe tout seul si les mises à jour automatiques sont activées : Service → Settings → Source → Configure Auto Updates (« Minor updates and patches »). Sinon, remplace l’image au même endroit par :',
    'home.upd.railwayMajor': 'Nouvelle version majeure : Railway ne l’installe jamais tout seul. Dans Service → Settings → Source, remplace l’image par :',
    'home.upd.git': 'Dans le dossier de Tramevia Dock, lance cette commande, puis redémarre Tramevia Dock (start.bat ou start.sh) :',
    'home.upd.manual': 'Télécharge le nouveau zip sur la page de la version et remplace tes fichiers. Garde ton dossier data et ton fichier .env.',
  },
  en: {
    'home.nav.label': 'Dashboard sections',
    'home.nav.overview': 'Overview', 'home.nav.accounts': 'Accounts', 'home.nav.obs': 'OBS', 'home.nav.settings': 'Settings',
    'home.loadError': 'Could not load the dashboard.',
    'home.hello.morning': 'Good morning', 'home.hello.afternoon': 'Good afternoon', 'home.hello.evening': 'Good evening',
    'home.hello.sub': 'Here is how your streams are doing, live.',
    'home.ov.total': 'Total viewers',
    'home.ov.liveCount': '{n} account live out of {total}', 'home.ov.liveCount|plural': '{n} accounts live out of {total}',
    'home.ov.channels': 'Your channels', 'home.ov.manage': 'Manage', 'home.ov.since': 'for {d}',
    'home.ov.waiting': 'Waiting for stats…', 'home.ov.statsError': 'Stats unavailable',
    'home.ov.stale': 'The last update failed, showing earlier values: {error}',
    'home.ov.stale|plural': '{n} updates in a row failed, showing earlier values: {error}',
    'home.ov.partial': 'partial total', 'home.ov.partialTip': 'At least one channel’s viewer count is unknown and is not counted.',
    'home.acc.quota': 'API quota: {used} / {limit} units ({pct}%)',
    'home.acc.quotaTip': 'Local estimate of the YouTube API units used today, shared by every YouTube account of your app. Resets at midnight Pacific time.',
    'home.links.title': 'Quick access',
    'home.links.chat': 'Unified chat', 'home.links.chatDesc': 'All your chats in one place',
    'home.links.events': 'Events', 'home.links.eventsDesc': 'Follows, subs, tips, raids…',
    'home.links.community': 'Community', 'home.links.communityDesc': 'Who is in your chat',
    'home.links.stream': 'Stream info', 'home.links.streamDesc': 'Title, category and tags everywhere',
    'home.links.overlay': 'Chat overlay', 'home.links.overlayDesc': 'Your chat shown on stream',
    'home.links.home': 'Dashboard',
    'home.onb.title': 'Welcome to Tramevia Dock',
    'home.onb.resume': 'Finish the setup',
    'home.onb.sub': 'Three steps to connect everything, no technical knowledge needed. About 5 minutes per platform.',
    'home.onb.progress': '{n} of 3 steps done', 'home.onb.progress|plural': '{n} of 3 steps done',
    'home.onb.progressLabel': 'Setup progress',
    'home.onb.s1': 'Create your developer app',
    'home.onb.s1Desc': 'Each platform needs a free "app" in your name. We guide you click by click. TikTok doesn’t need one.',
    'home.onb.s2': 'Connect your accounts',
    'home.onb.s2Desc': 'Authorize Tramevia Dock on each of your channels. Several accounts per platform are fine.',
    'home.onb.s3': 'Add the docks to OBS',
    'home.onb.s3Desc': 'Paste the dock addresses into OBS and add the chat overlay to your scene.',
    'home.onb.s3Cta': 'Show instructions', 'home.onb.done': 'Done',
    'home.acc.title': 'Accounts',
    'home.acc.sub': 'Connect one or more channels per platform. Statuses update live.',
    'home.acc.add': 'Add an account', 'home.acc.addAnother': 'Add another account',
    'home.acc.empty': 'No {name} account connected.',
    'home.acc.appMissing': 'App not set up', 'home.acc.appReady': 'App ready', 'home.acc.appEnv': 'App (env variables)',
    'home.acc.setup': 'Set up the {name} app',
    'home.acc.status.ok': 'Connected', 'home.acc.status.needs_reconnect': 'Reconnect needed', 'home.acc.status.error': 'Error', 'home.acc.status.disabled': 'Disabled',
    'home.acc.needsReconnect': 'Access expired or was revoked. Reconnect this account.',
    'home.acc.reconnect': 'Reconnect', 'home.acc.restart': 'Restart connection', 'home.acc.options': 'Options', 'home.acc.disconnect': 'Disconnect',
    'home.acc.restarted': 'Connection restarted.',
    'home.acc.disconnectTitle': 'Disconnect {name}?',
    'home.acc.disconnectBody': 'Tramevia Dock will stop reading this chat and forget its access. You can reconnect it any time.',
    'home.acc.disconnected': 'Account disconnected.', 'home.acc.connected': 'Account connected: {name}',
    'home.acc.waiting': 'Waiting for authorization in your browser…',
    'home.acc.waitingHint': 'Approve access in the tab that just opened. Nothing opened? Open or copy the link.',
    'home.acc.waitingExpired': 'Timed out: start the connection again.',
    'home.acc.openLink': 'Open link', 'home.acc.copyLink': 'Copy link',
    'home.acc.multi.twitch': 'Another Twitch account? Twitch reuses the account already signed in on twitch.tv: log out of twitch.tv in your browser (or click "Not you?" on the authorization page), then add it.',
    'home.acc.multi.kick': 'Another Kick account? Log out of kick.com in your browser first, then add it.',
    'home.acc.multi.youtube': 'Brand channel or another Google account? Pick it in the Google account chooser when connecting.',
    'home.acc.why': 'Why "unofficial"?',
    'home.unofficial.tiktok': 'TikTok has no API for live streams. Tramevia Dock reads your chat, gifts and viewers through an unofficial, read-only connection: no sending messages, no moderation. No password is asked, but it may stop working after a TikTok update.',
    'home.unofficial.generic': 'This platform has no official API for this: the connection may stop working without notice.',
    'home.user.label': '{name} username', 'home.user.placeholder': '@username', 'home.user.add': 'Add',
    'home.user.invalid': 'Invalid username: 2 to 24 letters, digits, dots or _.',
    'home.user.hint': 'Just your username, no password. Chat shows up when you are live.',
    'home.user.added': 'Account added: {name}',
    'home.kick.title': 'Kick options', 'home.kick.mode': 'Chat reading',
    'home.kick.auto': 'Automatic', 'home.kick.autoDesc': 'Recommended: official webhooks when your public address is HTTPS, Pusher otherwise.',
    'home.kick.webhook': 'Webhooks', 'home.kick.webhookDesc': 'Official, needs a public HTTPS URL (online install).',
    'home.kick.pusher': 'Pusher', 'home.kick.pusherDesc': 'Unofficial, works locally. May stop working without notice.',
    'home.kick.off': 'Off', 'home.kick.offDesc': 'Kick chat is not read. Sending messages, title and stats keep working.',
    'home.kick.official': 'official', 'home.kick.unofficial': 'unofficial',
    'home.kick.webhookUrl': 'Webhook URL to paste in Kick',
    'home.kick.webhookHow': 'On kick.com → Settings → Developer: edit your app, turn on "Enable Webhooks" and paste this URL.',
    'home.kick.webhookLocal': 'Your address ({url}) is not a public HTTPS URL: Kick cannot deliver webhooks to this server. Pick Automatic or Pusher.',
    'home.kick.chatroom': 'Chatroom ID (advanced)',
    'home.kick.chatroomHint': 'Leave empty: it is found automatically. If Pusher chat does not connect, open this link and copy the "id" number inside "chatroom".',
    'home.kick.chatroomLink': 'My Kick channel info',
    'home.kick.chatroomInvalid': 'Digits only.',
    'home.kick.channel': 'Channel ID (optional)',
    'home.kick.channelHint': 'Only needed if you enter the chatroom ID by hand: it is the top-level "id" number on the same page. It enables live/offline, follows and KICKs.',
    'home.kick.saved': 'Options saved: connection restarted.',
    'home.wiz.title': 'Set up {name}',
    'home.wiz.intro': 'You are going to create a free developer "app" in your name on {name}. It lets Tramevia Dock read your chat and manage your stream for you, without ever knowing your password.',
    'home.wiz.duration': 'About 5 minutes',
    'home.wiz.p.saved': 'Credentials saved', 'home.wiz.p.tested': 'Test passed', 'home.wiz.p.connected': 'Account connected',
    'home.wiz.envLocal': 'Local install: addresses use {url}. If you also install Tramevia Dock online later, add its own redirect address to the same app.',
    'home.wiz.envPublic': 'Online install: public address {url}.',
    'home.wiz.envHttp': 'Your public address {url} is not HTTPS: platforms reject http:// addresses other than localhost. Set PUBLIC_URL to an https:// address.',
    'home.wiz.env127': 'Your address uses an IP (127.0.0.1) that some platforms (Kick) reject. Restart Tramevia Dock with PUBLIC_URL=http://localhost:{port}.',
    'home.wiz.kickLocal': 'Locally, Kick cannot send webhooks to your PC: Kick chat will use an unofficial connection (Pusher). Official webhooks need an online HTTPS install.',
    'home.wiz.envLocked': 'Credentials come from the environment variables {vars}. Change them there and restart Tramevia Dock.',
    'home.wiz.yourName': 'YourName', 'home.wiz.openConsole': 'Open the {name} console', 'home.wiz.docs': 'Official documentation',
    'home.wiz.credsTitle': 'Paste your credentials here',
    'home.wiz.secretKeep': 'Already saved: leave empty to keep it',
    'home.wiz.secretHint': 'Encrypted on this server and never shown again.',
    'home.wiz.save': 'Save and test', 'home.wiz.test': 'Test', 'home.wiz.testing': 'Testing…',
    'home.wiz.testOk': 'The credentials work.', 'home.wiz.testFail': 'The test failed: {msg}',
    'home.wiz.saved': 'Credentials saved.', 'home.wiz.connect': 'Connect my {name} account',
    'home.wiz.idInvalid': 'Invalid Client ID: at least 6 characters, no spaces.',
    'home.wiz.secretInvalid': 'Invalid Client Secret: at least 6 characters.',
    'home.wiz.remove': 'Remove credentials', 'home.wiz.removeTitle': 'Remove the {name} credentials?',
    'home.wiz.removeBody': 'Connected {name} accounts will not be able to renew their access until new credentials are saved.',
    'home.wiz.removed': 'Credentials removed.',
    'home.wiz.twitch.s1': 'Turn on two-factor authentication (2FA) on your Twitch account: Twitch requires it to create an app.',
    'home.wiz.twitch.s1Link': 'Twitch security',
    'home.wiz.twitch.s2': 'Open the Twitch developer console (sign in if needed): the "Register Your Application" form shows up.',
    'home.wiz.twitch.s3': '"Name": a name unique across Twitch, for example:',
    'home.wiz.twitch.s4': '"OAuth Redirect URLs": paste exactly this address, then click "Add".',
    'home.wiz.twitch.s5': '"Category": pick "Broadcaster Suite". "Client Type": pick "Confidential". Tick "I’m not a robot", then click "Create".',
    'home.wiz.twitch.s6': 'Click "Manage" on your app. Copy the "Client ID", then click "New Secret" and copy the secret (a new secret replaces the old one).',
    'home.wiz.kick.s1': 'Turn on two-factor authentication (2FA) on your Kick account: the Developer tab requires it.',
    'home.wiz.kick.s1Link': 'Kick security',
    'home.wiz.kick.s2': 'Open Kick → Settings → Developer and create a new app.',
    'home.wiz.kick.s3': 'App name, for example (description is up to you):',
    'home.wiz.kick.s4': '"Redirect URL": paste exactly this address.',
    'home.wiz.kick.s5': 'Scopes: tick these. Never tick "streamkey:read" (Tramevia Dock does not need your stream key).',
    'home.wiz.kick.s6Local': 'Webhooks: leave "Enable Webhooks" off (local install).',
    'home.wiz.kick.s6Public': 'Webhooks: turn on "Enable Webhooks" and paste this URL:',
    'home.wiz.kick.s7': 'Save the app, then copy the Client ID and Client Secret.',
    'home.wiz.youtube.s1': 'Create a free Google Cloud project, for example "Tramevia Dock".',
    'home.wiz.youtube.s1Link': 'Create a project',
    'home.wiz.youtube.s2': 'Enable "YouTube Data API v3" for this project ("Enable" button).',
    'home.wiz.youtube.s2Link': 'YouTube Data API v3',
    'home.wiz.youtube.s3': 'Google Auth Platform → "Get started": app name, your email, audience "External", contact email. Do not upload a logo (it would trigger a Google verification).',
    'home.wiz.youtube.s3Link': 'Google Auth Platform',
    'home.wiz.youtube.s4': 'Clients → "Create client" → type "Web application". Under "Authorized redirect URIs", add exactly this address:',
    'home.wiz.youtube.s4Link': 'OAuth clients',
    'home.wiz.youtube.s5': 'Click "Create" and copy the Client ID and client secret right away: Google shows the secret only once.',
    'home.wiz.youtube.s6': 'Audience → "Publish app" (do not submit for verification). Otherwise Google signs you out every 7 days.',
    'home.wiz.youtube.s6Link': 'Audience page',
    'home.wiz.youtube.s7': 'When connecting, Google will show "Google hasn’t verified this app": that is expected, it is your own app. Click "Advanced", then "Go to … (unsafe)".',
    'home.wiz.generic.s1': 'Open the developer console and create an app.',
    'home.wiz.generic.s2': 'Add exactly this redirect address:',
    'home.wiz.generic.s3': 'Copy the Client ID and Client Secret.',
    'home.obs.title': 'Add to OBS',
    'home.obs.sub': 'Docks show up in the OBS window, the overlay shows up on your stream.',
    'home.obs.docks': 'OBS docks',
    'home.obs.s1': 'In OBS, open the "Docks" menu → "Custom Browser Docks…".',
    'home.obs.s2': 'For each dock: type a name, paste the address copied below, then click "Apply".',
    'home.obs.s3': 'Place the docks wherever you like in OBS: they update by themselves.',
    'home.obs.keyWarn': 'These addresses contain your full access key (hidden on screen). Do not show them on stream; if one leaks, regenerate the key in Settings → Security.',
    'home.obs.masked': 'Key hidden: use the Copy button',
    'home.obs.done': 'I added my docks', 'home.obs.doneState': 'Docks added', 'home.obs.doneToast': 'Great, you are all set!',
    'home.ovl.title': 'Chat overlay',
    'home.ovl.sub': 'Shows your chat on stream. Your settings are saved here and apply live.',
    'home.ovl.scene': ' (your scene size)',
    'home.ovl.how': 'In OBS: Sources → + → Browser → paste the address, width {w}, height {h}{scene}. Each overlay has its own address: one Browser source for each. Paste it once, then your changes apply live. An older address that carries settings keeps working but no longer follows the dashboard.',
    'home.ovl.readonly': 'This address uses the read-only overlay key: it cannot act on your accounts.',
    'home.ovl.mode': 'Overlay to edit', 'home.ovl.mode.chat': 'Chat', 'home.ovl.mode.featured': 'Featured message', 'home.ovl.mode.alerts': 'Alerts', 'home.ovl.mode.viewers': 'Viewers',
    'home.ovl.hint.chat': 'Shows the messages from your chats.', 'home.ovl.hint.featured': 'Shows only the message you feature from the Chat dock.',
    'home.ovl.hint.alerts': 'Shows every follow, sub, tip or raid on screen, one alert at a time, from all your platforms.',
    'home.ovl.hint.viewers': 'Shows your total live viewers across all platforms: every rise animates in green (+x), every drop in red (−x).',
    'home.ovl.number': 'Number', 'home.ovl.number.left': 'Left', 'home.ovl.number.center': 'Centre', 'home.ovl.number.right': 'Right',
    'home.ovl.testViewers': 'Test a change', 'home.ovl.testedViewers': 'Test change sent: the total changes for a few seconds in the preview and your OBS source, then comes back.',
    'home.ovl.alertSeconds': 'Duration of each alert (s)', 'home.ovl.position': 'Position', 'home.ovl.position.top': 'Top', 'home.ovl.position.center': 'Middle', 'home.ovl.position.bottom': 'Bottom',
    'home.ovl.types': 'Alerts shown', 'home.ovl.type.follow': 'Follows', 'home.ovl.type.sub': 'Subs and members', 'home.ovl.type.giftsub': 'Gifted subs',
    'home.ovl.type.tip': 'Bits, KICKs, Super Chats, gifts', 'home.ovl.type.raid': 'Raids', 'home.ovl.type.redemption': 'Channel point rewards', 'home.ovl.type.like': 'TikTok likes', 'home.ovl.type.share': 'TikTok shares',
    'home.ovl.test': 'Send a test alert', 'home.ovl.tested': 'Test alert sent: watch the preview and your OBS source.',
    'home.ovl.style': 'Style', 'home.ovl.style.card': 'Card', 'home.ovl.style.text': 'Big text', 'home.ovl.style.impact': 'Impact', 'home.ovl.style.eclipse': 'Eclipse', 'home.ovl.style.glass': 'Glass', 'home.ovl.style.switch': 'Switch', 'home.ovl.style.wave': 'Wave', 'home.ovl.style.prism': 'Prism', 'home.ovl.style.silk': 'Silk', 'home.ovl.style.neon': 'Neon', 'home.ovl.volume': 'Sound volume (0 = off)',
    'home.ovl.theme': 'Theme', 'home.ovl.theme.dark': 'Dark', 'home.ovl.theme.light': 'Light', 'home.ovl.theme.transparent': 'Transparent',
    'home.ovl.themeHint.transparent': 'Text only, right on top of your scene. Turn on "Bubbles" or "Text outline" if your background is busy.',
    'home.ovl.themeHint.dark': 'Each message on a dark card with its platform colour: readable on any background.',
    'home.ovl.themeHint.light': 'Each message on a light card with dark text and its platform colour.',
    'home.ovl.max': 'Max messages', 'home.ovl.fade': 'Fade out (s, 0 = never)', 'home.ovl.size': 'Text size (px)',
    'home.ovl.featureSeconds': 'Duration (s, 0 = until removed)',
    'home.ovl.align': 'Alignment', 'home.ovl.align.left': 'Left', 'home.ovl.align.right': 'Right',
    'home.ovl.display': 'Display', 'home.ovl.filters': 'Filters', 'home.ovl.platforms': 'Platforms', 'home.ovl.accounts': 'Accounts',
    'home.ovl.hideBots': 'Hide bots', 'home.ovl.hideCommands': 'Hide !commands', 'home.ovl.badges': 'Badges',
    'home.ovl.icons': 'Platform icons', 'home.ovl.avatars': 'Avatars', 'home.ovl.bubble': 'Bubbles', 'home.ovl.outline': 'Text outline', 'home.ovl.credit': 'Small “Chat via Tramevia Dock” credit (thank you 💜)',
    'home.ovl.events': 'Events (follows, subs…)',
    'home.ovl.url': '“{name}” overlay address', 'home.ovl.preview': 'Live preview', 'home.ovl.saved': 'Saved · applied live',
    'home.ovl.previewHint': 'The checkerboard shows transparency.', 'home.ovl.previewTitle': 'Chat overlay preview',
    'home.ovl.reset': 'Reset',
    'home.set.title': 'Settings', 'home.set.appearance': 'Appearance',
    'home.set.langDesc': 'Interface language.', 'home.set.themeDesc': 'Dark recommended in OBS.',
    'home.set.dark': 'Dark', 'home.set.light': 'Light', 'home.set.auto': 'Auto',
    'home.am.title': 'Auto filters',
    'home.am.desc': 'A filtered message is hidden in the docks and on the overlay, and deleted on the platform when it allows it. You and your moderators are never filtered.',
    'home.am.words': 'Banned words', 'home.am.wordsPlaceholder': 'One word or phrase per line',
    'home.am.wordsHint': 'Whole words, ignoring case and accents: "cafe" also blocks "Café", but "ass" does not block "class".',
    'home.am.links': 'Block links', 'home.am.linksDesc': 'Web addresses, even without "https://" (bit.ly/…, site.com).',
    'home.am.allowed': 'Allowed links', 'home.am.allowedHint': 'One site per line. youtube.com also allows www.youtube.com and m.youtube.com.',
    'home.am.action': 'Action', 'home.am.actionDesc': 'What happens on the platform.',
    'home.am.delete': 'Delete the message', 'home.am.timeout': 'Delete and time out',
    'home.am.duration': 'Timeout length', 'home.am.1m': '1 min', 'home.am.10m': '10 min', 'home.am.1h': '1 h', 'home.am.24h': '24 h',
    'home.am.vip': 'Don’t filter VIPs', 'home.am.vipDesc': 'Twitch and Kick VIPs, and the top gifters of a TikTok LIVE.',
    'home.am.sub': 'Don’t filter subscribers', 'home.am.subDesc': 'Twitch, Kick and TikTok subscribers, and YouTube channel members.',
    'home.am.spam': 'Anti-spam',
    'home.am.caps': 'Too many capitals', 'home.am.capsDesc': 'At least 15 letters, 70 % of them capitals.',
    'home.am.repeat': 'Repeated message', 'home.am.repeatDesc': 'The same person sends the same message 3 times within a minute: the 3rd copy and the next ones are filtered.',
    'home.am.emotes': 'Emote flood', 'home.am.emotesDesc': 'More than 10 emotes or emoji in one message.',
    'home.am.symbols': 'Symbol flood', 'home.am.symbolsDesc': 'At least 15 symbols, over half of the message (!!!!!, ░▒▓…).',
    'home.nav.live': 'Live',
    'home.live.title': 'Live tools', 'home.live.sub': 'Poll, goals, commands and Discord, on all your platforms at once.',
    'home.sum.current': 'Live now', 'home.sum.last': 'Last stream', 'home.sum.since': 'for {d}', 'home.sum.when': '{date} · {d}',
    'home.sum.peak': 'Peak viewers', 'home.sum.messages': 'Messages', 'home.sum.chatters': 'People in chat',
    'home.sum.follows': 'follows', 'home.sum.subs': 'subs', 'home.sum.top': 'Most active',
    'home.poll.title': 'Poll',
    'home.poll.desc': 'Viewers vote by typing 1, 2… in any chat, TikTok included. One vote per person. On screen with the Poll overlay (OBS section).',
    'home.poll.question': 'Question', 'home.poll.questionPh': 'What do we play next?', 'home.poll.option': 'Answer {n}',
    'home.poll.add': 'Add an answer', 'home.poll.remove': 'Remove answer {n}', 'home.poll.duration': 'Duration',
    'home.poll.announce': 'Announce in the chats',
    'home.poll.announceDesc': 'The question at the start and the result at the end, in every live chat that accepts messages (not TikTok). On YouTube, each message costs 50 quota units.',
    'home.poll.start': 'Start the poll', 'home.poll.end': 'End now', 'home.poll.new': 'New poll',
    'home.poll.left': '{d} left', 'home.poll.closed': 'Ended', 'home.poll.votes': '{n} vote', 'home.poll.votes|plural': '{n} votes',
    'home.poll.s': '{n}s', 'home.poll.min': '{n} min',
    'home.goal.title': 'Goals',
    'home.goal.desc': 'Counted on all your platforms since you set the goal. On screen with the Goal overlay (OBS section).',
    'home.goal.follows': 'Follows', 'home.goal.followsDesc': 'Twitch, Kick and TikTok.',
    'home.goal.subs': 'Subs', 'home.goal.subsDesc': 'Twitch and Kick subs (a gifted sub counts as one), YouTube members, TikTok subscribers.',
    'home.goal.label': 'Title shown', 'home.goal.target': 'Goal', 'home.goal.count': 'Count', 'home.goal.reset': 'Reset to zero',
    'home.goal.resetTitle': 'Reset this count to zero?', 'home.goal.resetBody': 'The count starts again from 0. The goal and its title stay.',
    'home.goal.labelPh.follows': 'Follower goal', 'home.goal.labelPh.subs': 'Sub goal',
    'home.bot.title': 'Commands and reminders', 'home.bot.desc': 'Automatic answers to !commands and regular messages, sent from your connected accounts.',
    'home.bot.commands': 'Commands', 'home.bot.name': 'Command', 'home.bot.text': 'Answer', 'home.bot.namePh': 'discord',
    'home.bot.textPh': 'Join the Discord: https://discord.gg/…', 'home.bot.addCommand': 'Add a command',
    'home.bot.cmdHint': 'The answer goes to the chat the command was typed in, at most once every 30 seconds. {user} = the person’s name.',
    'home.bot.timers': 'Reminders', 'home.bot.timerPh': 'Remember to follow the channel 💜', 'home.bot.every': 'How often', 'home.bot.addTimer': 'Add a reminder',
    'home.bot.timerHint': 'Sent everywhere at once during the stream, and only to chats where someone wrote since the previous reminder.',
    'home.bot.channels': 'Accounts that answer', 'home.bot.remove': 'Delete', 'home.bot.noSend': 'No connected account can send messages.',
    'home.bot.quota': 'YouTube: each message costs 50 quota units, out of 10,000 a day. One reminder every 15 minutes for 4 hours = 16 messages = 800 units.',
    'home.dc.title': 'Discord',
    'home.dc.desc': 'A message in your Discord channel when your stream starts, with the link of every live channel, and the recap when it ends.',
    'home.dc.webhook': 'Webhook address', 'home.dc.how': 'In Discord: Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL.',
    'home.dc.save': 'Save', 'home.dc.linked': 'Webhook connected ({hint})', 'home.dc.test': 'Send a test', 'home.dc.remove': 'Remove',
    'home.dc.tested': 'Test message sent: check your Discord channel.', 'home.dc.saved': 'Webhook saved.',
    'home.dc.announce': 'Announce when the stream starts', 'home.dc.announceDesc': 'One minute after the start, so the title is in. Not when Tramevia Dock starts during a stream.',
    'home.dc.summary': 'Post the recap at the end', 'home.dc.summaryDesc': 'Duration, peak viewers, follows and subs per platform, the most active chatters. Five minutes after the end.',
    'home.dc.message': 'Announcement message', 'home.dc.messagePh': '🔴 {name} is live: {title}',
    'home.dc.messageHint': '{name} = your channel, {title} = the stream title, {category} = the category. @everyone and role mentions work.',
    'home.ovl.mode.poll': 'Poll', 'home.ovl.mode.goal': 'Goal',
    'home.ovl.hint.poll': 'Shows the running poll and its votes live, then the result for 15 seconds. Start it from the Live section.',
    'home.ovl.hint.goal': 'Shows the progress of your follower or sub goal, all platforms together. Set it from the Live section.',
    'home.ovl.goal': 'Goal shown', 'home.ovl.goal.subs': 'Subs', 'home.ovl.goal.follows': 'Follows', 'home.ovl.goal.both': 'Both',
    'home.ovl.look': 'Style', 'home.ovl.look.bars': 'Bars', 'home.ovl.look.ring': 'Ring',
    'home.ovl.color': 'Colour', 'home.ovl.color.tramevia': 'Tramevia gradient', 'home.ovl.color.custom': 'Custom colour',
    'home.ovl.icon.subs': 'Sub icon', 'home.ovl.icon.follows': 'Follower icon',
    'home.ovl.ic.star': 'Star', 'home.ovl.ic.heart': 'Heart', 'home.ovl.ic.user-plus': 'New follower', 'home.ovl.ic.users': 'Community', 'home.ovl.ic.trophy': 'Trophy', 'home.ovl.ic.crown': 'Crown', 'home.ovl.ic.award': 'Medal', 'home.ovl.ic.flag': 'Flag', 'home.ovl.ic.target': 'Target', 'home.ovl.ic.rocket': 'Rocket', 'home.ovl.ic.zap': 'Lightning', 'home.ovl.ic.flame': 'Flame', 'home.ovl.ic.gem': 'Diamond', 'home.ovl.ic.sparkles': 'Sparkles', 'home.ovl.ic.gamepad': 'Gamepad', 'home.ovl.ic.music': 'Music', 'home.ovl.ic.coffee': 'Coffee', 'home.ovl.ic.gift': 'Gift',
    'home.ovl.testPoll': 'Test a poll', 'home.ovl.testedPoll': 'Test poll sent: it plays in the preview and your OBS source, without counting anything.',
    'home.ovl.testGoal': 'Test progress', 'home.ovl.testedGoal': 'Test progress sent: the bar moves for a few seconds in the preview and your OBS source, then comes back.',
    'home.sec.title': 'Security',
    'home.sec.local': 'Local mode without password: the dashboard is only reachable from this computer.',
    'home.sec.password': 'Access protected by a password (ADMIN_PASSWORD).',
    'home.sec.dock': 'Dock key', 'home.sec.dockDesc': 'Full access, part of the OBS dock addresses.',
    'home.sec.overlay': 'Overlay key', 'home.sec.overlayDesc': 'Read-only, part of the overlay address.',
    'home.sec.sessions': 'Sessions', 'home.sec.sessionsDesc': 'Signs out every browser logged in with the password.',
    'home.sec.sessionsLocal': 'Not applicable in local mode (no password).',
    'home.sec.rotate': 'Regenerate', 'home.sec.signOut': 'Sign out everywhere',
    'home.sec.dockTitle': 'Regenerate the dock key?',
    'home.sec.dockBody': 'The old key will no longer grant access: copy the new dock addresses from the OBS section. (Without a password, docks opened on this PC keep working; other devices are cut off.)',
    'home.sec.overlayTitle': 'Regenerate the overlay key?',
    'home.sec.overlayBody': 'The old overlay addresses will no longer grant access: copy the new ones into your OBS Browser sources (Chat and Featured message).',
    'home.sec.sessionsTitle': 'Sign out all sessions?',
    'home.sec.sessionsBody': 'Every browser, including this one, will have to enter the password again. OBS docks (key) are not affected.',
    'home.sec.rotated': 'New key generated: update the addresses in OBS.',
    'home.sec.signedOut': 'All sessions were signed out.',
    'home.about.title': 'About', 'home.about.version': 'Version {v}',
    'home.about.desc': 'Free and self-hosted software: your credentials stay on your server.',
    'home.about.repo': 'Source code on GitHub', 'home.about.docs': 'Documentation', 'home.about.issues': 'Report a problem',
    'home.sup.title': 'Support Tramevia Dock', 'home.sup.desc': 'Tramevia Dock is free and will stay free. Support it on Buy Me a Coffee and you get a supporter code: it unlocks the supporter-only alert styles.',
    'home.sup.code': 'Supporter code', 'home.sup.activate': 'Activate', 'home.sup.remove': 'Remove the code',
    'home.sup.active': 'Supporter code active. Thank you {name}!', 'home.sup.activeUntil': 'Supporter code active until {date}. Thank you {name}!',
    'home.sup.expired': 'Your supporter code expired on {date}.', 'home.sup.ok': 'Code activated: supporter styles are unlocked.', 'home.sup.removed': 'Supporter code removed.',
    'home.sup.pack.ok': 'Supporter styles downloaded (version {v}).', 'home.sup.pack.offline': 'Tramevia server unreachable: the supporter styles will download on the next try (at start, then every day).',
    'home.sup.pack.refused': 'The Tramevia server refuses this code (expired or revoked): the supporter styles are not downloaded.', 'home.sup.pack.outdated': 'Update Tramevia Dock to download the supporter styles.',
    'home.sup.pack.none': 'Supporter styles download turned off on this dock (PREMIUM_URL).',
    'home.ovl.early': '{styles} are for supporters.',
    'home.ovl.locked': '{style} is for supporters. Add your supporter code in Settings → About.',
    'home.upd.upToDate': 'up to date', 'home.upd.availableShort': 'update {v} available',
    'home.upd.checked': 'last checked {ago}', 'home.upd.never': 'not checked yet',
    'home.upd.check': 'Check now', 'home.upd.upToDateToast': 'Tramevia Dock is up to date.',
    'home.upd.disabledEnv': 'Update checks are disabled (UPDATE_CHECK=0).',
    'home.upd.autoCheck': 'Check for updates automatically', 'home.upd.autoCheckDesc': 'Once a day, from GitHub.',
    'home.upd.autoInstall': 'Install updates automatically when no account is live',
    'home.upd.autoInstallDesc': 'Never during a live, never a version that already failed. Tramevia Dock then restarts for about 10 seconds.',
    'home.upd.title': 'Tramevia Dock {v} is available.',
    'home.upd.notes': 'What’s new', 'home.upd.download': 'Release page',
    'home.upd.install': 'Install now', 'home.upd.afterLive': 'Available after your live',
    'home.upd.confirmTitle': 'Install Tramevia Dock {v}?',
    'home.upd.confirmBody': 'Tramevia Dock restarts for about 10 seconds, then your OBS docks reconnect by themselves. Your data and settings are kept.',
    'home.upd.unknownTitle': 'Live status unknown',
    'home.upd.unknownBody': 'We can’t tell whether you’re live on {names}. Install anyway? (about 10 s restart)',
    'home.upd.someAccount': 'one of your accounts', 'home.upd.installAnyway': 'Install anyway',
    'home.upd.installing': 'Installing {v}… Tramevia Dock restarts in a few seconds. Your OBS docks reconnect by themselves.',
    'home.upd.error': 'Update failed: {reason}. Nothing was changed.',
    'home.upd.failed': '{v} didn’t start and was rolled back. Your data is as it was before the update.',
    'home.upd.report': 'Report the problem',
    'home.upd.docker': 'Run this command in the folder of your compose.yaml:',
    'home.upd.dockerMajor': 'New major version: in compose.yaml, replace the image line with this one, then run the command.',
    'home.upd.railway': 'Railway installs it by itself if Auto Updates are on: Service → Settings → Source → Configure Auto Updates ("Minor updates and patches"). Otherwise, change the image in the same place to:',
    'home.upd.railwayMajor': 'New major version: Railway never installs it by itself. In Service → Settings → Source, change the image to:',
    'home.upd.git': 'In the Tramevia Dock folder, run this command, then restart Tramevia Dock (start.bat or start.sh):',
    'home.upd.manual': 'Download the new zip from the release page and replace your files. Keep your data folder and your .env file.',
  },
});

const REPO = 'https://github.com/Tramevia/Tramevia-Dock';
const KICK_SCOPES = ['user:read', 'channel:read', 'channel:write', 'chat:write', 'events:subscribe', 'moderation:ban', 'moderation:chat_message:manage', 'kicks:read'];
const SECTIONS = [['overview', 'home'], ['live', 'radio'], ['accounts', 'users'], ['obs', 'monitor'], ['settings', 'settings']];
const DOCKS = [['chat', '/chat', 'chat'], ['events', '/events', 'zap'], ['community', '/community', 'users'], ['stream', '/stream', 'edit'], ['home', '/', 'home']];
const AUTH_TIMEOUT = 600_000; // server forgets the OAuth state after 10 min

const S = { state: null, accounts: [], apps: null, keys: null, session: null, ui: {}, pending: {}, update: null, bot: null, discord: null, live: null };
const el = {};
const forms = {}; // username forms survive re-renders (keeps typed text)
let ovId = 'chat'; // saved overlay shown in the builder
const ovSync = {}; // per overlay: debounce timer, writes in flight, last write time
let spy = null;

// ---------------------------------------------------------------- helpers
const platform = id => S.state.platforms.find(p => p.id === id);
const appOf = id => S.apps.find(a => a.platform === id);
const hostOf = url => new URL(url).hostname;
const isLocalUrl = url => ['localhost', '127.0.0.1', '[::1]'].includes(hostOf(url));
const extLink = (href, ...children) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...children);
const linkBtn = (href, label) => h('a.btn.sm', { href, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external'));
const BANNER_ICON = { ok: 'check', info: 'info', warn: 'alert', danger: 'alert' };
const banner = (kind, ...children) => h(`div.banner.${kind}.small`, icon(BANNER_ICON[kind]), h('div.banner-text', ...children));

/**
 * Keyboard focus survives re-renders (same pattern as community.js): controls carry data-focus keys; when the
 * focused one is replaced, its new copy gets focus, else the card's add control (`pf-x:…` → `pf-x:add`).
 */
function refocus(key) {
  const active = document.activeElement;
  if (!key || (active && active !== document.body)) return;
  for (const k of [key, `${key.split(':')[0]}:add`]) {
    const next = document.querySelector(`[data-focus="${CSS.escape(k)}"]`);
    if (next && !next.disabled) { next.focus(); return; }
  }
}
function keepFocus(render) {
  const was = document.activeElement;
  const key = was?.dataset?.focus;
  render();
  if (key && document.activeElement !== was) refocus(key);
}

function sectionHead(ic, title, sub) {
  return h('div.section-head', h('h2', icon(ic, 18), title), sub && h('p.muted', sub));
}

function avatar(a) {
  const fallback = () => h(`span.avatar.avatar-fallback.pf-${a.platform}`, { attrs: { 'aria-hidden': 'true' } }, (a.displayName || a.login || '?').slice(0, 1).toUpperCase());
  if (!/^https:\/\//.test(a.avatar || '')) return fallback();
  const img = h('img.avatar', { src: a.avatar, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

/** Copy field that hides the ?key= value on screen (streamers share their screen) but copies the full URL. */
function secretField(url, focus) {
  return h('div.copy-field', h('code', { title: t('home.obs.masked') }, url.replace(/([?&]key=)[^&]+/, '$1••••••••')),
    h('button.btn.sm', { type: 'button', dataset: focus && { focus }, onclick: () => copy(url) }, icon('copy'), t('common.copy')));
}

function segmented(label, options, current, onPick, focus) {
  const group = h('div.segmented', { attrs: { role: 'group', 'aria-label': label } },
    options.map(([value, text]) => h('button', {
      type: 'button', dataset: focus && { focus: `${focus}:${value}` }, attrs: { 'aria-pressed': String(value === current) },
      onclick: e => {
        for (const b of group.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onPick(value);
      },
    }, text)));
  return group;
}

function setError(input, box, message) {
  box.textContent = message;
  if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
}

/** Small modal with a header, scrollable body and action bar. Removed from the DOM on close. */
function modal(title, body, actions, wide = false) {
  const id = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const opener = document.activeElement?.dataset?.focus; // re-rendered while open (accounts frame): refocus its copy
  const dlg = h(`dialog.home-dialog${wide ? '.wide' : ''}`, { attrs: { 'aria-labelledby': id } },
    h('header.dialog-head', h('h2', { id }, title),
      h('button.icon-btn', { type: 'button', title: t('common.close'), attrs: { 'aria-label': t('common.close') }, onclick: () => dlg.close() }, icon('x'))),
    h('div.dialog-body', body),
    actions && h('div.dialog-actions', actions));
  dlg.addEventListener('close', () => { dlg.remove(); refocus(opener); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

/** Merge a patch into the server UI settings. Writes are serialized (read-modify-write) and our own
 *  echo frames are ignored meanwhile, so quick successive clicks cannot undo each other. */
let uiQueue = Promise.resolve();
let uiWrites = 0;
let uiLastWrite = 0;
function saveUi(patch) {
  S.ui = { ...S.ui, ...patch };
  uiWrites++;
  window.__odUiWriteAt = Date.now(); // lets core.js ignore the echo of our own PUT (quick FR/EN toggles)
  uiQueue = uiQueue.then(async () => {
    try {
      const current = await api('/api/settings');
      S.ui = await api('/api/settings', { method: 'PUT', body: { ...current, ...patch } });
      return true;
    } catch (err) { toast(err.message, 'error', 6000); return false; } finally { uiWrites--; uiLastWrite = window.__odUiWriteAt = Date.now(); }
  });
  return uiQueue;
}

async function refreshApps() {
  S.apps = await api('/api/apps');
  renderOverview();
  renderAccounts();
}

const goTo = id => document.getElementById(id)?.scrollIntoView({ block: 'start' });

// ---------------------------------------------------------------- page
function render() {
  spy?.disconnect();
  const nav = h('nav.home-nav', { attrs: { 'aria-label': t('home.nav.label') } },
    SECTIONS.map(([id, ic]) => h('a', { href: `#${id}`, title: t(`home.nav.${id}`), attrs: { 'aria-label': t(`home.nav.${id}`) }, dataset: { target: id } }, icon(ic), h('span', t(`home.nav.${id}`)))));
  for (const [id] of SECTIONS) el[id] = h('section.home-section', { id, attrs: { 'aria-label': t(`home.nav.${id}`) } });
  el.root.replaceChildren(h('div.home', nav, h('div.home-main', SECTIONS.map(([id]) => el[id]))));
  renderOverview();
  renderLive();
  renderAccounts();
  renderObs();
  renderSettings();
  // Scroll spy: highlight the section in view.
  spy = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of nav.children) a.setAttribute('aria-current', String(a.dataset.target === entry.target.id));
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  for (const [id] of SECTIONS) spy.observe(el[id]);
  nav.firstChild.setAttribute('aria-current', 'true');
}

function skeleton() {
  return h('div.home', h('div'), h('div.home-main', { attrs: { 'aria-busy': 'true', 'aria-label': t('common.loading') } },
    h('div.stack', h('div.skeleton.sk-title'), h('div.skeleton.sk-line')),
    h('div.ov-grid', h('div.skeleton.sk-card'), h('div.skeleton.sk-card')),
    h('div.pf-grid', [1, 2, 3, 4].map(() => h('div.skeleton.sk-card')))));
}

// ---------------------------------------------------------------- 1. overview
function onboardingSteps() {
  return [
    S.apps.some(a => a.configured) || S.accounts.length > 0,
    S.accounts.length > 0,
    Boolean(S.ui.obsDocks),
  ];
}

function onboarding(hero) {
  const done = onboardingSteps();
  const count = done.filter(Boolean).length;
  const current = done.indexOf(false);
  const oauth = S.state.platforms.filter(p => p.auth === 'oauth');
  const steps = [
    ['s1', h('div.row', oauth.map(p => h('button.btn.sm', { type: 'button', dataset: { focus: `onb:${p.id}` }, onclick: () => openWizard(p.id) }, platformIcon(p.id), p.name)))],
    ['s2', h('button.btn.sm', { type: 'button', dataset: { focus: 'onb:add' }, onclick: () => goTo('accounts') }, icon('plus'), t('home.acc.add'))],
    ['s3', h('button.btn.sm', { type: 'button', dataset: { focus: 'onb:obs' }, onclick: () => goTo('obs') }, icon('monitor'), t('home.onb.s3Cta'))],
  ];
  return h(`div.card.onb${hero ? '.hero' : ''}`,
    h('div.onb-head', hero && h('img', { src: '/assets/logo-3d.webp', alt: '' }),
      h('div.stack.tight', hero ? h('h1', t('home.onb.title')) : h('h2', t('home.onb.resume')), h('p.muted', t('home.onb.sub')))),
    h('div.stack.tight',
      h('div.progress', { attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '3', 'aria-valuenow': String(count), 'aria-label': t('home.onb.progressLabel') } },
        h('span', { style: { '--p': `${(count / 3) * 100}%` } })),
      h('span.small.muted', t('home.onb.progress', { n: count }))),
    h('ol.onb-steps', steps.map(([key, cta], i) => h(`li.onb-step${done[i] ? '.done' : ''}${i === current ? '.current' : ''}`,
      h('span.step-num', { attrs: { 'aria-hidden': 'true' } }, done[i] ? icon('check', 14) : String(i + 1)),
      h('div.stack.tight',
        h('h3', t(`home.onb.${key}`), done[i] && h('span.sr-only', ` (${t('home.onb.done')})`)),
        h('p.small.muted', t(`home.onb.${key}Desc`)),
        !done[i] && cta)))));
}

function greeting() {
  const hour = new Date().getHours();
  const part = hour >= 18 || hour < 5 ? 'evening' : hour < 12 ? 'morning' : 'afternoon';
  const name = S.accounts[0]?.displayName;
  return h('div.ov-hero', h('h1', name ? `${t(`home.hello.${part}`)}, ${name}` : t(`home.hello.${part}`)), h('p.muted', t('home.hello.sub')));
}

function liveBadge(a) {
  const s = a.stats;
  if (!s || s.live === undefined) {
    if (s?.error) return h('span.badge.warn', { title: s.error }, t('home.ov.statsError'));
    return (a.status || 'ok') === 'ok' ? h('span.skeleton.sk-badge', { attrs: { role: 'img', 'aria-label': t('home.ov.waiting') } }) : null;
  }
  const badge = !s.live ? h('span.badge', t('common.offlineStream'))
    : h('span.live-stat', h('span.badge.live', t('common.live')),
      h('span.viewers', { title: t('common.viewers') }, icon('eye', 14), fmt.number(s.viewers ?? null)));
  if (!s.error) return badge;
  // Last poll failed: the values shown are older ones (SPEC §5 stats freshness).
  const tip = t('home.ov.stale', { n: s.fails || 1, error: s.error });
  return h('span.stale', { title: tip }, badge, h('span.sr-only', ` (${tip})`));
}

/** True when an account's viewer count is unknown (stats failing, or live without a count). */
const viewersUnknown = s => Boolean(s && ((s.live === undefined && s.error) || (s.live && !Number.isFinite(s.viewers))));

/** YouTube quota meter (stats.quota, shared by every account of the Google project). */
function quotaMeter(a) {
  const q = a.stats?.quota;
  if (!q || !(q.limit > 0) || !Number.isFinite(q.used)) return null;
  const pct = Math.min(100, Math.round((q.used / q.limit) * 100));
  const tone = pct >= 95 ? '.danger' : pct >= 80 ? '.warn' : '';
  return h(`div.quota${tone}`, { title: t('home.acc.quotaTip') },
    h('div.progress', { attrs: { 'aria-hidden': 'true' } }, h('span', { style: { '--p': `${pct}%` } })),
    h('span.tiny', t('home.acc.quota', { used: q.used.toLocaleString(lang()), limit: q.limit.toLocaleString(lang()), pct })));
}

function liveMeta(a) {
  const s = a.stats;
  if (!s?.live) return `@${a.login}`;
  return [s.category, s.startedAt && t('home.ov.since', { d: fmt.duration(Date.now() - s.startedAt) }), s.title].filter(Boolean).join(' · ');
}

/** Patch live badges / totals in place (stats frames are frequent; avoid re-rendering). */
function paintStats() {
  const byId = new Map(S.accounts.map(a => [a.id, a]));
  for (const node of $$('[data-live]')) { const a = byId.get(node.dataset.live); if (a) node.replaceChildren(liveBadge(a) || ''); }
  for (const node of $$('[data-meta]')) { const a = byId.get(node.dataset.meta); if (a) node.textContent = liveMeta(a); }
  for (const node of $$('[data-quota]')) { const a = byId.get(node.dataset.quota); if (a) node.replaceChildren(quotaMeter(a) || ''); }
  const live = S.accounts.filter(a => a.stats?.live);
  const partial = S.accounts.some(a => viewersUnknown(a.stats)); // unknown counts are flagged, never silently summed as 0
  const total = $('#ov-total');
  if (total) {
    total.textContent = fmt.number(live.reduce((sum, a) => sum + (Number.isFinite(a.stats.viewers) ? a.stats.viewers : 0), 0));
    total.classList.toggle('partial', partial);
    total.title = partial ? t('home.ov.partialTip') : '';
  }
  const count = $('#ov-count');
  if (count) count.textContent = [t('home.ov.liveCount', { n: live.length, total: S.accounts.length }), partial && t('home.ov.partial')].filter(Boolean).join(' · ');
  // Share of the audience per platform: one bar, one legend line per platform.
  const split = $('#ov-split');
  if (split) {
    const by = new Map();
    for (const a of live) if (a.stats.viewers > 0) by.set(a.platform, (by.get(a.platform) || 0) + a.stats.viewers);
    const parts = [...by].sort((x, y) => y[1] - x[1]);
    const name = id => S.state.platforms.find(p => p.id === id)?.name || id;
    split.replaceChildren(...(parts.length ? [
      h('div.ov-bar', { attrs: { 'aria-hidden': 'true' } }, parts.map(([pf, n]) => h(`span.pf-${pf}`, { style: { 'flex-grow': String(n) } }))),
      h('ul.ov-legend', parts.map(([pf, n]) => h(`li.pf-${pf}`, h('span.ov-dot'), h('span.ellipsis', name(pf)), h('strong', fmt.number(n))))),
    ] : []));
  }
}

function renderOverview() {
  const box = el.overview;
  if (!box) return;
  const allDone = onboardingSteps().every(Boolean);
  if (!S.accounts.length) {
    keepFocus(() => box.replaceChildren(updateNotice('home') || '', onboarding(true), quickLinks()));
    return;
  }
  keepFocus(() => box.replaceChildren(
    updateNotice('home') || '',
    greeting(),
    allDone ? '' : onboarding(false), // replaceChildren() would print a `false`
    h('div.ov-grid',
      h('div.card.ov-total',
        h('div.stack.tight',
          h('span.section-title', t('home.ov.total')),
          h('span.ov-total-num', { id: 'ov-total' }, '—'),
          h('span.small.muted', { id: 'ov-count' })),
        h('div.ov-split', { id: 'ov-split' })),
      h('div.card.flush.ov-live',
        h('div.ov-live-head', h('h3', t('home.ov.channels')), h('a.btn.ghost.sm', { href: '#accounts', dataset: { focus: 'ov:manage' } }, t('home.ov.manage'))),
        h('ul.ov-list', S.accounts.map(a => h(`li.ov-row.pf-${a.platform}`,
          platformIcon(a.platform),
          h('div.ov-row-main', h('div.ellipsis.strong', a.displayName), h('div.small.muted.ellipsis', { dataset: { meta: a.id } })),
          statusBadge(a, true),
          h('div.ov-row-stat', { dataset: { live: a.id } })))))),
    el.summary = h('div.card.sum-card', { attrs: { 'aria-live': 'off' } }),
    quickLinks()));
  paintStats();
  paintSummary();
}

function quickLinks() {
  const links = [
    ['chat', '/chat', 'chat'], ['events', '/events', 'zap'], ['community', '/community', 'users'],
    ['stream', '/stream', 'edit'], ['overlay', '#obs-overlay', 'layers'],
  ];
  return h('div.stack',
    h('h3.section-title', t('home.links.title')),
    h('div.qlinks', links.map(([k, href, ic]) => h('a.qlink', { href: href.startsWith('#') ? href : withKey(href), dataset: { focus: `ql:${k}` } },
      h('span.qlink-icon', icon(ic, 18)),
      h('span.stack.tight', h('strong', t(`home.links.${k}`)), h('span.small.muted', t(`home.links.${k}Desc`)))))));
}

/** Overview card: the stream running now, else the last one (hidden before the first stream). Repainted by 'live' frames. */
function paintSummary() {
  const box = el.summary;
  if (!box) return;
  const cur = S.live?.current;
  const s = cur || S.live?.last;
  box.hidden = !s;
  if (!s) return box.replaceChildren();
  const d = fmt.duration((cur ? Date.now() : s.endedAt) - s.startedAt);
  const when = cur ? t('home.sum.since', { d })
    : t('home.sum.when', { date: new Date(s.startedAt).toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long' }), d });
  const stat = (label, value) => h('div.sum-stat', h('strong', value), h('span.small.muted', label));
  box.replaceChildren(...[
    h('div.sum-head', h('h3.card-title', icon('chart'), t(cur ? 'home.sum.current' : 'home.sum.last')), cur && h('span.badge.live', t('common.live')), h('span.small.muted', when)),
    h('div.sum-stats', stat(t('home.sum.peak'), fmt.number(s.peak)), stat(t('home.sum.messages'), fmt.number(s.messages)), stat(t('home.sum.chatters'), fmt.number(s.chatters))),
    s.platforms.length > 0 && h('ul.sum-pf', s.platforms.map(p => h(`li.pf-${p.platform}`, platformIcon(p.platform), h('span.ellipsis', platform(p.platform)?.name || p.platform),
      h('span.small.muted', `${fmt.number(p.follows)} ${t('home.sum.follows')} · ${fmt.number(p.subs)} ${t('home.sum.subs')}`)))),
    s.top.length > 0 && h('div.stack.tight', h('span.label', t('home.sum.top')),
      h('ol.sum-top', s.top.map(c => h('li', platformIcon(c.platform), h('span.ellipsis', c.name), h('strong', fmt.number(c.n)))))),
  ].filter(c => c instanceof Node));
}

// ---------------------------------------------------------------- 2. live tools: poll, goals, commands, Discord
function renderLive() {
  if (!el.live) return;
  el.live.replaceChildren(
    sectionHead('radio', t('home.live.title'), t('home.live.sub')),
    h('div.set-grid', el.pollCard = h('div.card'), el.goalCard = h('div.card'), el.botCard = h('div.card'), el.dcCard = h('div.card')));
  renderPoll();
  renderGoals();
  renderBot();
  renderDiscord();
}

const pollDraft = { question: '', options: ['', ''], seconds: 120, announce: true }; // the form survives re-renders
const POLL_SECONDS = [30, 60, 120, 300, 600];
let pollTimer = 0;
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pct = new Intl.NumberFormat(undefined, { style: 'percent' });

/** The poll running (live bars, time left) or ended (result), else the form to start one. */
function renderPoll() {
  const box = el.pollCard;
  if (!box) return;
  clearInterval(pollTimer);
  pollTimer = 0;
  const p = S.state.poll;
  const head = [h('h3.card-title', icon('chart'), t('home.poll.title')), h('p.small.muted', t('home.poll.desc'))];
  if (p) {
    el.pollBars = h('ol.poll-bars', p.options.map((o, i) => h('li.poll-bar', h('span.poll-num', String(i + 1)), h('span.ellipsis', o.label), h('strong'),
      h('span.progress', { attrs: { 'aria-hidden': 'true' } }, h('span')))));
    el.pollMeta = h('p.small.muted');
    const end = h('button.btn.sm', { type: 'button', dataset: { focus: 'poll:end' }, onclick: e => busy(e.currentTarget, async () => { S.state.poll = await api('/api/poll/close', { body: {} }); renderPoll(); }) }, icon('check'), t('home.poll.end'));
    const again = h('button.btn.sm.primary', { type: 'button', dataset: { focus: 'poll:new' }, onclick: e => busy(e.currentTarget, async () => { await api('/api/poll', { method: 'DELETE' }); S.state.poll = null; renderPoll(); }) }, icon('plus'), t('home.poll.new'));
    keepFocus(() => box.replaceChildren(...head, h('strong.poll-q', p.question), el.pollBars, el.pollMeta, h('div.row', p.closedAt ? again : end)));
    paintPoll();
    if (!p.closedAt) pollTimer = setInterval(paintPoll, 1000); // the time left (stopped when the poll ends)
    return;
  }
  const d = pollDraft;
  const q = h('input', { id: 'poll-q', type: 'text', maxLength: 120, value: d.question, placeholder: t('home.poll.questionPh'), dataset: { focus: 'poll:q' }, oninput: () => { d.question = q.value; } });
  const options = d.options.map((v, i) => {
    const name = t('home.poll.option', { n: i + 1 });
    const input = h('input', { id: `poll-o${i}`, type: 'text', maxLength: 40, value: v, placeholder: name, attrs: { 'aria-label': name }, dataset: { focus: `poll:o${i}` }, oninput: () => { d.options[i] = input.value; } });
    return h('div.poll-opt', h('span.poll-num', { attrs: { 'aria-hidden': 'true' } }, String(i + 1)), input,
      d.options.length > 2 && h('button.icon-btn', { type: 'button', title: t('home.poll.remove', { n: i + 1 }), attrs: { 'aria-label': t('home.poll.remove', { n: i + 1 }) }, dataset: { focus: `poll:x${i}` }, onclick: () => { d.options.splice(i, 1); renderPoll(); } }, icon('x')));
  });
  const add = () => { d.options.push(''); renderPoll(); $(`#poll-o${d.options.length - 1}`)?.focus(); };
  keepFocus(() => box.replaceChildren(...head,
    h('form.stack', { onsubmit: e => { e.preventDefault(); startPoll(e.submitter); } },
      h('div.field', h('label', { htmlFor: q.id }, t('home.poll.question')), q),
      h('div.stack.tight', options, d.options.length < 5 && h('button.btn.sm.ghost.poll-add', { type: 'button', dataset: { focus: 'poll:add' }, onclick: add }, icon('plus'), t('home.poll.add'))),
      h('div.field', h('span.label', t('home.poll.duration')),
        segmented(t('home.poll.duration'), POLL_SECONDS.map(s => [s, s < 60 ? t('home.poll.s', { n: s }) : t('home.poll.min', { n: s / 60 })]), d.seconds, v => { d.seconds = v; }, 'poll:dur')),
      h('label.set-row.set-toggle', h('span.set-row-text', h('strong', t('home.poll.announce')), h('span.small.muted', t('home.poll.announceDesc'))),
        h('span.switch', h('input', { type: 'checkbox', checked: d.announce, dataset: { focus: 'poll:announce' }, onchange: e => { d.announce = e.target.checked; } }), h('span'))),
      h('div', h('button.btn.primary', { type: 'submit', dataset: { focus: 'poll:start' } }, icon('play'), t('home.poll.start'))))));
}

async function startPoll(button) {
  const d = pollDraft;
  await busy(button, async () => {
    S.state.poll = await api('/api/poll', { body: { question: d.question, options: d.options, seconds: d.seconds, announce: d.announce } });
    Object.assign(d, { question: '', options: ['', ''] });
    renderPoll();
  });
}

/** Bars and time left in place ('poll' frames come with every wave of votes). */
function paintPoll() {
  const p = S.state.poll;
  if (!p || !el.pollBars?.isConnected) { clearInterval(pollTimer); pollTimer = 0; return; }
  const best = Math.max(...p.options.map(o => o.votes));
  [...el.pollBars.children].forEach((li, i) => {
    const share = p.total ? p.options[i].votes / p.total : 0;
    li.classList.toggle('win', Boolean(p.closedAt && p.total && p.options[i].votes === best));
    li.querySelector('strong').textContent = pct.format(share);
    li.querySelector('.progress > span').style.setProperty('--p', `${share * 100}%`);
  });
  el.pollMeta.textContent = [t('home.poll.votes', { n: p.total }), p.closedAt ? t('home.poll.closed') : t('home.poll.left', { d: clock(p.endsAt - Date.now()) })].join(' · ');
}

/** Follow and sub goals: title, count and goal saved on change; bars repainted by 'goal' frames. */
function renderGoals() {
  const box = el.goalCard;
  if (!box) return;
  const g = S.state.goals;
  box.hidden = !g;
  if (!g) return;
  const save = patch => api('/api/goals', { method: 'PUT', body: { ...S.state.goals, ...patch } })
    .then(r => { S.state.goals = r; paintGoals(); }, err => { toast(err.message, 'error', 6000); renderGoals(); });
  const field = (kind, key, input) => h('div.field', h('label', { htmlFor: input.id }, t(`home.goal.${key}`)), input);
  const num = (kind, key, min) => {
    const input = h('input', {
      id: `goal-${kind}-${key}`, type: 'number', min, max: 10_000_000, step: 1, value: g[kind][key], dataset: { focus: `goal:${kind}:${key}`, goal: `${kind}:${key}` },
      onchange: () => {
        const n = Number(input.value);
        if (input.value !== '' && Number.isInteger(n) && n >= min) save({ [kind]: { ...S.state.goals[kind], [key]: n } }); else input.value = S.state.goals[kind][key];
      },
    });
    return field(kind, key, input);
  };
  keepFocus(() => box.replaceChildren(
    h('h3.card-title', icon('target'), t('home.goal.title')),
    h('p.small.muted', t('home.goal.desc')),
    ...['subs', 'follows'].map(kind => {
      const label = h('input', { id: `goal-${kind}-label`, type: 'text', maxLength: 40, value: g[kind].label, placeholder: t(`home.goal.labelPh.${kind}`), dataset: { focus: `goal:${kind}:label` },
        onchange: () => save({ [kind]: { ...S.state.goals[kind], label: label.value } }) });
      const reset = async () => {
        if (await confirmDialog({ title: t('home.goal.resetTitle'), body: t('home.goal.resetBody'), confirm: t('home.goal.reset') })) save({ [kind]: { ...S.state.goals[kind], count: 0 } });
      };
      return h('div.goal-row',
        h('div.row', h('strong', t(`home.goal.${kind}`)), h('span.spacer'), h('strong.goal-count', { dataset: { goalCount: kind } })),
        h('span.small.muted', t(`home.goal.${kind}Desc`)),
        h('div.progress', { dataset: { goalBar: kind }, attrs: { 'aria-hidden': 'true' } }, h('span')),
        h('div.goal-fields', field(kind, 'label', label), num(kind, 'count', 0), num(kind, 'target', 1)),
        h('div', h('button.btn.sm.ghost', { type: 'button', dataset: { focus: `goal:${kind}:reset` }, onclick: reset }, icon('refresh'), t('home.goal.reset'))));
    })));
  paintGoals();
}

function paintGoals() {
  const g = S.state.goals;
  if (!g || !el.goalCard?.isConnected) return;
  for (const kind of ['subs', 'follows']) {
    const { count, target } = g[kind];
    const text = $(`[data-goal-count="${kind}"]`);
    if (text) text.textContent = `${fmt.number(count)} / ${fmt.number(target)}`;
    $(`[data-goal-bar="${kind}"] > span`)?.style.setProperty('--p', `${Math.min(100, (count / target) * 100)}%`);
    const input = $(`[data-goal="${kind}:count"]`);
    if (input && document.activeElement !== input) input.value = count;
  }
}

let botDraft = null; // what the card shows, rows still being typed included (only complete ones are saved)
let botQueue = Promise.resolve();
const BOT_MINUTES = [5, 10, 15, 20, 30, 45, 60];

function saveBot() {
  const d = botDraft;
  const body = { commands: d.commands.filter(c => c.name && c.text.trim()), timers: d.timers.filter(r => r.text.trim()), offAccounts: d.offAccounts };
  botQueue = botQueue.then(() => api('/api/bot', { method: 'PUT', body }).then(r => { S.bot = r; }, err => toast(err.message, 'error', 6000)));
}

/** Chat commands, reminders and the accounts that send them. Each change is saved at once. */
function renderBot() {
  const box = el.botCard;
  if (!box) return;
  box.hidden = !S.bot;
  if (!S.bot) return;
  const d = botDraft ||= structuredClone(S.bot);
  if (!d.commands.length) d.commands.push({ name: '', text: '' });
  if (!d.timers.length) d.timers.push({ text: '', minutes: 15 });
  const remove = (list, i, key) => h('button.icon-btn', { type: 'button', title: t('home.bot.remove'), attrs: { 'aria-label': t('home.bot.remove') }, dataset: { focus: key },
    onclick: () => { list.splice(i, 1); saveBot(); renderBot(); } }, icon('trash'));
  const command = (c, i) => {
    const name = h('input.bot-name', { type: 'text', maxLength: 25, value: c.name, placeholder: t('home.bot.namePh'), attrs: { 'aria-label': t('home.bot.name') }, dataset: { focus: `bot:c${i}:name` },
      onchange: () => { c.name = name.value.trim().replace(/^!+/, '').toLowerCase(); name.value = c.name; saveBot(); } });
    const text = h('input', { type: 'text', maxLength: 500, value: c.text, placeholder: t('home.bot.textPh'), attrs: { 'aria-label': t('home.bot.text') }, dataset: { focus: `bot:c${i}:text` },
      onchange: () => { c.text = text.value; saveBot(); } });
    return h('div.bot-row', h('span.bot-name-box', h('span.bot-bang', { attrs: { 'aria-hidden': 'true' } }, '!'), name), text, remove(d.commands, i, `bot:c${i}:x`));
  };
  const timer = (r, i) => {
    const text = h('input', { type: 'text', maxLength: 500, value: r.text, placeholder: t('home.bot.timerPh'), attrs: { 'aria-label': t('home.bot.timers') }, dataset: { focus: `bot:t${i}:text` },
      onchange: () => { r.text = text.value; saveBot(); } });
    const every = h('select', { attrs: { 'aria-label': t('home.bot.every') }, dataset: { focus: `bot:t${i}:min` }, onchange: () => { r.minutes = Number(every.value); saveBot(); } },
      [...new Set([...BOT_MINUTES, r.minutes])].sort((x, y) => x - y).map(m => h('option', { value: m, selected: m === r.minutes }, t('home.poll.min', { n: m }))));
    return h('div.bot-row.bot-timer', text, every, remove(d.timers, i, `bot:t${i}:x`));
  };
  const senders = S.accounts.filter(a => a.caps?.chatSend);
  const chip = a => h('button.toggle-chip', {
    type: 'button', dataset: { focus: `bot:a:${a.id}` }, attrs: { 'aria-pressed': String(!d.offAccounts.includes(a.id)) },
    onclick: e => {
      d.offAccounts = d.offAccounts.includes(a.id) ? d.offAccounts.filter(x => x !== a.id) : [...d.offAccounts, a.id];
      e.currentTarget.setAttribute('aria-pressed', String(!d.offAccounts.includes(a.id)));
      saveBot();
    },
  }, platformIcon(a.platform), a.displayName);
  keepFocus(() => box.replaceChildren(
    h('h3.card-title', icon('chat'), t('home.bot.title')),
    h('p.small.muted', t('home.bot.desc')),
    h('h4.set-sub', t('home.bot.commands')),
    h('div.stack.tight', d.commands.map(command)),
    h('div.row.tight', h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'bot:addc' }, onclick: () => { d.commands.push({ name: '', text: '' }); renderBot(); } }, icon('plus'), t('home.bot.addCommand'))),
    h('p.tiny.muted', t('home.bot.cmdHint')),
    h('h4.set-sub', t('home.bot.timers')),
    h('div.stack.tight', d.timers.map(timer)),
    h('div.row.tight', h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'bot:addt' }, onclick: () => { d.timers.push({ text: '', minutes: 15 }); renderBot(); } }, icon('plus'), t('home.bot.addTimer'))),
    h('p.tiny.muted', t('home.bot.timerHint')),
    h('h4.set-sub', t('home.bot.channels')),
    senders.length ? h('div.row.tight', senders.map(chip)) : h('p.small.muted', t('home.bot.noSend')),
    senders.some(a => a.platform === 'youtube') && h('p.tiny.muted', icon('info', 12), ' ', t('home.bot.quota'))));
}

/** Discord webhook (sealed on the server, only a hint comes back), announcement and recap switches, announcement text. */
function renderDiscord() {
  const box = el.dcCard;
  if (!box) return;
  const dc = S.discord;
  box.hidden = !dc;
  if (!dc) return;
  const put = patch => api('/api/discord', { method: 'PUT', body: patch })
    .then(r => { S.discord = r; renderDiscord(); return true; }, err => { toast(err.message, 'error', 6000); renderDiscord(); return false; });
  const toggle = key => h('label.set-row.set-toggle', h('span.set-row-text', h('strong', t(`home.dc.${key}`)), h('span.small.muted', t(`home.dc.${key}Desc`))),
    h('span.switch', h('input', { type: 'checkbox', checked: dc[key], dataset: { focus: `dc:${key}` }, onchange: e => put({ [key]: e.target.checked }) }), h('span')));
  const url = h('input', { id: 'dc-url', type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'https://discord.com/api/webhooks/…', dataset: { focus: 'dc:url' } });
  const hook = dc.webhook
    ? h('div.row', h('span.badge.ok', icon('check', 12), t('home.dc.linked', { hint: dc.hint })), h('span.spacer'),
      h('button.btn.sm', { type: 'button', dataset: { focus: 'dc:test' }, onclick: e => busy(e.currentTarget, async () => { await api('/api/discord/test', { body: {} }); toast(t('home.dc.tested'), 'ok'); }) }, icon('send'), t('home.dc.test')),
      h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'dc:remove' }, onclick: () => put({ webhook: null }) }, t('home.dc.remove')))
    : h('form.stack.tight', { onsubmit: async e => { e.preventDefault(); if (await put({ webhook: url.value })) toast(t('home.dc.saved'), 'ok'); } },
      h('label.label', { htmlFor: url.id }, t('home.dc.webhook')),
      h('div.row.tight.dc-url', url, h('button.btn.sm.primary', { type: 'submit', dataset: { focus: 'dc:save' } }, t('home.dc.save'))),
      h('p.tiny.muted', t('home.dc.how')));
  const msg = h('textarea', { id: 'dc-msg', rows: 2, maxLength: 500, value: dc.message, placeholder: t('home.dc.messagePh'), dataset: { focus: 'dc:msg' }, onchange: () => put({ message: msg.value }) });
  keepFocus(() => box.replaceChildren(
    h('h3.card-title', icon('megaphone'), t('home.dc.title')),
    h('p.small.muted', t('home.dc.desc')),
    hook, toggle('announce'), toggle('summary'),
    h('div.field', h('label', { htmlFor: msg.id }, t('home.dc.message')), msg, h('p.tiny.muted', t('home.dc.messageHint')))));
}

// ---------------------------------------------------------------- 3. accounts
function renderAccounts() {
  if (!el.accounts) return;
  keepFocus(() => el.accounts.replaceChildren(
    sectionHead('users', t('home.acc.title'), t('home.acc.sub')),
    h('div.pf-grid', S.state.platforms.map(platformCard))));
}

function platformCard(p) {
  const app = appOf(p.id);
  const oauth = p.auth === 'oauth';
  const list = S.accounts.filter(a => a.platform === p.id);
  const pending = S.pending[p.id];
  const multiHint = `home.acc.multi.${p.id}`;
  return h(`article.card.flush.pf-card.pf-${p.id}`, { id: `pf-${p.id}`, attrs: { 'aria-labelledby': `pf-${p.id}-title` } },
    h('header.pf-card-head',
      platformIcon(p.id, { large: true }),
      h('div.pf-card-title',
        h('h3', { id: `pf-${p.id}-title` }, p.name),
        h('div.row.badges',
          oauth && (app?.configured
            ? h(`span.badge.${app.source === 'env' ? 'accent' : 'ok'}`, t(app.source === 'env' ? 'home.acc.appEnv' : 'home.acc.appReady'))
            : h('span.badge.warn', t('home.acc.appMissing'))),
          p.notes?.unofficial && h('span.badge.warn', t('common.unofficial')))),
      oauth && h('button.icon-btn', { type: 'button', dataset: { focus: `pf-${p.id}:setup` }, title: t('home.acc.setup', { name: p.name }), attrs: { 'aria-label': t('home.acc.setup', { name: p.name }) }, onclick: () => openWizard(p.id) }, icon('settings'))),
    list.length ? h('ul.acc-list', list.map(a => accountRow(a, p))) : h('p.pf-empty.small.muted', t('home.acc.empty', { name: p.name })),
    pending && waitingBanner(p, pending),
    h('footer.pf-card-foot',
      p.auth === 'username' ? usernameForm(p)
        : h(`button.btn.block${list.length ? '' : '.primary'}`, { type: 'button', dataset: { focus: `pf-${p.id}:add` }, onclick: e => addAccount(p.id, null, e.currentTarget) },
          icon(app?.configured ? 'plus' : 'settings'),
          app?.configured ? t(list.length ? 'home.acc.addAnother' : 'home.acc.add') : t('home.acc.setup', { name: p.name })),
      list.length > 0 && t(multiHint) !== multiHint && h('p.tiny.muted', t(multiHint)),
      p.notes?.unofficial && h('details.pf-about',
        h('summary.small', { dataset: { focus: `pf-${p.id}:why` } }, t('home.acc.why')),
        h('p.small.muted', t(`home.unofficial.${p.id}`) !== `home.unofficial.${p.id}` ? t(`home.unofficial.${p.id}`) : t('home.unofficial.generic')))));
}

const TONES = { ok: 'ok', needs_reconnect: 'warn', error: 'danger' };
/** Status badge; with problemsOnly, nothing for healthy accounts (overview). */
function statusBadge(a, problemsOnly = false) {
  const status = a.status || 'ok';
  if (problemsOnly && status === 'ok') return null;
  const badge = h(`span.badge${TONES[status] ? `.${TONES[status]}` : ''}`, { title: a.error || null }, t(`home.acc.status.${status}`));
  return problemsOnly ? h('a', { href: '#accounts', dataset: { focus: `ov:status:${a.id}` } }, badge) : badge;
}

function accountRow(a, p) {
  const status = a.status || 'ok';
  const tone = TONES[status] || '';
  const oauth = p.auth === 'oauth';
  const action = (ic, key, fn, cls = '') => h(`button.icon-btn${cls}`, { type: 'button', dataset: { focus: `pf-${p.id}:acc:${a.id}:${ic}` }, title: t(key), attrs: { 'aria-label': `${t(key)} · ${a.displayName}` }, onclick: e => fn(a, e.currentTarget) }, icon(ic));
  const problem = status === 'needs_reconnect' ? (a.error || t('home.acc.needsReconnect')) : status === 'error' ? a.error : '';
  return h('li.acc',
    avatar(a),
    h('div.acc-main',
      h('div.acc-name', h('strong.ellipsis', a.displayName), statusBadge(a),
        a.caps?.unofficial && !p.notes?.unofficial && h('span.badge.warn', t('common.unofficial'))),
      h('div.acc-sub', h('span.small.muted.ellipsis', `@${a.login}`), h('span', { dataset: { live: a.id } }, liveBadge(a))),
      a.caps?.quota && h('div', { dataset: { quota: a.id } }, quotaMeter(a))),
    h('div.acc-actions',
      oauth && action('link', 'home.acc.reconnect', (acc, btn) => addAccount(acc.platform, acc.id, btn)),
      action('refresh', 'home.acc.restart', restartAccount),
      p.id === 'kick' && action('settings', 'home.acc.options', kickOptions),
      action('trash', 'home.acc.disconnect', disconnectAccount, '.danger')),
    problem && h(`div.acc-problem.banner.small.${tone}`, icon('alert'),
      h('span.banner-text', problem),
      oauth && status === 'needs_reconnect' && h('button.btn.sm.primary', { type: 'button', dataset: { focus: `pf-${p.id}:acc:${a.id}:fix` }, onclick: e => addAccount(a.platform, a.id, e.currentTarget) }, t('home.acc.reconnect'))));
}

function waitingBanner(p, pending) {
  const open = linkBtn(pending.url, t('home.acc.openLink'));
  open.dataset.focus = `pf-${p.id}:wait:open`;
  return h('div.banner.info.small.waiting', { attrs: { role: 'status' } },
    h('span.spinner', { attrs: { 'aria-hidden': 'true' } }),
    h('div.stack.tight.banner-text',
      h('strong', t('home.acc.waiting')),
      h('span.muted', t('home.acc.waitingHint')),
      h('div.row',
        open,
        h('button.btn.sm', { type: 'button', dataset: { focus: `pf-${p.id}:wait:copy` }, onclick: () => copy(pending.url) }, icon('copy'), t('home.acc.copyLink')),
        h('button.btn.sm.ghost', { type: 'button', dataset: { focus: `pf-${p.id}:wait:cancel` }, onclick: () => clearPending(p.id) }, t('common.cancel')))));
}

function clearPending(pid) {
  clearTimeout(S.pending[pid]?.timer);
  delete S.pending[pid];
  renderAccounts();
}

/** Start OAuth (or the setup wizard when the platform app is missing) and wait for the account to show up. */
async function addAccount(pid, reconnect = null, button = null) {
  if (!appOf(pid)?.configured) return openWizard(pid);
  await busy(button, async () => {
    const known = new Map(S.accounts.filter(a => a.platform === pid).map(a => [a.id, a.status]));
    const { url } = await openAuth(pid, reconnect);
    clearTimeout(S.pending[pid]?.timer);
    const timer = setTimeout(() => { clearPending(pid); toast(t('home.acc.waitingExpired'), 'warn', 6000); }, AUTH_TIMEOUT);
    S.pending[pid] = { url, known, reconnect, timer };
    renderAccounts();
    document.getElementById(`pf-${pid}`)?.scrollIntoView({ block: 'nearest' });
  });
}

/** Resolve "waiting for authorization" states from a fresh account list. */
function resolvePending(list) {
  for (const [pid, p] of Object.entries(S.pending)) {
    const hit = p.reconnect
      ? list.find(a => a.id === p.reconnect && a.status === 'ok')
      : list.find(a => a.platform === pid && (!p.known.has(a.id) || (p.known.get(a.id) !== 'ok' && a.status === 'ok')));
    if (!hit) continue;
    clearTimeout(p.timer);
    delete S.pending[pid];
    toast(t('home.acc.connected', { name: hit.displayName }), 'ok');
  }
}

async function restartAccount(a, button) {
  await busy(button, async () => {
    await api(`/api/accounts/${encodeURIComponent(a.id)}/restart`, { body: {} });
    toast(t('home.acc.restarted'), 'ok');
  });
}

async function disconnectAccount(a) {
  const ok = await confirmDialog({ title: t('home.acc.disconnectTitle', { name: a.displayName }), body: t('home.acc.disconnectBody'), confirm: t('home.acc.disconnect'), danger: true });
  if (!ok) return;
  await busy(null, async () => {
    await api(`/api/accounts/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
    toast(t('home.acc.disconnected'), 'ok');
  });
}

function usernameForm(p) {
  if (forms[p.id]) return forms[p.id];
  const id = `user-${p.id}`;
  const input = h('input', { id, type: 'text', dataset: { focus: `pf-${p.id}:add` }, placeholder: t('home.user.placeholder'), autocomplete: 'off', spellcheck: false, maxLength: 32 });
  const error = h('p.error-text', { attrs: { role: 'alert' } });
  const button = h('button.btn.primary', { type: 'submit', dataset: { focus: `pf-${p.id}:addUser` } }, icon('plus'), t('home.user.add'));
  forms[p.id] = h('form.stack.tight', {
    onsubmit: async e => {
      e.preventDefault();
      const username = input.value.trim().replace(/^@/, '');
      setError(input, error, /^[\w.]{2,24}$/.test(username) ? '' : t('home.user.invalid'));
      if (error.textContent) return input.focus();
      await busy(button, async () => {
        try {
          const account = await api(`/api/accounts/username/${p.id}`, { body: { username } });
          input.value = '';
          toast(t('home.user.added', { name: account.displayName || username }), 'ok');
        } catch (err) { setError(input, error, err.message); }
      });
    },
  },
  h('label.label', { htmlFor: id }, t('home.user.label', { name: p.name })),
  h('div.input-group', input, button), error,
  h('p.tiny.muted', t('home.user.hint')));
  return forms[p.id];
}

function kickOptions(a) {
  const options = a.options || {};
  const pub = S.state.publicUrl;
  const publicHttps = pub.startsWith('https://') && !isLocalUrl(pub);
  const webhookUrl = `${pub}/webhooks/kick`;
  let mode = ['auto', 'webhook', 'pusher', 'off'].includes(options.chatMode) ? options.chatMode : 'auto';
  const webhookBox = h('div.stack.tight.kick-webhook',
    h('span.label', t('home.kick.webhookUrl')), copyField(webhookUrl),
    h('p.small.muted', t('home.kick.webhookHow')),
    !publicHttps && banner('warn', t('home.kick.webhookLocal', { url: pub })));
  const sync = () => { webhookBox.hidden = !(mode === 'webhook' || (mode === 'auto' && publicHttps)); };
  sync();
  const tags = { webhook: ['ok', 'home.kick.official'], pusher: ['warn', 'home.kick.unofficial'] };
  const modes = h('fieldset.mode-list', h('legend', t('home.kick.mode')),
    ['auto', 'webhook', 'pusher', 'off'].map(m => h('label.mode-option',
      h('input', { type: 'radio', name: `kick-mode-${a.id}`, value: m, checked: m === mode, onchange: () => { mode = m; sync(); } }),
      h('span.stack.tight',
        h('span.row.tight', h('strong', t(`home.kick.${m}`)), tags[m] && h(`span.badge.${tags[m][0]}`, t(tags[m][1]))),
        h('span.small.muted', t(`home.kick.${m}Desc`))))));
  const chatroom = h('input', { id: `kick-room-${a.id}`, type: 'text', inputMode: 'numeric', autocomplete: 'off', value: options.chatroomId ? String(options.chatroomId) : '', maxLength: 12 });
  const roomError = h('p.error-text', { attrs: { role: 'alert' } });
  const channel = h('input', { id: `kick-channel-${a.id}`, type: 'text', inputMode: 'numeric', autocomplete: 'off', value: options.channelId ? String(options.channelId) : '', maxLength: 12 });
  const channelError = h('p.error-text', { attrs: { role: 'alert' } });
  const save = h('button.btn.primary', { type: 'button' }, t('common.save'));
  const dlg = modal(h('span.row.tight', platformIcon('kick'), `${t('home.kick.title')} · ${a.displayName}`), [
    modes, webhookBox,
    h('div.field',
      h('label', { htmlFor: chatroom.id }, t('home.kick.chatroom')), chatroom, roomError,
      h('span.hint', t('home.kick.chatroomHint'), ' ', extLink(`https://kick.com/api/v2/channels/${encodeURIComponent(a.login)}`, t('home.kick.chatroomLink')))),
    h('div.field',
      h('label', { htmlFor: channel.id }, t('home.kick.channel')), channel, channelError,
      h('span.hint', t('home.kick.channelHint'))),
  ], [h('button.btn', { type: 'button', onclick: () => dlg.close() }, t('common.cancel')), save]);
  save.addEventListener('click', () => {
    const room = chatroom.value.trim();
    const chan = channel.value.trim();
    setError(chatroom, roomError, !room || /^\d{1,12}$/.test(room) ? '' : t('home.kick.chatroomInvalid'));
    setError(channel, channelError, !chan || /^\d{1,12}$/.test(chan) ? '' : t('home.kick.chatroomInvalid'));
    if (roomError.textContent) return chatroom.focus();
    if (channelError.textContent) return channel.focus();
    busy(save, async () => {
      await api(`/api/accounts/${encodeURIComponent(a.id)}`, { method: 'PATCH', body: { options: { chatMode: mode, chatroomId: room ? Number(room) : null, channelId: chan ? Number(chan) : null } } });
      toast(t('home.kick.saved'), 'ok');
      dlg.close();
    });
  });
}

// ---------------------------------------------------------------- 4. setup wizard
function wizardSteps(pid, { appName, redirect, consoleUrl, local, webhookUrl }) {
  const k = s => t(`home.wiz.${pid}.${s}`);
  const consoleBtn = consoleUrl && linkBtn(consoleUrl, t('home.wiz.openConsole', { name: platform(pid).name }));
  switch (pid) {
    case 'twitch': return [
      [k('s1'), linkBtn('https://www.twitch.tv/settings/security', k('s1Link'))],
      [k('s2'), consoleBtn],
      [k('s3'), copyField(appName)],
      [k('s4'), copyField(redirect)],
      [k('s5')],
      [k('s6')],
    ];
    case 'kick': return [
      [k('s1'), linkBtn('https://kick.com/settings/security', k('s1Link'))],
      [k('s2'), consoleBtn],
      [k('s3'), copyField(appName)],
      [k('s4'), copyField(redirect)],
      [k('s5'), h('div.scopes', KICK_SCOPES.map(s => h('code', s)))],
      local ? [k('s6Local')] : [k('s6Public'), copyField(webhookUrl)],
      [k('s7')],
    ];
    case 'youtube': return [
      [k('s1'), linkBtn('https://console.cloud.google.com/projectcreate', k('s1Link'))],
      [k('s2'), linkBtn('https://console.cloud.google.com/apis/library/youtube.googleapis.com', k('s2Link'))],
      [k('s3'), linkBtn('https://console.cloud.google.com/auth/overview', k('s3Link'))],
      [k('s4'), linkBtn('https://console.cloud.google.com/auth/clients', k('s4Link')), copyField(redirect)],
      [k('s5')],
      [k('s6'), linkBtn('https://console.cloud.google.com/auth/audience', k('s6Link'))],
      [k('s7')],
    ];
    default: return [
      [t('home.wiz.generic.s1'), consoleBtn],
      [t('home.wiz.generic.s2'), copyField(redirect)],
      [t('home.wiz.generic.s3')],
    ];
  }
}

function envBanners(pid) {
  const pub = S.state.publicUrl;
  const u = new URL(pub);
  const local = isLocalUrl(pub);
  return [
    local ? banner('info', t('home.wiz.envLocal', { url: pub }))
      : u.protocol === 'https:' ? banner('ok', t('home.wiz.envPublic', { url: pub }))
        : banner('danger', t('home.wiz.envHttp', { url: pub })),
    u.hostname !== 'localhost' && local && banner('warn', t('home.wiz.env127', { port: u.port || '80' })),
    pid === 'kick' && local && banner('warn', t('home.wiz.kickLocal')),
  ];
}

function openWizard(pid) {
  const p = platform(pid);
  if (!p) return;
  const app = appOf(pid) || {};
  const env = app.source === 'env';
  const pub = S.state.publicUrl;
  const login = (S.accounts.find(a => a.platform === pid) || S.accounts[0])?.login;
  const ctx = {
    appName: `Tramevia Dock - ${login || t('home.wiz.yourName')}`,
    redirect: app.redirectUri || `${pub}/auth/${pid}/callback`,
    consoleUrl: p.app?.consoleUrl, local: isLocalUrl(pub), webhookUrl: `${pub}/webhooks/kick`,
  };
  let tested = false;

  const progress = h('div.wiz-progress');
  const paintProgress = () => progress.replaceChildren(...[
    ['saved', appOf(pid)?.configured], ['tested', tested], ['connected', S.accounts.some(a => a.platform === pid)],
  ].map(([key, done]) => h(`span.pill${done ? '.done' : ''}`, done ? icon('check', 14) : h('span.pill-dot'), t(`home.wiz.p.${key}`))));
  paintProgress();

  const idInput = h('input', { id: `wiz-id-${pid}`, type: 'text', value: app.clientId || '', autocomplete: 'off', spellcheck: false, disabled: env, maxLength: 200 });
  const secretInput = h('input', { id: `wiz-secret-${pid}`, type: 'password', autocomplete: 'new-password', placeholder: app.configured ? t('home.wiz.secretKeep') : '', disabled: env, maxLength: 400 });
  const idError = h('p.error-text', { attrs: { role: 'alert' } });
  const secretError = h('p.error-text', { attrs: { role: 'alert' } });
  const result = h('div.wiz-result', { attrs: { role: 'status', 'aria-live': 'polite' } });
  const saveBtn = h('button.btn.primary', { type: 'submit', disabled: env }, t('home.wiz.save'));
  const testBtn = h('button.btn', { type: 'button', disabled: !app.configured }, t('home.wiz.test'));
  const connectBtn = h('button.btn.primary', { type: 'button', disabled: !app.configured }, icon('link'), t('home.wiz.connect', { name: p.name }));

  async function test() {
    result.replaceChildren(h('div.row.small.muted', h('span.spinner', { attrs: { 'aria-hidden': 'true' } }), t('home.wiz.testing')));
    try {
      const r = await api(`/api/apps/${pid}/test`, { body: {} });
      tested = true;
      result.replaceChildren(banner('ok', r?.message || t('home.wiz.testOk')));
    } catch (err) {
      tested = false;
      result.replaceChildren(banner('danger', t('home.wiz.testFail', { msg: err.message })));
    }
    paintProgress();
  }

  async function save(e) {
    e.preventDefault();
    const clientId = idInput.value.trim();
    const clientSecret = secretInput.value.trim();
    const configured = appOf(pid)?.configured;
    setError(idInput, idError, /^[\w.-]{6,200}$/.test(clientId) ? '' : t('home.wiz.idInvalid'));
    setError(secretInput, secretError, (clientSecret ? clientSecret.length >= 6 : configured) ? '' : t('home.wiz.secretInvalid'));
    if (idError.textContent) return idInput.focus();
    if (secretError.textContent) return secretInput.focus();
    await busy(saveBtn, async () => {
      try {
        await api(`/api/apps/${pid}`, { method: 'PUT', body: { clientId, clientSecret } });
      } catch (err) {
        result.replaceChildren(banner('danger', err.message));
        return;
      }
      secretInput.value = '';
      secretInput.placeholder = t('home.wiz.secretKeep');
      await refreshApps();
      testBtn.disabled = connectBtn.disabled = false;
      toast(t('home.wiz.saved'), 'ok');
      await test();
    });
  }

  const steps = wizardSteps(pid, ctx);
  const body = [
    h('p.muted', t('home.wiz.intro', { name: p.name })),
    h('div.row', h('span.pill', icon('clock', 14), t('home.wiz.duration')), progress),
    ...envBanners(pid),
    h('ol.wiz-steps',
      steps.map(([text, ...extras], i) => h('li.wiz-step',
        h('span.step-num', { attrs: { 'aria-hidden': 'true' } }, String(i + 1)),
        h('div.wiz-step-body', h('p', text), ...extras))),
      h('li.wiz-step',
        h('span.step-num', { attrs: { 'aria-hidden': 'true' } }, String(steps.length + 1)),
        h('form.wiz-step-body.creds', { onsubmit: save, noValidate: true },
          h('h3', t('home.wiz.credsTitle')),
          env && banner('info', t('home.wiz.envLocked', { vars: `${pid.toUpperCase()}_CLIENT_ID / ${pid.toUpperCase()}_CLIENT_SECRET` })),
          h('div.field', h('label', { htmlFor: idInput.id }, 'Client ID'), idInput, idError),
          h('div.field', h('label', { htmlFor: secretInput.id }, 'Client Secret'), secretInput, secretError, h('span.hint', t('home.wiz.secretHint'))),
          h('div.row', saveBtn, testBtn),
          result))),
    h('div.row.wiz-foot',
      p.app?.docsUrl && extLink(p.app.docsUrl, icon('external', 14), ' ', t('home.wiz.docs')),
      h('span.spacer'),
      app.configured && !env && h('button.btn.sm.ghost.danger', { type: 'button', onclick: () => removeApp(p, dlg) }, icon('trash'), t('home.wiz.remove'))),
  ];
  const dlg = modal(h('span.row.tight', platformIcon(pid, { large: true }), t('home.wiz.title', { name: p.name })), body,
    [h('button.btn', { type: 'button', onclick: () => dlg.close() }, t('common.close')), connectBtn], true);
  testBtn.addEventListener('click', () => busy(testBtn, test));
  connectBtn.addEventListener('click', () => { dlg.close(); addAccount(pid); });
}

async function removeApp(p, dlg) {
  const ok = await confirmDialog({ title: t('home.wiz.removeTitle', { name: p.name }), body: t('home.wiz.removeBody', { name: p.name }), confirm: t('home.wiz.remove'), danger: true });
  if (!ok) return;
  await busy(null, async () => {
    await api(`/api/apps/${p.id}`, { method: 'DELETE' });
    dlg.close();
    await refreshApps();
    toast(t('home.wiz.removed'), 'ok');
  });
}

// ---------------------------------------------------------------- 5. OBS
function renderObs() {
  if (!el.obs) return;
  const base = S.state.publicUrl;
  const dockUrl = path => `${base}${path}?key=${encodeURIComponent(S.keys.dock)}`;
  keepFocus(() => el.obs.replaceChildren(
    sectionHead('monitor', t('home.obs.title'), t('home.obs.sub')),
    h('div.card.stack',
      h('h3.card-title', icon('layers'), t('home.obs.docks')),
      h('ol.num-list', ['s1', 's2', 's3'].map(s => h('li', t(`home.obs.${s}`)))),
      h('ul.dock-list', DOCKS.map(([k, path, ic]) => h('li.dock-row',
        h('span.dock-name', icon(ic), t(k === 'home' ? 'home.links.home' : `home.links.${k}`)),
        secretField(dockUrl(path), `obs:${k}`)))),
      banner('warn', t('home.obs.keyWarn')),
      h('div.row', S.ui.obsDocks
        ? h('span.badge.ok', { tabIndex: -1, dataset: { focus: 'obs:done' } }, icon('check', 12), t('home.obs.doneState')) // keeps focus after "done"
        : h('button.btn.primary', { type: 'button', dataset: { focus: 'obs:done' }, onclick: async e => { if (await busy(e.currentTarget, () => saveUi({ obsDocks: true }))) { toast(t('home.obs.doneToast'), 'ok'); renderOverview(); renderObs(); } } }, icon('check'), t('home.obs.done')))),
    el.overlay = h('div.card.stack', { id: 'obs-overlay' })));
  renderOverlay();
}

/** Every saved overlay, complete (defaults fill in what the server did not send). */
const allOverlays = o => Object.fromEntries(OVERLAY_IDS.map(id => [id, cleanOverlay(o?.[id], OV_DEFAULTS[id])]));
const overlayUrl = (id, base = '') => `${base}/overlay/chat?${new URLSearchParams({ key: S.keys.overlay, id })}`;
const ovSyncOf = id => (ovSync[id] ||= { timer: 0, busy: 0, at: 0, queue: Promise.resolve(), dirty: new Set() });
/** Unsent edit, write in flight or written under 1.5 s ago: frames for this overlay are our own echo (or older). */
const ovQuiet = id => { const s = ovSync[id]; return Boolean(s && (s.timer || s.busy || Date.now() - s.at < 1500)); };
const ovStatus = text => { if (el.ovStatus) el.ovStatus.textContent = text; };

/** Server answer for an overlay: taken when no local edit is waiting (it also carries changes made in another tab). */
function adoptOverlay(id, settings) {
  const s = ovSyncOf(id);
  if (s.timer || s.dirty.size || JSON.stringify(settings) === JSON.stringify(S.state.overlays[id])) return;
  S.state.overlays = { ...S.state.overlays, [id]: settings };
  if (id === ovId) renderOverlayForm();
}

/**
 * Debounced save of one overlay (number inputs fire on every keystroke). Only the changed settings are sent, so a
 * change made meanwhile in another tab is not overwritten. Writes (and resets) are serialized per overlay.
 */
function saveOverlay(id, key) {
  const s = ovSyncOf(id);
  s.dirty.add(key);
  clearTimeout(s.timer);
  ovStatus('');
  s.timer = setTimeout(() => {
    s.timer = 0;
    const patch = Object.fromEntries([...s.dirty].map(k => [k, S.state.overlays[id][k]]));
    s.dirty.clear();
    s.busy++;
    s.queue = s.queue.then(async () => {
      try {
        const r = await api(`/api/overlays/${id}`, { method: 'PUT', body: patch });
        adoptOverlay(id, r.settings);
        if (id === ovId && !s.timer) ovStatus(t('home.ovl.saved'));
      } catch (err) { toast(err.message, 'error', 6000); } finally { s.busy--; s.at = Date.now(); }
    });
  }, 500);
}

async function resetOverlay(button) {
  const id = ovId;
  const s = ovSyncOf(id);
  clearTimeout(s.timer);
  s.timer = 0;
  s.dirty.clear();
  s.busy++;
  try {
    await busy(button, () => (s.queue = s.queue.then(async () => { // after any PUT still in flight
      const r = await api(`/api/overlays/${id}`, { method: 'DELETE' });
      S.state.overlays = { ...S.state.overlays, [id]: r.settings };
      if (id === ovId) { renderOverlayForm(); ovStatus(t('home.ovl.saved')); }
    })));
  } finally { s.busy--; s.at = Date.now(); }
}

/** One-time move of this browser's 1.2 builder settings (localStorage) to the server, while it has none saved. */
let migrating = false;
async function migrateOverlay() {
  const old = store.get('home.overlay');
  if (migrating || S.state.overlaysSaved !== false || !old || typeof old !== 'object') return;
  migrating = true;
  const id = old.mode === 'featured' ? 'featured' : 'chat';
  // 1.2 never applied the platform/account filters to the featured overlay, and its one duration was the dock's.
  const body = id === 'featured' ? { ...cleanOverlay(old, OV_DEFAULTS[id]), offPlatforms: [], offAccounts: [] } : cleanOverlay(old, OV_DEFAULTS[id]);
  try {
    const r = await api(`/api/overlays/${id}`, { method: 'PUT', body });
    if (id === 'chat' && Number.isFinite(old.featureSeconds)) await api('/api/overlays/featured', { method: 'PUT', body: { featureSeconds: old.featureSeconds } }).catch(() => {});
    store.remove('home.overlay');
    S.state.overlaysSaved = true;
    if (!ovQuiet(id)) { S.state.overlays = { ...S.state.overlays, [id]: r.settings }; if (id === ovId) renderOverlayForm(); }
  } catch { /* kept: tried again at the next load */ } finally { migrating = false; }
}

function renderOverlay() {
  el.ovFrame = h('iframe', { title: t('home.ovl.previewTitle'), loading: 'lazy', attrs: { allow: 'autoplay' } }); // autoplay: the alert chime in the preview
  keepFocus(() => el.overlay.replaceChildren(
    h('div.ovl-head',
      h('div.stack.tight', h('h3.card-title', icon('layers'), t('home.ovl.title')), h('p.small.muted', t('home.ovl.sub'))),
      h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'ov:reset' }, onclick: e => resetOverlay(e.currentTarget) }, icon('refresh'), t('home.ovl.reset'))),
    h('div.ov-builder',
      el.ovForm = h('div.ov-form'),
      h('div.ov-preview',
        h('div.row', h('span.label', t('home.ovl.preview')), h('span.spacer'), h('span.tiny.muted', t('home.ovl.previewHint'))),
        h('div.checker', el.ovFrame)))));
  renderOverlayForm();
}

/** Form of the selected overlay. The preview iframe stays in place (live frames update it): its src only changes with the selection or key. */
function renderOverlayForm() {
  if (!el.ovForm) return;
  const id = ovId;
  const o = S.state.overlays[id];
  const featured = id === 'featured';
  const alerts = id === 'alerts';
  const viewers = id === 'viewers';
  const poll = id === 'poll', goal = id === 'goal';
  const widget = viewers || poll || goal; // draws its own figure: no chat filters, display switches or theme hint
  const set = (key, value) => { o[key] = value; saveOverlay(id, key); };
  const num = (key, min, max) => {
    const input = h('input', {
      id: `ov-${key}`, type: 'number', min, max, step: 1, value: o[key], dataset: { focus: `ov:${key}` },
      oninput: () => {
        const n = Number(input.value);
        const ok = input.value !== '' && Number.isInteger(n) && n >= min && n <= max;
        if (ok) set(key, n);
        if (ok) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
      },
    });
    return h('div.field', h('label', { htmlFor: input.id }, t(`home.ovl.${key}`)), input);
  };
  const toggle = key => h('label.switch', h('input', { type: 'checkbox', checked: o[key], dataset: { focus: `ov:${key}` }, onchange: e => set(key, e.target.checked) }), h('span'), h('span', t(`home.ovl.${key}`)));
  const chip = (list, all, item, label, iconEl) => h('button.toggle-chip', {
    type: 'button', dataset: { focus: `ov:${list}:${item}` }, attrs: { 'aria-pressed': String(!o[list].includes(item)) },
    onclick: e => {
      const next = o[list].includes(item) ? o[list].filter(x => x !== item) : [...o[list], item];
      if (all.every(x => next.includes(x))) return; // keep at least one selected
      e.currentTarget.setAttribute('aria-pressed', String(!next.includes(item)));
      set(list, next);
    },
  }, iconEl, label);
  const choice = (key, values, rerender = false, name = key) => h('div.field', h('span.label', t(`home.ovl.${name}`)),
    segmented(t(`home.ovl.${name}`), values.map(v => [v, t(`home.ovl.${name}.${v}`)]), o[key], v => { set(key, v); if (rerender) renderOverlayForm(); }, `ov:${key}`));
  // Early-access styles: shown with a lock; picking one explains how to unlock it instead of saving it.
  const locked = STYLES.filter(v => isLocked(v, S.state.unlocked));
  const styleName = v => t(`home.ovl.style.${v}`);
  const styleChoice = () => h('div.field', h('span.label', t('home.ovl.style')),
    segmented(t('home.ovl.style'), STYLES.map(v => [v, locked.includes(v) ? [icon('lock', 12), ' ', styleName(v)] : styleName(v)]), o.style, v => {
      if (!locked.includes(v)) return set('style', v);
      renderOverlayForm(); // puts the pressed state back on the saved style
      ovStatus(t('home.ovl.locked', { style: styleName(v) }));
    }, 'ov:style'));
  // Goal colour: the Tramevia gradients, a suggested colour or any colour (the picker); one icon per goal shown.
  const pressed = (box, current) => { for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.value === current)); };
  const colorChoice = () => {
    const custom = o.color !== 'tramevia' && !GOAL_COLORS.includes(o.color);
    const picker = h('input', { type: 'color', value: o.color === 'tramevia' ? '#a78bfa' : o.color, dataset: { focus: 'ov:color:pick' }, attrs: { 'aria-label': t('home.ovl.color.custom') },
      oninput: () => { set('color', picker.value); pressed(box, picker.value); wrap.classList.add('on'); } });
    const wrap = h(`label.swatch.custom${custom ? '.on' : ''}`, { title: t('home.ovl.color.custom') }, picker);
    const box = h('div.swatches', { attrs: { role: 'group', 'aria-label': t('home.ovl.color') } },
      ['tramevia', ...GOAL_COLORS].map(c => h('button.swatch', {
        type: 'button', value: c, title: c === 'tramevia' ? t('home.ovl.color.tramevia') : c, dataset: { focus: `ov:color:${c}` },
        style: { '--sw': c === 'tramevia' ? 'linear-gradient(140deg, #74a4ff, #9c66ff 50%, #ff4bb4)' : c },
        attrs: { 'aria-pressed': String(o.color === c), 'aria-label': c === 'tramevia' ? t('home.ovl.color.tramevia') : c },
        onclick: () => { set('color', c); pressed(box, c); wrap.classList.remove('on'); },
      })), wrap);
    return h('div.field', h('span.label', t('home.ovl.color')), box);
  };
  const iconChoice = kind => {
    const key = `${kind}Icon`;
    const box = h('div.icon-picks', { attrs: { role: 'group', 'aria-label': t(`home.ovl.icon.${kind}`) } },
      GOAL_ICONS.map(n => h('button.icon-pick', {
        type: 'button', value: n, title: t(`home.ovl.ic.${n}`), dataset: { focus: `ov:${key}:${n}` },
        attrs: { 'aria-pressed': String(o[key] === n), 'aria-label': t(`home.ovl.ic.${n}`) },
        onclick: () => { set(key, n); pressed(box, n); },
      }, goalIcon(n))));
    return h('div.field', h('span.label', t(`home.ovl.icon.${kind}`)), box);
  };
  // Bubbles and outline only change something on the transparent theme (dark/light always draw cards).
  const textOnly = o.theme === 'transparent';

  const src = overlayUrl(id);
  if (el.ovFrame.getAttribute('src') !== src) el.ovFrame.src = src;
  el.overlay.classList.toggle('ov-scene', alerts); // alerts are made for a source the size of the scene: a wide 16:9 preview
  el.ovFrame.style.setProperty('color-scheme', o.theme === 'light' ? 'light' : 'dark'); // must match the overlay page or the iframe turns opaque
  keepFocus(() => el.ovForm.replaceChildren(...[ // replaceChildren() would print a skipped (false/null) item as text
    h('div.field', h('span.label', t('home.ovl.mode')),
      segmented(t('home.ovl.mode'), OVERLAY_IDS.map(v => [v, t(`home.ovl.mode.${v}`)]), id, v => { ovId = v; renderOverlayForm(); }, 'ov:mode')),
    h('p.small.muted', t(`home.ovl.hint.${id}`)),
    h('div.stack.tight', h('span.label', t('home.ovl.url', { name: t(`home.ovl.mode.${id}`) })), secretField(overlayUrl(id, S.state.publicUrl), 'ov:url'),
      h('p.small.muted', t('home.ovl.how', { w: alerts ? 1920 : poll ? 600 : goal ? 800 : 400, h: alerts ? 1080 : viewers || poll ? 400 : goal ? 200 : 600, scene: alerts ? t('home.ovl.scene') : '' })), h('p.tiny.muted', icon('shield', 12), ' ', t('home.ovl.readonly'))),
    h('div.row.ov-choices', choice('theme', ['transparent', 'dark', 'light'], true),
      alerts ? [choice('position', ['top', 'center', 'bottom']), styleChoice()]
        : viewers ? choice('align', ['left', 'center', 'right'], false, 'number') : goal ? [choice('goal', GOALS, true), choice('look', LOOKS)] : poll ? choice('look', LOOKS) : choice('align', ['left', 'right'])),
    goal && colorChoice(),
    goal && h('div.row.ov-choices', (o.goal === 'follows' ? ['follows'] : o.goal === 'both' ? ['subs', 'follows'] : ['subs']).map(iconChoice)),
    alerts && locked.length && h('div.row.early-note', h('p.small.muted', icon('lock', 12), ' ',
      t('home.ovl.early', { styles: locked.map(styleName).join(', ') })), supportButton()),
    !widget && h('p.small.muted', t(`home.ovl.themeHint.${o.theme}`)),
    h('div.ov-fields',
      alerts ? [num('alertSeconds', 1, 60), num('volume', 0, 100)] : featured ? num('featureSeconds', 0, 300) : widget ? null : [num('max', 1, 100), num('fade', 0, 600)],
      num('size', 10, 48)),
    alerts && h('div.stack.tight', h('span.label', t('home.ovl.types')),
      h('div.row.tight', Object.keys(ALERT_TYPES).map((c, _, all) => chip('offTypes', all, c, t(`home.ovl.type.${c}`))))),
    !widget && h('div.stack.tight', h('span.label', t('home.ovl.display')),
      h('div.ov-switches', (alerts ? ['icons', 'credit'] : ['badges', 'icons', 'avatars', ...(textOnly ? ['bubble', 'outline'] : []), 'credit']).map(toggle))),
    !featured && !alerts && !widget ? h('div.stack.tight', h('span.label', t('home.ovl.filters')),
      h('div.ov-switches', ['hideBots', 'hideCommands', 'events'].map(toggle))) : null,
    !featured && !poll && !goal && h('div.stack.tight', h('span.label', t('home.ovl.platforms')),
      h('div.row.tight', S.state.platforms.map((p, _, all) => chip('offPlatforms', all.map(x => x.id), p.id, p.name, platformIcon(p.id))))),
    !featured && !poll && !goal && S.accounts.length > 1 && h('div.stack.tight', h('span.label', t('home.ovl.accounts')),
      h('div.row.tight', S.accounts.map((a, _, all) => chip('offAccounts', all.map(x => x.id), a.id, a.displayName, platformIcon(a.platform))))),
    alerts && h('button.btn.sm', { type: 'button', dataset: { focus: 'ov:test' }, onclick: e => testAlert(e.currentTarget) }, icon('zap'), t('home.ovl.test')),
    viewers && h('button.btn.sm', { type: 'button', dataset: { focus: 'ov:test' }, onclick: e => testViewers(e.currentTarget) }, icon('zap'), t('home.ovl.testViewers')),
    (poll || goal) && h('button.btn.sm', { type: 'button', dataset: { focus: 'ov:test' }, onclick: e => testWidget(id, e.currentTarget) }, icon('zap'), t(poll ? 'home.ovl.testPoll' : 'home.ovl.testGoal')),
    el.ovStatus = h('p.small.muted', { attrs: { role: 'status' } }),
  ].filter(c => c instanceof Node)));
}

/** A sample alert for the preview and the OBS source (sent after any pending save, so it respects the toggles just changed). */
async function testAlert(button) {
  const s = ovSyncOf('alerts');
  await busy(button, () => (s.queue = s.queue.then(() => api('/api/overlays/alerts/test', { method: 'POST' }))));
  ovStatus(t('home.ovl.tested'));
}

/** A test change of the viewer total (preview and OBS source), after any pending save. */
async function testViewers(button) {
  const s = ovSyncOf('viewers');
  await busy(button, () => (s.queue = s.queue.then(() => api('/api/overlays/viewers/test', { method: 'POST' }))));
  ovStatus(t('home.ovl.testedViewers'));
}

/** A test poll (played by the overlay itself) or goal gain, for the preview and the OBS source, after any pending save. */
async function testWidget(id, button) {
  const s = ovSyncOf(id);
  await busy(button, () => (s.queue = s.queue.then(() => api(`/api/overlays/${id}/test`, { method: 'POST' }))));
  ovStatus(t(id === 'poll' ? 'home.ovl.testedPoll' : 'home.ovl.testedGoal'));
}

/** 'hello' / 'overlay' frames: settings changed elsewhere (another tab, a reset). Our own echoes are skipped. */
function setOverlays(next) {
  let changed = false;
  for (const id of OVERLAY_IDS) {
    if (!next?.[id] || ovQuiet(id)) continue;
    S.state.overlays = { ...S.state.overlays, [id]: cleanOverlay(next[id], OV_DEFAULTS[id]) };
    changed ||= id === ovId;
  }
  if (changed) renderOverlayForm();
}

// ---------------------------------------------------------------- 6. settings
function renderSettings() {
  if (!el.settings) return;
  const theme = document.documentElement.dataset.theme || 'dark';
  const row = (title, desc, control) => h('div.set-row', h('div.set-row-text', h('strong', title), desc && h('p.small.muted', desc)), control);
  const rotate = (what, label) => h('button.btn.sm.danger', { type: 'button', dataset: { focus: `sec:${what}` }, onclick: e => rotateKey(what, e.currentTarget) }, icon(what === 'sessions' ? 'x' : 'refresh'), label);
  const pw = S.session?.passwordRequired;
  const sessionsBtn = rotate('sessions', t('home.sec.signOut'));
  sessionsBtn.disabled = !pw;
  keepFocus(() => el.settings.replaceChildren(
    sectionHead('settings', t('home.set.title')),
    h('div.set-grid',
      h('div.card',
        h('h3.card-title', icon('globe'), t('home.set.appearance')),
        row(t('common.lang'), t('home.set.langDesc'), segmented(t('common.lang'), [['fr', 'Français'], ['en', 'English']], lang(), v => { setLang(v); saveUi({ lang: v }); }, 'set:lang')),
        row(t('common.theme'), t('home.set.themeDesc'), segmented(t('common.theme'), ['dark', 'light', 'auto'].map(v => [v, t(`home.set.${v}`)]), theme, v => { applyTheme(v); saveUi({ theme: v }); }, 'set:theme'))),
      h('div.card',
        h('h3.card-title', icon('shield'), t('home.sec.title')),
        banner(pw ? 'ok' : 'info', t(pw ? 'home.sec.password' : 'home.sec.local')),
        row(t('home.sec.dock'), t('home.sec.dockDesc'), rotate('dock', t('home.sec.rotate'))),
        row(t('home.sec.overlay'), t('home.sec.overlayDesc'), rotate('overlay', t('home.sec.rotate'))),
        row(t('home.sec.sessions'), t(pw ? 'home.sec.sessionsDesc' : 'home.sec.sessionsLocal'), sessionsBtn)),
      S.state.automod && automodCard(),
      h('div.card.about',
        h('div.row', h('img', { src: '/assets/logo-3d.webp', alt: '', width: 36, height: 36 }),
          h('div.about-head', h('strong', 'Tramevia Dock'), h('p.small.muted', versionLine())),
          S.update && checkButton()),
        h('p.small.muted', t('home.about.desc')),
        supportBox(),
        S.update && updateSettings(),
        h('div.about-links',
          extLink(REPO, icon('external', 14), ' ', t('home.about.repo')),
          extLink(`${REPO}#readme`, icon('external', 14), ' ', t('home.about.docs')),
          extLink(`${REPO}/issues`, icon('external', 14), ' ', t('home.about.issues')))))));
}

/** Auto filters (banned words, links) on every platform. Saved whole on each change; the server keeps what it validated. */
function automodCard() {
  const a = S.state.automod;
  const save = patch => api('/api/automod', { method: 'PUT', body: { ...a, ...patch } })
    .then(r => { S.state.automod = r; renderSettings(); }, err => toast(err.message, 'error', 6000));
  const row = (title, desc, control) => h('div.set-row', h('div.set-row-text', h('strong', title), desc && h('p.small.muted', desc)), control);
  const toggle = (key, label) => h('label.set-row.set-toggle',
    h('span.set-row-text', h('strong', t(`home.am.${label}`)), h('span.small.muted', t(`home.am.${label}Desc`))),
    h('span.switch', h('input', { type: 'checkbox', checked: a[key], dataset: { focus: `am:${key}` }, onchange: e => save({ [key]: e.target.checked }) }), h('span')));
  const words = h('textarea', {
    id: 'am-words', rows: 4, value: a.words.join('\n'), placeholder: t('home.am.wordsPlaceholder'), dataset: { focus: 'am:words' },
    onchange: () => save({ words: words.value.split(/[\n,]/) }), // one per line or comma-separated
  });
  const allowed = h('textarea', {
    id: 'am-allowed', rows: 3, value: a.allowedLinks.join('\n'), placeholder: 'youtube.com\nclips.twitch.tv', dataset: { focus: 'am:allowed' },
    onchange: () => save({ allowedLinks: allowed.value.split(/[\s,]/) }),
  });
  return h('div.card',
    h('h3.card-title', icon('filter'), t('home.am.title')),
    h('p.small.muted', t('home.am.desc')),
    h('div.field', h('label', { htmlFor: words.id }, t('home.am.words')), words, h('p.tiny.muted', t('home.am.wordsHint'))),
    toggle('links', 'links'),
    a.links && h('div.field', h('label', { htmlFor: allowed.id }, t('home.am.allowed')), allowed, h('p.tiny.muted', t('home.am.allowedHint'))),
    h('h4.set-sub', t('home.am.spam')),
    ['caps', 'repeat', 'emotes', 'symbols'].map(k => toggle(k, k)),
    row(t('home.am.action'), t('home.am.actionDesc'), segmented(t('home.am.action'), [['delete', t('home.am.delete')], ['timeout', t('home.am.timeout')]], a.action, v => save({ action: v }), 'am:action')),
    a.action === 'timeout' && row(t('home.am.duration'), null, segmented(t('home.am.duration'), AM_DURATIONS.map(([s, k]) => [s, t(k)]), a.duration, v => save({ duration: v }), 'am:duration')),
    toggle('exemptVip', 'vip'),
    toggle('exemptSub', 'sub'));
}
const AM_DURATIONS = [[60, 'home.am.1m'], [600, 'home.am.10m'], [3600, 'home.am.1h'], [86400, 'home.am.24h']];

/** About card: the support button and the supporter code that unlocks the supporter alert styles. */
function supportBox() {
  const sup = S.state.supporter;
  if (sup && !sup.expired) {
    return h('div.stack.tight.support-box', h('strong', t('home.sup.title')),
      h('p.small', icon('check', 14), ' ', t(sup.until ? 'home.sup.activeUntil' : 'home.sup.active', { name: sup.name, date: sup.until && day(sup.until) })),
      S.state.premium && h('p.small.muted', t(`home.sup.pack.${S.state.premium.status}`, { v: S.state.premium.version })),
      h('div.row.tight', supportButton(),
        h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'sup:remove' }, onclick: e => setSupporter(null, e.currentTarget) }, t('home.sup.remove'))));
  }
  const input = h('input', { id: 'sup-code', type: 'text', autocomplete: 'off', spellcheck: false, placeholder: 'TD1-…', dataset: { focus: 'sup:code' } });
  return h('div.stack.tight.support-box', h('strong', t('home.sup.title')), h('p.small.muted', t('home.sup.desc')),
    h('div', supportButton()),
    sup?.expired && h('p.small.muted', t('home.sup.expired', { date: day(sup.until) })),
    h('form.row.tight', { onsubmit: e => { e.preventDefault(); setSupporter(input.value, e.submitter); } },
      h('label.sr-only', { htmlFor: input.id }, t('home.sup.code')), input,
      h('button.btn.sm', { type: 'submit', dataset: { focus: 'sup:activate' } }, t('home.sup.activate'))));
}

/** Adds (code) or removes (null) the supporter code, then redraws what depends on it. Errors are toasted by busy(). */
async function setSupporter(code, button) {
  await busy(button, async () => {
    const r = await api('/api/supporter', code === null ? { method: 'DELETE' } : { method: 'PUT', body: { code } });
    S.state.supporter = r.supporter;
    S.state.unlocked = Boolean(r.supporter && !r.supporter.expired);
    S.state.premium = r.premium;
    toast(t(code === null ? 'home.sup.removed' : 'home.sup.ok'), 'ok', 5000);
    renderSettings();
    renderOverlayForm();
  });
}

/** 2026-11-30 → "30 novembre" / "November 30" (dates are UTC days). */
const day = d => new Date(`${d}T00:00:00Z`).toLocaleDateString(lang(), { day: 'numeric', month: 'long', timeZone: 'UTC' });

async function rotateKey(what, button) {
  const ok = await confirmDialog({ title: t(`home.sec.${what}Title`), body: t(`home.sec.${what}Body`), confirm: what === 'sessions' ? t('home.sec.signOut') : t('home.sec.rotate'), danger: true });
  if (!ok) return;
  await busy(button, async () => {
    const previousDock = S.keys.dock;
    S.keys = await api('/api/security/rotate', { body: { what } });
    if (what === 'dock' && accessKey && accessKey === previousDock) {
      // This page itself runs on the dock key (dashboard dock): reload it with the new one.
      const url = new URL(location.href);
      url.searchParams.set('key', S.keys.dock);
      return location.replace(url);
    }
    toast(t(what === 'sessions' ? 'home.sec.signedOut' : 'home.sec.rotated'), 'ok', 6000);
    renderObs();
  });
}

// ---------------------------------------------------------------- 7. updates (About card + home banner)
const major = v => Number(String(v).split('.')[0]);
/** UPDATE_CHECK=0 on the server: checks are off although the dashboard setting is not. */
const checksEnvOff = () => !S.update.checks && S.ui.updateCheck !== false;

function setUpdate(u) {
  if (!u || typeof u !== 'object') return;
  S.update = u;
  renderOverview();
  renderSettings();
}
const refreshUpdate = () => api('/api/update').then(setUpdate, () => {});

function versionLine() {
  const u = S.update;
  const parts = [t('home.about.version', { v: S.state.version })];
  if (u && !checksEnvOff()) {
    parts.push(u.latest ? t('home.upd.availableShort', { v: u.latest.version }) : u.checkedAt ? t('home.upd.upToDate') : null);
    parts.push(u.checkedAt ? t('home.upd.checked', { ago: fmt.ago(u.checkedAt) }) : t('home.upd.never'));
  }
  return parts.filter(Boolean).join(' · ');
}

function checkButton() {
  return h('button.btn.sm', {
    type: 'button', dataset: { focus: 'upd:check' }, disabled: checksEnvOff() || S.update.state === 'installing',
    onclick: e => busy(e.currentTarget, async () => {
      setUpdate(await api('/api/update/check', { body: {} }));
      if (!S.update.latest) toast(t('home.upd.upToDateToast'), 'ok');
    }),
  }, icon('refresh'), t('home.upd.check'));
}

function updateSettings() {
  const u = S.update;
  const envOff = checksEnvOff();
  const toggle = (key, on, disabled, label) => h('label.set-row.set-toggle',
    h('span.set-row-text', h('strong', t(`home.upd.${label}`)), h('span.small.muted', t(`home.upd.${label}Desc`))),
    h('span.switch', h('input', {
      type: 'checkbox', checked: on, disabled, dataset: { focus: `upd:${key}` },
      onchange: e => saveUi({ [key]: e.target.checked }).then(refreshUpdate),
    }), h('span')));
  return [
    envOff && banner('info', t('home.upd.disabledEnv')),
    updateNotice('set'),
    toggle('updateCheck', !envOff && S.ui.updateCheck !== false, envOff, 'autoCheck'),
    u.type === 'zip' && toggle('updateAuto', S.ui.updateAuto === true, !u.checks, 'autoInstall'),
  ];
}

/** Banner for the current update state, or null. `where` keeps focus keys unique (home banner + About card). */
function updateNotice(where) {
  const u = S.update;
  if (!u) return null;
  const v = u.latest?.version;
  const zip = u.type === 'zip';
  const btn = (key, cls, ic, label, onclick, disabled = false) =>
    h(`button.btn.sm${cls}`, { type: 'button', disabled, dataset: { focus: `upd-${where}:${key}` }, onclick }, icon(ic), label);
  const retry = v && zip && btn('retry', '', 'refresh', t('common.retry'), e => installUpdate(e.currentTarget));
  if (u.state === 'installing') {
    return h('div.banner.info.small.upd-installing', { attrs: { role: 'status' } },
      h('span.spinner', { attrs: { 'aria-hidden': 'true' } }), h('div.banner-text', t('home.upd.installing', { v: v || '' })));
  }
  if (u.state === 'error') return banner('danger', t('home.upd.error', { reason: u.error || '?' }), retry && h('div.row', retry));
  if (u.failed && (!v || v === u.failed.version)) {
    return banner('warn', h('strong', t('home.upd.failed', { v: u.failed.version })),
      u.failed.reason && h('span.tiny.muted', u.failed.reason),
      h('div.row', linkBtn(`${REPO}/issues/new`, t('home.upd.report')), retry));
  }
  if (!v) return null;
  const notes = /^https:\/\//.test(u.latest.notesUrl || '') ? u.latest.notesUrl : `${REPO}/releases`;
  const image = u.image || 'ghcr.io/tramevia/tramevia-dock';
  const big = major(v) > major(u.current);
  const steps = {
    docker: () => [t(big ? 'home.upd.dockerMajor' : 'home.upd.docker'), big && copyField(`image: ${image}:${major(v)}`), copyField('docker compose pull && docker compose up -d')],
    railway: () => [t(big ? 'home.upd.railwayMajor' : 'home.upd.railway'), copyField(`${image}:${v}`)],
    git: () => [t('home.upd.git'), copyField('git pull')],
    manual: () => [t('home.upd.manual')],
  }[u.type]?.() || [];
  const live = u.live === 'live'; // the server republishes 'update' whenever this changes
  return banner('info', h('strong', t('home.upd.title', { v })),
    steps.map(s => (typeof s === 'string' ? h('span', s) : s)),
    h('div.row',
      linkBtn(notes, t(u.type === 'manual' ? 'home.upd.download' : 'home.upd.notes')),
      zip && btn('install', '.primary', 'zap', t('home.upd.install'), e => installUpdate(e.currentTarget), live),
      zip && live && h('span.small.muted', t('home.upd.afterLive'))));
}

/** Confirm, then ask the server to install. Live status unknown → explicit "install anyway" (force). */
async function installUpdate(button, force = S.update?.live === 'unknown') {
  const v = S.update?.latest?.version;
  if (!v) return;
  const names = S.accounts.filter(a => a.status === 'ok' && typeof a.stats?.live !== 'boolean')
    .map(a => `${a.displayName} (${platform(a.platform)?.name || a.platform})`).join(', ');
  const ok = await confirmDialog(force
    ? { title: t('home.upd.unknownTitle'), body: t('home.upd.unknownBody', { names: names || t('home.upd.someAccount') }), confirm: t('home.upd.installAnyway') }
    : { title: t('home.upd.confirmTitle', { v }), body: t('home.upd.confirmBody'), confirm: t('home.upd.install') });
  if (!ok) return;
  let unknown = false;
  await busy(button, async () => {
    try { await api('/api/update/install', { body: { version: v, force } }); } catch (err) {
      if (err.code !== 'live_unknown' || force) throw err;
      unknown = true; // the server saw an unknown live status we did not: ask again, with force
    }
  });
  if (unknown) installUpdate(button, true);
}

// ---------------------------------------------------------------- realtime + boot
function setAccounts(list) {
  if (!Array.isArray(list)) return;
  resolvePending(list);
  const idsChanged = list.map(a => a.id).join() !== S.accounts.map(a => a.id).join();
  S.accounts = list;
  renderOverview();
  renderAccounts();
  if (idsChanged) renderObs();
}

function onFrame({ t: topic, d }) {
  if (!S.apps || !el.overview) return;
  if (topic === 'hello') { // reconnect after a restart (e.g. rolled-back update)
    setAccounts(d.accounts); refreshUpdate(); setOverlays(d.overlays); if ('overlaysSaved' in d) S.state.overlaysSaved = d.overlaysSaved; migrateOverlay();
    if ('poll' in d) { S.state.poll = d.poll; renderPoll(); }
    if (d.goals) { S.state.goals = d.goals; paintGoals(); }
    api('/api/live').then(r => { S.live = r; paintSummary(); }, () => {});
  }
  else if (topic === 'accounts') setAccounts(d);
  else if (topic === 'update') setUpdate(d);
  else if (topic === 'live') { S.live = d; paintSummary(); }
  else if (topic === 'poll') { const was = S.state.poll; S.state.poll = d; if (!d || !was || d.id !== was.id || Boolean(d.closedAt) !== Boolean(was.closedAt)) renderPoll(); else paintPoll(); }
  else if (topic === 'goal') { S.state.goals = d; paintGoals(); }
  else if (topic === 'overlay' && OVERLAY_IDS.includes(d?.id)) setOverlays({ [d.id]: d.settings });
  else if (topic === 'stats') {
    const a = S.accounts.find(x => x.id === d.accountId);
    if (a) { a.stats = d; paintStats(); }
  } else if (topic === 'settings' && d && !uiWrites && Date.now() - uiLastWrite > 1500) {
    const before = S.ui;
    S.ui = d;
    if (d.updateCheck !== before.updateCheck || d.updateAuto !== before.updateAuto) refreshUpdate(); // changed in another tab
    if (d.lang && d.lang !== lang() && !query.get('lang')) return setLang(d.lang); // re-renders via od:lang
    if (d.theme && d.theme !== document.documentElement.dataset.theme && !query.get('theme')) { applyTheme(d.theme); renderSettings(); }
    if (Boolean(d.obsDocks) !== Boolean(before.obsDocks)) { renderOverview(); renderObs(); }
  }
}

async function load() {
  el.root.replaceChildren(skeleton());
  try {
    // bot, discord and live come with the state (null: that module failed to load).
    ({ bot: S.bot = null, discord: S.discord = null, live: S.live = null } = S.state);
    [S.apps, S.keys, S.session, S.update] = await Promise.all([api('/api/apps'), api('/api/keys'), api('/api/session'), api('/api/update').catch(() => null)]);
    render();
  } catch (err) {
    el.root.replaceChildren(h('div.page.narrow', h('div.card.empty',
      h('div.big', icon('alert', 28)), h('h2', t('home.loadError')), h('p.muted', err.message),
      h('button.btn.primary', { type: 'button', onclick: load }, icon('refresh'), t('common.retry')))));
  }
}

window.addEventListener('od:lang', () => {
  document.title = `${t('nav.home')} · Tramevia Dock`;
  for (const k of Object.keys(forms)) delete forms[k];
  if (S.apps) keepFocus(render); // render() replaces the pressed language button
});

boot({
  page: '/',
  title: t('nav.home'),
  async onReady(state, root) {
    S.state = state;
    S.accounts = state.accounts || [];
    S.ui = state.ui || {};
    S.state.overlays = allOverlays(state.overlays);
    el.root = root;
    await load();
    migrateOverlay();
  },
  onFrame,
});
