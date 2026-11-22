/**
 * Help on the screens: a guided tour the first time a page is opened (one
 * button at a time, « Suivant » / « Passer »), and a help mode (« ? ») that
 * labels every button of the screen at once. Buttons are marked in the JSX
 * with data-help="<id>"; their texts are in HELP (French keys of tx, English in
 * src/i18n/en.js); the order of each page's tour is in TOURS. The pages seen
 * are kept on the device (Settings → Help → « Revoir les explications »).
 */
import { useEffect } from 'react';
import { tx } from './i18n.js';

/** id → { label: a few words (help mode), title, text (tour) } */
export const HELP = {
  // Collection
  'collection.search': { label: tx('Chercher'), title: tx('Chercher dans la collection'), text: tx('Tapez un nom ou un numéro : la liste ne garde que les cartes qui correspondent.') },
  'collection.sort': { label: tx('Classer'), title: tx('Trier'), text: tx('Classez par extension, nom, rareté, prix, quantité ou ajout récent.') },
  'collection.add': { label: tx('Ajouter une carte'), title: tx('Ajouter'), text: tx('Ajoutez une carte sans la scanner : par son nom ou son numéro, elle rejoint tout de suite la collection.') },
  'collection.filters': { label: tx('Filtres'), title: tx('Filtrer'), text: tx('Domaine, extension, type, rareté, langue, finition (foil, promo) et emplacement : combinez-les, « Effacer » les retire.') },
  'collection.layout': { label: tx('Affichage'), title: tx('Grille ou tableau'), text: tx('La grille montre les cartes ; le tableau permet de modifier langue, état, foil, promo et quantité ligne par ligne.') },
  'collection.io': { label: tx('Importer, exporter'), title: tx('Importer et exporter'), text: tx('Importez un fichier CSV, ou exportez la collection pour Cardmarket, un tableur ou un ami.') },
  'collection.select': { label: tx('Sélection'), title: tx('Sélectionner'), text: tx('Choisissez plusieurs cartes pour les ranger, les déplacer ou les supprimer d’un coup.') },
  'collection.card': { label: tx('Fiche de la carte'), title: tx('Une carte'), text: tx('Touchez une carte pour sa fiche : nombre d’exemplaires, prix, impressions et rulings.') },
  'collection.views': { label: tx('Cartes, progression, souhaits'), title: tx('Trois vues'), text: tx('Mes cartes : ce que vous possédez. Progression : ce qu’il vous manque, extension par extension. Souhaits : les cartes que vous cherchez, avec leur prix.') },
  // Cartes (the whole catalog)
  'cards.search': { label: tx('Chercher'), title: tx('Chercher dans le catalogue'), text: tx('Un nom (français ou anglais), un numéro, ou des clés : t:unité d:esprit e<=3 own:0. Le « ? » donne toute la syntaxe.') },
  'cards.filters': { label: tx('Filtres'), title: tx('Filtres'), text: tx('Domaines, sets, type, énergie, puissance, rareté : chaque filtre écrit sa clé dans la recherche, et une clé tapée allume son filtre.') },
  'cards.grid': { label: tx('Les cartes'), title: tx('Tout le catalogue'), text: tx('×N : vos exemplaires. Cliquez une carte pour sa fiche ; Ctrl ou Maj pour en choisir plusieurs ; le « + » au survol en ajoute un exemplaire.') },
  'cards.actions': { label: tx('Souhaits, export'), title: tx('Manquantes et export'), text: tx('Ajoutez toutes les manquantes affichées à vos souhaits, ou exportez la vue en CSV.') },
  // Progression
  'progress.set': { label: tx('Une extension'), title: tx('Progression par extension'), text: tx('Le nombre de cartes différentes possédées sur le total de l’extension (variantes à part). Ouvrez une extension pour voir ses cartes.') },
  'progress.show': { label: tx('Manquantes, possédées'), title: tx('Quelles cartes'), text: tx('Montrez les cartes manquantes, possédées ou toutes ; « Inclure les variantes » ajoute les illustrations alternatives, signées et promos.') },
  'progress.wishAll': { label: tx('Tout ajouter aux souhaits'), title: tx('Tout ajouter aux souhaits'), text: tx('Ajoute d’un coup toutes les cartes manquantes affichées à votre liste de souhaits.') },
  // Wishes
  'wish.summary': { label: tx('À obtenir'), title: tx('Vos souhaits'), text: tx('Les cartes souhaitées, combien il en reste à obtenir et leur coût estimé au prix Cardmarket.') },
  'wish.cardmarket': { label: tx('Vers Cardmarket'), title: tx('Envoyer vers Cardmarket'), text: tx('Copie les cartes qu’il vous manque pour les coller dans une liste de souhaits Cardmarket.') },
  'wish.wanted': { label: tx('Quantité voulue'), title: tx('Combien en voulez-vous'), text: tx('− et + changent le nombre d’exemplaires voulus ; une carte est « Obtenue » quand vous en possédez assez.') },
  'wish.alert': { label: tx('Alerte prix'), title: tx('Alerte de prix'), text: tx('Fixez un prix : quand la carte passe en dessous sur Cardmarket, un bandeau vert vous prévient.') },
  'wish.empty': { label: tx('Ajouter un souhait'), title: tx('Liste de souhaits'), text: tx('Ouvrez une carte et touchez le cœur pour l’ajouter ici, ou « Tout ajouter aux souhaits » dans Progression.') },
  // Scanner
  'scan.modes': { label: tx('Mode de scan'), title: tx('Mode de scan'), text: tx('Photos : glissez une ou plusieurs photos. Webcam ou caméra : une carte à la fois. Grille : une page de classeur entière.') },
  'scan.place': { label: tx('Où ranger'), title: tx('Ranger dans'), text: tx('Choisissez une boîte ou un deck : les cartes scannées y seront rangées. Un classeur garde aussi la page et la case.') },
  'scan.lang': { label: tx('Langue des cartes'), title: tx('Langue des cartes'), text: tx('La langue imprimée sur les cartes que vous scannez (FR ou EN).') },
  'scan.search': { label: tx('Carte non reconnue'), title: tx('Chercher une carte'), text: tx('Une carte abîmée ou non reconnue ? Cherchez-la par son nom.') },
  'scan.pending': { label: tx('À ajouter'), title: tx('La liste « À ajouter »'), text: tx('Les cartes reconnues attendent ici : vérifiez langue, état, foil ou quantité, puis « Tout ajouter à la collection ».') },
  // Card sheet
  'card.lang': { label: tx('FR / EN'), title: tx('Langue de la fiche'), text: tx('Affichez le nom et le texte en français ou en anglais.') },
  'card.tabs': { label: tx('Infos, prix, exemplaires'), title: tx('Les onglets'), text: tx('Infos (texte, impressions, rulings), Prix (Cardmarket et évolution) et Ma collection (vos exemplaires, promos).') },
  'card.count': { label: tx('Mes exemplaires'), title: tx('Dans ma collection'), text: tx('Le nombre d’exemplaires dans la langue affichée : − en retire un (avec « Annuler »), + en ajoute un.') },
  'card.wish': { label: tx('Souhaits'), title: tx('Liste de souhaits'), text: tx('Ajoutez la carte à vos souhaits ; vous pouvez y fixer un prix d’alerte.') },
  'card.prints': { label: tx('Autres impressions'), title: tx('Impressions et variantes'), text: tx('Toutes les versions de la carte (alternative, signature, promo…) avec leur prix ; touchez-en une pour l’ouvrir.') },
  'card.rulings': { label: tx('Rulings'), title: tx('Rulings'), text: tx('Les questions fréquentes sur la carte : touchez une question pour lire la réponse.') },
  // Decks, value, settings
  'decks.new': { label: tx('Nouveau deck'), title: tx('Créer un deck'), text: tx('Commencez un deck : choisissez la Légende, puis ajoutez des cartes de votre collection ou non.') },
  'value.total': { label: tx('Valeur'), title: tx('Valeur de la collection'), text: tx('La valeur de vos cartes au prix Cardmarket, et son évolution jour après jour.') },
  'content.cards': { label: tx('Nouvelles cartes'), title: tx('Cartes'), text: tx('« Rechercher » trouve les nouvelles cartes et impressions ; rien n’est installé sans votre accord.') },
  'content.prices': { label: tx('Prix'), title: tx('Prix Cardmarket'), text: tx('« Actualiser » télécharge les prix tout de suite, sans attendre la mise à jour quotidienne.') },
};

/** Page → the order of its tour (ids missing on screen are skipped). */
export const TOURS = {
  collection: ['collection.views', 'collection.add', 'collection.search', 'collection.sort', 'collection.filters', 'collection.card', 'collection.layout', 'collection.io', 'collection.select'],
  cards: ['cards.search', 'cards.filters', 'cards.grid', 'cards.actions'],
  progress: ['progress.set', 'progress.show', 'progress.wishAll'],
  wishlist: ['wish.summary', 'wish.wanted', 'wish.alert', 'wish.cardmarket', 'wish.empty'],
  scan: ['scan.modes', 'scan.place', 'scan.lang', 'scan.search', 'scan.pending'],
  card: ['card.count', 'card.tabs', 'card.lang', 'card.prints', 'card.rulings', 'card.wish'],
  decks: ['decks.new'],
  value: ['value.total'],
  content: ['content.cards', 'content.prices'],
};

const SEEN_KEY = 'rb.helpSeen';
function readSeen() {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export const tourSeen = (page) => readSeen().includes(page);
export function markTourSeen(page) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), page])])); } catch { /* private mode */ }
}
/** Settings → Help → « Revoir les explications ». */
export function resetTours() {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ }
  emit();
}

// ─── Current page (a stack: the card sheet sits on top of its page) ──────
let stack = [];
const listeners = new Set();
function emit() { for (const l of listeners) l(); }
export const currentHelpPage = () => stack.at(-1) || null;
export function onHelpChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** The page shown now (DesktopApp, App, CardZoom). */
export function useHelpPage(page) {
  useEffect(() => {
    if (!page) return undefined;
    const entry = page;
    stack = [...stack, entry];
    emit();
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack = [...stack.slice(0, i), ...stack.slice(i + 1)];
      emit();
    };
  }, [page]);
}

// ─── Requests from the « ? » buttons ──────────────────────────────────────
const requests = new Set();
/** 'mode' (label every button) or 'tour' (the page's tour). */
export function requestHelp(kind) { for (const r of requests) r(kind); }
export function onHelpRequest(fn) { requests.add(fn); return () => requests.delete(fn); }

/** Visible elements marked for `ids` (in that order), or every marked one. */
export function helpTargets(ids = null) {
  if (typeof document === 'undefined') return [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const all = [...document.querySelectorAll('[data-help]')].filter(el => HELP[el.dataset.help] && visible(el));
  if (!ids) {
    const seen = new Set();
    return all.filter(el => !seen.has(el.dataset.help) && seen.add(el.dataset.help));
  }
  return ids.map(id => all.find(el => el.dataset.help === id)).filter(Boolean);
}
