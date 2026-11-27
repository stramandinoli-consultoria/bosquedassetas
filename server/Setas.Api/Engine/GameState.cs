namespace Setas.Api.Engine;

public enum TapKind { Ignored, Locked, Bump, Exit }

/// <summary>Resultado de um toque. LivesLost = 1 na batida, ou a quantidade de magmas que explodiram na saída.</summary>
public readonly record struct TapResult(TapKind Kind, int LivesLost);

/// <summary>
/// Estado da partida com as regras do jogo e das mecânicas especiais.
/// Porte EXATO de src/engine/state.ts (função tap); os testes em Setas.Tests
/// refazem as partidas de vectors.json e comparam cada toque.
/// </summary>
public sealed class GameState
{
    private static readonly int[] Opposite = [1, 0, 3, 2];
    private static readonly int[] Cw = [3, 2, 0, 1];
    private static readonly int[] Ccw = [2, 3, 1, 0];

    private readonly Level _level;
    private readonly int _n;
    private readonly int[] _occ;
    private readonly bool[] _alive;
    private readonly int[] _dir;
    private readonly bool[] _rev;
    private readonly int[] _ice, _iceMax, _magma, _magmaMax;
    private readonly int[] _gate;
    private readonly int[] _vine;
    private readonly bool[] _flip;
    private readonly int[] _orbit;

    public int Removed { get; private set; }
    public int Turns { get; private set; }
    public bool Cleared => Removed == _level.Arrows.Count;

    public GameState(Level level)
    {
        _level = level;
        _n = level.N;
        int count = level.Arrows.Count;
        _occ = Rules.BuildOccupancy(level);
        _alive = Enumerable.Repeat(true, count).ToArray();
        _dir = level.Arrows.Select(a => a.Dir).ToArray();
        _rev = new bool[count];
        _ice = new int[count];
        _iceMax = new int[count];
        _magma = new int[count];
        _magmaMax = new int[count];
        _gate = Enumerable.Repeat(-1, _n * _n).ToArray();
        _vine = Enumerable.Repeat(-1, count).ToArray();
        _flip = new bool[count];
        _orbit = new int[count];
        foreach (var m in level.Mechanics ?? [])
        {
            switch (m.Code)
            {
                case Mechanic.Ice: _ice[m.X] = _iceMax[m.X] = m.Y; break;
                case Mechanic.Gate: _gate[m.X] = m.Y; break;
                case Mechanic.Vine: _vine[m.X] = m.Y; _vine[m.Y] = m.X; break;
                case Mechanic.Flip: _flip[m.X] = true; break;
                case Mechanic.Orbit: _orbit[m.X] = m.Y == 1 ? 1 : -1; break;
                case Mechanic.Magma: _magma[m.X] = _magmaMax[m.X] = m.Y; break;
            }
        }
    }

    private int HeadOf(int id)
    {
        var cells = _level.Arrows[id].Cells;
        return _rev[id] ? cells[0] : cells[^1];
    }

    private int DirOf(int id) => _rev[id] ? Opposite[_dir[id]] : _dir[id];

    private int PartnerOf(int id)
    {
        int p = _vine[id];
        return p >= 0 && _alive[p] ? p : -1;
    }

    /// <summary>Raio da cabeça até a borda; ignore = parceira do cipó que sai junto</summary>
    private bool RayOk(int id, int ignore)
    {
        var (dr, dc) = Rules.Dirs[DirOf(id)];
        int h = HeadOf(id);
        int r = h / _n, c = h % _n;
        while (true)
        {
            r += dr;
            c += dc;
            if (r < 0 || c < 0 || r >= _n || c >= _n) return true;
            int idx = r * _n + c;
            int o = _occ[idx];
            if (o >= 0 && o != id && o != ignore) return false;
            int g = _gate[idx];
            if (g >= 0 && _alive[g]) return false;
        }
    }

    public TapResult Tap(int id)
    {
        if (id < 0 || id >= _alive.Length || !_alive[id]) return new TapResult(TapKind.Ignored, 0);
        int p = PartnerOf(id);
        if (_ice[id] > 0 || (p >= 0 && _ice[p] > 0)) return new TapResult(TapKind.Locked, 0);

        bool ok1 = RayOk(id, p);
        bool ok2 = p < 0 || RayOk(p, id);
        if (!ok1 || !ok2)
        {
            for (int i = 0; i < _alive.Length; i++)
                if (_alive[i] && _ice[i] > 0 && _ice[i] < _iceMax[i]) _ice[i]++;
            return new TapResult(TapKind.Bump, 1);
        }

        foreach (int e in p >= 0 ? new[] { id, p } : new[] { id })
        {
            _alive[e] = false;
            Removed++;
            foreach (int c in _level.Arrows[e].Cells) _occ[c] = -1;
        }
        for (int c = 0; c < _gate.Length; c++)
            if (_gate[c] >= 0 && !_alive[_gate[c]]) _gate[c] = -1;
        Turns++;

        int erupted = 0;
        for (int i = 0; i < _alive.Length; i++)
        {
            if (!_alive[i]) continue;
            if (_ice[i] > 0) _ice[i]--;
            if (_flip[i]) _rev[i] = !_rev[i];
            if (_orbit[i] != 0) _dir[i] = NextOrbit(i);
            if (_magma[i] > 0)
            {
                _magma[i]--;
                if (_magma[i] == 0)
                {
                    erupted++;
                    _magma[i] = _magmaMax[i];
                }
            }
        }
        return new TapResult(TapKind.Exit, erupted);
    }

    /// <summary>Próxima direção da órbita, pulando a que apontaria para dentro do próprio corpo</summary>
    private int NextOrbit(int id)
    {
        var cells = _level.Arrows[id].Cells;
        int h = cells[^1], neck = cells[^2];
        int dr = h / _n - neck / _n, dc = h % _n - neck % _n;
        int inward = Array.FindIndex(Rules.Dirs, d => d.Dr == -dr && d.Dc == -dc);
        var step = _orbit[id] > 0 ? Cw : Ccw;
        int d = step[_dir[id]];
        if (d == inward) d = step[d];
        return d;
    }
}
