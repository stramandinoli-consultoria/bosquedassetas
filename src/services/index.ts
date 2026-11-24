import { AdMobAds } from './ads/admob';
import { NoAds, type IAdsService } from './ads/ads';
import { CrazyGamesAds, SimulatedAds } from './ads/web';
import { ConsoleAnalytics, type IAnalytics } from './analytics';
import { ApiClient } from './api';
import { SynthAudio, type IAudio } from './audio';
import { NativeHaptics, WebHaptics, type IHaptics } from './haptics';
import { isNative, platform, type Platform } from './platform';
import { LocalStorage, type IStorage } from './storage';

/**
 * "SDK" do jogo: o resto do código só conhece estas interfaces.
 * Aqui é o único lugar que decide qual implementação usar em cada plataforma,
 * como um container de injeção de dependência.
 */
export interface Services {
  platform: Platform;
  storage: IStorage;
  audio: IAudio;
  haptics: IHaptics;
  ads: IAdsService;
  analytics: IAnalytics;
  api: ApiClient;
}

/**
 * Endereço da API:
 * - VITE_API_URL no build (obrigatório no app Android/iOS), ex.: https://setas.up.railway.app
 * - vazio = mesmo endereço do site (quando o jogo é servido pela própria API no Railway)
 */
function apiBase(native: boolean): { base: string; enabled: boolean } {
  const env = (import.meta as any).env ?? {};
  const configured = String(env.VITE_API_URL ?? '').replace(/\/$/, '');
  if (configured) return { base: configured, enabled: true };
  const sameOrigin = !native && /^https?:$/.test(location.protocol);
  return { base: '', enabled: sameOrigin };
}

export function createServices(): Services {
  const native = isNative();
  const env = (import.meta as any).env ?? {};
  const query = new URLSearchParams(location.search);

  let ads: IAdsService;
  if (native) ads = new AdMobAds();
  else if ((window as any).CrazyGames?.SDK) ads = new CrazyGamesAds();
  else if (env.DEV || query.has('fakeads')) ads = new SimulatedAds();
  else ads = new NoAds();

  const storage = new LocalStorage();
  const { base, enabled } = apiBase(native);
  return {
    platform: platform(),
    storage,
    audio: new SynthAudio(),
    haptics: native ? new NativeHaptics() : new WebHaptics(),
    ads,
    analytics: new ConsoleAnalytics(),
    api: new ApiClient(base, storage, enabled),
  };
}

export let services: Services;

export async function initServices(s: Services = createServices()): Promise<Services> {
  services = s;
  await s.ads.init();
  void s.api.flush();
  addEventListener('online', () => void s.api.flush());
  return s;
}
