"""Preview of the planned generator changes (data_creator.py untouched): real sleeves larger
than the card, labels on the card, phone tilted (top narrower), bottom sometimes cut.
CPU only. Usage: python model/generator_preview.py <repo> <out_dir> <n>"""
import sys, os, random, math
import numpy as np, cv2
repo, out_dir, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
sys.path.insert(0, os.path.join(repo, 'model'))
import data_creator as dc

def rounded_mask(h, w, r):
    m = np.zeros((h, w), np.uint8); r = max(1, int(r))
    cv2.rectangle(m, (r, 0), (w - 1 - r, h - 1), 255, -1); cv2.rectangle(m, (0, r), (w - 1, h - 1 - r), 255, -1)
    for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)): cv2.circle(m, (cx, cy), r, 255, -1)
    return m

SLEEVE_COLOURS = [(150, 60, 20), (40, 40, 170), (30, 30, 30), (20, 110, 30), (110, 30, 110), (200, 200, 200), (40, 140, 200)]  # BGR: blue, red, black, green, purple, white, yellow

def sleeve_card(card):
    """Card (BGRA) inside a sleeve larger than the card. Returns image (BGRA) and the card's 4 corners in it."""
    h, w = card.shape[:2]
    if card.shape[2] == 3: card = np.dstack([card, np.full((h, w), 255, np.uint8)])
    kind = random.choices(['couleur', 'translucide', 'transparente'], [0.55, 0.25, 0.20])[0]
    m = int(w * random.uniform(0.02, 0.04)); top = m + int(h * random.uniform(0.0, 0.012))  # sleeve opening: a bit more room at the top
    H, W = h + top + m, w + 2 * m
    colour = np.array(random.choice(SLEEVE_COLOURS), np.float32) + np.random.uniform(-25, 25, 3)
    alpha_border = {'couleur': random.uniform(0.85, 1.0), 'translucide': random.uniform(0.45, 0.75), 'transparente': random.uniform(0.08, 0.2)}[kind]
    out = np.zeros((H, W, 4), np.float32)
    shape = rounded_mask(H, W, m * 1.2).astype(np.float32) / 255
    if kind == 'transparente': colour = np.array([235, 235, 235], np.float32)
    out[..., :3] = colour; out[..., 3] = shape * alpha_border * 255
    # card inside (its own rounded corners from the scan's alpha)
    ca = card[..., 3:4].astype(np.float32) / 255
    reg = out[top:top + h, m:m + w]
    reg[..., :3] = card[..., :3] * ca + reg[..., :3] * (1 - ca)
    reg[..., 3] = np.maximum(reg[..., 3], card[..., 3])
    # front plastic: slight haze + a glare streak + bright sleeve edge
    haze = random.uniform(0.0, 0.08)
    out[..., :3] = out[..., :3] * (1 - haze * shape[..., None]) + 255 * haze * shape[..., None]
    if random.random() < 0.7:
        g = np.zeros((H, W), np.float32); x0 = random.randint(-W // 2, W); th = random.randint(W // 12, W // 4)
        cv2.line(g, (x0, -10), (x0 + random.randint(-W // 2, W // 2), H + 10), 1.0, th); g = cv2.GaussianBlur(g, (0, 0), th / 2) * random.uniform(0.15, 0.45) * shape
        out[..., :3] = out[..., :3] * (1 - g[..., None]) + 255 * g[..., None]
    edge = cv2.morphologyEx((shape * 255).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32) / 255
    out[..., :3] += edge[..., None] * random.uniform(20, 70); out[..., 3] = np.maximum(out[..., 3], edge * 200)
    corners = np.float32([[m, top], [m + w, top], [m + w, top + h], [m, top + h]])
    return np.clip(out, 0, 255).astype(np.uint8), corners, kind

def tilt(img, pts, ratio, squash):
    """Phone tilted: top edge narrower (ratio top/bottom), picture squashed vertically."""
    H, W = img.shape[:2]
    d = (1 - ratio) * W / 2
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]]); dst = np.float32([[d, H * squash], [W - d, H * squash], [W, H], [0, H]])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    p = cv2.perspectiveTransform(pts[None], M)[0]
    return warped, p, cv2.perspectiveTransform(src[None], M)[0]

def sample(card_paths, cut):
    card = dc._load_card(random.choice(card_paths))
    if card.shape[1] > card.shape[0]: card = cv2.rotate(card, cv2.ROTATE_90_CLOCKWISE)  # battlefields: held in portrait like the photos
    sleeved = random.random() < 0.85
    if sleeved: obj, corners, kind = sleeve_card(card)
    else:
        obj = card if card.shape[2] == 4 else np.dstack([card, np.full(card.shape[:2], 255, np.uint8)]); kind = 'sans'
        corners = np.float32([[0, 0], [obj.shape[1], 0], [obj.shape[1], obj.shape[0]], [0, obj.shape[0]]])
    ratio = random.uniform(0.75, 0.90); squash = random.uniform(0.0, 0.10)
    obj, corners, outline = tilt(obj, corners, ratio, squash)
    # 3:4 portrait photo, card filling it, small rotation, bottom sometimes past the frame
    PW, PH = 576, 768
    bg = dc.generate_random_background(PH)[:, (PH - PW) // 2:(PH - PW) // 2 + PW].copy()
    bg = dc.add_lighting_gradient(bg)
    oh, ow = obj.shape[:2]
    fill = random.uniform(0.78, 0.95)
    s = fill * min(PW / ow, PH / oh)
    ang = random.uniform(-6, 6)
    cx = PW / 2 + random.uniform(-0.04, 0.04) * PW
    cy = PH / 2 + random.uniform(-0.03, 0.03) * PH
    if cut:  # bottom of the card past the frame by 2-9 % of its height
        cy = PH - oh * s / 2 + random.uniform(0.02, 0.09) * oh * s; ang = random.uniform(-6, 6)
    M = cv2.getRotationMatrix2D((ow / 2, oh / 2), -ang, s); M[0, 2] += cx - ow / 2; M[1, 2] += cy - oh / 2
    layer = cv2.warpAffine(obj, M, (PW, PH), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = layer[..., 3:4].astype(np.float32) / 255
    img = (layer[..., :3] * a + bg * (1 - a)).astype(np.uint8)
    tr = lambda P: (np.hstack([P, np.ones((4, 1), np.float32)]) @ M.T)
    c = tr(corners); o = tr(outline)
    img = dc.augment_color(img); img = dc.add_vignette(img)
    return img, c, o, dict(kind=kind, ratio=ratio, cut=cut)

def draw(img, c, o, info, pad=0.08):
    H, W = img.shape[:2]; P = int(pad * H)
    can = np.full((H + 2 * P, W + 2 * P, 3), 60, np.uint8); can[P:P + H, P:P + W] = img
    cv2.rectangle(can, (P, P), (P + W, P + H), (255, 255, 255), 1)
    cv2.polylines(can, [(o + P).astype(np.int32)], True, (255, 160, 0), 1)       # sleeve outline (blue-ish)
    cv2.polylines(can, [(c + P).astype(np.int32)], True, (0, 255, 0), 2)         # labelled card corners (green)
    for q in c: cv2.circle(can, tuple(int(v) for v in q + P), 5, (0, 0, 255) if not (0 <= q[0] <= W and 0 <= q[1] <= H) else (0, 255, 0), -1)
    t = f"{info['kind']} h/b {info['ratio']:.2f}" + (" coupe" if info['cut'] else "")
    cv2.putText(can, t, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
    return can

random.seed(7); np.random.seed(7)
paths = dc.load_card_paths_from_db()
for i in range(n):
    img, c, o, info = sample(paths, cut=(i % 3 == 2))
    cv2.imwrite(os.path.join(out_dir, f'g{i:02d}.jpg'), draw(img, c, o, info), [cv2.IMWRITE_JPEG_QUALITY, 88])
print('ok', n)
