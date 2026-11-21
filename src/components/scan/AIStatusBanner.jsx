import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { useAIStatus, retryRecognition } from '../../lib/recognition.js';
import { shouldShowAIBanner } from './aiBanner.js';import { tx } from '../../lib/i18n.js';


/**
 * No silent fallback: when the AI recognition is chosen but could not start,
 * the scanner says it uses the colour fingerprint, with « Réessayer ».
 */
export default function AIStatusBanner({ className = '' }) {
  const [prefs] = usePrefs();
  const status = useAIStatus();
  if (!shouldShowAIBanner(prefs, status)) return null;
  return (
    <div role="status" className={`flex items-center gap-2 px-3 py-2 text-xs bg-amber-500/15 border border-amber-500/40 text-amber-200 ${className}`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1" title={status.error || ''}>{tx('Reconnaissance IA indisponible, mode léger utilisé.')}</span>
      <button onClick={() => retryRecognition()} className="btn-ghost text-xs py-1 px-2.5">{tx('Réessayer')}</button>
    </div>
  );
}
