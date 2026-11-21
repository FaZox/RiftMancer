import React from 'react';

/** Screen with no content (B.2): 40 px rift-500 icon in a hexagon outlined in gold at 25 %, one sentence, one action. */
export default function EmptyState({ icon: Icon, text, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-10 px-4">
      {Icon && (
        <span className="hexagon w-16 h-16 flex items-center justify-center bg-gold-500/25" aria-hidden="true">
          <span className="hexagon w-[60px] h-[60px] flex items-center justify-center bg-rift-800">
            <Icon size={28} strokeWidth={1.8} className="text-rift-500" />
          </span>
        </span>
      )}
      <p className="text-[15px] text-rift-200 max-w-md">{text}</p>
      {action && <button type="button" className="btn-secondary min-h-[44px]" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
