import { COUNTRIES, BY_CODE } from './data/countries.js';
import { SHAPES } from './data/map.js';
import { EuropeMap } from './map.js';
import { checkAnswer } from './answer.js';
import { pickRound, choicesFor, shuffle } from './questions.js';
import { load, save, record, resetProgress, mastery } from './storage.js';
import { haptic, setHaptics } from './haptics.js';

const store = load();
setHaptics(store.settings.haptics);
const app = document.getElementById('app');
const TOTAL = COUNTRIES.length;

// show: was als Frage gezeigt wird ('map' = markiertes Land, 'flag' = Flagge, 'name' = Name, Antwort per Karte)
const MODES = {
  mc: {
    eyebrow: 'Stufe 1', title: 'Auswahl', area: 'names', show: 'map', input: 'choice',
    desc: 'Ein Land ist markiert – wähle den richtigen Namen aus vier.',
  },
  text: {
    eyebrow: 'Stufe 2', title: 'Eingabe', area: 'names', show: 'map', input: 'text',
    desc: 'Ein Land ist markiert – schreibe seinen Namen.',
  },
  flagChoice: {
    eyebrow: 'Flaggen · Stufe 1', title: 'Flagge erkennen', area: 'flags', show: 'flag', input: 'choice',
    desc: 'Eine Flagge wird gezeigt – wähle das passende Land aus vier.',
  },
  flagText: {
    eyebrow: 'Flaggen · Stufe 2', title: 'Flagge benennen', area: 'flags', show: 'flag', input: 'text',
    desc: 'Eine Flagge wird gezeigt – schreibe den Namen des Landes.',
  },
  find: {
    eyebrow: 'Umgekehrt', title: 'Auf der Karte finden', area: 'names', show: 'name', input: 'map',
    desc: 'Der Name ist vorgegeben – tippe das Land auf der Karte an.',
  },
  capitals: {
    eyebrow: 'Vertiefung', title: 'Hauptstädte', area: 'capitals', show: 'map', input: 'choice',
    desc: 'Zum markierten Land die passende Hauptstadt wählen.',
  },
  time: {
    eyebrow: '60 Sekunden', title: 'Gegen die Uhr', area: 'names', show: 'map', input: 'choice', seconds: 60,
    desc: 'So viele Länder wie möglich in einer Minute.',
  },
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
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}

function flag(code, cls = 'flag') {
  return h('img.' + cls, { src: `flags/${code}.svg`, alt: `Flagge von ${BY_CODE[code].name}`, draggable: 'false' });
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

// ---------- Startseite ----------

function showHome() {
  const heroMap = new EuropeMap({ label: 'Karte Europas' });
  const masteredCount = COUNTRIES.filter((c) => mastery(store.stats.names[c.code]) === 'good').length;
  for (const c of COUNTRIES) {
    if (mastery(store.stats.names[c.code]) === 'good') heroMap.setState(c.code, 'is-known');
  }

  const lengths = [10, 25, TOTAL];
  const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Fragen pro Runde' },
    lengths.map((n) => h('button.seg-btn', {
      type: 'button', role: 'radio',
      'aria-checked': String(store.settings.roundLength === n),
      onclick: (e) => {
        store.settings.roundLength = n;
        save(store);
        for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      },
    }, n === TOTAL ? `Alle ${TOTAL}` : String(n))),
  );

  const modeCards = Object.entries(MODES).map(([id, m]) =>
    h('button.mode', { type: 'button', onclick: () => startGame(id) },
      h('span.mode-eyebrow', { text: m.eyebrow }),
      h('span.mode-title', { text: m.title }),
      h('span.mode-desc', { text: m.desc }),
      id === 'time' && store.best.time ? h('span.mode-meta', { text: `Rekord: ${store.best.time}` }) : null,
    ),
  );

  mount(h('main.screen.home', {},
    h('header.hero', {},
      h('p.eyebrow', { text: 'Geografie spielerisch lernen' }),
      h('h1.display', { text: 'Die Länder Europas' }),
      h('div.hero-map', {}, heroMap.root),
      h('p.hero-progress', {},
        h('strong', { text: String(masteredCount) }), ` von ${TOTAL} Ländern sicher erkannt`),
    ),
    h('section.section', {},
      h('h2.section-title', { text: 'Spielmodi' }),
      h('div.modes', {}, modeCards),
    ),
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
  ));
}

// ---------- Spiel ----------

function startGame(modeId, presetCodes = null) {
  const mode = MODES[modeId];
  const timed = Boolean(mode.seconds);
  const stats = store.stats[mode.area];
  const queue = presetCodes ? shuffle(presetCodes) : pickRound(timed ? TOTAL : store.settings.roundLength, stats);
  const total = timed ? null : queue.length;

  let index = -1;
  let score = 0;
  let current = null;
  let locked = true;
  let advanceTimer = null;
  let clock = null;
  const missed = [];

  const map = mode.show === 'flag' ? null : new EuropeMap({
    interactive: mode.input === 'map',
    onTap: (code) => answerMap(code),
  });
  const flagFrame = mode.show === 'flag' ? h('div.flag-stage') : null;

  // Kopfzeile mit Fortschritt
  const counter = h('span.counter');
  const bar = h('div.progress-fill');
  const header = topBar(mode.title, counter);

  // Frage
  const eyebrow = h('p.prompt-eyebrow');
  const question = h('h2.prompt-title');
  const feedback = h('p.feedback', { 'aria-live': 'polite' });
  const nextBtn = h('button.btn.primary.next', { type: 'button', hidden: true, onclick: () => next() }, 'Weiter');

  // Antwortbereich
  const answers = h('div.answers');
  let input = null;
  let checkBtn = null;
  if (mode.input === 'text') {
    input = h('input.text-input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'words', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Name des Landes', 'aria-label': 'Name des Landes',
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
  }

  const screen = h('main.screen.game' + (timed ? '.is-timed' : ''), {},
    header,
    h('div.progress', {}, bar),
    map ? h('div.game-map', {}, map.root) : flagFrame,
    h('section.panel', {}, eyebrow, question, answers, feedback, nextBtn),
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
    if (timed && index >= queue.length) queue.push(...pickRound(TOTAL, stats));
    current = queue[index];
    locked = false;
    nextBtn.hidden = true;
    feedback.textContent = '';
    feedback.className = 'feedback';
    map?.clear();

    if (!timed) {
      counter.textContent = `${index + 1} / ${total}`;
      bar.style.width = `${(index / total) * 100}%`;
    }

    const country = BY_CODE[current];
    if (mode.show === 'name') {
      eyebrow.textContent = 'Wo liegt …';
      question.textContent = country.name;
      map.reset();
    } else if (mode.show === 'flag') {
      flagFrame.replaceChildren(flag(current, 'flag flag-large'));
      eyebrow.textContent = mode.eyebrow;
      question.textContent = 'Zu welchem Land gehört diese Flagge?';
    } else {
      map.setState(current, 'is-target');
      map.ringIfTiny(current);
      map.focus(current);
      if (mode.area === 'capitals') {
        eyebrow.textContent = 'Hauptstadt von';
        question.textContent = country.name;
      } else {
        eyebrow.textContent = timed ? `${score} richtig` : mode.eyebrow;
        question.textContent = mode.input === 'text' ? 'Wie heißt dieses Land?' : 'Welches Land ist markiert?';
      }
    }

    if (mode.input === 'choice') {
      const options = choicesFor(current, mode.area);
      answers.replaceChildren(h('div.choices', {}, options.map((code) =>
        h('button.choice', { type: 'button', 'data-code': code, onclick: (e) => answerChoice(code, e.currentTarget) },
          mode.area === 'capitals' ? BY_CODE[code].capital : BY_CODE[code].name),
      )));
    }
    if (input) {
      input.value = '';
      input.classList.remove('is-right', 'is-wrong');
      input.readOnly = false;
      checkBtn.disabled = false;
    }
  }

  function settle(correct, message, { autoAdvance = correct, delay = 900 } = {}) {
    locked = true;
    record(store, mode.area, current, correct);
    if (correct) score++;
    else missed.push(current);
    haptic(correct ? 'success' : 'error');
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

  // Markiertes Land auf der Karte einfärben und bei falscher Antwort beschriften.
  function revealOnMap(correct) {
    if (!map) return;
    map.setState(current, correct ? 'is-right' : 'is-target');
    if (!correct) map.showLabel(current, BY_CODE[current].name);
  }

  function answerChoice(code, button) {
    if (locked) return;
    const correct = code === current;
    for (const b of answers.querySelectorAll('.choice')) {
      b.disabled = true;
      if (b.dataset.code === current) b.classList.add('is-right');
    }
    if (!correct) button.classList.add('is-wrong');
    const country = BY_CODE[current];
    if (mode.area === 'capitals') {
      map.setState(current, correct ? 'is-right' : 'is-target');
      settle(correct, correct ? 'Richtig.' : `Richtig wäre: ${country.capital} (${country.name}).`);
    } else {
      revealOnMap(correct);
      settle(correct, correct ? 'Richtig.' : `Richtig wäre: ${country.name}.`);
    }
  }

  function answerText(gaveUp) {
    const country = BY_CODE[current];
    const result = gaveUp ? 'wrong' : checkAnswer(input.value, current);
    const correct = result !== 'wrong';
    input.readOnly = true;
    checkBtn.disabled = true;
    input.classList.add(correct ? 'is-right' : 'is-wrong');
    revealOnMap(correct);
    if (result === 'close') map?.showLabel(current, country.name);
    if (result === 'exact') settle(true, 'Richtig.');
    else if (result === 'close') settle(true, `Fast – richtig geschrieben: ${country.name}`, { delay: 1800 });
    else settle(false, gaveUp ? `Richtig wäre: ${country.name}.` : `Leider nicht – richtig wäre: ${country.name}.`);
    // Tastatur offen lassen, damit es ohne Absetzen weitergeht.
    input.focus({ preventScroll: true });
  }

  function answerMap(code) {
    if (locked) return;
    const correct = code === current;
    const target = BY_CODE[current];
    if (correct) {
      map.setState(current, 'is-right');
      settle(true, 'Richtig.');
    } else {
      map.setState(code, 'is-wrong');
      map.showLabel(code, BY_CODE[code].name);
      map.setState(current, 'is-right');
      map.showLabel(current, target.name);
      map.ringIfTiny(current);
      map.focus(current);
      settle(false, `Angetippt: ${BY_CODE[code].name}. Gesucht war ${target.name} (grün markiert).`, { autoAdvance: false });
    }
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

  const map = new EuropeMap({ label: 'Fehler dieser Runde' });
  for (const code of unique) map.setState(code, 'is-wrong');

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
      h('div.result-map', {}, map.root),
      h('ul.missed', {}, unique.map((code) => h('li', {},
        h('span.missed-name', {}, flag(code, 'flag flag-mini'), BY_CODE[code].name),
        h('span.muted', { text: mode.area === 'capitals' ? BY_CODE[code].capital : '' }),
      ))),
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
    h('p.muted', { text: 'Tippe auf ein Land. Mit zwei Fingern zoomen.' }));
  let selected = null;
  const map = new EuropeMap({
    interactive: true,
    label: 'Interaktive Karte Europas',
    onTap: (code) => {
      if (selected) map.setState(selected);
      selected = code;
      map.setState(code, 'is-target');
      const c = BY_CODE[code];
      const neighbors = SHAPES[code].neighbors.map((n) => BY_CODE[n].name);
      card.replaceChildren(
        h('div.info-head', {},
          h('div', {},
            h('p.eyebrow', { text: c.code.toUpperCase() }),
            h('h2.info-title', { text: c.name })),
          flag(code, 'flag flag-info')),
        h('dl.facts', {},
          h('dt', { text: 'Hauptstadt' }), h('dd', { text: c.capital }),
          h('dt', { text: 'Nachbarländer' }), h('dd', { text: neighbors.length ? neighbors.join(', ') : '– (keine Landgrenze zu anderen Ländern dieser Liste)' }),
        ),
      );
      haptic();
    },
  });
  mount(h('main.screen.explore', {},
    topBar('Karte erkunden'),
    h('div.game-map', {}, map.root),
    card,
  ));
}

// ---------- Lernstand ----------

function showStats() {
  const map = new EuropeMap({ label: 'Lernstand je Land' });
  const counts = { good: 0, mid: 0, weak: 0, new: 0 };
  for (const c of COUNTRIES) {
    const m = mastery(store.stats.names[c.code]);
    counts[m]++;
    if (m !== 'new') map.setState(c.code, `is-${m}`);
  }
  const known = (area) => COUNTRIES.filter((c) => mastery(store.stats[area][c.code]) === 'good').length;

  // Am häufigsten verwechselt – über alle Lernbereiche zusammen.
  const totals = {};
  for (const area of ['names', 'flags', 'capitals']) {
    for (const [code, st] of Object.entries(store.stats[area])) {
      const t = (totals[code] ||= { seen: 0, correct: 0 });
      t.seen += st.seen;
      t.correct += st.correct;
    }
  }
  const weakest = Object.entries(totals)
    .filter(([, st]) => st.seen > st.correct)
    .sort(([, a], [, b]) => (a.correct / a.seen) - (b.correct / b.seen) || b.seen - a.seen)
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
        h('dt', { text: 'Ländernamen sicher' }), h('dd', { text: `${known('names')} von ${TOTAL}` }),
        h('dt', { text: 'Flaggen sicher' }), h('dd', { text: `${known('flags')} von ${TOTAL}` }),
        h('dt', { text: 'Hauptstädte sicher' }), h('dd', { text: `${known('capitals')} von ${TOTAL}` }),
        h('dt', { text: 'Rekord gegen die Uhr' }), h('dd', { text: store.best.time ? `${store.best.time} Länder` : '–' }),
      ),
    ),
    weakest.length ? h('section.section', {},
      h('h2.section-title', { text: 'Am häufigsten verwechselt' }),
      h('ul.missed', {}, weakest.map(([code, st]) => h('li', {},
        h('span.missed-name', {}, flag(code, 'flag flag-mini'), BY_CODE[code].name),
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
