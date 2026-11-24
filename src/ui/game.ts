import { CONFIG } from '../config';
import { dailyLevel } from '../engine/levels';
import type { Level } from '../engine/types';
import { Board } from '../game/board';
import { t, type TKey } from '../i18n';
import { Progress } from '../state/progress';
import { skinById } from '../state/skins';
import { pushState } from '../state/sync';
import type { App, Screen } from './app';
import { coinPill, h, icon, modal, toast } from './dom';

type Mode = { kind: 'level'; index: number } | { kind: 'daily' };

export function gameScreen(app: App, route: { name: 'game'; index: number } | { name: 'daily' }): Screen {
  const mode: Mode = route.name === 'daily' ? { kind: 'daily' } : { kind: 'level', index: route.index };
  const { s, progress } = app;
  const p = progress.data;
  const level: Level =
    mode.kind === 'daily' ? dailyLevel(Progress.today()) : app.level(mode.index);
  app.setBackground(mode.kind === 'daily' ? 11 : app.worldOf(mode.index));

  let lives: number = CONFIG.lives;
  let moves = 0;
  let mistakes = 0;
  let ended = false;
  /** Setas tocadas (inclusive as que bateram): o servidor refaz a partida com elas */
  const moveLog: number[] = [];
  let tutorial: HTMLElement | null = null;
  let hand: HTMLElement | null = null;

  // ---------- topo ----------
  const title: (Node | string)[] = mode.kind === 'daily' ? [icon('calendar', 'title-ico'), t('dailyTitle')] : [`${t('level')} ${mode.index + 1}`];
  const coinsUi = coinPill(p.coins);
  const heartsEl = h('div', { class: 'hearts' });
  const bar = h('i');
  const leftEl = h('span');
  const movesEl = h('span');
  const updateHud = () => {
    heartsEl.replaceChildren(
      ...Array.from({ length: CONFIG.lives }, (_, i) => h('i', { class: 'heart' + (i < lives ? '' : ' off') })),
    );
    heartsEl.setAttribute('aria-label', `${Math.max(0, lives)}/${CONFIG.lives}`);
    bar.style.width = `${((board.total - board.remaining) / board.total) * 100}%`;
    leftEl.textContent = t('arrowsLeft', { n: board.remaining });
    movesEl.textContent = t('moves', { n: moves });
    coinsUi.set(p.coins);
    hintBadge.textContent = String(p.hints);
  };

  // ---------- tabuleiro ----------
  const board = new Board(level, skinById(p.skin), {
    onExit: (a) => {
      moveLog.push(a.id);
      moves++;
      s.audio.play('exit');
      s.haptics.impact('light');
      dismissTutorial(0);
      updateHud();
    },
    onBump: (a) => {
      moveLog.push(a.id);
      moves++;
      mistakes++;
      lives--;
      s.audio.play('bump');
      s.haptics.error();
      heartsEl.classList.remove('hit');
      void heartsEl.offsetWidth;
      heartsEl.classList.add('hit');
      updateHud();
      if (lives <= 0) lose();
    },
    onClear: () => win(),
    onPreview: (_a, ok) => {
      s.audio.play('preview');
      s.haptics.impact(ok ? 'light' : 'medium');
      dismissTutorial(2);
    },
  });

  // ---------- rodapé ----------
  const hintBadge = h('span', { class: 'badge' });
  const zoomBtn = h('button', { class: 'tool tool-zoom hidden', onclick: () => board.resetZoom(), 'aria-label': 'Zoom' }, '🔍', h('small', {}, '1:1'));
  board.onZoomChange = (z) => zoomBtn.classList.toggle('hidden', !z);
  const footer = h(
    'div',
    { class: 'game-footer' },
    h('button', { class: 'tool tool-hint', onclick: () => useHint(), 'aria-label': 'Dica' }, hintBadge),
    zoomBtn,
    h('button', { class: 'tool tool-restart', onclick: () => restart(), 'aria-label': 'Reiniciar' }),
  );

  const el = h(
    'div',
    { class: 'screen game' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => app.back(), 'aria-label': t('back') }, '←'), h('h2', { class: 'plaque' }, ...title), coinsUi.el),
    h('div', { class: 'hud' }, heartsEl, h('div', { class: 'progress' }, h('span', { class: 'track' }, bar)), h('div', { class: 'hud-text' }, leftEl, movesEl)),
    h('div', { class: 'board-wrap' }, board.el),
    footer,
  );

  // tamanho do tabuleiro: o maior quadrado que cabe
  const fit = () => {
    const wrap = el.querySelector('.board-wrap') as HTMLElement;
    const size = Math.floor(Math.max(200, Math.min(wrap.clientWidth, wrap.clientHeight, 640)));
    board.el.style.width = board.el.style.height = size + 'px';
  };
  const onResize = () => {
    fit();
    board.resetZoom();
  };
  addEventListener('resize', onResize);
  requestAnimationFrame(() => {
    fit();
    updateHud();
    showTutorial();
  });

  // ---------- tutorial (fases 1 a 3) ----------
  function showTutorial() {
    if (mode.kind !== 'level' || mode.index > 2) return;
    const keys: TKey[] = ['tut1', 'tut2', 'tut3'];
    const box = h('div', { class: 'tutorial' }, h('p', {}, t(keys[mode.index])));
    if (mode.index === 0) {
      const a = board.firstFree();
      if (a) {
        const pt = board.screenPoint(a.id);
        // a mão fica fora do cartão (que tem transform) para o position: fixed funcionar
        hand = h('div', { class: 'hand', style: { left: pt.x + 'px', top: pt.y + 'px' } }, '👆');
        el.appendChild(hand);
      }
    } else {
      box.appendChild(h('button', { class: 'btn btn-small', onclick: () => dismissTutorial(mode.index) }, t('tutOk')));
    }
    tutorial = box;
    el.appendChild(box);
  }
  function dismissTutorial(forIndex: number) {
    if (tutorial && mode.kind === 'level' && mode.index === forIndex) {
      tutorial.remove();
      tutorial = null;
      hand?.remove();
      hand = null;
    }
  }

  // ---------- dicas ----------
  function useHint() {
    if (ended) return;
    if (p.hints > 0) {
      if (board.hint()) {
        p.hints--;
        progress.save();
        s.audio.play('hint');
        updateHud();
      }
      return;
    }
    const m = modal(
      h(
        'div',
        {},
        h('h2', {}, '💡 ', t('hintNone')),
        s.ads.available &&
          h(
            'button',
            {
              class: 'btn',
              onclick: async () => {
                m.close();
                if (await s.ads.showRewarded('hint')) {
                  p.hints += 3;
                  progress.save();
                  updateHud();
                  s.analytics.event('reward', { placement: 'hint' });
                }
              },
            },
            '🎬 ',
            t('hintAd'),
          ),
        h(
          'button',
          {
            class: 'btn btn-alt',
            onclick: () => {
              if (!progress.spend(CONFIG.coins.hintPrice)) return toast(t('notEnough'));
              p.hints += 1;
              progress.save();
              m.close();
              updateHud();
              s.audio.play('coin');
            },
          },
          t('hintBuy', { n: CONFIG.coins.hintPrice }),
        ),
        h('button', { class: 'btn-link', onclick: () => m.close() }, t('close')),
      ),
      { dismissable: true },
    );
  }

  function restart() {
    app.go(route, true);
  }

  // ---------- fim de fase ----------
  function win() {
    if (ended) return;
    ended = true;
    board.locked = true;
    s.audio.play('win');
    s.haptics.success();
    const stars = Math.max(1, CONFIG.lives - mistakes);
    let coins: number;
    let subtitle: string;
    // ranking: entra na fila e é enviado quando houver conta e internet
    if (mode.kind === 'daily') s.api.queueRun({ kind: 'daily', date: Progress.today(), moves: moveLog.slice() });
    else s.api.queueRun({ kind: 'level', level: mode.index, moves: moveLog.slice() });
    if (mode.kind === 'daily') {
      coins = progress.completeDaily();
      subtitle = t('dailyWin', { n: p.daily.streak });
    } else {
      coins = progress.completeLevel(mode.index, stars);
      subtitle = mistakes === 0 ? t('winPerfect') : `${t('level')} ${mode.index + 1}`;
    }
    pushState(s, progress);
    s.analytics.event('level_win', { level: mode.kind === 'daily' ? 'daily' : mode.index + 1, stars, moves });
    updateHud();

    const coinsEl = h('div', { class: 'win-coins' }, t('winCoins', { n: coins }));
    const starsEl = h('div', { class: 'win-stars' }, ...[0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '', style: { animationDelay: `${0.2 + i * 0.25}s` } }, icon('star'))));
    starsEl.setAttribute('aria-label', `${stars}/3 ★`);
    let doubled = false;
    const doubleBtn =
      s.ads.available &&
      h(
        'button',
        {
          class: 'btn btn-alt',
          onclick: async (e: Event) => {
            if (doubled) return;
            if (await s.ads.showRewarded('double_coins')) {
              doubled = true;
              progress.addCoins(coins);
              coinsEl.textContent = t('winCoins', { n: coins * 2 });
              (e.target as HTMLElement).closest('button')?.remove();
              s.audio.play('coin');
              updateHud();
            }
          },
        },
        '🎬 ',
        t('doubleCoins'),
      );
    const nextBtn = h('button', { class: 'btn btn-play' }, mode.kind === 'daily' ? t('back') : t('next'));
    nextBtn.addEventListener('click', async () => {
      // intersticial a cada N vitórias, só no app nativo
      if (s.ads.available && s.platform !== 'web' && p.winsSinceAd >= CONFIG.interstitialEvery) {
        p.winsSinceAd = 0;
        progress.save();
        await s.ads.showInterstitial();
      }
      if (mode.kind === 'daily') app.home();
      else app.go({ name: 'game', index: mode.index + 1 }, true);
    });
    setTimeout(() => {
      modal(h('div', { class: 'win' }, h('h2', {}, t('winTitle')), starsEl, h('p', {}, subtitle), coinsEl, nextBtn, doubleBtn, h('button', { class: 'btn-link', onclick: () => app.home() }, '🏠')));
    }, 450);
  }

  function lose() {
    if (ended) return;
    ended = true;
    board.locked = true;
    s.audio.play('lose');
    s.analytics.event('level_lose', { level: mode.kind === 'daily' ? 'daily' : mode.index + 1, moves });
    const revive = () => {
      lives = 1;
      ended = false;
      board.locked = false;
      updateHud();
      m.close();
    };
    const m = modal(
      h(
        'div',
        { class: 'lose' },
        h('h2', {}, t('loseTitle')),
        h('div', { class: 'big-emoji' }, '💔'),
        h('p', {}, t('loseText')),
        s.ads.available &&
          h(
            'button',
            {
              class: 'btn',
              onclick: async () => {
                if (await s.ads.showRewarded('continue')) {
                  s.analytics.event('reward', { placement: 'continue' });
                  revive();
                }
              },
            },
            '🎬 ',
            t('continueAd'),
          ),
        h(
          'button',
          {
            class: 'btn btn-alt',
            onclick: () => {
              if (!progress.spend(CONFIG.coins.continuePrice)) return toast(t('notEnough'));
              s.audio.play('coin');
              revive();
            },
          },
          t('continueCoins', { n: CONFIG.coins.continuePrice }),
        ),
        h('button', { class: 'btn btn-danger', onclick: () => restart() }, '↻ ', t('retry')),
      ),
    );
  }

  return {
    el,
    destroy() {
      removeEventListener('resize', onResize);
    },
  };
}
