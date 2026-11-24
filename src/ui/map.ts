import { CONFIG, WORLDS } from '../config';
import { t } from '../i18n';
import type { App, Screen } from './app';
import { coinPill, h, icon } from './dom';

export function mapScreen(app: App, route: { world?: number }): Screen {
  const p = app.progress.data;
  // mostra os mundos já alcançados + o próximo (com cadeado); as fases não acabam
  const worlds = app.worldOf(p.unlocked) + 2;
  const current = route.world ?? app.worldOf(p.unlocked);
  app.setBackground(current);

  const list = h('div', { class: 'worlds' });
  let focus: HTMLElement | null = null;

  for (let w = 0; w < worlds; w++) {
    const first = w * CONFIG.worldSize;
    const last = first + CONFIG.worldSize - 1;
    const locked = first > p.unlocked;
    let stars = 0;
    for (let i = first; i <= last; i++) stars += p.stars[i] ?? 0;
    const [c1, c2] = WORLDS[w % WORLDS.length].bg;

    const grid = h('div', { class: 'level-grid' });
    for (let i = first; i <= last; i++) {
      const open = i <= p.unlocked;
      const st = p.stars[i] ?? 0;
      grid.appendChild(
        h(
          'button',
          {
            class: 'lvl-btn' + (open ? '' : ' locked') + (i === p.unlocked ? ' current' : ''),
            disabled: !open,
            onclick: () => app.go({ name: 'game', index: i }),
            'aria-label': `${t('level')} ${i + 1}`,
          },
          h('b', {}, open ? String(i + 1) : '🔒'),
          h('span', { class: 'mini-stars' }, open ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''),
        ),
      );
    }

    const section = h(
      'section',
      { class: 'world' + (locked ? ' locked' : ''), style: { background: `linear-gradient(135deg, ${c1}, ${c2})` } },
      h(
        'header',
        {},
        h('div', {}, h('small', {}, t('world', { n: w + 1 })), h('h3', {}, app.worldName(w))),
        h('div', { class: 'pill pill-ico' }, icon('star'), `${stars}/${(last - first + 1) * 3}`),
      w * CONFIG.worldSize >= app.curatedCount && !locked ? h('span', { class: 'tag' }, '∞') : null,
      ),
      locked ? h('p', { class: 'locked-msg' }, '🔒 ', t('locked')) : grid,
    );
    if (w === current) focus = section;
    list.appendChild(section);
  }

  const el = h(
    'div',
    { class: 'screen map' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => app.back(), 'aria-label': t('back') }, '←'), h('h2', {}, t('levels')), coinPill(p.coins).el),
    list,
  );
  requestAnimationFrame(() => focus?.scrollIntoView({ block: 'start' }));
  return { el };
}
