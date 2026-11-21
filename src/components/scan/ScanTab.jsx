import React, { useState, useCallback, useEffect } from 'react';
import DetectorStatus from '../scanner/DetectorStatus.jsx';
import { Camera, Upload, Trash2, ChevronsRight, MapPin, X, Zap, Radar, RotateCw, Search, Hand, Volume2, VolumeX, LayoutGrid } from 'lucide-react';
import { usePrefs } from '../../lib/uiPrefs.js';
import ScannerCamera from '../scanner/ScannerCamera.jsx';
import CardCounter from '../scanner/CardCounter.jsx';
import PhotoScanView from './PhotoScanView.jsx';
import usePhotoScan from './usePhotoScan.js';
import GridScanView from './GridScanView.jsx';
import LanguageToggle from '../scanner/LanguageToggle.jsx';
import ScanResultCard from '../scanner/ScanResultCard.jsx';
import PendingRow from '../scanner/PendingRow.jsx';
import ThemedSelect from '../common/ThemedSelect.jsx';
import CardPicker from '../organize/CardPicker.jsx';

const NO_OWNED = new Map();
import { useBackHandler } from '../../lib/backButton.js';
import { isSameStack } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';

// --- Component ---

export default function ScanTab({
  camera,
  detection,
  onSnapScan,
  pendingCards,
  onConfirmPending,
  onConfirmAllPending,
  onRemovePending,
  onClearPending,
  onAddCardToExport,
  onAddCardsToExport,
  showNotification,
  batchDefaults,
  onUpdateDefaults,
  org,
  copies = [],
  autoScanEnabled,
  onToggleAutoScan,
  handsFree = null,
  scanFeedback,
  onUndoScan,
  onCorrectScan,
  onConfirmDuplicate,
  onDismissScan,
  onUpdatePending,
  onManualAdd,
  onClearScan,
}) {
  const [prefs, setPrefs] = usePrefs(); // scan sounds (lot 8.2)
  const [scanMode, setScanMode] = useState('camera');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  useBackHandler((scanMode === 'camera' || scanMode === 'grid') && camera.isActive, camera.stopCamera);
  useBackHandler(sheetExpanded, () => setSheetExpanded(false));
  const [checkedPendingIndices, setCheckedPendingIndices] = useState(new Set());

  // Photo mode (lot 11.5: usePhotoScan / PhotoScanView): its state stays here when switching to the camera
  const photo = usePhotoScan({ showNotification, onAddCardToExport, onAddCardsToExport, batchDefaults });
  // Grid mode (a binder page, cards on a table): its own photo state, checked on the same screen
  const gridPhoto = usePhotoScan({ showNotification, onAddCardToExport, onAddCardsToExport, batchDefaults });

  const totalPending = pendingCards.reduce((sum, c) => sum + c.quantity, 0);

  // Clear checked pending indices when pending cards change
  useEffect(() => {
    setCheckedPendingIndices(prev => {
      if (prev.size === 0) return prev;
      // Remove indices that no longer exist
      const next = new Set([...prev].filter(i => i < pendingCards.length));
      return next.size === prev.size ? prev : next;
    });
  }, [pendingCards.length]);

  const handleConfirmCheckedPending = useCallback(() => {
    // Confirm checked cards in reverse order so indices stay valid
    const sorted = [...checkedPendingIndices].sort((a, b) => b - a);
    for (const idx of sorted) {
      onConfirmPending(idx);
    }
    setCheckedPendingIndices(new Set());
  }, [checkedPendingIndices, onConfirmPending]);

  // Clean switch between modes
  const handleModeChange = useCallback((mode) => {
    const wasActive = camera.isActive;
    camera.stopCamera();
    setScanMode(mode);
    if ((mode === 'camera' || mode === 'grid') && wasActive) {
      camera.startCamera();
    }
  }, [camera]);

  // --- Shared JSX ---

  const modeSwitcher = (
    <div className="seg flex-shrink-0" role="tablist" aria-label={tx('Mode de scan')}>
      <button role="tab" aria-selected={scanMode === 'camera'} onClick={() => handleModeChange('camera')} aria-label={tx('Caméra')} title={tx('Caméra')} className="!w-10 !px-0">
        <Camera className="w-4 h-4" />
      </button>
      <button role="tab" aria-selected={scanMode === 'grid'} onClick={() => handleModeChange('grid')} aria-label={tx('Grille (page de classeur)')} title={tx('Grille : une page de classeur ou plusieurs cartes')} className="!w-10 !px-0">
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button role="tab" aria-selected={scanMode === 'upload'} onClick={() => handleModeChange('upload')} aria-label={tx('Importer une photo')} title={tx('Importer une photo')} className="!w-10 !px-0">
        <Upload className="w-4 h-4" />
      </button>
    </div>
  );

  const languageToggle = (
    <LanguageToggle
      value={batchDefaults.language}
      onChange={(language) => onUpdateDefaults({ ...batchDefaults, language })}
    />
  );

  const hasPlaces = org && (org.boxes.items.length > 0 || org.decks.items.length > 0);
  const placeOptions = hasPlaces ? [
    { value: '', label: tx('Aucun emplacement') },
    ...org.boxes.items.map(b => ({ value: `box:${b.id}`, label: b.name, group: tx('Boîtes') })),
    ...org.decks.items.map(d => ({ value: `deck:${d.id}`, label: d.name, group: 'Decks' })),
  ] : [];
  const destination = hasPlaces && (
    <div className="relative z-40 flex items-center gap-2.5 h-11 px-3 bg-rift-800 border border-gold-500/30">
      <MapPin className="w-4 h-4 text-gold-400 flex-shrink-0" />
      <span className="text-sm text-rift-300 flex-shrink-0">{tx('Ranger dans :')}</span>
      <ThemedSelect
        value={batchDefaults.target || ''}
        options={placeOptions}
        onChange={(v) => onUpdateDefaults({ ...batchDefaults, target: v })}
        label={tx('Ranger les cartes scannées dans')}
        className="flex-1 min-w-0"
        buttonClassName="h-10 text-sm font-bold text-gold-400"
      />
    </div>
  );

  // Option A: a strip under the header — AI status, destination, camera tools.
  const ds = detection.detectorState;
  const aiStatus = ds === 'ready' ? [tx('IA prête'), '#7fd6a4'] : ds === 'error' ? [tx('Erreur IA'), '#ff8a80'] : [tx('Chargement de l’IA…'), '#f0c27a'];
  const toolBtn = (on) => `w-10 h-10 flex-shrink-0 flex items-center justify-center border ${on ? 'bg-gold-500/20 border-gold-500/60 text-gold-400' : 'bg-rift-700 border-rift-600 text-rift-100'}`;
  const toolbar = (
    <div className="relative z-40 -mx-4 -mb-3 px-4 py-2 flex items-center gap-2 bg-rift-800 border-t border-gold-500/20">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: aiStatus[1] }} />
      <span className="text-[13px] font-semibold flex-shrink-0" style={{ color: aiStatus[1] }}>{aiStatus[0]}</span>
      {hasPlaces ? (
        <ThemedSelect
          value={batchDefaults.target || ''}
          options={placeOptions}
          onChange={(v) => onUpdateDefaults({ ...batchDefaults, target: v })}
          label={tx('Ranger les cartes scannées dans')}
          className="flex-1 min-w-0"
          buttonClassName="h-9 px-1.5 text-[13px] text-rift-300"
        />
      ) : <span className="flex-1" />}
      {camera.hasTorch && (
        <button onClick={camera.toggleTorch} aria-label={tx('Lampe')} aria-pressed={camera.torchOn} className={toolBtn(camera.torchOn)}><Zap className="w-[18px] h-[18px]" /></button>
      )}
      <button onClick={() => setPrefs({ scanSounds: !prefs.scanSounds })} aria-label={tx('Sons du scan')} aria-pressed={!!prefs.scanSounds} title={prefs.scanSounds ? tx('Couper les sons') : tx('Activer les sons')} className={toolBtn(!!prefs.scanSounds)}>{prefs.scanSounds ? <Volume2 className="w-[18px] h-[18px]" /> : <VolumeX className="w-[18px] h-[18px]" />}</button>
      {handsFree && <button onClick={handsFree.toggle} aria-label={tx('Mains libres')} aria-pressed={handsFree.enabled} title={handsFree.enabled ? tx('Arrêter le scan mains libres') : tx('Scan mains libres (téléphone sur un support)')} className={toolBtn(handsFree.enabled)}><Hand className="w-[18px] h-[18px]" /></button>}
      <button onClick={onToggleAutoScan} aria-label={tx('Scan automatique')} aria-pressed={autoScanEnabled} title={autoScanEnabled ? tx('Arrêter le scan auto') : tx('Scan automatique')} className={toolBtn(autoScanEnabled)}><Radar className="w-[18px] h-[18px]" /></button>
      <button onClick={camera.toggleFacing} aria-label={tx('Changer de caméra')} className={toolBtn(false)}><RotateCw className="w-[18px] h-[18px]" /></button>
    </div>
  );

  // Header of the scan screen (both modes): title, mode, language, destination
  const scanHeader = (
    <div className="flex-shrink-0 px-4 pt-4 pb-3 lg:px-8 lg:pt-6 space-y-2.5 bg-rift-900 border-b border-gold-500/20 z-10">
      <DetectorStatus detection={detection} />
      <div className="flex items-center gap-2">
        {camera.isActive && (
          <button onClick={camera.stopCamera} aria-label={tx('Arrêter le scan')} title={tx('Arrêter le scan (revenir aux menus)')} className="w-10 h-10 -ml-2 flex items-center justify-center text-rift-100">
            <X className="w-6 h-6" />
          </button>
        )}
        {/* The title only where it fits whole (the bottom bar already says « Scanner »); camera on: the room goes to the buttons */}
        <h1 className={`h-title text-[22px] flex-1 min-w-0 truncate max-[439px]:hidden ${camera.isActive ? "invisible" : ""}`}>{tx('Scanner')}</h1>
        <button onClick={() => { onClearScan(); setSearching(true); }} aria-label={tx('Chercher une carte à la main')} title={tx('Carte non reconnue ? La chercher par son nom')}
          className="ml-auto w-10 h-10 flex-shrink-0 flex items-center justify-center border border-gold-500/35 text-gold-400"><Search className="w-[18px] h-[18px]" /></button>
        {modeSwitcher}
        {languageToggle}
      </div>
      {scanMode === 'camera' && camera.isActive ? toolbar : destination}
      {searching && (
        <CardPicker
          title={tx('Ajouter une carte à la main')}
          ownedByCard={NO_OWNED}
          onPick={(c) => { onManualAdd(c); setSearching(false); }}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );

  // ═══════════════════════════════════════════
  // CAMERA MODE
  // ═══════════════════════════════════════════
  if (scanMode === 'camera') {
    return (
      <div key="camera" className="flex-1 min-h-0 flex flex-col">
      {scanHeader}
      <div className="flex-1 relative overflow-hidden lg:flex lg:flex-row">
        {/* Camera area */}
        <div className="absolute inset-0 lg:relative lg:flex-1">
          <ScannerCamera
            videoRef={camera.videoRef}
            isActive={camera.isActive}
            error={camera.error}
            isProcessing={detection.isProcessing}
            lastDetection={detection.lastDetection}
            onStartCamera={camera.startCamera}
            onUseUpload={() => handleModeChange('upload')}
            onStopCamera={camera.stopCamera}
            onToggleFacing={camera.toggleFacing}
            onSnapScan={onSnapScan}
            detectorState={detection.detectorState}
            hasTorch={camera.hasTorch}
            torchOn={camera.torchOn}
            onToggleTorch={camera.toggleTorch}
            autoScanEnabled={autoScanEnabled}
            onToggleAutoScan={onToggleAutoScan}
            handsFree={handsFree}
            scanPhase={scanFeedback?.phase || 'idle'}
            scanAt={scanFeedback?.at}
          >
            {/* Scan result, shown on the frame */}
            <ScanResultCard
              feedback={scanFeedback}
              listQty={scanFeedback?.candidate ? pendingCards.filter(c => isSameStack(c, scanFeedback.candidate)).reduce((n, c) => n + c.quantity, 0) : 0}
              language={batchDefaults.language}
              onUndo={onUndoScan}
              onCorrect={onCorrectScan}
              onConfirmDuplicate={onConfirmDuplicate}
              onDismiss={onDismissScan}
            />
          </ScannerCamera>

          {/* Floating card counter (mobile only) */}
          {!sheetExpanded && totalPending > 0 && (
            <CardCounter
              count={totalPending}
              uniqueCount={pendingCards.length}
              onTap={() => setSheetExpanded(true)}
            />
          )}
        </div>

        {/* ── Backdrop to close sheet on mobile ── */}
        {pendingCards.length > 0 && sheetExpanded && (
          <div
            className="absolute inset-0 bg-black/40 z-20 backdrop-blur-sm lg:hidden transition-opacity duration-300 fade-in"
            onClick={() => setSheetExpanded(false)}
          />
        )}

        {/* ── Pending cards: mobile bottom overlay ── */}
        {pendingCards.length > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 z-30 bg-rift-800 border-t border-gold-500/40 transition-[height] duration-150 ease-out flex flex-col lg:hidden"
            style={{ height: sheetExpanded ? '55dvh' : 64 }}
          >
            <div
              onClick={() => setSheetExpanded(prev => !prev)}
              className="flex items-center justify-between gap-2 px-4 py-2.5 flex-shrink-0 cursor-pointer"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setSheetExpanded(prev => !prev); }}
                aria-expanded={sheetExpanded}
                className="flex items-center gap-2 min-h-[44px] text-left"
              >
                <span className="font-display text-[15px] font-bold text-gold-400">{tx('À ajouter ·')} {totalPending}</span>
                <span className="text-xs text-rift-400">{sheetExpanded ? tx('réduire') : 'voir'}</span>
              </button>
              <div className="flex items-center gap-2">
                {checkedPendingIndices.size > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleConfirmCheckedPending(); }}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    <ChevronsRight className="w-4 h-4" />
                    {tx('Ajouter (')}{checkedPendingIndices.size})
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onConfirmAllPending(); }}
                    className="btn-primary text-sm py-2 px-4"
                  >
                    <ChevronsRight className="w-4 h-4" />
                    {tx('Tout ajouter')}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onClearPending(); }}
                  aria-label={tx('Vider la liste')}
                  className="btn-ghost w-11 h-11 !p-0 text-[#ff8a80] hover:bg-red-400/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {sheetExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
                {pendingCards.map((card, index) => (
                  <PendingRow
                    key={`${card.cardData.id}-${card.language}-${card.scanTimestamp}`}
                    card={card}
                    index={index}
                    onUpdate={onUpdatePending}
                    onRemove={onRemovePending}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Pending cards: desktop side panel ── */}
        <div className="hidden lg:flex flex-col w-[400px] xl:w-[460px] flex-shrink-0 border-l border-gold-500/20 bg-rift-800/60">
          <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0 border-b border-rift-600/20">
            <h3 className="font-display text-[15px] font-bold text-gold-400 flex-1">
              {tx('À ajouter (')}{pendingCards.length})
            </h3>
            {pendingCards.length > 0 && (
              <>
                {checkedPendingIndices.size > 0 ? (
                  <button onClick={handleConfirmCheckedPending} className="btn-primary text-xs py-2 px-4 rounded-lg">
                    <ChevronsRight className="w-4 h-4" />
                    {tx('Ajouter (')}{checkedPendingIndices.size})
                  </button>
                ) : (
                  <button onClick={onConfirmAllPending} className="btn-primary text-xs py-2 px-4 rounded-lg">
                    <ChevronsRight className="w-4 h-4" />
                    {tx('Tout ajouter')}
                  </button>
                )}
                <button onClick={onClearPending} aria-label={tx('Vider la liste « À ajouter »')} className="btn-ghost text-xs py-2 px-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">
            {pendingCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-rift-400">{tx('Aucune carte à ajouter')}</p>
                <p className="text-xs text-rift-500 mt-1">{tx('Scannez une carte avec la caméra ou importez une photo')}</p>
              </div>
            ) : (
              pendingCards.map((card, index) => (
                <PendingRow
                  key={`${card.cardData.id}-${card.language}-${card.scanTimestamp}`}
                  card={card}
                  index={index}
                  onUpdate={onUpdatePending}
                  onRemove={onRemovePending}
                />
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // GRID MODE (gridScan.js)
  // ═══════════════════════════════════════════
  if (scanMode === 'grid') {
    return (
      <GridScanView
        camera={camera}
        photo={gridPhoto}
        header={scanHeader}
        language={batchDefaults.language}
        detectorState={detection.detectorState}
        showNotification={showNotification}
        batchDefaults={batchDefaults}
        org={org}
        copies={copies}
      />
    );
  }

  // ═══════════════════════════════════════════
  // UPLOAD MODE
  // ═══════════════════════════════════════════

  return <PhotoScanView photo={photo} header={scanHeader} language={batchDefaults.language} />;
}
