import React, { useCallback, useEffect, useState } from 'react';
import { Ban, FileUp, Languages, Layers, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
import { BanEditSheet, BanUpdateSheet } from './BanUpdate.jsx';
import TranslationsSheet from './TranslationsUpdate.jsx';
import CardsUpdateSheet from './CardsUpdate.jsx';
import PacksRow from './PackUpdate.jsx';
import { useContentNotices, clearNotice } from '../../lib/contentNotices.js';
import { SectionCard } from '../common/SectionCard.jsx';
import Banner from '../common/Banner.jsx';
import { useDialog } from '../common/Dialog.jsx';
import { isDesktop, getMeta } from '../../lib/collectionDB.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { banSummary, getBanlist } from '../../lib/banlist.js';
import { tx, locale } from '../../lib/i18n.js';

/**
 * Réglages → Contenu (lot 4, B.6.1): the cards, French translations and banned
 * cards the app uses, where they come from and when. PC: updates and « Revenir
 * au contenu d’origine »; phone: read only (the content comes from the PC).
 */

const day = (d) => (d ? new Date(d).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const n = (x) => (x ?? 0).toLocaleString(locale());
const SHIPPED = tx('contenu livré avec l’appli');

function sourceLine(layer, fallback) {
  if (!layer) return tx('Source : {fallback}', { fallback });
  return tx('Source : {v0} · installée le {day}', { v0: layer.source?.label || tx('mise à jour'), day: day(layer.createdAt) });
}
const layerStatus = (layer) => (layer ? <span className="text-state-ok">{tx('Mis à jour')}</span> : <span>{tx('D’origine')}</span>);

/** The three cards (B.6.1); `actions[kind]` adds buttons (PC). */
export function ContentCards({ info, actions = {}, cardsStatus = null }) {
  const L = info.layers || {};
  return (
    <>
      <SectionCard icon={Layers} title={tx('Cartes')} status={cardsStatus || layerStatus(L.cartes)}>
        <p className="text-[14px] text-rift-200">{n(info.cards)} {tx('cartes')}{info.lastSet ? tx(' · dernière extension : {lastSet}', { lastSet: info.lastSet }) : ''}</p>
        <p className="text-[13px] text-rift-400 mt-0.5">{sourceLine(L.cartes, `galerie officielle Riot, ${SHIPPED} (${day(info.base?.generatedAt)})`)}</p>
        {info.errata > 0 && <p className="text-[13px] text-state-info mt-0.5">{n(info.errata)} {tx('carte')}{info.errata > 1 ? 's' : ''} {tx('au texte modifié par une mise à jour (« Texte modifié » sur la fiche)')}</p>}
        {actions.cartes}
      </SectionCard>
      <SectionCard icon={Languages} title={tx('Traductions françaises')} status={layerStatus(L.traductions)}>
        <p className="text-[14px] text-rift-200">{n(info.namesFr)} {tx('noms ·')} {n(info.textsFr)} {tx('textes · riftboundfr.fr, merci à eux')}</p>
        <p className="text-[13px] text-rift-400 mt-0.5">{sourceLine(L.traductions, SHIPPED)}</p>
        {actions.traductions}
      </SectionCard>
      <SectionCard icon={Ban} title={tx('Cartes bannies')} status={info.banlist?.updatedAt ? `au ${day(info.banlist.updatedAt)}` : null}>
        <p className="text-[14px] text-rift-200">{banSummary(info.banlist).text}</p>
        <p className="text-[13px] text-rift-400 mt-0.5">{sourceLine(L.bannies, tx('règlement officiel des tournois, {SHIPPED}', { SHIPPED }))}</p>
        {actions.bannies}
      </SectionCard>
    </>
  );
}

/** « Vérifier chaque semaine » (lot 4.2 / 4.3, on by default). */
function WeeklyToggle({ api, kind, info, setInfo }) {
  const c = info.checks?.[kind] || { weekly: true };
  return (
    <label className="flex items-center gap-2 mt-2 text-[13px] text-rift-300">
      <input type="checkbox" className="toggle" checked={c.weekly} onChange={async e => setInfo(await api.content.setWeekly(kind, e.target.checked))} />
      {tx('Vérifier chaque semaine')}{c.lastCheck ? tx(' · vérifié le {day}', { day: day(c.lastCheck) }) : ''}
    </label>
  );
}

function PcContent() {
  const api = window.riftboundDesktop;
  const { ask } = useDialog();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // 'cards' | 'cardsPending' | 'bans' | 'bansManual' | 'fr' | 'frImport' | 'frPending'
  const notices = useContentNotices();
  const load = useCallback(async () => setInfo(await api.content.status()), [api]);
  useEffect(() => {
    load();
    return api.content.onChanged(load);
  }, [api, load]);

  const run = async (fn) => {
    setError(null);
    try { setInfo(await fn()); } catch (err) { setError(err.message); }
  };
  const reset = () => run(async () => {
    if (!await ask({
      title: tx('Revenir au contenu d’origine ?'),
      message: tx('Les cartes, traductions et listes de cartes bannies installées depuis l’appli sont retirées : l’appli reprend le contenu livré avec sa version. Le téléphone le recevra à la prochaine synchro.'),
      confirmLabel: tx('Revenir au contenu d’origine'), destructive: true,
    })) return info;
    return api.content.reset();
  });
  const restoreBans = () => run(async () => {
    if (!await ask({ title: tx('Restaurer la liste précédente ?'), message: tx('La liste des cartes bannies installée avant celle-ci reprend sa place.'), confirmLabel: tx('Restaurer') })) return info;
    return api.content.restorePrevious('bannies');
  });

  if (!info) return <p className="text-[13px] text-rift-400">{tx('Chargement…')}</p>;
  if (info.error) return <Banner tone="bad">{tx('Le contenu n’a pas pu être lu :')} {info.error}</Banner>;
  const hasLayers = Object.values(info.layers || {}).some(Boolean);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 min-w-[240px] text-[13px] text-rift-400">{tx('Le téléphone reçoit ce contenu à la synchro.')}</p>
        <button onClick={reset} disabled={!hasLayers} className="btn-ghost text-[13px] py-2 px-3"><RotateCcw className="w-4 h-4" /> {tx('Revenir au contenu d’origine')}</button>
      </div>
      {info.messages?.map((m, i) => <Banner key={i} tone={m.tone}>{m.text}</Banner>)}
      {error && <Banner tone="bad">{error}</Banner>}
      {notices.reminder && (
        <Banner tone="info" action={{ label: tx('Importer des fichiers…'), onClick: () => setSheet('frImport') }} onClose={() => clearNotice('reminder')}>{notices.reminder.text}</Banner>
      )}
      <ContentCards info={info}
        cardsStatus={notices.cartes && <span className="text-gold-400 font-semibold">◆ {notices.cartes.added ? `${notices.cartes.added} nouvelle${notices.cartes.added > 1 ? 's' : ''} carte${notices.cartes.added > 1 ? 's' : ''}` : tx('{count} carte{v1} à mettre à jour', { count: notices.cartes.count, v1: notices.cartes.count > 1 ? 's' : '' })}</span>}
        actions={{
        cartes: (
          <>
            <WeeklyToggle api={api} kind="cartes" info={info} setInfo={setInfo} />
            <div className="flex flex-wrap justify-end gap-2 mt-3">
              <button onClick={() => setSheet('cards')} className="btn-secondary text-[13px] py-2 px-3"><RefreshCw className="w-4 h-4" /> {tx('Rechercher')}</button>
              {notices.cartes && <button onClick={() => setSheet('cardsPending')} className="btn-primary text-[13px] py-2 px-3">{tx('Installer')} {notices.cartes.added ? `les ${notices.cartes.added}` : 'les corrections'}</button>}
            </div>
          </>
        ),
        traductions: (
          <>
            {notices.traductions && (
              <Banner tone="ok" className="mt-3" action={{ label: tx('Voir et installer'), onClick: () => setSheet('frPending') }}>
                {notices.traductions.count} {tx('traduction')}{notices.traductions.count > 1 ? 's' : ''} {tx('nouvelle')}{notices.traductions.count > 1 ? 's' : ''} {tx('ou modifiée')}{notices.traductions.count > 1 ? 's' : ''}.
              </Banner>
            )}
            <WeeklyToggle api={api} kind="traductions" info={info} setInfo={setInfo} />
            <div className="flex flex-wrap justify-end gap-2 mt-3">
              <button onClick={() => setSheet('fr')} className="btn-secondary text-[13px] py-2 px-3"><RefreshCw className="w-4 h-4" /> {tx('Mettre à jour')}</button>
              <button onClick={() => setSheet('frImport')} className="btn-ghost text-[13px] py-2 px-3"><FileUp className="w-4 h-4" /> {tx('Importer des fichiers…')}</button>
            </div>
          </>
        ),
        bannies: (
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            {info.previous?.bannies && <button onClick={restoreBans} className="btn-ghost text-[13px] py-2 px-3 mr-auto"><RotateCcw className="w-4 h-4" /> {tx('Restaurer la liste précédente')}</button>}
            <button onClick={() => setSheet('bans')} className="btn-secondary text-[13px] py-2 px-3"><RefreshCw className="w-4 h-4" /> {tx('Mettre à jour')}</button>
            <button onClick={() => setSheet('bansManual')} className="btn-ghost text-[13px] py-2 px-3"><Pencil className="w-4 h-4" /> {tx('Modifier à la main')}</button>
          </div>
        ),
      }} />
      <BanUpdateSheet open={sheet === 'bans'} onClose={() => setSheet(null)} onManual={() => setSheet('bansManual')} />
      <BanEditSheet open={sheet === 'bansManual'} onClose={() => setSheet(null)} />
      <PacksRow info={info} />
      <CardsUpdateSheet open={sheet === 'cards' || sheet === 'cardsPending'} onClose={() => setSheet(null)}
        pageText={sheet === 'cardsPending' ? notices.cartes?.page : null}
        validators={sheet === 'cardsPending' ? notices.cartes?.validators : null} />
      <TranslationsSheet open={sheet === 'fr' || sheet === 'frImport' || sheet === 'frPending'} onClose={() => setSheet(null)}
        mode={sheet === 'frImport' ? 'import' : 'download'}
        files={sheet === 'frPending' ? notices.traductions?.files : null}
        validators={sheet === 'frPending' ? notices.traductions?.validators : null} />
    </div>
  );
}

function PhoneContent() {
  const [received, setReceived] = useState(null);
  useEffect(() => { getMeta('catalogReceivedAt').then(setReceived).catch(() => {}); }, []);
  const m = getMatcher();
  const ci = m.contentInfo || {};
  const cards = m.cards || [];
  const bl = getBanlist();
  const info = {
    cards: cards.length,
    namesFr: cards.filter(c => c.nameFr).length,
    textsFr: cards.filter(c => c.textFr).length,
    errata: cards.filter(c => c.errata?.length).length,
    lastSet: cards.at(-1)?.setName || null,
    base: { generatedAt: ci.generatedAt },
    banlist: { updatedAt: bl.updatedAt, formats: bl.formats },
    layers: ci.content || {},
  };
  return (
    <div className="space-y-4">
      <Banner tone="info">{tx('Le contenu se met à jour depuis l’appli PC, puis arrive ici à la synchro.')}</Banner>
      {received && m.catalogInfo?.source === 'downloaded' && <p className="text-[13px] text-rift-400">{tx('Reçu du PC le')} {day(received)}.</p>}
      {m.catalogInfo?.ignored && <Banner tone="warn">{tx('Catalogue du PC ignoré (')}{m.catalogInfo.ignored}{tx(') : celui de l’appli est utilisé.')}</Banner>}
      <ContentCards info={info} />
    </div>
  );
}

/** Réglages → Contenu. `title`: phone heading (the PC page has its own). */
export default function ContentSection({ title = false }) {
  return (
    <div className="space-y-3">
      {title && <h2 className="text-sm font-semibold text-rift-100 flex items-center gap-2"><Layers className="w-4 h-4 text-gold-400" /> {tx('Contenu')}</h2>}
      {isDesktop ? <PcContent /> : <PhoneContent />}
    </div>
  );
}
