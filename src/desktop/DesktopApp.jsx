import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import PageLoading from '../components/PageLoading.jsx';
import ErrorBoundary from '../components/common/ErrorBoundary.jsx';
import StartupError from '../components/common/StartupError.jsx';
import WhatsNew from '../components/common/WhatsNew.jsx';
import useAppController from '../hooks/useAppController.js';
import { SplashGate } from '../components/common/ForgeSplash.jsx';
import ToastNotification from '../components/ToastNotification.jsx';
import UndoBar from '../components/UndoBar.jsx';
import Sidebar from './Sidebar.jsx';
import CollectionPage from './pages/CollectionPage.jsx';
import GlobalSearch from '../components/common/GlobalSearch.jsx';
import Welcome from '../components/common/Welcome.jsx';
import NoCards from '../components/common/NoCards.jsx';
import ShortcutsDialog from '../components/common/ShortcutsDialog.jsx';
import { keyToAction, isTyping } from '../lib/shortcuts.js';
import { tx } from '../lib/i18n.js';
// The other pages are loaded when first opened (smaller startup code).
const ScanPage = lazy(() => import('./pages/ScanPage.jsx'));
const DecksPage = lazy(() => import('./pages/DecksPage.jsx'));
const ValuePage = lazy(() => import('./pages/ValuePage.jsx'));
const MatchesView = lazy(() => import('../components/matches/MatchesView.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const BoxesPage = lazy(() => import('./pages/OrganizePages.jsx').then(m => ({ default: m.BoxesPage })));
const LoansPage = lazy(() => import('./pages/OrganizePages.jsx').then(m => ({ default: m.LoansPage })));
const TradesPage = lazy(() => import('./pages/OrganizePages.jsx').then(m => ({ default: m.TradesPage })));

/**
 * PC interface (the Android one is src/App.jsx). Same data and logic
 * (useAppController), its own navigation and screens for mouse and big screens.
 */
export default function DesktopApp() {
  const c = useAppController();
  const { activeTab: page, setActiveTab: setPage } = c;
  const [settingsSection, setSettingsSection] = useState(null); // B.3: status zone → a settings section
  const [searchMode, setSearchMode] = useState(null); // lot 6 e: 'search' | 'add' | null
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Lot 6 i: keyboard shortcuts (list: « ? »)
  useEffect(() => {
    const onKey = (e) => {
      const a = keyToAction(e, isTyping(document.activeElement));
      if (!a) return;
      e.preventDefault();
      if (a.search) setSearchMode('search');
      else if (a.add) setSearchMode('add');
      else if (a.help) setShortcutsOpen(true);
      else if (a.page) { setSearchMode(null); setPage(a.page); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPage]);
  // The PC opens on the collection (the phone opens on the scanner)
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) { started.current = true; setPage('collection'); }
  }, [setPage]);

  if (c.isLoading) return <SplashGate isLoading pc progress={c.loadProgress} stage={c.loadStage} />;
  if (c.startupError) return <SplashGate isLoading={false} pc><StartupError error={c.startupError} onContinue={c.continueWithoutScanner} /></SplashGate>;

  return (
    <SplashGate isLoading={false} pc>
    <div className="flex h-[100dvh] bg-rift-900 overflow-hidden">
      <WhatsNew />
      <Welcome copies={c.collection.totalCopies} pending={c.pendingCards.length} />
      <GlobalSearch open={!!searchMode} mode={searchMode || 'search'} onOpen={setSearchMode} onClose={() => setSearchMode(null)}
        scannedCards={c.scannedCards} wishlist={c.wishlist} org={c.org} collection={c.collection} onAddCopy={c.handleAddCopy}
        language={c.batchDefaults.language} notify={c.showNotification}
        navigate={(p, opts = {}) => { if (p === 'settings') setSettingsSection({ section: opts.setting, n: Date.now() }); setPage(p); }} />
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      <Sidebar page={page} onChange={setPage} onSearch={() => setSearchMode('search')} onSettings={(section) => { setSettingsSection({ section, n: Date.now() }); setPage('settings'); }}
        counts={{ collection: c.collection.totalCopies, scan: c.pendingCards.length }} />

      <main className="flex-1 min-w-0 flex flex-col relative">
        <NoCards />
        <ErrorBoundary key={page} where={page} page>
        <Suspense fallback={<PageLoading />}>
        {page === 'collection' && (
          <CollectionPage
            scannedCards={c.scannedCards}
            wishlist={c.wishlist}
            org={c.org}
            onMoveStack={c.collection.moveStack}
            onAddCopy={c.handleAddCopy}
            onUpdateCard={c.handleUpdateCard}
            onRemoveCard={c.handleRemoveCard}
            onRemoveCopy={c.handleRemoveCopy}
            onDeleteStacks={c.handleDeleteStacks}
            onExport={c.handleExport}
            defaultLanguage={c.batchDefaults.language}
            onImportEntries={(entries) => {
              c.collection.addEntries(entries);
              c.showNotification(tx('{reduce} exemplaire(s) importé(s)', { reduce: entries.reduce((n, e) => n + e.quantity, 0) }), 'success');
            }}
          />
        )}

        {page === 'scan' && (
          <ScanPage
            camera={c.camera}
            detection={c.detection}
            onSnapScan={c.handleSnapScan}
            scanFeedback={c.scanFeedback}
            onUndoScan={c.handleUndoScan}
            onCorrectScan={c.handleCorrectScan}
            onConfirmDuplicate={c.handleConfirmDuplicate}
            onDismissScan={c.handleDismissScan}
            onUpdatePending={c.handleUpdatePending}
            onManualAdd={c.handleManualAdd}
            onClearScan={c.handleClearScan}
            pendingCards={c.pendingCards}
            onConfirmPending={c.handleConfirmPending}
            onConfirmAllPending={c.handleConfirmAllPending}
            onRemovePending={c.handleRemovePending}
            onClearPending={c.handleClearPending}
            onAddCardToExport={c.handleAddCardToExport}
            onAddCardsToExport={c.handleAddToPending}
            onAddCardsToCollection={c.handleAddCardsToExport}
            copies={c.collection.copies}
            showNotification={c.showNotification}
            batchDefaults={c.batchDefaults}
            onUpdateDefaults={c.setBatchDefaults}
            org={c.org}
            autoScanEnabled={c.autoScan.autoScanEnabled}
            onToggleAutoScan={c.autoScan.toggleAutoScan}
            handsFree={c.handsFree}
          />
        )}

        {page === 'decks' && (
          <DecksPage collection={c.collection} org={c.org} wishlist={c.wishlist} onAddCopy={c.handleAddCopy} />
        )}

        {page === 'matches' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <header className="flex-shrink-0 px-8 pt-7 pb-4 border-b border-gold-500/15">
              <h1 className="h-title text-[28px] leading-none">{tx('Matchs')}</h1>
              <p className="text-sm text-rift-400 mt-2">{tx('Résultats de vos parties, statistiques par deck et par matchup, compteur de points')}</p>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6"><MatchesView org={c.org} showNotification={c.showNotification} /></div>
          </div>
        )}

        {page === 'value' && <ValuePage scannedCards={c.scannedCards} wishlist={c.wishlist} onAddCopy={c.handleAddCopy} />}

        {page === 'boxes' && <BoxesPage c={c} />}
        {page === 'loans' && <LoansPage c={c} />}
        {page === 'trades' && <TradesPage c={c} />}
        {page === 'settings' && (
          <SettingsPage key={settingsSection?.n} initialSection={settingsSection?.section} batchDefaults={c.batchDefaults} onUpdateDefaults={c.setBatchDefaults} />
        )}
        </Suspense>
        </ErrorBoundary>
      </main>

      <ToastNotification notification={c.notification} />
      <UndoBar undo={c.undo} onClose={() => c.setUndo(null)} />
    </div>
    </SplashGate>
  );
}
