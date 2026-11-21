# RiftMancer — guide d’installation

*English version: FRIENDS-GUIDE.txt (docs/FRIENDS-GUIDE.md).*

Ce dossier contient tout ce qu’il faut pour une version de l’appli :

| Fichier | À quoi il sert |
|---|---|
| `RiftMancer-Setup-<version>.exe` | l’appli PC (Windows) |
| `RiftMancer-<version>.apk` | l’appli Android |
| `NOUVEAUTES.txt` (`WHATS-NEW.txt` en anglais) | ce qui change dans cette version |
| `LISEZ-MOI-AMIS.txt` (`FRIENDS-GUIDE.txt` en anglais) | ce guide |
| `EMPREINTES.txt` | de quoi vérifier que les fichiers sont intacts |
| `LICENSE.txt`, `THIRD_PARTY_LICENSES.txt` | les licences |

Vos cartes restent chez vous : rien ne part sur Internet, le téléphone ne parle qu’à votre PC, sur votre Wi-Fi.

L’appli est en anglais ou en français : **Réglages → Affichage → Langue** (elle démarre en français quand le téléphone ou le PC est en français).

Sur le téléphone, les réglages sont dans l’onglet **Plus → Réglages** ; sur le PC, dans **Réglages** en bas du menu de gauche.

## 1. Vérifier les fichiers (conseillé)

Avant d’installer, vérifiez que les fichiers n’ont pas été abîmés ou modifiés pendant le téléchargement.

1. Dans le dossier téléchargé, faites un clic droit dans une zone vide → « Ouvrir dans le terminal » (ou ouvrez PowerShell et allez dans le dossier).
2. Tapez : `Get-FileHash ".\RiftMancer-Setup-<version>.exe" -Algorithm SHA256` (remplacez `<version>` par le numéro du fichier).
3. Comparez le résultat avec la ligne du même fichier dans `EMPREINTES.txt` : les 64 caractères doivent être identiques (majuscules ou minuscules, peu importe). Faites de même pour l’APK.

Si une empreinte ne correspond pas, n’installez pas ce fichier : téléchargez-le à nouveau et prévenez la personne qui vous l’a donné.

## 2. Installer l’appli PC

1. Lancez `RiftMancer-Setup-<version>.exe`.
2. Windows peut afficher « Windows a protégé votre ordinateur » (SmartScreen) : l’appli n’est pas signée par un éditeur connu de Microsoft. Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
3. Suivez l’installation. Un raccourci « RiftMancer » est créé sur le bureau.
4. Au premier lancement, Windows peut demander d’autoriser l’appli sur le réseau : acceptez pour les **réseaux privés** (votre Wi-Fi à la maison), c’est ce qui permet la synchronisation avec le téléphone.

## 3. Installer l’appli Android

1. Copiez `RiftMancer-<version>.apk` sur le téléphone (câble USB, Drive…).
2. Ouvrez-le depuis l’application Fichiers du téléphone.
3. Android demande d’autoriser l’installation d’applications depuis cette source : autorisez-la pour l’application qui ouvre le fichier (Fichiers, Drive…), puis revenez en arrière et touchez **Installer**.
4. Play Protect peut avertir que l’appli est inconnue : choisissez **Installer quand même**.

## 4. Relier le téléphone au PC (une seule fois)

Le PC et le téléphone doivent être sur le **même Wi-Fi**.

1. Sur le PC : **Réglages → Synchronisation**, affichez le **QR code d’appairage**.
2. Sur le téléphone : **Plus → Réglages → Synchronisation → Scanner le QR code du PC**, et visez l’écran du PC (ou collez le code d’appairage affiché sous le QR code).
3. Le PC affiche « Appareil appairé récemment ». C’est fait : le QR code ne sert plus.

Après l’installation, faites une première synchronisation : le téléphone reçoit alors les grandes images des cartes (en attendant, le zoom montre une image réduite).

## 5. Synchroniser

La synchronisation est toujours lancée par vous, depuis le téléphone (**Plus → Réglages → Synchronisation**, ou le bandeau en haut de **Plus**) :

- **Envoyer sur le PC** : vos changements du téléphone partent sur le PC ;
- **Recevoir du PC** : vous récupérez ceux du PC ;
- **Synchroniser les deux sens** : les deux à la fois. Si la même carte a été modifiée des deux côtés, la modification la plus récente gagne.

Synchronisez régulièrement : c’est aussi ce qui met votre collection à l’abri si le téléphone est perdu.

## 6. Sauvegarder

- **PC** : l’appli sauvegarde toute seule (à l’ouverture, après chaque synchronisation, à la fermeture). **Réglages → Sauvegardes** : « Sauvegarder maintenant » en fait une tout de suite ; « Restaurer » sur une ligne revient en arrière.
- **PC** : dans **Réglages → Sauvegardes**, « Choisir un dossier… » ajoute une copie de chaque sauvegarde sur une clé USB ou un autre disque.
- **Téléphone** : l’appli sauvegarde toute seule (une fois par jour s’il y a eu des changements), et une fois par semaine copie une sauvegarde dans **Documents/Riftbound** (gardée si vous désinstallez l’appli) ; **Réglages → Sauvegardes** les liste, avec « Restaurer » et « Exporter » (copie dans Documents). Le plus sûr reste de synchroniser avec le PC : un bandeau sur la Collection vous le rappelle quand des changements attendent depuis plusieurs jours.

## 7. Mettre à jour le contenu (nouvelles cartes, traductions, cartes bannies)

Le contenu se met à jour **depuis l’appli PC**, sans attendre une nouvelle version de l’appli. Le téléphone le reçoit ensuite à la synchronisation.

1. Sur le PC : **Réglages → Contenu**.
2. **Cartes → Rechercher** : l’appli regarde la galerie officielle et propose les nouvelles cartes. Vérifiez la liste, puis **Installer**. Ne fermez pas l’appli pendant l’installation.
3. **Traductions françaises → Mettre à jour** (traductions de la communauté riftboundfr.fr). Si le téléchargement échoue, **Importer des fichiers…** explique comment récupérer les deux fichiers à la main.
4. **Cartes bannies → Mettre à jour** : lit les annonces officielles de playriftbound.com. « Restaurer la liste précédente » revient en arrière.
5. Synchronisez le téléphone : il reçoit le nouveau contenu.

Si quelqu’un vous donne un **pack** de contenu (fichier déposé sur le Drive) : **Réglages → Contenu → Packs → Importer un pack…**. Pas besoin d’Internet. « Revenir au contenu d’origine » annule toutes les mises à jour de contenu.

## 8. Échanger avec les amis

Rien n’est envoyé automatiquement : les listes passent par des fichiers que chacun dépose où il veut (Drive, message…).

1. **Plus → Échanges et amis** (PC : **Échanges et amis** dans le menu) → **Exporter ma liste** : un petit fichier avec vos doubles et vos souhaits, sans prix payés ni emplacements. Envoyez-le à vos amis.
2. Quand un ami vous envoie la sienne : **Importer la liste d’un ami…**. Une nouvelle liste du même ami remplace l’ancienne.
3. Sa fiche montre ce qu’il a et que vous cherchez, et l’inverse, avec les prix. **Préparer un échange** remplit le **Calculateur**, qui montre l’écart de valeur ; **Enregistrer l’échange** le garde dans l’historique (**Échanges**), d’où vous l’appliquez à votre collection une fois fait.

## 9. Mettre à jour l’appli

Quand une nouvelle version arrive dans le Drive :

1. Synchronisez le téléphone avec le PC (par précaution).
2. **PC** : lancez le nouvel installeur, **sans désinstaller** l’ancienne version. Vos cartes sont gardées.
3. **Téléphone** : installez le nouvel APK **par-dessus** l’ancien, **sans désinstaller**. Vos cartes sont gardées.

Si Android refuse la mise à jour (« Application non installée », « conflit avec un package existant »), ne désinstallez rien et prévenez la personne qui vous a donné l’appli : désinstaller effacerait les cartes du téléphone qui n’ont pas été synchronisées.

## 10. En cas de problème

Si l’appli affiche « Un problème est survenu » : vos cartes ne sont pas perdues. Touchez « Recharger » ; si le problème revient, « Sauvegarder mes données dans un fichier », puis « Créer un rapport ».

Le rapport (aussi dans **Réglages → Aide → Créer un rapport**) est un fichier qui aide à comprendre le problème : versions, réglages du scanner, dernières erreurs. Il ne contient aucune carte, aucun nom, aucun mot de passe, aucune adresse. Envoyez-le, avec ce que vous faisiez et une capture d’écran, à la personne qui vous a donné l’appli. Ne lui envoyez jamais de mot de passe.

## 11. Mentions

Projet de fan gratuit et non commercial.

RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.

> RiftMancer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

RiftMancer est un logiciel libre sous licence GNU AGPL-3.0 (son code source est disponible auprès de la personne qui vous a donné l’appli). L'appli est basée sur riftbound-scanner de Nekoraru22 (licence MIT, https://github.com/Nekoraru22/riftbound-scanner), largement modifié et étendu. Les textes des licences sont dans le paquet (LICENSE.txt, THIRD_PARTY_LICENSES.txt) et dans l'appli : Réglages → À propos → Licences.
