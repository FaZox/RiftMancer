import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import AIStatusBanner from '../scan/AIStatusBanner.jsx';import { tx } from '../../lib/i18n.js';


/**
 * State of the recognition AI on the scanner (PC and Android):
 *   - could not start → red banner, « Réessayer », technical message folded;
 *   - the card recognition AI (DINOv2) could not start → amber banner (colours used).
 * Nothing when everything is normal.
 */
export default function DetectorStatus({ detection, className = '' }) {
  return (
    <>
      <DetectorState detection={detection} className={className} />
      <AIStatusBanner className={className} />
    </>
  );
}

function DetectorState({ detection, className }) {
  const state = detection?.detectorState;
  const info = detection?.detectorInfo || {};
  if (state === 'error') {
    return (
      <div role="alert" className={`flex items-start gap-2 p-3 bg-[#ff8a80]/10 border border-[#ff8a80]/50 text-sm ${className}`}>
        <AlertTriangle className="w-4 h-4 text-[#ff8a80] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-[#ff8a80]">{tx('L’IA de reconnaissance n’a pas pu démarrer')}</p>
          <p className="text-xs text-rift-300">{tx('Le scan est indisponible ; la collection, les decks et le reste de l’app fonctionnent.')}</p>
          {info.error && (
            <details className="text-[11px] text-rift-400">
              <summary className="cursor-pointer">{tx('Détail technique')}</summary>
              <code className="break-all">{info.error}</code>
            </details>
          )}
        </div>
        <button onClick={detection.retryDetector} className="btn-secondary text-xs h-9 px-3 flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> {tx('Réessayer')}
        </button>
      </div>
    );
  }
  return null;
}
