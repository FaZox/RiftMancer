import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { HELP, TOURS, currentHelpPage, helpTargets, markTourSeen, onHelpChange, onHelpRequest, requestHelp, tourSeen } from '../../lib/help.js';
import { tx } from '../../lib/i18n.js';

/**
 * The help layer (src/lib/help.js), mounted once per interface:
 *   - the tour: the first time a page is shown, its buttons one at a time in a
 *     spotlight, with a bubble (« Précédent », « Suivant », « Passer »);
 *   - the help mode (« ? »): a short label under every marked button of the
 *     screen; a label opens its explanation.
 */
const rectOf = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height }; };
const otherModalOpen = () => [...document.querySelectorAll('[aria-modal="true"]')].some(el => !el.closest('[data-help-layer]'));

/** Bubble next to a rectangle: below when there is room, else above; kept on screen. */
function Bubble({ rect, children, width = 320 }) {
  const w = Math.min(width, window.innerWidth - 24);
  const below = rect.top + rect.height + 12 + 180 < window.innerHeight;
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 12));
  const style = below ? { top: rect.top + rect.height + 12, left, width: w } : { bottom: window.innerHeight - rect.top + 12, left, width: w };
  return (
    <div role="dialog" aria-modal="false" className="fixed z-[96] bg-rift-800 border border-gold-500/70 p-3.5 shadow-2xl" style={style}>
      {children}
    </div>
  );
}

export default function HelpLayer() {
  const [tour, setTour] = useState(null); // { page, ids, i }
  const [labels, setLabels] = useState(null); // [{ id, rect }]
  const [open, setOpen] = useState(null); // help mode: id whose text is shown
  const [, tick] = useState(0);
  const timer = useRef(null);

  const close = useCallback(() => { setTour(null); setLabels(null); setOpen(null); }, []);

  const startTour = useCallback((page, { auto = false, tries = 0 } = {}) => {
    clearTimeout(timer.current);
    const ids = (TOURS[page] || []).filter(id => helpTargets([id]).length);
    // wait for the other windows (welcome, what's new…) and for the page to show its buttons
    if (auto && (otherModalOpen() && page !== 'card')) {
      if (tries < 40) timer.current = setTimeout(() => startTour(page, { auto, tries: tries + 1 }), 1500);
      return;
    }
    if (!ids.length) {
      if (auto && tries < 6) timer.current = setTimeout(() => startTour(page, { auto, tries: tries + 1 }), 800);
      return;
    }
    markTourSeen(page);
    setLabels(null); setOpen(null);
    setTour({ page, ids, i: 0 });
  }, []);

  // First visit of a page: its tour
  useEffect(() => {
    const check = () => {
      const page = currentHelpPage();
      setTour(t => (t && t.page !== page ? null : t));
      setLabels(null);
      if (page && TOURS[page] && !tourSeen(page)) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => startTour(page, { auto: true }), 900);
      }
    };
    check();
    const off = onHelpChange(check);
    return () => { off(); clearTimeout(timer.current); };
  }, [startTour]);

  // « ? »: help mode, or the tour
  useEffect(() => onHelpRequest((kind) => {
    if (kind === 'tour') { const page = currentHelpPage(); if (page) startTour(page); return; }
    setTour(null); setOpen(null);
    setLabels(l => (l ? null : helpTargets().map(el => ({ id: el.dataset.help, rect: rectOf(el) }))));
  }), [startTour]);

  // Follow the layout while shown (scroll, resize, the card sheet's animation)
  useEffect(() => {
    if (!tour && !labels) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    const t = setInterval(() => {
      tick(n => n + 1);
      if (labels) setLabels(helpTargets().map(el => ({ id: el.dataset.help, rect: rectOf(el) })));
    }, 400);
    return () => { window.removeEventListener('keydown', onKey, true); clearInterval(t); };
  }, [tour, labels, close]);

  if (tour) {
    const id = tour.ids[tour.i];
    const el = helpTargets([id])[0];
    if (!el) return null;
    const r = rectOf(el);
    const h = HELP[id];
    const last = tour.i === tour.ids.length - 1;
    return (
      <div data-help-layer className="fixed inset-0 z-[95]" onClick={(e) => e.stopPropagation()}>
        <div className="absolute inset-0" />
        <div aria-hidden="true" className="fixed pointer-events-none border-2 border-gold-400 transition-all duration-200"
          style={{ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12, boxShadow: '0 0 0 9999px rgba(3,6,14,.72)' }} />
        <Bubble rect={{ ...r, top: r.top - 6, height: r.height + 12 }}>
          <p className="font-display text-[16px] font-bold text-gold-400">{h.title}</p>
          <p className="text-[14px] text-rift-100 mt-1 leading-relaxed">{h.text}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[12px] text-rift-500 mr-auto">{tour.i + 1} / {tour.ids.length}</span>
            <button onClick={close} className="btn-ghost text-[13px] py-1.5 px-2">{tx('Passer')}</button>
            {tour.i > 0 && <button onClick={() => setTour({ ...tour, i: tour.i - 1 })} className="btn-secondary text-[13px] py-1.5 px-3">{tx('Précédent')}</button>}
            <button onClick={() => (last ? close() : setTour({ ...tour, i: tour.i + 1 }))} className="btn-primary text-[13px] py-1.5 px-3">{last ? tx('Terminer') : tx('Suivant')}</button>
          </div>
        </Bubble>
      </div>
    );
  }

  if (labels) {
    const shown = labels.find(l => l.id === open);
    return (
      <div data-help-layer className="fixed inset-0 z-[95]" onClick={close}>
        <div className="absolute inset-0 bg-[#03060e]/55" />
        <div className="fixed left-1/2 -translate-x-1/2 top-3 z-[96] flex items-center gap-2 px-3 py-2 bg-rift-800 border border-gold-500/60 text-[13px] text-rift-100 max-w-[calc(100vw-24px)]" onClick={(e) => e.stopPropagation()}>
          <HelpCircle className="w-4 h-4 text-gold-400 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{labels.length ? tx('Touchez une étiquette pour en savoir plus.') : tx('Pas d’aide pour cet écran.')}</span>
          {TOURS[currentHelpPage()] && <button onClick={() => requestHelp('tour')} className="btn-ghost text-[13px] py-1 px-2 text-gold-400 whitespace-nowrap">{tx('Visite guidée')}</button>}
          <button onClick={close} aria-label={tx('Fermer l’aide')} className="w-8 h-8 flex items-center justify-center text-rift-300"><X className="w-4 h-4" /></button>
        </div>
        {labels.map(({ id, rect }) => {
          const below = rect.top + rect.height + 30 < window.innerHeight;
          return (
            <React.Fragment key={id}>
              <div aria-hidden="true" className="fixed pointer-events-none border border-dashed border-gold-400"
                style={{ top: rect.top - 3, left: rect.left - 3, width: rect.width + 6, height: rect.height + 6 }} />
              <button onClick={(e) => { e.stopPropagation(); setOpen(open === id ? null : id); }}
                className={`fixed z-[96] px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap border ${open === id ? 'bg-gold-400 text-rift-900 border-gold-400' : 'bg-rift-900 text-gold-400 border-gold-500/70'}`}
                style={{ left: Math.max(6, Math.min(rect.left, window.innerWidth - 160)), ...(below ? { top: rect.top + rect.height + 5 } : { top: rect.top - 26 }) }}>
                {HELP[id].label}
              </button>
            </React.Fragment>
          );
        })}
        {shown && (
          <div onClick={(e) => e.stopPropagation()}>
            <Bubble rect={{ ...shown.rect, height: shown.rect.height + 28 }}>
              <p className="font-display text-[16px] font-bold text-gold-400">{HELP[shown.id].title}</p>
              <p className="text-[14px] text-rift-100 mt-1 leading-relaxed">{HELP[shown.id].text}</p>
            </Bubble>
          </div>
        )}
      </div>
    );
  }
  return null;
}

/** Phone: the small round « ? » above the tab bar. */
export function HelpFab() {
  return (
    <button onClick={() => requestHelp('mode')} aria-label={tx('Aide sur cet écran')}
      className="fixed left-3 z-40 w-9 h-9 rounded-full bg-rift-800/90 border border-gold-500/60 text-gold-400 flex items-center justify-center"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
