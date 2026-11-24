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
import type { Level } from '../src/engine/types';

const strip = (l: Level) => ({ n: l.n, arrows: l.arrows.map((a) => [a.dir, a.color, ...a.cells]) });
const rng = mulberry32(12345);
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
