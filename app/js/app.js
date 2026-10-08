import { STATES, BY_CODE } from './data/states.js';
import { SHAPES } from './data/map.js';
import { UsMap } from './map.js';
import { checkAnswer } from './answer.js';
import { pickRound, choicesFor } from './questions.js';
import { load, save, record, resetProgress, mastery } from './storage.js';
import { haptic, setHaptics } from './haptics.js';

const store = load();
setHaptics(store.settings.haptics);
const app = document.getElementById('app');

const MODES = {
  mc: {
    eyebrow: 'Stufe 1', title: 'Auswahl', area: 'names', input: 'choice',
    desc: 'Ein Staat ist markiert – wähle den richtigen Namen aus vier.',
  },
  text: {
    eyebrow: 'Stufe 2', title: 'Eingabe', area: 'names', input: 'text',
    desc: 'Ein Staat ist markiert – schreibe seinen Namen.',
  },
  find: {
    eyebrow: 'Umgekehrt', title: 'Auf der Karte finden', area: 'names', input: 'map',
    desc: 'Der Name ist vorgegeben – tippe den Staat auf der Karte an.',
  },
  capitals: {
    eyebrow: 'Vertiefung', title: 'Hauptstädte', area: 'capitals', input: 'choice',
    desc: 'Zum markierten Staat die passende Hauptstadt wählen.',
  },
  time: {
    eyebrow: '60 Sekunden', title: 'Gegen die Uhr', area: 'names', input: 'choice', seconds: 60,
    desc: 'So viele Staaten wie möglich in einer Minute.',
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

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Startseite ----------

function showHome() {
  const heroMap = new UsMap({ label: 'Karte der Vereinigten Staaten' });
  const masteredCount = STATES.filter((s) => mastery(store.stats.names[s.code]) === 'good').length;
  for (const s of STATES) {
    const m = mastery(store.stats.names[s.code]);
    if (m === 'good') heroMap.setState(s.code, 'is-known');
  }

  const lengths = [10, 25, 50];
  const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Fragen pro Runde' },
    lengths.map((n) => h('button.seg-btn', {
      type: 'button', role: 'radio',
      'aria-checked': String(store.settings.roundLength === n),
      onclick: (e) => {
        store.settings.roundLength = n;
        save(store);
        for (const b of seg.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      },
    }, n === 50 ? 'Alle 50' : String(n))),
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
      h('h1.display', { text: 'Die Staaten der USA' }),
      h('div.hero-map', {}, heroMap.root),
      h('p.hero-progress', {},
        h('strong', { text: String(masteredCount) }), ' von 50 Staaten sicher erkannt'),
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
  const queue = presetCodes ? shuffle(presetCodes) : pickRound(timed ? 50 : store.settings.roundLength, stats);
  const total = timed ? null : queue.length;

  let index = -1;
  let score = 0;
  let current = null;
  let locked = true;
  let advanceTimer = null;
  let clock = null;
  const missed = [];

  const map = new UsMap({
    interactive: mode.input === 'map',
    onTap: (code) => answerMap(code),
  });

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
      spellcheck: 'false', enterkeyhint: 'done', placeholder: 'Name des Staates', 'aria-label': 'Name des Staates',
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
    h('div.game-map', {}, map.root),
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
    if (timed && index >= queue.length) queue.push(...pickRound(50, stats));
    current = queue[index];
    locked = false;
    nextBtn.hidden = true;
    feedback.textContent = '';
    feedback.className = 'feedback';
    map.clear();

    if (!timed) {
      counter.textContent = `${index + 1} / ${total}`;
      bar.style.width = `${(index / total) * 100}%`;
    }

    const state = BY_CODE[current];
    if (mode.input === 'map') {
      eyebrow.textContent = 'Wo liegt …';
      question.textContent = state.name;
      map.reset();
    } else {
      map.setState(current, 'is-target');
      map.ringIfTiny(current);
      map.focus(current);
      if (mode.area === 'capitals') {
        eyebrow.textContent = 'Hauptstadt von';
        question.textContent = state.name;
      } else {
        eyebrow.textContent = timed ? `${score} richtig` : mode.eyebrow;
        question.textContent = mode.input === 'text' ? 'Wie heißt dieser Staat?' : 'Welcher Staat ist markiert?';
      }
    }

    if (mode.input === 'choice') {
      const options = choicesFor(current);
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

  function answerChoice(code, button) {
    if (locked) return;
    const correct = code === current;
    for (const b of answers.querySelectorAll('.choice')) {
      b.disabled = true;
      if (b.dataset.code === current) b.classList.add('is-right');
    }
    if (!correct) button.classList.add('is-wrong');
    map.setState(current, correct ? 'is-right' : 'is-target');
    const state = BY_CODE[current];
    if (mode.area === 'capitals') {
      settle(correct, correct ? 'Richtig.' : `Die Hauptstadt von ${state.name} ist ${state.capital}.`);
    } else {
      if (!correct) map.showLabel(current, state.name);
      settle(correct, correct ? 'Richtig.' : `Das ist ${state.name}.`);
    }
  }

  function answerText(gaveUp) {
    const state = BY_CODE[current];
    const result = gaveUp ? 'wrong' : checkAnswer(input.value, current);
    const correct = result !== 'wrong';
    input.readOnly = true;
    checkBtn.disabled = true;
    input.classList.add(correct ? 'is-right' : 'is-wrong');
    map.setState(current, correct ? 'is-right' : 'is-target');
    if (!correct || result === 'close') map.showLabel(current, state.name);
    if (result === 'exact') settle(true, 'Richtig.');
    else if (result === 'close') settle(true, `Fast – richtig geschrieben: ${state.name}`, { delay: 1800 });
    else settle(false, gaveUp ? `Das ist ${state.name}.` : `Leider nicht – das ist ${state.name}.`);
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
      settle(false, `Das war ${BY_CODE[code].name}. ${target.name} ist grün markiert.`, { autoAdvance: false });
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

  const map = new UsMap({ label: 'Fehler dieser Runde' });
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
        h('span', { text: BY_CODE[code].name }),
        h('span.muted', { text: mode.area === 'capitals' ? BY_CODE[code].capital : code }),
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
    h('p.muted', { text: 'Tippe auf einen Staat. Mit zwei Fingern zoomen.' }));
  let selected = null;
  const map = new UsMap({
    interactive: true,
    label: 'Interaktive Karte der USA',
    onTap: (code) => {
      if (selected) map.setState(selected);
      selected = code;
      map.setState(code, 'is-target');
      const s = BY_CODE[code];
      const neighbors = SHAPES[code].neighbors.map((c) => BY_CODE[c].name);
      card.replaceChildren(
        h('p.eyebrow', { text: s.code }),
        h('h2.info-title', { text: s.name }),
        h('dl.facts', {},
          h('dt', { text: 'Hauptstadt' }), h('dd', { text: s.capital }),
          h('dt', { text: 'Nachbarstaaten' }), h('dd', { text: neighbors.length ? neighbors.join(', ') : '– (keine Landgrenze zu anderen Staaten)' }),
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
  const map = new UsMap({ label: 'Lernstand je Staat' });
  const counts = { good: 0, mid: 0, weak: 0, new: 0 };
  for (const s of STATES) {
    const m = mastery(store.stats.names[s.code]);
    counts[m]++;
    if (m !== 'new') map.setState(s.code, `is-${m}`);
  }
  const weakest = STATES
    .map((s) => ({ s, st: store.stats.names[s.code] }))
    .filter(({ st }) => st && st.seen > st.correct)
    .sort((a, b) => (a.st.correct / a.st.seen) - (b.st.correct / b.st.seen) || b.st.seen - a.st.seen)
    .slice(0, 8);

  const capitalsKnown = STATES.filter((s) => mastery(store.stats.capitals[s.code]) === 'good').length;

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
        h('dt', { text: 'Staatennamen sicher' }), h('dd', { text: `${counts.good} von 50` }),
        h('dt', { text: 'Hauptstädte sicher' }), h('dd', { text: `${capitalsKnown} von 50` }),
        h('dt', { text: 'Rekord gegen die Uhr' }), h('dd', { text: store.best.time ? `${store.best.time} Staaten` : '–' }),
      ),
    ),
    weakest.length ? h('section.section', {},
      h('h2.section-title', { text: 'Am häufigsten verwechselt' }),
      h('ul.missed', {}, weakest.map(({ s, st }) => h('li', {},
        h('span', { text: s.name }),
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
