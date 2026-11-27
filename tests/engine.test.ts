import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, paramsFor, pack, unpack, difficultyOf } from '../src/engine/generator';
import { buildOccupancy, checkExit, solve } from '../src/engine/rules';
import levels from '../src/data/levels.json' with { type: 'json' };
import type { Level, PackedLevel } from '../src/engine/types';

test('gerador é determinístico (mesma semente = mesma fase)', () => {
  const a = generate(paramsFor(0.5, 42));
  const b = generate(paramsFor(0.5, 42));
  assert.deepEqual(a, b);
});

test('toda fase gerada tem solução', () => {
  for (let s = 1; s <= 200; s++) {
    const lvl = generate(paramsFor((s % 20) / 19, s));
    assert.ok(solve(lvl).solvable, `semente ${s} sem solução`);
  }
});

test('setas não se sobrepõem e ficam dentro do tabuleiro', () => {
  for (let s = 1; s <= 50; s++) {
    const lvl = generate(paramsFor(1, s));
    const seen = new Set<number>();
    for (const a of lvl.arrows) {
      for (const c of a.cells) {
        assert.ok(c >= 0 && c < lvl.n * lvl.n);
        assert.ok(!seen.has(c), 'célula repetida');
        seen.add(c);
      }
    }
  }
});

test('regra de saída: seta bloqueada informa quem bloqueia', () => {
  // seta 0 aponta para a direita na linha 0; seta 1 está no caminho dela
  const lvl: Level = {
    n: 4,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [0, 1], dir: 3, color: 0 },
      { id: 1, cells: [7, 3], dir: 0, color: 1 },
    ],
  };
  const occ = buildOccupancy(lvl);
  const r0 = checkExit(4, occ, lvl.arrows[0]);
  assert.equal(r0.ok, false);
  assert.equal(r0.blocker, 1);
  assert.equal(r0.steps, 2);
  const r1 = checkExit(4, occ, lvl.arrows[1]);
  assert.equal(r1.ok, true);
  assert.deepEqual(solve(lvl).order, [1, 0]);
});

test('pack/unpack preserva a fase', () => {
  const lvl = generate(paramsFor(0.3, 7));
  assert.deepEqual(unpack(pack(lvl)), lvl);
});

test('levels.json: todas as fases têm solução e os mundos ficam mais difíceis', () => {
  const list = (levels as unknown as PackedLevel[]).map(unpack);
  assert.ok(list.length >= 100);
  for (const [i, l] of list.entries()) {
    assert.ok(solve(l).solvable, `fase ${i + 1} sem solução`);
    assert.equal(difficultyOf(l), l.difficulty);
  }
  let prev = -Infinity;
  for (let w = 0; w < list.length; w += 20) {
    const world = list.slice(w, w + 20);
    const avg = world.reduce((s, l) => s + l.difficulty, 0) / world.length;
    assert.ok(avg >= prev, `mundo ${w / 20 + 1} mais fácil que o anterior`);
    prev = avg;
  }
});

test('tutorial: fase 1 sem bloqueios, fases 2 e 3 com bloqueio', () => {
  const list = (levels as unknown as PackedLevel[]).map(unpack);
  const s1 = solve(list[0]);
  assert.equal(s1.freeAtStart, list[0].arrows.length);
  for (const i of [1, 2]) assert.ok(solve(list[i]).freeAtStart < list[i].arrows.length);
});

test('fases infinitas: determinísticas, com solução e ficando maiores', async () => {
  const { generateInfinite } = await import('../src/engine/levels');
  const a = generateInfinite(1234, 300);
  const b = generateInfinite(1234, 300);
  assert.deepEqual(a, b);
  const avg = (from: number) => {
    let sum = 0;
    for (let i = from; i < from + 15; i++) {
      const l = generateInfinite(i, 300);
      assert.ok(solve(l).solvable, `fase ${i + 1} sem solução`);
      sum += l.arrows.length;
    }
    return sum / 15;
  };
  const early = avg(300);
  const later = avg(600);
  assert.ok(later > early, `média de setas não cresceu: ${early} -> ${later}`);
});

test('desafio do dia: mesma fase para a mesma data', async () => {
  const { dailyLevel } = await import('../src/engine/levels');
  assert.deepEqual(dailyLevel('2026-11-22'), dailyLevel('2026-11-22'));
  assert.notDeepEqual(dailyLevel('2026-11-22'), dailyLevel('2026-11-23'));
});

// ---------- mecânicas especiais (src/engine/state.ts) ----------
import { createState, tap, solveState, livesLost, mechanicBonus, dirOf, headOf } from '../src/engine/state';
import type { Mechanic } from '../src/engine/types';

/** Duas setas em 4x4: 0 na linha 0 apontando para a direita, 1 na coluna 3 apontando para cima (bloqueia a 0) */
const two = (mechanics?: Mechanic[]): Level => ({
  n: 4,
  difficulty: 0,
  arrows: [
    { id: 0, cells: [0, 1], dir: 3, color: 0 },
    { id: 1, cells: [7, 3], dir: 0, color: 1 },
  ],
  mechanics,
});

test('estado sem mecânica segue a regra clássica', () => {
  const s = createState(two());
  const r = tap(s, 0);
  assert.equal(r.kind, 'bump');
  assert.equal(livesLost(r), 1);
  assert.equal(tap(s, 1).kind, 'exit');
  assert.equal(tap(s, 0).kind, 'exit');
  assert.equal(s.removed, 2);
});

test('gelo: trava sem tirar vida, derrete a cada jogada e a batida recongela', () => {
  const l: Level = {
    n: 5,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [0, 1], dir: 3, color: 0 },
      { id: 1, cells: [9, 4], dir: 0, color: 1 },
      { id: 2, cells: [20, 21], dir: 3, color: 2 },
      { id: 3, cells: [15, 16], dir: 3, color: 3 },
    ],
    mechanics: [{ type: 'ice', arrow: 3, count: 2 }],
  };
  const s = createState(l);
  assert.equal(tap(s, 3).kind, 'locked');
  assert.equal(tap(s, 0).kind, 'bump'); // bate: o gelo já está cheio, não passa de 2
  assert.equal(s.ice[3], 2);
  assert.equal(tap(s, 2).kind, 'exit');
  assert.equal(s.ice[3], 1);
  assert.equal(tap(s, 0).kind, 'bump'); // recongela 1
  assert.equal(s.ice[3], 2);
  tap(s, 1);
  tap(s, 0);
  assert.equal(s.ice[3], 0);
  assert.equal(tap(s, 3).kind, 'exit');
});

test('portão bloqueia até a seta-chave sair', () => {
  const l: Level = {
    n: 4,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [0, 1], dir: 3, color: 0 },
      { id: 1, cells: [12, 13], dir: 3, color: 1 },
    ],
    mechanics: [{ type: 'gate', cell: 3, key: 1 }],
  };
  const s = createState(l);
  const r = tap(s, 0);
  assert.equal(r.kind, 'bump');
  if (r.kind === 'bump') assert.equal(r.gate, 3);
  const e = tap(s, 1);
  assert.equal(e.kind, 'exit');
  if (e.kind === 'exit') assert.deepEqual(e.opened, [3]);
  assert.equal(tap(s, 0).kind, 'exit');
});

test('cipó: as duas setas saem juntas, ou nenhuma', () => {
  const l = two([{ type: 'vine', a: 0, b: 1 }]);
  const s = createState(l);
  // a seta 1 está no caminho da 0, mas sai junto: as duas passam
  const r = tap(s, 0);
  assert.equal(r.kind, 'exit');
  if (r.kind === 'exit') assert.deepEqual(r.exits.map((x) => x.id).sort(), [0, 1]);
  assert.equal(s.removed, 2);
});

test('mão dupla: a seta reta inverte a cada jogada válida', () => {
  const l: Level = {
    n: 4,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [4, 5], dir: 3, color: 0 },
      { id: 1, cells: [12, 13], dir: 3, color: 1 },
    ],
    mechanics: [{ type: 'flip', arrow: 0 }],
  };
  const s = createState(l);
  assert.equal(dirOf(s, 0), 3);
  tap(s, 1);
  assert.equal(dirOf(s, 0), 2);
  assert.equal(headOf(s, 0), 4);
});

test('órbita: a ponta gira 90° no sentido horário, pulando a direção do próprio corpo', () => {
  const l: Level = {
    n: 4,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [4, 5], dir: 0, color: 0 }, // corpo à esquerda da ponta, ponta para cima
      { id: 1, cells: [12, 13], dir: 1, color: 1 },
      { id: 2, cells: [14, 15], dir: 1, color: 2 },
    ],
    mechanics: [{ type: 'orbit', arrow: 0, cw: true }],
  };
  const s = createState(l);
  tap(s, 1);
  assert.equal(dirOf(s, 0), 3); // cima -> direita
  tap(s, 2);
  assert.equal(dirOf(s, 0), 1); // direita -> baixo
});

test('magma: explode quando o contador zera (1 vida) e recomeça', () => {
  const l: Level = {
    n: 4,
    difficulty: 0,
    arrows: [
      { id: 0, cells: [0, 1], dir: 3, color: 0 },
      { id: 1, cells: [7, 3], dir: 0, color: 1 },
      { id: 2, cells: [12, 13], dir: 3, color: 2 },
    ],
    mechanics: [{ type: 'magma', arrow: 0, count: 2 }],
  };
  const s = createState(l);
  assert.equal(tap(s, 2).kind, 'exit');
  const r = tap(s, 1);
  assert.equal(r.kind, 'exit');
  assert.equal(livesLost(r), 1);
  assert.equal(s.magma[0], 2);
  // com folga maior, o solver acha uma ordem sem explosão (magma antes do contador zerar)
  const plan = solveState(createState({ ...l, mechanics: [{ type: 'magma', arrow: 0, count: 3 }] }));
  assert.ok(plan);
  const t = createState({ ...l, mechanics: [{ type: 'magma', arrow: 0, count: 3 }] });
  for (const id of plan!) assert.equal(livesLost(tap(t, id)), 0);
});

test('pack/unpack preserva as mecânicas', () => {
  const lvl = generate(paramsFor(0.3, 7));
  lvl.mechanics = [
    { type: 'ice', arrow: 0, count: 3 },
    { type: 'gate', cell: 5, key: 1 },
    { type: 'vine', a: 2, b: 3 },
    { type: 'flip', arrow: 4 },
    { type: 'orbit', arrow: 5, cw: false },
    { type: 'magma', arrow: 6, count: 4 },
  ];
  assert.deepEqual(unpack(pack(lvl)), lvl);
});

test('levels.json: fases com mecânica têm solução sem perder vida e só nos mundos previstos', () => {
  const list = (levels as unknown as PackedLevel[]).map(unpack);
  const worlds = new Set<number>();
  for (const [i, l] of list.entries()) {
    if (!l.mechanics?.length) continue;
    worlds.add(Math.floor(i / 20));
    assert.ok(solveState(createState(l), 20000), `fase ${i + 1} com mecânica sem solução`);
    assert.ok(mechanicBonus(l) > 0);
  }
  assert.deepEqual([...worlds].sort((a, b) => a - b), [3, 4, 5, 6, 11, 12]);
});
