// Erzeugt app/europa/js/data/map.js aus world-atlas (Natural Earth 1:50 Mio.)
// und kopiert die benötigten Flaggen aus flag-icons nach app/europa/flags/.
// Aufruf: npm run build:europe
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { feature, merge, neighbors } from 'topojson-client';
import { geoPath, geoAzimuthalEqualArea } from 'd3-geo';
import { COUNTRIES } from '../app/europa/js/data/countries.js';

const root = new URL('../', import.meta.url);
const topo = JSON.parse(readFileSync(new URL('node_modules/world-atlas/countries-50m.json', root)));
const geoms = topo.objects.countries.geometries;
const byAtlas = Object.fromEntries(COUNTRIES.map((c) => [c.atlas, c.code]));

// Lambert-flächentreue Azimutalprojektion mit Mittelpunkt in Mitteleuropa (wie die amtliche EU-Karte ETRS89-LAEA).
const WIDTH = 1000;
const HEIGHT = 860;
const corners = [];
for (let lon = -24; lon <= 42; lon += 2) corners.push([lon, 34], [lon, 71.5]);
for (let lat = 34; lat <= 71.5; lat += 2) corners.push([-24, lat], [42, lat]);
// Der Rahmen wird leicht überzogen und dann beschnitten, damit Russland, die Türkei und Nordafrika nur angeschnitten werden.
const projection = geoAzimuthalEqualArea()
  .rotate([-10, -52])
  .fitExtent([[-40, -20], [WIDTH + 40, HEIGHT + 40]], { type: 'MultiPoint', coordinates: corners })
  .clipExtent([[0, 0], [WIDTH, HEIGHT]]);
const path = geoPath(projection).digits(1);
const r = (n) => Math.round(n * 10) / 10;

const adjacency = neighbors(geoms);
const indexOf = (name) => geoms.findIndex((g) => g.properties.name === name);

const shapes = {};
for (const c of COUNTRIES) {
  const i = indexOf(c.atlas);
  if (i < 0) throw new Error('Nicht im Atlas: ' + c.atlas);
  // Nordzypern gehört völkerrechtlich zu Zypern.
  const geo = c.code === 'cy' ? merge(topo, [geoms[i], geoms[indexOf('N. Cyprus')]]) : feature(topo, geoms[i]);
  const d = path(geo);
  if (!d) throw new Error('Außerhalb des Kartenausschnitts: ' + c.name);
  const [[x0, y0], [x1, y1]] = path.bounds(geo);
  // Für Länder, die nur teilweise im Bild sind (Russland, Türkei), den sichtbaren Teil als Mittelpunkt nehmen.
  const [cx, cy] = path.centroid(geo);
  const center = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 ? [cx, cy] : [(x0 + x1) / 2, (y0 + y1) / 2];
  shapes[c.code] = {
    d,
    bbox: [r(x0), r(y0), r(x1 - x0), r(y1 - y0)],
    center: center.map(r),
    neighbors: adjacency[i].map((j) => byAtlas[geoms[j].properties.name]).filter(Boolean).sort(),
  };
}

// Nicht abgefragte Nachbarregionen (Nordafrika, Naher Osten, Kaukasus …) als dezente Kulisse.
const inQuiz = new Set([...COUNTRIES.map((c) => c.atlas), 'N. Cyprus']);
const context = geoms
  .filter((g) => !inQuiz.has(g.properties.name))
  .map((g) => path(feature(topo, g)))
  .filter(Boolean)
  .join('');

const out =
  '// Automatisch erzeugt von tools/build-europe-map.mjs – nicht von Hand bearbeiten.\n' +
  '// Quelle: world-atlas (Natural Earth, gemeinfrei), Lambert-Azimutalprojektion.\n' +
  `export const VIEWBOX = [0, 0, ${WIDTH}, ${HEIGHT}];\n` +
  `export const CONTEXT = ${JSON.stringify(context)};\n` +
  `export const SHAPES = ${JSON.stringify(shapes)};\n`;
writeFileSync(new URL('app/europa/js/data/map.js', root), out);

const flagDir = new URL('app/europa/flags/', root);
mkdirSync(flagDir, { recursive: true });
for (const c of COUNTRIES) {
  copyFileSync(new URL(`node_modules/flag-icons/flags/4x3/${c.code}.svg`, root), new URL(`${c.code}.svg`, flagDir));
}
console.log(`map.js geschrieben: ${COUNTRIES.length} Länder, ${(out.length / 1024).toFixed(0)} KB; ${COUNTRIES.length} Flaggen kopiert`);
