import { mulberry32, hashSeed } from './rng';
import { buildOccupancy, checkExit } from './rules';
import { createState, solveState } from './state';
import { DIRS, type Level, type Mechanic, type MechanicType } from './types';

/**
 * Caminho "A" do documento de mecânicas: as setas das fases prontas continuam
 * as mesmas e as mecânicas que funcionam como camada por cima são acrescentadas
 * (gelo-contador, magma, mão dupla, cipós, chaves e portões, órbita).
 *
 * Tudo vem da semente da fase, então o resultado é sempre o mesmo. Uma fase só
 * recebe a mecânica se o solver achar uma ordem que limpa o tabuleiro sem perder
 * vida; senão tenta outra combinação e, no último caso, usa menos elementos.
 *
 * Roda dentro de `npm run levels` (scripts/generate-levels.ts), que grava o
 * resultado no levels.json do jogo e do servidor. O servidor não gera mecânica
 * nenhuma: só lê o levels.json e aplica as regras (GameState.cs).
 */

/** Mecânica principal de cada mundo (índice do mundo, a partir de 0). Mundos ausentes ficam clássicos por enquanto. */
export const WORLD_MECHANIC: Partial<Record<number, MechanicType>> = {
  3: 'ice', // Geleira (fases 61–80)
  4: 'magma', // Vulcão (81–100)
  5: 'flip', // Cidade (101–120)
  6: 'vine', // Selva (121–140)
  11: 'gate', // Castelo (221–240)
  12: 'orbit', // Galáxia (241–260)
};

const WORLD_SIZE = 20;

/** Quantos elementos da mecânica, conforme a posição da fase no mundo (0..19): apresentação, aprendizado, domínio, revisão e chefe */
export function intensityAt(pos: number): number {
  if (pos === 0) return 1;
  if (pos < 7) return pos < 4 ? 1 : 2;
  if (pos < 14) return pos < 11 ? 2 : 3;
  if (pos < 19) return 3;
  return 4;
}

type Rng = () => number;

interface Info {
  level: Level;
  /** Onda em que a seta sai na solução clássica (0 = livre no início) */
  wave: number[];
  /** Posição da seta numa ordem de solução clássica */
  order: number[];
  occ: Int16Array;
}

function analyse(level: Level): Info {
  const occ = buildOccupancy(level);
  const work = occ.slice();
  const alive = new Set(level.arrows.map((a) => a.id));
  const wave = new Array(level.arrows.length).fill(-1);
  const order = new Array(level.arrows.length).fill(-1);
  let w = 0;
  let k = 0;
  while (alive.size) {
    const free = level.arrows.filter((a) => alive.has(a.id) && checkExit(level.n, work, a).ok);
    if (!free.length) break;
    for (const a of free) {
      wave[a.id] = w;
      order[a.id] = k++;
      alive.delete(a.id);
      for (const c of a.cells) work[c] = -1;
    }
    w++;
  }
  return { level, wave, order, occ };
}

const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)];

function shuffled<T>(list: T[], rng: Rng): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Seta reta com o pescoço na mesma direção da ponta (a mão dupla inverte a seta inteira) */
function isStraight(level: Level, id: number): boolean {
  const a = level.arrows[id];
  const n = level.n;
  const [dr, dc] = DIRS[a.dir];
  for (let i = 1; i < a.cells.length; i++) {
    const p = a.cells[i - 1];
    const q = a.cells[i];
    if (Math.floor(q / n) - Math.floor(p / n) !== dr || (q % n) - (p % n) !== dc) return false;
  }
  return true;
}

const headCell = (level: Level, id: number) => level.arrows[id].cells[level.arrows[id].cells.length - 1];
function dist(level: Level, a: number, b: number): number {
  const n = level.n;
  const x = headCell(level, a);
  const y = headCell(level, b);
  return Math.abs(Math.floor(x / n) - Math.floor(y / n)) + Math.abs((x % n) - (y % n));
}

/** Monta uma proposta com k elementos da mecânica (pode devolver menos se não houver candidatos) */
function propose(type: MechanicType, k: number, pos: number, info: Info, rng: Rng): Mechanic[] {
  const { level, wave, order } = info;
  const ids = level.arrows.map((a) => a.id);
  const out: Mechanic[] = [];
  const used = new Set<number>();
  const take = (cands: number[], make: (id: number) => Mechanic | null) => {
    for (const id of shuffled(cands, rng)) {
      if (out.length >= k) break;
      if (used.has(id)) continue;
      const m = make(id);
      if (!m) continue;
      used.add(id);
      out.push(m);
    }
  };

  switch (type) {
    case 'ice': {
      // congela setas que sairiam cedo: o jogador precisa trabalhar em volta delas
      const early = ids.filter((id) => wave[id] <= 1);
      take(early.length >= k ? early : ids, (id) => ({
        type: 'ice',
        arrow: id,
        count: Math.min(5, 2 + Math.floor(rng() * 2) + (pos >= 7 ? 1 : 0) + (pos === 19 ? 1 : 0)),
      }));
      break;
    }
    case 'magma': {
      // contador = jogadas até a vez dela numa solução + folga (que diminui ao longo do mundo)
      const slack = pos < 7 ? 3 : pos < 14 ? 2 : 1;
      const cands = ids.filter((id) => order[id] >= 1 && order[id] + 1 + slack <= 9);
      take(cands, (id) => ({ type: 'magma', arrow: id, count: order[id] + 1 + slack }));
      break;
    }
    case 'flip':
      take(
        ids.filter((id) => isStraight(level, id)),
        (id) => ({ type: 'flip', arrow: id }),
      );
      break;
    case 'orbit':
      // anti-horário só a partir da revisão (fase 15 do mundo)
      take(ids, (id) => ({ type: 'orbit', arrow: id, cw: pos < 14 ? true : rng() < 0.5 }));
      break;
    case 'vine': {
      // pares que saem na mesma onda; no começo do mundo, perto um do outro
      for (const a of shuffled(ids, rng)) {
        if (out.length >= k) break;
        if (used.has(a)) continue;
        const mates = ids.filter((b) => b !== a && !used.has(b) && wave[b] === wave[a]);
        if (!mates.length) continue;
        mates.sort((x, y) => dist(level, a, x) - dist(level, a, y));
        const b = pos < 7 ? mates[0] : pick(mates, rng);
        used.add(a);
        used.add(b);
        out.push({ type: 'vine', a: Math.min(a, b), b: Math.max(a, b) });
      }
      break;
    }
    case 'gate': {
      // portão numa célula vazia no caminho de uma seta; a chave é outra seta
      const gated = new Set<number>();
      for (const b of shuffled(ids.filter((id) => wave[id] >= 1 || pos < 4), rng)) {
        if (out.length >= k) break;
        const a = level.arrows[b];
        const [dr, dc] = DIRS[a.dir];
        const h = headCell(level, b);
        let r = Math.floor(h / level.n) + dr;
        let c = (h % level.n) + dc;
        const empties: number[] = [];
        while (r >= 0 && c >= 0 && r < level.n && c < level.n) {
          const idx = r * level.n + c;
          if (info.occ[idx] < 0 && !gated.has(idx)) empties.push(idx);
          r += dr;
          c += dc;
        }
        if (!empties.length) continue;
        const keys = ids.filter((x) => x !== b && !used.has(x));
        if (!keys.length) continue;
        const key = pick(keys, rng);
        const cell = pick(empties, rng);
        gated.add(cell);
        used.add(key);
        out.push({ type: 'gate', cell, key });
      }
      break;
    }
  }
  return out;
}

/** Acrescenta a mecânica do mundo a uma fase pronta (index = índice da fase, a partir de 0) */
export function overlayFor(level: Level, index: number): Level {
  const type = WORLD_MECHANIC[Math.floor(index / WORLD_SIZE)];
  if (!type) return level;
  const pos = index % WORLD_SIZE;
  const info = analyse(level);
  for (let k = intensityAt(pos); k >= 1; k--) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const rng = mulberry32(hashSeed(`mech-${index}-${k}-${attempt}`));
      const mechanics = propose(type, k, pos, info, rng);
      if (mechanics.length < k) break; // não há candidatos para k elementos: tenta com menos
      const candidate: Level = { ...level, mechanics };
      if (solveState(createState(candidate), 4000)) return candidate;
    }
  }
  return level;
}
