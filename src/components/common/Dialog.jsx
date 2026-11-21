import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useBackHandler } from '../../lib/backButton.js';
import { tx } from '../../lib/i18n.js';

/**
 * Themed dialog (AMELIORATIONS-APPLI.md B.2): replaces the system confirm() / alert().
 * Dimmed blurred backdrop, .panel .hex-cut box (360 px on the phone, 480 px on PC),
 * Cinzel title, buttons on the right: secondary then main. A destructive action is
 * never gold: red text on rift-800. Escape and the Android back button close it.
 */
export default function Dialog({ open, title, children, confirmLabel = tx('Valider'), cancelLabel = tx('Annuler'),
  destructive = false, onConfirm, onCancel, hideCancel = false }) {
  const boxRef = useRef(null);
  useBackHandler(open, () => { onCancel?.(); return true; });
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); } };
    window.addEventListener('keydown', onKey);
    // focus the main button so Enter confirms and the keyboard user is inside the dialog
    const t = setTimeout(() => boxRef.current?.querySelector('[data-dialog-main]')?.focus(), 0);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-rift-900/85 backdrop-blur-sm fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby="rb-dialog-title"
        className="panel hex-cut w-full max-w-[360px] sm:max-w-[480px] p-5">
        <h2 id="rb-dialog-title" className="font-display text-[18px] font-bold text-gold-400">{title}</h2>
        {children && <div className="mt-2 text-[14px] text-rift-200 leading-relaxed">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          {!hideCancel && <button type="button" className="btn-ghost min-h-[44px]" onClick={onCancel}>{cancelLabel}</button>}
          <button type="button" data-dialog-main onClick={onConfirm}
            className={destructive
              ? 'flex items-center justify-center gap-2 px-4 min-h-[44px] bg-rift-800 border border-state-bad/60 text-state-bad font-semibold hover:bg-rift-700'
              : 'btn-primary min-h-[44px]'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const DialogContext = createContext(null);

/**
 * One dialog host per interface (phone and PC roots): `ask()` and `inform()` return
 * promises, so the former `if (!confirm(…)) return;` becomes `if (!(await ask({…}))) return;`.
 */
export function DialogProvider({ children }) {
  const [state, setState] = useState(null);
  const close = useCallback((value) => {
    setState((s) => { s?.resolve(value); return null; });
  }, []);
  const ask = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const inform = useCallback((opts) => new Promise((resolve) => setState({ confirmLabel: tx('OK'), ...opts, hideCancel: true, resolve })), []);
  return (
    <DialogContext.Provider value={{ ask, inform }}>
      {children}
      <Dialog open={!!state} title={state?.title} confirmLabel={state?.confirmLabel} cancelLabel={state?.cancelLabel}
        destructive={state?.destructive} hideCancel={state?.hideCancel}
        onConfirm={() => close(true)} onCancel={() => close(false)}>
        {state?.message}
      </Dialog>
    </DialogContext.Provider>
  );
}

/** { ask({ title, message, confirmLabel, destructive }) → Promise<boolean>, inform({ title, message }) → Promise } */
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog() hors de DialogProvider');
  return ctx;
}
