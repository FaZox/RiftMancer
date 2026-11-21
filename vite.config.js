import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// One version for the whole app (package.json): PWA manifest, APK, installer.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
    // The only version of the app (lot 2.2): Réglages → À propos, bench metadata.
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    // ONNX Runtime's WASM files are served from /ort/ (scripts/copy-ort.mjs,
    // ort.env.wasm.wasmPaths): drop the duplicate copies Vite emits in assets/.
    {
      name: 'drop-ort-wasm-assets',
      generateBundle(_options, bundle) {
        for (const key of Object.keys(bundle)) {
          if (/ort-wasm[^/]*\.wasm$/.test(key)) delete bundle[key];
        }
      },
    },
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'RiftMancer',
        short_name: 'RiftMancer',
        description: 'Free, offline AI-powered RiftBound TCG card scanner',
        version,
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0e17',
        theme_color: '#c8a84e',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Precache only the app shell, the detector runtime and the thumbnails.
        // Full-size card images, YOLO models and card data are cached on first
        // use (runtime caching) so the first launch doesn't download ~180 MB.
        globPatterns: ['**/*.{js,mjs,css,html,ico,svg,png,woff,woff2,wasm}', 'cards/thumbs/*.webp'],
        // WebGPU build of ONNX Runtime (28 MB): cached on first use only.
        globIgnores: ['**/*.asyncify.*'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/cards/') && !url.pathname.startsWith('/cards/thumbs/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 5000 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'yolo-models', cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.json') && url.pathname.startsWith('/card-'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'card-data', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
