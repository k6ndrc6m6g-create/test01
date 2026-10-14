// SVG-Karte der USA: Hervorheben, sanftes Zoomen auf kleine Staaten, Pinch-/Pan-Gesten und Antippen.
import { SHAPES, VIEWBOX, OUTLINE } from './data/map.js';

const NS = 'http://www.w3.org/2000/svg';
const FULL = { x: VIEWBOX[0], y: VIEWBOX[1], w: VIEWBOX[2], h: VIEWBOX[3] };
const ASPECT = FULL.w / FULL.h;
const MIN_WIDTH = 110;

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const ease = (t) => 1 - Math.pow(1 - t, 3);

export class UsMap {
  constructor({ interactive = false, onTap = null, label = 'Karte der USA' } = {}) {
    this.interactive = interactive;
    this.onTap = onTap;
    this.view = { ...FULL };
    this.paths = {};

    this.svg = el('svg', { viewBox: VIEWBOX.join(' '), role: 'img', 'aria-label': label, class: 'usmap' });
    this.layer = el('g', { class: 'usmap-states' });
    for (const [code, shape] of Object.entries(SHAPES)) {
      const p = el('path', { d: shape.d, 'data-code': code, class: 'state' });
      this.paths[code] = p;
      this.layer.appendChild(p);
    }
    this.svg.appendChild(this.layer);
    this.svg.appendChild(el('path', { d: OUTLINE, class: 'usmap-outline' }));
    this.ring = el('circle', { class: 'usmap-ring', r: 0, cx: 0, cy: 0 });
    this.svg.appendChild(this.ring);
    this.labelLayer = el('g', { class: 'usmap-labels' });
    this.svg.appendChild(this.labelLayer);

    this.root = document.createElement('div');
    // Jede Karte lässt sich mit zwei Fingern zoomen; antippen lassen sich die Gebiete nur, wenn onTap gesetzt ist.
    this.root.className = 'usmap-wrap' + (interactive ? ' is-interactive' : '');
    this.root.appendChild(this.svg);

    this.resetButton = document.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = 'usmap-reset';
    this.resetButton.textContent = 'Gesamtansicht';
    this.resetButton.addEventListener('click', () => this.reset());
    // Fokus nicht vom Eingabefeld abziehen, sonst schließt iOS die Tastatur.
    this.resetButton.addEventListener('mousedown', (e) => e.preventDefault());
    this.root.appendChild(this.resetButton);
    this.bindGestures();
    this.updateZoomState();
  }

  // ---------- Darstellung ----------

  setState(code, ...classes) {
    const p = this.paths[code];
    p.setAttribute('class', ['state', ...classes].join(' '));
    // Markierte Staaten nach oben holen, damit ihre Kontur nicht verdeckt wird.
    if (classes.length) this.layer.appendChild(p);
  }

  clear() {
    for (const code in this.paths) this.paths[code].setAttribute('class', 'state');
    this.ring.classList.remove('is-visible');
    this.labelLayer.replaceChildren();
  }

  // Markierungsring für Staaten, die selbst gezoomt kaum zu sehen sind (Rhode Island, Delaware …).
  ringIfTiny(code) {
    const [, , w, h] = SHAPES[code].bbox;
    const size = Math.max(w, h);
    if (size >= 24) return;
    const [cx, cy] = SHAPES[code].center;
    this.ring.setAttribute('cx', cx);
    this.ring.setAttribute('cy', cy);
    this.ring.setAttribute('r', size * 0.75 + 5);
    this.ring.classList.add('is-visible');
  }

  showLabel(code, text) {
    const [cx, cy] = SHAPES[code].center;
    const t = el('text', { x: cx, y: cy, class: 'usmap-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    t.textContent = text;
    this.labelLayer.appendChild(t);
    this.scaleLabels();
  }

  scaleLabels() {
    const size = Math.max(7, this.view.w / 34);
    for (const t of this.labelLayer.children) t.style.fontSize = `${size}px`;
  }

  // ---------- Ausschnitt ----------

  // Ausschnitt so wählen, dass kleine Staaten groß genug erscheinen; große Staaten bleiben in der Gesamtansicht.
  focus(code, animate = true) {
    const [x, y, w, h] = SHAPES[code].bbox;
    if (Math.max(w, h) >= 70) return this.animateTo(FULL, animate);
    const vw = Math.max(w * 5, h * 5 * ASPECT, 300);
    const vh = vw / ASPECT;
    this.animateTo(this.clampView({ x: x + w / 2 - vw / 2, y: y + h / 2 - vh / 2, w: vw, h: vh }), animate);
  }

  reset(animate = true) {
    this.animateTo(FULL, animate);
  }

  clampView(v) {
    const w = Math.min(FULL.w, Math.max(MIN_WIDTH, v.w));
    const h = w / ASPECT;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const x = Math.min(FULL.x + FULL.w - w, Math.max(FULL.x, cx - w / 2));
    const y = Math.min(FULL.y + FULL.h - h, Math.max(FULL.y, cy - h / 2));
    return { x, y, w, h };
  }

  setView(v) {
    this.view = v;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    this.scaleLabels();
    this.updateZoomState();
  }

  updateZoomState() {
    this.root.classList.toggle('is-zoomed', this.view.w < FULL.w - 1);
  }

  animateTo(target, animate = true) {
    cancelAnimationFrame(this.frame);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) return this.setView(target);
    const from = { ...this.view };
    const start = performance.now();
    const duration = 550;
    const step = (now) => {
      const t = ease(Math.min(1, (now - start) / duration));
      this.setView({
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t,
        w: from.w + (target.w - from.w) * t,
        h: from.h + (target.h - from.h) * t,
      });
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  // ---------- Gesten ----------

  // SVG-Einheiten pro Bildschirmpixel (viewBox wird mit „meet“ eingepasst).
  unitsPerPixel() {
    const r = this.svg.getBoundingClientRect();
    return Math.max(this.view.w / r.width, this.view.h / r.height);
  }

  toSvgPoint(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    const k = this.unitsPerPixel();
    const offX = (r.width * k - this.view.w) / 2;
    const offY = (r.height * k - this.view.h) / 2;
    return { x: this.view.x + (clientX - r.left) * k - offX, y: this.view.y + (clientY - r.top) * k - offY };
  }

  bindGestures() {
    const pointers = new Map();
    let moved = false;
    let pinch = null;
    const svg = this.svg;

    // Safari meldet Pinch-Gesten zusätzlich als gesture*-Ereignisse. Sie verhindern das Zoomen der ganzen Seite
    // und dienen als Rückfall, falls die Pointer-Ereignisse beim Pinch ausbleiben.
    let gestureView = null;
    svg.addEventListener('gesturestart', (e) => {
      e.preventDefault();
      cancelAnimationFrame(this.frame);
      gestureView = { ...this.view };
    });
    svg.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      if (pinch || !gestureView) return;
      this.zoomAround(this.toSvgPoint(e.clientX, e.clientY), gestureView.w / e.scale);
    });
    svg.addEventListener('gestureend', (e) => {
      e.preventDefault();
      gestureView = null;
    });

    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (pointers.size === 1) moved = false;
      if (pointers.size === 2) {
        cancelAnimationFrame(this.frame);
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), view: { ...this.view } };
        moved = true;
      }
    });

    svg.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const k = this.unitsPerPixel();
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) moved = true;

      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = this.toSvgPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.zoomAround(mid, pinch.view.w * (pinch.dist / Math.max(dist, 1)));
      } else if (pointers.size === 1 && moved && this.view.w < FULL.w - 1) {
        const v = this.view;
        this.setView(this.clampView({ x: v.x - dx * k, y: v.y - dy * k, w: v.w, h: v.h }));
      }
    });

    const end = (e) => {
      const wasTap = pointers.size === 1 && !moved && e.type === 'pointerup';
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        pinch = null;
        // Der verbleibende Finger soll nach dem Pinch nicht springen.
        for (const p of pointers.values()) { p.sx = p.x; p.sy = p.y; }
      }
      if (wasTap && this.onTap) {
        const code = this.hitTest(e.clientX, e.clientY);
        if (code) this.onTap(code);
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    // Mausrad zoomt nur auf antippbaren Karten (sonst würde es das Scrollen der Seite kapern);
    // Trackpad-Pinch (mit ctrlKey) zoomt überall.
    svg.addEventListener('wheel', (e) => {
      if (!this.interactive && !e.ctrlKey) return;
      e.preventDefault();
      this.zoomAround(this.toSvgPoint(e.clientX, e.clientY), this.view.w * Math.exp(e.deltaY * 0.002));
    }, { passive: false });
  }

  // Auf Breite w zoomen, wobei der Kartenpunkt pt an derselben Stelle auf dem Bildschirm bleibt.
  zoomAround(pt, w) {
    const v = this.view;
    const h = w / ASPECT;
    const rx = (pt.x - v.x) / v.w;
    const ry = (pt.y - v.y) / v.h;
    this.setView(this.clampView({ x: pt.x - rx * w, y: pt.y - ry * h, w, h }));
  }

  // Treffer direkt auf einem Staat – sonst unter den Staaten im Umkreis von ~14 px der mit dem nächsten Mittelpunkt
  // (hilft bei kleinen Staaten, Inseln und Küsten).
  hitTest(clientX, clientY) {
    const hit = document.elementFromPoint(clientX, clientY);
    const code = hit?.closest?.('[data-code]')?.getAttribute('data-code');
    if (code) return code;
    const pt = this.toSvgPoint(clientX, clientY);
    const radius = 14 * this.unitsPerPixel();
    let best = null;
    let bestDist = Infinity;
    for (const [c, s] of Object.entries(SHAPES)) {
      const [x, y, w, h] = s.bbox;
      const dx = Math.max(x - pt.x, 0, pt.x - (x + w));
      const dy = Math.max(y - pt.y, 0, pt.y - (y + h));
      if (Math.hypot(dx, dy) > radius) continue;
      const d = Math.hypot(s.center[0] - pt.x, s.center[1] - pt.y);
      if (d < bestDist) { best = c; bestDist = d; }
    }
    return best;
  }
}
