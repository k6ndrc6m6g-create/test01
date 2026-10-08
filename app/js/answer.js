// Abgleich von Texteingaben mit Staatennamen – tolerant gegenüber Schreibweise und kleinen Tippfehlern.
import { STATES } from './data/states.js';

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

// Kurze Namen (Ohio, Iowa, Utah) liegen zu nah beieinander, um Tippfehler zu erlauben.
function tolerance(length) {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

const SPELLINGS = STATES.map((s) => ({
  code: s.code,
  forms: [s.name, ...(s.aliases || [])].map(normalize),
}));

function distanceTo(input, code) {
  const forms = SPELLINGS.find((s) => s.code === code).forms;
  return Math.min(...forms.map((f) => levenshtein(input, f)));
}

// Ergebnis: 'exact' | 'close' (Tippfehler toleriert) | 'wrong'
export function checkAnswer(text, code) {
  const input = normalize(text);
  if (!input) return 'wrong';
  const target = distanceTo(input, code);
  if (target === 0) return 'exact';

  // Wer exakt einen anderen Staat schreibt oder einem anderen näher ist, liegt falsch.
  for (const s of SPELLINGS) {
    if (s.code !== code && distanceTo(input, s.code) <= target) return 'wrong';
  }
  const len = Math.min(...SPELLINGS.find((s) => s.code === code).forms.map((f) => f.length));
  return target <= tolerance(len) ? 'close' : 'wrong';
}
