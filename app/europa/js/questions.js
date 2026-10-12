// Auswahl der Fragen (gewichtet nach bisherigen Fehlern) und der Antwortmöglichkeiten.
import { COUNTRIES, SIMILAR_FLAGS } from './data/countries.js';
import { SHAPES } from './data/map.js';

const CODES = COUNTRIES.map((c) => c.code);

// Gewicht eines Landes: häufig falsch beantwortete und neue Länder kommen öfter dran.
export function weightFor(stat) {
  if (!stat || stat.seen === 0) return 2;
  const errorRate = (stat.seen - stat.correct) / stat.seen;
  const recentMiss = stat.streak === 0 ? 1.5 : 0;
  const mastered = stat.streak >= 3 ? -0.5 : 0;
  return Math.max(0.5, 1 + 4 * errorRate + recentMiss + mastered);
}

// Zieht `count` verschiedene Länder, gewichtet ohne Zurücklegen (bei mehr Fragen als Ländern wird neu gemischt).
export function pickRound(count, stats = {}, random = Math.random) {
  const result = [];
  while (result.length < count) {
    const pool = CODES.map((code) => ({ code, w: weightFor(stats[code]) }));
    const take = Math.min(count - result.length, pool.length);
    for (let n = 0; n < take; n++) {
      const total = pool.reduce((sum, p) => sum + p.w, 0);
      let x = random() * total;
      let i = 0;
      while (x > pool[i].w && i < pool.length - 1) x -= pool[i++].w;
      result.push(pool[i].code);
      pool.splice(i, 1);
    }
  }
  return result;
}

export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Verwechslungskandidaten: bei Flaggen ähnlich aussehende Flaggen, sonst Nachbarländer.
function lookalikes(code, kind) {
  if (kind !== 'flags') return SHAPES[code].neighbors;
  const similar = new Set(SIMILAR_FLAGS.filter((g) => g.includes(code)).flat());
  similar.delete(code);
  return [...similar];
}

// Antwortmöglichkeiten: richtige Antwort, höchstens zwei Verwechslungskandidaten, Rest zufällig.
export function choicesFor(code, kind = 'names', n = 4, random = Math.random) {
  const near = shuffle(lookalikes(code, kind), random);
  const others = shuffle(CODES.filter((c) => c !== code && !near.includes(c)), random);
  const distractors = [...near.slice(0, 2), ...others].slice(0, n - 1);
  return shuffle([code, ...distractors], random);
}
