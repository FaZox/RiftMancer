/**
 * Bridge between the web app (renderer) and the PC app (main process).
 * Exposed as window.riftboundDesktop — its presence is how the web app knows
 * it runs as the PC hub (see src/lib/collectionDB.js).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('riftboundDesktop', {
  /** 'daily' or 'test' (« RiftMancer Test », see electron/main.cjs). */
  variant: ipcRenderer.sendSync('app:variant'),
  /** The language chosen in the app (src/lib/i18n.js), for the dialogs of the PC app. */
  setLang: (lang) => ipcRenderer.send('app:lang', lang),
  db: {
    load: (collection) => ipcRenderer.invoke('db:load', collection),
    put: (collection, records) => ipcRenderer.invoke('db:put', collection, records),
  },
  onDataChanged: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('db:changed', handler);
    return () => ipcRenderer.removeListener('db:changed', handler);
  },
  sync: {
    info: () => ipcRenderer.invoke('sync:info'),
    regenerateToken: () => ipcRenderer.invoke('sync:regenerateToken'),
    setLan: (on) => ipcRenderer.invoke('sync:setLan', on),
    removeDevice: (id) => ipcRenderer.invoke('sync:removeDevice', id),
    openPairing: () => ipcRenderer.invoke('sync:openPairing'),
    log: () => ipcRenderer.invoke('sync:log'),
    offer: (on) => ipcRenderer.invoke('sync:offer', on),
    onDevicesChanged: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('sync:devices', handler);
      return () => ipcRenderer.removeListener('sync:devices', handler);
    },
  },
  prices: {
    get: () => ipcRenderer.invoke('prices:get'),
    refresh: () => ipcRenderer.invoke('prices:refresh'),
    onChanged: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('prices:changed', handler);
      return () => ipcRenderer.removeListener('prices:changed', handler);
    },
  },
  /** Content updated from the PC (lot 4): catalog layers, translations, banned cards. */
  content: {
    status: () => ipcRenderer.invoke('content:status'),
    reset: () => ipcRenderer.invoke('content:reset'),
    restorePrevious: (kind) => ipcRenderer.invoke('content:restorePrevious', kind),
    fetch: (url) => ipcRenderer.invoke('content:fetch', url),
    install: (kind, layer) => ipcRenderer.invoke('content:install', kind, layer),
    fetchImage: (url) => ipcRenderer.invoke('content:fetchImage', url),
    installCards: (layer, files) => ipcRenderer.invoke('content:installCards', layer, files),
    importFolder: () => ipcRenderer.invoke('content:importFolder'),
    weeklyCheck: (kind, urls) => ipcRenderer.invoke('content:weeklyCheck', kind, urls),
    saveValidators: (kind, validators) => ipcRenderer.invoke('content:saveValidators', kind, validators),
    setWeekly: (kind, on) => ipcRenderer.invoke('content:setWeekly', kind, on),
    onChanged: (cb) => {
      const handler = () => cb();
      ipcRenderer.on('content:changed', handler);
      return () => ipcRenderer.removeListener('content:changed', handler);
    },
  },
  /** Réglages → Affichage: text size (window zoom). */
  display: {
    setTextScale: (scale) => ipcRenderer.invoke('display:setTextScale', scale),
  },
  /** Content packs (lot 4.5). */
  pack: {
    export: () => ipcRenderer.invoke('pack:export'),
    open: () => ipcRenderer.invoke('pack:open'),
    install: () => ipcRenderer.invoke('pack:install'),
    cancel: () => ipcRenderer.invoke('pack:cancel'),
  },
  backup: {
    now: () => ipcRenderer.invoke('backup:now'),
    openFolder: () => ipcRenderer.invoke('backup:open'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (name) => ipcRenderer.invoke('backup:restore', name),
    chooseExtra: () => ipcRenderer.invoke('backup:chooseExtra'),
    clearExtra: () => ipcRenderer.invoke('backup:clearExtra'),
  },
});
