export interface IStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

/**
 * localStorage funciona no navegador, no PWA e dentro do WebView do Capacitor.
 * Tudo protegido com try/catch porque alguns navegadores bloqueiam o acesso.
 */
export class LocalStorage implements IStorage {
  constructor(private prefix = 'setas:') {}

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      /* sem armazenamento disponível: o jogo segue sem salvar */
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignora */
    }
  }
}

/** Implementação em memória, usada nos testes */
export class MemoryStorage implements IStorage {
  private data = new Map<string, string>();
  get<T>(key: string, fallback: T): T {
    const v = this.data.get(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  }
  set<T>(key: string, value: T): void {
    this.data.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}
