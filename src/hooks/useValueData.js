import { useMemo } from 'react';
import { usePrices } from '../lib/prices.js';
import { valueData } from '../lib/valueData.js';

/** Value of the collection (see lib/valueData.js); data is null until prices exist. */
export default function useValueData(scannedCards) {
  const { prices, history } = usePrices();
  const data = useMemo(() => (prices ? valueData(prices, scannedCards) : null), [prices, scannedCards]);
  return { prices, history, data };
}
