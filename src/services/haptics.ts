import { nativePlugin } from './platform';

export type Impact = 'light' | 'medium' | 'heavy';

export interface IHaptics {
  enabled: boolean;
  impact(style: Impact): void;
  error(): void;
  success(): void;
}

/** Vibração no app nativo via plugin @capacitor/haptics (acessado pela ponte do Capacitor) */
export class NativeHaptics implements IHaptics {
  enabled = true;
  private get p() {
    return nativePlugin('Haptics');
  }
  impact(style: Impact): void {
    if (!this.enabled) return;
    this.p?.impact?.({ style: style.toUpperCase() }).catch?.(() => {});
  }
  error(): void {
    if (!this.enabled) return;
    this.p?.notification?.({ type: 'ERROR' }).catch?.(() => {});
  }
  success(): void {
    if (!this.enabled) return;
    this.p?.notification?.({ type: 'SUCCESS' }).catch?.(() => {});
  }
}

/** No navegador usa a Vibration API (Android/Chrome); no iPhone pelo Safari não vibra */
export class WebHaptics implements IHaptics {
  enabled = true;
  private vibrate(p: number | number[]) {
    if (!this.enabled) return;
    try {
      navigator.vibrate?.(p);
    } catch {
      /* ignora */
    }
  }
  impact(style: Impact): void {
    this.vibrate(style === 'light' ? 8 : style === 'medium' ? 15 : 30);
  }
  error(): void {
    this.vibrate([30, 40, 30]);
  }
  success(): void {
    this.vibrate(20);
  }
}
