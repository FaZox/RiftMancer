import React from 'react';import { tx } from '../lib/i18n.js';


/** Shown for an instant while a page's code loads (pages are loaded on demand). */
export default function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center" role="status" aria-label={tx('Chargement')}>
      <span className="w-6 h-6 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
    </div>
  );
}
