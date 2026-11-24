using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Setas.Api.Data;

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string EmailNormalized { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string NicknameNormalized { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Próxima fase a jogar (índice). Só sobe com partidas conferidas pelo servidor.</summary>
    public int MaxLevel { get; set; }
    public int TotalStars { get; set; }
    /// <summary>Quando alcançou o MaxLevel atual (desempate do ranking: quem chegou antes)</summary>
    public DateTime MaxLevelAt { get; set; } = DateTime.UtcNow;

    /// <summary>Dados não competitivos do app (moedas, skins, configurações) em JSON</summary>
    public string StateJson { get; set; } = "{}";
}

public sealed class LevelResult
{
    public Guid UserId { get; set; }
    public int LevelIndex { get; set; }
    public int Stars { get; set; }
    public int Moves { get; set; }
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
}

public sealed class DailyResult
{
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public int Mistakes { get; set; }
    public int Moves { get; set; }
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;
}

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<LevelResult> LevelResults => Set<LevelResult>();
    public DbSet<DailyResult> DailyResults => Set<DailyResult>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.EmailNormalized).HasMaxLength(200);
            e.Property(x => x.Nickname).HasMaxLength(20);
            e.Property(x => x.NicknameNormalized).HasMaxLength(20);
            e.Property(x => x.StateJson).HasColumnType("jsonb");
            e.HasIndex(x => x.EmailNormalized).IsUnique();
            e.HasIndex(x => x.NicknameNormalized).IsUnique();
            e.HasIndex(x => new { x.MaxLevel, x.TotalStars, x.MaxLevelAt });
        });
        b.Entity<LevelResult>(e =>
        {
            e.ToTable("level_results");
            e.HasKey(x => new { x.UserId, x.LevelIndex });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<DailyResult>(e =>
        {
            e.ToTable("daily_results");
            e.HasKey(x => new { x.UserId, x.Date });
            e.HasIndex(x => new { x.Date, x.Mistakes, x.Moves, x.CompletedAt });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    /// <summary>
    /// Aceita a DATABASE_URL do Railway (postgresql://usuario:senha@host:porta/banco)
    /// ou uma connection string normal do Npgsql.
    /// </summary>
    public static string ToNpgsql(string urlOrConnString)
    {
        if (!urlOrConnString.StartsWith("postgres", StringComparison.OrdinalIgnoreCase) || !urlOrConnString.Contains("://"))
            return urlOrConnString;
        var uri = new Uri(urlOrConnString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var csb = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
            Database = uri.AbsolutePath.TrimStart('/'),
        };
        // rede interna do Railway não usa SSL; conexões públicas usam
        if (!uri.Host.EndsWith(".railway.internal", StringComparison.OrdinalIgnoreCase) && uri.Host != "localhost")
            csb.SslMode = SslMode.Prefer;
        return csb.ConnectionString;
    }
}
