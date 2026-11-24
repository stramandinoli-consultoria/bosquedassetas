using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;

namespace Setas.Api.Engine;

/// <summary>
/// Fonte das fases: as curadas vêm do levels.json embutido na DLL;
/// a partir daí são geradas (fases infinitas), com cache.
/// </summary>
public sealed class LevelCatalog
{
    private readonly List<Level> _curated;
    private readonly ConcurrentDictionary<int, Level> _generated = new();
    private readonly ConcurrentDictionary<string, Level> _daily = new();

    public LevelCatalog() : this(LoadEmbedded()) { }

    public LevelCatalog(List<Level> curated) => _curated = curated;

    public int CuratedCount => _curated.Count;

    public Level Get(int index)
    {
        if (index < _curated.Count) return _curated[index];
        if (_generated.Count > 2000) _generated.Clear();
        return _generated.GetOrAdd(index, i => Generator.GenerateInfinite(i, _curated.Count));
    }

    public Level Daily(string date)
    {
        if (_daily.Count > 30) _daily.Clear();
        return _daily.GetOrAdd(date, Generator.Daily);
    }

    /// <summary>Lê o formato compacto: [n, dificuldade, [[dir, cor, ...células]]]</summary>
    public static List<Level> Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var list = new List<Level>();
        foreach (var lvl in doc.RootElement.EnumerateArray())
        {
            int n = lvl[0].GetInt32();
            var arrows = new List<Arrow>();
            int id = 0;
            foreach (var a in lvl[2].EnumerateArray())
            {
                var nums = a.EnumerateArray().Select(x => x.GetInt32()).ToArray();
                arrows.Add(new Arrow(id++, nums[2..], nums[0], nums[1]));
            }
            list.Add(new Level(n, arrows));
        }
        return list;
    }

    private static List<Level> LoadEmbedded()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("levels.json")
            ?? throw new InvalidOperationException("levels.json não encontrado como recurso embutido");
        using var reader = new StreamReader(stream);
        return Parse(reader.ReadToEnd());
    }
}
