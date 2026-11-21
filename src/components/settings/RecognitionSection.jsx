import React, { useState } from 'react';
import { usePrefs } from '../../lib/uiPrefs.js';
import { useAIStatus, startRecognition, retryRecognition, runSpeedTest } from '../../lib/recognition.js';
import { getMatcher } from '../../lib/cardMatcher.js';
import { tx } from '../../lib/i18n.js';

const STATE_LABEL = {
  off: tx('Désactivée'),
  loading: tx('Chargement du modèle…'),
  ready: tx('Prête'),
  error: tx('Indisponible : empreinte couleurs utilisée'),
};

/** « Tester la vitesse »: detection model measured (see runSpeedTest). */
const DETECTION_CHOICES = [
  ['camera', tx('Caméra (320 px)')],
  ['photo', tx('Photo et grilles (416 px)')],
];

/**
 * Réglages → Scanner → « Moteur de reconnaissance »: AI (DINOv2 + colours,
 * recommended) or colour fingerprint alone; state of the AI; speed test (4.6).
 */
export function RecognitionSection({ bare = false }) {
  const [prefs, setPrefs] = usePrefs();
  const status = useAIStatus();
  const engine = prefs.recognition === 'grid16' ? 'grid16' : 'ai';
  const [test, setTest] = useState(null);
  const [detection, setDetection] = useState('camera');
  const options = [
    ['ai', tx('IA (recommandé)'), tx('Modèle d’image DINOv2 combiné à l’empreinte couleurs : sur de vraies photos, environ 9 cartes sur 10 reconnues sans rien demander (7 sur 10 avec l’empreinte seule), sans plus d’erreurs. Modèle de 46 Mo, inclus dans l’application.')],
    ['grid16', tx('Empreinte couleurs (léger)'), tx('Compare seulement les couleurs de l’illustration : plus rapide sur un vieux téléphone, mais demande plus souvent quelle carte c’est.')],
  ];
  const choose = (v) => {
    setPrefs({ recognition: v });
    // setPrefs is synchronous: startRecognition reads the new choice
    startRecognition();
  };
  const speed = async () => {
    setTest({ running: true, done: 0, total: 20 });
    try {
      const r = await runSpeedTest({ n: 20, detection, onProgress: (done, total) => setTest({ running: true, done, total }) });
      setTest({ result: r });
    } catch (err) {
      setTest({ error: String(err?.message || err) });
    }
  };
  const body = (
    <div className="space-y-2">
      {options.map(([v, l, d]) => (
        <button key={v} onClick={() => choose(v)} aria-pressed={engine === v}
          className={`w-full text-left px-3 py-2 border ${engine === v ? 'bg-gold-500/15 border-gold-500/60' : 'border-rift-600'}`}>
          <span className={`block text-sm ${engine === v ? 'text-gold-400 font-semibold' : 'text-rift-100'}`}>{l}</span>
          <span className="block text-[11px] text-rift-400">{d}</span>
        </button>
      ))}
      {getMatcher().catalogInfo?.ignored && (
        <p className="text-[11px] text-amber-300">
          {tx('Catalogue reçu du PC ignoré (')}{getMatcher().catalogInfo.ignored}{tx(') : catalogue de l’application utilisé. Mettez à jour l’application PC.')}
        </p>
      )}
      {engine === 'ai' && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex-1 ${status.state === 'error' ? 'text-red-400' : 'text-rift-300'}`}>
            {tx('IA :')} {STATE_LABEL[status.state] || status.state}
            {status.state === 'error' && status.error && <span className="block text-[11px] text-rift-400">{status.error}</span>}
          </span>
          {status.state === 'error' && (
            <button onClick={() => retryRecognition()} className="btn-ghost text-xs py-1.5 px-3">{tx('Réessayer')}</button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={speed} disabled={test?.running} className="btn-ghost text-xs py-1.5 px-3">
          {test?.running ? tx('Test… {done}/{total}', { done: test.done, total: test.total }) : tx('Tester la vitesse')}
        </button>
        <span className="flex-1 text-[11px] text-rift-400">{tx('20 cartes du catalogue : détection, puis identification.')}</span>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-rift-400">
        {tx('Détection testée')}
        <select value={detection} onChange={e => setDetection(e.target.value)} disabled={test?.running}
          className="flex-1 bg-rift-900 border border-rift-600 text-rift-100 text-xs px-2 py-1">
          {DETECTION_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {test?.result && (
        <div className="text-xs text-rift-200 p-3 border border-rift-600/50 bg-rift-800/40 space-y-0.5">
          <p>{tx('Moteur :')} <b>{test.result.engine === 'ai' ? tx('IA + couleurs') : tx('Empreinte couleurs')}</b> {tx('· cœurs utilisés :')} {test.result.threads}</p>
          <p className="text-rift-400">{tx('Mémoire partagée :')} {test.result.sharedMemory ? 'oui' : 'non'} {tx('· page isolée :')} {test.result.isolated ? 'oui' : 'non'}</p>
          <p>{tx('Détection (YOLO')} {test.result.yoloModel}) : <b>{test.result.yoloMs} {tx('ms')}</b> {tx('par carte')}</p>
          {test.result.cropMs != null && <p>{tx('Découpe en perspective :')} <b>{test.result.cropMs} {tx('ms')}</b> {tx('par carte')}</p>}
          <p>{tx('Identification :')} <b>{test.result.identifyMs} {tx('ms')}</b> {tx('par carte en moyenne')}</p>
          {test.result.engine === 'ai' && (
            <p>{tx('Quand les couleurs hésitent (')}{test.result.aiUsed}/{test.result.n} {tx('ici) :')} <b>{test.result.withAIMs} {tx('ms')}</b>{tx(', dont modèle IA')} {test.result.aiMs} {tx('ms')}</p>
          )}
          <p>{tx('Total :')} <b>{test.result.totalMs} {tx('ms')}</b> {tx('par carte')}</p>
          {test.result.stableMs != null && (
            <p>{tx('Scan auto, image immobile (coins réutilisés, sans YOLO) :')} <b>{test.result.stableMs} {tx('ms')}</b> {tx('par carte (')}{test.result.stableN}/{test.result.n})</p>
          )}
          <p className="text-rift-400">{tx('Cartes détectées')} {test.result.detected}/{test.result.n} {tx('· reconnues')} {test.result.right}/{test.result.n}</p>
        </div>
      )}
      {test?.error && <p className="text-xs text-red-400">{test.error}</p>}
    </div>
  );
  if (bare) return body;
  return (
    <section className="rounded-2xl bg-rift-800/60 border border-rift-600/20 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-rift-100">{tx('Moteur de reconnaissance')}</h2>
      {body}
    </section>
  );
}

/** « Licences » (Réglages → À propos): the app's licence (MIT of the original project), then the third-party licences — all shipped with the app. */
export function LicencesLink() {
  const [text, setText] = useState(null);
  const toggle = async () => {
    if (text !== null) { setText(null); return; }
    try {
      const read = async (url) => { const r = await fetch(url); return r.ok ? r.text() : null; };
      const [notice, licence, others] = await Promise.all([read('/NOTICE.txt'), read('/LICENSE.txt'), read('/THIRD_PARTY_LICENSES.md')]);
      const own = [notice, licence].filter(Boolean).map(t => t.trim()).join('\n\n────────\n\n');
      setText(own || others
        ? [own && tx('LICENCE DE L’APPLI\n\n{trim}', { trim: own.trim() }), others && others.trim()].filter(Boolean).join('\n\n════════════════════════\n\n')
        : tx('Fichier des licences introuvable.'));
    } catch {
      setText(tx('Fichier des licences introuvable.'));
    }
  };
  return (
    <div className="space-y-2">
      <button onClick={toggle} className="btn-ghost text-xs py-1.5 px-3">{text === null ? tx('Licences') : tx('Masquer les licences')}</button>
      {text !== null && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-[11px] text-rift-300 p-3 border border-rift-600/50 bg-rift-900/60">{text}</pre>
      )}
    </div>
  );
}
