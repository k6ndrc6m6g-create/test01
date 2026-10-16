"""Erzeugt die Daten der München-App (app/muenchen/js/data/*.js).

Aufruf: python3 tools/build-muenchen.py [CACHE_VERZEICHNIS]

Quellen (werden bei Bedarf in das Cache-Verzeichnis geladen, Standard: .cache-muenchen/):
- Stadtbezirke und Stadtbezirksteile: Landeshauptstadt München, Geoportal (Datenlizenz Deutschland – Namensnennung 2.0)
- S- und U-Bahn: MVV-Sollfahrplan Gesamtnetz (GTFS, CC BY 4.0)
- Stadtteile und Viertel: Wikipedia, „Stadtteile, Quartiere und Siedlungen in München“ (CC BY-SA 4.0)

Nur Python-Standardbibliothek. Koordinaten der Stadt liegen in ETRS89/UTM 32N (EPSG:25832);
Haltestellen (WGS84) werden in dasselbe System umgerechnet.
"""
import csv
import io
import json
import math
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from heapq import heappop, heappush
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".cache-muenchen"
OUT = ROOT / "app/muenchen/js/data"
UA = {"User-Agent": "geo-lern-app/1.0 (educational PWA build script)"}

WFS = "https://geoportal.muenchen.de/geoserver/gsm_wfs/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&typeName=gsm_wfs:"
SOURCES = {
    "stadtbezirke.json": WFS + "vablock_stadtbezirk",
    "bezirksteile.json": WFS + "vablock_bezirksteil",
    "gtfs.zip": "https://www.mvv-muenchen.de/fileadmin/mediapool/developer/opendata/gesamt_gtfs.zip",
    "stadtteile.wiki": "https://de.wikipedia.org/w/index.php?title=Stadtteile,_Quartiere_und_Siedlungen_in_M%C3%BCnchen&action=raw",
}

# Linien mit Farben (MVG/MVV-Liniensignale) und den äußeren Endhaltestellen je Richtung.
# Die Endhaltestellen sind redaktionell festgelegt (Normalbetrieb, äußerste Enden), da der Fahrplan
# auch Baustellen- und Verstärkerfahrten enthält.
LINES = {
    "U1": ("#3c7233", "#ffffff", [["Olympia-Einkaufszentrum"], ["Mangfallplatz"]]),
    "U2": ("#c4022e", "#ffffff", [["Feldmoching"], ["Messestadt Ost"]]),
    "U3": ("#ec6726", "#ffffff", [["Moosach"], ["Fürstenried West"]]),
    "U4": ("#00a984", "#ffffff", [["Westendstraße"], ["Arabellapark"]]),
    "U5": ("#bc7a00", "#ffffff", [["Laimer Platz"], ["Neuperlach Süd"]]),
    "U6": ("#0065ae", "#ffffff", [["Garching-Forschungszentrum"], ["Klinikum Großhadern"]]),
    "U7": ("#3c7233", "#ffffff", [["Olympia-Einkaufszentrum"], ["Neuperlach Zentrum"]]),
    "U8": ("#c4022e", "#ffffff", [["Olympiazentrum"], ["Messestadt Ost", "Neuperlach Zentrum"]]),
    "S1": ("#16bae7", "#ffffff", [["Freising", "Flughafen München"], ["Leuchtenbergring"]]),
    "S2": ("#76b82a", "#ffffff", [["Petershausen", "Altomünster"], ["Erding"]]),
    "S3": ("#951b81", "#ffffff", [["Mammendorf"], ["Holzkirchen"]]),
    "S4": ("#e30613", "#ffffff", [["Geltendorf"], ["Ebersberg"]]),
    "S5": ("#005a82", "#ffffff", [["Weßling"], ["Kreuzstraße"]]),
    "S6": ("#00975f", "#ffffff", [["Tutzing"], ["Ebersberg"]]),
    "S7": ("#943126", "#ffffff", [["Wolfratshausen"], ["Hauptbahnhof"]]),
    "S8": ("#000000", "#f0aa00", [["Herrsching"], ["Flughafen München"]]),
    "S20": ("#ea516d", "#ffffff", [["Pasing"], ["Höllriegelskreuth"]]),
}
# U7 und U8 fahren als Verstärkerlinien in den Farben zweier Stammlinien.
SECOND_COLOR = {"U7": "#c4022e", "U8": "#ec6726"}

RENAME = {
    "Hauptbahnhof (U, Tram)": "Hauptbahnhof",
    "München Hbf": "Hauptbahnhof",
    "Garching, Forschungszentrum": "Garching-Forschungszentrum",
    "Germering, Germering-Unterpfaffenhofen": "Germering-Unterpfaffenhofen",
    "Flughafen, Besucherpark": "Besucherpark",
    "Großhesselohe, Isartalbahnhof": "Großhesselohe Isartalbahnhof",
}

WIDTH = 1000


def fetch(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print("lade", name)
        with urllib.request.urlopen(urllib.request.Request(SOURCES[name], headers=UA), timeout=300) as r:
            path.write_bytes(r.read())
    return path


# ---------- Geometrie ----------

def latlon_to_utm32(lat, lon):
    """WGS84/ETRS89 → UTM Zone 32N (EPSG:25832), Genauigkeit im Millimeterbereich."""
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon)
    lam0 = math.radians(9)
    n = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    t = math.tan(phi) ** 2
    c = ep2 * math.cos(phi) ** 2
    A = math.cos(phi) * (lam - lam0)
    e4, e6 = e2 * e2, e2 * e2 * e2
    m = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
             - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * phi)
             + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * phi)
             - (35 * e6 / 3072) * math.sin(6 * phi))
    x = k0 * n * (A + (1 - t + c) * A ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A ** 5 / 120) + 500000
    y = k0 * (m + n * math.tan(phi) * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * A ** 4 / 24
                                       + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A ** 6 / 720))
    return x, y


def polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def simplify(points, tol):
    """Douglas-Peucker für einen geschlossenen Ring."""
    if len(points) < 5:
        return points

    def dp(pts):
        (x1, y1), (x2, y2) = pts[0], pts[-1]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy) or 1e-9
        best, idx = 0, 0
        for i in range(1, len(pts) - 1):
            x, y = pts[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
            if d > best:
                best, idx = d, i
        if best <= tol:
            return [pts[0], pts[-1]]
        return dp(pts[: idx + 1])[:-1] + dp(pts[idx:])

    # Ring an zwei gegenüberliegenden Punkten teilen, damit Anfang und Ende erhalten bleiben.
    half = len(points) // 2
    return dp(points[: half + 1])[:-1] + dp(points[half:])


def point_in_rings(x, y, rings):
    inside = False
    for ring in rings:
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]
            xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


# ---------- Stadtbezirke ----------

bezirke_geo = json.loads(fetch("stadtbezirke.json").read_text())
teile_geo = json.loads(fetch("bezirksteile.json").read_text())

bezirke = {}
for feat in bezirke_geo["features"]:
    nr = feat["properties"]["sb_nummer"].zfill(2)
    bezirke[nr] = {"name": feat["properties"]["sb_name"], "polys": polygons(feat["geometry"])}
assert len(bezirke) == 25, len(bezirke)

all_pts = [p for b in bezirke.values() for poly in b["polys"] for ring in poly for p in ring]
min_x = min(p[0] for p in all_pts)
max_x = max(p[0] for p in all_pts)
min_y = min(p[1] for p in all_pts)
max_y = max(p[1] for p in all_pts)
PAD = 600  # Meter Rand um das Stadtgebiet
K = WIDTH / (max_x - min_x + 2 * PAD)
HEIGHT = round((max_y - min_y + 2 * PAD) * K)


def sx(x):
    return round((x - min_x + PAD) * K, 1)


def sy(y):
    return round((max_y + PAD - y) * K, 1)


def ring_path(ring, tol=12):
    pts = simplify([tuple(p[:2]) for p in ring[:-1]] if ring[0] == ring[-1] else [tuple(p[:2]) for p in ring], tol)
    return "M" + "L".join(f"{sx(x)},{sy(y)}" for x, y in pts) + "Z"


def fmt(n):
    return round(n, 1)


shapes = {}
for nr, b in sorted(bezirke.items()):
    d = "".join(ring_path(ring) for poly in b["polys"] for ring in poly)
    xs = [p[0] for poly in b["polys"] for p in poly[0]]
    ys = [p[1] for poly in b["polys"] for p in poly[0]]
    # Mittelpunkt: Flächenschwerpunkt des größten Teilstücks.
    ring = max((poly[0] for poly in b["polys"]), key=len)
    a = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    cx, cy = cx / (3 * a), cy / (3 * a)
    shapes[nr] = {
        "d": d,
        "bbox": [sx(min(xs)), sy(max(ys)), fmt((max(xs) - min(xs)) * K), fmt((max(ys) - min(ys)) * K)],
        "center": [sx(cx), sy(cy)],
    }

# Nachbarschaft: Bezirke, deren Grenzpunkte sich auf wenige Meter nahekommen.
CELL = 15
grid = defaultdict(set)
for nr, b in bezirke.items():
    for poly in b["polys"]:
        for ring in poly:
            for x, y in ring:
                grid[(int(x // CELL), int(y // CELL))].add(nr)
touch = Counter()
for (gx, gy), owners in grid.items():
    near = set(owners)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            near |= grid.get((gx + dx, gy + dy), set())
    for a in owners:
        for b in near:
            if a < b:
                touch[(a, b)] += 1
for nr in shapes:
    shapes[nr]["neighbors"] = sorted({b if a == nr else a for (a, b), n in touch.items() if n >= 5 and nr in (a, b)})

# Bezirksteile als feine Linien (nur Umrisse).
parts = "".join(ring_path(ring, tol=15) for feat in teile_geo["features"] for poly in polygons(feat["geometry"]) for ring in poly)

# Stadtgrenze für die Haltestellenzuordnung (Originalgeometrie).
def bezirk_at(x, y):
    for nr, b in bezirke.items():
        for poly in b["polys"]:
            if point_in_rings(x, y, poly):
                return nr
    return None


# ---------- S- und U-Bahn ----------

zf = zipfile.ZipFile(fetch("gtfs.zip"))


def rows(name):
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8-sig"))


route_line = {}
for r in rows("routes.txt"):
    short = r["route_short_name"]
    if short not in LINES:
        continue
    if (short.startswith("S") and r["agency_id"] == "ddb-800725") or (short.startswith("U") and r["route_type"] == "1"):
        route_line[r["route_id"]] = short
trip_line = {t["trip_id"]: route_line[t["route_id"]] for t in rows("trips.txt") if t["route_id"] in route_line}

stops = {s["stop_id"]: s for s in rows("stops.txt")}


def station_of(stop_id):
    s = stops[stop_id]
    return s.get("parent_station") or stop_id


trip_seq = defaultdict(list)
for st in rows("stop_times.txt"):
    if st["trip_id"] in trip_line:
        trip_seq[st["trip_id"]].append((int(st["stop_sequence"]), station_of(st["stop_id"])))

# Haltestellen nach (bereinigtem) Namen zusammenführen – S- und U-Bahnhof am selben Ort werden eins.
name_of = {}
for seq in trip_seq.values():
    for _, sid in seq:
        raw = stops[sid]["stop_name"]
        name_of[sid] = RENAME.get(raw, raw)
coords = defaultdict(list)
for sid, name in name_of.items():
    coords[name].append(latlon_to_utm32(float(stops[sid]["stop_lat"]), float(stops[sid]["stop_lon"])))

# Netz je Verkehrsmittel als Graph; Kanten der eigenen Linie sind „billiger“ als fremde.
edges = {"S": defaultdict(Counter), "U": defaultdict(Counter)}
for tid, seq in trip_seq.items():
    seq.sort()
    names = [name_of[s] for _, s in seq]
    line = trip_line[tid]
    for a, b in zip(names, names[1:]):
        if a != b:
            edges[line[0]][line][(a, b)] += 1
            edges[line[0]][line][(b, a)] += 1


def coords_mean(name):
    pts = coords[name]
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def dist(a, b):
    (x1, y1), (x2, y2) = coords_mean(a), coords_mean(b)
    return math.hypot(x2 - x1, y2 - y1)


FULL = {}
for mode in edges:
    FULL[mode] = defaultdict(set)
    for counts in edges[mode].values():
        for a, b in counts:
            FULL[mode][a].add(b)


def graph_for(line):
    """Netz für die Wegsuche einer Linie ohne „Abkürzungen“. Fahrten, die Halte auslassen (Express,
    Baustellen), erzeugen Kanten a→b, obwohl es a→c→b gibt. Eine solche Kante bleibt nur, wenn die
    Linie selbst sie regelmäßig fährt und den Zwischenhalt c nie bedient (z. B. S7 Donnersbergerbrücke →
    Hauptbahnhof ohne Hackerbrücke)."""
    mode = line[0]
    own = edges[mode][line]
    top = max(own.values())
    graph = {a: set(bs) for a, bs in FULL[mode].items()}
    for a, bs in FULL[mode].items():
        for b in bs:
            regular = own.get((a, b), 0) >= 0.25 * top
            for c in FULL[mode][a]:
                if c == b or b not in FULL[mode].get(c, ()):
                    continue
                if dist(a, c) + dist(c, b) >= 1.15 * dist(a, b):
                    continue
                if not regular or ((a, c) in own and (c, b) in own):
                    graph[a].discard(b)
                    break
    return graph


def route(line, start, goal):
    mode = line[0]
    own = edges[mode][line]
    graph = graph_for(line)
    # Häufig befahrene Kanten der Linie sind billig; selten befahrene (Umleitungen, Baustellen) teuer;
    # Kanten anderer Linien nur als Lückenfüller (z. B. U7 bis Neuperlach Zentrum).
    top = max(own.values())

    def cost(a, b):
        share = own.get((a, b), 0) / top
        if share >= 0.25:
            return 1
        if share > 0:
            return 1 + 20 * (0.25 - share) / 0.25
        return 25

    dist, prev, heap = {start: 0}, {}, [(0, start)]
    while heap:
        d, node = heappop(heap)
        if node == goal:
            break
        if d > dist[node]:
            continue
        for nxt in graph[node]:
            nd = d + cost(node, nxt)
            if nd < dist.get(nxt, 1e9):
                dist[nxt], prev[nxt] = nd, node
                heappush(heap, (nd, nxt))
    if goal not in dist:
        raise SystemExit(f"Kein Weg für {line}: {start} → {goal}")
    path = [goal]
    while path[-1] != start:
        path.append(prev[path[-1]])
    return path[::-1]


lines_out = {}
served = defaultdict(set)
for line, (color, text, (ends_a, ends_b)) in LINES.items():
    for name in ends_a + ends_b:
        if name not in coords:
            raise SystemExit(f"Endhaltestelle unbekannt: {line} {name}")
    paths = [route(line, a, b) for a in ends_a for b in ends_b]
    for p in paths:
        for name in p:
            served[name].add(line)
    lines_out[line] = {
        "color": color,
        "text": text,
        "color2": SECOND_COLOR.get(line),
        "ends": [ends_a, ends_b],
        "stops": len({n for p in paths for n in p}),
        "paths": paths,
    }


def line_order(line):
    return (line[0] != "U", int(line[1:]))


stations = {}
for name in sorted(served):
    x, y = coords_mean(name)
    stations[name] = {
        "x": sx(x),
        "y": sy(y),
        "bezirk": bezirk_at(x, y),
        "lines": sorted(served[name], key=line_order),
    }
for line, info in lines_out.items():
    info["d"] = "".join("M" + "L".join(f"{stations[n]['x']},{stations[n]['y']}" for n in p) for p in info.pop("paths"))

# ---------- Stadtteile und Viertel ----------

wiki = fetch("stadtteile.wiki").read_text()
table = wiki[wiki.index("== Liste der Stadtteile =="):]
table = table[: table.index("|}")]


def label(link):
    m = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", link)
    return (m.group(2) or m.group(1)).strip()


SKIP = re.compile(r"Siedlung|siedlung|Kolonie|kolonie|Wohnanlage")
places = defaultdict(lambda: {"kind": None, "bezirke": set()})
current = None
for row in table.split("|-")[2:]:
    cells = [c.strip() for c in re.sub(r"^\|\s*", "", row.strip()).split("||")]
    if cells[0].startswith("rowspan") or len(cells) == 4:
        current = label(re.sub(r'rowspan="\d+"\s*\|\s*', "", cells[0]))
        cells = cells[1:]
    nr = re.sub(r"\D", "", cells[1].split("|")[-1]).zfill(2)
    assert nr in bezirke, (current, nr)
    places[current]["kind"] = "Stadtteil"
    places[current]["bezirke"].add(nr)
    for link in re.findall(r"\[\[[^\]]+\]\]", cells[2] if len(cells) > 2 else ""):
        q = label(link)
        if SKIP.search(q) or q in places and places[q]["kind"] == "Stadtteil":
            continue
        places[q]["kind"] = places[q]["kind"] or "Viertel"
        places[q]["bezirke"].add(nr)
places_out = {name: {"kind": p["kind"], "bezirke": sorted(p["bezirke"])} for name, p in sorted(places.items())}

# ---------- Ausgabe ----------

OUT.mkdir(parents=True, exist_ok=True)
header = "// Automatisch erzeugt von tools/build-muenchen.py – nicht von Hand bearbeiten.\n"
(OUT / "map.js").write_text(
    header
    + "// Quelle: Landeshauptstadt München, Geoportal (Datenlizenz Deutschland – Namensnennung 2.0).\n"
    + f"export const VIEWBOX = [0, 0, {WIDTH}, {HEIGHT}];\n"
    + f"export const PARTS = {json.dumps(parts)};\n"
    + f"export const SHAPES = {json.dumps(shapes, ensure_ascii=False)};\n"
)
(OUT / "bezirke.js").write_text(
    header
    + "export const BEZIRKE = "
    + json.dumps([{"code": nr, "name": b["name"]} for nr, b in sorted(bezirke.items())], ensure_ascii=False, indent=1)
    + ";\n"
)
(OUT / "transit.js").write_text(
    header
    + "// Quelle: MVV-Sollfahrplan Gesamtnetz (GTFS, CC BY 4.0); Endhaltestellen redaktionell (Normalbetrieb).\n"
    + f"export const LINES = {json.dumps(lines_out, ensure_ascii=False)};\n"
    + f"export const STATIONS = {json.dumps(stations, ensure_ascii=False)};\n"
)
(OUT / "places.js").write_text(
    header
    + "// Quelle: Wikipedia, „Stadtteile, Quartiere und Siedlungen in München“ (CC BY-SA 4.0).\n"
    + f"export const PLACES = {json.dumps(places_out, ensure_ascii=False, indent=1)};\n"
)
inside = sum(1 for s in stations.values() if s["bezirk"])
print(f"{len(shapes)} Bezirke, {len(lines_out)} Linien, {len(stations)} Haltestellen ({inside} im Stadtgebiet), {len(places_out)} Stadtteile/Viertel")
