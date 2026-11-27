import { mulberry32, shuffle } from './rng';
import { solve } from './rules';
import { DIRS, type Arrow, type Dir, type GenerateOptions, type Level, type Mechanic, type PackedLevel } from './types';

/**
 * Gera uma fase SEMPRE solucionável.
 *
 * Cada seta nova só é colocada se o raio da cabeça dela estiver livre
 * no momento da colocação. Remover as setas na ordem inversa da colocação
 * resolve a fase, então existe solução por construção.
 *
 * Para deixar as fases mais interessantes, o corpo das setas novas tende
 * a passar por cima dos raios das setas antigas, criando dependências.
 */
export function generate(opts: GenerateOptions): Level {
  const { n, maxLen, density, seed } = opts;
  const rng = mulberry32(seed);
  const occ = new Int16Array(n * n).fill(-1);
  const rayCover = new Uint16Array(n * n);
  const arrows: Arrow[] = [];
  const inb = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n;
  const target = Math.floor(n * n * density);
  let filled = 0;
  let fails = 0;

  while (filled < target && fails < 900) {
    const empties: number[] = [];
    for (let i = 0; i < n * n; i++) if (occ[i] < 0) empties.push(i);
    if (!empties.length) break;
    const h = empties[Math.floor(rng() * empties.length)];
    const hr = Math.floor(h / n);
    const hc = h % n;

    let dir: Dir | -1 = -1;
    let ray: Set<number> | null = null;
    for (const d of shuffle([0, 1, 2, 3] as Dir[], rng)) {
      let r = hr + DIRS[d][0];
      let c = hc + DIRS[d][1];
      let ok = true;
      const rs = new Set<number>();
      while (inb(r, c)) {
        if (occ[r * n + c] >= 0) {
          ok = false;
          break;
        }
        rs.add(r * n + c);
        r += DIRS[d][0];
        c += DIRS[d][1];
      }
      if (ok) {
        dir = d;
        ray = rs;
        break;
      }
    }
    if (dir < 0 || !ray) {
      fails++;
      continue;
    }

    const want = 2 + Math.floor(rng() * (maxLen - 1));
    const body = [h];
    const inBody = new Set([h]);
    let cur: [number, number] = [hr, hc];
    while (body.length < want) {
      const opts2 = DIRS.map(([dr, dc]) => [cur[0] + dr, cur[1] + dc] as [number, number]).filter(
        ([r, c]) => inb(r, c) && occ[r * n + c] < 0 && !inBody.has(r * n + c) && !ray!.has(r * n + c),
      );
      if (!opts2.length) break;
      let next: [number, number] | undefined;
      if (body.length === 1) {
        // pescoço reto atrás da cabeça, para a seta ficar legível
        const back = opts2.find(([r, c]) => r === hr - DIRS[dir][0] && c === hc - DIRS[dir][1]);
        if (back && rng() < 0.8) next = back;
      }
      if (!next) {
        // prefere passar por cima do raio de setas antigas (cria dependência)
        const blocking = opts2.filter(([r, c]) => rayCover[r * n + c] > 0);
        if (blocking.length && rng() < 0.55) next = blocking[Math.floor(rng() * blocking.length)];
      }
      if (!next && body.length >= 2 && rng() < 0.45) {
        const p = body[body.length - 2];
        const st: [number, number] = [2 * cur[0] - Math.floor(p / n), 2 * cur[1] - (p % n)];
        next = opts2.find(([r, c]) => r === st[0] && c === st[1]);
      }
      if (!next) next = opts2[Math.floor(rng() * opts2.length)];
      const id = next[0] * n + next[1];
      body.push(id);
      inBody.add(id);
      cur = next;
    }
    if (body.length < 2) {
      fails++;
      continue;
    }
    const id = arrows.length;
    for (const c of body) occ[c] = id;
    for (const c of ray) rayCover[c]++;
    // cor sempre diferente da seta anterior, para setas vizinhas não se confundirem
    const prevColor = arrows.length ? arrows[arrows.length - 1].color : -1;
    const color = prevColor < 0 ? Math.floor(rng() * 8) : (prevColor + 1 + Math.floor(rng() * 7)) % 8;
    arrows.push({ id, cells: body.slice().reverse(), dir: dir as Dir, color });
    filled += body.length;
  }

  const level: Level = { n, arrows, difficulty: 0 };
  level.difficulty = difficultyOf(level);
  return level;
}

/**
 * Pontuação de dificuldade. Leva em conta:
 * - profundidade da cadeia de dependências (quantas rodadas para limpar)
 * - quantidade de setas
 * - quão poucas setas estão livres no início
 */
export function difficultyOf(level: Level): number {
  const s = solve(level);
  if (!s.solvable) return Infinity;
  const count = level.arrows.length;
  const freeRatio = count ? s.freeAtStart / count : 1;
  return Math.round((s.depth * 4 + count * 0.6 + (1 - freeRatio) * 12 + level.n) * 10) / 10;
}

/** Parâmetros sugeridos para uma faixa de dificuldade 0..1 */
export function paramsFor(t: number, seed: number): GenerateOptions {
  const n = Math.min(12, 5 + Math.round(t * 7));
  const maxLen = Math.min(10, 3 + Math.round(t * 7));
  return { n, maxLen, density: 0.78 + t * 0.1, seed };
}

export function pack(level: Level): PackedLevel {
  const arrows = level.arrows.map((a) => [a.dir, a.color, ...a.cells]);
  if (!level.mechanics?.length) return [level.n, level.difficulty, arrows];
  return [level.n, level.difficulty, arrows, level.mechanics.map(packMechanic)];
}

export function unpack(p: PackedLevel): Level {
  const [n, difficulty, list, mech] = p as [number, number, number[][], number[][]?];
  const level: Level = {
    n,
    difficulty,
    arrows: list.map(([dir, color, ...cells], id) => ({ id, dir: dir as Dir, color, cells })),
  };
  if (mech?.length) level.mechanics = mech.map(unpackMechanic);
  return level;
}

function packMechanic(m: Mechanic): number[] {
  switch (m.type) {
    case 'ice': return [0, m.arrow, m.count];
    case 'gate': return [1, m.cell, m.key];
    case 'vine': return [2, m.a, m.b];
    case 'flip': return [3, m.arrow];
    case 'orbit': return [4, m.arrow, m.cw ? 1 : 0];
    case 'magma': return [5, m.arrow, m.count];
  }
}

function unpackMechanic([code, x, y]: number[]): Mechanic {
  switch (code) {
    case 0: return { type: 'ice', arrow: x, count: y };
    case 1: return { type: 'gate', cell: x, key: y };
    case 2: return { type: 'vine', a: x, b: y };
    case 3: return { type: 'flip', arrow: x };
    case 4: return { type: 'orbit', arrow: x, cw: y === 1 };
    case 5: return { type: 'magma', arrow: x, count: y };
    default: throw new Error('Mecânica desconhecida no levels.json: ' + code);
  }
}
