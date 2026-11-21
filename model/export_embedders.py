"""
Export of image-embedding models to ONNX (AMELIORATIONS-MODELES.md, step 2.2).

    model/.venv-embed/Scripts/python model/export_embedders.py [mnv4s] [siglip2b]

For each model:
  - checks the licence on Hugging Face (Apache-2.0 / MIT / BSD only) and pins
    the revision (commit hash);
  - downloads the weights as **safetensors** only (no pickle), creates the
    timm model WITHOUT its classification head (num_classes=0 → global
    feature vector);
  - exports to ONNX (opset 18, dynamic batch), checks the PyTorch / ONNX
    parity (max gap < 1e-3), makes an int8 version (quantize_dynamic) and
    reports its gap;
  - writes model/embedders/<id>/{model.onnx, model_int8.onnx, config.json}
    and prints the SHA-256 for model/MODELS.md.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import timm
import torch
from huggingface_hub import hf_hub_download, model_info
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "embedders"
ALLOWED = {"apache-2.0", "mit", "bsd-3-clause", "bsd-2-clause"}

MODELS = {
    "mnv4s": "timm/mobilenetv4_conv_small.e2400_r224_in1k",
    "siglip2b": "timm/vit_base_patch16_siglip_224.v2_webli",
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def export(key, repo):
    info = model_info(repo)
    licence = (info.card_data or {}).get("license") if info.card_data else None
    if licence not in ALLOWED:
        raise SystemExit(f"{repo}: licence « {licence} » non autorisée — arrêt")
    rev = info.sha
    files = [s.rfilename for s in info.siblings]
    if "model.safetensors" not in files:
        raise SystemExit(f"{repo}: pas de model.safetensors — arrêt (pas de pickle)")
    weights = hf_hub_download(repo, "model.safetensors", revision=rev)
    model = timm.create_model(
        f"hf-hub:{repo}", pretrained=True, num_classes=0,
        pretrained_cfg_overlay={"file": weights},
    ).eval()
    cfg = timm.data.resolve_data_config({}, model=model)
    _, h, w = cfg["input_size"]
    out_dir = OUT / key
    out_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = out_dir / "model.onnx"
    dummy = torch.randn(2, 3, h, w)
    torch.onnx.export(
        model, dummy, str(onnx_path), opset_version=18, dynamo=False,
        input_names=["pixel_values"], output_names=["image_embeds"],
        dynamic_axes={"pixel_values": {0: "batch"}, "image_embeds": {0: "batch"}},
    )
    with torch.no_grad():
        ref = model(dummy).numpy()
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    got = sess.run(None, {"pixel_values": dummy.numpy()})[0]
    gap = float(np.abs(ref - got).max())
    if gap >= 1e-3:
        raise SystemExit(f"{key}: parité PyTorch / ONNX insuffisante ({gap:.2e})")
    int8_path = out_dir / "model_int8.onnx"
    quantize_dynamic(str(onnx_path), str(int8_path), weight_type=QuantType.QInt8)
    sess8 = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"])
    got8 = sess8.run(None, {"pixel_values": dummy.numpy()})[0]
    cos = float((ref * got8).sum(1).mean() / (np.linalg.norm(ref, axis=1) * np.linalg.norm(got8, axis=1)).mean())
    config = {
        "repo": repo, "revision": rev, "licence": licence,
        "width": w, "height": h, "mean": list(cfg["mean"]), "std": list(cfg["std"]),
        "interpolation": cfg.get("interpolation"), "dim": int(ref.shape[1]), "pooling": "out",
    }
    (out_dir / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    summary = {
        "id": key, **config,
        "parity_fp32_max_abs": gap, "int8_cosine_vs_fp32": round(cos, 5),
        "files": {
            "model.onnx": {"bytes": onnx_path.stat().st_size, "sha256": sha256(onnx_path)},
            "model_int8.onnx": {"bytes": int8_path.stat().st_size, "sha256": sha256(int8_path)},
            "safetensors": {"sha256": sha256(weights)},
        },
    }
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    keys = sys.argv[1:] or list(MODELS)
    results = [export(k, MODELS[k]) for k in keys]
    (OUT / "export-summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
