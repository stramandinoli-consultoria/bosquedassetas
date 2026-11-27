import beachBg from '../assets/beach/bg.jpg';
import desertBg from '../assets/desert/bg.jpg';
import forestBg from '../assets/forest/bg.jpg';
import glacierBg from '../assets/glacier/bg.jpg';
import jungleBg from '../assets/jungle/bg.jpg';
import canyonBg from '../assets/canyon/bg.jpg';
import oceanBg from '../assets/ocean/bg.jpg';
import cityBg from '../assets/city/bg.jpg';
import volcanoBg from '../assets/volcano/bg.jpg';
import { CONFIG, WORLDS, type Theme } from '../config';
import { levelAt } from '../engine/levels';
import type { Level, PackedLevel } from '../engine/types';
import { lang } from '../i18n';
import type { Services } from '../services';
import type { Progress } from '../state/progress';

export type Route =
  | { name: 'home' }
  | { name: 'map'; world?: number }
  | { name: 'game'; index: number }
  | { name: 'daily' }
  | { name: 'shop' }
  | { name: 'account' }
  | { name: 'ranking' };

export interface Screen {
  el: HTMLElement;
  destroy?(): void;
}

const THEME_BG: Record<Theme, string> = { forest: forestBg, beach: beachBg, desert: desertBg, glacier: glacierBg, volcano: volcanoBg, city: cityBg, jungle: jungleBg, canyon: canyonBg, ocean: oceanBg };

function roman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}

/** Contexto compartilhado pelas telas */
export class App {
  private current: Screen | null = null;
  private cache = new Map<number, Level>();
  private screens: Record<Route['name'], (app: App, r: any) => Screen> = {} as any;
  private history: Route[] = [];

  constructor(
    readonly root: HTMLElement,
    readonly s: Services,
    readonly progress: Progress,
    private packed: PackedLevel[],
  ) {}

  register(name: Route['name'], factory: (app: App, r: any) => Screen): void {
    this.screens[name] = factory;
  }

  /** Fases curadas (levels.json); depois delas as fases são geradas sem fim */
  get curatedCount(): number {
    return this.packed.length;
  }

  level(i: number): Level {
    let l = this.cache.get(i);
    if (!l) {
      l = levelAt(i, this.packed);
      if (this.cache.size > 40) this.cache.clear();
      this.cache.set(i, l);
    }
    return l;
  }

  worldOf(index: number): number {
    return Math.floor(index / CONFIG.worldSize);
  }

  /** Depois do 15º mundo os nomes se repetem com numeração: Bosque II, Praia II… */
  worldName(w: number): string {
    const base = WORLDS[w % WORLDS.length].name[lang()];
    const lap = Math.floor(w / WORLDS.length);
    return lap ? `${base} ${roman(lap + 1)}` : base;
  }

  /**
   * Fundo do mundo (floresta, praia, deserto, geleira, vulcão, cidade, selva, cânion ou oceano) com um leve tom da cor do mundo por cima.
   * Também marca o tema em <body data-theme>, que troca as imagens das peças pelo CSS.
   */
  setBackground(w: number): void {
    const world = WORLDS[w % WORLDS.length];
    const theme: Theme = world.theme ?? 'forest';
    const [a, b] = world.bg;
    document.body.dataset.theme = theme;
    document.body.style.background =
      `linear-gradient(${a}33, ${b}88) fixed, url(${THEME_BG[theme]}) center / cover no-repeat fixed, ${b}`;
  }

  go(route: Route, replace = false): void {
    if (!replace) this.history.push(route);
    else this.history[this.history.length - 1] = route;
    this.current?.destroy?.();
    // o cenário decorativo muda um pouco conforme a tela (ex.: lanterna e cipós só no início)
    document.body.dataset.screen = route.name;
    this.root.innerHTML = '';
    document.querySelectorAll('.modal').forEach((m) => m.remove());
    this.current = this.screens[route.name](this, route);
    this.root.appendChild(this.current.el);
    this.root.scrollTop = 0;
  }

  /** Botão voltar (tela ou botão físico do Android). Devolve false se já está na home */
  back(): boolean {
    const openModal = document.querySelector('.modal');
    if (openModal) {
      openModal.remove();
      return true;
    }
    if (this.history.length <= 1) return false;
    this.history.pop();
    const prev = this.history[this.history.length - 1];
    this.go(prev, true);
    return true;
  }

  home(): void {
    this.history = [];
    this.go({ name: 'home' });
  }
}
