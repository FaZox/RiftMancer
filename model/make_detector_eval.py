"""
Simulated scenes to measure the card detector (AMELIORATIONS-NATIF.md 1.2).

    python model/make_detector_eval.py [N]      (default 200 scenes, seed 7)

Same generator as the training set (data_creator.py: cards on textures and
backgrounds, sleeves, distractors, grids, close-ups, mosaics), but the card
of every label is recorded too, so that the bench can check the final
identification, not only the corners. Writes
  model/detector-eval/scenes/<n>.jpg
  model/detector-eval/scenes.json   [{ file, kind, cards: [{ id, corners: [[x, y] × 4] (pixels, TL TR BR BL) }] }]
(git-ignored: regenerated in a few seconds).
"""
import json
import os
import random
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data_creator as dc  # noqa: E402

OUT = os.path.join(dc.BASE_DIR, "detector-eval")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 200

random.seed(7)
dc.rng = np.random.default_rng(seed=7)

# Record which card each pose label belongs to: the last card image loaded
# before the label is written.
_current = {"path": None}
_records = []
_load = dc._load_card
_label = dc._corners_to_pose_label


def _load_card(path, *a, **k):
    _current["path"] = path
    return _load(path, *a, **k)


def _corners_to_pose_label(corners):
    _records.append((_current["path"], [tuple(map(float, c)) for c in corners]))
    return _label(corners)


dc._load_card = _load_card
dc._corners_to_pose_label = _corners_to_pose_label

paths = dc.load_card_paths_from_db()
os.makedirs(os.path.join(OUT, "scenes"), exist_ok=True)
scenes = []
kinds = [("grid", dc.generate_grid_image), ("closeup", dc.generate_closeup_image)]
for i in range(N):
    _records.clear()
    r = random.random()
    if r < 0.25:
        kind, (img, labels) = "grid", dc.generate_grid_image(paths)
    elif r < 0.45:
        kind, (img, labels) = "closeup", dc.generate_closeup_image(paths)
    else:
        kind, (img, labels) = "scene", dc.generate_image(paths, use_mosaic=False)
    if len(_records) != len(labels):
        continue  # a label we could not attribute to a card: skip the scene
    h, w = img.shape[:2]
    cards = []
    for path, corners in _records:
        cid = os.path.splitext(os.path.basename(path))[0]
        cards.append({"id": cid, "corners": [[x * w, y * h] for x, y in corners]})
    name = f"{i:04d}.jpg"
    cv2.imwrite(os.path.join(OUT, "scenes", name), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    scenes.append({"file": name, "kind": kind, "cards": cards})

with open(os.path.join(OUT, "scenes.json"), "w", encoding="utf-8") as f:
    json.dump(scenes, f)
print(f"{len(scenes)} scenes, {sum(len(s['cards']) for s in scenes)} cartes -> {OUT}")
