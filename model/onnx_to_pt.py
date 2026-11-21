"""
Rebuilds a trainable Ultralytics checkpoint (.pt) from a YOLO11s-pose ONNX
export (the shipped detector, whose Modal best.pt is lost).

The export fused each convolution with its batch normalisation (conv weight
and bias). The rebuilt model keeps the normal (unfused) layers: each conv gets
the fused weight, and its BatchNorm is set to change nothing but add the fused
bias (scale 1, shift = bias, mean 0, variance 1 − eps). Its outputs are checked
against ONNX Runtime on random and real pictures.

    model/.venv-train/Scripts/python model/onnx_to_pt.py SRC.onnx OUT.pt [--check-dir DIR]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import onnx
import torch
from onnx import numpy_helper

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("out")
ap.add_argument("--check-dir", help="real photos to compare outputs on")
ap.add_argument("--debug", action="store_true")
a = ap.parse_args()
DEBUG = a.debug

from ultralytics import YOLO
from ultralytics.nn.modules import Conv
from ultralytics.nn.tasks import PoseModel
from ultralytics.utils import YAML
import ultralytics

om = onnx.load(a.src)
meta = {p.key: p.value for p in om.metadata_props}
imgsz = eval(meta["imgsz"])[0]
W = {i.name: torch.from_numpy(numpy_helper.to_array(i).copy()) for i in om.graph.initializer}

cfg = YAML.load(Path(ultralytics.__file__).parent / "cfg/models/11/yolo11-pose.yaml")
cfg["scale"] = "s"
# The shipped model (Ultralytics 8.4.59) has an SPPF whose first convolution has
# NO activation. Newer Ultralytics adds SiLU back for short « legacy » SPPF rows
# ([1024, 5]); the full row [1024, 5, 3, False] keeps it unactivated, and stays
# in the checkpoint's yaml, so training rebuilds the same network.
for row in cfg["backbone"]:
    if row[2] == "SPPF":
        row[3] = [1024, 5, 3, False]
model = PoseModel(cfg, ch=3, nc=1, data_kpt_shape=(4, 2), verbose=False)
model.eval()

used, missing = set(), []
for name, mod in model.named_modules():
    if isinstance(mod, Conv):
        w, b = W.get(f"{name}.conv.weight"), W.get(f"{name}.conv.bias")
        if w is None or b is None:
            missing.append(name)
            continue
        assert mod.conv.weight.shape == w.shape, (name, mod.conv.weight.shape, w.shape)
        mod.conv.weight.data.copy_(w)
        bn = mod.bn
        bn.weight.data.fill_(1.0)
        bn.bias.data.copy_(b)
        bn.running_mean.data.zero_()
        bn.running_var.data.fill_(1.0 - bn.eps)
        used.update({f"{name}.conv.weight", f"{name}.conv.bias"})
# plain convolutions (head outputs: cv2/cv3/cv4 last layers, dfl) keep their names
sd = model.state_dict()
for k, v in W.items():
    if k in used or k not in sd:
        continue
    assert sd[k].shape == v.shape, (k, sd[k].shape, v.shape)
    sd[k].copy_(v)
    used.add(k)
model.load_state_dict(sd)
left = [k for k in W if k.startswith("model.") and k not in used]
print(f"poids repris : {len(used)}, convolutions sans poids : {missing}, poids ONNX non repris : {left}")
if missing or left:
    sys.exit("reconstruction incomplète")

# outputs: torch (eval, float32) vs ONNX Runtime
import onnxruntime as ort
import cv2
sess = ort.InferenceSession(a.src, providers=["CPUExecutionProvider"])
model.model[-1].export = False
def compare(x):
    with torch.no_grad():
        t = model(torch.from_numpy(x))
        t = (t[0] if isinstance(t, (list, tuple)) else t).numpy()
    o = sess.run(None, {sess.get_inputs()[0].name: x})[0]
    if DEBUG:
        print('  formes', t.shape, o.shape, 'écart par canal', [f'{np.abs(t[0, c] - o[0, c]).max():.1e}' for c in range(o.shape[1])])
    return np.abs(t - o).max(), np.abs(o).max()
xs = [np.random.default_rng(0).random((1, 3, imgsz, imgsz), dtype=np.float32)]
if a.check_dir:
    for p in sorted(Path(a.check_dir).rglob("*.jpg"))[:8]:
        im = cv2.imread(str(p))
        h, w = im.shape[:2]; s = imgsz / max(h, w)
        can = np.full((imgsz, imgsz, 3), 114, np.uint8)
        r = cv2.resize(im, (round(w * s), round(h * s)))
        can[: r.shape[0], : r.shape[1]] = r
        xs.append(can[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255)
worst = 0.0
for x in xs:
    d, m = compare(x)
    worst = max(worst, d)
    print(f"  écart max torch / ONNX : {d:.2e} (sorties jusqu'à {m:.1f})")
if worst > 1e-2:
    sys.exit("sorties différentes de l'ONNX")

ckpt = {
    "model": model,
    "train_args": {"task": "pose", "imgsz": imgsz},
    "date": meta.get("date"),
    "version": meta.get("version"),
    "epoch": -1,
    "best_fitness": None,
    "ema": None,
    "optimizer": None,
}
torch.save(ckpt, a.out)
print(f"écrit : {a.out}")
