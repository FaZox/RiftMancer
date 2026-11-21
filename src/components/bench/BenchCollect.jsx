import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Upload, FolderOpen, Loader2, RotateCcw, LayoutGrid, CheckCircle2, Aperture } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera.js';
import { useBackHandler } from '../../lib/backButton.js';
import { isDesktop } from '../../lib/collectionDB.js';
import { loadImageFile } from '../../lib/photoScan.js';
import { analyzePicture, decideCard, jpegFromCanvas, jpegFromFile, saveCollected } from '../../lib/bench/benchScan.js';
import { listItems, onBenchChange } from '../../lib/bench/benchStore.js';
import CardLabeler from './CardLabeler.jsx';
import CardChooser from './CardChooser.jsx';
import GridLabeler from './GridLabeler.jsx';
import MyCollection from './MyCollection.jsx';
import { tx } from '../../lib/i18n.js';

const TABS = [['carte', tx('Carte seule')], ['grille', tx('Grille')], ['collecte', tx('Ma collecte')]];

/**
 * « Collecte banc d'essai » (developer mode, MODULE-BANC.md): photos taken in
 * the app, labelled by the scanner then CONFIRMED card by card by the user,
 * kept in « Ma collecte » and exported in the bench format.
 */
export default function BenchCollect({ onClose }) {
  const [tab, setTab] = useState('carte');
  const [count, setCount] = useState(null);
  useBackHandler(true, onClose);
  useEffect(() => {
    const load = () => listItems().then(l => setCount(l.length)).catch(err => console.error('[bench]', err));
    load();
    return onBenchChange(load);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-rift-900 flex flex-col">
      <header className="flex items-center gap-1 px-2 pt-3 pb-2 border-b border-rift-700/60 flex-shrink-0">
        <button onClick={onClose} aria-label={tx('Retour')} className="w-11 h-11 flex items-center justify-center text-rift-100"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="h-title text-[20px]">{tx('Collecte banc d’essai')}</h1>
      </header>
      <div role="tablist" className="flex border-b border-rift-700/60 flex-shrink-0">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex-1 min-h-[44px] text-sm ${tab === id ? 'text-gold-400 font-semibold border-b-2 border-gold-400' : 'text-rift-300'}`}>
            {label}{id === 'collecte' && count != null ? ` (${count})` : ''}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4">
          {tab === 'collecte' ? <MyCollection /> : <Capture key={tab} kind={tab} />}
        </div>
      </div>
    </div>
  );
}

/** Taking the pictures: one card (photo or camera picture) or a grid (photo). */
function Capture({ kind }) {
  const [source, setSource] = useState(kind === 'grille' ? 'live' : 'photo');
  const [stage, setStage] = useState('idle'); // idle · analyzing · label
  const [current, setCurrent] = useState(null);
  const [asGrid, setAsGrid] = useState(kind === 'grille');
  const [burst, setBurst] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const queue = useRef([]);
  const takeRef = useRef(null);
  const pickRef = useRef(null);
  const dirRef = useRef(null);
  const camera = useCamera();
  const { startCamera, stopCamera } = camera;
  // Live camera: « Image caméra » (single card) or « Appareil photo » (grid,
  // full-resolution photo taken from the stream).
  const cameraOn = (kind === 'carte' && source === 'camera') || (kind === 'grille' && source === 'live');

  useEffect(() => {
    if (!cameraOn) return undefined;
    startCamera();
    return () => stopCamera();
  }, [cameraOn, startCamera, stopCamera]);
  // Back to the viewfinder after each photo: the video (kept mounted) plays again.
  const { videoRef } = camera;
  useEffect(() => {
    if (cameraOn && stage === 'idle') videoRef.current?.play?.().catch(() => {});
  }, [cameraOn, stage, videoRef]);

  // Object URL of the picture shown: freed when it changes.
  useEffect(() => () => { if (current?.picture?.url) URL.revokeObjectURL(current.picture.url); }, [current]);

  const reset = useCallback(() => {
    setCurrent(null);
    setAsGrid(kind === 'grille');
    setStage('idle');
  }, [kind]);

  const analyzeFile = useCallback(async (file) => {
    setStage('analyzing');
    setError('');
    try {
      const { original, image } = await loadImageFile(file);
      const jpeg = await jpegFromFile(file);
      const analysis = await analyzePicture(image, original, 'photo');
      setCurrent({
        picture: { url: original.src, width: original.naturalWidth, height: original.naturalHeight, name: file.name },
        analysis, jpeg, thumbSource: image, source: 'photo',
      });
      setStage('label');
    } catch (err) {
      setError(`${file.name} : ${err.message}`);
      setStage('idle');
    }
  }, []);

  const next = useCallback(() => {
    const f = queue.current.shift();
    if (f) analyzeFile(f);
    else reset();
  }, [analyzeFile, reset]);

  const onFiles = (e) => {
    const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
    e.target.value = '';
    if (!files.length) return;
    queue.current = files.slice(1);
    analyzeFile(files[0]);
  };

  // Grid: full-resolution photo taken from the live camera.
  const takeGridPhoto = async () => {
    setError('');
    let blob;
    try {
      blob = await camera.takePhoto();
    } catch (err) {
      setError(tx('Photo impossible : {message}', { message: err.message }));
      return;
    }
    analyzeFile(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }));
  };

  const captureFrame = async () => {
    const frame = camera.captureFrame();
    if (!frame) { setError(tx('La caméra n’est pas prête.')); return; }
    setStage('analyzing');
    setError('');
    try {
      const jpeg = await jpegFromCanvas(frame);
      const analysis = await analyzePicture(frame, frame, 'camera');
      setCurrent({
        picture: { url: URL.createObjectURL(new Blob([jpeg], { type: 'image/jpeg' })), width: frame.width, height: frame.height },
        analysis, jpeg, thumbSource: frame, source: 'camera',
      });
      setStage('label');
    } catch (err) {
      setError(err.message);
      setStage('idle');
    }
  };

  const afterSave = (item) => {
    setSaved(item);
    setSaving(false);
    if (queue.current.length) next();
    else if (burst || current?.source === 'camera') reset();
    else setStage('done');
  };

  const saveSingle = async (det, choice) => {
    setSaving(true);
    setError('');
    try {
      const item = await saveCollected({
        type: 'carte', source: current.source, info: current.analysis.info, cards: [decideCard(det, choice)],
        jpeg: current.jpeg, thumbSource: current.thumbSource, width: current.picture.width, height: current.picture.height,
      });
      afterSave(item);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const dets = current?.analysis.detections || [];

  return (
    <div className="space-y-4">
      {cameraOn && (
        <div className={`relative bg-black border border-rift-600 aspect-video ${stage === 'idle' ? '' : 'hidden'}`}>
          <video ref={camera.videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          {camera.error && <p className="absolute inset-x-0 bottom-0 p-2 text-xs text-[#ff8a80] bg-rift-900/80">{camera.error}</p>}
        </div>
      )}
      {stage === 'idle' && (
        <>
          {kind === 'grille' && (
            <p className="text-sm text-rift-300">{tx('Plusieurs cartes sur une photo pleine résolution (détection 416 px). Chaque carte sera encadrée et numérotée.')}</p>
          )}
          <div className="flex gap-2" role="radiogroup" aria-label={tx('Source')}>
              {(kind === 'carte'
                ? [['photo', tx('Photo'), tx('Pleine résolution, détection 416 px')], ['camera', tx('Image caméra'), tx('Résolution du scan caméra, détection 320 px')]]
                : [['live', tx('Appareil photo'), tx('Viseur ici, photo pleine résolution')], ['photo', tx('Photo du téléphone'), tx('Appli photo ou galerie')]]
              ).map(([v, l, sub]) => (
                <button key={v} role="radio" aria-checked={source === v} onClick={() => setSource(v)}
                  className={`flex-1 p-2 border text-left ${source === v ? 'border-gold-400 bg-gold-500/10' : 'border-rift-600 bg-rift-800/40'}`}>
                  <span className={`block text-sm font-semibold ${source === v ? 'text-gold-400' : 'text-rift-100'}`}>{l}</span>
                  <span className="block text-[11px] text-rift-400">{sub}</span>
                </button>
              ))}
          </div>

          {cameraOn ? (
            <button onClick={kind === 'grille' ? takeGridPhoto : captureFrame} disabled={!camera.isActive} className="btn-primary w-full min-h-[52px] text-[15px] disabled:opacity-40">
              <Aperture className="w-5 h-5" /> {kind === 'grille' ? tx('Prendre la photo') : tx('Capturer')}
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => takeRef.current?.click()} className="btn-primary min-h-[52px] text-[15px]"><Camera className="w-5 h-5" /> {tx('Prendre une photo')}</button>
              <button onClick={() => pickRef.current?.click()} className="btn-secondary min-h-[52px] text-[15px]"><Upload className="w-5 h-5" /> {tx('Importer')} {kind === 'carte' ? 'des photos' : 'une photo'}</button>
              {isDesktop && kind === 'carte' && (
                <button onClick={() => dirRef.current?.click()} className="btn-secondary min-h-[52px] text-[15px] sm:col-span-2"><FolderOpen className="w-5 h-5" /> {tx('Importer un dossier de photos')}</button>
              )}
              <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
              <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={kind === 'carte'} className="hidden" onChange={onFiles} />
              <input ref={dirRef} type="file" className="hidden" onChange={onFiles} {...{ webkitdirectory: '', directory: '' }} />
            </div>
          )}

          {kind === 'carte' && (
            <label className="flex items-center gap-2 text-sm text-rift-200 cursor-pointer">
              <input type="checkbox" checked={burst} onChange={e => setBurst(e.target.checked)} className="rounded" />
              {tx('Rafale : après chaque confirmation, retour direct à la prise de vue')}
            </label>
          )}
        </>
      )}

      {saved && stage !== 'done' && (
        <p role="status" className="flex items-center gap-2 text-sm text-[#7fd6a4]"><CheckCircle2 className="w-4 h-4" /> {tx('Enregistrée :')} {saved.cards.map(c => c.final).join(', ')} ({saved.cards[0].label}{saved.cards.length > 1 ? '…' : ''})</p>
      )}
      {error && <p role="alert" className="text-sm text-[#ff8a80]">{error}</p>}

      {stage === 'analyzing' && (
        <p className="flex items-center gap-2 text-sm text-rift-300"><Loader2 className="w-4 h-4 animate-spin" /> {tx('Analyse par le scanner…')}</p>
      )}

      {stage === 'done' && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm text-[#7fd6a4]"><CheckCircle2 className="w-4 h-4" /> {tx('Photo enregistrée dans « Ma collecte ».')}</p>
          <button onClick={reset} className="btn-primary w-full min-h-[48px]">{tx('Photo suivante')}</button>
        </div>
      )}

      {stage === 'label' && current && (asGrid ? (
        <GridLabeler picture={current.picture} analysis={current.analysis} source={current.source}
          jpeg={current.jpeg} thumbSource={current.thumbSource}
          onSaved={afterSave} onCancel={queue.current.length ? next : reset} />
      ) : (
        <div className="space-y-3">
          <div className="bg-rift-900 border border-rift-600">
            <img src={current.picture.url} alt={tx('Photo prise')} className="block w-full max-h-[40vh] object-contain" />
          </div>
          {dets.length === 1 && (
            <CardLabeler det={dets[0]} busy={saving} onDecide={(choice) => saveSingle(dets[0], choice)} />
          )}
          {dets.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-[#f0c27a]">{tx('Aucune carte détectée. Indiquez la carte pour garder quand même la photo : elle sert à mesurer le détecteur.')}</p>
              <button onClick={() => setChoosing(true)} disabled={saving} className="btn-primary w-full min-h-[48px]">{tx('Indiquer la carte')}</button>
            </div>
          )}
          {dets.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-[#f0c27a]">{dets.length} {tx('cartes détectées sur cette image.')}</p>
              <button onClick={() => setAsGrid(true)} className="btn-primary w-full min-h-[48px]"><LayoutGrid className="w-4 h-4" /> {tx('L’enregistrer comme grille')}</button>
            </div>
          )}
          <button onClick={queue.current.length ? next : reset} disabled={saving} className="btn-ghost w-full text-sm min-h-[44px] border border-rift-600">
            <RotateCcw className="w-4 h-4" /> {queue.current.length ? tx('Passer cette photo') : tx('Ne pas garder, reprendre')}
          </button>
          {queue.current.length > 0 && <p className="text-xs text-rift-500">{tx('Encore')} {queue.current.length} {tx('photo(s) à étiqueter.')}</p>}
          {choosing && (
            <CardChooser title={tx('Quelle carte est sur la photo ?')} onCancel={() => setChoosing(false)}
              onChoose={(choice) => { setChoosing(false); saveSingle(null, choice); }} />
          )}
        </div>
      ))}
    </div>
  );
}
