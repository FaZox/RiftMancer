import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X } from 'lucide-react';

import { useBackHandler } from '../../lib/backButton.js';import { tx } from '../../lib/i18n.js';

/**
 * Full-screen camera view that reads a QR code (pairing with the PC).
 * Calls onResult(text) once a code is read.
 */
export default function QrScanner({ onResult, onClose }) {
  useBackHandler(true, onClose);
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth) {
        // Downscale for speed; QR codes on a screen are large enough.
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          stopped = true;
          onResult(code.data);
          return;
        }
      }
      timer = setTimeout(tick, 200);
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
        tick();
      })
      .catch(() => setError(tx('Impossible d’accéder à la caméra.')));

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm font-semibold text-white">{tx('Scannez le QR code affiché sur le PC')}</p>
        <button onClick={onClose} className="p-2 rounded-lg text-white/80 hover:bg-white/10" aria-label={tx('Fermer')}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <div className="absolute w-60 h-60 border-2 border-gold-400 rounded-2xl pointer-events-none" />
        {error && <p className="absolute bottom-8 text-sm text-red-400 bg-black/70 px-3 py-2 rounded-lg">{error}</p>}
      </div>
    </div>
  );
}
