/**
 * Gera src/data/levels.json com as fases curadas do jogo.
 *
 *   npm run levels            (300 fases)
 *   npm run levels -- 450     (outra quantidade)
 *
 * Gera um banco grande de candidatas em várias faixas de dificuldade,
 * descarta repetidas/fáceis demais, ordena pela pontuação de dificuldade
 * e escolhe fases espaçadas para formar uma curva suave.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, pack, paramsFor } from '../src/engine/generator';
import { overlayFor } from '../src/engine/overlay';
import { solve } from '../src/engine/rules';
import type { Level } from '../src/engine/types';

const TOTAL = Number(process.argv[2]) || 300;
const POOL_PER_LEVEL = 4;
const WORLD_SIZE = 20;

const pool: Level[] = [];
let seed = 1000;
for (let i = 0; i < TOTAL * POOL_PER_LEVEL; i++) {
  const t = Math.pow(i / (TOTAL * POOL_PER_LEVEL - 1), 0.85);
  const lvl = generate(paramsFor(t, seed++));
  const s = solve(lvl);
  if (!s.solvable || lvl.arrows.length < 4) continue;
  pool.push(lvl);
}

pool.sort((a, b) => a.difficulty - b.difficulty);

// escolhe TOTAL fases espaçadas uniformemente ao longo do banco ordenado
const chosen: Level[] = [];
for (let k = 0; k < TOTAL; k++) chosen.push(pool[Math.round((k * (pool.length - 1)) / (TOTAL - 1))]);

// fases do tutorial: tabuleiros pequenos e bem simples
const tutorial: Level[] = [];
const tutorialSpecs = [
  { n: 4, maxLen: 2, density: 0.4, needBlocked: false },
  { n: 4, maxLen: 3, density: 0.6, needBlocked: true },
  { n: 5, maxLen: 3, density: 0.65, needBlocked: true },
];
for (const spec of tutorialSpecs) {
  for (let s = 1; s < 5000; s++) {
    const l = generate({ ...spec, seed: 90000 + s });
    const r = solve(l);
    if (!r.solvable || l.arrows.length < 3 || l.arrows.length > 7) continue;
    if (spec.needBlocked !== r.freeAtStart < l.arrows.length) continue;
    if (tutorial.length && l.difficulty <= tutorial[tutorial.length - 1].difficulty) continue;
    tutorial.push(l);
    break;
  }
}

// ordena por dificuldade e, dentro de cada mundo de 20 fases, pelo tamanho do
// tabuleiro, para o jogador não pular de 9x9 para 5x5 de uma fase para outra
const sorted = chosen.slice(0, TOTAL - tutorial.length).sort((a, b) => a.difficulty - b.difficulty);
const all = [...tutorial, ...sorted];
const byDifficulty: Level[] = [];
for (let w = 0; w < all.length; w += WORLD_SIZE) {
  const world = all.slice(w, w + WORLD_SIZE);
  if (w === 0) byDifficulty.push(...world.slice(0, tutorial.length), ...world.slice(tutorial.length).sort((a, b) => a.n - b.n || a.difficulty - b.difficulty));
  else byDifficulty.push(...world.sort((a, b) => a.n - b.n || a.difficulty - b.difficulty));
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/data/levels.json');
mkdirSync(dirname(out), { recursive: true });
// mecânicas especiais por cima das setas (caminho A de docs/novas-mecanicas-de-dificuldades.md)
const withMechanics = byDifficulty.map((l, i) => overlayFor(l, i));
writeFileSync(out, JSON.stringify(withMechanics.map(pack)));
// o servidor usa as mesmas fases para conferir as partidas
const serverCopy = resolve(here, '../server/Setas.Api/Data/levels.json');
mkdirSync(dirname(serverCopy), { recursive: true });
writeFileSync(serverCopy, JSON.stringify(withMechanics.map(pack)));
console.log(`Fases com mecânica: ${withMechanics.filter((l) => l.mechanics?.length).length}`);

const sizes = byDifficulty.map((l) => l.n);
console.log(`Fases: ${byDifficulty.length} (banco de ${pool.length})`);
console.log(`Tabuleiro: ${Math.min(...sizes)}x${Math.min(...sizes)} até ${Math.max(...sizes)}x${Math.max(...sizes)}`);
console.log(`Dificuldade: ${byDifficulty[0].difficulty} → ${byDifficulty[byDifficulty.length - 1].difficulty}`);
console.log(`Salvo em ${out}`);
