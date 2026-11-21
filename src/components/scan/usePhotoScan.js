/**
 * The photo mode of the scanner (split out of ScanTab.jsx, lot 11.5): one or
 * more photos, every card found is cropped from the full-size image and
 * identified; corners can be moved by hand. Called by ScanTab, so a photo
 * stays when switching to the camera and back. Screen: PhotoScanView.jsx.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { getDetector } from '../../lib/yoloDetector.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { downloadCSV, validateForExport } from '../../lib/exporters/index.js';
import { warpQuadToPortrait } from '../../lib/perspectiveCrop.js';
import { identifyCard, resolveMatchCardData, resizeImage, cropRotated, isListedDetection, isAcceptedDetection, learnFromDetections } from '../../lib/photoScan.js';
import { gridSlots } from '../../lib/gridScan.js';
import { tx } from '../../lib/i18n.js';

export default function usePhotoScan({ showNotification, onAddCardToExport, onAddCardsToExport, batchDefaults }) {
  // Upload mode state
  const [uploadedImage, setUploadedImage] = useState(null);
  const [fileName, setFileName] = useState('');
  const [detections, setDetections] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [checkedIndices, setCheckedIndices] = useState(new Set());

  const mobileDetectionRefs = useRef([]);
  const desktopDetectionRefs = useRef([]);
  const originalImageRef = useRef(null);

  // Scroll to selected detection (delayed to allow card expansion first)
  useEffect(() => {
    if (selectedDetection == null) return;
    const timer = setTimeout(() => {
      for (const refs of [desktopDetectionRefs, mobileDetectionRefs]) {
        const el = refs.current[selectedDetection];
        if (el && el.offsetParent !== null) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedDetection]);

  // --- Upload mode handlers ---

  // Grid mode (gridScan.js): cards in reading order (pockets 1…9), accepted ones pre-checked
  const gridRef = useRef(false);

  /** A picture taken by the grid mode: analysed like an imported photo. */
  const analyseImage = useCallback((img, name, { grid = false } = {}) => {
    gridRef.current = grid;
    setFileName(name);
    setDetections([]);
    setSelectedDetection(null);
    setCheckedIndices(new Set());
    originalImageRef.current = img;
    const resized = resizeImage(img);
    const go = (im) => { setUploadedImage(im); return runDetectionRef.current(im); };
    if (resized === img) return go(img);
    return new Promise((resolve) => { resized.onload = () => resolve(go(resized)); });
  }, []);

  const handleImageSelected = useCallback((file) => {
    gridRef.current = false;
    setFileName(file.name);
    setDetections([]);
    setSelectedDetection(null);
    setCheckedIndices(new Set());
    const img = new Image();
    img.onload = () => {
      originalImageRef.current = img;
      const resized = resizeImage(img);
      if (resized === img) {
        setUploadedImage(img);
        runDetectionRef.current(img);
      } else {
        resized.onload = () => {
          setUploadedImage(resized);
          runDetectionRef.current(resized);
        };
      }
    };
    img.src = URL.createObjectURL(file);
  }, []);

  // The memoized file handler calls the latest version (current props / state).
  const runDetectionRef = useRef(null);
  const runDetection = async (imageElement) => {
    setIsProcessing(true);
    setDetections([]);
    setCheckedIndices(new Set());
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      canvas.getContext('2d').drawImage(imageElement, 0, 0);

      const detector = getDetector();
      if (detector.state !== 'ready') {
        showNotification(tx('Détecteur pas prêt'), 'error');
        setIsProcessing(false);
        return;
      }
      const rawDetections = await detector.detectPhoto(canvas);
      if (!rawDetections || rawDetections.length === 0) {
        showNotification(tx('Aucune carte détectée dans l’image'), 'info');
        setIsProcessing(false);
        return;
      }

      // Crop from original full-resolution image for better matching quality
      const originalImage = originalImageRef.current || imageElement;
      const origW = originalImage.naturalWidth || originalImage.width;
      const dispW = imageElement.naturalWidth || imageElement.width;
      const cropScale = origW / dispW;

      const matcher = getMatcher();
      const results = [];
      for (const det of rawDetections) {
        let crop;
        if (det.keypoints?.length === 4) {
          const scaledKps = det.keypoints.map(([x, y]) => [x * cropScale, y * cropScale]);
          crop = warpQuadToPortrait(originalImage, scaledKps);
        } else {
          crop = cropRotated(
            originalImage,
            det.box.cx * cropScale,
            det.box.cy * cropScale,
            det.box.w * cropScale,
            det.box.h * cropScale,
            det.box.angle ?? 0
          );
        }
        let matchResult = null;
        if (matcher.ready) matchResult = await identifyCard(crop, matcher);
        results.push({
          cx: det.box.cx, cy: det.box.cy, w: det.box.w, h: det.box.h,
          corners: det.keypoints || null,
          confidence: det.confidence, cropCanvas: crop, matchResult,
        });
      }

      // Grid: pocket of each card (from all the cards found, so an unknown one keeps its pocket), in that order
      let listed = results;
      if (gridRef.current) {
        const { slots, cols } = gridSlots(results);
        listed = results.map((d, i) => ({ ...d, slot: slots[i], cols })).sort((a, b) => a.slot - b.slot);
      }
      const matched = matcher.ready
        ? listed.filter(isListedDetection)
        : listed;
      if (gridRef.current) {
        setCheckedIndices(new Set(matched.map((d, i) => (isAcceptedDetection(d) ? i : -1)).filter(i => i >= 0)));
      }
      setDetections(matched);
      // Grid: the page stays in view (no card opened) and the bar at the bottom gives the count
      if (matched.length > 0 && !gridRef.current) {
        showNotification(tx('{length} carte{v1} détectée{v2}', { length: matched.length, v1: matched.length !== 1 ? 's' : '', v2: matched.length !== 1 ? 's' : '' }), 'success');
        setSelectedDetection(0);
      }
    } catch (error) {
      console.error('[ScanTab] Detection error:', error);
      showNotification(tx('Erreur pendant la détection'), 'error');
    }
    setIsProcessing(false);
  };
  runDetectionRef.current = runDetection;

  const handleReset = () => {
    setUploadedImage(null);
    setFileName('');
    setDetections([]);
    setSelectedDetection(null);
    setCheckedIndices(new Set());
    originalImageRef.current = null;
  };

  const handleAddToExport = useCallback((cardData) => {
    onAddCardToExport(cardData);
  }, [onAddCardToExport]);

  const toggleCheck = useCallback((idx) => {
    setCheckedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const matchedIndices = detections
      .map((det, i) => (isAcceptedDetection(det) ? i : -1))
      .filter(i => i >= 0);
    if (checkedIndices.size === matchedIndices.length) {
      setCheckedIndices(new Set());
    } else {
      setCheckedIndices(new Set(matchedIndices));
    }
  }, [detections, checkedIndices]);

  // extraFor(det) (optional, grid mode): more fields for that card — its binder page and pocket
  const addCheckedToExport = useCallback((extraFor = null) => {
    const cardDataArray = [];
    const extras = [];
    for (const idx of checkedIndices) {
      const det = detections[idx];
      if (!det?.matchResult?.card) continue;
      const cardData = resolveMatchCardData(det);
      if (cardData) {
        cardDataArray.push(cardData);
        extras.push(typeof extraFor === 'function' ? extraFor(det) : null);
      }
    }
    if (cardDataArray.length > 0) onAddCardsToExport(cardDataArray, extras);
    learnFromDetections([...checkedIndices].map(i => detections[i]));
    setCheckedIndices(new Set());
    return cardDataArray.length;
  }, [checkedIndices, detections, onAddCardsToExport]);

  const exportCheckedCSV = useCallback(() => {
    const exportCards = [];
    for (const idx of checkedIndices) {
      const det = detections[idx];
      if (!det?.matchResult?.card) continue;
      const cardData = resolveMatchCardData(det);
      if (cardData) {
        exportCards.push({
          cardData, quantity: 1,
          condition: batchDefaults.condition,
          language: batchDefaults.language,
          foil: batchDefaults.foil,
        });
      }
    }
    if (exportCards.length === 0) { showNotification(tx('Sélectionnez au moins une carte'), 'error'); return; }
    const { valid, errors } = validateForExport(exportCards);
    if (!valid) { showNotification(tx('Erreur : {v0}', { v0: errors[0] }), 'error'); return; }
    downloadCSV(exportCards);
    showNotification(tx('CSV exporté — {length} carte{v1}', { length: exportCards.length, v1: exportCards.length !== 1 ? 's' : '' }), 'success');
  }, [checkedIndices, detections, batchDefaults, showNotification]);

  const handleMatchChange = useCallback((detectionIndex, cardId) => {
    setDetections(prev => {
      const updated = [...prev];
      updated[detectionIndex] = { ...updated[detectionIndex], activeCardId: cardId };
      return updated;
    });
  }, []);

  // The user dragged the 4 corners of a detection. Re-warp the original
  // full-resolution image through those corners and re-run the matcher with
  // the new crop. Updates the detection in place so the side panel refreshes.
  const handleCornersChange = useCallback(async (detectionIndex, newCorners) => {
    const original = originalImageRef.current || uploadedImage;
    if (!original) return;
    // The canvas reports coords in the resized-image space (uploadedImage),
    // but the warp samples from the original full-res image — scale corners.
    const origW = original.naturalWidth || original.width;
    const dispW = uploadedImage.naturalWidth || uploadedImage.width;
    const scale = origW / dispW;
    const srcCorners = newCorners.map(([x, y]) => [x * scale, y * scale]);
    let crop;
    try {
      crop = warpQuadToPortrait(original, srcCorners);
    } catch (err) {
      console.error('[ScanTab] Perspective warp failed:', err);
      return;
    }
    // The canvas keeps drawing the new shape at once; the match follows.
    setDetections(prev => {
      if (!prev[detectionIndex]) return prev;
      const updated = [...prev];
      updated[detectionIndex] = { ...prev[detectionIndex], corners: newCorners, cropCanvas: crop };
      return updated;
    });
    const matcher = getMatcher();
    const matchResult = matcher.ready ? await identifyCard(crop, matcher) : null;
    setDetections(prev => {
      const det = prev[detectionIndex];
      // Corners moved again meanwhile: that newer crop wins.
      if (!det || det.cropCanvas !== crop) return prev;
      const updated = [...prev];
      updated[detectionIndex] = {
        ...det,
        matchResult,
        // Drop any previously selected manual override — let the new top-1 win.
        activeCardId: undefined,
      };
      return updated;
    });
  }, [uploadedImage]);

  const matchedCount = detections.filter(isListedDetection).length;
  const allChecked = matchedCount > 0 && checkedIndices.size === matchedCount;


  return {
    uploadedImage,
    fileName,
    detections,
    isProcessing,
    selectedDetection,
    setSelectedDetection,
    checkedIndices,
    mobileDetectionRefs,
    desktopDetectionRefs,
    handleImageSelected,
    analyseImage,
    runDetection,
    handleReset,
    handleAddToExport,
    toggleCheck,
    toggleSelectAll,
    addCheckedToExport,
    exportCheckedCSV,
    handleMatchChange,
    handleCornersChange,
    matchedCount,
    allChecked,
  };
}
