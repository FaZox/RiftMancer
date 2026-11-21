import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { applyPrefs } from './lib/uiPrefs.js';
import { markTestBuild } from './lib/variant.js';
import './index.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/source-sans-3/300.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { usePcInterface } from './lib/pcInterface.js';
import { DialogProvider } from './components/common/Dialog.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { installErrorLog } from './lib/errorLog.js';

// ONNX Runtime (the detector's engine) is loaded by yoloDetector.js, which
// picks the build it needs (WebGPU or plain WASM).

// Two interfaces on the same data: the PC one (PC app, or a browser on a
// computer screen) and the Android one (phone, or a narrow browser window).
// Only the interface in use is downloaded / parsed.
const Root = lazy(() => (usePcInterface ? import('./desktop/DesktopApp.jsx') : import('./App.jsx')));
installErrorLog(); // lot 5: the last errors, for the diagnostic report
applyPrefs(); // card animations on / off
markTestBuild(); // « TEST » badge in the test apps

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary where="appli">
      <DialogProvider>
        <Suspense fallback={<div className="h-[100dvh] bg-rift-900" />}>
          <Root />
        </Suspense>
      </DialogProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Offline cache (PWA) — only for the browser version. The Android and PC
// apps already ship their files and must not keep a stale cached copy.
if (!window.riftboundDesktop && !Capacitor.isNativePlatform()) {
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      console.log('App ready (offline)');
    },
    immediate: true
  });
}
