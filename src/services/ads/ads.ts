export type RewardPlacement = 'continue' | 'hint' | 'double_coins';

/**
 * Contrato de anúncios. Cada plataforma tem a sua implementação:
 * - AdMobAds        → app Android/iOS (Capacitor)
 * - CrazyGamesAds   → jogo publicado no portal CrazyGames
 * - SimulatedAds    → desenvolvimento (finge um anúncio de 2 s)
 * - NoAds           → PWA/site sem anúncios
 */
export interface IAdsService {
  /** Se false, a interface esconde os botões "assistir anúncio" */
  readonly available: boolean;
  init(): Promise<void>;
  /** Resolve true se o jogador assistiu até o fim e ganhou a recompensa */
  showRewarded(placement: RewardPlacement): Promise<boolean>;
  /** Intersticial entre fases (pode não mostrar nada) */
  showInterstitial(): Promise<void>;
}

export class NoAds implements IAdsService {
  readonly available = false;
  async init() {}
  async showRewarded() {
    return false;
  }
  async showInterstitial() {}
}
