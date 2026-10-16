import { BEZIRKE } from './data/bezirke.js';
import { SHAPES } from './data/map.js';
import { LINES, STATIONS } from './data/transit.js';
import { PLACES } from './data/places.js';
import { MunichMap } from './map.js';
import { checkAnswer } from './answer.js';
import { pickRound, choices, shuffle } from './questions.js';
import { load, save, record, resetProgress, mastery } from './storage.js';
import { haptic, setHaptics } from './haptics.js';

const store = load();
setHaptics(store.settings.haptics);
const app = document.getElementById('app');

// ---------- Daten ----------

const BEZ = Object.fromEntries(BEZIRKE.map((b) => [b.code, b]));
const BEZ_CODES = BEZIRKE.map((b) => b.code);
const LINE_CODES = Object.keys(LINES);
const CITY_STATIONS = Object.keys(STATIONS).filter((n) => STATIONS[n].bezirk);
const PLACE_NAMES = Object.keys(PLACES);
// Endhaltestellen → Linien, die dort enden (z. B. Ebersberg: S4 und S6).
const TERMINI = {};
for (const [code, line] of Object.entries(LINES)) {
  for (const name of line.ends.flat()) (TERMINI[name] ||= []).push(code);
}
const TERMINUS_NAMES = Object.keys(TERMINI).sort((a, b) => a.localeCompare(b, 'de'));

const bezName = (code) => BEZ[code].name;
const endsText = (code) => LINES[code].ends.map((e) => e.join(' / ')).join(' – ');
const sameMode = (code) => LINE_CODES.filter((c) => c[0] === code[0]);

// ---------- Spielmodi ----------
// kind: bezirk (markierter Bezirk benennen), find (Bezirk antippen), place, station, stationFind, termini, terminusLine, linesAt
// area: Lernbereich für Statistik und Gewichtung; pool: mögliche Fragen.

const MODES = {
  bezMc: {
    group: 'Stadtbezirke', eyebrow: 'Stufe 1', title: 'Auswahl', kind: 'bezirk', input: 'choice', area: 'bezirke', pool: BEZ_CODES,
    desc: 'Ein Stadtbezirk ist markiert – wähle den richtigen Namen aus vier.',
  },
  bezText: {
    group: 'Stadtbezirke', eyebrow: 'Stufe 2', title: 'Eingabe', kind: 'bezirk', input: 'text', area: 'bezirke', pool: BEZ_CODES,
    desc: 'Ein Stadtbezirk ist markiert – schreibe seinen Namen.',
  },
  bezFind: {
    group: 'Stadtbezirke', eyebrow: 'Umgekehrt', title: 'Auf der Karte finden', kind: 'find', input: 'map', area: 'bezirke', pool: BEZ_CODES,
    desc: 'Der Name ist vorgegeben – tippe den Stadtbezirk auf der Karte an.',
  },
  bezTime: {
    group: 'Stadtbezirke', eyebrow: '60 Sekunden', title: 'Gegen die Uhr', kind: 'bezirk', input: 'choice', area: 'bezirke', pool: BEZ_CODES, seconds: 60,
    desc: 'So viele Stadtbezirke wie möglich in einer Minute.',
  },
  places: {
    group: 'Stadtteile & Viertel', eyebrow: 'Zuordnen', title: 'Stadtteile & Viertel', kind: 'place', input: 'choice', area: 'places', pool: PLACE_NAMES,
    desc: 'Haidhausen, Werksviertel, Borstei … – in welchem Stadtbezirk liegt es?',
  },
  stationBez: {
    group: 'S- und U-Bahn', eyebrow: 'Haltestellen', title: 'Haltestelle → Stadtbezirk', kind: 'station', input: 'choice', area: 'stations', pool: CITY_STATIONS,
    desc: 'In welchem Stadtbezirk liegt die Haltestelle? Vier zur Wahl.',
  },
  stationFind: {
    group: 'S- und U-Bahn', eyebrow: 'Haltestellen', title: 'Haltestelle auf der Karte', kind: 'stationFind', input: 'map', area: 'stations', pool: CITY_STATIONS,
    desc: 'Tippe den Stadtbezirk an, in dem die Haltestelle liegt.',
  },
  termini: {
    group: 'S- und U-Bahn', eyebrow: 'Linien', title: 'Endhaltestellen', kind: 'termini', input: 'choice', area: 'termini', pool: LINE_CODES,
    desc: 'Eine Linie wird gezeigt – wähle ihre Endhaltestellen.',
  },
  terminusLine: {
    group: 'S- und U-Bahn', eyebrow: 'Linien', title: 'Endhaltestelle → Linie', kind: 'terminusLine', input: 'choice', area: 'terminusLine', pool: TERMINUS_NAMES,
    desc: 'Welche Linie endet an dieser Haltestelle?',
  },
  linesAt: {
    group: 'Experte', eyebrow: 'Experte', title: 'Welche Linien halten hier?', kind: 'linesAt', input: 'multi', area: 'linesAt', pool: CITY_STATIONS,
    desc: 'Wähle alle S- und U-Bahn-Linien, die an der Haltestelle halten.',
  },
};

const AREA_LABEL = {
  bezirke: 'Stadtbezirke', places: 'Stadtteile & Viertel', stations: 'Haltestellen',
  termini: 'Endhaltestellen', terminusLine: 'Endhaltestelle → Linie', linesAt: 'Linien je Haltestelle',
};
const AREA_POOL = {
  bezirke: BEZ_CODES, places: PLACE_NAMES, stations: CITY_STATIONS,
  termini: LINE_CODES, terminusLine: TERMINUS_NAMES, linesAt: CITY_STATIONS,
};

// ---------- Hilfen ----------

// h('button.btn.primary', { onclick }, 'Text', child …)
function h(spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}

// Liniensignal: U-Bahn eckig, S-Bahn abgerundet; U7/U8 zweifarbig.
function badge(code, size = '') {
  const l = LINES[code];
  const bg = l.color2 ? `linear-gradient(135deg, ${l.color} 50%, ${l.color2} 50%)` : l.color;
  return h(`span.line-badge.is-${code[0].toLowerCase()}${size ? '.' + size : ''}`, { style: `background:${bg};color:${l.text}`, 'aria-label': `Linie ${code}` }, code);
}

function badges(codes, size = '') {
  return h('span.badges', {}, codes.map((c) => badge(c, size)));
}

let cleanup = null;
function mount(screen, onLeave = null) {
  cleanup?.();
  cleanup = onLeave;
  app.replaceChildren(screen);
  window.scrollTo(0, 0);
}

function topBar(title, right = null) {
  return h('header.topbar', {},
    h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zur Übersicht', onclick: showHome }, backIcon()),
    h('div.topbar-title', { text: title }),
    h('div.topbar-right', {}, right),
  );
}

function backIcon() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  return s;
}

function roundLength(pool) {
  const n = store.settings.roundLength;
  return n === 'all' ? pool.length : Math.min(n, pool.length);
}

// ---------- Startseite ----------

function showHome() {
  const heroMap = new MunichMap({ lines: true, label: 'Karte von München mit S- und U-Bahn-Netz' });
  const known = BEZ_CODES.filter((c) => mastery(store.stats.bezirke[c]) === 'good').length;
  for (const c of BEZ_CODES) if (mastery(store.stats.bezirke[c]) === 'good') heroMap.setState(c, 'is-known');

  if (![10, 20, 'all'].includes(store.settings.roundLength)) store.settings.roundLength = 10;
  const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Fragen pro Runde' },
    [10, 20, 'all'].map((n) => h('button.seg-btn', {
      type: 'button', role: 'radio',
      'aria-checked': String(store.settings.roundLength === n),
      onclick: (e) => {
        store.settings.roundLength = n;
        save(store);
        for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      },
    }, n === 'all' ? 'Alle' : String(n))),
  );

  const groups = {};
  for (const [id, m] of Object.entries(MODES)) {
    (groups[m.group] ||= []).push(h('button.mode', { type: 'button', onclick: () => startGame(id) },
      h('span.mode-eyebrow', { text: m.eyebrow }),
      h('span.mode-title', { text: m.title }),
      h('span.mode-desc', { text: m.desc }),
      id === 'bezTime' && store.best.time ? h('span.mode-meta', { text: `Rekord: ${store.best.time}` }) : null,
    ));
  }

  mount(h('main.screen.home', {},
    h('header.hero', {},
      h('p.eyebrow', { text: 'Die Stadt spielerisch lernen' }),
      h('h1.display', { text: 'München' }),
      h('div.hero-map', {}, heroMap.root),
      h('p.hero-progress', {}, h('strong', { text: String(known) }), ' von 25 Stadtbezirken sicher erkannt'),
    ),
    Object.entries(groups).map(([title, cards]) => h('section.section', {},
      h('h2.section-title', { text: title }),
      h('div.modes', {}, cards),
    )),
    h('section.section', {},
      h('h2.section-title', { text: 'Fragen pro Runde' }),
      seg,
    ),
    h('nav.links', {},
      h('button.link-row', { type: 'button', onclick: showExplore },
        h('span', { text: 'Karte erkunden' }), h('span.chev', { text: '›' })),
      h('button.link-row', { type: 'button', onclick: showStats },
        h('span', { text: 'Lernstand' }), h('span.chev', { text: '›' })),
      h('label.link-row', {},
        h('span', { text: 'Haptisches Feedback' }),
        h('input.switch', {
          type: 'checkbox', switch: true, checked: store.settings.haptics,
          onchange: (e) => {
            store.settings.haptics = e.currentTarget.checked;
            setHaptics(store.settings.haptics);
            save(store);
          },
        }),
      ),
    ),
    h('p.credits', {},
      'Daten: Landeshauptstadt München (Geoportal, dl-de/by-2-0), MVV-Sollfahrplan (CC BY 4.0), Wikipedia (CC BY-SA 4.0).'),
  ));
}

// ---------- Fragen ----------

// Baut die Frage für einen Eintrag: Text, richtige Antworten, Antwortmöglichkeiten und Karte vor/nach der Antwort.
function makeQuestion(mode, id) {
  switch (mode.kind) {
    case 'bezirk':
      return {
        eyebrow: mode.eyebrow,
        title: mode.input === 'text' ? 'Wie heißt dieser Stadtbezirk?' : 'Welcher Stadtbezirk ist markiert?',
        correct: [id],
        options: () => choices([id], SHAPES[id].neighbors, BEZ_CODES),
        label: bezName,
        before: (map) => { map.setState(id, 'is-target'); map.focus(id); },
        after: (map, ok) => { map.setState(id, ok ? 'is-right' : 'is-target'); if (!ok) map.showLabel(id, bezName(id)); },
        solution: bezName(id),
      };
    case 'find':
      return {
        eyebrow: 'Wo liegt …', title: bezName(id), correct: [id],
        before: (map) => map.reset(),
        after: (map) => { map.setState(id, 'is-right'); map.showLabel(id, bezName(id)); map.focus(id); },
        solution: bezName(id),
      };
    case 'place': {
      const p = PLACES[id];
      return {
        eyebrow: `${p.kind} · In welchem Stadtbezirk liegt …`, title: id, correct: p.bezirke,
        options: () => choices(p.bezirke, p.bezirke.flatMap((b) => SHAPES[b].neighbors), BEZ_CODES),
        label: bezName,
        before: (map) => map.reset(),
        after: (map) => { for (const b of p.bezirke) { map.setState(b, 'is-right'); map.showLabel(b, bezName(b)); } },
        solution: p.bezirke.map(bezName).join(' oder '),
      };
    }
    case 'station':
    case 'stationFind': {
      const s = STATIONS[id];
      return {
        eyebrow: 'In welchem Stadtbezirk liegt die Haltestelle …', title: id, sub: badges(s.lines, 'is-small'), correct: [s.bezirk],
        options: () => choices([s.bezirk], SHAPES[s.bezirk].neighbors, BEZ_CODES),
        label: bezName,
        before: (map) => { map.reset(); map.showLines(true); },
        after: (map) => { map.setState(s.bezirk, 'is-right'); map.showLabel(s.bezirk, bezName(s.bezirk)); map.markStation(id); },
        solution: bezName(s.bezirk),
      };
    }
    case 'termini':
      return {
        eyebrow: 'Endhaltestellen der Linie', title: badge(id, 'is-large'), correct: [id],
        options: () => choices([id], sameMode(id), LINE_CODES),
        label: endsText,
        before: (map) => { map.reset(); map.showLines(true); map.highlightLines([]); },
        after: (map) => map.highlightLines([id]),
        solution: endsText(id),
      };
    case 'terminusLine':
      return {
        eyebrow: 'Welche Linie endet in …', title: id, correct: TERMINI[id],
        options: () => choices(TERMINI[id], sameMode(TERMINI[id][0]), LINE_CODES),
        label: (c) => badge(c),
        before: (map) => { map.reset(); map.showLines(true); map.highlightLines([]); },
        after: (map) => map.highlightLines(TERMINI[id]),
        solution: TERMINI[id].join(' oder '),
      };
    case 'linesAt': {
      const s = STATIONS[id];
      return {
        eyebrow: 'Welche Linien halten an …', title: id, correct: s.lines,
        before: (map) => { map.reset(); map.showLines(false); map.markStation(id, false); },
        after: (map) => { map.showLines(true); map.highlightLines(s.lines); map.markStation(id); },
        solution: s.lines.join(', '),
      };
    }
    default:
      throw new Error('Unbekannter Modus ' + mode.kind);
  }
}

// ---------- Spiel ----------

function startGame(modeId, presetIds = null) {
  const mode = MODES[modeId];
  const timed = Boolean(mode.seconds);
  const stats = store.stats[mode.area];
  const queue = presetIds ? shuffle(presetIds) : pickRound(mode.pool, timed ? mode.pool.length : roundLength(mode.pool), stats);
  const total = timed ? null : queue.length;

  let index = -1;
  let score = 0;
  let current = null;
  let q = null;
  let locked = true;
  let advanceTimer = null;
  let clock = null;
  const missed = [];

  const map = new MunichMap({
    interactive: mode.input === 'map',
    onTap: (code) => answerMap(code),
  });

  const counter = h('span.counter');
  const bar = h('div.progress-fill');
  const header = topBar(mode.title, counter);

  const eyebrow = h('p.prompt-eyebrow');
  const question = h('h2.prompt-title');
  const sub = h('div.prompt-sub');
  const feedback = h('p.feedback', { 'aria-live': 'polite' });
  const nextBtn = h('button.btn.primary.next', { type: 'button', hidden: true, onclick: () => next() }, 'Weiter');

  const answers = h('div.answers');
  let input = null;
  let checkBtn = null;
  if (mode.input === 'text') {
    input = h('input.text-input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'words', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'go', placeholder: 'Name des Stadtbezirks', 'aria-label': 'Name des Stadtbezirks',
    });
    checkBtn = h('button.btn.primary', { type: 'submit' }, 'Prüfen');
    const skip = h('button.btn.ghost', { type: 'button', onclick: () => !locked && answerText(true) }, 'Weiß ich nicht');
    const form = h('form.text-form', {
      onsubmit: (e) => {
        e.preventDefault();
        if (locked) { if (!nextBtn.hidden) next(); return; }
        if (input.value.trim()) answerText(false);
      },
    }, h('div.text-row', {}, input, checkBtn), skip);
    answers.append(form);

    // iOS blendet die Tastatur aus, sobald ein Button angetippt wird oder das Feld schreibgeschützt ist,
    // und zeigt sie nur nach einer Berührung wieder an. Darum bleibt das Feld immer bearbeitbar und
    // fokussiert; Buttons übernehmen den Fokus nicht.
    for (const b of [checkBtn, skip, nextBtn]) b.addEventListener('mousedown', (e) => e.preventDefault());
    // Wer nach einer Antwort schon weitertippt, landet direkt in der nächsten Frage.
    input.addEventListener('beforeinput', () => { if (locked) next(); });
  }

  const screen = h('main.screen.game' + (timed ? '.is-timed' : ''), {},
    header,
    h('div.progress', {}, bar),
    h('div.game-map', {}, map.root),
    h('section.panel', {}, eyebrow, question, sub, answers, feedback, nextBtn),
  );
  mount(screen, () => {
    clearTimeout(advanceTimer);
    clearInterval(clock);
  });

  if (timed) {
    const endsAt = Date.now() + mode.seconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      counter.textContent = `0:${String(left).padStart(2, '0')}`;
      bar.style.width = `${(left / mode.seconds) * 100}%`;
      counter.classList.toggle('is-urgent', left <= 10);
      if (left === 0) finish();
    };
    tick();
    clock = setInterval(tick, 250);
  }

  next();
  input?.focus();

  function next() {
    clearTimeout(advanceTimer);
    index++;
    if (!timed && index >= queue.length) return finish();
    if (timed && index >= queue.length) queue.push(...pickRound(mode.pool, mode.pool.length, stats));
    current = queue[index];
    q = makeQuestion(mode, current);
    locked = false;
    nextBtn.hidden = true;
    feedback.textContent = '';
    feedback.className = 'feedback';
    map.clear();
    map.showLines(false);
    map.highlightLines([]);

    if (!timed) {
      counter.textContent = `${index + 1} / ${total}`;
      bar.style.width = `${(index / total) * 100}%`;
    }

    eyebrow.textContent = timed ? `${score} richtig` : q.eyebrow;
    question.replaceChildren(q.title);
    sub.replaceChildren(q.sub || '');
    q.before(map);

    if (mode.input === 'choice') {
      answers.replaceChildren(h('div.choices' + (mode.kind === 'termini' ? '.is-stacked' : ''), {}, q.options().map((opt) =>
        h('button.choice', { type: 'button', 'data-id': opt, onclick: (e) => answerChoice(opt, e.currentTarget) }, q.label(opt)),
      )));
    } else if (mode.input === 'multi') {
      const picked = new Set();
      const grid = h('div.line-grid', {}, LINE_CODES.map((code) => h('button.line-toggle', {
        type: 'button', 'data-id': code, 'aria-pressed': 'false',
        onclick: (e) => {
          if (locked) return;
          const b = e.currentTarget;
          if (picked.has(code)) picked.delete(code); else picked.add(code);
          b.setAttribute('aria-pressed', String(picked.has(code)));
        },
      }, badge(code))));
      const check = h('button.btn.primary.next', { type: 'button', onclick: () => !locked && answerMulti(picked, grid, check) }, 'Prüfen');
      answers.replaceChildren(grid, check);
    }
    if (input) {
      input.value = '';
      input.classList.remove('is-right', 'is-wrong');
      checkBtn.disabled = false;
      input.focus({ preventScroll: true });
    }
  }

  function settle(correct, message, { autoAdvance = correct, delay = 900 } = {}) {
    locked = true;
    record(store, mode.area, current, correct);
    if (correct) score++;
    else missed.push(current);
    haptic(correct ? 'success' : 'error');
    q.after(map, correct);
    feedback.textContent = message;
    feedback.className = 'feedback ' + (correct ? 'is-right' : 'is-wrong');
    if (timed) eyebrow.textContent = `${score} richtig`;

    if (timed) {
      advanceTimer = setTimeout(next, correct ? 350 : 1200);
    } else if (autoAdvance) {
      advanceTimer = setTimeout(next, delay);
    } else {
      nextBtn.hidden = false;
      if (!input) nextBtn.focus({ preventScroll: true });
    }
  }

  function answerChoice(opt, button) {
    if (locked) return;
    const correct = q.correct.includes(opt);
    for (const b of answers.querySelectorAll('.choice')) {
      b.disabled = true;
      if (q.correct.includes(b.dataset.id)) b.classList.add('is-right');
    }
    if (!correct) button.classList.add('is-wrong');
    // Bei Linienfragen nach der Antwort kurz die Karte mit der Linie zeigen – also nicht sofort weiter.
    const lineQuestion = mode.kind === 'termini' || mode.kind === 'terminusLine';
    settle(correct, correct ? 'Richtig.' : `Richtig wäre: ${q.solution}.`, { delay: lineQuestion ? 1600 : 900 });
  }

  function answerText(gaveUp) {
    const result = gaveUp ? 'wrong' : checkAnswer(input.value, current);
    const correct = result !== 'wrong';
    checkBtn.disabled = true;
    input.classList.add(correct ? 'is-right' : 'is-wrong');
    if (result === 'exact') settle(true, 'Richtig.');
    else if (result === 'close') settle(true, `Fast – richtig geschrieben: ${q.solution}`, { delay: 1800 });
    else settle(false, gaveUp ? `Richtig wäre: ${q.solution}.` : `Leider nicht – richtig wäre: ${q.solution}.`);
    input.focus({ preventScroll: true });
  }

  function answerMap(code) {
    if (locked) return;
    const correct = q.correct.includes(code);
    if (!correct) {
      map.setState(code, 'is-wrong');
      map.showLabel(code, bezName(code));
    }
    settle(correct, correct ? 'Richtig.' : `Angetippt: ${bezName(code)}. Richtig wäre: ${q.solution}.`, { autoAdvance: correct, delay: 1300 });
  }

  function answerMulti(picked, grid, check) {
    const want = new Set(q.correct);
    const correct = want.size === picked.size && [...want].every((c) => picked.has(c));
    for (const b of grid.children) {
      const c = b.dataset.id;
      b.disabled = true;
      if (want.has(c) && picked.has(c)) b.classList.add('is-right');
      else if (want.has(c)) b.classList.add('is-missed');
      else if (picked.has(c)) b.classList.add('is-wrong');
    }
    check.hidden = true;
    settle(correct, correct ? 'Richtig – alle Linien gefunden.' : `Richtig wäre: ${q.solution}.`, { autoAdvance: false });
  }

  function finish() {
    clearTimeout(advanceTimer);
    clearInterval(clock);
    locked = true;
    let isRecord = false;
    if (timed && score > (store.best.time || 0)) {
      store.best.time = score;
      isRecord = true;
      save(store);
    }
    showResults({ modeId, score, total: timed ? null : total, missed, isRecord });
  }
}

// ---------- Ergebnis ----------

// Beschriftung eines Eintrags in Listen (Ergebnis, Lernstand).
function itemRow(area, id) {
  switch (area) {
    case 'bezirke': return [bezName(id), h('span.muted', { text: `Bezirk ${+id}` })];
    case 'places': return [id, h('span.muted', { text: PLACES[id].bezirke.map(bezName).join(', ') })];
    case 'stations': return [id, h('span.muted', { text: bezName(STATIONS[id].bezirk) })];
    case 'termini': return [badge(id), h('span.muted', { text: endsText(id) })];
    case 'terminusLine': return [id, badges(TERMINI[id], 'is-small')];
    case 'linesAt': return [id, badges(STATIONS[id].lines, 'is-small')];
    default: return [id, ''];
  }
}

// Bezirke, die zu einem Eintrag gehören (für die Fehlerkarte).
function bezirkeOf(area, id) {
  if (area === 'bezirke') return [id];
  if (area === 'places') return PLACES[id].bezirke;
  if (area === 'stations' || area === 'linesAt') return [STATIONS[id].bezirk];
  return [];
}

function showResults({ modeId, score, total, missed, isRecord }) {
  const mode = MODES[modeId];
  const unique = [...new Set(missed)];
  const ratio = total ? score / total : null;
  const verdict =
    total == null ? (isRecord ? 'Neuer Rekord!' : `Rekord: ${store.best.time || score}`)
      : ratio === 1 ? 'Fehlerfrei – ausgezeichnet.'
        : ratio >= 0.8 ? 'Sehr gut.'
          : ratio >= 0.5 ? 'Gut – weiter so.'
            : 'Übung macht den Meister.';

  const marked = [...new Set(unique.flatMap((id) => bezirkeOf(mode.area, id)))];
  let map = null;
  if (marked.length) {
    map = new MunichMap({ label: 'Fehler dieser Runde' });
    for (const code of marked) map.setState(code, 'is-wrong');
  }

  mount(h('main.screen.results', {},
    topBar('Ergebnis'),
    h('section.result-head', {},
      h('p.eyebrow', { text: mode.title }),
      h('p.result-score', {},
        h('span', { text: String(score) }),
        total != null ? h('span.result-total', { text: ` / ${total}` }) : h('span.result-total', { text: ' richtig' })),
      h('p.result-verdict', { text: verdict }),
    ),
    unique.length ? h('section.section', {},
      h('h2.section-title', { text: 'Noch üben' }),
      map ? h('div.result-map', {}, map.root) : null,
      h('ul.missed', {}, unique.map((id) => h('li', {}, ...itemRow(mode.area, id)))),
    ) : null,
    h('div.actions', {},
      unique.length ? h('button.btn.primary', { type: 'button', onclick: () => startGame(modeId, unique) }, 'Fehler wiederholen') : null,
      h('button.btn' + (unique.length ? '.secondary' : '.primary'), { type: 'button', onclick: () => startGame(modeId) }, 'Neue Runde'),
      h('button.btn.ghost', { type: 'button', onclick: showHome }, 'Zur Übersicht'),
    ),
  ));
}

// ---------- Erkunden ----------

function showExplore() {
  const card = h('section.info-card', { 'aria-live': 'polite' },
    h('p.muted', { text: 'Tippe auf einen Stadtbezirk oder eine Haltestelle. Mit zwei Fingern zoomen.' }));
  let selected = null;

  const showBezirk = (code) => {
    if (selected) map.setState(selected);
    selected = code;
    map.selectStation(null);
    map.highlightLines([]);
    map.setState(code, 'is-target');
    const places = PLACE_NAMES.filter((n) => PLACES[n].bezirke.includes(code));
    const stations = CITY_STATIONS.filter((n) => STATIONS[n].bezirk === code);
    card.replaceChildren(
      h('p.eyebrow', { text: `Stadtbezirk ${+code}` }),
      h('h2.info-title', { text: bezName(code) }),
      h('dl.facts', {},
        h('dt', { text: 'Nachbarbezirke' }), h('dd', { text: SHAPES[code].neighbors.map(bezName).join(', ') }),
        places.length ? [h('dt', { text: 'Stadtteile & Viertel' }), h('dd', { text: places.join(', ') })] : null,
        h('dt', { text: 'S- und U-Bahn-Haltestellen' }), h('dd', { text: stations.length ? stations.join(', ') : '–' }),
      ),
    );
    haptic();
  };

  const showStation = (name) => {
    if (selected) map.setState(selected);
    const s = STATIONS[name];
    selected = s.bezirk;
    map.setState(s.bezirk, 'is-soft');
    map.selectStation(name);
    map.highlightLines(s.lines);
    card.replaceChildren(
      h('p.eyebrow', { text: 'Haltestelle' }),
      h('h2.info-title', { text: name }),
      h('div.info-badges', {}, badges(s.lines)),
      h('dl.facts', {},
        h('dt', { text: 'Stadtbezirk' }), h('dd', { text: bezName(s.bezirk) }),
        TERMINI[name] ? [h('dt', { text: 'Endhaltestelle von' }), h('dd', {}, badges(TERMINI[name], 'is-small'))] : null,
      ),
    );
    haptic();
  };

  const map = new MunichMap({
    interactive: true, lines: true, stations: true,
    label: 'Interaktive Karte von München',
    onTap: showBezirk,
    onStationTap: showStation,
  });
  mount(h('main.screen.explore', {},
    topBar('Karte erkunden'),
    h('div.game-map', {}, map.root),
    card,
  ));
}

// ---------- Lernstand ----------

function showStats() {
  const map = new MunichMap({ label: 'Lernstand je Stadtbezirk' });
  const counts = { good: 0, mid: 0, weak: 0, new: 0 };
  for (const c of BEZ_CODES) {
    const m = mastery(store.stats.bezirke[c]);
    counts[m]++;
    if (m !== 'new') map.setState(c, `is-${m}`);
  }
  const known = (area) => AREA_POOL[area].filter((id) => mastery(store.stats[area][id]) === 'good').length;

  const weakest = Object.keys(AREA_LABEL)
    .flatMap((area) => Object.entries(store.stats[area])
      .filter(([id, st]) => st.seen > st.correct && AREA_POOL[area].includes(id))
      .map(([id, st]) => ({ area, id, st })))
    .sort((a, b) => (a.st.correct / a.st.seen) - (b.st.correct / b.st.seen) || b.st.seen - a.st.seen)
    .slice(0, 8);

  const legend = (cls, label, n) => h('li', {}, h('span.swatch.' + cls), h('span', { text: label }), h('span.muted', { text: String(n) }));

  mount(h('main.screen.stats', {},
    topBar('Lernstand'),
    h('div.result-map', {}, map.root),
    h('ul.legend', {},
      legend('good', 'Sicher', counts.good),
      legend('mid', 'Teilweise', counts.mid),
      legend('weak', 'Unsicher', counts.weak),
      legend('new', 'Noch nicht geübt', counts.new),
    ),
    h('section.section', {},
      h('h2.section-title', { text: 'Überblick' }),
      h('dl.facts', {},
        Object.entries(AREA_LABEL).map(([area, label]) => [
          h('dt', { text: label }), h('dd', { text: `${known(area)} von ${AREA_POOL[area].length} sicher` }),
        ]),
        h('dt', { text: 'Rekord gegen die Uhr' }), h('dd', { text: store.best.time ? `${store.best.time} Bezirke` : '–' }),
      ),
    ),
    weakest.length ? h('section.section', {},
      h('h2.section-title', { text: 'Am häufigsten verwechselt' }),
      h('ul.missed', {}, weakest.map(({ area, id, st }) => h('li', {},
        h('span.missed-name', {}, itemRow(area, id)[0]),
        h('span.muted', { text: `${st.correct} von ${st.seen} richtig` }),
      ))),
    ) : null,
    h('div.actions', {},
      h('button.btn.ghost.danger', {
        type: 'button',
        onclick: () => {
          if (confirm('Gesamten Lernstand und Rekorde löschen?')) {
            resetProgress(store);
            showStats();
          }
        },
      }, 'Lernstand zurücksetzen'),
    ),
  ));
}

// ---------- Start ----------

showHome();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
