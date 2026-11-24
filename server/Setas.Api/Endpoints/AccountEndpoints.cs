using System.Net.Mail;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Setas.Api.Data;
using Setas.Api.Services;

namespace Setas.Api.Endpoints;

public sealed record RegisterRequest(string Email, string Password, string Nickname);
public sealed record LoginRequest(string Email, string Password);
public sealed record AuthResponse(string Token, MeResponse Me);
public sealed record MeResponse(Guid Id, string Email, string Nickname, int MaxLevel, int TotalStars, int[] Stars, JsonElement State);

public static partial class AccountEndpoints
{
    private static readonly PasswordHasher<User> Hasher = new();

    [GeneratedRegex("^[\\p{L}\\p{N}_\\.\\- ]{3,20}$")]
    private static partial Regex NicknameRegex();

    public static void MapAccount(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").RequireRateLimiting("auth");

        auth.MapPost("/register", async (RegisterRequest req, AppDb db, TokenService tokens) =>
        {
            var email = (req.Email ?? "").Trim();
            var nickname = (req.Nickname ?? "").Trim();
            if (!IsEmail(email)) return Problem("E-mail inválido.");
            if ((req.Password ?? "").Length < 6) return Problem("A senha precisa ter pelo menos 6 caracteres.");
            if (!NicknameRegex().IsMatch(nickname)) return Problem("O apelido precisa ter de 3 a 20 letras, números, espaço, _ . ou -.");

            var emailNorm = email.ToLowerInvariant();
            var nickNorm = nickname.ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.EmailNormalized == emailNorm)) return Problem("Já existe uma conta com esse e-mail.", 409);
            if (await db.Users.AnyAsync(u => u.NicknameNormalized == nickNorm)) return Problem("Esse apelido já está em uso.", 409);

            var user = new User { Email = email, EmailNormalized = emailNorm, Nickname = nickname, NicknameNormalized = nickNorm };
            user.PasswordHash = Hasher.HashPassword(user, req.Password!);
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return Results.Ok(new AuthResponse(tokens.Create(user), await Me(db, user)));
        });

        auth.MapPost("/login", async (LoginRequest req, AppDb db, TokenService tokens) =>
        {
            var user = await FindByCredentials(db, req.Email, req.Password);
            if (user is null) return Problem("E-mail ou senha incorretos.", 401);
            return Results.Ok(new AuthResponse(tokens.Create(user), await Me(db, user)));
        });

        var me = app.MapGroup("/api/me").RequireAuthorization().RequireRateLimiting("api");

        me.MapGet("", async (ClaimsPrincipal principal, AppDb db) =>
        {
            var user = await Current(db, principal);
            return user is null ? Results.Unauthorized() : Results.Ok(await Me(db, user));
        });

        // dados não competitivos (moedas, skins, configurações): o app é quem manda
        me.MapPut("/state", async (ClaimsPrincipal principal, AppDb db, [FromBody] JsonElement state) =>
        {
            var user = await Current(db, principal);
            if (user is null) return Results.Unauthorized();
            var raw = state.GetRawText();
            if (state.ValueKind != JsonValueKind.Object || raw.Length > 16_000) return Problem("Estado inválido.");
            user.StateJson = raw;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // exclusão de conta dentro do app (exigida pela App Store e pelo Google Play)
        me.MapDelete("", async (ClaimsPrincipal principal, AppDb db) =>
        {
            var user = await Current(db, principal);
            if (user is null) return Results.Unauthorized();
            await DeleteUser(db, user);
            return Results.NoContent();
        });

        // exclusão pela página web /excluir-conta.html (o Google Play exige um link na web)
        app.MapPost("/api/account/delete", async (LoginRequest req, AppDb db) =>
        {
            var user = await FindByCredentials(db, req.Email, req.Password);
            if (user is null) return Problem("E-mail ou senha incorretos.", 401);
            await DeleteUser(db, user);
            return Results.NoContent();
        }).RequireRateLimiting("auth");
    }

    internal static IResult Problem(string message, int status = 400) =>
        Results.Json(new { error = message }, statusCode: status);

    private static bool IsEmail(string email)
    {
        if (email.Length is < 5 or > 200) return false;
        try { return new MailAddress(email).Address == email; }
        catch { return false; }
    }

    private static async Task<User?> FindByCredentials(AppDb db, string? email, string? password)
    {
        var norm = (email ?? "").Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.EmailNormalized == norm);
        if (user is null || string.IsNullOrEmpty(password)) return null;
        var result = Hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed) return null;
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = Hasher.HashPassword(user, password);
            await db.SaveChangesAsync();
        }
        return user;
    }

    internal static async Task<User?> Current(AppDb db, ClaimsPrincipal principal)
    {
        var id = TokenService.UserId(principal);
        return id is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == id);
    }

    internal static async Task<MeResponse> Me(AppDb db, User user)
    {
        var results = await db.LevelResults.Where(r => r.UserId == user.Id)
            .Select(r => new { r.LevelIndex, r.Stars }).ToListAsync();
        var stars = new int[user.MaxLevel];
        foreach (var r in results) if (r.LevelIndex < stars.Length) stars[r.LevelIndex] = r.Stars;
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(user.StateJson) ? "{}" : user.StateJson);
        return new MeResponse(user.Id, user.Email, user.Nickname, user.MaxLevel, user.TotalStars, stars, doc.RootElement.Clone());
    }

    private static async Task DeleteUser(AppDb db, User user)
    {
        await db.LevelResults.Where(r => r.UserId == user.Id).ExecuteDeleteAsync();
        await db.DailyResults.Where(r => r.UserId == user.Id).ExecuteDeleteAsync();
        db.Users.Remove(user);
        await db.SaveChangesAsync();
    }
}
