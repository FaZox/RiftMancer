import React, { useEffect, useState } from 'react';
import { Download, FolderInput, Layers } from 'lucide-react';
import CardsUpdateSheet from '../settings/CardsUpdate.jsx';
import TranslationsSheet from '../settings/TranslationsUpdate.jsx';
import Banner from './Banner.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { isDesktop } from '../../lib/collectionDB.js';
import { tx, getLang } from '../../lib/i18n.js';

/**
 * First launch without cards: the app is built without the card content of
 * Riot Games (public repository), it ships only the catalog header
 * (catalog-base.json). PC: « Télécharger les cartes » (official gallery, the
 * usual « Rechercher de nouvelles cartes » flow) or « Importer un dossier… »
 * (a content backup, a friend's USB key). Phone: the cards come from the PC
 * at the sync. Shown as long as the catalog has no card.
 */
const cardCount = () => getMatcher().cards?.length || 0;

export function useCardCount() {
  const [n, setN] = useState(cardCount);
  useEffect(() => {
    const update = () => setN(cardCount());
    window.addEventListener('rb:catalog', update);
    update();
    return () => window.removeEventListener('rb:catalog', update);
  }, []);
  return n;
}

export default function NoCards({ onSync }) {
  const cards = useCardCount();
  const [sheet, setSheet] = useState(null); // 'cards' | 'fr'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const api = window.riftboundDesktop;

  const importFolder = async () => {
    setError(null); setBusy(true);
    try {
      const s = await api.content.importFolder();
      if (s?.imported) setDone(tx('{cards} cartes importées.', { cards: s.imported.cards.toLocaleString() }));
    } catch (err) {
      setError(err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      setBusy(false);
    }
  };
  // French app: the gallery gives the English texts; the French ones follow (riftboundfr.fr).
  const closeCards = () => {
    const m = getMatcher();
    setSheet(m.cards.length && getLang() === 'fr' && !m.cards.some(c => c.nameFr) ? 'fr' : null);
  };

  const sheets = isDesktop && (
    <>
      <CardsUpdateSheet open={sheet === 'cards'} onClose={closeCards} />
      <TranslationsSheet open={sheet === 'fr'} onClose={() => setSheet(null)} mode="download" />
    </>
  );
  if (cards > 0) {
    return (
      <>
        {done && <Banner tone="ok" className="m-3" onClose={() => setDone(null)}>{done}</Banner>}
        {sheets}
      </>
    );
  }
  if (!isDesktop) {
    return (
      <Banner tone="info" icon={Layers} className="m-3" action={onSync ? { label: tx('Synchroniser'), onClick: onSync } : null}>
        {tx('Aucune carte pour l’instant : synchronisez avec l’appli PC pour les recevoir.')}
      </Banner>
    );
  }
  return (
    <div role="status" className="m-4 p-4 bg-rift-800 border border-rift-700 border-l-[3px] border-l-gold-400">
      <h2 className="font-display text-[17px] font-bold text-gold-400 flex items-center gap-2"><Layers size={18} strokeWidth={1.8} aria-hidden="true" /> {tx('Récupérez les cartes')}</h2>
      <p className="text-[14px] text-rift-200 mt-1.5 max-w-[640px]">
        {tx('Les cartes (images, noms, textes) appartiennent à Riot Games : elles ne sont pas livrées avec l’appli. Téléchargez-les depuis la galerie officielle (environ 170 Mo, une dizaine de minutes), ou importez un dossier de cartes déjà téléchargées.')}
      </p>
      {error && <Banner tone="bad" className="mt-3">{error}</Banner>}
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => setSheet('cards')} disabled={busy} className="btn-primary text-[14px] py-2 px-3"><Download className="w-4 h-4" /> {tx('Télécharger les cartes')}</button>
        <button onClick={importFolder} disabled={busy} className="btn-secondary text-[14px] py-2 px-3"><FolderInput className="w-4 h-4" /> {busy ? tx('Import en cours…') : tx('Importer un dossier…')}</button>
      </div>
      {sheets}
    </div>
  );
}
