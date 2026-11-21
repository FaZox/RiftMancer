/**
 * Bench speed options for ONNX Runtime (every session the bench opens,
 * YOLO and the recognition model alike):
 *   --ep dml       DirectML (graphics card), for EXPLORATORY runs only: the
 *                  phone computes on the CPU, final measurements stay on CPU
 *   --cores N      cores per session, to run several benches side by side
 *                  (e.g. 4 benches × 8 threads on 32)
 */
let done = false;
export function tuneOrt(ort, argv = process.argv) {
  if (done) return;
  done = true;
  const get = (k) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : null);
  const ep = get('ep');
  const threads = Number(get('cores')) || 0;
  if (!ep && !threads) return;
  const create = ort.InferenceSession.create.bind(ort.InferenceSession);
  ort.InferenceSession.create = (model, opts = {}) => create(model, {
    ...opts,
    ...(ep ? { executionProviders: [ep, 'cpu'] } : {}),
    ...(threads && !opts.intraOpNumThreads ? { intraOpNumThreads: threads, interOpNumThreads: 1 } : {}),
  });
  console.log(`ONNX Runtime : ${ep && ep !== 'cpu' ? `${ep} (essai exploratoire, pas une mesure finale)` : 'CPU'}${threads ? `, ${threads} cœurs par session` : ''}`);
}
