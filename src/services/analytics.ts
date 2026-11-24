export interface IAnalytics {
  event(name: string, params?: Record<string, string | number | boolean>): void;
}

/**
 * Por enquanto só registra no console. Para produção, crie outra implementação
 * (Firebase Analytics, PostHog etc.) e troque em services/index.ts.
 */
export class ConsoleAnalytics implements IAnalytics {
  event(name: string, params?: Record<string, string | number | boolean>): void {
    if ((import.meta as any).env?.DEV) console.debug('[analytics]', name, params ?? {});
  }
}
