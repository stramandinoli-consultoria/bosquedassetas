import type { IAdsService, RewardPlacement } from './ads';

/**
 * Portal CrazyGames: o SDK é carregado pelo próprio portal
 * (ou pela tag <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">).
 */
export class CrazyGamesAds implements IAdsService {
  get available(): boolean {
    return !!(window as any).CrazyGames?.SDK?.ad;
  }
  async init(): Promise<void> {
    try {
      await (window as any).CrazyGames?.SDK?.init?.();
    } catch {
      /* fora do portal */
    }
  }
  private request(type: 'rewarded' | 'midgame'): Promise<boolean> {
    const sdk = (window as any).CrazyGames?.SDK;
    if (!sdk?.ad) return Promise.resolve(false);
    return new Promise((resolve) => {
      sdk.ad.requestAd(type, {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
        adStarted: () => {},
      });
    });
  }
  showRewarded(_p: RewardPlacement) {
    return this.request('rewarded');
  }
  async showInterstitial() {
    await this.request('midgame');
  }
}

/** Para desenvolvimento: mostra um "anúncio" falso de 2 segundos */
export class SimulatedAds implements IAdsService {
  readonly available = true;
  async init() {}
  showRewarded(placement: RewardPlacement): Promise<boolean> {
    return this.fake(`Anúncio de teste (${placement})`);
  }
  async showInterstitial() {
    await this.fake('Intersticial de teste');
  }
  private fake(label: string): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.innerHTML = `<div><b>📺 ${label}</b><span>2</span></div>`;
      document.body.appendChild(el);
      let s = 2;
      const t = setInterval(() => {
        s--;
        el.querySelector('span')!.textContent = String(s);
        if (s <= 0) {
          clearInterval(t);
          el.remove();
          resolve(true);
        }
      }, 1000);
    });
  }
}
