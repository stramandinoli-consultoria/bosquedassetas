/**
 * Detecção de plataforma sem depender do pacote @capacitor/core:
 * dentro do app nativo o Capacitor injeta `window.Capacitor`.
 */
export type Platform = 'web' | 'android' | 'ios';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
}

export function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as any).Capacitor as CapacitorGlobal | undefined;
}

export function isNative(): boolean {
  return !!capacitor()?.isNativePlatform?.();
}

export function platform(): Platform {
  const p = capacitor()?.getPlatform?.();
  return p === 'android' || p === 'ios' ? p : 'web';
}

/** Acesso a um plugin nativo registrado (ex.: 'Haptics'), se existir */
export function nativePlugin<T = any>(name: string): T | undefined {
  return isNative() ? (capacitor()?.Plugins?.[name] as T | undefined) : undefined;
}
