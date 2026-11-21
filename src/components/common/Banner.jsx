import React from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, X, XCircle } from 'lucide-react';
import { tx } from '../../lib/i18n.js';

const TONES = {
  info: { border: 'border-l-state-info', text: 'text-state-info', Icon: Info },
  ok: { border: 'border-l-state-ok', text: 'text-state-ok', Icon: CheckCircle2 },
  warn: { border: 'border-l-state-warn', text: 'text-state-warn', Icon: RefreshCw },
  bad: { border: 'border-l-state-bad', text: 'text-state-bad', Icon: AlertTriangle },
};
export const BANNER_ICONS = { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle };

/**
 * Persistent message at the top of a screen (B.2): full width, 3 px left mark in the
 * state colour, icon, text, one action on the right, a cross when it can be closed.
 * One banner at a time per screen (B.6.10).
 */
export default function Banner({ tone = 'info', icon, children, action, onClose, className = '' }) {
  const t = TONES[tone] || TONES.info;
  const Icon = icon || t.Icon;
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'}
      className={`flex items-center gap-3 px-3.5 py-2.5 bg-rift-800 border border-rift-700 border-l-[3px] ${t.border} ${className}`}>
      <Icon size={18} strokeWidth={1.8} className={`flex-shrink-0 ${t.text}`} aria-hidden="true" />
      <div className="flex-1 text-[14px] text-rift-100">{children}</div>
      {action && (
        <button type="button" onClick={action.onClick} className="flex-shrink-0 min-h-[36px] px-2 text-[14px] font-semibold text-gold-400 hover:text-gold-300">
          {action.label}
        </button>
      )}
      {onClose && (
        <button type="button" aria-label={tx('Fermer le bandeau')} onClick={onClose} className="flex-shrink-0 btn-ghost min-h-[36px] min-w-[36px] px-1">
          <X size={16} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
