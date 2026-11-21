/**
 * Screen of the scanner's photo mode (split out of ScanTab.jsx, lot 11.5):
 * the photo with the cards found, their identification, and the bulk actions.
 * State and handlers: usePhotoScan.js.
 */
import React from 'react';
import { Loader2, RotateCcw, ScanLine, Download, Plus, CheckSquare, Square, ChevronsRight, Camera } from 'lucide-react';
import ImageDropZone from '../identify/ImageDropZone.jsx';
import DetectionCanvas, { DETECTION_COLORS } from '../identify/DetectionCanvas.jsx';
import { isAcceptedDetection } from '../../lib/photoScan.js';

// Grid: green = recognised (or chosen by hand), orange = to choose
const GRID_OK = { r: 127, g: 214, b: 164 };
const GRID_ASK = { r: 240, g: 162, b: 80 };
const gridColor = (det) => (det.activeCardId || isAcceptedDetection(det) ? GRID_OK : GRID_ASK);
import CardDetailPanel from '../identify/CardDetailPanel.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * grid (grid mode): { title, onNext, onRetake, binder? } — the page just taken, then the next one.
 * binder: { name, page, setPage, already } — the binder page the cards go to (step 3).
 */
export default function PhotoScanView({ photo, header: scanHeader, language, grid = null }) {
  const {
    uploadedImage,
    fileName,
    detections,
    isProcessing,
    selectedDetection,
    setSelectedDetection,
    checkedIndices,
    mobileDetectionRefs,
    desktopDetectionRefs,
    handleImageSelected,
    runDetection,
    handleReset,
    handleAddToExport,
    toggleCheck,
    toggleSelectAll,
    addCheckedToExport,
    exportCheckedCSV,
    handleMatchChange,
    handleCornersChange,
    matchedCount,
    allChecked,
  } = photo;

  const bulkActionsBar = matchedCount > 0 && (
    <div className="flex items-center gap-2">
      <button onClick={toggleSelectAll} className="btn-ghost text-xs py-1.5 px-2.5 rounded-xl">
        {allChecked ? <CheckSquare className="w-3.5 h-3.5 text-gold-400" /> : <Square className="w-3.5 h-3.5" />}
        {allChecked ? tx('Tout désélectionner') : tx('Tout sélectionner')}
      </button>
      <div className="flex-1" />
      {checkedIndices.size > 0 && (
        <>
          <button onClick={addCheckedToExport} className="btn-primary text-xs py-1.5 px-3 rounded-xl">
            <Plus className="w-3.5 h-3.5" />
            {tx('Ajouter (')}{checkedIndices.size})
          </button>
          <button onClick={exportCheckedCSV} className="btn-secondary text-xs py-1.5 px-3 rounded-xl">
            <Download className="w-3.5 h-3.5" />
            {tx('CSV')}
          </button>
        </>
      )}
    </div>
  );

  const renderDetectionCards = (refsArray) => (
    <div className="space-y-2">
      {detections.map((det, idx) => {
        const color = grid ? gridColor(det) : DETECTION_COLORS[idx % DETECTION_COLORS.length];
        return (
          <div key={idx} ref={el => { if (refsArray) refsArray.current[idx] = el; }}>
            <CardDetailPanel
              detection={det}
              index={idx}
              onAddToScanner={handleAddToExport}
              language={language}
              isChecked={checkedIndices.has(idx)}
              onToggleCheck={() => toggleCheck(idx)}
              onMatchChange={handleMatchChange}
              color={color}
              isSelected={selectedDetection === idx}
              onSelect={() => setSelectedDetection(selectedDetection === idx ? null : idx)}
            />
          </div>
        );
      })}
    </div>
  );

  // --- Mode switcher ---

  const desktopResultsContent = detections.length > 0 ? (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-rift-100">{tx('Résultats (')}{detections.length})</h2>
        <button onClick={() => runDetection(uploadedImage)} disabled={isProcessing} className="btn-ghost text-xs py-1 px-2 rounded-lg">
          <RotateCcw className="w-3 h-3" />
          {tx('Relancer')}
        </button>
      </div>
      {bulkActionsBar}
      {renderDetectionCards(desktopDetectionRefs)}
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center py-12">
        <p className="text-sm text-rift-400">{tx('Aucun résultat pour l’instant')}</p>
        <p className="text-xs text-rift-500 mt-1">{tx('Importez une image pour détecter des cartes')}</p>
      </div>
    </div>
  );

  return (
    <div key="upload" className="flex-1 min-h-0 flex flex-col">
    {scanHeader}
    <div className="flex-1 relative overflow-hidden lg:flex lg:flex-row">

      {/* Left column: upload + canvas + mobile results */}
      <div className={`h-full overflow-y-auto pb-4 lg:flex-1 lg:min-w-0 ${!uploadedImage ? 'flex flex-col' : ''}`}>
        <div className={`px-4 pt-4 pb-4 lg:px-8 lg:pt-6 space-y-4 ${!uploadedImage ? 'flex-1 flex flex-col' : ''}`}>
          {/* Upload area or canvas */}
          {!uploadedImage ? (
            <div className="flex-1 flex items-center justify-center lg:items-stretch">
              <ImageDropZone onImageSelected={handleImageSelected} isProcessing={isProcessing} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <ScanLine className="w-4 h-4 text-gold-400 flex-shrink-0" />
                  <span className={grid ? 'text-sm font-bold text-gold-400 truncate' : 'text-xs text-rift-300 truncate'}>{grid ? grid.title : fileName}</span>
                </div>
                {grid ? (
                  <button onClick={grid.onRetake} className="btn-ghost text-xs py-1.5 px-3 rounded-xl flex-shrink-0 border border-rift-600">
                    <Camera className="w-3.5 h-3.5" />
                    {tx('Reprendre la photo')}
                  </button>
                ) : (
                  <button onClick={handleReset} className="btn-ghost text-xs py-1.5 px-3 rounded-xl flex-shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                    {tx('Nouvelle')}
                  </button>
                )}
              </div>

              <DetectionCanvas
                image={uploadedImage}
                detections={detections}
                selectedIndex={selectedDetection}
                onSelectDetection={(idx) => setSelectedDetection(idx)}
                onCornersChange={handleCornersChange}
                colorOf={grid ? gridColor : null}
              />

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
                  <span className="text-sm text-rift-300">{tx('Détection des cartes...')}</span>
                </div>
              )}
            </div>
          )}

          {/* Detection results — mobile only */}
          {detections.length > 0 && (
            <div className="space-y-3 lg:hidden">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-rift-100">{tx('Résultats (')}{detections.length})</h2>
                <button onClick={() => runDetection(uploadedImage)} disabled={isProcessing} className="btn-ghost text-xs py-1 px-2 rounded-lg">
                  <RotateCcw className="w-3 h-3" />
                  {tx('Relancer')}
                </button>
              </div>
              {bulkActionsBar}
              {renderDetectionCards(mobileDetectionRefs)}
            </div>
          )}

          {/* Empty detection state */}
          {uploadedImage && !isProcessing && detections.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-rift-400">{tx('Aucune carte détectée dans cette image')}</p>
              <p className="text-xs text-rift-500 mt-1">{tx('Essayez avec une image plus nette ou un meilleur éclairage')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop results panel */}
      <div className="hidden lg:flex flex-col w-[400px] xl:w-[460px] flex-shrink-0 border-l border-gold-500/20 bg-rift-800/60">
        {desktopResultsContent}
      </div>
    </div>
    {grid?.binder && !isProcessing && (
      <div className="flex-shrink-0 px-4 pt-2 pb-1 bg-rift-800 border-t border-gold-500/40">
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-[13px] text-rift-300">{tx('Classeur «')} {grid.binder.name} {tx('» · page')}</span>
          <button onClick={() => grid.binder.setPage(grid.binder.page - 1)} disabled={grid.binder.page <= 1} aria-label={tx('Numéro de page précédent')} className="w-9 h-9 flex-shrink-0 border border-rift-600 text-rift-100 text-lg leading-none disabled:opacity-40">−</button>
          <span className="w-9 text-center font-display text-[17px] font-bold text-gold-400">{grid.binder.page}</span>
          <button onClick={() => grid.binder.setPage(grid.binder.page + 1)} aria-label={tx('Numéro de page suivant')} className="w-9 h-9 flex-shrink-0 border border-rift-600 text-rift-100 text-lg leading-none">+</button>
        </div>
        {grid.binder.already > 0 && (
          <p className="text-[12px] leading-snug text-[#f0c27a] pt-1">{tx('Déjà')} {grid.binder.already} {tx('carte')}{grid.binder.already > 1 ? 's' : ''} {tx('à la page')} {grid.binder.page} {tx(': changez le numéro si c’est une autre page.')}</p>
        )}
      </div>
    )}
    {grid && !isProcessing && (
      <div className={`flex-shrink-0 px-4 py-3 flex items-center gap-3 bg-rift-800 ${grid.binder ? '' : 'border-t border-gold-500/40'}`}>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-rift-100">
            {detections.length ? tx('{size} / {length} cochée{v2}', { size: checkedIndices.size, length: detections.length, v2: checkedIndices.size > 1 ? 's' : '' }) : tx('Aucune carte reconnue')}
          </p>
          <p className="text-[12px] text-rift-400 leading-snug">
            {detections.some(d => gridColor(d) === GRID_ASK) ? tx('Orange : touchez la carte pour choisir') : detections.length ? tx('Vérifiez, puis ajoutez') : tx('Reprenez la photo, plus près ou mieux éclairée')}
          </p>
        </div>
        <button onClick={grid.onNext} className="btn-primary text-sm py-2.5 px-4 flex-shrink-0">
          <ChevronsRight className="w-4 h-4" />
          {checkedIndices.size ? tx('Ajouter {size} · page suivante', { size: checkedIndices.size }) : tx('Page suivante')}
        </button>
      </div>
    )}
    </div>
  );
}
