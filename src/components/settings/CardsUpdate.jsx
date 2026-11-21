import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import Sheet from '../common/Sheet.jsx';
import Banner from '../common/Banner.jsx';
import DiffList from '../common/DiffList.jsx';
import { Stepper, ProgressRow } from '../common/Progress.jsx';
import { getMatcher } from '../../lib/cardMatcher.js';
import { startRecognition } from '../../lib/recognition.js';
import { GALLERY_URL, extractGalleryCards, galleryChanges, galleryText } from '../../lib/galleryCards.js';
import { cardImages, cardFeatures, checkParity, paritySample, commonFingerprint } from '../../lib/cardPipeline.js';
import { computeGroups, groupPatches, COMMON_BOTTOM } from '../../lib/artGroups.js';
import { clearNotice } from '../../lib/contentNotices.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Rechercher de nouvelles cartes » (lot 4.2) in the B.6.2 flow. Nothing is
 * written before « Installer »; the parity of the fingerprints and AI
 * signatures is checked first, or nothing is installed.
 */
const STEPS = ['Recherche', tx('Résumé'), 'Installation', tx('Terminé')];
const FIELD_FR = {
  name: 'nom', nameEn: 'nom complet', number: tx('numéro'), code: 'code', set: 'extension', setName: 'extension',
  domains: 'domaines', rarity: tx('rareté'), type: 'type', superTypes: 'type', energy: tx('énergie'), might: 'puissance',
  tags: tx('étiquettes'), illustrator: 'illustrateur', text: 'texte', orientation: 'orientation',
};

async function aiEngine() {
  const m = getMatcher();
  if (m.ai.state !== 'ready') await startRecognition();
  if (m.ai.state !== 'ready' || !m.ai.engine) {
    throw new Error(tx('Le moteur IA est nécessaire pour calculer les signatures des nouvelles cartes : activez-le dans Réglages → Scanner.'));
  }
  return m.ai.engine;
}
const imageOf = async (id) => {
  const r = await fetch(`/cards/${id}.webp`);
  if (!r.ok) throw new Error(tx('Image de {id} introuvable.', { id }));
  return new Uint8Array(await r.arrayBuffer());
};

export default function CardsUpdateSheet({ open, onClose, pageText = null, validators = null }) {
  const api = window.riftboundDesktop;
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null); // { label, done, total }

  const analyse = useCallback((text) => {
    const r = galleryChanges(extractGalleryCards(text), getMatcher().cards);
    setResult(r);
    setStep(1);
  }, []);

  const search = useCallback(async () => {
    setStep(0); setError(null); setResult(null);
    try {
      const page = await api.content.fetch(GALLERY_URL);
      if (!page.ok) { setError({ text: page.message, reason: page.reason }); return; }
      analyse(page.text);
    } catch (err) {
      setError({ text: err.message, reason: 'unreadable' });
    }
  }, [api, analyse]);

  useEffect(() => {
    if (!open) return;
    if (pageText) {
      setStep(0); setError(null);
      try { analyse(pageText); } catch (err) { setError({ text: err.message, reason: 'unreadable' }); }
    } else search();
  }, [open, pageText, search, analyse]);

  const install = async () => {
    setStep(2); setError(null);
    try {
      const m = getMatcher();
      const cards = [], files = {};
      if (result.added.length) {
        const engine = await aiEngine();
        // 1. Parity on 50 cards of the shipped catalog: or nothing is installed.
        const sample = paritySample(m.cards);
        setProgress({ label: tx('Vérification des empreintes'), done: 0, total: sample.length });
        const parity = await checkParity(sample, async (c) => cardFeatures(await imageOf(c.id), c.artBottom ?? 0.55, engine),
          (done, total) => setProgress({ label: tx('Vérification des empreintes'), done, total }));
        if (!parity.ok) throw new Error(tx('Les empreintes recalculées ne sont pas identiques à celles du catalogue ({length} cartes sur {cards}) : rien n’a été installé.', { length: parity.failures.length, cards: parity.cards }));
        // 2. Images, thumbnails, fingerprints, AI signatures of the new cards.
        for (let i = 0; i < result.added.length; i++) {
          const { card, imageUrl } = result.added[i];
          setProgress({ label: tx('Nouvelles cartes'), done: i, total: result.added.length });
          const img = await api.content.fetchImage(imageUrl);
          if (!img.ok) throw new Error(`${card.name} : ${img.message}`);
          const { card: webp, thumb } = await cardImages(img.bytes);
          const feats = await cardFeatures(webp, card.artBottom, engine);
          cards.push({ ...card, ...feats });
          files[`cards/${card.id}.webp`] = webp;
          files[`cards/thumbs/${card.id}.webp`] = thumb;
        }
      }
      // 3. Reprint groups with the new cards.
      const patches = new Map(result.changed.map(({ card, fields }) => [card.id, Object.fromEntries([['id', card.id], ...fields.map(k => [k, card[k] ?? null])])]));
      if (cards.length) {
        const all = [...m.cards.filter(c => !result.manualOfficial.includes(c.id) && !cards.some(n => n.id === c.id)), ...cards];
        const newBytes = new Map(cards.map(c => [c.id, files[`cards/${c.id}.webp`]]));
        const common = [];
        for (let i = 0; i < all.length; i++) {
          if (i % 25 === 0) setProgress({ label: tx('Groupes de rééditions'), done: i, total: all.length });
          const id = all[i].id;
          try { common.push(await commonFingerprint(newBytes.get(id) || await imageOf(id), COMMON_BOTTOM)); } catch { common.push(null); }
        }
        const groups = computeGroups(all, common);
        for (const p of groupPatches(all, groups)) {
          const fresh = cards.find(c => c.id === p.id);
          if (fresh) { if (p.artGroup) fresh.artGroup = p.artGroup; else delete fresh.artGroup; } else patches.set(p.id, { ...patches.get(p.id), id: p.id, artGroup: p.artGroup });
        }
      }
      setProgress({ label: tx('Enregistrement'), done: 0, total: null });
      await api.content.installCards({
        createdAt: new Date().toISOString(),
        source: { label: 'galerie officielle Riot', url: GALLERY_URL },
        count: cards.length + patches.size,
        data: { cards, patches: [...patches.values()], removed: result.manualOfficial },
      }, files);
      if (validators) await api.content.saveValidators('cartes', validators);
      clearNotice('cartes');
      setStep(3);
    } catch (err) {
      setStep(1);
      setError({ text: err.message, reason: 'install' });
    } finally {
      setProgress(null);
    }
  };

  const items = useMemo(() => {
    if (!result) return [];
    return [
      ...result.added.map(({ card }) => ({ op: '+', label: card.nameEn || card.name, detail: card.setName || card.set })),
      ...result.changed.map(({ card, fields }) => ({ op: '~', label: card.nameEn || card.name, cardId: card.id, detail: [...new Set(fields.map(f => FIELD_FR[f] || f))].join(', ') })),
      ...result.manualOfficial.map(id => ({ op: '-', label: id, detail: tx('ajout manuel remplacé par la carte officielle') })),
    ];
  }, [result]);
  const nothing = result && !items.length;

  return (
    <Sheet open={open} onClose={step === 2 ? undefined : onClose} title={tx('Cartes')}>
      <div className="space-y-4">
        <Stepper steps={STEPS} current={step} />
        {step === 0 && !error && <ProgressRow done={0} total={null} unit={tx('Lecture de la galerie officielle…')} />}
        {error && (
          <Banner tone="bad">
            {error.text}
            <span className="flex flex-wrap gap-2 mt-2">
              {error.reason === 'offline' && <button onClick={search} className="btn-secondary text-[13px] py-1.5 px-3"><RefreshCw className="w-4 h-4" /> {tx('Réessayer')}</button>}
              {['refused', 'unavailable', 'http'].includes(error.reason) && <a href={GALLERY_URL} target="_blank" rel="noreferrer" className="btn-secondary text-[13px] py-1.5 px-3"><ExternalLink className="w-4 h-4" /> {tx('Ouvrir dans mon navigateur')}</a>}
            </span>
          </Banner>
        )}
        {step === 1 && result && (
          <>
            <p className="text-[15px] text-rift-100">{galleryText(result)}</p>
            {items.length > 0 && <DiffList items={items} />}
            {result.added.length > 0 && (
              <p className="text-[13px] text-rift-400">
                {tx('Leurs prix arrivent à la prochaine mise à jour des prix, leurs noms français avec la prochaine mise à jour des traductions. L’installation vérifie d’abord les empreintes, puis télécharge')} {result.added.length} {tx('image')}{result.added.length > 1 ? 's' : ''} {tx('(quelques minutes).')}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-ghost text-[14px] py-2 px-4">{nothing ? tx('Fermer') : tx('Annuler')}</button>
              {!nothing && <button onClick={install} className="btn-primary text-[14px] py-2 px-4">{tx('Installer')}</button>}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <ProgressRow done={progress?.done ?? 0} total={progress?.total ?? null} unit={progress?.label || tx('Installation…')} />
            <p className="text-[13px] text-rift-400">{tx('Ne fermez pas l’appli.')}</p>
          </>
        )}
        {step === 3 && (
          <div className="text-center py-4 space-y-3">
            <span className="hex-cut inline-flex w-14 h-14 items-center justify-center bg-gold-400/15 text-gold-400"><CheckCircle2 size={28} /></span>
            <p className="text-[15px] text-rift-100">{galleryText(result)}</p>
            <p className="text-[13px] text-rift-400">{tx('Le téléphone recevra ces changements à la prochaine synchro.')}</p>
            <button onClick={onClose} className="btn-primary text-[14px] py-2 px-4">{tx('Fermer')}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
