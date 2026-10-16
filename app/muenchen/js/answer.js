// Abgleich von Texteingaben mit Bezirksnamen – tolerant gegenüber Schreibweise und kleinen Tippfehlern.
import { BEZIRKE } from './data/bezirke.js';

export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Bei langen Namen („Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln“) sind mehr Tippfehler erlaubt.
function tolerance(length) {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  if (length <= 20) return 2;
  return 3;
}

const SPELLINGS = BEZIRKE.map((b) => ({ code: b.code, form: normalize(b.name) }));

// Ergebnis: 'exact' | 'close' (Tippfehler toleriert) | 'wrong'
export function checkAnswer(text, code) {
  const input = normalize(text);
  if (!input) return 'wrong';
  const target = SPELLINGS.find((s) => s.code === code).form;
  const d = levenshtein(input, target);
  if (d === 0) return 'exact';
  // Wer einem anderen Bezirk mindestens genauso nah ist (z. B. Sendling vs. Sendling-Westpark), liegt falsch.
  for (const s of SPELLINGS) {
    if (s.code !== code && levenshtein(input, s.form) <= d) return 'wrong';
  }
  return d <= tolerance(target.length) ? 'close' : 'wrong';
}
