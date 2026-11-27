using System.Security.Cryptography;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Setas.Api.Data;
using Setas.Api.Endpoints;
using Setas.Api.Engine;
using Setas.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------- porta (o Railway define PORT) ----------
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port)) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// ---------- banco ----------
var dbUrl = config["DATABASE_URL"] ?? config.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(dbUrl))
{
    // em produção (Railway) não adianta tentar o localhost: avisa logo o que falta
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Defina a variável DATABASE_URL (no Railway: ${{Postgres.DATABASE_URL}}).");
    dbUrl = "Host=localhost;Port=5432;Database=setas;Username=postgres;Password=postgres";
}
builder.Services.AddDbContext<AppDb>(o => o.UseNpgsql(AppDb.ToNpgsql(dbUrl)));

// ---------- autenticação JWT ----------
var jwtSecret = config["JWT_SECRET"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    if (!builder.Environment.IsDevelopment())
        throw new InvalidOperationException("Defina a variável JWT_SECRET com pelo menos 32 caracteres.");
    jwtSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    Console.WriteLine("AVISO: JWT_SECRET não definido; usando uma chave temporária (só em desenvolvimento).");
}
var signingKey = TokenService.KeyFrom(jwtSecret);
builder.Services.AddSingleton(new TokenService(signingKey));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = TokenService.Issuer,
        ValidateAudience = true,
        ValidAudience = TokenService.Issuer,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = signingKey,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(2),
    };
});
builder.Services.AddAuthorization();

// ---------- CORS: app Android (https://localhost), app iOS (capacitor://localhost), dev ----------
var origins = new List<string> { "capacitor://localhost", "https://localhost", "http://localhost", "http://localhost:5173", "ionic://localhost" };
origins.AddRange((config["CORS_ORIGINS"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod()));

// ---------- limite de requisições por IP ----------
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    o.AddPolicy("api", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "?",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1) }));
});

// atrás do proxy do Railway: pega o IP real do cliente
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

builder.Services.AddSingleton<LevelCatalog>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// o próprio jogo (build do Vite) e as páginas de privacidade/exclusão ficam em wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAccount();
app.MapGame();

// cria as tabelas na primeira execução (com novas tentativas enquanto o Postgres sobe)
await EnsureDatabase(app);

app.Run();

static async Task EnsureDatabase(WebApplication app)
{
    for (int attempt = 1; ; attempt++)
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.Database.EnsureCreatedAsync();
            return;
        }
        catch (Exception ex) when (attempt < 10)
        {
            Console.WriteLine($"Banco indisponível (tentativa {attempt}): {ex.Message}");
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

public partial class Program { }
