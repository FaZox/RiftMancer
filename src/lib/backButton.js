/**
 * Android back button.
 *
 * Every screen layer that can be closed (card zoom, dialogs, pickers, deck
 * editor, a section of « Plus », the camera…) registers a handler with
 * useBackHandler while it is open. The back button runs the most recent one
 * (the layer on top). With nothing open, the app goes back to the Collection
 * tab, and from there it leaves (Android's normal behaviour).
 */
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const stack = [];
let fallback = null; // () => boolean — true if it handled the press

/** While `active`, the back button calls `onBack` (most recently opened layer first). */
export function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return undefined;
    const entry = () => ref.current();
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Last resort when no layer is open (e.g. go to the home tab). */
export function setBackFallback(fn) {
  fallback = fn;
}

let installed = false;
export function installBackButton() {
  if (installed || !Capacitor.isNativePlatform()) return;
  installed = true;
  App.addListener('backButton', () => {
    const top = stack[stack.length - 1];
    if (top) { top(); return; }
    if (fallback && fallback()) return;
    App.exitApp();
  });
}
