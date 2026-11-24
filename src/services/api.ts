import type { IStorage } from './storage';

export interface MeDto {
  id: string;
  email: string;
  nickname: string;
  /** Próxima fase a jogar, conferida pelo servidor */
  maxLevel: number;
  totalStars: number;
  stars: number[];
  state: Record<string, unknown>;
}
export interface RankEntry {
  rank: number;
  nickname: string;
  level: number;
  stars: number;
}
export interface DailyEntry {
  rank: number;
  nickname: string;
  mistakes: number;
  moves: number;
}
export interface Leaderboard {
  top: RankEntry[];
  me: RankEntry | null;
  players: number;
}
export interface DailyLeaderboard {
  date: string;
  top: DailyEntry[];
  me: DailyEntry | null;
  players: number;
}

type QueuedRun = { kind: 'level'; level: number; moves: number[] } | { kind: 'daily'; date: string; moves: number[] };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const QUEUE_MAX = 1500;

/**
 * Cliente da API (server/Setas.Api).
 *
 * As partidas vencidas entram numa fila salva no aparelho e são enviadas
 * quando houver conta e internet. Assim quem joga como convidado e cria a
 * conta depois não perde as fases já feitas no ranking.
 */
export class ApiClient {
  private flushing = false;

  constructor(
    private base: string,
    private storage: IStorage,
    readonly enabled: boolean,
  ) {}

  /** Endereço completo de uma página do servidor (ex.: /privacidade.html) */
  url(path: string): string {
    return this.base + path;
  }

  get token(): string | null {
    return this.storage.get<string | null>('auth.token', null);
  }
  get me(): MeDto | null {
    return this.storage.get<MeDto | null>('auth.me', null);
  }
  get loggedIn(): boolean {
    return !!this.token;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.enabled) throw new ApiError('Servidor não configurado.', 0);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let res: Response;
    try {
      res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError('Sem conexão com o servidor.', 0);
    }
    if (res.status === 401 && this.token) this.clearSession();
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError((data as any)?.error ?? `Erro ${res.status}`, res.status);
    return data as T;
  }

  private setSession(token: string, me: MeDto) {
    this.storage.set('auth.token', token);
    this.storage.set('auth.me', me);
  }
  private clearSession() {
    this.storage.remove('auth.token');
    this.storage.remove('auth.me');
  }

  async register(email: string, password: string, nickname: string): Promise<MeDto> {
    const r = await this.req<{ token: string; me: MeDto }>('POST', '/api/auth/register', { email, password, nickname });
    this.setSession(r.token, r.me);
    return r.me;
  }

  async login(email: string, password: string): Promise<MeDto> {
    const r = await this.req<{ token: string; me: MeDto }>('POST', '/api/auth/login', { email, password });
    this.setSession(r.token, r.me);
    return r.me;
  }

  logout(): void {
    this.clearSession();
  }

  async refreshMe(): Promise<MeDto | null> {
    if (!this.loggedIn) return null;
    const me = await this.req<MeDto>('GET', '/api/me');
    this.storage.set('auth.me', me);
    return me;
  }

  async saveState(state: Record<string, unknown>): Promise<void> {
    if (!this.loggedIn) return;
    await this.req('PUT', '/api/me/state', state);
  }

  async deleteAccount(): Promise<void> {
    await this.req('DELETE', '/api/me');
    this.clearSession();
    this.storage.remove('runs.queue');
  }

  leaderboard(limit = 50): Promise<Leaderboard> {
    return this.req('GET', `/api/leaderboard?limit=${limit}`);
  }

  dailyLeaderboard(date: string, limit = 50): Promise<DailyLeaderboard> {
    return this.req('GET', `/api/leaderboard/daily?date=${encodeURIComponent(date)}&limit=${limit}`);
  }

  // ---------- fila de partidas ----------
  queueRun(run: QueuedRun): void {
    const q = this.storage.get<QueuedRun[]>('runs.queue', []);
    q.push(run);
    while (q.length > QUEUE_MAX) q.shift();
    this.storage.set('runs.queue', q);
    void this.flush();
  }

  get pending(): number {
    return this.storage.get<QueuedRun[]>('runs.queue', []).length;
  }

  /** Envia a fila em ordem. Para no primeiro erro de rede; descarta partidas recusadas. */
  async flush(): Promise<void> {
    if (!this.enabled || !this.loggedIn || this.flushing) return;
    this.flushing = true;
    try {
      for (;;) {
        const q = this.storage.get<QueuedRun[]>('runs.queue', []);
        if (!q.length) break;
        const run = q[0];
        try {
          if (run.kind === 'level') {
            const r = await this.req<{ maxLevel: number; totalStars: number }>('POST', '/api/runs', { level: run.level, moves: run.moves });
            const me = this.me;
            if (me) this.storage.set('auth.me', { ...me, maxLevel: r.maxLevel, totalStars: r.totalStars });
          } else {
            await this.req('POST', '/api/daily', { date: run.date, moves: run.moves });
          }
        } catch (e) {
          // sem internet / servidor fora: tenta de novo depois
          if (!(e instanceof ApiError) || e.status === 0 || e.status === 401 || e.status === 429 || e.status >= 500) break;
          // 409/422: partida recusada (fase bloqueada, desafio vencido, jogada inválida): descarta
        }
        const rest = this.storage.get<QueuedRun[]>('runs.queue', []);
        rest.shift();
        this.storage.set('runs.queue', rest);
      }
    } finally {
      this.flushing = false;
    }
  }
}
