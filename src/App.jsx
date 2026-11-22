import React, { Suspense, lazy, useEffect, useState } from 'react';
import PageLoading from './components/PageLoading.jsx';
const DecksTab = lazy(() => import('./components/organize/DecksTab.jsx'));
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import StartupError from './components/common/StartupError.jsx';
import WhatsNew from './components/common/WhatsNew.jsx';
import AppShell from './components/AppShell.jsx';
import BottomTabBar from './components/BottomTabBar.jsx';
import ToastNotification from './components/ToastNotification.jsx';
import { SplashGate } from './components/common/ForgeSplash.jsx';
import CollectionTab from './components/collection/CollectionTab.jsx';
import UndoBar from './components/UndoBar.jsx';
// The other tabs are loaded when first opened (smaller startup code).
const ScanTab = lazy(() => import('./components/scan/ScanTab.jsx'));
const CardsTab = lazy(() => import('./components/cards/CardsTab.jsx'));
const ValueTab = lazy(() => import('./components/value/ValueTab.jsx'));
const OrganizeTab = lazy(() => import('./components/organize/OrganizeTab.jsx'));
const MoreTab = lazy(() => import('./components/more/MoreTab.jsx'));
import useAppController from './hooks/useAppController.js';
import GlobalSearch from './components/common/GlobalSearch.jsx';
import Welcome from './components/common/Welcome.jsx';
import NoCards from './components/common/NoCards.jsx';
import HelpLayer, { HelpFab } from './components/common/HelpLayer.jsx';
import { useHelpPage } from './lib/help.js';
import { requestOpen, onRequest } from './lib/navRequest.js';
import { tx } from './lib/i18n.js';

/** Android (phone) interface. The PC has its own: src/desktop/. */
export default function App() {
  const {
    isLoading,
    startupError,
    continueWithoutScanner,
    loadProgress,
    loadStage,
    pendingCards,
    collection,
    scannedCards,
    wishlist,
    org,
    activeTab,
    setActiveTab,
    notification,
    batchDefaults,
    setBatchDefaults,
    camera,
    detection,
    showNotification,
    autoScan,
    handsFree,
    scanFeedback,
    handleSnapScan,
    handleUndoScan,
    handleCorrectScan,
    handleConfirmDuplicate,
    handleManualAdd,
    handleClearScan,
    handleDismissScan,
    handleUpdatePending,
    handleConfirmPending,
    handleConfirmAllPending,
    handleRemovePending,
    handleClearPending,
    handleUpdateCard,
    undo,
    setUndo,
    handleRemoveCard,
    handleDeleteStacks,
    handleClearAll,
    handleAddCardToExport,
    handleAddCopy,
    handleQuickAdd,
    findMode,
    setFindMode,
    handleRemoveCopy,
    handleAddCardsToExport,
    handleExport,
  } = useAppController();
  const [searchMode, setSearchMode] = useState(null); // lot 6 e: 'search' | 'add' | null
  // « Voir dans Cartes » (global search, Progression): the tab takes the request when it shows
  useEffect(() => onRequest((r) => { if (r.kind === 'cards') setActiveTab('cards'); }), [setActiveTab]);
  // « Trouver une carte » ends when you leave the scanner
  useEffect(() => { if (activeTab !== 'scan' && findMode) setFindMode(false); }, [activeTab, findMode, setFindMode]);

  useHelpPage(isLoading || startupError ? null : activeTab); // help: the page's tour the first time

  // ─── Render ────────────────────────────────────────────────
  if (isLoading) return <SplashGate isLoading progress={loadProgress} stage={loadStage} />;
  if (startupError) return <SplashGate isLoading={false}><StartupError error={startupError} onContinue={continueWithoutScanner} /></SplashGate>;

  return (
    <SplashGate isLoading={false}>
    <AppShell>
      <WhatsNew />
      <HelpLayer />
      <HelpFab />
      <Welcome copies={collection.totalCopies} pending={pendingCards.length}
        onPair={() => { requestOpen({ kind: 'setting', id: 'sync' }); setActiveTab('more'); }} />
      <GlobalSearch open={!!searchMode} mode={searchMode || 'search'} onOpen={setSearchMode} onClose={() => setSearchMode(null)}
        scannedCards={scannedCards} wishlist={wishlist} org={org} collection={collection} onAddCopy={handleAddCopy}
        language={batchDefaults.language} notify={showNotification}
        navigate={(page, opts = {}) => {
          if (['collection', 'cards', 'value', 'decks', 'boxes', 'scan'].includes(page)) { setActiveTab(page); return; }
          if (page === 'settings') requestOpen({ kind: 'setting', id: opts.setting });
          else requestOpen({ kind: 'more', id: page });
          setActiveTab('more');
        }} />
      {/* PC: navigation on the left (the bottom bar is for phones) */}
      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0">
        <NoCards onSync={() => { requestOpen({ kind: 'setting', id: 'sync' }); setActiveTab('more'); }} />
        <ErrorBoundary key={activeTab} where={activeTab} page>
        <Suspense fallback={<PageLoading />}>
        {activeTab === 'scan' && findMode && (
          <div role="status" className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-gold-500/15 border-b border-gold-500/40 text-[13px] text-gold-400">
            <span className="flex-1">{tx('Trouver une carte : scannez-la, sa fiche s’ouvre dans Cartes (rien n’est ajouté).')}</span>
            <button onClick={() => { setFindMode(false); setActiveTab('cards'); }} className="min-h-[44px] px-2 font-semibold underline">{tx('Annuler')}</button>
          </div>
        )}
        {activeTab === 'scan' && (
          <ScanTab
            camera={camera}
            detection={detection}
            onSnapScan={handleSnapScan}
            scanFeedback={scanFeedback}
            onUndoScan={handleUndoScan}
            onCorrectScan={handleCorrectScan}
            onConfirmDuplicate={handleConfirmDuplicate}
            onDismissScan={handleDismissScan}
            onUpdatePending={handleUpdatePending}
            onManualAdd={handleManualAdd}
            onClearScan={handleClearScan}
            pendingCards={pendingCards}
            onConfirmPending={handleConfirmPending}
            onConfirmAllPending={handleConfirmAllPending}
            onRemovePending={handleRemovePending}
            onClearPending={handleClearPending}
            onAddCardToExport={handleAddCardToExport}
            onAddCardsToExport={handleAddCardsToExport}
            showNotification={showNotification}
            batchDefaults={batchDefaults}
            onUpdateDefaults={setBatchDefaults}
            org={org}
            copies={collection.copies}
            autoScanEnabled={autoScan.autoScanEnabled}
            onToggleAutoScan={autoScan.toggleAutoScan}
            handsFree={handsFree}
          />
        )}

        {activeTab === 'collection' && (
          <CollectionTab
            scannedCards={scannedCards}
            wishlist={wishlist}
            org={org}
            onMoveStack={collection.moveStack}
            onAddCopy={handleAddCopy}
            onUpdateCard={handleUpdateCard}
            onRemoveCard={handleRemoveCard}
            onRemoveCopy={handleRemoveCopy}
            onDeleteStacks={handleDeleteStacks}
            onClearAll={handleClearAll}
            onExport={handleExport}
            collection={collection}
            defaultLanguage={batchDefaults.language}
            onImportEntries={(entries) => {
              collection.addEntries(entries);
              showNotification(tx('{reduce} exemplaire(s) importé(s)', { reduce: entries.reduce((n, e) => n + e.quantity, 0) }), 'success');
            }}
          />
        )}

        {activeTab === 'decks' && (
          <DecksTab collection={collection} org={org} wishlist={wishlist} onAddCopy={handleAddCopy} showNotification={showNotification} />
        )}

        {activeTab === 'value' && (
          <ValueTab scannedCards={scannedCards} wishlist={wishlist} onAddCopy={handleAddCopy} />
        )}

        {activeTab === 'boxes' && (
          <div className="relative flex-1 min-h-0 flex flex-col">
            <h1 className="h-title text-[22px] px-4 pt-5 pb-1 flex-shrink-0">{tx('Boîtes')}</h1>
            <OrganizeTab collection={collection} org={org} wishlist={wishlist} onAddCopy={handleAddCopy} fixedView="boxes" hideHeader />
          </div>
        )}

        {activeTab === 'cards' && (
          <CardsTab scannedCards={scannedCards} wishlist={wishlist} org={org} onAddCopy={handleAddCopy}
            onRemoveCopy={handleRemoveCopy} onUpdateCard={handleUpdateCard} onQuickAdd={handleQuickAdd} notify={showNotification}
            onFind={() => { setFindMode(true); setActiveTab('scan'); }} />
        )}

        {activeTab === 'more' && (
          <MoreTab
            scannedCards={scannedCards}
            collection={collection}
            org={org}
            wishlist={wishlist}
            onAddCopy={handleAddCopy}
            defaultLanguage={batchDefaults.language}
            showNotification={showNotification}
            settingsProps={{
              batchDefaults,
              onUpdateDefaults: setBatchDefaults,
            }}
          />
        )}
        </Suspense>
        </ErrorBoundary>
      </div>

      {/* Bottom navigation — hidden while scanning, for a bigger camera */}
      {!(activeTab === 'scan' && camera.isActive) && <BottomTabBar
        activeTab={activeTab}
        onTabChange={(id) => {
          // The Scanner button of the bar also scans when the scanner is already open.
          if (id === 'scan' && activeTab === 'scan') handleSnapScan();
          else setActiveTab(id);
        }}
        scannedCount={collection.totalCopies}
      />}

      {/* Toast */}
      <ToastNotification notification={notification} />
      <UndoBar undo={undo} onClose={() => setUndo(null)} />
    </AppShell>
    </SplashGate>
  );
}
