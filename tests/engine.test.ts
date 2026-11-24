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
