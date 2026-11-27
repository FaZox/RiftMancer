import React, { useCallback, useEffect, useState } from 'react';
import { Repeat, Users, Settings, ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNeedsAttention } from '../../lib/attention.js';
import FriendsView from '../friends/FriendsView.jsx';
import CardZoom from '../collection/CardZoom.jsx';
import OrganizeTab from '../organize/OrganizeTab.jsx';
import SettingsTab from '../settings/SettingsTab.jsx';
import { getSyncState, subscribeSync, checkPcOffer } from '../../lib/syncClient.js';
import { SyncButtons } from '../settings/SyncSection.jsx';
import { isDesktop } from '../../lib/collectionDB.js';
import { useBackHandler } from '../../lib/backButton.js';
import { takeRequest, onRequest } from '../../lib/navRequest.js';
import { tx } from '../../lib/i18n.js';

/**
 * « Plus » tab: everything that is not used every day — trades, boxes,
 * loans, settings (with the phone ↔ PC sync).
 */
export default function MoreTab({ scannedCards, collection, org, wishlist, onAddCopy, defaultLanguage, settingsProps, showNotification }) {
  const [section, setSection] = useState(() => takeRequest('more')?.id || null);
  const [settingsOpen, setSettingsOpen] = useState(() => takeRequest('setting')?.id || null);
  useEffect(() => onRequest((q) => {
    if (q.kind === 'more') { takeRequest('more'); setSection(q.id); }
    if (q.kind === 'setting') { takeRequest('setting'); setSettingsOpen(q.id); setSection('settings'); }
  }), []);
  useBackHandler(!!section, () => setSection(null));
  const [zoom, setZoom] = useState(null);
  const attention = useNeedsAttention();
  const [sync, setSync] = useState(getSyncState());
  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => { if (!isDesktop) checkPcOffer(); }, []);
  const openCard = useCallback((cardId) => setZoom(cardId), []);

  const activeLoans = org.loans.items.filter(l => !l.returnedAt).length;
  const syncLine = isDesktop
    ? tx('Appairer le téléphone, sauvegardes, options')
    : sync.paired
      ? (sync.status === 'syncing' ? 'Synchronisation…' : tx('PC : {v0}{v1}', { v0: sync.pcName || tx('appairé'), v1: sync.pending ? ` · ${sync.pending} changement(s) à envoyer` : '' }))
      : tx('Synchronisation avec le PC, options');

  const SECTIONS = [
    { id: 'trades', label: tx('Échanges et amis'), sub: tx('{length} liste(s) d’amis · {length2} échange(s) enregistré(s)', { length: org.people.items.filter(p => p.list).length, length2: org.trades.items.length }), icon: Repeat },
    { id: 'loans', label: tx('Prêts'), sub: activeLoans ? tx('{activeLoans} prêt(s) en cours', { activeLoans }) : tx('Aucun prêt en cours'), icon: Users },
    { id: 'settings', label: tx('Réglages'), sub: syncLine, icon: Settings },
  ];
  const current = SECTIONS.find(s => s.id === section);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {section === 'settings' ? (
        // Réglages has its own header (list of sections, then each section with its back arrow)
        <SettingsTab key={settingsOpen || 'list'} {...settingsProps} initialOpen={settingsOpen} onClose={() => { setSection(null); setSettingsOpen(null); }} />
      ) : !current ? (
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="px-4 pt-5 space-y-3 lg:px-8 lg:pt-7 lg:max-w-[1100px]">
            <h1 className="h-title text-[22px]">{tx('Plus')}</h1>
            {!isDesktop && sync.paired && (
              <div className="panel p-3 space-y-2">
                <p className="flex items-center gap-2 text-sm text-rift-200">
                  <RefreshCw className={`w-4 h-4 text-gold-400 ${sync.status === 'syncing' ? 'animate-spin' : ''}`} />
                  {syncLine}
                </p>
                {sync.lastError && <p className="text-xs text-[#ff8a80]">{sync.lastError}</p>}
                <SyncButtons s={sync} />
              </div>
            )}
            <nav aria-label={tx('Sections')} className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-3">
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setSection(s.id)}
                  className="flex items-center gap-3 min-h-[64px] px-1 border-b border-rift-600/60 text-left active:bg-rift-800 lg:px-4 lg:min-h-[84px] lg:border lg:border-rift-600/50 lg:bg-rift-800/40 lg:hover:border-gold-500/50 lg:hover:bg-rift-800">
                  <span className="hex-cut-sm w-10 h-10 flex items-center justify-center bg-rift-800 border border-gold-500/30">
                    <s.icon className="w-5 h-5 text-gold-400" />
                  </span>
                  {s.id === 'settings' && attention && <span className="w-2 h-2 rotate-45 bg-gold-400 -ml-1" aria-label={tx('À voir')} />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-rift-100">{s.label}</span>
                    <span className="block text-[13px] text-rift-400 truncate">{s.sub}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-rift-500" />
                </button>
              ))}
            </nav>
          </div>
        </div>
      ) : (
        <>
          <div className="px-2 pt-3 pb-1 lg:px-6 lg:pt-5 flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setSection(null)} aria-label={tx('Retour')} className="w-11 h-11 flex items-center justify-center text-rift-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="h-title text-[20px]">{current.label}</h1>
          </div>
          {section === 'trades' && (
            <FriendsView scannedCards={scannedCards} collection={collection} org={org} wishlist={wishlist} defaultLanguage={defaultLanguage} onOpen={openCard} notify={showNotification} />
          )}
          {(section === 'boxes' || section === 'loans') && (
            <OrganizeTab collection={collection} org={org} wishlist={wishlist} onAddCopy={onAddCopy} fixedView={section} hideHeader />
          )}
        </>
      )}
      {zoom && (
        <CardZoom
          cardId={zoom}
          stacks={scannedCards}
          wanted={wishlist.byCard.get(zoom)?.quantity || 0}
          byCard={wishlist.byCard}
          onSetWanted={wishlist.setWanted}
          onAddCopy={onAddCopy}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
