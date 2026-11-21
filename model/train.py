"""
Card detector training (YOLO11s-pose, 4 card corners) — local GPU.

    python -m venv model/.venv-train
    model/.venv-train/Scripts/pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
    model/.venv-train/Scripts/pip install -r model/requirements-train.txt
    python model/data_creator.py                       # dataset → model/dataset/ (once)
    model/.venv-train/Scripts/python model/train.py    # train + export
    model/.venv-train/Scripts/python model/train.py --export-only
    model/.venv-train/Scripts/python model/train.py --resume

Same settings as the former cloud training (Modal, A100, imgsz 768), except
(AMELIORATIONS-NATIF.md, step 1): imgsz = 416 with multi-scale training, so
that one model works well from 320 to 768 px — the phone can then run the
detector on much smaller images.

Refuses to start without a CUDA graphics card visible to PyTorch.

Export (CPU, opset 12, simplify, fixed size — as before) to
model/runs/train/weights/export/ for every size of EXPORT_SIZES:
  yolo11s-pose-rb416-<S>.onnx      float32
  yolo11s-pose-rb416-<S>-q8.onnx   int8: onnxruntime quantize_dynamic,
                                   weights QUInt8 (same method as before)
The app keeps its current models until one is chosen (public/models/ is
not touched).
"""
import argparse
import yaml
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATASET = Path(os.environ["RB_DATASET_DIR"]) if os.environ.get("RB_DATASET_DIR") else BASE / "dataset"
RUNS = BASE / "runs"
NAME = "train"  # --name: several trainings side by side (model/runs/<name>/)
WEIGHTS = RUNS / NAME / "weights"
EXPORT = WEIGHTS / "export"


def set_name(name):
    global NAME, WEIGHTS, EXPORT
    NAME = name
    WEIGHTS = RUNS / NAME / "weights"
    EXPORT = WEIGHTS / "export"
IMGSZ = 416
EXPORT_SIZES = (320, 416, 512, 768)
PREFIX = "yolo11s-pose-rb416"

# Same hyper-parameters as the Modal training (model/train.py before
# 2026-11-11), except imgsz (768 → 416) and multi-scale.
TRAIN_ARGS = dict(
    epochs=80,             # realistic schedule for a single-class pose head
    imgsz=IMGSZ,
    multi_scale=0.5,       # ultralytics ≥ 8.4: input size drawn in imgsz × (1 ± 0.5) at each batch (≈ 208–650 px)
    batch=32,              # was 32 at 768 on an A100
    device=0,
    amp=True,              # mixed precision (Tensor cores)
    task="pose",
    project=str(RUNS),
    name="train",
    exist_ok=True,
    patience=40,           # early-stop if val plateaus
    hsv_v=0.6,
    mixup=0.2,
    degrees=3.0,
    fliplr=0.0,            # cards are never mirrored; flipping would break the TL..BL keypoint order
    flipud=0.0,
    pose=25.0,
    box=7.5,
    cls=0.3,
    close_mosaic=15,       # clean fine-tune phase (~last 19% of the schedule)
    cos_lr=True,
)


def check_gpu():
    import torch
    if not torch.cuda.is_available():
        raise SystemExit(
            "PyTorch ne voit pas de carte graphique CUDA : entraînement refusé.\n"
            "Installez la version CUDA de PyTorch (voir l'en-tête de ce fichier)."
        )
    name = torch.cuda.get_device_name(0)
    cap = torch.cuda.get_device_capability(0)
    # Small computation on the GPU: the CUDA build really supports this card.
    x = torch.randn(512, 512, device="cuda")
    float((x @ x).sum())
    print(f"GPU : {name} (capacité {cap[0]}.{cap[1]}), PyTorch {torch.__version__}, CUDA {torch.version.cuda}")


def write_yaml():
    if not (DATASET / "train" / "images").exists():
        raise SystemExit(f"Jeu de données absent ({DATASET}) : lancez d'abord  python model/data_creator.py")
    # Label format is YOLO pose: `class cx cy w h x1 y1 x2 y2 x3 y3 x4 y4`;
    # kpt_shape [4, 2] = 4 keypoints (x, y), no visibility flag.
    yaml_path = DATASET / "data.yaml"
    yaml_path.write_text(
        f"path: {DATASET.as_posix()}\n"
        "train: train/images\n"
        "val: val/images\n\n"
        "nc: 1\n"
        "names: ['card']\n"
        "kpt_shape: [4, 2]\n",
        encoding="utf-8",
    )
    return yaml_path


def train(resume=False, weights="yolo11s-pose.pt", overrides=None):
    from ultralytics import YOLO
    check_gpu()
    if resume:
        last = WEIGHTS / "last.pt"
        if not last.exists():
            raise SystemExit(f"--resume : {last} introuvable")
        YOLO(str(last)).train(resume=True)
        return
    yaml_path = write_yaml()
    if (RUNS / NAME).exists():
        shutil.rmtree(RUNS / NAME)
    # Windows: worker processes re-import this file — keep the work under __main__.
    # --weights: fine-tune an existing detector (e.g. the shipped model's best.pt) instead of the Ultralytics start
    YOLO(weights).train(data=str(yaml_path), **{**TRAIN_ARGS, "name": NAME, "workers": 16, **(overrides or {})})


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def export():
    best = WEIGHTS / "best.pt"
    if not best.exists():
        raise SystemExit(f"{best} introuvable : entraînez d'abord")
    EXPORT.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["CUDA_VISIBLE_DEVICES"] = ""  # same export path as before: CPU
    from onnxruntime.quantization import QuantType, quantize_dynamic
    for s in EXPORT_SIZES:
        # ultralytics writes best.onnx next to best.pt: renamed per size.
        subprocess.run(
            [sys.executable, "-c",
             f"from ultralytics import YOLO; YOLO(r'{best}').export(format='onnx', imgsz={s}, opset=12, simplify=True, dynamic=False, device='cpu')"],
            env=env, check=True,
        )
        fp32 = EXPORT / f"{PREFIX}-{s}.onnx"
        q8 = EXPORT / f"{PREFIX}-{s}-q8.onnx"
        shutil.move(str(WEIGHTS / "best.onnx"), fp32)
        quantize_dynamic(str(fp32), str(q8), weight_type=QuantType.QUInt8)
        for p in (fp32, q8):
            print(f"{p.name}  {p.stat().st_size:>10} o  sha256 {sha256(p)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--export-only", action="store_true")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--weights", default="yolo11s-pose.pt", help="starting weights (default: Ultralytics yolo11s-pose.pt)")
    ap.add_argument("--imgsz", type=int, help="training size (default %d)" % IMGSZ)
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--batch", type=float, help="images per batch, or a share of the graphics card memory (0.45: two trainings side by side)")
    ap.add_argument("--workers", type=int, help="image loading processes (default 16)")
    ap.add_argument("--cache", choices=["ram", "disk"], help="keep the decoded images (ram: needs the memory)")
    ap.add_argument("--name", default="train")
    ap.add_argument("--optimizer", help="SGD / AdamW… (with « auto », Ultralytics ignores --lr0)")
    ap.add_argument("--set", nargs="*", default=[], metavar="KEY=VALUE", help="other Ultralytics settings, e.g. multi_scale=0.25 warmup_bias_lr=0.0")
    ap.add_argument("--lr0", type=float, help="first learning rate (lower for a fine-tune, e.g. 0.002)")
    a = ap.parse_args()
    set_name(a.name)
    batch = None if a.batch is None else (int(a.batch) if a.batch >= 1 else a.batch)
    over = {k: v for k, v in dict(imgsz=a.imgsz, epochs=a.epochs, batch=batch, lr0=a.lr0, workers=a.workers, cache=a.cache, optimizer=a.optimizer).items() if v is not None}
    for kv in a.set:
        k, v = kv.split("=", 1)
        over[k] = yaml.safe_load(v)
    if not a.export_only:
        train(resume=a.resume, weights=a.weights, overrides=over)
    export()
