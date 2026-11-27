import { DIRS, type Dir, type Level, type MechanicType } from './types';

/**
 * Estado de uma partida: a única fonte das regras do jogo.
 *
 * O tabuleiro (src/game/board.ts), a dica, o solver e o replay do servidor
 * passam todos por aqui, então a regra é uma só. A mesma lógica existe em C#
 * (server/Setas.Api/Engine/GameState.cs); se mudar algo aqui, mude lá também
 * e rode `npm run vectors` + `npm run api:test`.
 *
 * Regra base: a seta sai se o raio a partir da cabeça, na direção dela,
 * estiver livre até a borda. As mecânicas (docs/novas-mecanicas-de-dificuldades.md)
 * mudam quem pode sair e o que acontece depois de cada jogada válida.
 *
 * "Jogada válida" = um toque que tirou seta(s) do tabuleiro. Batidas não contam
 * como jogada válida e toques em seta travada (gelo) não contam como jogada nenhuma.
 */

export const OPPOSITE: readonly Dir[] = [1, 0, 3, 2];
/** Próxima direção girando 90°: horário (cima → direita → baixo → esquerda) e anti-horário */
const CW: readonly Dir[] = [3, 2, 0, 1];
const CCW: readonly Dir[] = [2, 3, 1, 0];

export interface GameState {
  readonly level: Level;
  readonly n: number;
  /** Id da seta viva em cada célula, ou -1 */
  occ: Int16Array;
  alive: boolean[];
  removed: number;
  /** Direção atual de cada seta (muda com órbita e mão dupla) */
  dir: Dir[];
  /** Mão dupla: true = a seta está invertida (a cauda virou cabeça) */
  rev: boolean[];
  /** Gelo: jogadas que ainda faltam (0 = livre) e o valor inicial */
  ice: number[];
  iceMax: number[];
  /** Magma: contagem regressiva (0 = não é magma) e o valor inicial */
  magma: number[];
  magmaMax: number[];
  /** Portões: para cada célula, o id da seta-chave (portão fechado) ou -1 */
  gate: Int16Array;
  /** Cipó: id da seta parceira, ou -1 */
  vine: number[];
  /** Mão dupla nesta seta */
  flip: boolean[];
  /** Órbita: 1 = horário, -1 = anti-horário, 0 = não gira */
  orbit: number[];
  /** Jogadas válidas feitas até agora */
  turns: number;
}

export type TapResult =
  | { kind: 'ignored' }
  /** Seta travada (gelo): não sai, não tira vida e não conta como jogada */
  | { kind: 'locked'; arrow: number; reason: 'ice' }
  /** Bateu: perde 1 vida. blocker = seta que bloqueou (ou -1), gate = célula do portão que bloqueou (ou -1) */
  | { kind: 'bump'; arrow: number; steps: number; blocker: number; gate: number; refrozen: number[] }
  /** Saiu (uma seta, ou duas quando há cipó). erupted = setas de magma que explodiram (1 vida cada) */
  | {
      kind: 'exit';
      exits: { id: number; steps: number }[];
      turned: number[];
      melted: number[];
      opened: number[];
      erupted: number[];
    };

export interface RayResult {
  ok: boolean;
  steps: number;
  blocker: number;
  gate: number;
  /** Células percorridas pela cabeça até sair ou bater */
  path: number[];
}

export function createState(level: Level): GameState {
  const n = level.n;
  const count = level.arrows.length;
  const occ = new Int16Array(n * n).fill(-1);
  for (const a of level.arrows) for (const c of a.cells) occ[c] = a.id;
  const s: GameState = {
    level,
    n,
    occ,
    alive: new Array(count).fill(true),
    removed: 0,
    dir: level.arrows.map((a) => a.dir),
    rev: new Array(count).fill(false),
    ice: new Array(count).fill(0),
    iceMax: new Array(count).fill(0),
    magma: new Array(count).fill(0),
    magmaMax: new Array(count).fill(0),
    gate: new Int16Array(n * n).fill(-1),
    vine: new Array(count).fill(-1),
    flip: new Array(count).fill(false),
    orbit: new Array(count).fill(0),
    turns: 0,
  };
  for (const m of level.mechanics ?? []) {
    switch (m.type) {
      case 'ice':
        s.ice[m.arrow] = s.iceMax[m.arrow] = m.count;
        break;
      case 'gate':
        s.gate[m.cell] = m.key;
        break;
      case 'vine':
        s.vine[m.a] = m.b;
        s.vine[m.b] = m.a;
        break;
      case 'flip':
        s.flip[m.arrow] = true;
        break;
      case 'orbit':
        s.orbit[m.arrow] = m.cw ? 1 : -1;
        break;
      case 'magma':
        s.magma[m.arrow] = s.magmaMax[m.arrow] = m.count;
        break;
    }
  }
  return s;
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    occ: s.occ.slice(),
    alive: s.alive.slice(),
    dir: s.dir.slice(),
    rev: s.rev.slice(),
    ice: s.ice.slice(),
    magma: s.magma.slice(),
    gate: s.gate.slice(),
    // iceMax, magmaMax, vine, flip e orbit não mudam durante a partida
  };
}

export const isCleared = (s: GameState): boolean => s.removed === s.level.arrows.length;

/** Células da seta, da cauda até a cabeça, já considerando a mão dupla */
export function cellsOf(s: GameState, id: number): number[] {
  const cells = s.level.arrows[id].cells;
  return s.rev[id] ? cells.slice().reverse() : cells;
}

export function headOf(s: GameState, id: number): number {
  const cells = s.level.arrows[id].cells;
  return s.rev[id] ? cells[0] : cells[cells.length - 1];
}

/** Direção atual da seta (considera órbita e mão dupla) */
export function dirOf(s: GameState, id: number): Dir {
  return s.rev[id] ? OPPOSITE[s.dir[id]] : s.dir[id];
}

/** Raio da cabeça até a borda. ignore = outra seta que está saindo junto (cipó) */
export function rayOf(s: GameState, id: number, ignore = -1): RayResult {
  const n = s.n;
  const [dr, dc] = DIRS[dirOf(s, id)];
  const h = headOf(s, id);
  let r = Math.floor(h / n);
  let c = h % n;
  const path: number[] = [];
  let steps = 0;
  for (;;) {
    r += dr;
    c += dc;
    steps++;
    if (r < 0 || c < 0 || r >= n || c >= n) return { ok: true, steps, blocker: -1, gate: -1, path };
    const idx = r * n + c;
    const o = s.occ[idx];
    if (o >= 0 && o !== id && o !== ignore) return { ok: false, steps, blocker: o, gate: -1, path };
    const g = s.gate[idx];
    if (g >= 0 && s.alive[g]) return { ok: false, steps, blocker: -1, gate: idx, path };
    path.push(idx);
  }
}

/** Seta que sai junto pelo cipó (ou -1) */
export function partnerOf(s: GameState, id: number): number {
  const p = s.vine[id];
  return p >= 0 && s.alive[p] ? p : -1;
}

/** A seta (e a parceira do cipó) está travada pelo gelo? */
export function isLocked(s: GameState, id: number): boolean {
  const p = partnerOf(s, id);
  return s.ice[id] > 0 || (p >= 0 && s.ice[p] > 0);
}

/** Toque numa seta: aplica a regra e devolve o que aconteceu (o estado é alterado) */
export function tap(s: GameState, id: number): TapResult {
  if (id < 0 || id >= s.alive.length || !s.alive[id]) return { kind: 'ignored' };
  const p = partnerOf(s, id);
  if (s.ice[id] > 0) return { kind: 'locked', arrow: id, reason: 'ice' };
  if (p >= 0 && s.ice[p] > 0) return { kind: 'locked', arrow: p, reason: 'ice' };

  const r1 = rayOf(s, id, p);
  const r2 = p >= 0 ? rayOf(s, p, id) : null;
  if (!r1.ok || (r2 && !r2.ok)) {
    const bad = !r1.ok ? id : p;
    const r = !r1.ok ? r1 : r2!;
    // a batida recongela 1 camada de cada seta ainda congelada
    const refrozen: number[] = [];
    for (let i = 0; i < s.alive.length; i++)
      if (s.alive[i] && s.ice[i] > 0 && s.ice[i] < s.iceMax[i]) {
        s.ice[i]++;
        refrozen.push(i);
      }
    return { kind: 'bump', arrow: bad, steps: r.steps, blocker: r.blocker, gate: r.gate, refrozen };
  }

  const exits = [{ id, steps: r1.steps }];
  if (p >= 0) exits.push({ id: p, steps: r2!.steps });
  const opened: number[] = [];
  for (const e of exits) {
    s.alive[e.id] = false;
    s.removed++;
    for (const c of s.level.arrows[e.id].cells) s.occ[c] = -1;
  }
  for (let c = 0; c < s.gate.length; c++) if (s.gate[c] >= 0 && !s.alive[s.gate[c]]) {
    opened.push(c);
    s.gate[c] = -1;
  }
  s.turns++;

  // efeitos da jogada válida nas setas que ficaram
  const turned: number[] = [];
  const melted: number[] = [];
  const erupted: number[] = [];
  for (let i = 0; i < s.alive.length; i++) {
    if (!s.alive[i]) continue;
    if (s.ice[i] > 0) {
      s.ice[i]--;
      melted.push(i);
    }
    if (s.flip[i]) {
      s.rev[i] = !s.rev[i];
      turned.push(i);
    }
    if (s.orbit[i]) {
      s.dir[i] = nextOrbit(s, i);
      turned.push(i);
    }
    if (s.magma[i] > 0) {
      s.magma[i]--;
      if (s.magma[i] === 0) {
        erupted.push(i);
        s.magma[i] = s.magmaMax[i];
      }
    }
  }
  return { kind: 'exit', exits, turned, melted, opened, erupted };
}

/** Próxima direção da órbita, pulando a que apontaria para dentro do próprio corpo */
function nextOrbit(s: GameState, id: number): Dir {
  const cells = s.level.arrows[id].cells;
  const h = cells[cells.length - 1];
  const neck = cells[cells.length - 2];
  const n = s.n;
  // direção do pescoço para a cabeça; o oposto dela aponta para dentro do corpo
  const dr = Math.floor(h / n) - Math.floor(neck / n);
  const dc = (h % n) - (neck % n);
  const inward = DIRS.findIndex(([a, b]) => a === -dr && b === -dc);
  const step = s.orbit[id] > 0 ? CW : CCW;
  let d = step[s.dir[id]];
  if (d === inward) d = step[d];
  return d;
}

/** Vidas perdidas por um toque */
export function livesLost(r: TapResult): number {
  if (r.kind === 'bump') return 1;
  if (r.kind === 'exit') return r.erupted.length;
  return 0;
}

/** Setas que podem sair agora sem custar vida (para dicas e tutorial) */
export function safeMoves(s: GameState): number[] {
  const out: number[] = [];
  for (let id = 0; id < s.alive.length; id++) {
    if (!s.alive[id]) continue;
    const p = partnerOf(s, id);
    if (p >= 0 && p < id) continue; // o par do cipó entra uma vez só
    const t = cloneState(s);
    const r = tap(t, id);
    if (r.kind === 'exit' && r.erupted.length === 0) out.push(id);
  }
  return out;
}

function keyOf(s: GameState, watch: number[]): string {
  let k = '';
  for (let i = 0; i < s.alive.length; i++) k += s.alive[i] ? '1' : '0';
  for (const i of watch) k += ',' + s.dir[i] + (s.rev[i] ? 'r' : '') + s.ice[i] + ':' + s.magma[i];
  return k;
}

/**
 * Solver: procura uma ordem de toques que limpa o tabuleiro sem perder vida.
 * Busca em profundidade com memória dos estados já vistos e limite de nós,
 * para nunca travar o jogo. Devolve a ordem ou null (sem solução ou limite estourado).
 */
export function solveState(start: GameState, limit = 20000): number[] | null {
  const watch: number[] = [];
  for (let i = 0; i < start.alive.length; i++)
    if (start.alive[i] && (start.flip[i] || start.orbit[i] || start.iceMax[i] || start.magmaMax[i])) watch.push(i);
  const seen = new Set<string>();
  let nodes = 0;
  const path: number[] = [];
  // ordem de tentativa: magma (menor contador primeiro), depois as outras setas com mecânica
  // (podem girar ou travar se esperar) e por fim as clássicas, que nunca pioram o tabuleiro
  const rank = (s: GameState, id: number) =>
    s.magma[id] > 0 ? s.magma[id] : s.flip[id] || s.orbit[id] || s.vine[id] >= 0 ? 20 : 40;
  const dfs = (s: GameState): boolean => {
    if (isCleared(s)) return true;
    if (++nodes > limit) return false;
    const key = keyOf(s, watch);
    if (seen.has(key)) return false;
    seen.add(key);
    const cands: number[] = [];
    for (let id = 0; id < s.alive.length; id++) {
      if (!s.alive[id]) continue;
      const p = partnerOf(s, id);
      if (p >= 0 && p < id) continue;
      if (isLocked(s, id) || !rayOf(s, id, p).ok || (p >= 0 && !rayOf(s, p, id).ok)) continue;
      cands.push(id);
    }
    cands.sort((a, b) => rank(s, a) - rank(s, b) || a - b);
    for (const id of cands) {
      const t = cloneState(s);
      const r = tap(t, id);
      if (r.kind !== 'exit' || r.erupted.length) continue;
      path.push(id);
      if (dfs(t)) return true;
      path.pop();
      if (nodes > limit) return false;
    }
    return false;
  };
  return dfs(cloneState(start)) ? path.slice() : null;
}

/** Pesos do bônus de dificuldade por mecânica (estimativas do documento de design) */
const WEIGHT: Record<MechanicType, number> = { ice: 1.2, gate: 1.4, vine: 1.5, flip: 1.8, orbit: 2.2, magma: 2.0 };

/**
 * Bônus de dificuldade das mecânicas: Σ peso × intensidade (quantidade de elementos, máx. 5)
 * + 3 por mecânica extra. Fica separado do `difficulty` da fase (que mede só a geometria).
 */
export function mechanicBonus(level: Level): number {
  const count = new Map<MechanicType, number>();
  for (const m of level.mechanics ?? []) count.set(m.type, (count.get(m.type) ?? 0) + 1);
  let b = 0;
  for (const [t, c] of count) b += WEIGHT[t] * Math.min(5, c);
  if (count.size > 1) b += 3 * (count.size - 1);
  return Math.round(b * 10) / 10;
}
