/**
 * Configurações do jogo. Troque os IDs de anúncio pelos seus antes de publicar.
 *
 * Os IDs abaixo são os IDs de TESTE oficiais do Google AdMob: mostram anúncios
 * de teste e nunca geram cobrança nem bloqueio de conta.
 */
export const CONFIG = {
  appName: 'Setas!',
  worldSize: 20,
  startingHints: 5,
  lives: 3,
  coins: {
    perStar: 10,
    daily: 50,
    hintPrice: 40,
    continuePrice: 30,
  },
  /** Mostrar intersticial a cada N fases vencidas (só no app nativo) */
  interstitialEvery: 3,
  admob: {
    android: {
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
    },
    ios: {
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
    },
  },
} as const;

/** Conjunto de imagens usado no mundo (ver theme-forest.css, theme-beach.css, theme-desert.css, theme-glacier.css, theme-volcano.css, theme-city.css, theme-jungle.css e theme-canyon.css). Sem "theme" = floresta. */
export type Theme = 'forest' | 'beach' | 'desert' | 'glacier' | 'volcano' | 'city' | 'jungle' | 'canyon';

export const WORLDS: { name: { pt: string; en: string }; bg: [string, string]; theme?: Theme }[] = [
  { name: { pt: 'Bosque', en: 'Grove' }, bg: ['#1f5f4a', '#0d2b24'] },
  { name: { pt: 'Praia', en: 'Beach' }, bg: ['#2b7fa8', '#0e2c44'], theme: 'beach' },
  { name: { pt: 'Deserto', en: 'Desert' }, bg: ['#a8642b', '#3d1f0d'], theme: 'desert' },
  { name: { pt: 'Geleira', en: 'Glacier' }, bg: ['#4a8fb8', '#14304a'], theme: 'glacier' },
  { name: { pt: 'Vulcão', en: 'Volcano' }, bg: ['#a8322b', '#3a0d0d'], theme: 'volcano' },
  { name: { pt: 'Cidade', en: 'City' }, bg: ['#4a4f8f', '#151733'], theme: 'city' },
  { name: { pt: 'Selva', en: 'Jungle' }, bg: ['#3a8f3a', '#0f2b10'], theme: 'jungle' },
  { name: { pt: 'Cânion', en: 'Canyon' }, bg: ['#b8743a', '#40200e'], theme: 'canyon' },
  { name: { pt: 'Oceano', en: 'Ocean' }, bg: ['#1f5fa8', '#08203f'] },
  { name: { pt: 'Montanha', en: 'Mountain' }, bg: ['#5f6f8f', '#1b2233'] },
  { name: { pt: 'Aurora', en: 'Aurora' }, bg: ['#3aa88f', '#0d2333'] },
  { name: { pt: 'Castelo', en: 'Castle' }, bg: ['#7a4fa8', '#22113a'] },
  { name: { pt: 'Galáxia', en: 'Galaxy' }, bg: ['#4f3aa8', '#0b0820'] },
  { name: { pt: 'Nebulosa', en: 'Nebula' }, bg: ['#a83a8f', '#2a0b25'] },
  { name: { pt: 'Infinito', en: 'Infinity' }, bg: ['#333a4f', '#0a0c12'] },
];
