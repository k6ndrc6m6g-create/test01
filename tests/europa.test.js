import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { checkAnswer } from '../app/europa/js/answer.js';
import { pickRound, choicesFor } from '../app/europa/js/questions.js';
import { COUNTRIES, SIMILAR_FLAGS } from '../app/europa/js/data/countries.js';
import { SHAPES } from '../app/europa/js/data/map.js';

const sw = readFileSync(new URL('../app/europa/sw.js', import.meta.url), 'utf8');

test('Kartendaten und Flagge für jedes Land vorhanden', () => {
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  for (const c of COUNTRIES) {
    assert.ok(SHAPES[c.code]?.d, c.name);
    assert.ok(existsSync(new URL(`../app/europa/flags/${c.code}.svg`, import.meta.url)), `Flagge ${c.code}`);
    assert.ok(sw.includes(` ${c.code} `) || sw.includes(`'${c.code} `) || sw.includes(` ${c.code}'`), `Service Worker: ${c.code}`);
  }
  for (const group of SIMILAR_FLAGS) for (const code of group) assert.ok(SHAPES[code], `Flaggengruppe: ${code}`);
});

test('Nachbarschaften stimmen', () => {
  assert.deepEqual(SHAPES.at.neighbors, ['ch', 'cz', 'de', 'hu', 'it', 'li', 'si', 'sk']);
  assert.ok(SHAPES.xk.neighbors.includes('rs'));
  assert.deepEqual(SHAPES.is.neighbors, []);
});

test('deutsche Namen, Umlaute und Alternativen', () => {
  assert.equal(checkAnswer('Österreich', 'at'), 'exact');
  assert.equal(checkAnswer('osterreich', 'at'), 'exact');
  assert.equal(checkAnswer('Oesterreich', 'at'), 'exact');
  assert.equal(checkAnswer('Weissrussland', 'by'), 'exact');
  assert.equal(checkAnswer('Holland', 'nl'), 'exact');
  assert.equal(checkAnswer('Grossbritannien', 'gb'), 'exact');
  assert.equal(checkAnswer('bosnien', 'ba'), 'exact');
});

test('Tippfehler toleriert, ähnliche Länder nicht verwechselt', () => {
  assert.equal(checkAnswer('Deutchland', 'de'), 'close');
  assert.equal(checkAnswer('Griechenlnd', 'gr'), 'close');
  assert.equal(checkAnswer('Irland', 'is'), 'wrong');
  assert.equal(checkAnswer('Island', 'ie'), 'wrong');
  assert.equal(checkAnswer('Slowenien', 'sk'), 'wrong');
  assert.equal(checkAnswer('Slowakei', 'si'), 'wrong');
  assert.equal(checkAnswer('Malta', 'mt'), 'exact');
});

test('Runden ohne Doppelungen', () => {
  const round = pickRound(COUNTRIES.length);
  assert.equal(new Set(round).size, COUNTRIES.length);
});

test('Antwortauswahl für Namen und Flaggen', () => {
  for (const c of COUNTRIES) {
    for (const kind of ['names', 'flags']) {
      const options = choicesFor(c.code, kind);
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.ok(options.includes(c.code));
    }
  }
  // Flaggenmodus bietet bevorzugt ähnliche Flaggen an.
  let similar = 0;
  for (let i = 0; i < 200; i++) if (choicesFor('ro', 'flags').some((c) => ['md', 'ad', 'be'].includes(c))) similar++;
  assert.equal(similar, 200);
});
