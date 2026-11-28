import { useCallback, useRef } from 'react';
import { motionOk } from '../../lib/motion.js';

/**
 * 3D relief + holo shine that follow the mouse (±max° rotation). Spread the result on the element:
 *   const tilt = useTilt(); <div {...tilt} className="holo">…</div>
 * Sets --rx / --ry / --mx / --my (CSS in index.css: .rf-tilt, .rf-holo). Nothing when animations are off
 * (rf-calm, reduced motion) or while the element is animating (class « anim »).
 */
export default function useTilt(max = 8) {
  const raf = useRef(0);
  const onMouseMove = useCallback((e) => {
    const el = e.currentTarget;
    if (!motionOk() || el.classList.contains('anim')) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-(y - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    });
  }, [max]);
  const onMouseLeave = useCallback((e) => {
    const el = e.currentTarget;
    cancelAnimationFrame(raf.current);
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
  }, []);
  return { onMouseMove, onMouseLeave, 'data-tilt': '' };
}
