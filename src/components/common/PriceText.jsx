import React from 'react';
import { euro, ESTIMATE_LABEL } from '../../lib/prices.js';

/**
 * A price, with « ≈ » in state.warn when it is estimated (B.6.5 / B.7): from the
 * other finish, from several promos, or from the normal card for a promo.
 * The reason is in the tooltip and read out by screen readers.
 */
export default function PriceText({ value, estimated, className = '' }) {
  if (value == null || !estimated) return <span className={className}>{euro(value)}</span>;
  return (
    <span className={`${className} !text-state-warn`} title={ESTIMATE_LABEL[estimated]}>
      ≈ {euro(value)}<span className="sr-only"> ({ESTIMATE_LABEL[estimated]})</span>
    </span>
  );
}
