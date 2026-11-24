export type Sfx = 'tap' | 'exit' | 'bump' | 'win' | 'lose' | 'hint' | 'coin' | 'preview';

export interface IAudio {
  enabled: boolean;
  /** Precisa ser chamado dentro de um toque/clique (regra dos navegadores) */
  unlock(): void;
  play(s: Sfx): void;
}

/** Efeitos sonoros sintetizados com WebAudio: nenhum arquivo de áudio necessário */
export class SynthAudio implements IAudio {
  enabled = true;
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  private tone(f: number, d: number, type: OscillatorType = 'triangle', v = 0.07, delay = 0, f2?: number) {
    const ac = this.ctx;
    if (!ac || !this.enabled) return;
    try {
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + d);
    } catch {
      /* ignora */
    }
  }

  play(s: Sfx): void {
    switch (s) {
      case 'tap':
        return this.tone(520, 0.05, 'triangle', 0.04);
      case 'preview':
        return this.tone(660, 0.06, 'sine', 0.04);
      case 'exit':
        return this.tone(500, 0.14, 'triangle', 0.06, 0, 950);
      case 'bump':
        return this.tone(170, 0.25, 'sawtooth', 0.06);
      case 'hint':
        return this.tone(880, 0.15, 'sine', 0.06);
      case 'coin':
        this.tone(988, 0.08, 'square', 0.03);
        return this.tone(1318, 0.12, 'square', 0.03, 0.07);
      case 'win':
        return [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, i * 0.1));
      case 'lose':
        this.tone(330, 0.3, 'sine', 0.08);
        return this.tone(247, 0.4, 'sine', 0.08, 0.25);
    }
  }
}
