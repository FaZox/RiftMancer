# Report — Card recognition with AI models

*Version française : [RAPPORT-MODELES-IA.md](RAPPORT-MODELES-IA.md).*

*Riftbound Scanner (now RiftMancer) — work of 2026-11-11 (steps 1, 2, 2.5, 4 and 4.6 of the model improvement plan).*
*Written to be reviewed by another assistant or a developer: what was done, how it is measured, what we take from it, what remains debatable.*

---

## 1. Summary

- **Starting problem.** Identifying a card, once detected by YOLO, relied on a colour fingerprint: a 16×16 RGB grid of the art after histogram equalisation. On simulated photos, this method accepted 70 % of the cards without asking anything; for the remaining 30 %, the user had to be asked « which card? ».
- **Chosen solution.** A pre-trained image model (**DINOv2-small, int8-quantised, 24 MB, Apache 2.0**) is combined with the colour fingerprint, **as a cascade**:
  - the colours decide alone when they are sure;
  - otherwise, the model computes a single 168×168 px picture, and a combined score (50 % AI, 50 % colours) settles between the 100 best candidates according to the colours.
- **Result (real photos, 65 photos):** cards accepted correctly go from **69.2 % to 84.6 %**, with **0 wrong cards** and 0 card outside the catalog accepted. On 600 simulated photos: 70.3 % → 77.3 %, with 0.2 % wrong.
- **Speed measured by the user:**
  - **PC (4 cores)**: identification 271 → **44 ms**; AI model 260 → **69 ms** when used. Target (< 50 ms) reached.
  - **Android phone (a single core)**: identification 490 → **84 ms**; AI model 1,984 → **388 ms** when used. **YOLO detection stays at about 2.1 s** and is 95 % of a scan’s time.
- **Blocker found.** The user’s Android WebView does not provide `SharedArrayBuffer`: « shared memory: no », « isolated page: no », even with the COOP/COEP headers. ONNX Runtime Web is therefore limited to 1 core on the phone.
- **Recommendation (accepted by the user):** run the models (YOLO, then DINOv2) **natively on Android**, with ONNX Runtime Android through a Capacitor plugin: multi-core, XNNPACK, possibly NNAPI. Expected gain: YOLO at about 150–300 ms, AI at about 50–80 ms.

---

## 2. Technical context

| Element | Before | After |
|---|---|---|
| Detection | YOLO11s-pose ONNX (4 corners), `src/lib/yoloDetector.js` — unchanged | same |
| Straightening | `src/lib/perspectiveCrop.js` | + `warpQuadRGBA` (version without DOM, usable in Node) |
| Identification | `fingerprint.js` (16×16×3 grid) + `matchIndex.js` (centring, margin) | + `aiRecognizer.js` (DINOv2) + cascade in `cardMatcher.js` |
| Catalog | `public/card-hashes.json` (1,408 cards) | + field `e` per card (int8 AI vector) + `embeddings` header |
| Running the models | onnxruntime-web 1.31 (WASM; WebGPU on PC for YOLO) | same; DINOv2 in WASM int8 |
| Platforms | PC (Electron, local server with COOP/COEP) and Android (Capacitor) | same |

**Decision rule (`matchIndex.decide`).** A centred score is computed for each card: vector minus the catalog mean, then normalisation and dot product. The best card is accepted if `score ≥ abs` **and** if its lead over the best card of **another art** reaches `margin` (reprints with the same art share an `artGroup` and do not compete). There were two sets of thresholds:
- « Careful » (default);
- « Fast », adjustable by the user (removed since: everyone is in Careful).

---

## 3. Test bench — methodology

### 3.1 Tools

| Command | Role |
|---|---|
| `npm run eval:matcher -- --compare a@art,b@full,… [--fusion α,…] [--cascade K,…] [--single] --sample 300 --aug 2 --seed 11` | Compares engines (`scripts/lib/engineBench.mjs`) |
| `npm run photos:prepare` | Real photos `model/real-photos-raw/<code>/` → same chain as the app (YOLO + straightening) → `model/real-photos/<id>/*.png` |
| `node scripts/build-embeddings.mjs` | AI signatures of the catalog (also run by `npm run catalog:update`) |
| `model/export_embedders.py` (venv `model/.venv-embed`) | ONNX export from the safetensors weights (MobileNetV4, SigLIP 2) |

### 3.2 Photos

- **Simulated: 600**, i.e. 300 cards drawn at random (seed 11) × 2 draws. Each photo gets a rotation, a slight perspective, an offset crop, light and white balance variation, blur, a sleeve glare, JPEG compression and noise (`scripts/lib/simulate.mjs`). Final size 480×670 (that of the crop in the app).
- **Real: 65**, taken with the phone by the user (31 then 61 different cards) and run through the app’s chain. Manual matches:
  - the runes UNL-R02 and UNL-R05 are missing from the catalog but have the same art as VEN-R02 / VEN-R05: they are counted as such;
  - « PAD-098 » is actually RAD-098;
  - the token SFD-T02 (missing from the catalog) is left out.
- **The two sets are never mixed in one percentage.**

### 3.3 Measures (for each configuration)

- **top-1 / top-5**: the right art is 1st, or among the first 5.
- **accepted right / accepted wrong / rejected** (rejected = the app asks).
- **outside the catalog accepted**: every card of the same art is removed from the catalog (*leave-one-out*), then we check whether the app still accepts another card. This case simulates a new set, a promo or a token.
- **reprint confusions**: same name, different art.
- **ms/card** (Node, CPU) and model size.

### 3.4 Calibration

For each configuration, the thresholds `abs` (−0.2 to 0.98) and `margin` (0 to 0.6) are swept **on the simulated photos**. We keep the pair that maximises the cards accepted right under these constraints:
- **Careful**: ≤ 1 % of cards outside the catalog accepted **and** ≤ 0.5 % wrong;
- **Fast**: ≤ 10 % outside the catalog and ≤ 2 % wrong.

Real photos are evaluated with these thresholds, **without recalibration**.

### 3.5 Fusion and cascade

- **Fusion**: `score = α·AI + (1 − α)·colours`, for each card.
- **Cascade (`--cascade K`)**: colours first, with the colours’ Careful thresholds. If they accept, done. Otherwise:
  - the AI is computed in the orientation that best suits the colours’ 1st card (normal or 180°);
  - it uses the crops present among the K best cards according to the colours (`--single`: only that of the 1st card);
  - the fusion is applied only to these K cards.

---

## 4. Models evaluated (step 2)

Only models under the Apache 2.0 licence were kept. Revisions and SHA-256 are in `model/MODELS.md` and the licences in `THIRD_PARTY_LICENSES.md`. The weights were loaded from safetensors files only.

| Model | Source | Size fp32 / int8 | Notes |
|---|---|---|---|
| DINOv2-small | onnx-community/dinov2-small | 88.5 / 24.4 MB (fp16 44 MB) | official ONNX |
| DINOv2-small + registers | onnx-community/dinov2-with-registers-small | 88.5 / 24.4 MB | |
| MobileNetV4-Conv-Small | timm, own export | 9.9 / 2.6 MB | **int8 unusable**: cosine 0.14 with fp32 in dynamic quantisation |
| SigLIP 2 Base/16 | timm, own export | 372 / 94 MB | int8: cosine 0.92, poor results |

Preprocessing: the whole picture is resized, **without a centre crop** (so as to cut neither the name, nor the costs, nor the Might), then normalised with the model’s mean and standard deviation. The vector is the CLS token, the mean of the patches or the pooled output. Two regions are tested: `art` (the art, cut like the fingerprint) and `full` (the whole card).

### 4.1 Simulated photos (600) — Careful thresholds calibrated per configuration

| Configuration | top-1 | Accepted right | Wrong | Outside cat. | Size |
|---|---|---|---|---|---|
| **grid16 (colours, reference)** | 84.3 % | **70.3 %** | 0.2 % | 0.7 % | 0 |
| dinov2s CLS @art / @full | 77.0 / 73.3 % | 59.0 / 57.2 % | 0 / 0.2 % | ≤ 1 % | 88.5 MB |
| dinov2s-mean @art | 82.0 % | 65.2 % | 0 % | 0.8 % | 88.5 MB |
| dinov2s-int8-mean @art | 79.7 % | 63.7 % | 0 % | 1.0 % | 24.4 MB |
| dinov2s-reg-mean @full | 69.2 % | 51.2 % | 0 % | 0.8 % | 88.5 MB |
| mnv4s @art | 60.3 % | 51.2 % | 0 % | 1.0 % | 9.9 MB |
| siglip2b @full | 92.2 % | 44.5 % | 0.3 % | 1.0 % | 372 MB |
| dinov2s-mean@art + grid16 α 0.5 | 93.2 % | 81.2 % | 0 % | 0.8 % | 88.5 MB |
| **dinov2s-int8-mean@art + grid16 α 0.5** | 91.0 % | **78.8 %** | 0 % | 0.8 % | **24.4 MB** |
| mnv4s@art + grid16 α 0.3 | 86.7 % | 74.3 % | 0 % | 1.0 % | 9.9 MB |
| siglip2b@full + grid16 α 0.3 | 94.5 % | 85.7 % | 0 % | 0.8 % | 372 MB |

**Finding:** no model alone beats the colour fingerprint. Combined with it, they clearly beat it: the two methods go wrong on different photos.

### 4.2 Real photos (65)

| Configuration | top-1 | Accepted right | Wrong | Outside cat. |
|---|---|---|---|---|
| grid16 | 87.7 % | 69.2 % | 0 % | 0 % |
| dinov2s-int8-mean @art | 95.4 % | 67.7 % | 0 % | 0 % |
| mnv4s @art | 64.6 % | 30.8 % | 0 % | 0 % |
| dinov2s-int8-mean@art + grid16 α 0.5 | 98.5 % | 90.8 % | 0 % | 0 % |
| dinov2s-int8-mean@art + grid16 α 0.7 | 100 % | 93.8 % | 0 % | 0 % |
| mnv4s@art + grid16 α 0.3 | 92.3 % | 81.5 % | 0 % | 0 % |
| siglip2b@full + grid16 α 0.3 | 98.5 % | 92.3 % | 0 % | 0 % |

**Note:** on only 32 photos, MobileNetV4 + colours matched DINOv2 (93.8 %). It dropped to 81.5 % at 65 photos. With so few real photos, one photo is worth 1.5 points.

### 4.3 Choice of step 2.5

The choice went to **DINOv2-small int8, mean of the patches, art region, combined with the colours at α = 0.5**. It is the only candidate that meets every constraint:
- ≤ 25 MB added to the APK;
- ≤ 1 % of cards outside the catalog and ≤ 0.5 % wrong;
- more than 10 points of gain (+8.5 points on simulated photos, +21.6 points on real photos).

α = 0.7 does better on real photos (93.8 %) but worse on simulated ones (74.0 %). α = 0.5 is the chosen compromise.

---

## 5. Integration in the app (step 4)

### 5.1 Architecture

- `scripts/build-embeddings.mjs` computes each card’s vector (int8 + scale factor, 388 bytes per card, ≈ 0.7 MB for the catalog) and writes it into `card-hashes.json`. It adds the `embeddings` header:

  ```json
  { "engine": "dinov2s-int8-mean-168", "region": "art", "model": "dinov2s-int8.onnx",
    "modelSha256": "dfce54a8…0d61", "dim": 384, "alpha": 0.5,
    "cascade": { "k": 100, "single": true },
    "decision": { "prudent": { "abs": 0.44, "margin": 0.11 }, "fast": { "abs": 0.34, "margin": 0.06 } } }
  ```

  The signatures reach the phone **with the catalog**, through the same sync and the same SHA-256 check.
- `src/lib/aiRecognizer.js` (pure module, tested in Node):
  - reads and checks the signatures;
  - loads the model and **checks its SHA-256** against the header;
  - builds the AI index aligned with the colour index (learned examples included).
- `src/lib/cardMatcher.js`: `identify()` is **asynchronous**. The AI state is `off`, `loading`, `ready` or `error`. Scans wait for the loading to end.
- **No silent fallback.** If the model or the signatures are missing or do not match, the scanner uses the colours **and shows a banner** « AI recognition unavailable, light mode used », with a « Try again » button.
- Settings → Scanner → « Recognition engine »: AI (default, preferences v3) or Colour fingerprint. It shows the AI’s state and the **« Test the speed »** button (20 catalog cards laid on a grey background).
- **Learning**: each correction also keeps the AI vector (`learned.e[engine:sha]`). An older example without an AI vector uses the card’s catalog vector (neutral).
- A single run of the model at a time (queue): the auto scan does not pile up.
- `THIRD_PARTY_LICENSES.md` is shipped in the app (Settings → About → « Licences »).
- The bench’s `.onnx` binaries (≈ 710 MB) **are not in git**, because of the LFS quota. Only the app’s model (24 MB) is.

### 5.2 Cascade and speed (step 4.6)

**First measures by the user**, with the full fusion (2 orientations × 3 crops = 6 pictures of 224 px): on PC, about 1.6 s of AI model per card in a 1-core browser and 260 ms in the PC app (4 cores); on the phone, 1,984 ms. Far too slow.

Four optimisations followed, each measured on the bench:

1. **Cascade.** The AI is only computed when the colours hesitate (≈ 30 % of photos), with one orientation and only the useful crops.
2. **Colour fingerprint rewritten** (separable area mean, rows then columns). Bit-identical result, checked on three picture sizes. Computing the 12 views: **276 → 55 ms**.
3. **Photo reduced to 480×670** before identification (the bench’s size): 55 → 22 ms.
4. **A single 168 px AI picture** instead of 3 of 224 px.

**Bench results** (α = 0.5, Careful thresholds calibrated for each variant):

| Variant | Simulated: right / wrong / outside cat. | Real: right / wrong / outside cat. | AI work |
|---|---|---|---|
| Full fusion 224 px | 78.8 / 0 / 0.8 % | 90.8 / 0 / 0 % | 6 pictures, always |
| Cascade 30, 224 px | 79.8 / 0.2 / 1.0 % | 87.7 / **1.5** / 1.5 % | 2.4 pictures, 30 % of photos |
| Cascade 100, 224 px | 79.8 / 0.2 / 1.0 % | 87.7 / 0 / 0 % | 2.9 pictures, 30 % |
| Cascade 100, 1 picture, 224 px | 79.8 / 0.2 / 1.0 % | 86.2 / 0 / 0 % | 1 picture, 30 % |
| **Cascade 100, 1 picture, 168 px (app)** | **77.3 / 0.2 / 1.0 %** | **84.6 / 0 / 0 %** | 1 picture of 168 px, 30 % |
| Cascade 100, 1 picture, 140 px | 75.5 / 0.3 / 0.8 % | 84.6 / 0 / 0 % | |
| Cascade 100, 1 picture, 112 px | 75.3 / 0.2 / 1.0 % | 81.5 / 0 / 1.5 % | discarded |

Native time of one DINOv2 int8 picture (onnxruntime-node, PC):

| Size | 1 core | 4 cores |
|---|---|---|
| 224 px | 105 ms | 75 ms |
| 168 px | 57 ms | 44 ms |
| 140 px | 41 ms | 34 ms |
| 112 px | 28 ms | 22 ms |

Fast mode (cascade 100, 168 px): 81.8 % of cards right, 0.5 % wrong and 9.2 % of cards outside the catalog accepted (simulated photos).

### 5.3 Measures on the devices (« Test the speed », 20 cards)

| | PC before | PC after | Phone before | Phone after |
|---|---|---|---|---|
| ONNX Runtime cores | 4 | 4 | 1 | **1** (no `SharedArrayBuffer`) |
| YOLO detection | 67 ms | 82 ms | 2,145 ms | 2,092 ms |
| Identification (mean) | 271 ms | **44 ms** | 490 ms | **84 ms** |
| Identification when the AI is used | 526 ms | 108 ms | 2,471 ms | 455 ms |
| of which AI model | 260 ms | **69 ms** | 1,984 ms | **388 ms** |

*« When the AI is used » is measured by forcing the AI, since catalog cards are sharp and the colours are always sure on this test (0/20).*

**Attempts to get multi-core on Android:**
- COOP/COEP/CORP headers added to the WebView’s responses (`MainActivity.java`, `BridgeWebViewClient`);
- number of threads determined by a direct test of shared memory (`canShareMemory`) instead of `crossOriginIsolated`.

Result on the user’s device: **shared memory not available**. The WebView does not handle COOP isolation, so no `SharedArrayBuffer`, so ONNX Runtime Web stays on 1 thread.

---

## 6. Limits and debatable points

1. **Few real photos (65).** One photo is worth 1.5 points. Differences of less than 3 points between variants are not significant. 300 to 500 real photos in varied conditions would be needed.
2. **Calibration on simulated photos only.** The thresholds are chosen on the simulator, which may underestimate some difficulties (real glare, textured sleeves, foil cards) and overestimate others. On real photos, the colours alone are yet more reliable than expected (top-1 87.7 %).
3. **« Outside the catalog » simulated by *leave-one-out*.** It is a good indicator, but a truly unknown card (new set) may look more like an existing card. The three missing cards met (UNL runes, token SFD-T02) were not tested as a « real outside the catalog » case.
4. **The speed test on catalog cards is optimistic.** The pictures are sharp, the colours always sure, and the AI never triggers naturally. In real use, it will trigger on about 30 % of scans.
5. **Penalty of learned examples (`LEARNED_PENALTY = 0.3`)**: it was calibrated for colours alone (`eval-matcher --learn`), not recalibrated for the fusion.
6. **Cascade limited to the 100 best cards according to the colours.** If the right card is beyond that, the AI cannot catch it. This partly explains the gap with the full fusion (90.8 → 84.6 % on real photos), the rest coming from the single 168 px picture.
7. **int8 signatures in the catalog**: cosine ≥ 0.9999 with the float vectors. The bench, for its part, uses the float vectors.

---

## 7. Recommendations

### 7.1 Decided — native Android engine (in progress)

A Capacitor plugin (Java) with **ONNX Runtime Android** (`com.microsoft.onnxruntime:onnxruntime-android`):
- **YOLO first** (it is 95 % of the time on the phone), then DINOv2;
- multi-core (`intraOpNumThreads`), XNNPACK; NNAPI to be tested;
- passing the pictures: pixels of the crop (or of the whole picture for YOLO) → plugin → tensors. The cost of the JS ↔ native bridge (base64) must be measured; it may itself cost 20 to 50 ms;
- keep the WASM path as a **visible** fallback if the plugin fails; the PC stays on WebGPU/WASM;
- expected gain: YOLO 2.1 s → 150–300 ms, AI 388 → 50–80 ms;
- check the APK size (+10–15 MB per architecture; limit to arm64-v8a if possible).

### 7.2 Next (by order of interest)

1. **More real photos** (300+) through `npm run photos:prepare`, then recalibrate the thresholds **on a mix** of simulated and real photos, always keeping a separate set of real photos for measuring.
2. **Measure α and the input size again** once the engine is native: if a picture’s cost becomes negligible, go back to 224 px (+2.5 points) or even the full fusion (+6 points on real photos).
3. **Step 3 (optional): fine-tune DINOv2 on Riftbound cards** (contrastive learning, RTX 5070 available). This is the lead most likely to improve the AI alone, today worse than the colours alone.
4. **Add to the catalog** the UNL runes (UNL-R01 to R06) and the missing SFD tokens.
5. **Step 5** of the plan: checks by the card’s frame (domain colour, cost, Might) to settle between reprints and close cards.
6. Recalibrate `LEARNED_PENALTY` for the fusion (`eval-matcher --learn` adapted to engine mode).

---

## 8. Reproduce

```bash
# Full bench of the app (models in model/embedders/, see model/MODELS.md to find them)
npm run eval:matcher -- --compare grid16,dinov2s-int8-mean-168@art --fusion 0.5 --cascade 100 --single --sample 300 --aug 2 --seed 11

# Comparison of step 2
npm run eval:matcher -- --compare grid16,dinov2s-mean@art,dinov2s-int8-mean@art,mnv4s@art,siglip2b@full --fusion 0.3,0.5,0.7 --sample 300 --aug 2 --seed 11

# Real photos: model/real-photos-raw/<CODE>/*.jpg then
npm run photos:prepare

# AI signatures of the catalog
node scripts/build-embeddings.mjs
```

Detailed report of the last bench: `model/eval-compare.json`. Sources and SHA-256 of the models: `model/MODELS.md`.

**Commits:**

| Commit | Content |
|---|---|
| 511b7a7 | step 1 |
| 2fa1d8c, 9ea14f7, ebbf7e9 | step 2 |
| e905619 | step 4 |
| 5f7ec54, 3e85dc6 | step 4.6 |

**Tests:** 76 Node tests (`npm test`) at the time, including `tests/engines.test.mjs`:
- engine interface;
- int8 coding of the vectors;
- signatures made by the shipped model;
- cascade and learning;
- different model refused, with a visible fallback.

Lint: 0 errors, 0 warnings.
