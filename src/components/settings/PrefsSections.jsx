import React from 'react';
import { useLearnedCount, learnedCardCount, forgetLearning } from '../../lib/learning.js';
import { notifyPricesChanged } from '../../lib/prices.js';
import { Sparkles, ExternalLink } from 'lucide-react';
import { usePrefs, CM_COUNTRIES, CM_LANGUAGES, CM_CONDITIONS } from '../../lib/uiPrefs.js';
import { useDialog } from '../common/Dialog.jsx';
import { tx } from '../../lib/i18n.js';

const panel = 'rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-4';
const select = 'select-field rounded-xl';

/** « Animations des cartes » on / off (legend effects and deck cards floating stay). */
/** Scanner: learn from the user's corrections (learning.js). */
export function LearningSection({ bare = false }) {
  const { ask } = useDialog();
  const [prefs, setPrefs] = usePrefs();
  const n = useLearnedCount();
  const on = prefs.learnFromCorrections !== false;
  const body = (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 text-sm text-rift-100">
        <span>
          {tx('Apprendre de mes corrections')}
          <span className="block text-[11px] text-rift-400">
            {tx('Quand vous choisissez vous-même la carte (« Pas la bonne carte », « laquelle est-ce ? », autre carte sur une photo), la photo sert d’exemple pour reconnaître cette carte la prochaine fois — avec votre téléphone, votre lumière, vos protège-cartes. Synchronisé avec le PC.')}
          </span>
        </span>
        <input type="checkbox" checked={on} onChange={(e) => setPrefs({ learnFromCorrections: e.target.checked })} />
      </label>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs text-rift-300">{n ? `${n} exemple${n > 1 ? 's' : ''} appris (${learnedCardCount()} carte${learnedCardCount() > 1 ? 's' : ''})` : tx('Rien d’appris pour l’instant')}</span>
        {n > 0 && (
          <button onClick={async () => { if (await ask({ title: tx('Oublier l’apprentissage ?'), message: tx('Tout ce que le scanner a appris de vos corrections est oublié, sur le téléphone et le PC après synchro.'), confirmLabel: tx('Oublier'), destructive: true })) forgetLearning(); }}
            className="btn-ghost text-xs py-1.5 px-3 text-red-400">{tx('Oublier')}</button>
        )}
      </div>
    </div>
  );
  if (bare) return body;
  return (
    <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-rift-100">{tx('Apprentissage du scanner')}</h2>
      {body}
    </section>
  );
}

export function AnimationsSection({ bare = false }) {
  const [prefs, setPrefs] = usePrefs();
  const body = (
    <label className="flex items-start gap-3 text-sm text-rift-200 cursor-pointer">
      <input type="checkbox" checked={prefs.cardAnimations} onChange={e => setPrefs({ cardAnimations: e.target.checked })} className="mt-0.5 w-4 h-4 accent-[#c8aa6e]" />
      <span>
        {tx('Animations des cartes')}
        <span className="block text-xs text-rift-500 mt-0.5">
          {tx('Quand c’est décoché, la carte apparaît directement dans le zoom (sans sortir du sol, ni étincelles, ni éclats). Les effets des légendes et le flottement des cartes dans les decks restent.')}
        </span>
      </span>
    </label>
  );
  if (bare) return body;
  return (
    <section className={panel}>
      <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2"><Sparkles className="w-4 h-4 text-gold-400" /> {tx('Animations')}</h2>
      {body}
    </section>
  );
}

/** « Prix de référence »: which Cardmarket price values the collection. */
export function PriceRefSection({ bare = false }) {
  const [prefs, setPrefs] = usePrefs();
  const options = [
    ['trend', tx('Tendance'), tx('Prix tendance Cardmarket (par défaut)')],
    ['avg7', tx('Moyenne 7 jours'), tx('Moyenne des ventes de la semaine, moins sensible aux à-coups')],
    ['low', tx('Prix bas'), tx('Offre la moins chère (tous états, toutes langues)')],
  ];
  const body = (
    <div className="space-y-2">
      <p className="text-xs text-rift-400">{tx('Utilisé pour la valeur de la collection, des decks et des cartes manquantes. Le prix tendance est bruité sur les cartes peu échangées : un ⚠ s’affiche quand il s’écarte de plus de 30 % de la moyenne sur 7 jours.')}</p>
      {options.map(([v, l, d]) => (
        <button key={v} onClick={() => { setPrefs({ priceRef: v }); notifyPricesChanged(); }} aria-pressed={(prefs.priceRef || 'trend') === v}
          className={`w-full text-left px-3 py-2 border ${(prefs.priceRef || 'trend') === v ? 'bg-gold-500/15 border-gold-500/60' : 'border-rift-600'}`}>
          <span className={`block text-sm ${(prefs.priceRef || 'trend') === v ? 'text-gold-400 font-semibold' : 'text-rift-100'}`}>{l}</span>
          <span className="block text-[11px] text-rift-400">{d}</span>
        </button>
      ))}
    </div>
  );
  if (bare) return body;
  return (
    <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-rift-100">{tx('Prix de référence')}</h2>
      {body}
    </section>
  );
}

/** Filters applied to every Cardmarket link (seller country, languages, minimum condition). */
export function CardmarketSection({ bare = false }) {
  const [prefs, setPrefs] = usePrefs();
  const cm = prefs.cm;
  const toggleLang = (v) => {
    const set = new Set(cm.languages);
    if (set.has(v)) set.delete(v); else set.add(v);
    setPrefs({ cm: { languages: CM_LANGUAGES.map(l => l[0]).filter(x => set.has(x)) } });
  };
  const body = (
    <div className="space-y-4">
      <p className="text-xs text-rift-400">
        {tx('Appliqués aux liens « Acheter sur Cardmarket » (zoom d’une carte, cartes manquantes). Les souhaits s’envoient vers Cardmarket par copier-coller : votre compte ne peut pas être relié (l’API de Cardmarket est réservée aux vendeurs professionnels).')}
      </p>
      <div>
        <label className="text-[11px] font-medium text-rift-300 uppercase tracking-wider mb-1.5 block">{tx('Pays du vendeur')}</label>
        <select value={cm.country} onChange={e => setPrefs({ cm: { country: e.target.value } })} className={select}>
          {CM_COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <p className="text-[11px] font-medium text-rift-300 uppercase tracking-wider mb-1.5">{tx('Langue des cartes')}</p>
        <div className="flex flex-wrap gap-2">
          {CM_LANGUAGES.map(([v, l]) => (
            <button key={v} onClick={() => toggleLang(v)} aria-pressed={cm.languages.includes(v)}
              className={`h-9 px-3 text-sm border ${cm.languages.includes(v) ? 'bg-gold-500/15 border-gold-500/60 text-gold-400 font-semibold' : 'border-rift-600 text-rift-300'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-rift-500 mt-1">{tx('Aucune langue cochée = toutes les langues.')}</p>
      </div>
      <div>
        <label className="text-[11px] font-medium text-rift-300 uppercase tracking-wider mb-1.5 block">{tx('État minimum')}</label>
        <select value={cm.minCondition} onChange={e => setPrefs({ cm: { minCondition: e.target.value } })} className={select}>
          {CM_CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    </div>
  );
  if (bare) return body;
  return (
    <section className={panel}>
      <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2"><ExternalLink className="w-4 h-4 text-gold-400" /> {tx('Cardmarket')}</h2>
      {body}
    </section>
  );
}
