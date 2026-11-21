# Count cards whose corners are pushed out of the picture by Ultralytics' augmentations
# (settings of a checkpoint's train_args), CPU only.
# Usage: python model/hidden_keypoints.py last.pt data.yaml n mosaic
import sys, random, torch
torch.set_num_threads(2)
from ultralytics.cfg import get_cfg
from ultralytics.data.build import build_yolo_dataset
from ultralytics.data.utils import check_det_dataset
ckpt, yaml_path, n, mosaic = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
a = torch.load(ckpt, map_location='cpu', weights_only=False)['train_args']
for k in ('resume', 'save_dir', 'model', 'pretrained'): a.pop(k, None)
a.update(mosaic=mosaic, data=yaml_path, device='cpu', workers=0, cache=False)
cfg = get_cfg(overrides=a)
data = check_det_dataset(yaml_path)
ds = build_yolo_dataset(cfg, data['train'], 16, data, mode='train', rect=False, stride=32)
random.seed(0)
idx = random.sample(range(len(ds)), n)
cards = hidden_cards = hidden_corners = imgs_with = 0
per_card = [0] * 5
for i in idx:
    k = ds[i]['keypoints']  # (N, 4, 3) x, y, visibility
    if k is None or len(k) == 0: continue
    v = (k[..., 2] == 0).sum(1)
    cards += len(k); hidden_cards += int((v > 0).sum()); hidden_corners += int(v.sum()); imgs_with += int((v > 0).any())
    for c in v.tolist(): per_card[c] += 1
print(f"{len(ds)} images, échantillon {n}, mosaïque {mosaic}: cartes {cards}, avec ≥1 coin caché {hidden_cards} ({100*hidden_cards/cards:.1f} %), coins cachés {hidden_corners} ({100*hidden_corners/(4*cards):.1f} %), images concernées {imgs_with}/{n}, répartition 0-4 coins {per_card}")
print(f"PAR_EPOQUE {len(ds)*hidden_cards/n:.0f} cartes concernées sur {len(ds)*cards/n:.0f}")
