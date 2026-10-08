// Erzeugt app/js/data/map.js aus us-atlas (Albers-USA-Projektion, Alaska/Hawaii als Einschub).
// Aufruf: npm run build:map
import { readFileSync, writeFileSync } from 'node:fs';
import { feature, mesh, neighbors } from 'topojson-client';
import { geoPath } from 'd3-geo';
import { STATES } from '../app/js/data/states.js';

const topo = JSON.parse(readFileSync(new URL('../node_modules/us-atlas/states-albers-10m.json', import.meta.url)));
const byFips = Object.fromEntries(STATES.map((s) => [s.fips, s.code]));

const geoms = topo.objects.states.geometries;
const keep = geoms.map((g, i) => (byFips[g.id] ? i : -1)).filter((i) => i >= 0);
const adjacency = neighbors(geoms);
const path = geoPath().digits(1);
const r = (n) => Math.round(n * 10) / 10;

const states = {};
for (const i of keep) {
  const g = geoms[i];
  const f = feature(topo, g);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  const [cx, cy] = path.centroid(f);
  states[byFips[g.id]] = {
    d: path(f),
    bbox: [r(x0), r(y0), r(x1 - x0), r(y1 - y0)],
    center: [r(cx), r(cy)],
    neighbors: adjacency[i].map((j) => byFips[geoms[j].id]).filter(Boolean).sort(),
  };
}

// Außengrenze des Landes für eine etwas kräftigere Kontur.
const outline = path(mesh(topo, topo.objects.nation));

// Kartenausschnitt aus den tatsächlichen Grenzen (Alaska reicht links über 0 hinaus) plus Rand.
const pad = 6;
const [[bx0, by0], [bx1, by1]] = path.bounds(mesh(topo, topo.objects.nation));
const viewBox = [Math.floor(bx0 - pad), Math.floor(by0 - pad), Math.ceil(bx1 - bx0 + 2 * pad), Math.ceil(by1 - by0 + 2 * pad)];

const missing = STATES.filter((s) => !states[s.code]);
if (missing.length) throw new Error('Fehlende Geometrien: ' + missing.map((s) => s.code).join(', '));

const out =
  '// Automatisch erzeugt von tools/build-map.mjs – nicht von Hand bearbeiten.\n' +
  '// Quelle: us-atlas (Natural Earth / US Census, gemeinfrei), Albers-USA-Projektion.\n' +
  `export const VIEWBOX = ${JSON.stringify(viewBox)};\n` +
  `export const OUTLINE = ${JSON.stringify(outline)};\n` +
  `export const SHAPES = ${JSON.stringify(states)};\n`;

writeFileSync(new URL('../app/js/data/map.js', import.meta.url), out);
console.log(`map.js geschrieben: ${Object.keys(states).length} Staaten, ${(out.length / 1024).toFixed(0)} KB`);
