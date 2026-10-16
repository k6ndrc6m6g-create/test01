// Fragenauswahl (gewichtet nach bisherigen Fehlern) und Antwortmöglichkeiten.

// Gewicht einer Frage: häufig falsch beantwortete und neue Fragen kommen öfter dran.
export function weightFor(stat) {
  if (!stat || stat.seen === 0) return 2;
  const errorRate = (stat.seen - stat.correct) / stat.seen;
  const recentMiss = stat.streak === 0 ? 1.5 : 0;
  const mastered = stat.streak >= 3 ? -0.5 : 0;
  return Math.max(0.5, 1 + 4 * errorRate + recentMiss + mastered);
}

// Zieht `count` verschiedene Einträge aus `pool`, gewichtet ohne Zurücklegen (bei Bedarf wird neu gemischt).
export function pickRound(pool, count, stats = {}, random = Math.random) {
  const result = [];
  while (result.length < count) {
    const bag = pool.map((id) => ({ id, w: weightFor(stats[id]) }));
    const take = Math.min(count - result.length, bag.length);
    for (let n = 0; n < take; n++) {
      const total = bag.reduce((sum, p) => sum + p.w, 0);
      let x = random() * total;
      let i = 0;
      while (x > bag[i].w && i < bag.length - 1) x -= bag[i++].w;
      result.push(bag[i].id);
      bag.splice(i, 1);
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

// Vier Antwortmöglichkeiten: genau eine aus `correct`, bis zu zwei aus `near` (verwechselbar), Rest aus `all`.
export function choices(correct, near, all, n = 4, random = Math.random) {
  const right = shuffle(correct, random)[0];
  const wrongNear = shuffle(near.filter((x) => !correct.includes(x)), random).slice(0, 2);
  const rest = shuffle(all.filter((x) => !correct.includes(x) && !wrongNear.includes(x)), random);
  return shuffle([right, ...wrongNear, ...rest].slice(0, n), random);
}
