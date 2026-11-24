import type { MeDto } from '../services/api';
import type { Services } from '../services';
import type { Progress } from './progress';

/** Dados não competitivos que vão para a nuvem (o ranking usa só o que o servidor conferiu) */
function cloudState(p: Progress) {
  const d = p.data;
  return { coins: d.coins, hints: d.hints, skin: d.skin, owned: d.owned, settings: d.settings, daily: d.daily };
}

/**
 * Junta o progresso do aparelho com o da conta, sem perder nada:
 * fica o maior de cada valor e a soma das skins compradas.
 */
export function mergeFromServer(p: Progress, me: MeDto): void {
  const d = p.data;
  d.unlocked = Math.max(d.unlocked, me.maxLevel);
  me.stars.forEach((s, i) => {
    if (s > (d.stars[i] ?? 0)) d.stars[i] = s;
  });
  const st = me.state as Partial<ReturnType<typeof cloudState>>;
  if (typeof st.coins === 'number') d.coins = Math.max(d.coins, st.coins);
  if (typeof st.hints === 'number') d.hints = Math.max(d.hints, st.hints);
  if (Array.isArray(st.owned)) d.owned = [...new Set([...d.owned, ...st.owned])];
  if (typeof st.skin === 'string' && d.owned.includes(st.skin)) d.skin = st.skin;
  p.save();
}

let timer = 0;
/** Envia moedas/skins/configurações para a conta (agrupando chamadas próximas) */
export function pushState(s: Services, p: Progress): void {
  if (!s.api.loggedIn) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    s.api.saveState(cloudState(p)).catch(() => {});
  }, 1500);
}

/** Depois de entrar: baixa a conta, junta com o aparelho, envia o resultado e a fila de partidas */
export async function syncAccount(s: Services, p: Progress): Promise<void> {
  const me = await s.api.refreshMe();
  if (!me) return;
  mergeFromServer(p, me);
  await s.api.saveState(cloudState(p)).catch(() => {});
  await s.api.flush();
}
