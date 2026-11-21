/**
 * « Grille » mode of the scanner (src/lib/gridScan.js): watches the camera,
 * takes the page as a full-size photo when it stays still, then hands it to
 * the photo mode's checking screen (usePhotoScan / PhotoScanView). After
 * « page suivante », back to the camera for the next page.
 * → { phase: 'aim' | 'capture' | 'review', view, session, capture, next, retake, finish }
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDetector } from '../../lib/yoloDetector.js';
import { frameSignature } from '../../lib/cornerCache.js';
import { createGridWatcher, GRID } from '../../lib/gridScan.js';
import { nextBinderPage, pageCount } from '../../lib/binder.js';
import { playScanSound } from '../../lib/scanSounds.js';
import { tx } from '../../lib/i18n.js';

const EMPTY_VIEW = { state: 'empty', count: 0, progress: 0, boxes: [], W: 0, H: 0 };

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(tx('Photo illisible')));
    img.src = URL.createObjectURL(blob);
  });
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(tx('délai dépassé'))), ms))]);

/**
 * The page as a photo: full size from the camera (ImageCapture, Android /
 * Chrome; no flash, it would glare on the pockets), otherwise the video frame.
 */
async function takePagePhoto(video, torchOn) {
  const track = video?.srcObject?.getVideoTracks?.()[0];
  const IC = globalThis.ImageCapture;
  if (track && IC) {
    try {
      const ic = new IC(track);
      const opts = {};
      try {
        const caps = await ic.getPhotoCapabilities();
        if (caps?.imageWidth?.max) opts.imageWidth = Math.min(caps.imageWidth.max, 4096);
        if (!torchOn && caps?.fillLightMode?.includes?.('off')) opts.fillLightMode = 'off';
      } catch { /* capabilities unknown: defaults */ }
      return await blobToImage(await withTimeout(ic.takePhoto(opts), 5000));
    } catch (err) {
      console.warn('[Grille] full-size photo impossible, the video frame is used:', err);
    }
  }
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  return blobToImage(await new Promise(res => c.toBlob(res, 'image/jpeg', 0.95)));
}

// binder (step 3): { boxId, copies } — the cards go to that box with their page and pocket (boxId null: no binder)
export default function useGridScan({ camera, photo, showNotification, binder = null }) {
  const [phase, setPhase] = useState('aim');
  // Binder page of the photo: the one after the last used, or the one chosen by hand
  const [chosen, setChosen] = useState(null); // { boxId, page }
  const boxId = binder?.boxId || null;
  const page = boxId ? (chosen?.boxId === boxId ? chosen.page : nextBinderPage(binder.copies, boxId)) : null;
  const already = boxId ? pageCount(binder.copies, boxId, page) : 0;
  const setPage = useCallback((p) => setChosen({ boxId, page: Math.max(1, p | 0) }), [boxId]);
  const [view, setView] = useState(EMPTY_VIEW);
  const [session, setSession] = useState({ pages: 0, cards: 0 });
  const watcher = useRef(createGridWatcher());
  const lastSig = useRef(null);
  const busy = useRef(false);
  const cam = useRef(camera);
  cam.current = camera;
  const ph = useRef(photo);
  ph.current = photo;
  const pages = useRef(0);
  pages.current = session.pages;

  const capture = useCallback(async () => {
    const video = cam.current.videoRef.current;
    if (busy.current || !video?.videoWidth) return;
    busy.current = true;
    setPhase('capture');
    try {
      try { lastSig.current = frameSignature(video); } catch { lastSig.current = null; }
      const img = await takePagePhoto(video, cam.current.torchOn);
      playScanSound('success');
      cam.current.stopCamera();
      setView(EMPTY_VIEW);
      setPhase('review');
      await ph.current.analyseImage(img, `Page ${pages.current + 1}`, { grid: true });
    } catch (err) {
      console.error('[Grille] photo failed:', err);
      showNotification?.(tx('La photo de la page a échoué : réessayez'), 'error');
      setPhase('aim');
    } finally {
      busy.current = false;
    }
  }, [showNotification]);

  // Live look: where the cards are and whether they are sharp (detection only)
  useEffect(() => {
    if (phase !== 'aim' || !camera.isActive) return undefined;
    let stop = false;
    (async () => {
      while (!stop) {
        const detector = getDetector();
        const frame = !busy.current && detector.state === 'ready' ? cam.current.captureFrame() : null;
        if (frame?.width) {
          let dets = [];
          try { dets = await detector.detect(frame, { mode: 'camera' }); } catch (err) { console.warn('[Grille] detection:', err); }
          if (stop) break;
          let sig = null;
          try { sig = frameSignature(frame); } catch { /* no signature: page change unknown */ }
          const boxes = dets.map(d => ({ cx: d.box.cx, cy: d.box.cy, w: d.box.w, h: d.box.h, kp: d.keypoints || null }));
          const r = watcher.current.step({ boxes, sig, W: frame.width, H: frame.height });
          setView({ ...r, boxes, W: frame.width, H: frame.height });
          if (r.state === 'fire') { await capture(); break; }
        }
        await new Promise(res => setTimeout(res, GRID.interval));
      }
    })();
    return () => { stop = true; };
  }, [phase, camera.isActive, capture]);

  const backToCamera = useCallback(() => {
    ph.current.handleReset();
    setView(EMPTY_VIEW);
    setPhase('aim');
    cam.current.startCamera();
  }, []);

  /** Adds the checked cards, then the next page (this one is not taken again). */
  const next = useCallback(() => {
    const extraFor = boxId
      ? (det) => ({ binderPage: page, binderSlot: det.slot || null, binderCols: det.cols || null })
      : null;
    const added = ph.current.addCheckedToExport(extraFor) || 0;
    setSession(s => ({ pages: s.pages + 1, cards: s.cards + added }));
    if (boxId) setChosen({ boxId, page: page + 1 });
    watcher.current.captured(lastSig.current);
    backToCamera();
  }, [backToCamera, boxId, page]);

  /** Nothing added: the same page again. */
  const retake = useCallback(() => {
    watcher.current.reset();
    backToCamera();
  }, [backToCamera]);

  const finish = useCallback(() => {
    watcher.current.reset();
    setSession({ pages: 0, cards: 0 });
    setChosen(null);
  }, []);

  return { phase, view, session, capture, next, retake, finish, binder: boxId ? { page, setPage, already } : null };
}
