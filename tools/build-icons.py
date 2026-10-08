"""Erzeugt die App-Icons (app/icons/*.png) aus den Kartendaten.

Aufruf: python3 tools/build-icons.py   (benötigt Pillow)
Motiv: Silhouette der 48 zusammenhängenden Staaten in Petrol auf warmem Off-White.
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BG = (246, 244, 239)
INK = (46, 107, 102)
SCALE = 4  # Supersampling für glatte Kanten

src = (ROOT / "app/js/data/map.js").read_text()
shapes = json.loads(re.search(r"export const SHAPES = (\{.*\});", src).group(1))


def rings(d):
    # d3-geoPath liefert für Flächen nur M/L/Z-Befehle.
    for part in re.findall(r"M[^M]*", d):
        pts = [tuple(map(float, p.split(","))) for p in re.findall(r"-?[\d.]+,-?[\d.]+", part)]
        if len(pts) > 2:
            yield pts


polys = [r for code, s in shapes.items() if code not in ("AK", "HI") for r in rings(s["d"])]
xs = [x for r in polys for x, _ in r]
ys = [y for r in polys for _, y in r]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)


def render(size, coverage):
    big = size * SCALE
    img = Image.new("RGB", (big, big), BG)
    draw = ImageDraw.Draw(img)
    k = big * coverage / (x1 - x0)
    ox = (big - (x1 - x0) * k) / 2 - x0 * k
    oy = (big - (y1 - y0) * k) / 2 - y0 * k + big * 0.02
    for r in polys:
        draw.polygon([(ox + x * k, oy + y * k) for x, y in r], fill=INK)
    return img.resize((size, size), Image.LANCZOS)


out = ROOT / "app/icons"
out.mkdir(exist_ok=True)
# Maskable-Icons brauchen eine Sicherheitszone – daher nur ~62 % Breite.
render(512, 0.62).save(out / "icon-512.png", optimize=True)
render(192, 0.62).save(out / "icon-192.png", optimize=True)
render(180, 0.66).save(out / "apple-touch-icon.png", optimize=True)
print("Icons geschrieben:", ", ".join(p.name for p in sorted(out.glob("*.png"))))
