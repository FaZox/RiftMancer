"""
BatchNorm statistics for the model rebuilt from the ONNX (model/onnx_to_pt.py).

The rebuilt model has every BatchNorm neutralised (mean 0, variance 1 − eps,
scale 1, bias = the fused bias): right in eval mode, but in training mode
each BatchNorm normalises with the batch's own statistics and the network's
output changes completely (activations off by 100–340 %, corners by ~20 % of
the picture) — a fine-tune then starts from a broken model.

Here the real per-channel statistics of every convolution's output (μ, σ²)
are measured on training pictures, and each BatchNorm is set to
running_mean = μ, running_var = σ², weight = √(σ² + eps), bias = b + μ:
the eval-mode output is exactly the same, and in training mode the batch
statistics (≈ μ, σ²) now give almost the same output. CPU only.

    model/.venv-train/Scripts/python model/bn_recalibrate.py <rebuilt.pt> <dataset dir> <out.pt> [n images]
"""
import sys, glob, random
import numpy as np, cv2, torch
from ultralytics import YOLO

def letterbox(f, s=768):
    im = cv2.imread(f); h, w = im.shape[:2]; r = s / max(h, w); im = cv2.resize(im, (round(w * r), round(h * r)))
    can = np.full((s, s, 3), 114, np.uint8); can[:im.shape[0], :im.shape[1]] = im
    return torch.from_numpy(can[:, :, ::-1].copy()).permute(2, 0, 1).float() / 255

def main():
    src, data, out = sys.argv[1:4]; n = int(sys.argv[4]) if len(sys.argv) > 4 else 128
    torch.set_num_threads(8)
    yolo = YOLO(src); model = yolo.model.float().eval()
    convs = [m for m in model.modules() if hasattr(m, 'conv') and isinstance(getattr(m, 'bn', None), torch.nn.BatchNorm2d)]
    sums = {id(m): [0, None, None] for m in convs}
    def hook(m, inp, outp):
        x = outp.double(); s = sums[id(m)]
        s[0] += x.shape[0] * x.shape[2] * x.shape[3]
        a, b = x.sum((0, 2, 3)), (x * x).sum((0, 2, 3))
        s[1] = a if s[1] is None else s[1] + a; s[2] = b if s[2] is None else s[2] + b
    hooks = [m.conv.register_forward_hook(lambda mod, i, o, m=m: hook(m, i, o)) for m in convs]
    random.seed(0); files = random.sample(sorted(glob.glob(data + '/train/images/*.jpg')), n)
    with torch.no_grad():
        for k in range(0, n, 16): model(torch.stack([letterbox(f) for f in files[k:k + 16]]))
    for h in hooks: h.remove()
    with torch.no_grad():
        for m in convs:
            c, a, b = sums[id(m)]; mu = a / c; var = (b / c - mu * mu).clamp_min(1e-8)
            bn = m.bn; bias = bn.bias.double().clone()  # neutralised BN: output = x + bias
            bn.running_mean.copy_(mu.float()); bn.running_var.copy_(var.float())
            bn.weight.copy_(torch.sqrt(var + bn.eps).float()); bn.bias.copy_((bias + mu).float())
    ck = torch.load(src, map_location='cpu', weights_only=False)
    ck['model'] = model.half() if next(iter(ck['model'].parameters())).dtype == torch.float16 else model
    ck.pop('ema', None)
    torch.save(ck, out)
    print(f'{len(convs)} BatchNorm recalibrées sur {n} images → {out}')

if __name__ == '__main__':
    main()
