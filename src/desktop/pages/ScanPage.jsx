import React, { useCallback, useEffect, useRef, useState } from 'react';
import DetectorStatus from '../../components/scanner/DetectorStatus.jsx';
import {
  ImagePlus, Camera, Search, MapPin, Loader2, Check, AlertCircle, ChevronsRight, Trash2, X, Plus, RotateCcw, Image as ImageIcon, LayoutGrid,
} from 'lucide-react';
import GridScanView from '../../components/scan/GridScanView.jsx';
import usePhotoScan from '../../components/scan/usePhotoScan.js';
import ScannerCamera from '../../components/scanner/ScannerCamera.jsx';
import ScanResultCard from '../../components/scanner/ScanResultCard.jsx';
import PendingRow from '../../components/scanner/PendingRow.jsx';
import LanguageToggle from '../../components/scanner/LanguageToggle.jsx';
import DetectionCanvas, { DETECTION_COLORS } from '../../components/identify/DetectionCanvas.jsx';
import CardDetailPanel from '../../components/identify/CardDetailPanel.jsx';
import ThemedSelect from '../../components/common/ThemedSelect.jsx';
import CardPicker from '../../components/organize/CardPicker.jsx';
import { loadImageFile, detectCards, rematchCorners, resolveMatchCardData, isAcceptedDetection, learnFromDetections } from '../../lib/photoScan.js';
import { isSameStack } from '../../lib/cardLocale.js';
import { tx } from '../../lib/i18n.js';

const NO_OWNED = new Map();
let nextId = 1;

/**
 * PC scanner. Photos first: drop or pick several photos at once, check what
 * was recognised on each, add them one by one or all in one go. The webcam is
 * the second mode. The « À ajouter » list stays on the right; nothing goes to
 * the collection until « Tout ajouter à la collection ».
 */
export default function ScanPage(props) {
  const {
    camera, detection, onSnapScan, scanFeedback, onUndoScan, onCorrectScan, onConfirmDuplicate, onDismissScan,
    onUpdatePending, onManualAdd, onClearScan, pendingCards, onConfirmAllPending, onRemovePending, onClearPending,
    onAddCardsToExport, showNotification, batchDefaults, onUpdateDefaults, org, autoScanEnabled, onToggleAutoScan, handsFree = null,
    onAddCardToExport, onAddCardsToCollection, copies,
  } = props;
  const [mode, setMode] = useState('photos');
  // « Grille » (same as the phone): a binder page or cards on a table under the webcam; the page checked is added to the collection
  const gridPhoto = usePhotoScan({ showNotification, onAddCardToExport, onAddCardsToExport: onAddCardsToCollection, batchDefaults });
  const [searching, setSearching] = useState(false);

  const switchMode = (m) => {
    if (m === mode) return;
    const wasActive = camera.isActive;
    camera.stopCamera();
    // the single-card automatic scan would compete with the grid for the same webcam
    if (m === 'grid' && autoScanEnabled) onToggleAutoScan();
    setMode(m);
    if (wasActive && (m === 'webcam' || m === 'grid')) camera.startCamera();
  };
  // Leaving the page turns the webcam off
  useEffect(() => () => camera.stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const placeOptions = [
    { value: '', label: tx('Aucun emplacement') },
    ...org.boxes.items.map(b => ({ value: `box:${b.id}`, label: b.name, group: tx('Boîtes') })),
    ...org.decks.items.map(d => ({ value: `deck:${d.id}`, label: d.name, group: 'Decks' })),
  ];
  const ds = detection.detectorState;
  const ai = ds === 'ready' ? [tx('IA prête'), '#7fd6a4'] : ds === 'error' ? [tx('Erreur de l’IA'), '#ff8a80'] : [tx('Chargement de l’IA…'), '#f0c27a'];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header: title, mode, and the options that apply to every scanned card */}
      <header className="flex-shrink-0 px-8 pt-7 pb-4 flex items-center gap-6 border-b border-gold-500/15 flex-wrap">
        <div>
          <h1 className="h-title text-[28px] leading-none">{tx('Scanner')}</h1>
          <p className="text-sm mt-2 flex items-center gap-2" style={{ color: ai[1] }}>
            <span className="w-2 h-2 rounded-full" style={{ background: ai[1] }} />{ai[0]}
          </p>
        </div>
        <div className="seg w-[420px]" role="tablist" aria-label={tx('Mode de scan')} data-help="scan.modes">
          <button role="tab" aria-selected={mode === 'photos'} onClick={() => switchMode('photos')}><ImageIcon className="w-4 h-4" /> {tx('Photos')}</button>
          <button role="tab" aria-selected={mode === 'webcam'} onClick={() => switchMode('webcam')}><Camera className="w-4 h-4" /> {tx('Webcam')}</button>
          <button role="tab" aria-selected={mode === 'grid'} onClick={() => switchMode('grid')} title={tx('Grille : une page de classeur ou plusieurs cartes')}><LayoutGrid className="w-4 h-4" /> {tx('Grille')}</button>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 h-10 pl-3 border border-gold-500/30 bg-rift-800 w-[300px]" data-help="scan.place">
            <MapPin className="w-4 h-4 text-gold-400 flex-shrink-0" />
            <span className="text-sm text-rift-400 flex-shrink-0">{tx('Ranger dans')}</span>
            <ThemedSelect value={batchDefaults.target || ''} options={placeOptions}
              onChange={(v) => onUpdateDefaults({ ...batchDefaults, target: v })}
              label={tx('Ranger les cartes scannées dans')} className="flex-1 min-w-0" buttonClassName="h-9 text-sm font-bold text-gold-400" />
          </div>
          <div className="flex items-center gap-2" data-help="scan.lang">
            <span className="text-sm text-rift-400">{tx('Langue des cartes')}</span>
            <LanguageToggle value={batchDefaults.language} onChange={(language) => onUpdateDefaults({ ...batchDefaults, language })} />
          </div>
          <button data-help="scan.search" onClick={() => { onClearScan(); setSearching(true); }} className="btn-secondary h-10 px-4 text-sm" title={tx('Carte non reconnue ? La chercher par son nom')}>
            <Search className="w-4 h-4" /> {tx('Chercher une carte')}
          </button>
        </div>
      </header>
      <DetectorStatus detection={detection} className="mx-8 mt-3" />

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {mode === 'photos' ? (
            <PhotosMode language={batchDefaults.language} onAddCards={onAddCardsToExport} showNotification={showNotification} detectorReady={ds === 'ready'} />
          ) : mode === 'grid' ? (
            <GridScanView camera={camera} photo={gridPhoto} header={null} language={batchDefaults.language} detectorState={ds}
              showNotification={showNotification} batchDefaults={batchDefaults} org={org} copies={copies} />
          ) : (
            <div className="flex-1 relative">
              <ScannerCamera
                videoRef={camera.videoRef}
                isActive={camera.isActive}
                error={camera.error}
                isProcessing={detection.isProcessing}
                lastDetection={detection.lastDetection}
                onStartCamera={camera.startCamera}
                onUseUpload={() => switchMode('photos')}
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
              {camera.isActive && (
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                  {handsFree && (
                    <button onClick={handsFree.toggle} aria-pressed={handsFree.enabled}
                      className={`h-10 px-4 text-sm border ${handsFree.enabled ? 'bg-gold-500/20 border-gold-500/60 text-gold-400' : 'bg-rift-900/80 border-rift-600 text-rift-100'}`}>
                      {tx('Mains libres')} {handsFree.enabled ? tx('activé') : tx('désactivé')}
                    </button>
                  )}
                  <button onClick={onToggleAutoScan} aria-pressed={autoScanEnabled}
                    className={`h-10 px-4 text-sm border ${autoScanEnabled ? 'bg-gold-500/20 border-gold-500/60 text-gold-400' : 'bg-rift-900/80 border-rift-600 text-rift-100'}`}>
                    {tx('Scan automatique')} {autoScanEnabled ? tx('activé') : tx('désactivé')}
                  </button>
                  <button onClick={camera.stopCamera} className="h-10 px-4 text-sm bg-rift-900/80 border border-rift-600 text-rift-100 flex items-center gap-2">
                    <X className="w-4 h-4" /> {tx('Arrêter la webcam')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <PendingPanel pendingCards={pendingCards} onUpdate={onUpdatePending} onRemove={onRemovePending}
          onConfirmAll={onConfirmAllPending} onClear={onClearPending} />
      </div>

      {searching && (
        <CardPicker title={tx('Ajouter une carte à la main')} ownedByCard={NO_OWNED}
          onPick={(c) => { onManualAdd(c); setSearching(false); }} onClose={() => setSearching(false)} />
      )}
    </div>
  );
}

// ─── « À ajouter », always visible on the right ───────────────────────────
function PendingPanel({ pendingCards, onUpdate, onRemove, onConfirmAll, onClear }) {
  const total = pendingCards.reduce((n, c) => n + c.quantity, 0);
  return (
    <aside data-help="scan.pending" className="w-[420px] 2xl:w-[480px] flex-shrink-0 flex flex-col border-l border-gold-500/20 bg-rift-800/50">
      <div className="px-5 pt-5 pb-4 border-b border-rift-600/40 space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-lg font-bold text-gold-400">{tx('À ajouter')}</h2>
          <span className="text-sm text-rift-400">{total} {tx('carte')}{total > 1 ? 's' : ''}</span>
          {pendingCards.length > 0 && (
            <button onClick={onClear} className="ml-auto text-sm text-rift-400 hover:text-[#ff8a80] flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> {tx('Vider')}
            </button>
          )}
        </div>
        <button onClick={onConfirmAll} disabled={!pendingCards.length} className="btn-primary w-full h-11 text-[15px]">
          <ChevronsRight className="w-4 h-4" /> {tx('Tout ajouter à la collection')}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {pendingCards.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-sm text-rift-300">{tx('La liste est vide')}</p>
            <p className="text-xs text-rift-500 mt-1">{tx('Les cartes reconnues sur vos photos ou à la webcam arrivent ici. Vous pouvez y changer la langue, l’état, le foil ou la quantité avant de les ajouter.')}</p>
          </div>
        ) : pendingCards.map((card, index) => (
          <PendingRow key={`${card.cardData.id}-${card.language}-${card.scanTimestamp}`} card={card} index={index} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
      </div>
    </aside>
  );
}

// ─── Photos: several at once ───────────────────────────────────────────────
function PhotosMode({ language, onAddCards, showNotification, detectorReady }) {
  const [queue, setQueue] = useState([]); // { id, name, url, status, image, original, detections, checked, selected }
  const [currentId, setCurrentId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [batch, setBatch] = useState(null); // { done, total } while « Tout analyser et ajouter » runs
  const inputRef = useRef(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const patch = useCallback((id, p) => setQueue(q => q.map(it => (it.id === id ? { ...it, ...(typeof p === 'function' ? p(it) : p) } : it))), []);

  const analyze = useCallback(async (item) => {
    patch(item.id, { status: 'analyzing' });
    try {
      const { image, original } = item.image ? item : await loadImageFile(item.file);
      const detections = await detectCards(image, original);
      const result = { status: detections.length ? 'done' : 'empty', image, original, detections, // Doubtful matches are not pre-checked: the user confirms them.
      checked: new Set(detections.map((d, i) => (isAcceptedDetection(d) ? i : -1)).filter(i => i >= 0)), selected: detections.length ? 0 : null };
      patch(item.id, result);
      return { ...item, ...result };
    } catch (err) {
      console.error('[ScanPage] analyse failed:', err);
      patch(item.id, { status: 'error' });
      return null;
    }
  }, [patch]);

  const addFiles = (files) => {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const items = imgs.map(file => ({ id: nextId++, file, name: file.name, url: URL.createObjectURL(file), status: 'waiting' }));
    setQueue(q => [...q, ...items]);
    if (!currentId) setCurrentId(items[0].id);
  };

  const current = queue.find(it => it.id === currentId) || null;
  // Analyse the photo being looked at
  useEffect(() => {
    if (current && current.status === 'waiting' && detectorReady) analyze(current);
  }, [current?.id, current?.status, detectorReady, analyze]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardsOf = (it, onlyChecked = true) => (it.detections || [])
    .filter((_, i) => !onlyChecked || it.checked?.has(i))
    .map(resolveMatchCardData).filter(Boolean);
  // The AI learns the cards it got wrong / was unsure about, once added.
  const learnOf = (it) => learnFromDetections((it.detections || []).filter((_, i) => it.checked?.has(i)));

  const goNext = () => {
    const i = queue.findIndex(it => it.id === currentId);
    const next = queue.slice(i + 1).find(it => it.status !== 'added') || queue.find(it => it.status !== 'added' && it.id !== currentId);
    setCurrentId(next ? next.id : currentId);
  };

  const addCurrent = () => {
    const cards = cardsOf(current);
    if (!cards.length) return;
    onAddCards(cards);
    learnOf(current);
    patch(current.id, { status: 'added' });
    goNext();
  };

  const addAll = async () => {
    const todo = queueRef.current.filter(it => it.status !== 'added');
    setBatch({ done: 0, total: todo.length });
    let added = 0;
    for (let k = 0; k < todo.length; k++) {
      let it = queueRef.current.find(x => x.id === todo[k].id);
      if (!it) continue;
      if (!it.detections) it = await analyze(it);
      const cards = it ? cardsOf(it) : [];
      if (cards.length) { onAddCards(cards); learnOf(it); patch(it.id, { status: 'added' }); added += cards.length; }
      setBatch({ done: k + 1, total: todo.length });
    }
    setBatch(null);
    showNotification(tx('{added} carte{v1} ajoutée{v2} à la liste', { added, v1: added > 1 ? 's' : '', v2: added > 1 ? 's' : '' }), 'success');
  };

  const removeItem = (id) => {
    setQueue(q => q.filter(it => it.id !== id));
    if (id === currentId) setCurrentId(queue.find(it => it.id !== id)?.id || null);
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); };
  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
      onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
  );

  if (!queue.length) {
    return (
      <div className="flex-1 p-8 flex">
        <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          className={`flex-1 flex flex-col items-center justify-center gap-5 border-2 border-dashed transition-colors ${dragOver ? 'border-gold-400 bg-gold-500/10' : 'border-rift-600 bg-rift-800/30'}`}>
          <span className="hexagon w-24 h-24 bg-rift-800 flex items-center justify-center"><ImagePlus className="w-11 h-11 text-gold-400" /></span>
          <div className="text-center">
            <p className="font-display text-2xl font-bold text-gold-400">{tx('Glissez vos photos ici')}</p>
            <p className="text-rift-300 mt-2">{tx('Une ou plusieurs photos, avec une ou plusieurs cartes sur chacune.')}</p>
          </div>
          <button onClick={() => inputRef.current?.click()} className="btn-primary h-12 px-8 text-base"><ImagePlus className="w-5 h-5" /> {tx('Choisir des photos')}</button>
          {fileInput}
        </div>
      </div>
    );
  }

  const toAdd = queue.filter(it => it.status !== 'added').length;
  return (
    <div className="flex-1 min-h-0 flex flex-col" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      {/* Photo strip */}
      <div className={`flex-shrink-0 px-6 py-3 border-b border-rift-600/40 flex items-center gap-3 ${dragOver ? 'bg-gold-500/10' : ''}`}>
        <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto pb-1">
          {queue.map(it => (
            <button key={it.id} onClick={() => setCurrentId(it.id)} title={it.name}
              className={`relative flex-shrink-0 w-[72px] h-[72px] border-2 overflow-hidden ${it.id === currentId ? 'border-gold-400' : 'border-rift-600 hover:border-rift-400'}`}>
              <img src={it.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 h-5 flex items-center justify-center text-[11px] font-bold bg-rift-900/85">
                {it.status === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin text-gold-400" />}
                {it.status === 'waiting' && <span className="text-rift-400">{tx('à analyser')}</span>}
                {it.status === 'done' && <span className="text-gold-400">{it.detections.length} {tx('carte')}{it.detections.length > 1 ? 's' : ''}</span>}
                {it.status === 'added' && <span className="text-[#7fd6a4] flex items-center gap-0.5"><Check className="w-3 h-3" /> {tx('ajoutée')}</span>}
                {(it.status === 'empty' || it.status === 'error') && <span className="text-[#ff8a80]">{tx('rien trouvé')}</span>}
              </span>
            </button>
          ))}
          <button onClick={() => inputRef.current?.click()} title={tx('Ajouter des photos')}
            className="flex-shrink-0 w-[72px] h-[72px] border-2 border-dashed border-rift-600 text-rift-400 hover:text-gold-400 hover:border-gold-500/60 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </button>
          {fileInput}
        </div>
        <button onClick={addAll} disabled={!!batch || !toAdd || !detectorReady} className="btn-secondary h-11 px-5 text-sm flex-shrink-0"
          title={tx('Analyse chaque photo et ajoute toutes les cartes reconnues à la liste')}>
          {batch ? <><Loader2 className="w-4 h-4 animate-spin" /> {batch.done} / {batch.total}</> : <><ChevronsRight className="w-4 h-4" /> {tx('Tout analyser et ajouter (')}{toAdd})</>}
        </button>
      </div>

      {/* Current photo: the picture with the cards found, and the list of matches */}
      {current && (
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-sm text-rift-300 truncate flex-1">{current.name}</p>
              {current.image && (
                <button onClick={() => analyze({ ...current, detections: undefined })} className="btn-ghost h-9 px-3 text-sm"><RotateCcw className="w-4 h-4" /> {tx('Relancer')}</button>
              )}
              <button onClick={() => removeItem(current.id)} className="btn-ghost h-9 px-3 text-sm"><X className="w-4 h-4" /> {tx('Retirer la photo')}</button>
            </div>
            {current.image ? (
              // The whole photo fits in the window height
              <div className="mx-auto" style={{ maxWidth: `calc((100vh - 290px) * ${(current.image.naturalWidth || current.image.width) / (current.image.naturalHeight || current.image.height)})` }}>
              <DetectionCanvas image={current.image} detections={current.detections || []} selectedIndex={current.selected}
                onSelectDetection={(i) => patch(current.id, { selected: i })}
                onCornersChange={(i, corners) => {
                  const it = current;
                  rematchCorners(it.detections[i], corners, it.image, it.original)
                    .then(det => patch(it.id, x => {
                      const dets = [...x.detections];
                      dets[i] = det;
                      return { detections: dets };
                    }))
                    .catch(e => console.error(e));
                }} />
              </div>
            ) : (
              <div className="aspect-[4/3] max-h-[70vh] flex items-center justify-center border border-rift-600/50">
                <img src={current.url} alt="" className="max-w-full max-h-full object-contain opacity-60" />
              </div>
            )}
          </div>

          <div className="w-[400px] 2xl:w-[460px] flex-shrink-0 flex flex-col border-l border-rift-600/40">
            <div className="px-5 py-4 border-b border-rift-600/40">
              {current.status === 'analyzing' || current.status === 'waiting' ? (
                <p className="text-sm text-rift-300 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-gold-400" /> {tx('Recherche des cartes…')}</p>
              ) : current.status === 'empty' || current.status === 'error' ? (
                <p className="text-sm text-[#ff8a80] flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5" /> {tx('Aucune carte reconnue. Essayez une photo plus nette, sans reflet, ou cherchez la carte par son nom.')}</p>
              ) : current.status === 'added' ? (
                <p className="text-sm text-[#7fd6a4] flex items-center gap-2"><Check className="w-4 h-4" /> {tx('Cartes de cette photo ajoutées à la liste.')}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-rift-200"><strong className="text-gold-400">{current.detections.length}</strong> {tx('carte')}{current.detections.length > 1 ? 's' : ''} {tx('reconnue')}{current.detections.length > 1 ? 's' : ''} {tx('· décochez celles à ne pas ajouter')}</p>
                  <button onClick={addCurrent} disabled={!current.checked?.size} className="btn-primary w-full h-11 text-[15px]">
                    <Plus className="w-4 h-4" /> {tx('Ajouter')} {current.checked?.size || 0} {tx('carte')}{current.checked?.size > 1 ? 's' : ''}{toAdd > 1 ? tx(' et passer à la suivante') : ''}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {(current.detections || []).map((det, i) => (
                <CardDetailPanel key={i} detection={det} index={i} language={language}
                  onAddToScanner={(cardData) => onAddCards([cardData])}
                  isChecked={!!current.checked?.has(i)}
                  onToggleCheck={() => patch(current.id, it => { const c = new Set(it.checked); if (c.has(i)) c.delete(i); else c.add(i); return { checked: c }; })}
                  onMatchChange={(idx, cardId) => patch(current.id, it => { const d = [...it.detections]; d[idx] = { ...d[idx], activeCardId: cardId }; return { detections: d }; })}
                  color={DETECTION_COLORS[i % DETECTION_COLORS.length]}
                  isSelected={current.selected === i}
                  onSelect={() => patch(current.id, { selected: current.selected === i ? null : i })} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
