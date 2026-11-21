import { useState, useRef, useCallback, useEffect } from 'react';import { tx } from '../lib/i18n.js';


/**
 * Hook for managing camera access and video streaming
 */
export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  const [capabilities, setCapabilities] = useState(null);
  const [torchOn, setTorchOn] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Get track capabilities
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.();
        setCapabilities(caps || null);
      }

      setTorchOn(false);
      setIsActive(true);
    } catch (err) {
      console.error('[Camera] Error:', err);
      setError(getErrorMessage(err));
      setIsActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setIsActive(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    if (!caps?.torch) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      console.error('[Camera] Torch error:', err);
    }
  }, [torchOn]);

  const toggleFacing = useCallback(() => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
  }, [facingMode]);

  // Restart camera when facing mode changes (only then: the latest state and
  // startCamera are read from refs).
  const restartRef = useRef(null);
  restartRef.current = () => { if (isActive) startCamera(); };
  useEffect(() => {
    restartRef.current();
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  /**
   * Capture current frame as canvas
   */
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !isActive) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas;
  }, [isActive]);

  /**
   * Full-resolution photo from the camera (ImageCapture API, Chrome / Android
   * WebView), not a video frame. Throws where the browser cannot do it.
   * @returns {Promise<Blob>} JPEG
   */
  const takePhoto = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) throw new Error(tx('La caméra n’est pas active.'));
    const IC = globalThis.ImageCapture;
    if (!IC) throw new Error(tx('Photo pleine résolution impossible ici : utilisez « Photo du téléphone ».'));
    const ic = new IC(track);
    let opts;
    try {
      const caps = await ic.getPhotoCapabilities();
      if (caps?.imageWidth?.max) opts = { imageWidth: caps.imageWidth.max };
    } catch (err) {
      console.warn('[Camera] photo capabilities unknown', err);
    }
    return ic.takePhoto(opts);
  }, []);

  const hasTorch = !!(capabilities?.torch);

  return {
    videoRef,
    isActive,
    error,
    facingMode,
    capabilities,
    hasTorch,
    torchOn,
    startCamera,
    stopCamera,
    toggleFacing,
    toggleTorch,
    captureFrame,
    takePhoto,
  };
}

function getErrorMessage(err) {
  if (err.name === 'NotAllowedError') {
    return tx('Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.');
  }
  if (err.name === 'NotFoundError') {
    return tx('Aucune caméra trouvée sur cet appareil.');
  }
  if (err.name === 'NotReadableError') {
    return tx('La caméra est utilisée par une autre application.');
  }
  if (err.name === 'OverconstrainedError') {
    return tx('La caméra ne prend pas en charge la résolution demandée.');
  }
  return tx('Erreur caméra : {message}', { message: err.message });
}
