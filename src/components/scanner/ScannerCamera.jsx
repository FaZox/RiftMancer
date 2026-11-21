import React, { useEffect, useState } from 'react';
import { Camera, AlertCircle, ScanLine, Upload } from 'lucide-react';
import { tx } from '../../lib/i18n.js';

export default function ScannerCamera({
  onUseUpload,
  videoRef,
  isActive,
  error,
  isProcessing,
  lastDetection,
  onStartCamera,
  onStopCamera,
  onToggleFacing,
  onSnapScan,
  detectorState,
  hasTorch,
  torchOn,
  onToggleTorch,
  autoScanEnabled,
  onToggleAutoScan,
  handsFree = null, // { enabled, state, progress } (lot 8.1)
  scanPhase = 'idle', // 'idle' | 'scanning' | 'success' | 'fail' | 'duplicate'
  children, // result card, drawn above the frame
  scanAt, // time of the last result (replays the flash)
}) {
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const updateDimensions = () => {
      setDimensions({ w: video.clientWidth, h: video.clientHeight });
    };

    video.addEventListener('loadedmetadata', updateDimensions);
    video.addEventListener('resize', updateDimensions);
    window.addEventListener('resize', updateDimensions);
    // Layout changes too (e.g. the bottom bar hides while scanning).
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateDimensions) : null;
    ro?.observe(video);

    return () => {
      ro?.disconnect();
      video.removeEventListener('loadedmetadata', updateDimensions);
      video.removeEventListener('resize', updateDimensions);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [videoRef]);

  const cardAspect = 63 / 88;
  // Guide just above the shutter button; the space above it is kept for the result card.
  const usable = Math.max(0, dimensions.h - 180); // shutter + list bar below
  const guideH = Math.max(120, Math.min(usable - 190, (dimensions.w * 0.66) / cardAspect));
  const guideW = guideH * cardAspect;
  const guideX = (dimensions.w - guideW) / 2;
  const guideY = Math.max(12, usable - guideH);

  const isReady = detectorState === 'ready';
  const scanning = scanPhase === 'scanning' || isProcessing;
  // The result colour (green / red / amber) only flashes for a moment.
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (scanPhase === 'idle' || scanPhase === 'scanning') { setFlash(null); return undefined; }
    setFlash(scanPhase);
    const t = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(t);
  }, [scanPhase, scanAt]);
  // Frame colour: gold while analysing, green = recognised, red = not, amber = same card again.
  const PHASE_COLOR = { success: '#7fd6a4', fail: '#ff8a80', duplicate: '#f0c27a' };
  const phaseColor = scanning ? '#e8c973' : PHASE_COLOR[flash] || null;
  const hasDetection = !scanning && !!PHASE_COLOR[flash];

  return (
    <div className="absolute inset-0 bg-black">
      {/* Video feed */}
      {/* Hidden while the camera is off: Android WebView draws a grey
          "play" placeholder on an empty <video>. The 1×1 transparent poster
          removes it too. */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${isActive ? '' : 'invisible'}`}
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        playsInline
        muted
        autoPlay
      />

      {/* Tap to scan */}
      {isActive && (
        <div className="absolute inset-0" onClick={scanning ? undefined : onSnapScan}>
          {/* No veil over the whole picture: only the outside of the frame is dimmed (its shadow) — the card stays bright */}

          {/* Clear guide area */}
          <div
            key={`${scanPhase}-${scanAt}` /* replays the flash animation on each result */}
            className={`absolute transition-colors duration-200 ${phaseColor ? 'border-2' : 'border border-gold-500/25'} ${hasDetection ? 'scan-flash' : ''}`}
            style={{
              left: guideX,
              top: guideY,
              width: guideW,
              height: guideH,
              borderColor: phaseColor || undefined,
              boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.4)${phaseColor ? `, 0 0 24px ${phaseColor}66` : ''}`,
              '--flash': phaseColor || '#e8c973',
            }}
          >
            {/* Analysing: a light sweeps the card + a loader in the middle */}
            {scanning && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="scan-line absolute left-0 right-0 h-[3px] bg-gold-400" style={{ boxShadow: '0 0 14px 4px rgba(232,201,115,.65)' }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="hexagon w-16 h-16 bg-rift-900/85 flex items-center justify-center">
                    <span className="w-9 h-9 border-[3px] border-gold-400 border-t-transparent rounded-full animate-spin" />
                  </span>
                  <span className="px-3 py-1 bg-rift-900/85 text-sm font-bold text-gold-400">{tx('Scan en cours…')}</span>
                </div>
              </div>
            )}
            {/* Corner accents */}
            {[
              '-top-2 -left-2 border-t-[3px] border-l-[3px]',
              '-top-2 -right-2 border-t-[3px] border-r-[3px]',
              '-bottom-2 -left-2 border-b-[3px] border-l-[3px]',
              '-bottom-2 -right-2 border-b-[3px] border-r-[3px]',
            ].map((pos, i) => (
              <div
                key={i}
                className={`absolute w-7 h-7 transition-colors duration-200 ${pos} ${phaseColor ? '' : 'border-gold-400'}`}
                style={phaseColor ? { borderColor: phaseColor } : undefined}
              />
            ))}
          </div>

          {/* Phase label under the frame */}
          {hasDetection && !children?.props?.feedback && (
            <div className="absolute left-0 right-0 flex justify-center pointer-events-none z-10" style={{ top: guideY + 12 }}>
              <div className="scan-pop flex items-center gap-2 px-3.5 py-1.5 bg-rift-900/90 border text-[13px] font-bold whitespace-nowrap"
                style={{ borderColor: phaseColor, color: phaseColor }}>
                {scanning
                  ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> {tx('Analyse de la carte…')}</>
                  : scanPhase === 'success' ? tx('Carte reconnue')
                    : scanPhase === 'duplicate' ? tx('Même carte ?')
                      : tx('Non reconnue')}
              </div>
            </div>
          )}

          {/* Result card, on top of the frame */}
          {children && (
            // Centred in the space between the top bar and the frame
            <div className="absolute left-3 right-3 top-0 z-30 flex items-center justify-center pointer-events-none" style={{ height: Math.max(0, guideY - 8) }}>
              <div className="w-full pointer-events-auto" onClick={e => e.stopPropagation()}>{children}</div>
            </div>
          )}

          {/* Shutter: one big button, disabled while the AI is working */}
          {/* Placed right under the frame, so it can never overlap it */}
          <div className="absolute left-0 right-0 flex flex-col items-center gap-1.5 z-10" style={{ top: guideY + guideH + 14 }} onClick={e => e.stopPropagation()}>
            {handsFree?.enabled ? (
              <HandsFreeRing hf={handsFree} scanning={scanning} />
            ) : (<>
            <button
              onClick={onSnapScan}
              disabled={scanning || !isReady}
              aria-label={scanning ? tx('Analyse en cours') : tx('Scanner la carte')}
              className={`hexagon w-[74px] h-[74px] flex items-center justify-center transition-colors ${scanning ? 'bg-rift-700' : 'bg-gold-500 active:bg-gold-600'} disabled:cursor-not-allowed`}
            >
              {scanning
                ? <span className="w-8 h-8 border-[3px] border-gold-400 border-t-transparent rounded-full animate-spin" />
                : <ScanLine className="w-8 h-8 text-rift-900" strokeWidth={2.4} />}
            </button>
            <p className="text-xs font-semibold text-white/80 bg-black/40 px-2 py-0.5">
              {scanning ? tx('Ne bougez pas…') : autoScanEnabled ? tx('Scan auto…') : tx('Appuyez pour scanner')}
            </p>
            </>)}
          </div>
        </div>
      )}

      {/* Inactive state */}
      {!isActive && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-rift-900/95">
          <div className="hexagon w-20 h-20 bg-rift-800 flex items-center justify-center">
            <Camera className="w-9 h-9 text-gold-400" />
          </div>
          <div className="text-center px-8">
            <p className="font-display text-lg font-bold text-gold-400 mb-1">
              {tx('Caméra désactivée')}
            </p>
            <p className="text-sm text-rift-500">
              {onUseUpload ? tx('Activez la caméra, ou importez des photos de vos cartes') : tx('Activez la caméra pour scanner des cartes')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            <button onClick={onStartCamera} className="btn-primary text-base px-7 py-3 min-h-[50px]">
              <Camera className="w-4 h-4" />
              {tx('Activer la caméra')}
            </button>
            {onUseUpload && (
              <button onClick={onUseUpload} className="btn-secondary text-base px-7 py-3 min-h-[50px]">
                <Upload className="w-4 h-4" />
                {tx('Importer des photos')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-rift-900/95 px-8">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-sm text-red-300 text-center font-body">{error}</p>
          <button onClick={onStartCamera} className="btn-secondary text-sm rounded-xl">
            {tx('Réessayer')}
          </button>
        </div>
      )}

    </div>
  );
}

/**
 * Hands-free (B.6.8, tel-08): a golden ring that pulses slowly with
 * « Posez une carte »; when the card is still it fills (≈ 400 ms), then the
 * result shows as usual.
 */
function HandsFreeRing({ hf, scanning }) {
  const filling = hf.state === 'settling' || hf.state === 'scanning' || scanning;
  const pct = scanning || hf.state === 'scanning' ? 100 : Math.round((hf.progress || 0) * 100);
  const ring = `radial-gradient(circle, transparent 31px, #000 32px)`;
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-1.5">
      <div className={`w-[74px] h-[74px] rounded-full ${filling ? '' : 'animate-pulse'}`}
        style={{
          background: `conic-gradient(#e8c973 ${filling ? pct : 25}%, rgba(232,201,115,.28) 0)`,
          WebkitMaskImage: ring, maskImage: ring, animationDuration: '2.4s',
        }} />
      <p className="text-[15px] font-semibold text-white bg-black/40 px-2 py-0.5">
        {scanning || hf.state === 'scanning' ? tx('Analyse…') : filling ? tx('Ne bougez plus…') : tx('Posez une carte')}
      </p>
      {!filling && !scanning && <p className="text-[13px] text-white/80 bg-black/40 px-2 py-0.5">{tx('Elle est scannée dès qu’elle ne bouge plus.')}</p>}
    </div>
  );
}
