"""Erzeugt die App-Icons beider Apps aus den Kartendaten.

Aufruf: python3 tools/build-icons.py   (benötigt Pillow)
USA:    Silhouette der 48 zusammenhängenden Staaten in Petrol auf warmem Off-White.
Europa: Silhouette Europas (ohne die nur angeschnittenen Länder) in dezentem Blau auf kühlem Off-White.
München: Stadtgebiet in Tannengrün auf hellem, leicht grünem Grund.
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
APPS = [
    {"map": "app/js/data/map.js", "out": "app/icons", "skip": ("AK", "HI"),
     "bg": (246, 244, 239), "ink": (46, 107, 102), "coverage": (0.62, 0.66)},
    {"map": "app/europa/js/data/map.js", "out": "app/europa/icons", "skip": ("ru", "tr", "is", "cy"),
     "bg": (243, 245, 248), "ink": (61, 95, 135), "coverage": (0.58, 0.62)},
    {"map": "app/muenchen/js/data/map.js", "out": "app/muenchen/icons", "skip": (),
     "bg": (243, 245, 242), "ink": (31, 77, 58), "coverage": (0.66, 0.7)},
]
SCALE = 4  # Supersampling für glatte Kanten


def rings(d):
    # d3-geoPath liefert für Flächen nur M/L/Z-Befehle.
    for part in re.findall(r"M[^M]*", d):
        pts = [tuple(map(float, p.split(","))) for p in re.findall(r"-?[\d.]+,-?[\d.]+", part)]
        if len(pts) > 2:
            yield pts


def area(r):
    return abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]))) / 2


def render(polys, size, coverage, bg, ink):
    # Rahmen nur aus größeren Flächen bilden, damit entlegene Inselchen (Azoren, Spitzbergen) das Motiv nicht verschieben.
    main = [r for r in polys if area(r) > 150]
    xs = [x for r in main for x, _ in r]
    ys = [y for r in main for _, y in r]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    polys = [r for r in polys if all(x0 - 5 <= x <= x1 + 5 and y0 - 5 <= y <= y1 + 5 for x, y in r)]
    big = size * SCALE
    img = Image.new("RGB", (big, big), bg)
    draw = ImageDraw.Draw(img)
    k = big * coverage / max(x1 - x0, y1 - y0)
    ox = (big - (x1 - x0) * k) / 2 - x0 * k
    oy = (big - (y1 - y0) * k) / 2 - y0 * k + big * 0.02
    for r in polys:
        draw.polygon([(ox + x * k, oy + y * k) for x, y in r], fill=ink)
    return img.resize((size, size), Image.LANCZOS)


for app in APPS:
    src = (ROOT / app["map"]).read_text()
    shapes = json.loads(re.search(r"export const SHAPES = (\{.*\});", src).group(1))
    polys = [r for code, s in shapes.items() if code not in app["skip"] for r in rings(s["d"])]
    out = ROOT / app["out"]
    out.mkdir(parents=True, exist_ok=True)
    wide, touch = app["coverage"]
    # Maskable-Icons brauchen eine Sicherheitszone – daher nur ~60 % der Fläche.
    render(polys, 512, wide, app["bg"], app["ink"]).save(out / "icon-512.png", optimize=True)
    render(polys, 192, wide, app["bg"], app["ink"]).save(out / "icon-192.png", optimize=True)
    render(polys, 180, touch, app["bg"], app["ink"]).save(out / "apple-touch-icon.png", optimize=True)
    print("Icons geschrieben:", out.relative_to(ROOT))
