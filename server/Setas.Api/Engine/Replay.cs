namespace Setas.Api.Engine;

public sealed record ReplayResult(bool Valid, string? Error, int Stars, int Mistakes, int Moves)
{
    public static ReplayResult Fail(string error) => new(false, error, 0, 0, 0);
}

/// <summary>
/// Anti-trapaça: o app envia a sequência de setas tocadas (inclusive as que
/// bateram) e o servidor refaz a partida inteira com as mesmas regras.
/// Só conta se todas as setas saíram.
/// </summary>
public static class Replay
{
    public const int Lives = 3;

    public static ReplayResult Run(Level level, IReadOnlyList<int> moves)
    {
        int count = level.Arrows.Count;
        if (moves.Count < count) return ReplayResult.Fail("Jogadas insuficientes para concluir a fase.");
        if (moves.Count > count * 4 + 50) return ReplayResult.Fail("Jogadas demais.");

        var occ = Rules.BuildOccupancy(level);
        var alive = new bool[count];
        Array.Fill(alive, true);
        int removed = 0, mistakes = 0;

        foreach (int id in moves)
        {
            if (id < 0 || id >= count || !alive[id]) return ReplayResult.Fail("Jogada inválida.");
            var a = level.Arrows[id];
            if (Rules.CheckExit(level.N, occ, a).Ok)
            {
                alive[id] = false;
                foreach (var c in a.Cells) occ[c] = -1;
                removed++;
            }
            else
            {
                mistakes++;
            }
        }

        if (removed != count) return ReplayResult.Fail("A fase não foi concluída.");
        // mesma regra do jogo: estrelas = vidas restantes (mínimo 1, por causa do "continuar")
        int stars = Math.Max(1, Lives - mistakes);
        return new ReplayResult(true, null, stars, mistakes, moves.Count);
    }
}
