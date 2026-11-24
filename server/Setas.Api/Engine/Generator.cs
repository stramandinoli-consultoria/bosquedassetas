namespace Setas.Api.Engine;

public readonly record struct GenerateOptions(int N, int MaxLen, double Density, double Seed);

/// <summary>
/// Porte EXATO de src/engine/generator.ts e src/engine/levels.ts.
/// A ordem de cada chamada ao gerador aleatório precisa ser idêntica à do
/// TypeScript; os testes em Setas.Tests comparam com fases geradas pelo jogo.
/// </summary>
public static class Generator
{
    public static Level Generate(GenerateOptions o)
    {
        int n = o.N;
        var rng = new Mulberry32(o.Seed);
        var occ = new int[n * n];
        Array.Fill(occ, -1);
        var rayCover = new int[n * n];
        var arrows = new List<Arrow>();
        bool Inb(int r, int c) => r >= 0 && c >= 0 && r < n && c < n;
        int target = (int)Math.Floor(n * n * o.Density);
        int filled = 0, fails = 0;

        while (filled < target && fails < 900)
        {
            var empties = new List<int>();
            for (int i = 0; i < n * n; i++) if (occ[i] < 0) empties.Add(i);
            if (empties.Count == 0) break;
            int h = empties[rng.NextInt(empties.Count)];
            int hr = h / n, hc = h % n;

            int dir = -1;
            HashSet<int>? ray = null;
            foreach (var d in Shuffle([0, 1, 2, 3], rng))
            {
                int r = hr + Rules.Dirs[d].Dr, c = hc + Rules.Dirs[d].Dc;
                bool ok = true;
                var rs = new HashSet<int>();
                while (Inb(r, c))
                {
                    if (occ[r * n + c] >= 0) { ok = false; break; }
                    rs.Add(r * n + c);
                    r += Rules.Dirs[d].Dr;
                    c += Rules.Dirs[d].Dc;
                }
                if (ok) { dir = d; ray = rs; break; }
            }
            if (dir < 0 || ray is null) { fails++; continue; }

            int want = 2 + rng.NextInt(o.MaxLen - 1);
            var body = new List<int> { h };
            var inBody = new HashSet<int> { h };
            (int R, int C) cur = (hr, hc);
            while (body.Count < want)
            {
                var opts = new List<(int R, int C)>();
                foreach (var (dr, dc) in Rules.Dirs)
                {
                    int r = cur.R + dr, c = cur.C + dc;
                    if (Inb(r, c) && occ[r * n + c] < 0 && !inBody.Contains(r * n + c) && !ray.Contains(r * n + c))
                        opts.Add((r, c));
                }
                if (opts.Count == 0) break;

                (int R, int C)? next = null;
                if (body.Count == 1)
                {
                    int br = hr - Rules.Dirs[dir].Dr, bc = hc - Rules.Dirs[dir].Dc;
                    int bi = opts.FindIndex(p => p.R == br && p.C == bc);
                    if (bi >= 0 && rng.Next() < 0.8) next = opts[bi];
                }
                if (next is null)
                {
                    var blocking = opts.Where(p => rayCover[p.R * n + p.C] > 0).ToList();
                    if (blocking.Count > 0 && rng.Next() < 0.55) next = blocking[rng.NextInt(blocking.Count)];
                }
                if (next is null && body.Count >= 2 && rng.Next() < 0.45)
                {
                    int p = body[^2];
                    int sr = 2 * cur.R - p / n, sc = 2 * cur.C - p % n;
                    int si = opts.FindIndex(q => q.R == sr && q.C == sc);
                    if (si >= 0) next = opts[si];
                }
                next ??= opts[rng.NextInt(opts.Count)];
                int id = next.Value.R * n + next.Value.C;
                body.Add(id);
                inBody.Add(id);
                cur = next.Value;
            }
            if (body.Count < 2) { fails++; continue; }

            int arrowId = arrows.Count;
            foreach (var c in body) occ[c] = arrowId;
            foreach (var c in ray) rayCover[c]++;
            int prevColor = arrows.Count > 0 ? arrows[^1].Color : -1;
            int color = prevColor < 0 ? rng.NextInt(8) : (prevColor + 1 + rng.NextInt(7)) % 8;
            body.Reverse();
            arrows.Add(new Arrow(arrowId, body.ToArray(), dir, color));
            filled += body.Count;
        }
        return new Level(n, arrows);
    }

    private static int[] Shuffle(int[] arr, Mulberry32 rng)
    {
        for (int i = arr.Length - 1; i > 0; i--)
        {
            int j = rng.NextInt(i + 1);
            (arr[i], arr[j]) = (arr[j], arr[i]);
        }
        return arr;
    }

    /// <summary>paramsFor do jogo (fases curadas e desafio do dia)</summary>
    public static GenerateOptions ParamsFor(double t, double seed)
    {
        int n = (int)Math.Min(12, 5 + Js.Round(t * 7));
        int maxLen = (int)Math.Min(10, 3 + Js.Round(t * 7));
        return new GenerateOptions(n, maxLen, 0.78 + t * 0.1, seed);
    }

    // ---------- fases infinitas (src/engine/levels.ts) ----------

    public static GenerateOptions InfiniteParams(int index, int curatedCount, int candidate)
    {
        int k = Math.Max(0, index - curatedCount);
        return new GenerateOptions(
            Math.Min(14, 12 + k / 100),
            Math.Min(9, 6 + k / 120),
            Math.Min(0.95, 0.88 + Math.Floor(k / 25.0) * 0.01),
            700001 + (double)index * 7919 + (double)candidate * 104729);
    }

    public static int InfiniteCandidates(int index, int curatedCount)
    {
        int k = Math.Max(0, index - curatedCount);
        return Math.Min(8, 2 + k / 50);
    }

    public static int Hardness(Level level)
    {
        var s = Rules.Solve(level);
        if (!s.Solvable) return -1;
        return s.Depth * 1000 + level.Arrows.Count * 10 + (level.Arrows.Count - s.FreeAtStart);
    }

    public static Level GenerateInfinite(int index, int curatedCount)
    {
        Level? best = null;
        int bestScore = -2;
        int count = InfiniteCandidates(index, curatedCount);
        for (int i = 0; i < count; i++)
        {
            var l = Generate(InfiniteParams(index, curatedCount, i));
            int sc = Hardness(l);
            if (sc > bestScore) { best = l; bestScore = sc; }
        }
        return best!;
    }

    /// <summary>Desafio do dia: data no formato AAAA-MM-DD</summary>
    public static Level Daily(string date) => Generate(ParamsFor(0.55, Js.HashSeed("daily-" + date)));
}
