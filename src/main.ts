import '@fontsource/lilita-one/latin-400.css';
import './styles.css';
import './theme-forest.css';
import './theme-beach.css';
import './theme-desert.css';
import './theme-glacier.css';
import './theme-volcano.css';
import './theme-city.css';
import './theme-jungle.css';
import './theme-canyon.css';
import levels from './data/levels.json';
import type { PackedLevel } from './engine/types';
import { setLang } from './i18n';
import { initServices } from './services';
import { nativePlugin } from './services/platform';
import { Progress } from './state/progress';
import { syncAccount } from './state/sync';
import { accountScreen } from './ui/account';
import { App } from './ui/app';
import { gameScreen } from './ui/game';
import { homeScreen } from './ui/home';
import { mapScreen } from './ui/map';
import { rankingScreen } from './ui/ranking';
import { shopScreen } from './ui/shop';

/**
 * Cenário atrás de todas as telas. Tem as peças dos dois temas:
 *  - floresta: cogumelos, plantas, folhas e vaga-lumes (theme-forest.css)
 *  - praia ("beach-only"): corais, estrelas-do-mar, conchas e bolhas (theme-beach.css)
 *  - deserto ("desert-only"): cactos, pedras, árvore seca, placa e poeira brilhante (theme-desert.css)
 *  - geleira ("glacier-only"): cristais, pinheiro, árvore seca, placa, pedras com neve e flocos (theme-glacier.css)
 *  - vulcão ("volcano-only"): rochas com lava, vulcãozinho, árvore seca com cristais, coluna e poça de lava e brasas (theme-volcano.css)
 *  - cidade ("city-only"): prédios, árvore no vaso, floreira e hidrante, semáforo, banco e luzes (theme-city.css)
 *  - selva ("jungle-only"): ruínas, folhagem, flores tropicais, tucano e pedras com musgo (theme-jungle.css)
 *  - cânion ("canyon-only"): cacto alto, arco de pedra, formação rochosa, palma com flores, crânio e cachoeira (theme-canyon.css)
 * O CSS mostra só as do tema atual (<body data-theme>).
 */
function addForestDecor() {
  const decor = document.createElement('div');
  decor.className = 'forest-decor';
  decor.setAttribute('aria-hidden', 'true');
  // as peças "home-only" (cipós, lanterna, toco) só aparecem na tela inicial (ver theme-forest.css)
  const pieces = [
    'deco-leaves',
    'deco-mush',
    'deco-plants',
    'home-only deco-vine-l',
    'home-only deco-vine-r',
    'home-only deco-lantern',
    'home-only deco-stump',
    'home-only deco-mush-orange',
    'beach-only deco-palm',
    'beach-only deco-coral',
    'beach-only deco-star',
    'beach-only deco-stones',
    'beach-only deco-seaweed',
    'beach-only home-only deco-hibiscus',
    'beach-only home-only deco-monstera',
    'beach-only home-only deco-shell',
    'beach-only home-only deco-star-pink',
    'desert-only deco-cactus',
    'desert-only deco-rocks',
    'desert-only deco-dead-tree',
    'desert-only deco-pear',
    'desert-only home-only deco-signpost',
    'desert-only home-only deco-flower',
    'glacier-only deco-ice-crystals',
    'glacier-only deco-bare-tree',
    'glacier-only deco-pine',
    'glacier-only home-only deco-ice-sign',
    'glacier-only home-only deco-snow-rocks',
    'volcano-only deco-lava-rock',
    'volcano-only deco-dead-tree',
    'volcano-only deco-mini-volcano',
    'volcano-only home-only deco-lava-pillar',
    'volcano-only home-only deco-lava-pool',
    'city-only deco-building-brick',
    'city-only deco-street-trees',
    'city-only deco-building-classic',
    'city-only home-only deco-traffic-light',
    'city-only home-only deco-bench',
    'jungle-only deco-ruin-arch',
    'jungle-only deco-flowers',
    'jungle-only deco-foliage',
    'jungle-only home-only deco-toucan',
    'jungle-only home-only deco-mossy-rocks',
    'canyon-only deco-saguaro',
    'canyon-only deco-arch',
    'canyon-only deco-butte',
    'canyon-only deco-pear',
    'canyon-only home-only deco-skull',
    'canyon-only home-only deco-waterfall',
  ];
  for (const cls of pieces) {
    const d = document.createElement('div');
    d.className = cls;
    decor.appendChild(d);
  }
  for (let i = 0; i < 12; i++) {
    const f = document.createElement('div');
    f.className = 'firefly';
    Object.assign(f.style, {
      left: `${5 + Math.random() * 90}%`,
      top: `${10 + Math.random() * 80}%`,
    });
    f.style.setProperty('--dx', `${Math.round(Math.random() * 80 - 40)}px`);
    f.style.setProperty('--dy', `${Math.round(Math.random() * 80 - 50)}px`);
    f.style.setProperty('--dur', `${(5 + Math.random() * 5).toFixed(1)}s`);
    f.style.setProperty('--delay', `${(-Math.random() * 8).toFixed(1)}s`);
    decor.appendChild(f);
  }
  document.body.prepend(decor);
}

async function boot() {
  addForestDecor();
  const s = await initServices();
  const progress = new Progress(s.storage);
  setLang(progress.data.settings.lang);
  s.audio.enabled = progress.data.settings.sound;
  s.haptics.enabled = progress.data.settings.haptics;

  // navegadores só liberam áudio depois de um toque
  addEventListener('pointerdown', () => s.audio.unlock(), { capture: true });

  const app = new App(document.getElementById('app')!, s, progress, levels as unknown as PackedLevel[]);
  app.register('home', homeScreen);
  app.register('map', mapScreen);
  app.register('game', gameScreen);
  app.register('daily', gameScreen);
  app.register('shop', shopScreen);
  app.register('account', accountScreen);
  app.register('ranking', rankingScreen);
  app.home();

  // conta: atualiza o progresso da nuvem em segundo plano
  if (s.api.loggedIn) syncAccount(s, progress).catch(() => {});

  // botão voltar do Android (plugin @capacitor/app)
  nativePlugin('App')?.addListener?.('backButton', () => {
    if (!app.back()) nativePlugin('App')?.exitApp?.();
  });

  // PWA: funciona offline depois da primeira visita
  const env = (import.meta as any).env ?? {};
  if (s.platform === 'web' && env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  (window as any).__setas = app; // ajuda a depurar pelo console
}

boot();
