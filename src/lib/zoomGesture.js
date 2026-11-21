/**
 * « See this card in big » gesture on a card that does something else when
 * clicked (e.g. add it to a deck):
 *   PC     right click or middle (wheel) click
 *   phone  hold the finger on the card (~½ s)
 * Returns props to spread on the element; `onClick` still runs on a normal
 * click / tap, but not right after a long press.
 */
const HOLD_MS = 500;
// Set when a long press opened the zoom: the click that follows the finger
// lifting is ignored. Kept outside the component, which re-renders meanwhile.
let ignoreClickUntil = 0;

export function zoomGesture(onClick, onZoom) {
  if (!onZoom) return { onClick };
  let timer = null;
  let start = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  return {
    onClick: (e) => {
      if (Date.now() < ignoreClickUntil) { e.preventDefault(); return; }
      onClick?.(e);
    },
    onContextMenu: (e) => { e.preventDefault(); cancel(); if (Date.now() >= ignoreClickUntil) onZoom(); },
    onMouseDown: (e) => { if (e.button === 1) e.preventDefault(); }, // no auto-scroll on wheel click
    onAuxClick: (e) => { if (e.button === 1) { e.preventDefault(); onZoom(); } },
    onTouchStart: (e) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      cancel();
      timer = setTimeout(() => { ignoreClickUntil = Date.now() + 1000; timer = null; navigator.vibrate?.(20); onZoom(); }, HOLD_MS);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel(); // scrolling
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}
