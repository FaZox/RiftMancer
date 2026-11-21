"""
Fine-tuning of DINOv2-small on the Riftbound cards (AMELIORATIONS-MODELES.md, step 3).

    model/.venv-train/Scripts/python model/train_embedder.py parity   # base weights = the shipped ONNX?
    model/.venv-train/Scripts/python model/train_embedder.py train    # RTX GPU (CUDA)
    model/.venv-train/Scripts/python model/train_embedder.py export   # ONNX fp32 + fp16 (same format as the app's)

Base: facebook/dinov2-small (Apache 2.0, safetensors, revision pinned below).
Same architecture and output as the app's engine (`dinov2s-fp16-mean-168`):
pixel_values [b, 3, h, w] → last_hidden_state; the card's vector is the mean
of the patch tokens of the illustration resized to 168 × 168 (ImageNet norm).

Data: the catalog images (public/cards/*.webp) and, for every training
sample, a simulated phone photo (port of scripts/lib/simulate.mjs: perspective,
rotation, crop shift like YOLO's errors, light, white balance, blur, sleeve
glare, fake foil, JPEG, noise), then the app's illustration crop.

Leak-free split (the main trap): 80 % of the artwork groups (`artGroup`, a
reprint with the same artwork is the same class) for training, 20 % never
seen — they measure the cards « absent from the catalog » and new sets.
Seeds fixed. Written to model/finetune/split.json.

Learning: ArcFace (s = 30, m = 0.2) on the training groups; the 6 last blocks
and the final norm are trained, the rest frozen.

Everything is written to model/finetune/ (git-ignored); exports to
model/embedders/dinov2s-ft/ (git-ignored). Weights and trials are backed up
outside the repo (model/MODELS.md).
"""
import argparse
import hashlib
import io
import json
import math
import os
import random
import sys
import time
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
CARDS = ROOT / "public" / "cards"
CATALOG = ROOT / "public" / "card-hashes.json"
OUT = BASE / "finetune"
EXPORT = BASE / "embedders" / "dinov2s-ft"
HF_ID = "facebook/dinov2-small"
HF_REV = "ed25f3a31f01632728cabb09d1542f84ab7b0056"
SEED = 7
SIZE = 168
CROP_W, CROP_H = 480, 670          # the app's straightened card
ART_TOP, ART_LEFT, ART_RIGHT = 0.05, 0.05, 0.95
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def load_catalog():
    cards = json.loads(CATALOG.read_text(encoding="utf-8"))["cards"]
    return [c for c in cards if (CARDS / f"{c['id']}.webp").exists()]


def group_of(c):
    return c.get("artGroup") or c["id"]


# ── Images ──────────────────────────────────────────────────────────────
def read_card(card_id):
    import cv2
    img = cv2.imread(str(CARDS / f"{card_id}.webp"), cv2.IMREAD_COLOR)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def art_crop(img, bottom):
    """The app's illustration crop (regionRect + bilinear resize to 168)."""
    import cv2
    h, w = img.shape[:2]
    x0, y0 = round(w * ART_LEFT), round(h * ART_TOP)
    x1, y1 = round(w * ART_RIGHT), round(h * bottom)
    return cv2.resize(img[y0:y1, x0:x1], (SIZE, SIZE), interpolation=cv2.INTER_LINEAR)


def to_tensor(img):
    x = (img.astype(np.float32) / 255.0 - MEAN) / STD
    return x.transpose(2, 0, 1)


def simulate(img, rng):
    """Port of scripts/lib/simulate.mjs, plus fake foil and YOLO-like crop errors."""
    import cv2
    geo, light = rng.random(), rng.random()
    card = cv2.resize(img, (CROP_W, CROP_H), interpolation=cv2.INTER_AREA)
    bg = (60, 60, 60)
    # perspective (corner jitter ≈ YOLO's corner errors), rotation, shift
    j = 0.03 * geo
    src = np.float32([[0, 0], [CROP_W, 0], [CROP_W, CROP_H], [0, CROP_H]])
    dst = src + np.float32(rng.uniform(-j, j, (4, 2)) * [CROP_W, CROP_H])
    M = cv2.getPerspectiveTransform(src, dst)
    card = cv2.warpPerspective(card, M, (CROP_W, CROP_H), borderValue=bg)
    ang = rng.uniform(-5, 5) * geo
    R = cv2.getRotationMatrix2D((CROP_W / 2, CROP_H / 2), ang, 1.0)
    R[0, 2] += rng.uniform(-0.04, 0.04) * CROP_W * geo
    R[1, 2] += rng.uniform(-0.04, 0.04) * CROP_H * geo
    card = cv2.warpAffine(card, R, (CROP_W, CROP_H), borderValue=bg)
    x = card.astype(np.float32)
    # light: brightness, saturation, white balance
    L = lambda a, b: 1 + (rng.uniform(a, b) - 1) * light
    x *= L(0.7, 1.3)
    grey = x.mean(axis=2, keepdims=True)
    x = grey + (x - grey) * L(0.8, 1.2)
    x *= np.float32([L(0.9, 1.1), L(0.9, 1.1), L(0.9, 1.1)])
    # sleeve glare
    if rng.random() < 0.5 * light:
        gx, gy = rng.uniform(0.15, 0.85) * CROP_W, rng.uniform(0.1, 0.7) * CROP_H
        rad = rng.uniform(0.15, 0.35) * CROP_W
        yy, xx = np.mgrid[0:CROP_H, 0:CROP_W]
        d = np.sqrt(((xx - gx) / rad) ** 2 + ((yy - gy) / (rad * 0.6)) ** 2)
        a = np.clip(1 - d, 0, 1)[..., None] * rng.uniform(0.2, 0.5) * light
        x = x * (1 - a) + 255 * a
    # fake foil: a soft rainbow sheen
    if rng.random() < 0.15:
        yy, xx = np.mgrid[0:CROP_H, 0:CROP_W]
        ph = (xx * math.cos(rng.uniform(0, 3.14)) + yy * math.sin(rng.uniform(0, 3.14))) / rng.uniform(80, 200)
        rainbow = np.stack([np.sin(ph), np.sin(ph + 2.1), np.sin(ph + 4.2)], axis=2) * 0.5 + 0.5
        x = x * (1 - 0.18) + rainbow * 255 * 0.18
    x = np.clip(x, 0, 255).astype(np.uint8)
    sigma = rng.uniform(0, 1.5) * light
    if sigma >= 0.3:
        x = cv2.GaussianBlur(x, (0, 0), sigma)
    q = int(rng.uniform(55, 85)) if light > 0 else 95
    ok, enc = cv2.imencode(".jpg", cv2.cvtColor(x, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, q])
    x = cv2.cvtColor(cv2.imdecode(enc, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB).astype(np.float32)
    x += rng.normal(0, rng.uniform(2, 8) * light, x.shape)
    return np.clip(x, 0, 255).astype(np.uint8)


# ── Split ───────────────────────────────────────────────────────────────
def make_split(cards):
    groups = sorted({group_of(c) for c in cards})
    rnd = random.Random(SEED)
    rnd.shuffle(groups)
    n_val = round(len(groups) * 0.2)
    split = {"seed": SEED, "val": sorted(groups[:n_val]), "train": sorted(groups[n_val:])}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "split.json").write_text(json.dumps(split), encoding="utf-8")
    return split


# ── Model ───────────────────────────────────────────────────────────────
def load_base():
    from transformers import Dinov2Model
    return Dinov2Model.from_pretrained(HF_ID, revision=HF_REV)


def embed(model, x):
    """The app's vector: mean of the patch tokens of last_hidden_state."""
    return model(pixel_values=x).last_hidden_state[:, 1:].mean(dim=1)


def parity():
    import onnxruntime as ort
    import torch
    model = load_base().eval()
    ref = BASE / "embedders" / "dinov2s" / "model.onnx"
    sess = ort.InferenceSession(str(ref), providers=["CPUExecutionProvider"])
    x = np.random.default_rng(1).standard_normal((2, 3, SIZE, SIZE)).astype(np.float32)
    a = sess.run(None, {"pixel_values": x})[0]
    with torch.no_grad():
        b = model(pixel_values=torch.from_numpy(x)).last_hidden_state.numpy()
    print(f"base {HF_ID}@{HF_REV[:10]} contre {ref.name} : écart max {np.abs(a - b).max():.2e}")


# ── Training ────────────────────────────────────────────────────────────
class Samples:
    """Training views: a simulated photo of a card of a training group (index → class)."""

    def __init__(self, cards, classes, views, seed):
        self.items = [(c, classes[group_of(c)]) for c in cards for _ in range(views)]
        self.seed = seed

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        c, y = self.items[i]
        rng = np.random.default_rng((self.seed, i))
        img = read_card(c["id"])
        bottom = c.get("artBottom", 0.55)
        if rng.random() < 0.15:   # clean catalog-like view (the gallery side)
            x = art_crop(img, bottom)
        else:
            x = art_crop(simulate(img, rng), bottom)
        return to_tensor(x), y


class ArcFace:
    def __new__(cls, dim, n, s=30.0, m=0.2):
        import torch
        import torch.nn as nn
        import torch.nn.functional as F

        class _A(nn.Module):
            def __init__(self):
                super().__init__()
                self.W = nn.Parameter(torch.randn(n, dim) * 0.01)

            def forward(self, e, y):
                cos = F.linear(F.normalize(e), F.normalize(self.W)).clamp(-1 + 1e-6, 1 - 1e-6)
                theta = torch.acos(cos)
                target = torch.cos(theta + m)
                onehot = F.one_hot(y, n).bool()
                logits = torch.where(onehot, target, cos) * s
                return F.cross_entropy(logits, y)
        return _A()


def gallery_vectors(model, cards, device):
    import torch
    vecs = []
    with torch.no_grad():
        for i in range(0, len(cards), 64):
            batch = np.stack([to_tensor(art_crop(read_card(c["id"]), c.get("artBottom", 0.55))) for c in cards[i:i + 64]])
            with torch.autocast("cuda", dtype=torch.bfloat16):
                v = embed(model, torch.from_numpy(batch).to(device)).float()
            vecs.append(torch.nn.functional.normalize(v, dim=1).cpu())
    return torch.cat(vecs)


def evaluate(model, cards, split, device, n=600):
    """Top-1 (right artwork) on simulated photos of seen / never-seen groups, and how well
    a never-seen card is rejected when its group is removed (best other score)."""
    import torch
    model.eval()
    G = gallery_vectors(model, cards, device)
    groups = [group_of(c) for c in cards]
    rng = np.random.default_rng(99)
    val = set(split["val"])
    res = {}
    for name, pool in (("vus", [c for c in cards if group_of(c) not in val]), ("jamais vus", [c for c in cards if group_of(c) in val])):
        pick = [pool[k] for k in rng.choice(len(pool), min(n, len(pool)), replace=False)]
        X = np.stack([to_tensor(art_crop(simulate(read_card(c["id"]), rng), c.get("artBottom", 0.55))) for c in pick])
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            Q = torch.nn.functional.normalize(embed(model, torch.from_numpy(X).to(device)).float(), dim=1).cpu()
        S = Q @ G.T
        ok = 0
        margins = []
        for qi, c in enumerate(pick):
            g = group_of(c)
            order = torch.argsort(S[qi], descending=True)
            if groups[order[0]] == g:
                ok += 1
            own = max(S[qi, j].item() for j in range(len(cards)) if groups[j] == g)
            other = max(S[qi, j].item() for j in order[:20].tolist() if groups[j] != g)
            margins.append(own - other)
        res[name] = {"top1": ok / len(pick), "marge_mediane": float(np.median(margins))}
    model.train()
    return res


def train(epochs, views, batch, lr):
    import torch
    from torch.utils.data import DataLoader
    if not torch.cuda.is_available():
        raise SystemExit("PyTorch ne voit pas de carte graphique CUDA : entraînement refusé.")
    torch.manual_seed(SEED)
    random.seed(SEED)
    np.random.seed(SEED)
    device = "cuda"
    cards = load_catalog()
    split = make_split(cards)
    train_groups = split["train"]
    classes = {g: i for i, g in enumerate(train_groups)}
    train_cards = [c for c in cards if group_of(c) in classes]
    print(f"GPU {torch.cuda.get_device_name(0)} · {len(cards)} cartes, {len(train_groups)} groupes d'entraînement, {len(split['val'])} jamais vus · {len(train_cards)} cartes d'entraînement × {views} vues/époque")

    model = load_base().to(device)
    for p in model.parameters():
        p.requires_grad = False
    blocks = model.encoder.layer
    for blk in blocks[len(blocks) - 6:]:
        for p in blk.parameters():
            p.requires_grad = True
    for p in model.layernorm.parameters():
        p.requires_grad = True
    head = ArcFace(384, len(train_groups)).to(device)
    opt = torch.optim.AdamW([
        {"params": [p for p in model.parameters() if p.requires_grad], "lr": lr},
        {"params": head.parameters(), "lr": lr * 100},
    ], weight_decay=0.05)
    steps = epochs * math.ceil(len(train_cards) * views / batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[lr, lr * 100], total_steps=steps, pct_start=0.1)

    log = []
    before = evaluate(model, cards, split, device)
    print(f"avant : {before}")
    log.append({"epoch": 0, **before})
    t0 = time.time()
    for ep in range(1, epochs + 1):
        data = Samples(train_cards, classes, views, seed=SEED * 1000 + ep)
        loader = DataLoader(data, batch_size=batch, shuffle=True, num_workers=12, drop_last=True,
                            persistent_workers=False, generator=torch.Generator().manual_seed(SEED + ep))
        tot = 0.0
        for k, (x, y) in enumerate(loader):
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                e = embed(model, x)
            loss = head(e.float(), y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            tot += loss.item()
        msg = {"epoch": ep, "loss": tot / max(1, k + 1), "min": round((time.time() - t0) / 60, 1)}
        if ep % 2 == 0 or ep == epochs:
            msg.update(evaluate(model, cards, split, device))
        print(msg, flush=True)
        log.append(msg)
        torch.save({k2: v for k2, v in model.state_dict().items()}, OUT / "model.pt")
        (OUT / "train-log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"fini en {(time.time() - t0) / 60:.0f} min → {OUT / 'model.pt'}")


# ── Export ──────────────────────────────────────────────────────────────
def export():
    import onnx
    import onnxruntime as ort
    import torch
    from onnxruntime.transformers.float16 import convert_float_to_float16
    model = load_base()
    model.load_state_dict(torch.load(OUT / "model.pt", map_location="cpu"))
    model.eval()

    class Wrap(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, pixel_values):
            return self.m(pixel_values=pixel_values).last_hidden_state

    EXPORT.mkdir(parents=True, exist_ok=True)
    fp32 = EXPORT / "model.onnx"
    fp16 = EXPORT / "model_fp16.onnx"
    x = torch.randn(1, 3, SIZE, SIZE)
    torch.onnx.export(Wrap(model), (x,), str(fp32), input_names=["pixel_values"], output_names=["last_hidden_state"],
                      dynamic_axes={"pixel_values": {0: "batch", 2: "height", 3: "width"}, "last_hidden_state": {0: "batch", 1: "tokens"}},
                      opset_version=14, dynamo=False)
    # onnxruntime's converter (inputs / outputs stay float32, like the app's current fp16 model)
    # The patch / position embeddings (78 small nodes: bicubic Resize of the
    # position grid, its scales) stay float32 — in fp16 the Resize scales are
    # rejected; the 12 transformer blocks (the weights) are fp16.
    m32 = onnx.load(str(fp32))
    keep = [n.name for n in m32.graph.node if n.name.startswith("/m/embeddings/")]
    m16 = convert_float_to_float16(m32, keep_io_types=True, node_block_list=keep)
    onnx.save(m16, str(fp16))
    xn = np.random.default_rng(2).standard_normal((2, 3, SIZE, SIZE)).astype(np.float32)
    with torch.no_grad():
        ref = model(pixel_values=torch.from_numpy(xn)).last_hidden_state.numpy()
    for p in (fp32, fp16):
        out = ort.InferenceSession(str(p), providers=["CPUExecutionProvider"]).run(None, {"pixel_values": xn})[0]
        a = ref[:, 1:].mean(1)
        b = out[:, 1:].mean(1)
        cos = (a * b).sum(1) / np.linalg.norm(a, axis=1) / np.linalg.norm(b, axis=1)
        print(f"{p.name} {p.stat().st_size:>10} o  sha256 {sha256(p)}  parité : écart max {np.abs(out - ref).max():.2e}, cosinus des vecteurs ≥ {cos.min():.6f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["parity", "train", "export"])
    ap.add_argument("--epochs", type=int, default=16)
    ap.add_argument("--views", type=int, default=4)
    ap.add_argument("--batch", type=int, default=96)
    ap.add_argument("--lr", type=float, default=2e-5)
    a = ap.parse_args()
    if a.cmd == "parity":
        parity()
    elif a.cmd == "train":
        train(a.epochs, a.views, a.batch, a.lr)
    else:
        export()
