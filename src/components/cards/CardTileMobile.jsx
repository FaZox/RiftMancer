import React from 'react';

import { thumbSrc, handleImageError } from '../../lib/nativeAssets.js';

import { tx } from '../../lib/i18n.js';

const SPECIAL = new Set(['showcase', 'epic']);

const num = (c) => String(c.collectorNumber || c.code || '').replace(/\/.*/, '');

/**
 * Vignette de carte téléphone (Salle du trésor, page d'extension « Atlas », Atelier,
 * Chronique) — maquette mobile-reference.html (.ctm / .sockm) : la carte en couleur,
 * badge de quantité hexagonal en haut à droite, ♥ en haut à gauche si souhaitée,
 * et pour une carte manquante une alvéole sombre (numéro + nom au centre) avec un
 * ＋ hexagonal doré au coin. `label` : nom complet + numéro sous la carte.
 * `onOpen(id)` : toucher = zoom ; `onAdd(id)` : le ＋ ouvre le zoom avec le panneau d'ajout.
 */
export default function CardTileMobile({ card, name, owned = 0, wished = false, missing = false, width, label = true, onOpen, onAdd, flash = false, className = '', style }) {
  const holo = SPECIAL.has(card.rarity);
  const landscape = card.type === 'battlefield';
  return (
    <div data-cardid={card.id} className={`ctm sockm ${missing ? 'miss' : ''} ${className}`} style={{ width, ...style }}>
      <div className={`${holo && !missing ? 'rf-holo rf-holo-on' : ''} relative ${flash ? 'rf-flashcard' : ''}`}>
        <button type="button" onClick={() => onOpen?.(card.id)} aria-label={name} title={name} className="block w-full text-left">
          <span className="mcard block w-full" style={landscape ? { aspectRatio: '7 / 5' } : undefined}>
            <img src={thumbSrc(card.id)} alt="" loading="lazy" onError={(e) => handleImageError(e, card.id)} draggable={false}
              style={landscape ? { objectFit: 'cover' } : undefined} />
            {missing && (
              <span className="gn" aria-hidden="true"><b>{num(card)}</b><small>{name}</small></span>
            )}
          </span>
        </button>
        {owned > 0 && <span className="mq" aria-label={tx('{n} exemplaire(s)', { n: owned })}>{owned}</span>}
        {wished && <span className="wm" aria-label={tx('Dans les souhaits')}>♥</span>}
        {missing && onAdd && (
          <button type="button" className="addm" onClick={(e) => { e.stopPropagation(); onAdd(card.id); }}
            aria-label={tx('Ajouter à ma collection')} title={tx('Ajouter à ma collection')}>＋</button>
        )}
      </div>
      {label && (missing ? (
        <div className="lb"><b>{name}</b><span>#{num(card)}</span></div>
      ) : (
        <p className="nm" title={name}>{name} <small>#{num(card)}</small></p>
      ))}
    </div>
  );
}
