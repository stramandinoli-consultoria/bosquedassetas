import { setLang, t } from '../i18n';
import type { App } from './app';
import { h, modal } from './dom';

export function openSettings(app: App): void {
  const p = app.progress;
  const s = p.data.settings;

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => {
    const btn = h('button', { class: 'switch' + (value ? ' on' : ''), role: 'switch', 'aria-checked': String(value) }, h('i'));
    btn.addEventListener('click', () => {
      value = !value;
      btn.classList.toggle('on', value);
      btn.setAttribute('aria-checked', String(value));
      onChange(value);
      p.save();
    });
    return h('div', { class: 'setting' }, h('span', {}, label), btn);
  };

  const langRow = h(
    'div',
    { class: 'setting' },
    h('span', {}, t('language')),
    h(
      'div',
      { class: 'seg' },
      ...(['pt', 'en'] as const).map((l) =>
        h(
          'button',
          {
            class: s.lang === l ? 'on' : '',
            onclick: () => {
              s.lang = l;
              setLang(l);
              p.save();
              m.close();
              app.home();
            },
          },
          l === 'pt' ? 'Português' : 'English',
        ),
      ),
    ),
  );

  const resetBtn = h('button', { class: 'btn-link danger' }, t('resetProgress'));
  resetBtn.addEventListener('click', () => {
    const c = modal(
      h(
        'div',
        {},
        h('p', {}, t('resetConfirm')),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn btn-alt', onclick: () => c.close() }, t('cancel')),
          h(
            'button',
            {
              class: 'btn btn-danger',
              onclick: () => {
                p.reset();
                c.close();
                m.close();
                app.home();
              },
            },
            t('yes'),
          ),
        ),
      ),
    );
  });

  const m = modal(
    h(
      'div',
      { class: 'settings' },
      h('h2', {}, '⚙️ ', t('settings')),
      toggle(t('sound'), s.sound, (v) => {
        s.sound = v;
        app.s.audio.enabled = v;
      }),
      toggle(t('haptics'), s.haptics, (v) => {
        s.haptics = v;
        app.s.haptics.enabled = v;
      }),
      langRow,
      app.s.api.enabled &&
        h(
          'button',
          { class: 'setting setting-link', onclick: () => (m.close(), app.go({ name: 'account' })) },
          h('span', {}, '👤 ', t('account')),
          h('span', {}, (app.s.api.me?.nickname ?? t('login')) + ' ›'),
        ),
      h('button', { class: 'btn', onclick: () => m.close() }, t('close')),
      resetBtn,
      h('p', { class: 'version' }, `Mundo das Setas v2.0 · ${app.s.platform}`),
      // créditos: empresa (com link) e desenvolvedor
      h(
        'p',
        { class: 'credits' },
        t('createdBy'),
        ' ',
        h('a', { href: 'https://strcore.com.br/', target: '_blank', rel: 'noopener' }, 'Strcore'),
        h('br'),
        t('developer'),
        ' Carlos Eduardo Stramandinoli',
      ),
    ),
    { dismissable: true },
  );
}
