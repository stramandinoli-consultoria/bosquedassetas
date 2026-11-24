import '@fontsource/lilita-one/latin-400.css';
import './styles.css';
import './theme-forest.css';
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

/** Cenário da floresta atrás de todas as telas: cogumelos, plantas, folhas e vaga-lumes */
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
