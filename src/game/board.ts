import { buildOccupancy, checkExit, freeArrows, head } from '../engine/rules';
import { DIRS, type Arrow, type Level } from '../engine/types';
import type { Skin } from '../state/skins';

const NS = 'http://www.w3.org/2000/svg';
const PAD = 0.15;
const LONG_PRESS_MS = 280;
const MOVE_TOLERANCE = 10;

export interface BoardEvents {
  /** Seta começou a sair (o caminho estava livre) */
  onExit(a: Arrow, remaining: number): void;
  /** Seta bateu em outra */
  onBump(a: Arrow, blocker: Arrow): void;
  /** Todas as setas saíram (depois da última animação) */
  onClear(): void;
  /** Mostrou a prévia do caminho (toque longo) */
  onPreview?(a: Arrow, ok: boolean): void;
}

interface ArrowView {
  a: Arrow;
  g: SVGGElement;
  /** contorno escuro, corpo colorido e brilho (mesmo caminho, larguras diferentes) */
  paths: SVGPathElement[];
  /** contorno e preenchimento da ponta */
  heads: SVGPolygonElement[];
  alive: boolean;
  busy: boolean;
}

/** Escurece uma cor #rrggbb (contorno das setas, estilo cartoon) */
function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 'rgba(0,0,0,.55)';
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.round(v * (1 - k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Pt = [number, number];

/**
 * Tabuleiro: desenho em SVG, animações e entrada por toque.
 * - toque rápido: tenta tirar a seta
 * - toque longo: mostra a prévia do caminho (verde = livre, vermelho = bloqueado)
 * - pinça com dois dedos: zoom; arrastar com zoom: mover
 */
export class Board {
  readonly el: HTMLDivElement;
  /** área interna da moldura: recorta o conteúdo quando há zoom */
  private clip: HTMLDivElement;
  private stage: HTMLDivElement;
  private svg: SVGSVGElement;
  private fx: SVGGElement;
  private previewG: SVGGElement;
  private views: ArrowView[] = [];
  private occ: Int16Array;
  private n: number;
  private removed = 0;
  private animating = 0;
  locked = false;

  // zoom/pan
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: {
    startX: number;
    startY: number;
    moved: boolean;
    multi: boolean;
    pressTimer: number;
    previewing: boolean;
    pinch?: { d0: number; s0: number; qx: number; qy: number };
    panFrom?: { x: number; y: number; tx: number; ty: number };
  } | null = null;
  onZoomChange?: (zoomed: boolean) => void;

  constructor(
    private level: Level,
    private skin: Skin,
    private events: BoardEvents,
  ) {
    this.n = level.n;
    this.occ = buildOccupancy(level);
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.clip = document.createElement('div');
    this.clip.className = 'board-clip';
    this.el.appendChild(this.clip);
    this.stage = document.createElement('div');
    this.stage.className = 'board-stage';
    this.clip.appendChild(this.stage);
    // o tabuleiro é a moldura de pedra do tema (CSS); a skin dá só um leve tom por cima
    this.clip.style.setProperty('--skin-board', skin.board);

    this.svg = document.createElementNS(NS, 'svg');
    const vb = this.n + PAD * 2;
    this.svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${vb} ${vb}`);
    this.stage.appendChild(this.svg);

    for (let r = 0; r < this.n; r++)
      for (let c = 0; c < this.n; c++) {
        const d = document.createElementNS(NS, 'circle');
        d.setAttribute('cx', String(c + 0.5));
        d.setAttribute('cy', String(r + 0.5));
        d.setAttribute('r', '0.06');
        d.setAttribute('fill', skin.dot);
        this.svg.appendChild(d);
      }

    this.previewG = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.previewG);
    for (const a of level.arrows) this.views.push(this.makeView(a));
    this.fx = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.fx);

    this.bindInput();
  }

  get remaining(): number {
    return this.level.arrows.length - this.removed;
  }
  get total(): number {
    return this.level.arrows.length;
  }

  // ---------- desenho ----------
  private makeView(a: Arrow): ArrowView {
    const color = this.skin.colors[a.color % this.skin.colors.length];
    const dark = shade(color, 0.55);
    const g = document.createElementNS(NS, 'g');
    g.classList.add('arrow');
    const mkPath = (cls: string, stroke: string, width: number) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', cls);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', String(width));
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      return p;
    };
    const mkHead = (cls: string, fill: string, width: number) => {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('class', cls);
      p.setAttribute('fill', fill);
      p.setAttribute('stroke', fill);
      p.setAttribute('stroke-width', String(width));
      p.setAttribute('stroke-linejoin', 'round');
      return p;
    };
    const edge = mkPath('edge', dark, 0.42);
    const edgeHead = mkHead('edge', dark, 0.18);
    const body = mkPath('body', color, 0.3);
    const head = mkHead('head', color, 0.06);
    const shine = mkPath('shine', 'rgba(255,255,255,.38)', 0.08);
    g.append(edge, edgeHead, body, head, shine);
    this.svg.appendChild(g);
    const v: ArrowView = { a, g, paths: [edge, body, shine], heads: [edgeHead, head], alive: true, busy: false };
    this.draw(v, this.basePath(a), 0);
    return v;
  }

  private center(idx: number): Pt {
    return [(idx % this.n) + 0.5, Math.floor(idx / this.n) + 0.5];
  }

  private basePath(a: Arrow): Pt[] {
    return a.cells.map((i) => this.center(i));
  }

  private at(P: Pt[], s: number): Pt {
    if (s <= 0) return P[0];
    const i = Math.floor(s);
    if (i >= P.length - 1) return P[P.length - 1];
    const f = s - i;
    return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f];
  }

  /** Desenha a seta ocupando o trecho [t, t + comprimento - 1] do caminho P */
  private draw(v: ArrowView, P: Pt[], t: number): void {
    const len = v.a.cells.length;
    const s1 = t + len - 1;
    const pts: Pt[] = [this.at(P, t)];
    for (let i = Math.ceil(t); i < s1; i++) if (i > t) pts.push(P[i]);
    pts.push(this.at(P, s1));
    const d = 'M' + pts.map((p) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`).join('L');
    for (const p of v.paths) p.setAttribute('d', d);
    const H = pts[pts.length - 1];
    const [dy, dx] = DIRS[v.a.dir];
    const B: Pt = [H[0] - dx * 0.06, H[1] - dy * 0.06];
    const T: Pt = [H[0] + dx * 0.38, H[1] + dy * 0.38];
    const px = -dy * 0.26;
    const py = dx * 0.26;
    const pts2 = `${B[0] + px},${B[1] + py} ${T[0]},${T[1]} ${B[0] - px},${B[1] - py}`;
    for (const hd of v.heads) hd.setAttribute('points', pts2);
  }

  private animate(dur: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        // o timestamp do rAF pode ser anterior ao t0: limita entre 0 e 1
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        fn(p);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private burst(x: number, y: number, color: string): void {
    const parts: { el: SVGCircleElement; vx: number; vy: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', '0.08');
      el.setAttribute('fill', color);
      this.fx.appendChild(el);
      const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const sp = 0.8 + Math.random() * 0.9;
      parts.push({ el, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
    }
    this.animate(450, (p) => {
      for (const q of parts) {
        q.el.setAttribute('cx', String(x + q.vx * p));
        q.el.setAttribute('cy', String(y + q.vy * p));
        q.el.setAttribute('opacity', String(1 - p));
      }
    }).then(() => parts.forEach((q) => q.el.remove()));
  }

  // ---------- regras + animações ----------
  /** Tenta tirar a seta. Devolve 'exit', 'bump' ou 'ignored' */
  tap(id: number): 'exit' | 'bump' | 'ignored' {
    const v = this.views[id];
    if (!v || !v.alive || v.busy || this.locked) return 'ignored';
    this.clearPreview();
    const res = checkExit(this.n, this.occ, v.a);
    if (res.ok) this.exit(v, res.steps);
    else this.bump(v, res.steps, this.views[res.blocker]);
    return res.ok ? 'exit' : 'bump';
  }

  private exit(v: ArrowView, steps: number): void {
    v.alive = false;
    for (const c of v.a.cells) this.occ[c] = -1;
    this.removed++;
    this.events.onExit(v.a, this.remaining);
    this.animating++;
    const P = this.basePath(v.a);
    const [hr, hc] = [Math.floor(head(v.a) / this.n), head(v.a) % this.n];
    const [dr, dc] = DIRS[v.a.dir];
    const len = v.a.cells.length;
    for (let j = 1; j <= steps + len + 2; j++) P.push([hc + dc * j + 0.5, hr + dr * j + 0.5]);
    const tEnd = P.length - len;
    const edgeT = steps - 0.5; // quando a cabeça cruza a borda
    let burst = false;
    const color = this.skin.colors[v.a.color % this.skin.colors.length];
    this.animate(160 + tEnd * 42, (p) => {
      const t = tEnd * p * p;
      this.draw(v, P, t);
      if (!burst && t >= edgeT) {
        burst = true;
        const e = this.at(P, len - 1 + edgeT);
        this.burst(e[0], e[1], color);
      }
      if (p > 0.7) v.g.style.opacity = String(1 - (p - 0.7) / 0.3);
    }).then(() => {
      v.g.remove();
      this.animating--;
      if (this.removed === this.total && this.animating === 0) this.events.onClear();
    });
  }

  private bump(v: ArrowView, steps: number, blocker: ArrowView): void {
    v.busy = true;
    const P = this.basePath(v.a);
    const [hr, hc] = [Math.floor(head(v.a) / this.n), head(v.a) % this.n];
    const [dr, dc] = DIRS[v.a.dir];
    for (let j = 1; j <= steps; j++) P.push([hc + dc * j + 0.5, hr + dr * j + 0.5]);
    const m = Math.max(0.3, steps - 0.62);
    v.g.classList.add('bad');
    blocker.g.classList.remove('blink');
    void blocker.g.getBBox();
    blocker.g.classList.add('blink');
    this.events.onBump(v.a, blocker.a);
    this.animate(380, (p) => this.draw(v, P, m * Math.sin(Math.PI * p))).then(() => {
      this.draw(v, this.basePath(v.a), 0);
      v.g.classList.remove('bad');
      v.busy = false;
    });
  }

  /** Prévia do caminho: linha tracejada até a borda ou até quem bloqueia */
  preview(id: number): void {
    const v = this.views[id];
    if (!v || !v.alive) return;
    this.clearPreview();
    const res = checkExit(this.n, this.occ, v.a);
    const [hx, hy] = this.center(head(v.a));
    const [dy, dx] = DIRS[v.a.dir];
    const len = res.ok ? res.steps : res.steps - 0.55;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', String(hx + dx * 0.4));
    line.setAttribute('y1', String(hy + dy * 0.4));
    line.setAttribute('x2', String(hx + dx * len));
    line.setAttribute('y2', String(hy + dy * len));
    line.setAttribute('class', 'preview ' + (res.ok ? 'ok' : 'no'));
    this.previewG.appendChild(line);
    if (!res.ok) {
      const [bx, by] = [hx + dx * res.steps, hy + dy * res.steps];
      const x = document.createElementNS(NS, 'circle');
      x.setAttribute('cx', String(bx));
      x.setAttribute('cy', String(by));
      x.setAttribute('r', '0.38');
      x.setAttribute('class', 'preview-block');
      this.previewG.appendChild(x);
    }
    v.g.classList.add('lifted');
    this.events.onPreview?.(v.a, res.ok);
  }

  clearPreview(): void {
    this.previewG.innerHTML = '';
    for (const v of this.views) v.g.classList.remove('lifted');
  }

  /** Destaca uma seta que pode sair; devolve qual foi */
  hint(): Arrow | null {
    const free = freeArrows(this.n, this.occ, this.level.arrows, (id) => this.views[id].alive && !this.views[id].busy);
    if (!free.length) return null;
    const a = free[0];
    const g = this.views[a.id].g;
    g.classList.remove('hint');
    void g.getBBox();
    g.classList.add('hint');
    setTimeout(() => g.classList.remove('hint'), 2800);
    return a;
  }

  /** Seta livre para o tutorial apontar */
  firstFree(): Arrow | null {
    return freeArrows(this.n, this.occ, this.level.arrows, (id) => this.views[id].alive)[0] ?? null;
  }

  /** Ponto na tela (coordenadas do cliente) sobre a cabeça de uma seta */
  screenPoint(id: number): { x: number; y: number } {
    const [cx, cy] = this.center(head(this.level.arrows[id]));
    const r = this.svg.getBoundingClientRect();
    const k = r.width / (this.n + PAD * 2);
    return { x: r.left + (cx + PAD) * k, y: r.top + (cy + PAD) * k };
  }

  // ---------- entrada ----------
  private arrowAt(clientX: number, clientY: number): number {
    const r = this.svg.getBoundingClientRect();
    const k = (this.n + PAD * 2) / r.width;
    const x = (clientX - r.left) * k - PAD;
    const y = (clientY - r.top) * k - PAD;
    let best = -1;
    let bestD = 0.8; // tolerância generosa para dedos
    const c0 = Math.floor(x);
    const r0 = Math.floor(y);
    for (let r2 = r0 - 1; r2 <= r0 + 1; r2++)
      for (let c2 = c0 - 1; c2 <= c0 + 1; c2++) {
        if (r2 < 0 || c2 < 0 || r2 >= this.n || c2 >= this.n) continue;
        const id = this.occ[r2 * this.n + c2];
        if (id < 0) continue;
        const d = Math.hypot(c2 + 0.5 - x, r2 + 0.5 - y);
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
    return best;
  }

  private applyTransform(): void {
    const W = this.clip.clientWidth;
    const H = this.clip.clientHeight;
    this.tx = Math.min(0, Math.max(W - W * this.scale, this.tx));
    this.ty = Math.min(0, Math.max(H - H * this.scale, this.ty));
    this.stage.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    this.onZoomChange?.(this.scale > 1.02);
  }

  resetZoom(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.applyTransform();
  }

  private bindInput(): void {
    const el = this.el;
    // coordenadas relativas à área interna (onde o zoom acontece)
    const local = (e: PointerEvent) => {
      const r = this.clip.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignora */
      }
      this.pointers.set(e.pointerId, local(e));
      if (this.pointers.size === 1) {
        const id = this.arrowAt(e.clientX, e.clientY);
        const g = {
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          multi: false,
          previewing: false,
          pressTimer: 0,
          panFrom: { ...local(e), tx: this.tx, ty: this.ty },
        };
        this.gesture = g;
        if (id >= 0)
          g.pressTimer = window.setTimeout(() => {
            if (this.gesture === g && !g.moved && !g.multi) {
              g.previewing = true;
              this.preview(id);
            }
          }, LONG_PRESS_MS);
        (g as any).id = id;
      } else if (this.pointers.size === 2 && this.gesture) {
        const g = this.gesture;
        g.multi = true;
        clearTimeout(g.pressTimer);
        this.clearPreview();
        const [p1, p2] = [...this.pointers.values()];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        g.pinch = {
          d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
          s0: this.scale,
          qx: (mx - this.tx) / this.scale,
          qy: (my - this.ty) / this.scale,
        };
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId) || !this.gesture) return;
      this.pointers.set(e.pointerId, local(e));
      const g = this.gesture;
      if (g.pinch && this.pointers.size >= 2) {
        const [p1, p2] = [...this.pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        this.scale = Math.min(3, Math.max(1, g.pinch.s0 * (d / g.pinch.d0)));
        this.tx = mx - g.pinch.qx * this.scale;
        this.ty = my - g.pinch.qy * this.scale;
        this.applyTransform();
        return;
      }
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > MOVE_TOLERANCE) {
        if (!g.moved) {
          g.moved = true;
          clearTimeout(g.pressTimer);
        }
        if (this.scale > 1 && g.panFrom && !g.multi && !g.previewing) {
          const p = local(e);
          this.tx = g.panFrom.tx + (p.x - g.panFrom.x);
          this.ty = g.panFrom.ty + (p.y - g.panFrom.y);
          this.applyTransform();
        }
      }
    });

    const end = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const g = this.gesture;
      if (!g) return;
      if (this.pointers.size > 0) return; // ainda tem dedo na tela
      clearTimeout(g.pressTimer);
      this.gesture = null;
      if (g.previewing) {
        this.clearPreview();
        return;
      }
      if (g.moved || g.multi || e.type === 'pointercancel') return;
      const id = (g as any).id as number;
      if (id >= 0) this.tap(id);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
