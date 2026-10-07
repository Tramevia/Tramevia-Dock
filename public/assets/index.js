// Tramevia Dock — dashboard (home + onboarding): overview, accounts, setup wizards, OBS docks & overlay builder, settings.
import {
  boot, h, api, t, addI18n, lang, setLang, applyTheme, openAuth, copy, copyField, toast, busy,
  confirmDialog, fmt, icon, platformIcon, store, withKey, accessKey, query, $, $$,
} from '/assets/core.js';

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
    'home.ovl.sub': 'Affiche ton chat sur le stream. Règle-le ici, puis copie l’adresse dans une source Navigateur.',
    'home.ovl.how': 'Dans OBS : Sources → + → Navigateur → colle l’URL, largeur 400, hauteur 600. Tes réglages sont dans l’adresse : après un changement, recopie-la dans la source (clic droit → Propriétés → URL).',
    'home.ovl.readonly': 'Cette adresse utilise la clé overlay, en lecture seule : elle ne permet aucune action sur tes comptes.',
    'home.ovl.mode': 'Type', 'home.ovl.mode.chat': 'Chat', 'home.ovl.mode.featured': 'Message mis en avant',
    'home.ovl.featuredHint': 'Affiche seulement le message que tu mets en avant depuis le dock Chat.',
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
    'home.ovl.url': 'Adresse de l’overlay', 'home.ovl.preview': 'Aperçu en direct',
    'home.ovl.previewHint': 'Le damier représente la transparence.', 'home.ovl.previewTitle': 'Aperçu de l’overlay de chat',
    'home.ovl.reset': 'Réinitialiser',
    'home.set.title': 'Paramètres', 'home.set.appearance': 'Apparence',
    'home.set.langDesc': 'Langue de l’interface.', 'home.set.themeDesc': 'Sombre conseillé dans OBS.',
    'home.set.dark': 'Sombre', 'home.set.light': 'Clair', 'home.set.auto': 'Auto',
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
    'home.sec.overlayBody': 'L’ancienne adresse de l’overlay ne donnera plus accès : recopie la nouvelle dans la source Navigateur d’OBS. (Sans mot de passe, un overlay ouvert sur ce PC continue de marcher.)',
    'home.sec.sessionsTitle': 'Déconnecter toutes les sessions ?',
    'home.sec.sessionsBody': 'Tous les navigateurs, y compris celui-ci, devront ressaisir le mot de passe. Les docks OBS (clé) ne sont pas concernés.',
    'home.sec.rotated': 'Nouvelle clé générée : mets à jour les adresses dans OBS.',
    'home.sec.signedOut': 'Toutes les sessions ont été déconnectées.',
    'home.about.title': 'À propos', 'home.about.version': 'Version {v}',
    'home.about.desc': 'Logiciel libre et auto-hébergé : tes identifiants restent sur ton serveur.',
    'home.about.repo': 'Code source sur GitHub', 'home.about.docs': 'Documentation', 'home.about.issues': 'Signaler un problème',
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
    'home.ovl.sub': 'Shows your chat on stream. Tune it here, then copy the address into a Browser source.',
    'home.ovl.how': 'In OBS: Sources → + → Browser → paste the URL, width 400, height 600. Your settings live in the address: after a change, paste it again into the source (right-click → Properties → URL).',
    'home.ovl.readonly': 'This address uses the read-only overlay key: it cannot act on your accounts.',
    'home.ovl.mode': 'Type', 'home.ovl.mode.chat': 'Chat', 'home.ovl.mode.featured': 'Featured message',
    'home.ovl.featuredHint': 'Shows only the message you feature from the Chat dock.',
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
    'home.ovl.url': 'Overlay address', 'home.ovl.preview': 'Live preview',
    'home.ovl.previewHint': 'The checkerboard shows transparency.', 'home.ovl.previewTitle': 'Chat overlay preview',
    'home.ovl.reset': 'Reset',
    'home.set.title': 'Settings', 'home.set.appearance': 'Appearance',
    'home.set.langDesc': 'Interface language.', 'home.set.themeDesc': 'Dark recommended in OBS.',
    'home.set.dark': 'Dark', 'home.set.light': 'Light', 'home.set.auto': 'Auto',
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
    'home.sec.overlayBody': 'The old overlay address will no longer grant access: copy the new one into the OBS Browser source. (Without a password, an overlay opened on this PC keeps working.)',
    'home.sec.sessionsTitle': 'Sign out all sessions?',
    'home.sec.sessionsBody': 'Every browser, including this one, will have to enter the password again. OBS docks (key) are not affected.',
    'home.sec.rotated': 'New key generated: update the addresses in OBS.',
    'home.sec.signedOut': 'All sessions were signed out.',
    'home.about.title': 'About', 'home.about.version': 'Version {v}',
    'home.about.desc': 'Free and self-hosted software: your credentials stay on your server.',
    'home.about.repo': 'Source code on GitHub', 'home.about.docs': 'Documentation', 'home.about.issues': 'Report a problem',
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
const SECTIONS = [['overview', 'home'], ['accounts', 'users'], ['obs', 'monitor'], ['settings', 'settings']];
const DOCKS = [['chat', '/chat', 'chat'], ['events', '/events', 'zap'], ['community', '/community', 'users'], ['stream', '/stream', 'edit'], ['home', '/', 'home']];
const OV_BOOLS = ['hideBots', 'hideCommands', 'events', 'badges', 'icons', 'avatars', 'bubble', 'outline', 'credit'];
const OV_DEFAULTS = {
  mode: 'chat', theme: 'dark', max: 20, fade: 0, size: 16, align: 'left', featureSeconds: 15,
  hideBots: true, hideCommands: true, events: true, badges: true, icons: true, avatars: false, bubble: false, outline: true, credit: false,
  offPlatforms: [], offAccounts: [],
};
const AUTH_TIMEOUT = 600_000; // server forgets the OAuth state after 10 min

const S = { state: null, accounts: [], apps: null, keys: null, session: null, ui: {}, pending: {}, update: null };
const el = {};
const forms = {}; // username forms survive re-renders (keeps typed text)
let ov = { ...OV_DEFAULTS, ...store.get('home.overlay', {}) };
let spy = null;
let previewTimer = 0;

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
    h('div.onb-head', hero && h('img', { src: '/assets/logo.svg', alt: '' }),
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
        h('span.section-title', t('home.ov.total')),
        h('span.ov-total-num', { id: 'ov-total' }, '—'),
        h('span.small.muted', { id: 'ov-count' })),
      h('div.card.flush.ov-live',
        h('div.ov-live-head', h('h3', t('home.ov.channels')), h('a.btn.ghost.sm', { href: '#accounts', dataset: { focus: 'ov:manage' } }, t('home.ov.manage'))),
        h('ul.ov-list', S.accounts.map(a => h(`li.ov-row.pf-${a.platform}`,
          platformIcon(a.platform),
          h('div.ov-row-main', h('div.ellipsis.strong', a.displayName), h('div.small.muted.ellipsis', { dataset: { meta: a.id } })),
          statusBadge(a, true),
          h('div.ov-row-stat', { dataset: { live: a.id } })))))),
    quickLinks()));
  paintStats();
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

// ---------------------------------------------------------------- 2. accounts
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

// ---------------------------------------------------------------- 3. setup wizard
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

// ---------------------------------------------------------------- 4. OBS
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

function overlayParams() {
  const q = new URLSearchParams({ key: S.keys.overlay });
  const featured = ov.mode === 'featured';
  if (featured) q.set('mode', 'featured');
  q.set('theme', ov.theme);
  if (featured) q.set('featureSeconds', ov.featureSeconds); else { q.set('max', ov.max); q.set('fade', ov.fade); }
  q.set('size', ov.size);
  q.set('align', ov.align);
  for (const k of OV_BOOLS) if (!featured || !['hideBots', 'hideCommands', 'events'].includes(k)) q.set(k, ov[k] ? '1' : '0');
  if (!featured) {
    const pfs = S.state.platforms.map(p => p.id).filter(id => !ov.offPlatforms.includes(id));
    if (ov.offPlatforms.length && pfs.length) q.set('platforms', pfs.join(','));
    const accs = S.accounts.map(a => a.id).filter(id => !ov.offAccounts.includes(id));
    if (S.accounts.some(a => ov.offAccounts.includes(a.id)) && accs.length) q.set('accounts', accs.join(','));
  }
  return q;
}

function renderOverlay() {
  const featured = ov.mode === 'featured';
  const urlBox = h('div');
  const frame = h('iframe', { title: t('home.ovl.previewTitle'), loading: 'lazy' });
  const update = () => {
    store.set('home.overlay', ov);
    const q = overlayParams();
    keepFocus(() => urlBox.replaceChildren(secretField(`${S.state.publicUrl}/overlay/chat?${q}`, 'ov:url')));
    frame.style.setProperty('color-scheme', ov.theme === 'light' ? 'light' : 'dark'); // must match the overlay page or the iframe turns opaque
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { frame.src = `/overlay/chat?${q}`; }, 350);
  };
  const num = (key, min, max) => {
    const input = h('input', {
      id: `ov-${key}`, type: 'number', min, max, step: 1, value: ov[key],
      oninput: () => {
        const n = Number(input.value);
        const ok = input.value !== '' && Number.isInteger(n) && n >= min && n <= max;
        if (ok) { ov[key] = n; update(); }
        if (ok) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
      },
    });
    return h('div.field', h('label', { htmlFor: input.id }, t(`home.ovl.${key}`)), input);
  };
  const toggle = key => h('label.switch', h('input', { type: 'checkbox', checked: ov[key], dataset: { focus: `ov:${key}` }, onchange: e => { ov[key] = e.target.checked; update(); } }), h('span'), h('span', t(`home.ovl.${key}`)));
  const chip = (list, all, id, label, iconEl) => h('button.toggle-chip', {
    type: 'button', dataset: { focus: `ov:${list}:${id}` }, attrs: { 'aria-pressed': String(!ov[list].includes(id)) },
    onclick: e => {
      const next = ov[list].includes(id) ? ov[list].filter(x => x !== id) : [...ov[list], id];
      if (all.every(x => next.includes(x))) return; // keep at least one selected
      ov[list] = next;
      e.currentTarget.setAttribute('aria-pressed', String(!ov[list].includes(id)));
      update();
    },
  }, iconEl, label);
  const choice = (key, values, rerender = false) => h('div.field', h('span.label', t(`home.ovl.${key}`)),
    segmented(t(`home.ovl.${key}`), values.map(v => [v, t(`home.ovl.${key}.${v}`)]), ov[key], v => { ov[key] = v; if (rerender) renderOverlay(); else update(); }, `ov:${key}`));
  // Bubbles and outline only change something on the transparent theme (dark/light always draw cards).
  const textOnly = ov.theme === 'transparent';

  keepFocus(() => el.overlay.replaceChildren(
    h('div.ovl-head',
      h('div.stack.tight', h('h3.card-title', icon('layers'), t('home.ovl.title')), h('p.small.muted', t('home.ovl.sub'))),
      h('button.btn.sm.ghost', { type: 'button', dataset: { focus: 'ov:reset' }, onclick: () => { ov = structuredClone(OV_DEFAULTS); renderOverlay(); } }, icon('refresh'), t('home.ovl.reset'))),
    h('div.ov-builder',
      h('div.ov-form',
        h('div.field', h('span.label', t('home.ovl.mode')),
          segmented(t('home.ovl.mode'), [['chat', t('home.ovl.mode.chat')], ['featured', t('home.ovl.mode.featured')]], ov.mode, v => { ov.mode = v; renderOverlay(); }, 'ov:mode')),
        featured && h('p.small.muted', t('home.ovl.featuredHint')),
        h('div.row.ov-choices', choice('theme', ['transparent', 'dark', 'light'], true), choice('align', ['left', 'right'])),
        h('p.small.muted', t(`home.ovl.themeHint.${ov.theme}`)),
        h('div.ov-fields',
          featured ? num('featureSeconds', 0, 300) : [num('max', 1, 100), num('fade', 0, 600)],
          num('size', 10, 48)),
        h('div.stack.tight', h('span.label', t('home.ovl.display')),
          h('div.ov-switches', ['badges', 'icons', 'avatars', ...(textOnly ? ['bubble', 'outline'] : []), 'credit'].map(toggle))),
        !featured && h('div.stack.tight', h('span.label', t('home.ovl.filters')),
          h('div.ov-switches', ['hideBots', 'hideCommands', 'events'].map(toggle))),
        !featured && h('div.stack.tight', h('span.label', t('home.ovl.platforms')),
          h('div.row.tight', S.state.platforms.map((p, _, all) => chip('offPlatforms', all.map(x => x.id), p.id, p.name, platformIcon(p.id))))),
        !featured && S.accounts.length > 1 && h('div.stack.tight', h('span.label', t('home.ovl.accounts')),
          h('div.row.tight', S.accounts.map((a, _, all) => chip('offAccounts', all.map(x => x.id), a.id, a.displayName, platformIcon(a.platform))))),
        h('div.stack.tight', h('span.label', t('home.ovl.url')), urlBox,
          h('p.small.muted', t('home.ovl.how')), h('p.tiny.muted', icon('shield', 12), ' ', t('home.ovl.readonly')))),
      h('div.ov-preview',
        h('div.row', h('span.label', t('home.ovl.preview')), h('span.spacer'), h('span.tiny.muted', t('home.ovl.previewHint'))),
        h('div.checker', frame)))));
  update();
}

// ---------------------------------------------------------------- 5. settings
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
      h('div.card.about',
        h('div.row', h('img', { src: '/assets/logo.svg', alt: '', width: 36, height: 36 }),
          h('div.about-head', h('strong', 'Tramevia Dock'), h('p.small.muted', versionLine())),
          S.update && checkButton()),
        h('p.small.muted', t('home.about.desc')),
        S.update && updateSettings(),
        h('div.about-links',
          extLink(REPO, icon('external', 14), ' ', t('home.about.repo')),
          extLink(`${REPO}#readme`, icon('external', 14), ' ', t('home.about.docs')),
          extLink(`${REPO}/issues`, icon('external', 14), ' ', t('home.about.issues')))))));
}

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

// ---------------------------------------------------------------- 6. updates (About card + home banner)
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
  const toggle = (key, on, disabled, label) => h('label.set-row.upd-toggle',
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
  if (topic === 'hello') { setAccounts(d.accounts); refreshUpdate(); } // reconnect after a restart (e.g. rolled-back update)
  else if (topic === 'accounts') setAccounts(d);
  else if (topic === 'update') setUpdate(d);
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
    el.root = root;
    await load();
  },
  onFrame,
});
