import {
  cellsOf,
  createState,
  dirOf,
  headOf,
  partnerOf,
  rayOf,
  safeMoves,
  solveState,
  tap as applyTap,
  type GameState,
  type TapResult,
} from '../engine/state';
import { DIRS, type Arrow, type Level } from '../engine/types';
import type { Skin } from '../state/skins';

const NS = 'http://www.w3.org/2000/svg';
const PAD = 0.15;
const LONG_PRESS_MS = 280;
const MOVE_TOLERANCE = 10;
/** Símbolos dos pares chave/portão (cor + forma, para não depender só de cor) */
const GATE_SYMBOLS = [
  { s: '♦', c: '#ff5a5a' },
  { s: '♣', c: '#3ddc84' },
  { s: '♠', c: '#5aa8ff' },
  { s: '♥', c: '#ff8ad8' },
  { s: '★', c: '#ffd23d' },
];

export interface BoardEvents {
  /**
   * Resultado de um toque que contou (saída, batida ou seta travada).
   * tapped = seta tocada (é o que vai para a lista de jogadas do servidor).
   */
  onTap(tapped: number, r: Exclude<TapResult, { kind: 'ignored' }>, remaining: number): void;
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
  /** marcas da mecânica (gelo, magma, órbita, símbolo da chave…) */
  marks: SVGGElement;
  badge?: SVGTextElement;
  coat?: SVGPathElement;
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
 *
 * As regras ficam todas em src/engine/state.ts; aqui é só desenho e animação.
 */
export class Board {
  readonly el: HTMLDivElement;
  /** área interna da moldura: recorta o conteúdo quando há zoom */
  private clip: HTMLDivElement;
  private stage: HTMLDivElement;
  private svg: SVGSVGElement;
  private fx: SVGGElement;
  private previewG: SVGGElement;
  /** portões e cipós */
  private mechG: SVGGElement;
  private views: ArrowView[] = [];
  private gateEls = new Map<number, SVGGElement>();
  private vineEls = new Map<number, SVGPathElement>();
  readonly state: GameState;
  private n: number;
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
    this.state = createState(level);
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

    this.mechG = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.mechG);
    this.previewG = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.previewG);
    for (const a of level.arrows) this.views.push(this.makeView(a));
    this.drawMechanics();
    this.fx = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.fx);

    this.bindInput();
  }

  get remaining(): number {
    return this.level.arrows.length - this.state.removed;
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
    const marks = document.createElementNS(NS, 'g');
    marks.setAttribute('class', 'marks');
    g.append(edge, edgeHead, body, head, shine, marks);
    this.svg.appendChild(g);
    const v: ArrowView = { a, g, paths: [edge, body, shine], heads: [edgeHead, head], marks, alive: true, busy: false };
    this.draw(v, this.basePath(a.id), 0);
    return v;
  }

  private center(idx: number): Pt {
    return [(idx % this.n) + 0.5, Math.floor(idx / this.n) + 0.5];
  }

  /** Centro das células da seta, na orientação atual (a mão dupla inverte) */
  private basePath(id: number): Pt[] {
    return cellsOf(this.state, id).map((i) => this.center(i));
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
    v.coat?.setAttribute('d', d);
    const H = pts[pts.length - 1];
    const [dy, dx] = DIRS[dirOf(this.state, v.a.id)];
    const B: Pt = [H[0] - dx * 0.06, H[1] - dy * 0.06];
    const T: Pt = [H[0] + dx * 0.38, H[1] + dy * 0.38];
    const px = -dy * 0.26;
    const py = dx * 0.26;
    const pts2 = `${B[0] + px},${B[1] + py} ${T[0]},${T[1]} ${B[0] - px},${B[1] - py}`;
    for (const hd of v.heads) hd.setAttribute('points', pts2);
  }

  // ---------- mecânicas ----------
  private svgText(x: number, y: number, text: string, cls: string): SVGTextElement {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x.toFixed(3));
    t.setAttribute('y', y.toFixed(3));
    t.setAttribute('class', cls);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.textContent = text;
    return t;
  }

  /** Célula do meio do corpo, onde fica o selo da mecânica (longe da ponta) */
  private badgeAt(id: number): Pt {
    const cells = this.level.arrows[id].cells;
    return this.center(cells[Math.max(0, Math.floor((cells.length - 1) / 2))]);
  }

  private drawMechanics(): void {
    let gateIdx = 0;
    for (const m of this.level.mechanics ?? []) {
      switch (m.type) {
        case 'ice': {
          const v = this.views[m.arrow];
          v.g.classList.add('mech-ice');
          const coat = document.createElementNS(NS, 'path');
          coat.setAttribute('class', 'ice-coat');
          v.g.insertBefore(coat, v.marks);
          v.coat = coat;
          const [x, y] = this.badgeAt(m.arrow);
          v.badge = this.svgText(x, y, '', 'mech-badge ice-badge');
          v.marks.appendChild(v.badge);
          this.draw(v, this.basePath(m.arrow), 0);
          break;
        }
        case 'magma': {
          const v = this.views[m.arrow];
          v.g.classList.add('mech-magma');
          const [x, y] = this.badgeAt(m.arrow);
          v.badge = this.svgText(x, y, '', 'mech-badge magma-badge');
          v.marks.appendChild(v.badge);
          break;
        }
        case 'flip': {
          const v = this.views[m.arrow];
          v.g.classList.add('mech-flip');
          const [x, y] = this.badgeAt(m.arrow);
          v.marks.appendChild(this.svgText(x, y, '⇄', 'mech-badge flip-badge'));
          break;
        }
        case 'orbit': {
          const v = this.views[m.arrow];
          v.g.classList.add('mech-orbit');
          const [hx, hy] = this.center(headOf(this.state, m.arrow));
          const ring = document.createElementNS(NS, 'circle');
          ring.setAttribute('cx', String(hx));
          ring.setAttribute('cy', String(hy));
          ring.setAttribute('r', '0.46');
          ring.setAttribute('class', 'orbit-ring' + (m.cw ? '' : ' ccw'));
          ring.style.transformOrigin = `${hx}px ${hy}px`;
          v.marks.appendChild(ring);
          const [bx, by] = this.badgeAt(m.arrow);
          v.marks.appendChild(this.svgText(bx, by, m.cw ? '↻' : '↺', 'mech-badge orbit-badge'));
          break;
        }
        case 'vine': {
          const [ax, ay] = this.badgeAt(m.a);
          const [bx, by] = this.badgeAt(m.b);
          // curva levemente arqueada entre o meio das duas setas
          const mx = (ax + bx) / 2 - (by - ay) * 0.2;
          const my = (ay + by) / 2 + (bx - ax) * 0.2;
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', `M${ax} ${ay} Q${mx} ${my} ${bx} ${by}`);
          p.setAttribute('class', 'vine');
          this.mechG.appendChild(p);
          this.vineEls.set(m.a, p);
          this.vineEls.set(m.b, p);
          break;
        }
        case 'gate': {
          const sym = GATE_SYMBOLS[gateIdx++ % GATE_SYMBOLS.length];
          const [cx, cy] = this.center(m.cell);
          const g = document.createElementNS(NS, 'g');
          g.setAttribute('class', 'gate');
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', String(cx - 0.42));
          r.setAttribute('y', String(cy - 0.42));
          r.setAttribute('width', '0.84');
          r.setAttribute('height', '0.84');
          r.setAttribute('rx', '0.12');
          r.setAttribute('class', 'gate-box');
          g.appendChild(r);
          for (const dx of [-0.22, 0, 0.22]) {
            const bar = document.createElementNS(NS, 'line');
            bar.setAttribute('x1', String(cx + dx));
            bar.setAttribute('x2', String(cx + dx));
            bar.setAttribute('y1', String(cy - 0.36));
            bar.setAttribute('y2', String(cy + 0.36));
            bar.setAttribute('class', 'gate-bar');
            g.appendChild(bar);
          }
          const label = this.svgText(cx, cy, sym.s, 'gate-symbol');
          label.setAttribute('fill', sym.c);
          g.appendChild(label);
          this.mechG.appendChild(g);
          this.gateEls.set(m.cell, g);
          const key = this.views[m.key];
          const [kx, ky] = this.badgeAt(m.key);
          const kb = this.svgText(kx, ky, sym.s, 'mech-badge key-badge');
          kb.setAttribute('fill', sym.c);
          key.marks.appendChild(kb);
          key.g.classList.add('mech-key');
          break;
        }
      }
    }
    this.refreshBadges();
  }

  /** Atualiza os números do gelo e do magma */
  private refreshBadges(): void {
    const s = this.state;
    for (const v of this.views) {
      const id = v.a.id;
      if (!v.badge) continue;
      if (s.iceMax[id]) {
        v.badge.textContent = s.ice[id] > 0 ? `❄${s.ice[id]}` : '';
        v.g.classList.toggle('frozen', s.ice[id] > 0);
      } else if (s.magmaMax[id]) {
        v.badge.textContent = `🔥${s.magma[id]}`;
        v.g.classList.toggle('magma-hot', s.magma[id] <= 2);
      }
    }
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

  private flash(el: Element, cls: string, ms: number): void {
    el.classList.remove(cls);
    void (el as SVGGraphicsElement).getBBox?.();
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  // ---------- regras + animações ----------
  /** Tenta tirar a seta. Devolve o tipo do resultado */
  tap(id: number): TapResult['kind'] {
    const v = this.views[id];
    if (!v || !v.alive || v.busy || this.locked) return 'ignored';
    const p = partnerOf(this.state, id);
    if (p >= 0 && this.views[p].busy) return 'ignored';
    this.clearPreview();
    const r = applyTap(this.state, id);
    if (r.kind === 'ignored') return 'ignored';
    if (r.kind === 'locked') {
      this.flash(this.views[r.arrow].g, 'locked-shake', 420);
    } else if (r.kind === 'bump') {
      this.bump(this.views[r.arrow], r.steps, r.blocker >= 0 ? this.views[r.blocker] : null, r.gate);
      this.refreshBadges();
    } else {
      for (const e of r.exits) this.exit(this.views[e.id], e.steps);
      for (const c of r.opened) {
        const g = this.gateEls.get(c);
        if (g) {
          g.classList.add('open');
          setTimeout(() => g.remove(), 500);
        }
      }
      for (const t of r.turned) this.turn(this.views[t]);
      for (const m of r.erupted) {
        this.flash(this.views[m].g, 'erupt', 700);
        this.flash(this.el, 'quake', 500);
      }
      this.refreshBadges();
    }
    this.events.onTap(id, r, this.remaining);
    return r.kind;
  }

  /** Seta mudou de direção (órbita) ou inverteu (mão dupla): redesenha com um giro rápido */
  private turn(v: ArrowView): void {
    this.flash(v.g, 'turning', 300);
    this.draw(v, this.basePath(v.a.id), 0);
  }

  private exit(v: ArrowView, steps: number): void {
    v.alive = false;
    v.marks.style.display = 'none';
    const vine = this.vineEls.get(v.a.id);
    if (vine) {
      vine.classList.add('cut');
      setTimeout(() => vine.remove(), 300);
    }
    this.animating++;
    const id = v.a.id;
    const P = this.basePath(id);
    const h = headOf(this.state, id);
    const [hr, hc] = [Math.floor(h / this.n), h % this.n];
    const [dr, dc] = DIRS[dirOf(this.state, id)];
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
      if (this.remaining === 0 && this.animating === 0) this.events.onClear();
    });
  }

  private bump(v: ArrowView, steps: number, blocker: ArrowView | null, gateCell: number): void {
    v.busy = true;
    const id = v.a.id;
    const P = this.basePath(id);
    const h = headOf(this.state, id);
    const [hr, hc] = [Math.floor(h / this.n), h % this.n];
    const [dr, dc] = DIRS[dirOf(this.state, id)];
    for (let j = 1; j <= steps; j++) P.push([hc + dc * j + 0.5, hr + dr * j + 0.5]);
    const m = Math.max(0.3, steps - 0.62);
    v.g.classList.add('bad');
    if (blocker) this.flash(blocker.g, 'blink', 700);
    const gate = gateCell >= 0 ? this.gateEls.get(gateCell) : undefined;
    if (gate) this.flash(gate, 'blink', 700);
    this.animate(380, (p) => this.draw(v, P, m * Math.sin(Math.PI * p))).then(() => {
      this.draw(v, this.basePath(id), 0);
      v.g.classList.remove('bad');
      v.busy = false;
    });
  }

  /** Prévia do caminho: linha tracejada até a borda ou até o que bloqueia (com cipó, as duas setas) */
  preview(id: number): void {
    const v = this.views[id];
    if (!v || !v.alive) return;
    this.clearPreview();
    const p = partnerOf(this.state, id);
    let allOk = true;
    for (const [me, other] of p >= 0 ? [[id, p], [p, id]] : [[id, -1]]) {
      const res = rayOf(this.state, me, other);
      allOk = allOk && res.ok;
      const [hx, hy] = this.center(headOf(this.state, me));
      const [dy, dx] = DIRS[dirOf(this.state, me)];
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
      this.views[me].g.classList.add('lifted');
    }
    this.events.onPreview?.(v.a, allOk && this.state.ice[id] === 0);
  }

  clearPreview(): void {
    this.previewG.innerHTML = '';
    for (const v of this.views) v.g.classList.remove('lifted');
  }

  /**
   * Próxima seta de um caminho que resolve a fase a partir de agora (usa o solver,
   * que conhece as mecânicas). Se o solver não achar, mostra qualquer seta que sai sem custar vida.
   */
  private nextGoodMove(): number {
    const plan = solveState(this.state, 20000);
    if (plan?.length) return plan[0];
    return safeMoves(this.state)[0] ?? -1;
  }

  /** Destaca uma seta que pode sair; devolve qual foi */
  hint(): Arrow | null {
    if (this.views.some((v) => v.busy)) return null;
    const id = this.nextGoodMove();
    if (id < 0) return null;
    const p = partnerOf(this.state, id);
    for (const x of p >= 0 ? [id, p] : [id]) this.flash(this.views[x].g, 'hint', 2800);
    return this.level.arrows[id];
  }

  /** Seta livre para o tutorial apontar */
  firstFree(): Arrow | null {
    const id = safeMoves(this.state)[0];
    return id === undefined ? null : this.level.arrows[id];
  }

  /** Ponto na tela (coordenadas do cliente) sobre a cabeça de uma seta */
  screenPoint(id: number): { x: number; y: number } {
    const [cx, cy] = this.center(headOf(this.state, id));
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
        const id = this.state.occ[r2 * this.n + c2];
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
