using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Setas.Api.Data;
using Setas.Api.Engine;

namespace Setas.Api.Endpoints;

public sealed record RunRequest(int Level, int[] Moves);
public sealed record RunResponse(bool Ok, int Stars, int MaxLevel, int TotalStars);
public sealed record DailyRequest(string Date, int[] Moves);
public sealed record DailyResponse(bool Ok, int Mistakes, int Moves, int Rank);
public sealed record RankEntry(int Rank, string Nickname, int Level, int Stars);
public sealed record DailyEntry(int Rank, string Nickname, int Mistakes, int Moves);
public sealed record LeaderboardResponse(IReadOnlyList<RankEntry> Top, RankEntry? Me, int Players);
public sealed record DailyLeaderboardResponse(string Date, IReadOnlyList<DailyEntry> Top, DailyEntry? Me, int Players);

public static class GameEndpoints
{
    public static void MapGame(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireRateLimiting("api");

        // ---------- fase concluída ----------
        api.MapPost("/runs", async (RunRequest req, ClaimsPrincipal principal, AppDb db, LevelCatalog levels) =>
        {
            var user = await AccountEndpoints.Current(db, principal);
            if (user is null) return Results.Unauthorized();
            if (req.Moves is null || req.Level < 0) return AccountEndpoints.Problem("Partida inválida.");
            // precisa jogar em ordem: não dá para pular para uma fase ainda bloqueada
            if (req.Level > user.MaxLevel) return AccountEndpoints.Problem("Fase ainda bloqueada para esta conta.", 409);

            var result = Replay.Run(levels.Get(req.Level), req.Moves);
            if (!result.Valid) return AccountEndpoints.Problem(result.Error!, 422);

            var existing = await db.LevelResults.FindAsync(user.Id, req.Level);
            if (existing is null)
            {
                db.LevelResults.Add(new LevelResult { UserId = user.Id, LevelIndex = req.Level, Stars = result.Stars, Moves = result.Moves });
                user.TotalStars += result.Stars;
            }
            else if (result.Stars > existing.Stars)
            {
                user.TotalStars += result.Stars - existing.Stars;
                existing.Stars = result.Stars;
                existing.Moves = result.Moves;
                existing.CompletedAt = DateTime.UtcNow;
            }
            if (req.Level == user.MaxLevel)
            {
                user.MaxLevel++;
                user.MaxLevelAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            return Results.Ok(new RunResponse(true, result.Stars, user.MaxLevel, user.TotalStars));
        }).RequireAuthorization();

        // ---------- desafio do dia ----------
        api.MapPost("/daily", async (DailyRequest req, ClaimsPrincipal principal, AppDb db, LevelCatalog levels) =>
        {
            var user = await AccountEndpoints.Current(db, principal);
            if (user is null) return Results.Unauthorized();
            if (!DateOnly.TryParseExact(req.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                return AccountEndpoints.Problem("Data inválida.");
            // a data é a do aparelho; aceita ontem/hoje/amanhã em UTC por causa dos fusos
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (Math.Abs(date.DayNumber - today.DayNumber) > 1) return AccountEndpoints.Problem("Desafio fora do prazo.", 409);

            var result = Replay.Run(levels.Daily(req.Date), req.Moves ?? Array.Empty<int>());
            if (!result.Valid) return AccountEndpoints.Problem(result.Error!, 422);

            var existing = await db.DailyResults.FindAsync(user.Id, date);
            if (existing is null)
                db.DailyResults.Add(new DailyResult { UserId = user.Id, Date = date, Mistakes = result.Mistakes, Moves = result.Moves });
            else if (result.Mistakes < existing.Mistakes || (result.Mistakes == existing.Mistakes && result.Moves < existing.Moves))
            {
                existing.Mistakes = result.Mistakes;
                existing.Moves = result.Moves;
                existing.CompletedAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            var mine = existing ?? await db.DailyResults.FirstAsync(r => r.UserId == user.Id && r.Date == date);
            int rank = await DailyBetter(db, date, mine).CountAsync() + 1;
            return Results.Ok(new DailyResponse(true, mine.Mistakes, mine.Moves, rank));
        }).RequireAuthorization();

        // ---------- ranking geral: quem chegou mais longe ----------
        api.MapGet("/leaderboard", async (ClaimsPrincipal principal, AppDb db, int? limit) =>
        {
            int take = Math.Clamp(limit ?? 50, 1, 100);
            var rows = await db.Users
                .Where(u => u.MaxLevel > 0)
                .OrderByDescending(u => u.MaxLevel).ThenByDescending(u => u.TotalStars).ThenBy(u => u.MaxLevelAt)
                .Take(take)
                .Select(u => new { u.Nickname, u.MaxLevel, u.TotalStars })
                .ToListAsync();
            var top = rows.Select((u, i) => new RankEntry(i + 1, u.Nickname, u.MaxLevel, u.TotalStars)).ToList();
            int players = await db.Users.CountAsync(u => u.MaxLevel > 0);

            RankEntry? me = null;
            var user = await AccountEndpoints.Current(db, principal);
            if (user is not null && user.MaxLevel > 0)
            {
                int better = await db.Users.CountAsync(u =>
                    u.MaxLevel > user.MaxLevel ||
                    (u.MaxLevel == user.MaxLevel && u.TotalStars > user.TotalStars) ||
                    (u.MaxLevel == user.MaxLevel && u.TotalStars == user.TotalStars && u.MaxLevelAt < user.MaxLevelAt));
                me = new RankEntry(better + 1, user.Nickname, user.MaxLevel, user.TotalStars);
            }
            return Results.Ok(new LeaderboardResponse(top, me, players));
        });

        // ---------- ranking do desafio do dia ----------
        api.MapGet("/leaderboard/daily", async (ClaimsPrincipal principal, AppDb db, string? date, int? limit) =>
        {
            var day = DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? d : DateOnly.FromDateTime(DateTime.UtcNow);
            int take = Math.Clamp(limit ?? 50, 1, 100);
            var rows = await (from r in db.DailyResults
                              join u in db.Users on r.UserId equals u.Id
                              where r.Date == day
                              orderby r.Mistakes, r.Moves, r.CompletedAt
                              select new { u.Nickname, r.Mistakes, r.Moves })
                .Take(take).ToListAsync();
            var top = rows.Select((r, i) => new DailyEntry(i + 1, r.Nickname, r.Mistakes, r.Moves)).ToList();
            int players = await db.DailyResults.CountAsync(r => r.Date == day);

            DailyEntry? me = null;
            var user = await AccountEndpoints.Current(db, principal);
            if (user is not null)
            {
                var mine = await db.DailyResults.FirstOrDefaultAsync(r => r.UserId == user.Id && r.Date == day);
                if (mine is not null)
                    me = new DailyEntry(await DailyBetter(db, day, mine).CountAsync() + 1, user.Nickname, mine.Mistakes, mine.Moves);
            }
            return Results.Ok(new DailyLeaderboardResponse(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), top, me, players));
        });
    }

    private static IQueryable<DailyResult> DailyBetter(AppDb db, DateOnly date, DailyResult mine) =>
        db.DailyResults.Where(r => r.Date == date && (
            r.Mistakes < mine.Mistakes ||
            (r.Mistakes == mine.Mistakes && r.Moves < mine.Moves) ||
            (r.Mistakes == mine.Mistakes && r.Moves == mine.Moves && r.CompletedAt < mine.CompletedAt)));
}
