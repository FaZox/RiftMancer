/** Order of the catalog (pure: no catalog loaded): sets in release order, then numbers. */

// Display order of sets (release order); unknown sets go last, alphabetically.
const SET_ORDER = ['OGN', 'OGS', 'SFD', 'UNL', 'VEN', 'RAD'];

export function setRank(set) {
  const i = SET_ORDER.indexOf(set);
  return i === -1 ? SET_ORDER.length : i;
}

/** Natural order inside a set: base cards by number, then variants. */
export function compareCollector(a, b) {
  return setRank(a.set) - setRank(b.set)
    || a.set.localeCompare(b.set)
    || (a.collectorNumber || '').localeCompare(b.collectorNumber || '', 'fr', { numeric: true });
}
