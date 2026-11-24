import { generate, paramsFor, unpack } from './generator';
import { hashSeed } from './rng';
import { solve } from './rules';
import type { GenerateOptions, Level, PackedLevel } from './types';

/**
 * Fases infinitas.
 *
 * - Até a última fase curada (levels.json) usa as fases prontas.
 * - Depois disso gera a fase na hora, de forma determinística: a fase N é
 *   sempre a mesma para todo mundo (importante para o ranking e para o
 *   servidor conseguir conferir a partida).
 *
 * A mesma lógica existe em C# no servidor (server/Setas.Api/Engine).
 * Se mudar algo aqui, mude lá também e rode `npm run vectors` + `dotnet test`.
 */

/** k = quantas fases depois das curadas */
export function infiniteParams(index: number, curatedCount: number, candidate: number): GenerateOptions {
  const k = Math.max(0, index - curatedCount);
  return {
    n: Math.min(14, 12 + Math.floor(k / 100)),
    // setas médias (não muito longas) para a QUANTIDADE de setas crescer junto com o tabuleiro
    maxLen: Math.min(9, 6 + Math.floor(k / 120)),
    density: Math.min(0.95, 0.88 + Math.floor(k / 25) * 0.01),
    seed: 700001 + index * 7919 + candidate * 104729,
  };
}

/** Quantas fases candidatas gerar e ficar com a mais difícil (cresce com o tempo) */
export function infiniteCandidates(index: number, curatedCount: number): number {
  const k = Math.max(0, index - curatedCount);
  return Math.min(8, 2 + Math.floor(k / 50));
}

/** Pontuação inteira usada para escolher a candidata mais difícil (inteira = igual no C#) */
export function hardness(level: Level): number {
  const s = solve(level);
  if (!s.solvable) return -1;
  return s.depth * 1000 + level.arrows.length * 10 + (level.arrows.length - s.freeAtStart);
}

export function generateInfinite(index: number, curatedCount: number): Level {
  let best: Level | null = null;
  let bestScore = -2;
  const c = infiniteCandidates(index, curatedCount);
  for (let i = 0; i < c; i++) {
    const l = generate(infiniteParams(index, curatedCount, i));
    const sc = hardness(l);
    if (sc > bestScore) {
      best = l;
      bestScore = sc;
    }
  }
  return best!;
}

export function levelAt(index: number, curated: PackedLevel[]): Level {
  return index < curated.length ? unpack(curated[index]) : generateInfinite(index, curated.length);
}

/** Desafio do dia: mesma fase para todos no mesmo dia (data local AAAA-MM-DD) */
export function dailyLevel(date: string): Level {
  return generate(paramsFor(0.55, hashSeed('daily-' + date)));
}
