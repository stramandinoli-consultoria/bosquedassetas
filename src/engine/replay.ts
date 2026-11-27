import { createState, isCleared, livesLost, tap } from './state';
import type { Level } from './types';

export const LIVES = 3;

export type ReplayResult = { valid: true; stars: number; mistakes: number; moves: number } | { valid: false; error: string };

/**
 * Anti-trapaça: refaz a partida inteira a partir da lista de setas tocadas
 * (inclusive as que bateram). Mesmo algoritmo de server/Setas.Api/Engine/Replay.cs.
 *
 * Toque em seta travada (gelo) nunca é enviado pelo jogo; se aparecer, a partida é recusada.
 * Erros = batidas + explosões de magma. Estrelas = vidas restantes (mínimo 1, por causa do "continuar").
 */
export function replay(level: Level, moves: number[]): ReplayResult {
  const count = level.arrows.length;
  if (moves.length < 1) return { valid: false, error: 'Jogadas insuficientes para concluir a fase.' };
  if (moves.length > count * 4 + 50) return { valid: false, error: 'Jogadas demais.' };
  const s = createState(level);
  let mistakes = 0;
  for (const id of moves) {
    if (!Number.isInteger(id)) return { valid: false, error: 'Jogada inválida.' };
    const r = tap(s, id);
    if (r.kind === 'ignored' || r.kind === 'locked') return { valid: false, error: 'Jogada inválida.' };
    mistakes += livesLost(r);
  }
  if (!isCleared(s)) return { valid: false, error: 'A fase não foi concluída.' };
  return { valid: true, stars: Math.max(1, LIVES - mistakes), mistakes, moves: moves.length };
}
