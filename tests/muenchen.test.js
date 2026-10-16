import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkAnswer } from '../app/muenchen/js/answer.js';
import { pickRound, choices } from '../app/muenchen/js/questions.js';
import { BEZIRKE } from '../app/muenchen/js/data/bezirke.js';
import { SHAPES } from '../app/muenchen/js/data/map.js';
import { LINES, STATIONS } from '../app/muenchen/js/data/transit.js';
import { PLACES } from '../app/muenchen/js/data/places.js';

const sw = readFileSync(new URL('../app/muenchen/sw.js', import.meta.url), 'utf8');

test('25 Stadtbezirke mit Geometrie und symmetrischer Nachbarschaft', () => {
  assert.equal(BEZIRKE.length, 25);
  for (const b of BEZIRKE) {
    assert.ok(SHAPES[b.code]?.d, b.name);
    assert.ok(SHAPES[b.code].neighbors.length >= 2, `${b.name} hat Nachbarn`);
    for (const n of SHAPES[b.code].neighbors) assert.ok(SHAPES[n].neighbors.includes(b.code), `${b.name} ↔ ${n}`);
  }
  const name = (code) => BEZIRKE.find((b) => b.code === code).name;
  assert.ok(SHAPES['01'].neighbors.map(name).includes('Maxvorstadt'));
});

test('Linien: Endhaltestellen (Normalbetrieb, äußere Enden)', () => {
  const ends = (l) => LINES[l].ends.map((e) => e.join('/')).join(' – ');
  assert.equal(ends('U7'), 'Olympia-Einkaufszentrum – Neuperlach Zentrum');
  assert.equal(ends('S1'), 'Freising/Flughafen München – Leuchtenbergring');
  assert.equal(ends('S4'), 'Geltendorf – Ebersberg');
  assert.equal(ends('S5'), 'Weßling – Kreuzstraße');
  for (const l of Object.values(LINES)) for (const n of l.ends.flat()) assert.ok(STATIONS[n], n);
});

test('Haltestellen: Linien und Stadtbezirke stimmen mit dem Netz überein', () => {
  const lines = (n) => STATIONS[n].lines.join(' ');
  assert.equal(lines('Sendlinger Tor'), 'U1 U2 U3 U6 U7 U8');
  assert.equal(lines('Marienplatz'), 'U3 U6 S1 S2 S3 S4 S5 S6 S8');
  assert.equal(lines('Odeonsplatz'), 'U3 U4 U5 U6');
  assert.equal(lines('Laim'), 'S1 S2 S3 S4 S5 S6 S8');
  assert.equal(lines('Donnersbergerbrücke'), 'S1 S2 S3 S4 S5 S6 S7 S8');
  const bez = (n) => BEZIRKE.find((b) => b.code === STATIONS[n].bezirk).name;
  assert.equal(bez('Marienplatz'), 'Altstadt-Lehel');
  assert.equal(bez('Münchner Freiheit'), 'Schwabing-Freimann');
  assert.equal(bez('Pasing'), 'Pasing-Obermenzing');
  assert.equal(STATIONS['Freising'].bezirk, null);
});

test('Stadtteile und Viertel verweisen auf gültige Bezirke', () => {
  assert.ok(Object.keys(PLACES).length > 100);
  for (const [name, p] of Object.entries(PLACES)) for (const b of p.bezirke) assert.ok(SHAPES[b], `${name}: ${b}`);
  assert.deepEqual(PLACES.Haidhausen.bezirke, ['05']);
  assert.equal(PLACES.Giesing.bezirke.length, 2);
});

test('Service Worker enthält alle Datendateien', () => {
  for (const f of ['bezirke', 'map', 'places', 'transit']) assert.ok(sw.includes(`js/data/${f}.js`), f);
});

test('Texteingabe: Tippfehler bei langen Namen, keine Verwechslung ähnlicher Bezirke', () => {
  assert.equal(checkAnswer('Maxvorstadt', '03'), 'exact');
  assert.equal(checkAnswer('Thalkirchen Obersendling Forstenried Fürstenried Soln', '19'), 'close');
  assert.equal(checkAnswer('Sendling', '07'), 'wrong');
  assert.equal(checkAnswer('Sendling-Westpark', '06'), 'wrong');
  assert.equal(checkAnswer('Schwabing West', '04'), 'exact');
});

test('Antwortauswahl: vier Optionen, genau eine richtig', () => {
  for (let i = 0; i < 200; i++) {
    const opts = choices(['13', '05'], ['01', '14', '16'], BEZIRKE.map((b) => b.code));
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4);
    assert.equal(opts.filter((o) => ['13', '05'].includes(o)).length, 1);
  }
  assert.equal(new Set(pickRound(Object.keys(STATIONS), 50)).size, 50);
});
