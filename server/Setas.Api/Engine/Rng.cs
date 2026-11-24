namespace Setas.Api.Engine;

/// <summary>
/// Porte EXATO do gerador mulberry32 do jogo (src/engine/rng.ts).
/// Toda aritmética imita o JavaScript: inteiros de 32 bits com overflow
/// (Math.imul, |0) e deslocamento sem sinal (>>>).
/// </summary>
public sealed class Mulberry32
{
    private int _a;

    public Mulberry32(double seed) => _a = Js.ToInt32(seed);

    public double Next()
    {
        unchecked
        {
            _a += 0x6d2b79f5;
            int t = Js.Imul(_a ^ Js.Ushr(_a, 15), 1 | _a);
            t = (t + Js.Imul(t ^ Js.Ushr(t, 7), 61 | t)) ^ t;
            return (uint)(t ^ Js.Ushr(t, 14)) / 4294967296.0;
        }
    }

    /// <summary>Equivalente a Math.floor(rng() * max)</summary>
    public int NextInt(int max) => (int)Math.Floor(Next() * max);
}

/// <summary>Funções que reproduzem o comportamento numérico do JavaScript</summary>
public static class Js
{
    public static int Imul(int a, int b) => unchecked(a * b);

    public static int Ushr(int v, int bits) => (int)((uint)v >> bits);

    /// <summary>ToInt32 do JavaScript (o que acontece em "x | 0")</summary>
    public static int ToInt32(double v)
    {
        if (double.IsNaN(v) || double.IsInfinity(v)) return 0;
        double m = Math.Truncate(v) % 4294967296.0;
        if (m < 0) m += 4294967296.0;
        return unchecked((int)(uint)m);
    }

    /// <summary>Math.round do JavaScript (meio arredonda para cima, diferente do Math.Round do .NET)</summary>
    public static double Round(double v) => Math.Floor(v + 0.5);

    /// <summary>hashSeed do jogo (FNV-1a de 32 bits sobre unidades UTF-16)</summary>
    public static uint HashSeed(string text)
    {
        uint h = 2166136261;
        foreach (char ch in text)
        {
            h ^= ch;
            h = unchecked(h * 16777619);
        }
        return h;
    }
}
