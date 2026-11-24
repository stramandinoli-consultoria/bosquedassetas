import { CONFIG } from '../../config';
import { nativePlugin, platform } from '../platform';
import type { IAdsService, RewardPlacement } from './ads';

/**
 * AdMob no app nativo, usando o plugin @capacitor-community/admob.
 *
 * O plugin é acessado pela ponte do Capacitor (Capacitor.Plugins.AdMob),
 * então o código web compila mesmo sem o pacote instalado. Para ativar:
 *   npm i @capacitor-community/admob
 *   npx cap sync
 * e configure o App ID no AndroidManifest.xml / Info.plist (ver docs/).
 */
export class AdMobAds implements IAdsService {
  private ready = false;

  get available(): boolean {
    return !!nativePlugin('AdMob');
  }

  private get ids() {
    return platform() === 'ios' ? CONFIG.admob.ios : CONFIG.admob.android;
  }

  async init(): Promise<void> {
    const AdMob = nativePlugin('AdMob');
    if (!AdMob) return;
    try {
      // iOS 14+: pede permissão de rastreamento antes de inicializar
      if (platform() === 'ios' && AdMob.trackingAuthorizationStatus) {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization?.();
      }
      await AdMob.initialize({ initializeForTesting: (import.meta as any).env?.DEV ?? false });
      // formulário de consentimento (LGPD/GDPR) quando exigido
      try {
        const info = await AdMob.requestConsentInfo?.();
        if (info?.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm?.();
      } catch {
        /* sem formulário configurado no AdMob: segue */
      }
      this.ready = true;
    } catch (e) {
      console.warn('AdMob não inicializou', e);
    }
  }

  async showRewarded(_placement: RewardPlacement): Promise<boolean> {
    const AdMob = nativePlugin('AdMob');
    if (!AdMob || !this.ready) return false;
    try {
      await AdMob.prepareRewardVideoAd({ adId: this.ids.rewarded });
      const reward = await AdMob.showRewardVideoAd();
      return !!reward;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<void> {
    const AdMob = nativePlugin('AdMob');
    if (!AdMob || !this.ready) return;
    try {
      await AdMob.prepareInterstitial({ adId: this.ids.interstitial });
      await AdMob.showInterstitial();
    } catch {
      /* sem anúncio disponível agora */
    }
  }
}
