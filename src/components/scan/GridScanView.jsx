/**
 * « Grille » mode screen: the camera with a frame on every card found, the
 * hint, the session line and the shutter; once the page is taken, the photo
 * mode's checking screen with « page suivante ». Logic: useGridScan.js.
 */
import React from 'react';
import { Camera, Zap, LayoutGrid, Check } from 'lucide-react';
import PhotoScanView from './PhotoScanView.jsx';
import useGridScan from './useGridScan.js';
import { gridHint, sessionLine } from '../../lib/gridScan.js';
import { useBackHandler } from '../../lib/backButton.js';
import { usePrefs } from '../../lib/uiPrefs.js';
import { tx } from '../../lib/i18n.js';
import { isDesktop } from '../../lib/collectionDB.js';

const COLORS = { settling: '#7fd6a4', fire: '#7fd6a4', aiming: '#e8c973', few: '#f0c27a', seen: '#9aa4b2' };

export default function GridScanView({ camera, photo, header, language, detectorState, showNotification, batchDefaults, org, copies }) {
  const [prefs, setPrefs] = usePrefs();
  // Binder (step 3): « Ranger dans » a box → each card also gets its page and pocket
  const target = batchDefaults?.target || '';
  const box = target.startsWith('box:') ? org?.boxes.byId.get(target.slice(4)) : null;
  const binderOn = !!box && prefs.gridBinder !== false;
  const g = useGridScan({ camera, photo, showNotification, binder: binderOn ? { boxId: box.id, copies } : null });
  useBackHandler(g.phase === 'review', g.retake);
  const { state, count, progress, boxes, W, H } = g.view;
  const color = COLORS[state] || '#e8c973';
  const ready = detectorState === 'ready';

  if (g.phase === 'review') {
    return (
      <PhotoScanView
        photo={photo}
        header={header}
        language={language}
        grid={{ title: sessionLine(g.session), onNext: g.next, onRetake: g.retake, binder: g.binder && { ...g.binder, name: box.name } }}
      />
    );
  }

  return (
    <div key="grid" className="flex-1 min-h-0 flex flex-col">
      {header}
      <div className="flex-1 relative overflow-hidden bg-black">
        <video
          ref={camera.videoRef}
          className={`absolute inset-0 w-full h-full object-contain ${camera.isActive ? '' : 'invisible'}`}
          poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          playsInline
          muted
          autoPlay
        />

        {/* A frame on every card found (same framing as the video: « meet » = object-contain, the whole page in view) */}
        {camera.isActive && W > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {boxes.map((b, i) => (
              <polygon
                key={i}
                points={(b.kp || [[b.cx - b.w / 2, b.cy - b.h / 2], [b.cx + b.w / 2, b.cy - b.h / 2], [b.cx + b.w / 2, b.cy + b.h / 2], [b.cx - b.w / 2, b.cy + b.h / 2]]).map(p => p.join(',')).join(' ')}
                fill={`${color}26`}
                stroke={color}
                strokeWidth={Math.max(2, W / 260)}
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}

        {camera.isActive ? (
          <>
            {/* Hint + stillness gauge */}
            <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none">
              <div className="max-w-full px-3.5 py-2 bg-rift-900/90 border text-[14px] font-bold text-center" style={{ borderColor: `${color}99`, color }}>
                {ready ? gridHint(state, count) : tx('Chargement de l’IA…')}
                <div className="mt-1.5 h-1 bg-rift-700 overflow-hidden" aria-hidden="true">
                  <div className="h-full transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%`, background: color }} />
                </div>
              </div>
            </div>

            {/* Taking the photo */}
            {g.phase === 'capture' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                <span className="w-12 h-12 border-[3px] border-gold-400 border-t-transparent rounded-full animate-spin" />
                <span className="px-3 py-1 bg-rift-900/90 text-sm font-bold text-gold-400">{tx('Photo de la page…')}</span>
              </div>
            )}

            {/* Session, torch, shutter */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-4 flex items-center gap-3 bg-gradient-to-t from-black/85 to-transparent">
              <div className="flex-1 min-w-0">
                <p className="font-display text-[15px] font-bold text-gold-400 truncate">{sessionLine(g.session)}</p>
                {box && (
                  <label className="flex items-center gap-2 text-[13px] text-rift-100 min-h-[30px] cursor-pointer">
                    <input type="checkbox" checked={binderOn} onChange={e => setPrefs({ gridBinder: e.target.checked })} className="w-4 h-4 accent-[#c8aa6e]" />
                    <span className="truncate">{binderOn ? tx('Classeur « {name} » · page {v1}', { name: box.name, v1: g.binder?.page }) : tx('Noter la page et la case (« {name} »)', { name: box.name })}</span>
                  </label>
                )}
                {g.session.pages > 0 ? (
                  <button onClick={g.finish} className="text-[13px] text-rift-300 underline underline-offset-2 min-h-[32px]">{tx('Terminer la série')}</button>
                ) : !box && (
                  <p className="text-[12px] text-rift-300">{tx('Photo automatique quand les cartes ne bougent plus')}</p>
                )}
              </div>
              {camera.hasTorch && (
                <button onClick={camera.toggleTorch} aria-label={tx('Lampe')} aria-pressed={camera.torchOn}
                  className={`w-11 h-11 flex-shrink-0 flex items-center justify-center border ${camera.torchOn ? 'bg-gold-500/20 border-gold-500/60 text-gold-400' : 'bg-rift-800/80 border-rift-600 text-rift-100'}`}>
                  <Zap className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={g.capture}
                disabled={!ready || g.phase !== 'aim' || count === 0}
                aria-label={tx('Prendre la page maintenant')}
                title={tx('Prendre la page maintenant')}
                className="w-16 h-16 flex-shrink-0 rounded-full border-4 border-gold-400 bg-rift-900/70 flex items-center justify-center text-gold-400 disabled:opacity-40"
              >
                <Check className="w-7 h-7" />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-rift-900">
            <span className="hexagon w-16 h-16 bg-rift-800 flex items-center justify-center"><LayoutGrid className="w-7 h-7 text-gold-400" /></span>
            <h2 className="h-title text-[19px]">{tx('Scanner une page entière')}</h2>
            <p className="text-[14px] text-rift-300 max-w-[340px]">
              {isDesktop
                ? tx('Une page de classeur ou des cartes posées à plat, sans qu’elles se touchent. Placez-les sous la webcam : la photo est prise toute seule quand rien ne bouge, puis vous vérifiez chaque carte.')
                : tx('Une page de classeur ou des cartes posées à plat, sans qu’elles se touchent. Tenez le téléphone au-dessus : la photo est prise toute seule quand rien ne bouge, puis vous vérifiez chaque carte.')}
            </p>
            {sessionLine(g.session) !== 'Page 1' && <p className="text-[14px] font-bold text-gold-400">{sessionLine(g.session)}</p>}
            <button onClick={camera.startCamera} className="btn-primary px-5 py-3"><Camera className="w-5 h-5" /> {tx('Activer la caméra')}</button>
            {camera.error && <p className="text-[13px] text-[#ff8a80] max-w-[340px]">{camera.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
