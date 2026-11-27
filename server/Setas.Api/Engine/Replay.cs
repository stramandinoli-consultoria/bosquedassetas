namespace Setas.Api.Engine;

public sealed record ReplayResult(bool Valid, string? Error, int Stars, int Mistakes, int Moves)
{
    public static ReplayResult Fail(string error) => new(false, error, 0, 0, 0);
}

/// <summary>
/// Anti-trapaça: o app envia a sequência de setas tocadas (inclusive as que
/// bateram) e o servidor refaz a partida inteira com as mesmas regras,
/// incluindo as mecânicas especiais (GameState). Só conta se todas as setas saíram.
/// Mesmo algoritmo de src/engine/replay.ts.
/// </summary>
public static class Replay
{
    public const int Lives = 3;

    public static ReplayResult Run(Level level, IReadOnlyList<int> moves)
    {
        int count = level.Arrows.Count;
        // com cipós, um toque tira duas setas: pode haver menos jogadas que setas
        if (moves.Count < 1) return ReplayResult.Fail("Jogadas insuficientes para concluir a fase.");
        if (moves.Count > count * 4 + 50) return ReplayResult.Fail("Jogadas demais.");

        var state = new GameState(level);
        int mistakes = 0;
        foreach (int id in moves)
        {
            var r = state.Tap(id);
            // toque em seta travada (gelo) nunca é enviado pelo jogo
            if (r.Kind is TapKind.Ignored or TapKind.Locked) return ReplayResult.Fail("Jogada inválida.");
            mistakes += r.LivesLost;
        }

        if (!state.Cleared) return ReplayResult.Fail("A fase não foi concluída.");
        // mesma regra do jogo: estrelas = vidas restantes (mínimo 1, por causa do "continuar")
        int stars = Math.Max(1, Lives - mistakes);
        return new ReplayResult(true, null, stars, mistakes, moves.Count);
    }
}
