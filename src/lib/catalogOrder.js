/** Order of the catalog (pure: no catalog loaded): sets in release order, then numbers. */

// Display order of sets (release order); unknown sets go last, alphabetically.
const SET_ORDER = ['OGN', 'OGS', 'SFD', 'UNL', 'VEN', 'RAD'];

export function setRank(set) {
  const i = SET_ORDER.indexOf(set);
  return i === -1 ? SET_ORDER.length : i;
}

/** Natural order inside a set: base cards by number, then variants. */
export function compareCollector(a, b) {
  // Handle undefined/null cards (fallback to empty strings)
  const aSet = (a?.set) || '';
  const bSet = (b?.set) || '';
  const aNum = (a?.collectorNumber) || '';
  const bNum = (b?.collectorNumber) || '';
  
  const rankDiff = setRank(aSet) - setRank(bSet);
  if (rankDiff !== 0) return rankDiff;
  
  const setDiff = aSet.localeCompare(bSet);
  if (setDiff !== 0) return setDiff;
  
  return aNum.localeCompare(bNum, 'fr', { numeric: true });
}
