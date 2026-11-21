/**
 * One Legend, several cards: the catalog has 145 legend cards for 58 Legends
 * (alternate arts, « star » versions, reprints). Their `name` is the title
 * (« Loose Cannon ») and the English full name is missing on some alternate
 * arts, and the first tag is not always the champion (a Nasus print is
 * tagged « Dog »), so the stable key is the title: 58 titles = 58 Legends.
 */

/** Stable key of a Legend (all its prints share it). */
export function legendKey(cardData) {
  if (!cardData) return null;
  return String(cardData.name || '').trim().toLowerCase();
}

/**
 * Reference card of each Legend among `legendCards` (the base print when
 * there is one): Map(key → cardData).
 */
export function legendReferences(legendCards) {
  const refs = new Map();
  const rank = (c) => (/-star-|a-\d+$|-\d+a-/.test(c.id) ? 1 : 0) + (c.nameEn ? 0 : 0.5);
  for (const c of legendCards) {
    const k = legendKey(c);
    const cur = refs.get(k);
    if (!cur || rank(c) < rank(cur) || (rank(c) === rank(cur) && c.id < cur.id)) refs.set(k, c);
  }
  return refs;
}

/** Id of the reference print of the Legend of card `id` (itself if unknown). */
export function canonicalLegendId(id, getCardData, refs) {
  if (!id) return id;
  const card = getCardData(id);
  return refs.get(legendKey(card))?.id || id;
}
