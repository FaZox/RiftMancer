import React from 'react';
import RescueScreen from './RescueScreen.jsx';
import { tx } from '../../lib/i18n.js';

/**
 * Start-up error (lot 5.2, B.6.10): the rescue screen naming the step that
 * failed, with « Réessayer ». The scanner (detector) is not needed for the
 * rest of the app: « Continuer sans le scanner ».
 */
const STEP = {
  detector: { title: tx('Le scanner n’a pas pu démarrer.'), where: tx('démarrage : détecteur') },
  catalog: { title: tx('Le contenu des cartes n’a pas pu être chargé.'), where: tx('démarrage : catalogue') },
  db: { title: tx('Votre collection n’a pas pu être ouverte.'), where: tx('démarrage : base') },
};

export default function StartupError({ error, onContinue }) {
  const step = STEP[error.stage] || { title: tx('L’appli n’a pas pu démarrer.'), where: tx('démarrage') };
  return (
    <RescueScreen
      title={step.title}
      message={error.stage === 'detector'
        ? tx('Vos cartes ne sont pas perdues. Réessayez ; vous pouvez aussi utiliser l’appli sans le scanner (ajout à la main).')
        : tx('Vos cartes ne sont pas perdues. Réessayez ; si le problème revient, créez un rapport.')}
      error={error.error}
      where={step.where}
      primary={{ label: tx('Réessayer'), onClick: () => location.reload() }}
      extra={error.stage === 'detector' && (
        <button onClick={onContinue} className="btn-secondary w-full text-[14px] py-2.5">{tx('Continuer sans le scanner')}</button>
      )}
    />
  );
}
