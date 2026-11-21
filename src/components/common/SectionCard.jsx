import React from 'react';
import { usePcInterface } from '../../lib/pcInterface.js';

/** Settings block (B.2): .panel, header with an icon in a 32 px .hex-cut-sm, 15 px title, status line on the right. */
export function SectionCard({ icon: Icon, title, status, children, className = '' }) {
  return (
    <section className={`panel p-4 ${className}`}>
      <header className="flex items-center gap-3">
        {Icon && (
          <span className="hex-cut-sm w-8 h-8 flex items-center justify-center bg-rift-700 text-gold-400 flex-shrink-0" aria-hidden="true">
            <Icon size={16} strokeWidth={1.8} />
          </span>
        )}
        <h3 className="flex-1 text-[15px] font-semibold text-rift-100">{title}</h3>
        {status && <div className="text-[13px] text-rift-400">{status}</div>}
      </header>
      {children && <div className="mt-2">{children}</div>}
    </section>
  );
}

/**
 * Settings line (B.2). PC: label and help on the left (220 px), control on the right.
 * Phone: label and help above, control below.
 */
export function Field({ label, help, children }) {
  if (usePcInterface) {
    return (
      <div className="grid grid-cols-[220px_1fr] gap-6 items-start py-4 border-b border-rift-700/60">
        <div>
          <p className="text-[15px] font-semibold text-rift-100">{label}</p>
          {help && <p className="text-sm text-rift-400 mt-1">{help}</p>}
        </div>
        <div>{children}</div>
      </div>
    );
  }
  return (
    <div className="py-3 border-b border-rift-700/60">
      <p className="text-[15px] font-semibold text-rift-100">{label}</p>
      {help && <p className="text-[13px] text-rift-400 mt-0.5">{help}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default SectionCard;
