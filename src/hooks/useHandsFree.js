import { useCallback, useEffect, useRef, useState } from 'react';
import { frameSignature } from '../lib/cornerCache.js';
import { createHandsFree, HF } from '../lib/handsFree.js';

/**
 * « Mains libres » (lot 8.1): watches the video and calls onFire() when a new
 * card is put down and still. onFire returns a promise (the scan); the
 * picture is then marked as seen, whatever the result.
 * → { enabled, toggle, setEnabled, state: 'waiting' | 'moving' | 'settling' | 'scanning', progress }
 */
export function useHandsFree({ videoRef, cameraActive, onFire }) {
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState({ state: 'waiting', progress: 0 });
  const watcher = useRef(createHandsFree());
  const busy = useRef(false);
  const fireRef = useRef(onFire);
  useEffect(() => { fireRef.current = onFire; }, [onFire]);

  useEffect(() => {
    if (!enabled || !cameraActive) return undefined;
    watcher.current.reset();
    const id = setInterval(async () => {
      const video = videoRef.current;
      if (busy.current || !video || !video.videoWidth) return;
      let sig;
      try { sig = frameSignature(video); } catch { return; }
      const r = watcher.current.step(sig);
      setView(v => (v.state === r.state && v.progress === r.progress ? v : { state: r.state, progress: r.progress }));
      if (r.state !== 'fire') return;
      busy.current = true;
      setView({ state: 'scanning', progress: 1 });
      try { await fireRef.current?.(); } finally {
        // the picture after the scan: the card as it lies now
        try { watcher.current.scanned(frameSignature(video)); } catch { watcher.current.scanned(sig); }
        busy.current = false;
        setView({ state: 'waiting', progress: 0 });
      }
    }, HF.interval);
    return () => clearInterval(id);
  }, [enabled, cameraActive, videoRef]);

  // Camera stopped: hands-free off
  useEffect(() => { if (!cameraActive && enabled) setEnabled(false); }, [cameraActive, enabled]);

  const toggle = useCallback(() => setEnabled(e => !e), []);
  return { enabled, toggle, setEnabled, ...view };
}
