import { t } from '../i18n';
import { ApiError } from '../services/api';
import { syncAccount } from '../state/sync';
import type { App, Screen } from './app';
import { h, modal, toast } from './dom';

export function accountScreen(app: App): Screen {
  const { s, progress } = app;
  const body = h('div', { class: 'account' });

  const top = h(
    'div',
    { class: 'topbar' },
    h('button', { class: 'icon-btn', onclick: () => app.back(), 'aria-label': t('back') }, '←'),
    h('h2', {}, '👤 ', t('account')),
    h('div', { style: { width: '44px' } }),
  );

  const render = () => {
    body.innerHTML = '';
    if (!s.api.enabled) {
      body.append(h('div', { class: 'card-box' }, h('p', {}, t('accountOffline'))));
      return;
    }
    if (s.api.loggedIn) renderProfile();
    else renderForms();
  };

  // ---------- conectado ----------
  const renderProfile = (sync = true) => {
    const me = s.api.me!;
    const pending = s.api.pending;
    body.append(
      h(
        'div',
        { class: 'card-box profile' },
        h('div', { class: 'avatar' }, me.nickname.slice(0, 1).toUpperCase()),
        h('h3', {}, me.nickname),
        h('p', { class: 'muted' }, me.email),
        h(
          'div',
          { class: 'stats' },
          h('div', {}, h('b', {}, String(me.maxLevel)), h('small', {}, t('levelsDone'))),
          h('div', {}, h('b', {}, String(me.totalStars)), h('small', {}, t('stars'))),
        ),
        pending > 0 && h('p', { class: 'muted' }, t('pendingRuns', { n: pending })),
      ),
      h('button', { class: 'btn btn-alt', onclick: () => app.go({ name: 'ranking' }) }, '🏆 ', t('ranking')),
      h(
        'button',
        {
          class: 'btn btn-small btn-alt',
          style: { width: '100%', marginTop: '10px' },
          onclick: () => {
            s.api.logout();
            toast(t('loggedOut'));
            render();
          },
        },
        t('logout'),
      ),
      h('button', { class: 'btn-link danger', onclick: confirmDelete }, t('deleteAccount')),
      h('a', { class: 'btn-link', href: s.api.url('/privacidade.html'), target: '_blank', rel: 'noopener' }, t('privacy')),
    );
    // atualiza os números em segundo plano (uma vez)
    if (sync)
      syncAccount(s, progress)
        .then(() => {
          if (s.api.loggedIn && document.body.contains(body)) {
            body.innerHTML = '';
            renderProfile(false);
          }
        })
        .catch(() => {});
  };

  const confirmDelete = () => {
    const m = modal(
      h(
        'div',
        {},
        h('h2', {}, '⚠️'),
        h('p', {}, t('deleteConfirm')),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn btn-alt', onclick: () => m.close() }, t('cancel')),
          h(
            'button',
            {
              class: 'btn btn-danger',
              onclick: async () => {
                try {
                  await s.api.deleteAccount();
                  m.close();
                  toast(t('accountDeleted'));
                  render();
                } catch (e) {
                  toast(e instanceof ApiError ? e.message : String(e));
                }
              },
            },
            t('yesDelete'),
          ),
        ),
      ),
    );
  };

  // ---------- entrar / criar conta ----------
  let mode: 'login' | 'register' = 'register';
  const renderForms = () => {
    const email = h('input', { type: 'email', placeholder: 'email@exemplo.com', autocomplete: 'email', inputmode: 'email' });
    const pass = h('input', { type: 'password', placeholder: t('password'), autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
    const nick = h('input', { type: 'text', placeholder: t('nickname'), maxlength: '20', autocomplete: 'nickname' });
    const err = h('p', { class: 'form-error' });
    const submit = h('button', { class: 'btn', type: 'submit' }, mode === 'login' ? t('login') : t('createAccount'));

    const form = h(
      'form',
      { class: 'card-box form' },
      h(
        'div',
        { class: 'seg tabs' },
        h('button', { type: 'button', class: mode === 'register' ? 'on' : '', onclick: () => ((mode = 'register'), render()) }, t('createAccount')),
        h('button', { type: 'button', class: mode === 'login' ? 'on' : '', onclick: () => ((mode = 'login'), render()) }, t('login')),
      ),
      h('p', { class: 'muted' }, t('accountWhy')),
      mode === 'register' && h('label', {}, t('nickname'), nick),
      h('label', {}, 'E-mail', email),
      h('label', {}, t('password'), pass),
      err,
      submit,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      submit.setAttribute('disabled', '');
      try {
        if (mode === 'register') await s.api.register(email.value, pass.value, nick.value);
        else await s.api.login(email.value, pass.value);
        await syncAccount(s, progress).catch(() => {});
        s.audio.play('win');
        toast(t('welcome', { name: s.api.me?.nickname ?? '' }));
        render();
      } catch (ex) {
        err.textContent = ex instanceof ApiError ? ex.message : String(ex);
        submit.removeAttribute('disabled');
      }
    });
    body.append(form, h('p', { class: 'muted center' }, t('guestNote')));
  };

  render();
  return { el: h('div', { class: 'screen' }, top, body) };
}
