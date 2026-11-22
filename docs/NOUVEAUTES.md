# Nouveautés de RiftMancer

Texte pour les utilisateurs de l’appli, une section par version distribuée
(« ## 2.2.0 — date »), affichée dans l’appli en français (la version anglaise est
docs/WHATS-NEW.md). `npm run release -- <version>` en tire `NOUVEAUTES.txt` et refuse
de construire un paquet tant que la section de la version n’est pas écrite, dans les deux fichiers.

## 2.4.2 — liens Cardmarket directs

- **Liens Cardmarket** : chaque carte ouvre directement sa page (…/Singles/Unleashed/Mutated-Mouser), et sa promo la page promo (…/Unleashed-Promos/Mutated-Mouser).
- **Prix** : les prix des cartes et des promos sont de nouveau justes ; ils se mettent à jour dès le lancement de l’appli.

## 2.4.1 — prix payé, barre du téléphone

- **Prix payé et date d’achat** : dans la fiche d’une carte, onglet Prix → « Mon achat », indiquez combien vous l’avez payée et quand ; c’est affiché à droite de la rareté.
- **Barre du téléphone** : Collection · Cartes · Valeur · Scanner · Decks · Boîtes · Plus.
- **Onglet Cartes** : des cartes plus grandes sur PC, et le prix sous chaque carte sur téléphone.

## 2.4.0 — l’onglet Cartes

- **Nouvel onglet « Cartes »** : tout le catalogue Riftbound, possédé ou non, avec ×N sur les cartes que vous avez. Sur téléphone il est entre Collection et Scanner ; **Valeur passe dans « Plus »**. Dans la Collection, la vue « Cartes » s’appelle maintenant « Mes cartes ».
- **Une seule barre de recherche** : un nom, un numéro, ou des clés comme `t:unité d:esprit e<=3 own:0` (le « ? » donne toute la syntaxe). Les filtres (domaines, sets, type, énergie, **puissance**, rareté…) écrivent leur clé dans la barre.
- **Les cartes manquantes restent en couleurs** : « Griser les manquantes » les atténue si vous le souhaitez.
- **Actions rapides** : la fiche d’un clic ou d’un toucher, ajout d’un exemplaire (avec « Annuler »), plusieurs cartes à la fois vers les souhaits ou un deck, « Manquantes → souhaits », export CSV. Sur téléphone, l’icône Scanner de la recherche retrouve une carte sans l’ajouter.
- **Mémoire** : l’onglet garde votre recherche, vos filtres et votre position.

## 2.3.0 — impressions et promos, rulings, une collection plus pratique

- **Toutes les impressions de chaque carte** : Réglages → Contenu → Cartes → « Rechercher » apporte maintenant les promos (Organized Play, Judge, lancement, Metal…), les cartes K/DA et toutes les variantes (illustration alternative, overnumbered, signature, showcase), avec leurs images et, dès l’installation, le nom français de la même carte. Dans la fiche d’une carte, « Impressions et variantes » les liste toutes avec leur prix et combien vous en avez.
- **Rulings** : les questions et réponses de Riftbound FAQ dans la fiche de chaque carte (touchez une question pour lire la réponse, avec les liens vers les règles). À installer depuis Réglages → Contenu → Rulings ; non officiels, en anglais.
- **Les symboles du jeu** : gemme de rareté devant le nom de la carte, runes, « n’importe quelle rune », Épuisement et Puissance comme sur les cartes, icônes des domaines, et le coût de recyclage (en runes) à côté de l’énergie.
- **Collection** : un bouton « Ajouter » à côté du tri (une carte par son nom ou son numéro), les domaines dans un menu déroulant, plus de trait de couleur au-dessus des cartes. En ouvrant une carte, vous voyez combien vous en avez, avec − et + pour en retirer ou en ajouter une, et « Promo » pour marquer les promos (badge PROMO et filtre « Promo »).
- **Scanner du PC** : le mode « Grille » du téléphone (une page de classeur sous la webcam).
- **Contenu** : la liste des cartes et les cartes bannies viennent d’abord de rifthunt.com (les pages de Riot quand il ne répond pas) ; Réglages → Contenu → « Prix Cardmarket » montre leur date et peut les mettre à jour tout de suite.

## 2.2.0 — RiftMancer, en anglais, cartes au premier lancement

- **Nouveau nom : RiftMancer.** L’appli change de nom et d’identité Android : elle s’installe comme une nouvelle appli. Synchronisez d’abord le téléphone avec le PC, puis désinstallez l’ancienne appli « Riftbound Scanner ».
- **Anglais et français** : toute l’appli est en anglais, ou en français quand votre téléphone ou votre PC est en français. Changez-la dans Réglages → Affichage → « Language · Langue ». Les noms et textes des cartes suivent la langue de l’appli.
- **Cartes au premier lancement** : la version publiée sur GitHub est livrée sans les cartes (elles appartiennent à Riot Games). Sur le PC, « Récupérez les cartes » propose « Télécharger les cartes » depuis la galerie officielle (environ 170 Mo, une dizaine de minutes) ou « Importer un dossier… » (un dossier de cartes déjà téléchargées, une clé USB). Le téléphone les reçoit du PC à la synchro.
- **Galerie officielle** : Riot l’a déplacée sur playriftbound.com ; « Rechercher de nouvelles cartes » fonctionne de nouveau.
- **Logiciel libre** : RiftMancer est sous licence GNU AGPL-3.0 ; son code est sur github.com/FaZox/RiftMancer.

## 2.1.1 — scanner par grille, classeur, crédits

- **Scanner par grille** : nouveau mode « Grille » dans l’onglet Scanner (bouton à quatre carrés). Tenez le téléphone au-dessus d’une page de classeur ou de cartes posées à plat : un cadre s’affiche sur chaque carte, la photo se prend toute seule quand rien ne bouge, puis vous vérifiez la page (vert : reconnue, orange : à choisir) et touchez « Ajouter · page suivante ». La même page n’est jamais prise deux fois.
- **Classeur** : quand « Ranger dans » est une boîte, chaque carte y est rangée avec sa page et sa case (« p. 4, case 7 »). Le numéro de page se corrige avec − / +, une page déjà prise est signalée, et l’écran de la boîte montre chaque page case par case.
- **Caméra plus claire** : en mode Caméra, la carte n’est plus assombrie ; seul l’extérieur du cadre l’est.
- **En-tête du scanner** : il tient désormais dans l’écran des téléphones étroits.
- **Crédits et licence** : Réglages → À propos indique que l’appli est basée sur riftbound-scanner de Nekoraru22 (licence MIT) et reprend la mention officielle de Riot Games ; « Licences » affiche aussi la licence de l’appli. Les fichiers LICENSE.txt et THIRD_PARTY_LICENSES.txt sont joints à la version.

## 2.1.0 — première version distribuée

- **Scanner** : les cartes sont reconnues par l’intelligence artificielle et par les couleurs ; quand l’appli hésite, elle vous demande. Mode mains libres (téléphone sur un support) et sons discrets en option ; illustrations alternatives et cartes signées reconnues.
- **Collection et decks** : souhaits, boîtes, prêts ; decks Standard et 2v2 avec les cartes bannies, versions d’un deck, notes contre chaque Légende adverse, codes de deck à partager et texte pour l’inscription aux tournois.
- **Matchs** : compteur de points en 1v1, 2v2 ou chacun pour soi, avec l’historique point par point et la reprise d’une partie interrompue.
- **Prix Cardmarket** : valeur de la collection, variation sur 7 et 30 jours, versions foil et promo ; un prix estimé est marqué « ≈ ». Alertes quand une de vos cartes monte ou baisse fortement, et résumé après chaque mise à jour des prix.
- **Entre amis** : échangez vos listes (doubles et souhaits) par fichier, voyez ce que chacun peut donner à l’autre et préparez l’échange avec le calculateur.
- **Synchronisation** : chiffrée entre le téléphone et le PC, sur votre Wi-Fi ; un rappel quand des changements attendent ; les fiches modifiées des deux côtés sont signalées.
- **Sauvegardes** : automatiques sur le PC (et, si vous voulez, sur une clé USB) et sur le téléphone, avec restauration.
- **Contenu à jour sans réinstaller** : nouvelles cartes, traductions françaises et cartes bannies se mettent à jour depuis l’appli PC, puis arrivent sur le téléphone à la synchro.
- **Appli plus légère** : les grandes images des cartes arrivent sur le téléphone à la première synchro avec le PC.
- **En cas de problème** : un écran de secours garde vos cartes à l’abri, et « Créer un rapport » (Réglages → Aide) prépare un fichier à envoyer, sans aucune donnée personnelle.
