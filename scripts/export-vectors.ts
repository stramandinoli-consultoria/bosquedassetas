/**
 * Gera server/Setas.Tests/vectors.json: fases de referência geradas pelo
 * TypeScript. Os testes em C# geram as mesmas fases e comparam, garantindo
 * que jogo e servidor produzem exatamente o mesmo tabuleiro.
 *
 *   npm run vectors
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateInfinite, dailyLevel } from '../src/engine/levels';
import { generate, paramsFor } from '../src/engine/generator';
import { hashSeed, mulberry32 } from '../src/engine/rng';
import { solve } from '../src/engine/rules';
import { unpack } from '../src/engine/generator';
import { createState, isCleared, livesLost, solveState, tap } from '../src/engine/state';
import { replay } from '../src/engine/replay';
import levels from '../src/data/levels.json' with { type: 'json' };
import type { PackedLevel } from '../src/engine/types';
import type { Level } from '../src/engine/types';

const strip = (l: Level) => ({ n: l.n, arrows: l.arrows.map((a) => [a.dir, a.color, ...a.cells]) });
const rng = mulberry32(12345);
const curated = (levels as unknown as PackedLevel[]).map(unpack);

/**
 * Partidas de referência nas fases com mecânica: a solução do solver (3 estrelas) e uma
 * partida com toques sorteados (batidas, setas travadas, explosões). Para cada toque fica
 * gravado o resultado esperado; o C# precisa reproduzir tudo igual.
 */
function mechanicRuns() {
  const out: { index: number; moves: number[]; steps: [string, number][]; valid: boolean; mistakes: number }[] = [];
  for (const w of [3, 4, 5, 6, 11, 12])
    for (const index of [w * 20, w * 20 + 9, w * 20 + 19]) {
      const level = curated[index];
      const plan = solveState(createState(level), 20000)!;
      const pick = mulberry32(index + 77);
      const sequences = [plan];
      // partida bagunçada: até 12 toques sorteados e depois a solução a partir dali
      const s = createState(level);
      const messy: number[] = [];
      for (let k = 0; k < 12 && !isCleared(s); k++) {
        const alive = s.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
        const id = alive[Math.floor(pick() * alive.length)];
        tap(s, id);
        messy.push(id);
      }
      messy.push(...(solveState(s, 50000) ?? []));
      sequences.push(messy);
      for (const moves of sequences) {
        const t = createState(level);
        const steps: [string, number][] = moves.map((id) => {
          const r = tap(t, id);
          return [r.kind, livesLost(r)];
        });
        // toques em seta travada não vão para o servidor: a lista enviada é sem eles
        const sent = moves.filter((_, i) => steps[i][0] !== 'locked');
        const r = replay(level, sent);
        out.push({ index, moves, steps, valid: r.valid, mistakes: r.valid ? r.mistakes : -1 });
      }
    }
  return out;
}

const out = {
  curatedCount: 300,
  rng: { seed: 12345, values: Array.from({ length: 10 }, () => rng()) },
  hashes: ['daily-2026-11-22', 'daily-2027-01-01', 'abc', ''].map((t) => ({ text: t, hash: hashSeed(t) })),
  generated: [
    { t: 0, seed: 1 },
    { t: 0.5, seed: 42 },
    { t: 1, seed: 999 },
  ].map(({ t, seed }) => ({ t, seed, level: strip(generate(paramsFor(t, seed))) })),
  infinite: [300, 301, 360, 450, 777, 1500].map((index) => ({ index, level: strip(generateInfinite(index, 300)) })),
  daily: ['2026-11-22', '2027-01-01'].map((date) => ({ date, level: strip(dailyLevel(date)) })),
  mechanics: mechanicRuns(),
  solve: [1, 2].map((seed) => {
    const l = generate(paramsFor(0.7, seed));
    return { seed, order: solve(l).order };
  }),
};
const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../server/Setas.Tests/vectors.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
console.log('OK', file);
