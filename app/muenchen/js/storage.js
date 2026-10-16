// Lokale Speicherung von Einstellungen, Lernstand und Bestwerten (nur auf diesem Gerät).
const KEY = 'muenchen.v1';

const DEFAULTS = () => ({
  settings: { roundLength: 10, haptics: true },
  // Pro Lernbereich und Frage: { seen, correct, streak }
  stats: { bezirke: {}, places: {}, stations: {}, termini: {}, terminusLine: {}, linesAt: {} },
  best: {},
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const data = JSON.parse(raw);
    const d = DEFAULTS();
    return {
      settings: { ...d.settings, ...data.settings },
      stats: { ...d.stats, ...data.stats },
      best: { ...data.best },
    };
  } catch {
    return DEFAULTS();
  }
}

export function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Privater Modus o. Ä. – die App funktioniert weiter, merkt sich aber nichts.
  }
}

export function record(store, area, code, correct) {
  const s = (store.stats[area][code] ||= { seen: 0, correct: 0, streak: 0 });
  s.seen++;
  if (correct) {
    s.correct++;
    s.streak++;
  } else {
    s.streak = 0;
  }
  save(store);
}

export function resetProgress(store) {
  const d = DEFAULTS();
  store.stats = d.stats;
  store.best = d.best;
  save(store);
}

// Eine Frage gilt als „sicher“, wenn er zuletzt mindestens zweimal in Folge richtig war.
export function mastery(stat) {
  if (!stat || stat.seen === 0) return 'new';
  if (stat.streak >= 2) return 'good';
  if (stat.correct / stat.seen >= 0.5) return 'mid';
  return 'weak';
}
