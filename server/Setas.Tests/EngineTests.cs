using System.Text.Json;
using Setas.Api.Engine;
using Xunit;

namespace Setas.Tests;

/// <summary>
/// Garante que a engine em C# gera EXATAMENTE as mesmas fases que o jogo.
/// vectors.json é gerado pelo TypeScript com `npm run vectors`.
/// </summary>
public class EngineParityTests
{
    private static readonly JsonElement V = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "vectors.json"))).RootElement;

    private static int[][] Strip(Level l) => l.Arrows.Select(a => new[] { a.Dir, a.Color }.Concat(a.Cells).ToArray()).ToArray();

    private static void AssertSameLevel(JsonElement expected, Level actual, string what)
    {
        Assert.Equal(expected.GetProperty("n").GetInt32(), actual.N);
        var exp = expected.GetProperty("arrows").EnumerateArray().Select(a => a.EnumerateArray().Select(x => x.GetInt32()).ToArray()).ToArray();
        var act = Strip(actual);
        Assert.True(exp.Length == act.Length, $"{what}: esperado {exp.Length} setas, gerou {act.Length}");
        for (int i = 0; i < exp.Length; i++) Assert.True(exp[i].SequenceEqual(act[i]), $"{what}: seta {i} diferente");
    }

    [Fact]
    public void Mulberry32_IgualAoJavaScript()
    {
        var r = V.GetProperty("rng");
        var rng = new Mulberry32(r.GetProperty("seed").GetDouble());
        foreach (var v in r.GetProperty("values").EnumerateArray()) Assert.Equal(v.GetDouble(), rng.Next());
    }

    [Fact]
    public void HashSeed_IgualAoJavaScript()
    {
        foreach (var h in V.GetProperty("hashes").EnumerateArray())
            Assert.Equal(h.GetProperty("hash").GetUInt32(), Js.HashSeed(h.GetProperty("text").GetString()!));
    }

    [Fact]
    public void Gerador_IgualAoJavaScript()
    {
        foreach (var g in V.GetProperty("generated").EnumerateArray())
        {
            var level = Generator.Generate(Generator.ParamsFor(g.GetProperty("t").GetDouble(), g.GetProperty("seed").GetDouble()));
            AssertSameLevel(g.GetProperty("level"), level, $"t={g.GetProperty("t")} seed={g.GetProperty("seed")}");
        }
    }

    [Fact]
    public void FasesInfinitas_IguaisAoJavaScript()
    {
        int curated = V.GetProperty("curatedCount").GetInt32();
        foreach (var g in V.GetProperty("infinite").EnumerateArray())
        {
            int index = g.GetProperty("index").GetInt32();
            AssertSameLevel(g.GetProperty("level"), Generator.GenerateInfinite(index, curated), $"fase {index + 1}");
        }
    }

    [Fact]
    public void DesafioDoDia_IgualAoJavaScript()
    {
        foreach (var g in V.GetProperty("daily").EnumerateArray())
            AssertSameLevel(g.GetProperty("level"), Generator.Daily(g.GetProperty("date").GetString()!), g.GetProperty("date").GetString()!);
    }

    [Fact]
    public void Solver_IgualAoJavaScript()
    {
        foreach (var s in V.GetProperty("solve").EnumerateArray())
        {
            var level = Generator.Generate(Generator.ParamsFor(0.7, s.GetProperty("seed").GetDouble()));
            var expected = s.GetProperty("order").EnumerateArray().Select(x => x.GetInt32()).ToArray();
            Assert.Equal(expected, Rules.Solve(level).Order);
        }
    }

    /// <summary>
    /// Mecânicas especiais: refaz as partidas gravadas pelo TypeScript (solução e partida com erros)
    /// e confere o resultado de cada toque e o resultado final do replay.
    /// </summary>
    [Fact]
    public void Mecanicas_IguaisAoJavaScript()
    {
        var catalog = new LevelCatalog();
        int checkedRuns = 0;
        foreach (var run in V.GetProperty("mechanics").EnumerateArray())
        {
            int index = run.GetProperty("index").GetInt32();
            var level = catalog.Get(index);
            Assert.True(level.Mechanics is { Count: > 0 }, $"fase {index + 1} deveria ter mecânica");
            var moves = run.GetProperty("moves").EnumerateArray().Select(x => x.GetInt32()).ToArray();
            var steps = run.GetProperty("steps").EnumerateArray().ToArray();
            var state = new GameState(level);
            var sent = new List<int>();
            for (int i = 0; i < moves.Length; i++)
            {
                var r = state.Tap(moves[i]);
                string kind = steps[i][0].GetString()!;
                Assert.True(kind == r.Kind.ToString().ToLowerInvariant(), $"fase {index + 1}, toque {i}: esperado {kind}, deu {r.Kind}");
                Assert.True(steps[i][1].GetInt32() == r.LivesLost, $"fase {index + 1}, toque {i}: vidas perdidas diferentes");
                if (r.Kind != TapKind.Locked) sent.Add(moves[i]);
            }
            var result = Replay.Run(level, sent);
            Assert.Equal(run.GetProperty("valid").GetBoolean(), result.Valid);
            if (result.Valid) Assert.Equal(run.GetProperty("mistakes").GetInt32(), result.Mistakes);
            checkedRuns++;
        }
        Assert.True(checkedRuns >= 30);
    }

    [Fact]
    public void FasesCuradas_CarregamETemSolucao()
    {
        var catalog = new LevelCatalog();
        Assert.Equal(300, catalog.CuratedCount);
        for (int i = 0; i < catalog.CuratedCount; i++) Assert.True(Rules.Solve(catalog.Get(i)).Solvable, $"fase {i + 1}");
    }
}

public class ReplayTests
{
    private static readonly LevelCatalog Catalog = new();

    [Fact]
    public void PartidaPerfeita_Da3Estrelas()
    {
        var level = Catalog.Get(10);
        var r = Replay.Run(level, Rules.Solve(level).Order.ToArray());
        Assert.True(r.Valid);
        Assert.Equal(3, r.Stars);
        Assert.Equal(0, r.Mistakes);
    }

    [Fact]
    public void BatidasContamComoErro()
    {
        var level = Catalog.Get(1);
        var order = Rules.Solve(level).Order.ToList();
        // toca primeiro numa seta que ainda está bloqueada
        var occ = Rules.BuildOccupancy(level);
        var blocked = level.Arrows.First(a => !Rules.CheckExit(level.N, occ, a).Ok);
        var moves = new List<int> { blocked.Id };
        moves.AddRange(order);
        var r = Replay.Run(level, moves);
        Assert.True(r.Valid);
        Assert.Equal(1, r.Mistakes);
        Assert.Equal(2, r.Stars);
    }

    [Fact]
    public void FaseIncompleta_ERejeitada()
    {
        var level = Catalog.Get(5);
        var order = Rules.Solve(level).Order;
        Assert.False(Replay.Run(level, order.Take(order.Count - 1).ToArray()).Valid);
    }

    [Fact]
    public void SetaRepetida_ERejeitada()
    {
        var level = Catalog.Get(5);
        var order = Rules.Solve(level).Order.ToList();
        order.Insert(1, order[0]);
        Assert.False(Replay.Run(level, order).Valid);
    }

    [Fact]
    public void FaseInfinita_PodeSerConferida()
    {
        var level = Catalog.Get(450);
        Assert.True(Replay.Run(level, Rules.Solve(level).Order.ToArray()).Valid);
    }

    [Fact]
    public void DatabaseUrlDoRailway_ViraConnectionString()
    {
        var cs = Setas.Api.Data.AppDb.ToNpgsql("postgresql://postgres:s3nh%40@postgres.railway.internal:5432/railway");
        Assert.Contains("Host=postgres.railway.internal", cs);
        Assert.Contains("Database=railway", cs);
        Assert.Contains("Password=s3nh@", cs);
    }
}
