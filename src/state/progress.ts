import { CONFIG } from '../config';
import type { IStorage } from '../services/storage';

export type Lang = 'pt' | 'en';

export interface ProgressData {
  /** Índice da maior fase liberada (0 = fase 1) */
  unlocked: number;
  /** Estrelas por fase (0..3) */
  stars: number[];
  coins: number;
  hints: number;
  skin: string;
  owned: string[];
  settings: { sound: boolean; haptics: boolean; lang: Lang };
  daily: { date: string; done: boolean; streak: number };
  winsSinceAd: number;
  /** Mecânicas especiais que o jogador já viu apresentadas (balão da 1ª vez) */
  mechSeen: string[];
}

const KEY = 'progress.v1';

export function defaults(): ProgressData {
  const lang: Lang = (globalThis.navigator?.language ?? 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
  return {
    unlocked: 0,
    stars: [],
    coins: 0,
    hints: CONFIG.startingHints,
    skin: 'classic',
    owned: ['classic'],
    settings: { sound: true, haptics: true, lang },
    daily: { date: '', done: false, streak: 0 },
    winsSinceAd: 0,
    mechSeen: [],
  };
}

export class Progress {
  data: ProgressData;

  constructor(private storage: IStorage) {
    this.data = { ...defaults(), ...storage.get<Partial<ProgressData>>(KEY, {}) };
  }

  save(): void {
    this.storage.set(KEY, this.data);
  }

  reset(): void {
    const lang = this.data.settings.lang;
    this.data = defaults();
    this.data.settings.lang = lang;
    this.save();
  }

  /** Registra a vitória; devolve as moedas ganhas */
  completeLevel(index: number, stars: number): number {
    const before = this.data.stars[index] ?? 0;
    // só paga as estrelas novas, para não dar para "farmar" fase fácil
    const coins = Math.max(0, stars - before) * CONFIG.coins.perStar + 5;
    this.data.stars[index] = Math.max(before, stars);
    this.data.unlocked = Math.max(this.data.unlocked, index + 1);
    this.data.coins += coins;
    this.data.winsSinceAd++;
    this.save();
    return coins;
  }

  spend(amount: number): boolean {
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  addCoins(amount: number): void {
    this.data.coins += amount;
    this.save();
  }

  totalStars(): number {
    return this.data.stars.reduce((s, x) => s + (x || 0), 0);
  }

  /** Data local no formato AAAA-MM-DD */
  static today(d = new Date()): string {
    const p = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  dailyDone(): boolean {
    return this.data.daily.date === Progress.today() && this.data.daily.done;
  }

  completeDaily(): number {
    const today = Progress.today();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const streak = this.data.daily.date === Progress.today(y) && this.data.daily.done ? this.data.daily.streak + 1 : 1;
    this.data.daily = { date: today, done: true, streak };
    const coins = CONFIG.coins.daily + Math.min(streak - 1, 6) * 10;
    this.data.coins += coins;
    this.save();
    return coins;
  }
}
