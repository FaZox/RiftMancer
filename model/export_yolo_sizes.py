"""
YOLO11s-pose at other input sizes (AMELIORATIONS-NATIF.md, step 1.1).

    model/.venv-embed/Scripts/python model/export_yolo_sizes.py [320 416 512] [--src F] [--out D]

Source (--src, default model/yolo-sizes/yolo11s-pose-riftbound-768.onnx): the
ONNX export of the detector trained at 768 px (768 × 768, opset 12,
dynamic=False; in git history as public/models/yolo11s-pose-riftbound.onnx,
commit 6772729, and in the backup folder of model/MODELS.md). Its training
checkpoint (best.pt) lives on the Modal volume; the ONNX file holds the same
weights. A YOLO network is fully convolutional: only a few constants of the
exported graph depend on the input size —
  - the anchor grid of the Pose head (cell centres, strides) and the
    flattened detection count N = (S/8)² + (S/16)² + (S/32)²;
  - the reshapes of the DFL box decoder (… × N);
  - the reshapes of the C2PSA attention block (S/32 × S/32 positions).
This script recomputes them for size S (same recipe as ultralytics'
make_anchors), checks that S = 768 gives back the original constants
exactly, and writes, for each size:
  model/yolo-sizes/yolo11s-pose-riftbound-<S>.onnx    float32
  model/yolo-sizes/yolo11s-pose-riftbound-<S>-q8.onnx int8, same method as
      model/train.py: onnxruntime quantize_dynamic, weights QUInt8
  (--out D: in folder D instead, e.g. --out public/models for the app)

    … export_yolo_sizes.py --dynamic [--out D]
writes ONE float32 model with a dynamic input size (any multiple of 32):
  yolo11s-pose-riftbound-dyn.onnx
The 9 constants become a small sub-graph computed from the input's shape
(anchor grid, strides, reshapes), and its outputs are checked against the
fixed-size models at 320, 416 and 768 px.
It prints the SHA-256 of each file (for model/MODELS.md). The output is
reproducible bit for bit: same source → same SHA-256.
"""
import hashlib
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "model" / "yolo-sizes" / "yolo11s-pose-riftbound-768.onnx"
OUT = ROOT / "model" / "yolo-sizes"  # git-ignored
STRIDES = (8, 16, 32)


def anchors(size):
    """Cell centres (x + 0.5, y + 0.5) and strides of the 3 levels, flattened (ultralytics make_anchors)."""
    pts, strides = [], []
    for s in STRIDES:
        g = size // s
        sx = np.arange(g, dtype=np.float32) + 0.5
        sy = np.arange(g, dtype=np.float32) + 0.5
        yy, xx = np.meshgrid(sy, sx, indexing="ij")
        pts.append(np.stack([xx.ravel(), yy.ravel()], axis=0))
        strides.append(np.full((g * g,), s, dtype=np.float32))
    return np.concatenate(pts, axis=1), np.concatenate(strides)[None, :]


def constants(size):
    """Every size-dependent constant of the graph, by initializer name."""
    if size % 32:
        raise SystemExit(f"{size} : la taille doit être un multiple de 32")
    a, st = anchors(size)
    n = a.shape[1]
    g32 = size // 32
    return {
        "/model.10/m/m.0/attn/Constant_output_0": np.array([1, 4, 128, g32 * g32], dtype=np.int64),
        "/model.10/m/m.0/attn/Constant_3_output_0": np.array([1, 256, g32, g32], dtype=np.int64),
        "/model.23/dfl/Constant_output_0": np.array([1, 4, 16, n], dtype=np.int64),
        "/model.23/dfl/Constant_1_output_0": np.array([1, 4, n], dtype=np.int64),
        # keypoints: (kpt × 2 + (anchor − 0.5)) × stride
        "/model.23/Constant_25_output_0": (a - 0.5).astype(np.float32),
        "/model.23/Constant_26_output_0": st,
        # boxes: anchor ± distances, × stride
        "/model.23/Constant_15_output_0": a[None, :, :],
        "/model.23/Constant_16_output_0": a[None, :, :],
        "/model.23/Constant_18_output_0": st,
    }, n


def resized_model(size):
    m = onnx.load(str(SRC))
    consts, n = constants(size)
    found = set()
    for init in m.graph.initializer:
        if init.name in consts:
            init.CopyFrom(numpy_helper.from_array(consts[init.name], init.name))
            found.add(init.name)
    missing = set(consts) - found
    if missing:
        raise SystemExit(f"Constantes introuvables dans le modèle : {missing}")
    inp = m.graph.input[0].type.tensor_type.shape.dim
    inp[2].dim_value = size
    inp[3].dim_value = size
    m.graph.output[0].type.tensor_type.shape.dim[2].dim_value = n
    # Intermediate shapes inferred for 768 would be wrong: dropped, re-inferred.
    del m.graph.value_info[:]
    m = onnx.shape_inference.infer_shapes(m)
    onnx.checker.check_model(m)
    return m


def dynamic_model():
    """Same graph, input [1, 3, h, w]: the size-dependent constants are computed from the input shape."""
    from onnx import TensorProto, helper
    m = onnx.load(str(SRC))
    g = m.graph
    consts, _ = constants(768)
    names = set(consts)
    kept = [i for i in g.initializer if i.name not in names]
    if len(kept) != len(g.initializer) - len(names):
        raise SystemExit("Constantes introuvables dans le modèle")
    del g.initializer[:]
    g.initializer.extend(kept)

    nodes = []
    inits = []
    k = [0]

    def c(value, dtype=np.int64):
        k[0] += 1
        name = f"/dyn/c{k[0]}"
        inits.append(numpy_helper.from_array(np.array(value, dtype=dtype), name))
        return name

    def node(op, inputs, output=None, **attrs):
        k[0] += 1
        out = output or f"/dyn/t{k[0]}"
        nodes.append(helper.make_node(op, inputs, [out], name=f"/dyn/n{k[0]}", **attrs))
        return out

    shape = node("Shape", ["images"])
    h = node("Gather", [shape, c(2)])  # scalar int64
    w = node("Gather", [shape, c(3)])
    # reshapes: N via -1, the attention block's grid from the input size
    node("Identity", [c([1, 4, 128, -1])], "/model.10/m/m.0/attn/Constant_output_0")
    g32 = [node("Unsqueeze", [node("Div", [x, c(32)])], axes=[0]) for x in (h, w)]
    node("Concat", [c([1, 256])] + g32, "/model.10/m/m.0/attn/Constant_3_output_0", axis=0)
    node("Identity", [c([1, 4, 16, -1])], "/model.23/dfl/Constant_output_0")
    node("Identity", [c([1, 4, -1])], "/model.23/dfl/Constant_1_output_0")
    # anchors (x + 0.5, y + 0.5, x fastest) and strides of the 3 levels
    pts, strides = [], []
    for st in STRIDES:
        gh = node("Div", [h, c(st)])
        gw = node("Div", [w, c(st)])
        xs = node("Add", [node("Cast", [node("Range", [c(0), gw, c(1)])], to=TensorProto.FLOAT), c(0.5, np.float32)])
        ys = node("Add", [node("Cast", [node("Range", [c(0), gh, c(1)])], to=TensorProto.FLOAT), c(0.5, np.float32)])
        grid = node("Concat", [node("Unsqueeze", [gh], axes=[0]), node("Unsqueeze", [gw], axes=[0])], axis=0)
        xx = node("Reshape", [node("Expand", [node("Unsqueeze", [xs], axes=[0]), grid]), c([1, -1])])
        yy = node("Reshape", [node("Expand", [node("Unsqueeze", [ys], axes=[1]), grid]), c([1, -1])])
        pts.append(node("Concat", [xx, yy], axis=0))                              # [2, gh·gw]
        cells = node("Unsqueeze", [node("Mul", [gh, gw])], axes=[0])
        strides.append(node("Expand", [c([[float(st)]], np.float32), node("Concat", [c([1]), cells], axis=0)]))
    a = node("Concat", pts, axis=1)                                               # [2, N]
    stv = node("Concat", strides, axis=1)                                         # [1, N]
    node("Sub", [a, c(0.5, np.float32)], "/model.23/Constant_25_output_0")
    node("Identity", [stv], "/model.23/Constant_26_output_0")
    a3 = node("Unsqueeze", [a], axes=[0])
    node("Identity", [a3], "/model.23/Constant_15_output_0")
    node("Identity", [a3], "/model.23/Constant_16_output_0")
    node("Identity", [stv], "/model.23/Constant_18_output_0")

    old = list(g.node)
    del g.node[:]
    g.node.extend(nodes + old)
    g.initializer.extend(inits)
    inp = g.input[0].type.tensor_type.shape.dim
    inp[2].dim_param = "height"
    inp[3].dim_param = "width"
    g.output[0].type.tensor_type.shape.dim[2].dim_param = "anchors"
    del g.value_info[:]
    m = onnx.shape_inference.infer_shapes(m)
    onnx.checker.check_model(m)
    return m


def check_dynamic(path):
    """The dynamic model gives the fixed-size models' outputs (320, 416, 768)."""
    import onnxruntime as ort
    dyn = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(3)
    for size in (320, 416, 768):
        fixed = onnx.load(str(SRC)) if size == 768 else resized_model(size)
        ref = ort.InferenceSession(fixed.SerializeToString(), providers=["CPUExecutionProvider"])
        x = rng.random((1, 3, size, size), dtype=np.float32)
        a = ref.run(None, {"images": x})[0]
        b = dyn.run(None, {"images": x})[0]
        if a.shape != b.shape:
            raise SystemExit(f"dynamique {size} : forme {b.shape} au lieu de {a.shape}")
        diff = float(np.abs(a - b).max())
        print(f"dynamique {size} : sortie {b.shape}, écart max avec le modèle fixe {diff:.2e}")
        if diff > 1e-3:
            raise SystemExit("écart trop grand — arrêt")


def check_768():
    """S = 768 must give back the original constants exactly."""
    orig = {i.name: numpy_helper.to_array(i) for i in onnx.load(str(SRC)).graph.initializer}
    consts, n = constants(768)
    for k, v in consts.items():
        if orig[k].shape != v.shape or not np.array_equal(orig[k], v):
            raise SystemExit(f"768 : constante {k} différente de l'export ultralytics — arrêt")
    print(f"768 : les {len(consts)} constantes recalculées sont identiques à l'export d'origine (N = {n})")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


if __name__ == "__main__":
    args = sys.argv[1:]
    for flag in ("--src", "--out"):
        if flag in args:
            i = args.index(flag)
            value = Path(args[i + 1]).resolve()
            if flag == "--src":
                SRC = value
            else:
                OUT = value
            del args[i:i + 2]
    dynamic = "--dynamic" in args
    if dynamic:
        args.remove("--dynamic")
    if not SRC.exists():
        raise SystemExit(f"Source absente : {SRC} (voir model/MODELS.md, « Régénérer les modèles float32 »)")
    OUT.mkdir(parents=True, exist_ok=True)
    check_768()
    if dynamic:
        out = OUT / "yolo11s-pose-riftbound-dyn.onnx"
        onnx.save(dynamic_model(), str(out))
        check_dynamic(out)
        print(f"{out.name}  {out.stat().st_size:>10} o  sha256 {sha256(out)}")
        sys.exit(0)
    sizes = [int(x) for x in args] or [320, 416, 512]
    for s in sizes:
        fp32 = OUT / f"yolo11s-pose-riftbound-{s}.onnx"
        q8 = OUT / f"yolo11s-pose-riftbound-{s}-q8.onnx"
        onnx.save(resized_model(s), str(fp32))
        quantize_dynamic(str(fp32), str(q8), weight_type=QuantType.QUInt8)
        for p in (fp32, q8):
            print(f"{p.name}  {p.stat().st_size:>10} o  sha256 {sha256(p)}")
