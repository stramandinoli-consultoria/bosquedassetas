import calendarUrl from '../assets/atlas/icon-calendar.png';
import coinUrl from '../assets/atlas/icon-coin.png';
import gearUrl from '../assets/atlas/icon-gear.png';
import mapUrl from '../assets/atlas/icon-map.png';
import shopUrl from '../assets/atlas/icon-shop.png';
import starUrl from '../assets/atlas/icon-star.png';
import trophyUrl from '../assets/atlas/icon-trophy.png';
import userUrl from '../assets/atlas/icon-user.png';

type Child = Node | string | number | null | undefined | false;

/** Ícones do atlas "Bosque das Setas" */
const ICONS = {
  calendar: calendarUrl,
  coin: coinUrl,
  gear: gearUrl,
  map: mapUrl,
  shop: shopUrl,
  star: starUrl,
  trophy: trophyUrl,
  user: userUrl,
} as const;
export type IconName = keyof typeof ICONS;

/** Ícone decorativo (o texto ao lado já diz o que é, então fica escondido de leitores de tela) */
export function icon(name: IconName, cls = ''): HTMLImageElement {
  return h('img', { class: ('ico ' + cls).trim(), src: ICONS[name], alt: '', 'aria-hidden': 'true', draggable: 'false' });
}
type Props = Record<string, any>;

/** Cria um elemento: h('button', { class: 'btn', onclick }, 'Texto') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export interface ModalHandle {
  el: HTMLElement;
  close(): void;
}

/** Janela modal dentro da página (alert/confirm não funcionam em todos os WebViews) */
export function modal(content: HTMLElement, opts: { dismissable?: boolean; onClose?: () => void } = {}): ModalHandle {
  const card = h('div', { class: 'modal-card' }, content);
  const ov = h('div', { class: 'modal' }, card);
  const close = () => {
    ov.classList.add('closing');
    setTimeout(() => ov.remove(), 180);
    opts.onClose?.();
  };
  if (opts.dismissable)
    ov.addEventListener('pointerdown', (e) => {
      if (e.target === ov) close();
    });
  document.body.appendChild(ov);
  return { el: ov, close };
}

export function toast(text: string, ms = 1800): void {
  const t = h('div', { class: 'toast' }, text);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 300);
}

/** Pílula de moedas com o ícone do tema; set(n) atualiza o valor */
export function coinPill(n: number): { el: HTMLDivElement; set(n: number): void } {
  const val = h('span', {}, String(n));
  const el = h('div', { class: 'pill pill-ico pill-coins', 'data-coins': '' }, icon('coin'), val);
  return { el, set: (v) => (val.textContent = String(v)) };
}

/** Desenho de uma seta decorativa (logo, loja) */
export function arrowIcon(color: string, size = 40): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 3 2');
  svg.setAttribute('width', String(size * 1.5));
  svg.setAttribute('height', String(size));
  const d = 'M0.5 1.5L0.5 0.5L2 0.5';
  const head = '1.94,0.24 2.38,0.5 1.94,0.76';
  const edge = 'rgba(20,10,5,.7)';
  svg.innerHTML =
    `<path d="${d}" fill="none" stroke="${edge}" stroke-width=".42" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<polygon points="${head}" fill="${edge}" stroke="${edge}" stroke-width=".18" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width=".3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<polygon points="${head}" fill="${color}" stroke="${color}" stroke-width=".06" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="rgba(255,255,255,.38)" stroke-width=".08" stroke-linecap="round" stroke-linejoin="round"/>`;
  return svg;
}
