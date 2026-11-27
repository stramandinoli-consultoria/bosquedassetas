import { t } from '../i18n';
import logoUrl from '../assets/atlas/logo.png';
import forestLogoUrl from '../assets/forest/logo.webp';
import beachLogoUrl from '../assets/beach/logo.webp';
import type { Theme } from '../config';
import { coinPill, h, icon, type IconName, modal } from './dom';
import type { App, Screen } from './app';
import { openSettings } from './settings';

let deferredInstall: any = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
});

/**
 * Logo da tela inicial por tema (o tema vem do mundo da próxima fase, ver App.setBackground).
 * Tema sem logo próprio usa o logo do atlas.
 */
const THEME_LOGO: Partial<Record<Theme, { src: string; alt: string; cls: string }>> = {
  forest: { src: forestLogoUrl, alt: 'Mundo das Setas', cls: 'logo-img logo-tall' },
  beach: { src: beachLogoUrl, alt: 'Mundo das Setas', cls: 'logo-img logo-wide' },
};

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream && !/CriOS|FxiOS/.test(ua);
}
function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function homeScreen(app: App): Screen {
  const p = app.progress.data;
  const next = p.unlocked;
  app.setBackground(app.worldOf(next));

  const me = app.s.api.me;
  const top = h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'pill pill-ico', 'aria-label': `${app.progress.totalStars()} ★` }, icon('star'), String(app.progress.totalStars())),
    app.s.api.enabled &&
      h('button', { class: 'pill pill-btn pill-ico', onclick: () => app.go({ name: 'account' }) }, icon('user'), h('span', {}, me ? me.nickname : t('login'))),
    coinPill(p.coins).el,
    h('button', { class: 'icon-btn wood-gear', 'aria-label': t('settings'), onclick: () => openSettings(app) }),
  );

  // texto dos botões fica no HTML (o fundo é a peça do atlas sem texto): muda com a fase e o idioma
  const label = (ico: IconName | null, text: string) => h('span', { class: 'btn-label' }, ico && icon(ico, 'btn-ico'), h('span', {}, text));

  const dailyDone = app.progress.dailyDone();
  const buttons = h(
    'div',
    { class: 'home-buttons' },
    h(
      'button',
      { class: 'btn btn-play', id: 'playBtn', onclick: () => app.go({ name: 'game', index: next }) },
      h('span', { class: 'big' }, h('span', { class: 'play-tri', 'aria-hidden': 'true' }), t('play')),
      h('span', { class: 'small' }, `${t('level')} ${next + 1} - ${app.worldName(app.worldOf(next))}`),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn btn-alt', onclick: () => app.go({ name: 'map', world: app.worldOf(next) }) }, label('map', t('levels'))),
      h('button', { class: 'btn btn-shop', onclick: () => app.go({ name: 'shop' }) }, label('shop', t('shop'))),
    ),
    app.s.api.enabled && h('button', { class: 'btn btn-rank', onclick: () => app.go({ name: 'ranking' }) }, label('trophy', t('ranking'))),
    h(
      'button',
      { class: 'btn btn-daily' + (dailyDone ? ' done' : ''), onclick: () => !dailyDone && app.go({ name: 'daily' }) },
      label(dailyDone ? null : 'calendar', (dailyDone ? '✓ ' : '') + (dailyDone ? t('dailyDone') : t('daily'))),
    ),
  );

  const themed = THEME_LOGO[document.body.dataset.theme as Theme];
  const logo = h('img', {
    class: themed?.cls ?? 'logo-img',
    src: themed?.src ?? logoUrl,
    alt: themed?.alt ?? 'Bosque das Setas',
    draggable: 'false',
  });
  const el = h('div', { class: 'screen home' }, top, h('div', { class: 'logo' }, logo), buttons);

  if (app.s.platform === 'web' && !isStandalone() && (deferredInstall || isIosSafari())) {
    el.appendChild(
      h(
        'button',
        {
          class: 'btn-link',
          onclick: async () => {
            if (deferredInstall) {
              deferredInstall.prompt();
              deferredInstall = null;
            } else {
              const m = modal(h('div', {}, h('h2', {}, '📲 ', t('install')), h('p', {}, t('installIos')), h('button', { class: 'btn', onclick: () => m.close() }, t('tutOk'))), { dismissable: true });
            }
          },
        },
        '📲 ',
        t('install'),
      ),
    );
  }
  return { el };
}
