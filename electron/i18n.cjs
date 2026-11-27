/**
 * Language of the PC app's main process (dialogs, pack and content messages):
 * the one chosen in the app (sent by the window at start, preload setLang),
 * else the system's (French → French, otherwise English). French source text
 * as the key, like src/lib/i18n.js; tests/i18n.test.mjs checks none is missing.
 */
let lang = null;

function current() {
  if (lang) return lang;
  try {
    const { app } = require('electron');
    if (app?.getLocale) return String(app.getLocale()).toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch { /* plain Node (tests): French */ }
  return 'fr';
}

/** The window tells the language chosen in the app. */
function setMainLang(next) { if (next === 'en' || next === 'fr') lang = next; }

const EN = {
  'Cartes': 'Cards',
  'Traductions françaises': 'French translations',
  'Cartes bannies': 'Banned cards',
  'Rulings': 'Rulings',
  'Rulings : traductions françaises à faire': 'Rulings: French translations to do',
  '{n} ruling(s) en anglais sans traduction française pour l’instant.': '{n} ruling(s) in English without a French translation yet.',
  'liste des cartes retirées invalide': 'invalid list of removed cards',
  'nom de fichier refusé ({rel})': 'file name refused ({rel})',
  'fichier altéré ({rel})': 'file altered ({rel})',
  '{label} : mise à jour ignorée ({problem}).': '{label}: update ignored ({problem}).',
  '{label} : la mise à jour du {date} est déjà dans cette version de l’appli, elle a été retirée.': '{label}: the update of {date} is already in this version of the app, it was removed.',
  'correction refusée ({id})': 'correction refused ({id})',
  'Nom de fichier refusé ({rel}).': 'File name refused ({rel}).',
  'Mise à jour refusée : {problem}.': 'Update refused: {problem}.',
  'Impossible de joindre le site. Vérifiez votre connexion.': 'Cannot reach the site. Check your connection.',
  'Le site est indisponible pour l’instant (fichier introuvable ou site fermé).': 'The site is unavailable for now (file not found or site closed).',
  'Le site n’accepte pas le téléchargement automatique.': 'The site does not accept automatic downloads.',
  'Le site a répondu par une erreur. Réessaie plus tard.': 'The site answered with an error. Try again later.',
  'Le fichier reçu est trop gros : refusé.': 'The file received is too large: refused.',
  'Adresse non autorisée.': 'Address not allowed.',
  'Le site renvoie vers trop d’adresses successives : refusé.': 'The site redirects through too many addresses: refused.',
  'Dossier supplémentaire pour les sauvegardes': 'Extra folder for the backups',
  'Importer un dossier de cartes': 'Import a folder of cards',
  'Ce dossier ne contient pas de cartes : il faut card-hashes.json et le dossier cards (ou un dossier public qui les contient).': 'This folder holds no cards: it needs card-hashes.json and the cards folder (or a public folder holding them).',
  'card-hashes.json est illisible.': 'card-hashes.json cannot be read.',
  'card-hashes.json ne contient aucune carte.': 'card-hashes.json holds no card.',
  'Ces cartes ont été préparées pour un autre modèle d’IA : utilisez un dossier fait par cette version de l’appli, ou téléchargez les cartes depuis la galerie.': 'These cards were prepared for another AI model: use a folder made by this version of the app, or download the cards from the gallery.',
  'Ces cartes ont été préparées pour un autre détecteur : utilisez un dossier fait par cette version de l’appli, ou téléchargez les cartes depuis la galerie.': 'These cards were prepared for another detector: use a folder made by this version of the app, or download the cards from the gallery.',
  'Image trop grosse : {rel}.': 'Image too large: {rel}.',
  'Mise à jour trop grosse : refusée.': 'Update too large: refused.',
  'Pack refusé : fichier trop gros.': 'Pack refused: file too large.',
  'Aucun pack à installer.': 'No pack to install.',
  'Type de contenu refusé.': 'Content type refused.',
  'Téléphone': 'Phone',
  'Le port {port} est déjà utilisé. L’application est peut-être déjà ouverte (ou l’ancienne « Riftbound Scanner » : fermez-la).': 'Port {port} is already in use. The app may already be open (or the former « Riftbound Scanner »: close it).',
  'Impossible de démarrer le serveur de synchronisation : {message}': 'Cannot start the sync server: {message}',
  'fichier illisible (ce n’est pas un pack)': 'unreadable file (not a pack)',
  'format inattendu (fichier compressé)': 'unexpected format (compressed file)',
  'fichier tronqué ({name})': 'truncated file ({name})',
  'Rien à exporter : le contenu est celui d’origine.': 'Nothing to export: the content is the original one.',
  'Pack refusé : {message}.': 'Pack refused: {message}.',
  'Pack refusé : manifeste manquant.': 'Pack refused: manifest missing.',
  'Pack refusé : cette version de l’appli n’a pas de clé pour vérifier les packs.': 'Pack refused: this version of the app has no key to check packs.',
  'Pack refusé : il n’est pas signé.': 'Pack refused: it is not signed.',
  'Pack refusé : manifeste trop gros.': 'Pack refused: manifest too large.',
  'Pack refusé : signature invalide.': 'Pack refused: invalid signature.',
  'Pack refusé : signé par une clé révoquée ({fingerprint}).': 'Pack refused: signed with a revoked key ({fingerprint}).',
  'Pack refusé : manifeste illisible.': 'Pack refused: unreadable manifest.',
  'Pack refusé : format inconnu (appli trop ancienne ?).': 'Pack refused: unknown format (app too old?).',
  'Pack refusé : fait pour un autre modèle de reconnaissance (mettez l’appli à jour).': 'Pack refused: made for another recognition model (update the app).',
  'Pack refusé : fichier non listé ({name}).': 'Pack refused: file not listed ({name}).',
  'Pack refusé : fichier altéré ({name}).': 'Pack refused: file altered ({name}).',
  'Pack refusé : fichier manquant ({name}).': 'Pack refused: file missing ({name}).',
  'Pack refusé : {kind} illisible.': 'Pack refused: unreadable {kind}.',
  'Pack refusé : il est vide.': 'Pack refused: it is empty.',
  'Pack refusé : pack plus ancien que votre contenu (ou déjà importé).': 'Pack refused: pack older than your content (or already imported).',
};

/** The text in the app's language (French source text as the key). */
function etx(fr, vars) {
  const s = current() === 'fr' ? fr : (EN[fr] ?? fr);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s;
}

module.exports = { etx, setMainLang, EN };
