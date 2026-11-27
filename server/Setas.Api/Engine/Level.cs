namespace Setas.Api.Engine;

/// <summary>Seta: células da cauda até a cabeça (índice = linha * n + coluna)</summary>
public sealed record Arrow(int Id, int[] Cells, int Dir, int Color)
{
    public int Head => Cells[^1];
}

/// <summary>
/// Mecânica especial (src/engine/types.ts). Códigos do levels.json:
/// 0 gelo [seta, contador] · 1 portão [célula, chave] · 2 cipó [a, b] · 3 mão dupla [seta] · 4 órbita [seta, horário] · 5 magma [seta, contador]
/// </summary>
public sealed record Mechanic(int Code, int X, int Y)
{
    public const int Ice = 0, Gate = 1, Vine = 2, Flip = 3, Orbit = 4, Magma = 5;
}

public sealed record Level(int N, IReadOnlyList<Arrow> Arrows, IReadOnlyList<Mechanic>? Mechanics = null);

public readonly record struct ExitResult(bool Ok, int Steps, int Blocker);

public sealed record SolveResult(bool Solvable, int Depth, int FreeAtStart, IReadOnlyList<int> Order);

/// <summary>Regras do jogo — porte de src/engine/rules.ts</summary>
public static class Rules
{
    /// <summary>0 = cima, 1 = baixo, 2 = esquerda, 3 = direita</summary>
    public static readonly (int Dr, int Dc)[] Dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)];

    public static int[] BuildOccupancy(Level level)
    {
        var occ = new int[level.N * level.N];
        Array.Fill(occ, -1);
        foreach (var a in level.Arrows)
            foreach (var c in a.Cells) occ[c] = a.Id;
        return occ;
    }

    /// <summary>A seta sai se o raio a partir da cabeça estiver livre até a borda</summary>
    public static ExitResult CheckExit(int n, int[] occ, Arrow a)
    {
        var (dr, dc) = Dirs[a.Dir];
        int r = a.Head / n, c = a.Head % n, steps = 0;
        while (true)
        {
            r += dr;
            c += dc;
            steps++;
            if (r < 0 || c < 0 || r >= n || c >= n) return new ExitResult(true, steps, -1);
            int o = occ[r * n + c];
            if (o >= 0 && o != a.Id) return new ExitResult(false, steps, o);
        }
    }

    public static SolveResult Solve(Level level)
    {
        var occ = BuildOccupancy(level);
        var alive = new HashSet<int>(level.Arrows.Select(a => a.Id));
        var order = new List<int>();
        int depth = 0, freeAtStart = -1;
        while (alive.Count > 0)
        {
            var free = level.Arrows.Where(a => alive.Contains(a.Id) && CheckExit(level.N, occ, a).Ok).ToList();
            if (freeAtStart < 0) freeAtStart = free.Count;
            if (free.Count == 0) return new SolveResult(false, depth, freeAtStart, order);
            depth++;
            foreach (var a in free)
            {
                alive.Remove(a.Id);
                order.Add(a.Id);
                foreach (var c in a.Cells) occ[c] = -1;
            }
        }
        return new SolveResult(true, depth, Math.Max(0, freeAtStart), order);
    }
}
