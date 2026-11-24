import { t } from '../i18n';
import { ApiError, type DailyLeaderboard, type Leaderboard } from '../services/api';
import { Progress } from '../state/progress';
import type { App, Screen } from './app';
import { h, icon } from './dom';

export function rankingScreen(app: App): Screen {
  const { s } = app;
  let tab: 'all' | 'daily' = 'all';
  const list = h('div', { class: 'rank-list' });
  const tabs = h('div', { class: 'seg tabs' });

  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r));

  const renderTabs = () => {
    tabs.innerHTML = '';
    tabs.append(
      h('button', { class: tab === 'all' ? 'on' : '', onclick: () => ((tab = 'all'), load()) }, icon('trophy', 'tab-ico'), t('rankAll')),
      h('button', { class: tab === 'daily' ? 'on' : '', onclick: () => ((tab = 'daily'), load()) }, icon('calendar', 'tab-ico'), t('rankDaily')),
    );
  };

  const row = (rank: number, name: string, main: string, sub: string, mine = false) =>
    h('div', { class: 'rank-row' + (mine ? ' mine' : '') }, h('span', { class: 'pos' }, medal(rank)), h('span', { class: 'name' }, name), h('span', { class: 'val' }, h('b', {}, main), h('small', {}, sub)));

  const load = async () => {
    renderTabs();
    list.innerHTML = '';
    if (!s.api.enabled) {
      list.append(h('p', { class: 'muted center' }, t('accountOffline')));
      return;
    }
    list.append(h('p', { class: 'muted center' }, '…'));
    try {
      await s.api.flush();
      list.innerHTML = '';
      if (tab === 'all') {
        const lb: Leaderboard = await s.api.leaderboard();
        list.append(h('p', { class: 'muted center' }, t('players', { n: lb.players })));
        lb.top.forEach((e) => list.append(row(e.rank, e.nickname, `${t('level')} ${e.level}`, `⭐ ${e.stars}`, e.nickname === s.api.me?.nickname)));
        if (lb.me && !lb.top.some((e) => e.nickname === lb.me!.nickname))
          list.append(h('div', { class: 'rank-sep' }, '···'), row(lb.me.rank, lb.me.nickname, `${t('level')} ${lb.me.level}`, `⭐ ${lb.me.stars}`, true));
        if (!lb.top.length) list.append(h('p', { class: 'muted center' }, t('rankEmpty')));
      } else {
        const d: DailyLeaderboard = await s.api.dailyLeaderboard(Progress.today());
        list.append(h('p', { class: 'muted center' }, t('players', { n: d.players })));
        d.top.forEach((e) => list.append(row(e.rank, e.nickname, t('mistakesN', { n: e.mistakes }), t('moves', { n: e.moves }), e.nickname === s.api.me?.nickname)));
        if (d.me && !d.top.some((e) => e.nickname === d.me!.nickname))
          list.append(h('div', { class: 'rank-sep' }, '···'), row(d.me.rank, d.me.nickname, t('mistakesN', { n: d.me.mistakes }), t('moves', { n: d.me.moves }), true));
        if (!d.top.length) list.append(h('p', { class: 'muted center' }, t('rankEmpty')));
      }
      if (!s.api.loggedIn)
        list.append(
          h('div', { class: 'card-box center' }, h('p', {}, t('rankJoin')), h('button', { class: 'btn', onclick: () => app.go({ name: 'account' }) }, '👤 ', t('createAccount'))),
        );
    } catch (e) {
      list.innerHTML = '';
      list.append(h('p', { class: 'muted center' }, e instanceof ApiError ? e.message : String(e)), h('button', { class: 'btn btn-alt', onclick: () => load() }, '↻'));
    }
  };

  load();
  const el = h(
    'div',
    { class: 'screen ranking' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => app.back(), 'aria-label': t('back') }, '←'), h('h2', {}, icon('trophy', 'title-ico'), t('ranking')), h('div', { style: { width: '44px' } })),
    tabs,
    list,
  );
  return { el };
}
