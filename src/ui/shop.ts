import { lang, t } from '../i18n';
import { SKINS } from '../state/skins';
import { pushState } from '../state/sync';
import type { App, Screen } from './app';
import { arrowIcon, coinPill, h, icon, toast } from './dom';

export function shopScreen(app: App): Screen {
  const p = app.progress;
  const coinsUi = coinPill(p.data.coins);
  const list = h('div', { class: 'shop-list' });

  const render = () => {
    coinsUi.set(p.data.coins);
    list.innerHTML = '';
    for (const s of SKINS) {
      const owned = p.data.owned.includes(s.id);
      const using = p.data.skin === s.id;
      const sample = h('div', { class: 'skin-sample', style: { background: s.board } });
      s.colors.slice(0, 3).forEach((c) => sample.appendChild(arrowIcon(c, 18)));
      const dots = h('div', { class: 'skin-dots' }, ...s.colors.map((c) => h('i', { style: { background: c } })));
      const action = using
        ? h('button', { class: 'btn btn-small', disabled: true }, '✓ ', t('owned'))
        : owned
          ? h('button', { class: 'btn btn-small btn-alt', onclick: () => select(s.id) }, t('use'))
          : h('button', { class: 'btn btn-small', onclick: () => buy(s.id, s.price) }, h('span', { class: 'btn-label' }, `${t('buy')} ·`, icon('coin', 'btn-coin'), String(s.price)));
      list.appendChild(h('div', { class: 'skin-row' + (using ? ' using' : '') }, sample, h('div', { class: 'skin-info' }, h('b', {}, s.name[lang()]), dots), action));
    }
  };
  const select = (id: string) => {
    p.data.skin = id;
    p.save();
    pushState(app.s, p);
    app.s.audio.play('tap');
    render();
  };
  const buy = (id: string, price: number) => {
    if (!p.spend(price)) {
      toast(t('notEnough'));
      app.s.haptics.error();
      return;
    }
    p.data.owned.push(id);
    p.data.skin = id;
    p.save();
    app.s.audio.play('coin');
    app.s.haptics.success();
    app.s.analytics.event('skin_buy', { id, price });
    pushState(app.s, p);
    render();
  };
  render();

  const el = h(
    'div',
    { class: 'screen shop' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => app.back(), 'aria-label': t('back') }, '←'), h('h2', {}, icon('shop', 'title-ico'), t('shop')), coinsUi.el),
    list,
  );
  return { el };
}
