import React from 'react';

// Hextech toast: dark panel, coloured mark by type (B.1 state tokens), readable text.
const MARK = { success: 'bg-state-ok', ok: 'bg-state-ok', error: 'bg-state-bad', bad: 'bg-state-bad', warn: 'bg-state-warn', info: 'bg-state-info' };

export default function ToastNotification({ notification }) {
  if (!notification) return null;
  const color = MARK[notification.type] || MARK.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-4 right-4 sm:left-auto sm:max-w-sm z-50 flex items-center gap-2.5 px-3.5 py-2.5 bg-rift-800 border border-gold-500/40 text-[13px] font-semibold text-rift-100 shadow-xl fade-in"
    >
      <span className={`hexagon w-3 h-3 flex-shrink-0 ${color}`} aria-hidden="true" />
      {notification.message}
    </div>
  );
}
