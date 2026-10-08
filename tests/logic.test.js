import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, normalize } from '../app/js/answer.js';
import { pickRound, choicesFor } from '../app/js/questions.js';
import { STATES } from '../app/js/data/states.js';
import { SHAPES } from '../app/js/data/map.js';

test('Kartendaten für alle 50 Staaten vorhanden', () => {
  assert.equal(STATES.length, 50);
  for (const s of STATES) assert.ok(SHAPES[s.code]?.d, s.code);
});

test('normalize ignoriert Groß-/Kleinschreibung, Leerzeichen, Akzente', () => {
  assert.equal(normalize('  New-York '), 'newyork');
  assert.equal(normalize('Süd-Dakota'), 'suddakota');
});

test('exakte Antworten und deutsche Namen', () => {
  assert.equal(checkAnswer('texas', 'TX'), 'exact');
  assert.equal(checkAnswer('north carolina', 'NC'), 'exact');
  assert.equal(checkAnswer('Kalifornien', 'CA'), 'exact');
  assert.equal(checkAnswer('Nord-Dakota', 'ND'), 'exact');
  assert.equal(checkAnswer('Süd Karolina', 'SC'), 'exact');
});

test('kleine Tippfehler werden toleriert', () => {
  assert.equal(checkAnswer('Masachusetts', 'MA'), 'close');
  assert.equal(checkAnswer('Missisippi', 'MS'), 'close');
  assert.equal(checkAnswer('Conneticut', 'CT'), 'close');
  assert.equal(checkAnswer('Nevda', 'NV'), 'close');
});

test('andere Staaten und kurze Namen werden nicht verwechselt', () => {
  assert.equal(checkAnswer('Arkansas', 'KS'), 'wrong');
  assert.equal(checkAnswer('Virginia', 'WV'), 'wrong');
  assert.equal(checkAnswer('Ohio', 'IA'), 'wrong');
  assert.equal(checkAnswer('Iowe', 'IA'), 'wrong');
  assert.equal(checkAnswer('', 'TX'), 'wrong');
  assert.equal(checkAnswer('Dakota', 'ND'), 'wrong');
});

test('Runden ohne Doppelungen, gewichtete Auswahl bevorzugt Fehler', () => {
  const round = pickRound(50);
  assert.equal(new Set(round).size, 50);
  const stats = { TX: { seen: 10, correct: 0, streak: 0 } };
  let hits = 0;
  for (let i = 0; i < 400; i++) if (pickRound(5, stats).includes('TX')) hits++;
  assert.ok(hits > 400 * 0.25, `TX zu selten: ${hits}`);
});

test('Antwortauswahl: 4 verschiedene inkl. richtiger Antwort', () => {
  for (const s of STATES) {
    const c = choicesFor(s.code);
    assert.equal(c.length, 4);
    assert.equal(new Set(c).size, 4);
    assert.ok(c.includes(s.code));
  }
});
