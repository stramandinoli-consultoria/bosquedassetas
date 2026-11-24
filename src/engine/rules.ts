import { DIRS, type Arrow, type Level } from './types';

/** Mapa de ocupação: para cada célula, o id da seta que está nela ou -1 */
export function buildOccupancy(level: Level): Int16Array {
  const occ = new Int16Array(level.n * level.n).fill(-1);
  for (const a of level.arrows) for (const c of a.cells) occ[c] = a.id;
  return occ;
}

export const head = (a: Arrow): number => a.cells[a.cells.length - 1];

export interface ExitResult {
  /** true = caminho livre até a borda */
  ok: boolean;
  /** Passos até a borda (ok) ou até a seta que bloqueia (!ok) */
  steps: number;
  /** Id da seta que bloqueia, quando !ok */
  blocker: number;
  /** Células percorridas pela cabeça até sair ou bater */
  path: number[];
}

/**
 * Regra central do jogo: a seta sai se o raio a partir da cabeça,
 * na direção dela, estiver livre até a borda. O corpo segue o rastro
 * da cabeça, então só esse raio importa.
 */
export function checkExit(n: number, occ: Int16Array, a: Arrow): ExitResult {
  const [dr, dc] = DIRS[a.dir];
  const h = head(a);
  let r = Math.floor(h / n);
  let c = h % n;
  const path: number[] = [];
  let steps = 0;
  for (;;) {
    r += dr;
    c += dc;
    steps++;
    if (r < 0 || c < 0 || r >= n || c >= n) return { ok: true, steps, blocker: -1, path };
    const idx = r * n + c;
    const o = occ[idx];
    if (o >= 0 && o !== a.id) return { ok: false, steps, blocker: o, path };
    path.push(idx);
  }
}

export interface SolveResult {
  solvable: boolean;
  /** Número de "ondas" de remoção: quantas rodadas até limpar tudo removendo todas as setas livres por vez */
  depth: number;
  /** Quantas setas já podem sair no início */
  freeAtStart: number;
  /** Uma ordem de remoção válida (ids) */
  order: number[];
}

export function solve(level: Level): SolveResult {
  const occ = buildOccupancy(level);
  const alive = new Set(level.arrows.map((a) => a.id));
  const order: number[] = [];
  let depth = 0;
  let freeAtStart = -1;
  while (alive.size) {
    const free = level.arrows.filter((a) => alive.has(a.id) && checkExit(level.n, occ, a).ok);
    if (freeAtStart < 0) freeAtStart = free.length;
    if (!free.length) return { solvable: false, depth, freeAtStart, order };
    depth++;
    for (const a of free) {
      alive.delete(a.id);
      order.push(a.id);
      for (const c of a.cells) occ[c] = -1;
    }
  }
  return { solvable: true, depth, freeAtStart: Math.max(0, freeAtStart), order };
}

/** Setas que podem sair agora (para dicas) */
export function freeArrows(n: number, occ: Int16Array, arrows: Arrow[], alive: (id: number) => boolean): Arrow[] {
  return arrows.filter((a) => alive(a.id) && checkExit(n, occ, a).ok);
}
