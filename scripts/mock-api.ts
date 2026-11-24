/**
 * API falsa em memória, com o MESMO contrato da API .NET (server/Setas.Api).
 * Serve para testar o jogo sem Postgres/.NET:
 *
 *   npx tsx scripts/mock-api.ts            (porta 8080, serve dist-single/setas.html em /)
 *
 * Não use em produção: não guarda nada em disco e não protege senhas.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import levels from '../src/data/levels.json' with { type: 'json' };
import { levelAt, dailyLevel } from '../src/engine/levels';
import { buildOccupancy, checkExit } from '../src/engine/rules';
import type { Level, PackedLevel } from '../src/engine/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;

interface U { id: string; email: string; nickname: string; password: string; maxLevel: number; totalStars: number; maxLevelAt: number; state: object; stars: Map<number, number> }
const users = new Map<string, U>();
const tokens = new Map<string, string>();
const daily = new Map<string, { userId: string; mistakes: number; moves: number; at: number }>();

function replay(level: Level, moves: number[]) {
  const n = level.arrows.length;
  if (moves.length < n || moves.length > n * 4 + 50) return null;
  const occ = buildOccupancy(level);
  const alive = new Array(n).fill(true);
  let removed = 0, mistakes = 0;
  for (const id of moves) {
    if (id < 0 || id >= n || !alive[id]) return null;
    const a = level.arrows[id];
    if (checkExit(level.n, occ, a).ok) { alive[id] = false; a.cells.forEach((c) => (occ[c] = -1)); removed++; } else mistakes++;
  }
  if (removed !== n) return null;
  return { stars: Math.max(1, 3 - mistakes), mistakes, moves: moves.length };
}
const me = (u: U) => ({ id: u.id, email: u.email, nickname: u.nickname, maxLevel: u.maxLevel, totalStars: u.totalStars, stars: Array.from({ length: u.maxLevel }, (_, i) => u.stars.get(i) ?? 0), state: u.state });
const today = () => new Date().toISOString().slice(0, 10);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (status: number, body?: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  if (!url.pathname.startsWith('/api') && url.pathname !== '/health') {
    const file = url.pathname === '/' ? 'dist-single/setas.html' : url.pathname.slice(1);
    try {
      const data = readFileSync(resolve(root, file.includes('..') ? 'x' : file));
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      return res.end(data);
    } catch { res.writeHead(404); return res.end(); }
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const uid = tokens.get((req.headers.authorization ?? '').replace('Bearer ', ''));
  const user = uid ? users.get(uid) : undefined;
  const err = (status: number, error: string) => send(status, { error });
  const p = url.pathname, m = req.method;

  if (p === '/health') return send(200, { status: 'ok' });
  if (p === '/api/auth/register' && m === 'POST') {
    if (!/^\S+@\S+\.\S+$/.test(body.email ?? '')) return err(400, 'E-mail inválido.');
    if ((body.password ?? '').length < 6) return err(400, 'A senha precisa ter pelo menos 6 caracteres.');
    if (!/^[\p{L}\p{N}_.\- ]{3,20}$/u.test((body.nickname ?? '').trim())) return err(400, 'O apelido precisa ter de 3 a 20 letras, números, espaço, _ . ou -.');
    if ([...users.values()].some((u) => u.email.toLowerCase() === body.email.toLowerCase())) return err(409, 'Já existe uma conta com esse e-mail.');
    if ([...users.values()].some((u) => u.nickname.toLowerCase() === body.nickname.trim().toLowerCase())) return err(409, 'Esse apelido já está em uso.');
    const u: U = { id: crypto.randomUUID(), email: body.email.trim(), nickname: body.nickname.trim(), password: body.password, maxLevel: 0, totalStars: 0, maxLevelAt: Date.now(), state: {}, stars: new Map() };
    users.set(u.id, u);
    const tk = crypto.randomUUID(); tokens.set(tk, u.id);
    return send(200, { token: tk, me: me(u) });
  }
  if (p === '/api/auth/login' && m === 'POST') {
    const u = [...users.values()].find((x) => x.email.toLowerCase() === (body.email ?? '').trim().toLowerCase() && x.password === body.password);
    if (!u) return err(401, 'E-mail ou senha incorretos.');
    const tk = crypto.randomUUID(); tokens.set(tk, u.id);
    return send(200, { token: tk, me: me(u) });
  }
  if (p === '/api/leaderboard' && m === 'GET') {
    const sorted = [...users.values()].filter((u) => u.maxLevel > 0).sort((a, b) => b.maxLevel - a.maxLevel || b.totalStars - a.totalStars || a.maxLevelAt - b.maxLevelAt);
    const top = sorted.slice(0, 50).map((u, i) => ({ rank: i + 1, nickname: u.nickname, level: u.maxLevel, stars: u.totalStars }));
    const idx = user ? sorted.indexOf(user) : -1;
    return send(200, { top, me: idx >= 0 ? { rank: idx + 1, nickname: user!.nickname, level: user!.maxLevel, stars: user!.totalStars } : null, players: sorted.length });
  }
  if (p === '/api/leaderboard/daily' && m === 'GET') {
    const date = url.searchParams.get('date') ?? today();
    const rows = [...daily.entries()].filter(([k]) => k.endsWith('|' + date)).map(([, v]) => v).sort((a, b) => a.mistakes - b.mistakes || a.moves - b.moves || a.at - b.at);
    const top = rows.slice(0, 50).map((r, i) => ({ rank: i + 1, nickname: users.get(r.userId)?.nickname ?? '?', mistakes: r.mistakes, moves: r.moves }));
    const mi = user ? rows.findIndex((r) => r.userId === user.id) : -1;
    return send(200, { date, top, me: mi >= 0 ? { ...top[mi], rank: mi + 1 } : null, players: rows.length });
  }
  if (!user) return send(401);
  if (p === '/api/me' && m === 'GET') return send(200, me(user));
  if (p === '/api/me/state' && m === 'PUT') { user.state = body; return send(204); }
  if (p === '/api/me' && m === 'DELETE') { users.delete(user.id); return send(204); }
  if (p === '/api/runs' && m === 'POST') {
    if (body.level > user.maxLevel) return err(409, 'Fase ainda bloqueada para esta conta.');
    const r = replay(levelAt(body.level, levels as unknown as PackedLevel[]), body.moves ?? []);
    if (!r) return err(422, 'A fase não foi concluída.');
    const prev = user.stars.get(body.level) ?? 0;
    if (r.stars > prev) { user.totalStars += r.stars - prev; user.stars.set(body.level, r.stars); }
    if (body.level === user.maxLevel) { user.maxLevel++; user.maxLevelAt = Date.now(); }
    return send(200, { ok: true, stars: r.stars, maxLevel: user.maxLevel, totalStars: user.totalStars });
  }
  if (p === '/api/daily' && m === 'POST') {
    const r = replay(dailyLevel(body.date), body.moves ?? []);
    if (!r) return err(422, 'A fase não foi concluída.');
    const key = user.id + '|' + body.date;
    const ex = daily.get(key);
    if (!ex || r.mistakes < ex.mistakes || (r.mistakes === ex.mistakes && r.moves < ex.moves)) daily.set(key, { userId: user.id, mistakes: r.mistakes, moves: r.moves, at: Date.now() });
    return send(200, { ok: true, mistakes: r.mistakes, moves: r.moves, rank: 1 });
  }
  return err(404, 'Rota não encontrada');
}).listen(PORT, () => console.log(`API falsa em http://localhost:${PORT}`));
