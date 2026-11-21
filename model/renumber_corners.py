"""
Corner numbering of a YOLO-pose card dataset, made like the old dataset's.

The old generator labelled the card's own corners (TL, TR, BR, BL of the card
picture) with cards turned by at most ±75°: the shipped model learned that
(error 0.4-1 % of the diagonal in every 10° bin from −80° to +80°, no switch).
The new generator also turns cards and whole pictures by 90°, 180° and 270°
while keeping the card's own corners: 45 % of the cards then have their
corners numbered one, two or three places away from what the model outputs.

Rule: θ = angle of the edge corner 1 → corner 2 in the picture. |θ| ≤ 85° (the old
dataset never goes beyond, ±75° turns plus perspective):
unchanged (the old dataset); otherwise the corners are shifted by quarter
turns to bring θ closest to 0° (that is, the picture's order). Only the
keypoint order changes; the box and the corners' positions stay.

    python model/renumber_corners.py <dataset dir> [--switch 45] [--dry]

2026-11-15: with the switch at 85°, a peak of corner error at 80–85° (quarter-turned
cards ±12° fall on both sides of it); switch moved to 45° (model/MODELS.md).
"""
import sys, os, glob, math

SWITCH = 85.0  # --switch 45: below this angle the card's own corners, above the picture's order

def renumber(vals):
    k = [(vals[5 + 2 * i], vals[6 + 2 * i]) for i in range(4)]
    th = math.degrees(math.atan2(k[1][1] - k[0][1], k[1][0] - k[0][0]))
    if abs(th) <= SWITCH:
        return vals, 0
    # shift s: new corner i = old corner (i + s) % 4; its top edge is the old edge s → s + 1,
    # at th + 90·s (corners clockwise in the picture, y down)
    best = min(range(4), key=lambda s: abs((th + 90 * s + 180) % 360 - 180))
    k2 = [k[(i + best) % 4] for i in range(4)]
    return vals[:5] + [c for p in k2 for c in p], best

def main():
    global SWITCH
    root = sys.argv[1]; dry = '--dry' in sys.argv
    if '--switch' in sys.argv: SWITCH = float(sys.argv[sys.argv.index('--switch') + 1])
    stats = {0: 0, 1: 0, 2: 0, 3: 0}; files = 0
    for f in glob.glob(os.path.join(root, '*', 'labels', '*.txt')):
        out = []
        for line in open(f):
            v = line.split()
            if len(v) != 13: out.append(line.rstrip('\n')); continue
            nv, s = renumber([float(x) for x in v]); stats[s] += 1
            out.append(' '.join([v[0]] + [f'{x:.6f}' for x in nv[1:]]))
        if not dry:
            open(f, 'w').write('\n'.join(out) + ('\n' if out else ''))
        files += 1
    for c in glob.glob(os.path.join(root, '*', 'labels.cache')):
        if not dry: os.remove(c)
    print(f'{files} fichiers ; cartes inchangées {stats[0]}, décalées de 1 / 2 / 3 quarts de tour : {stats[1]} / {stats[2]} / {stats[3]}' + (' (essai)' if dry else ''))

if __name__ == '__main__':
    main()
