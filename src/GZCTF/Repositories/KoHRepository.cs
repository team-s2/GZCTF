using GZCTF.Models.Request.Game;
using GZCTF.Repositories.Interface;
using GZCTF.Services.Cache;
using Microsoft.EntityFrameworkCore;

namespace GZCTF.Repositories;

public class KoHRepository(
    CacheHelper cacheHelper,
    ILogger<KoHRepository> logger,
    AppDbContext context) : RepositoryBase(context), IKoHRepository
{
    // Results only change once per tick, so a short TTL replaces explicit cache invalidation
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(10);

    private const int MaxTimelinePoints = 200;

    public Task<bool> HasHills(int gameId, CancellationToken token = default) =>
        Context.GameChallenges.AnyAsync(c => c.GameId == gameId && c.Type == ChallengeType.KingOfTheHill, token);

    public async Task<KoHTokenModel> GetToken(Game game, int participationId, CancellationToken token = default)
    {
        var latestRound = await Context.KoHRounds
            .Where(r => r.GameId == game.Id)
            .MaxAsync(r => (int?)r.Number, token) ?? 0;

        if (latestRound == 0)
            return new() { Round = 0, Status = "warmup" };

        var anchor = KoHScoring.AnchorRound(latestRound, game.KoHRefreshTicks);
        var value = await Context.KoHTokens
            .Where(t => t.ParticipationId == participationId && t.RoundNumber == anchor)
            .Select(t => t.Token)
            .FirstOrDefaultAsync(token);

        return new() { Round = anchor, Token = value, Status = value is null ? "no-token" : "ready" };
    }

    public async Task<List<KoHHillStateModel>> GetHills(int gameId, int participationId,
        CancellationToken token = default)
    {
        var hills = await Context.GameChallenges
            .IgnoreAutoIncludes()
            .Where(c => c.GameId == gameId && c.IsEnabled && c.Type == ChallengeType.KingOfTheHill)
            .OrderBy(c => c.Id)
            .Select(c => new { c.Id, c.Title })
            .ToListAsync(token);

        if (hills.Count == 0)
            return [];

        var latest = await LatestResults(gameId, token);
        var holderIds = latest.Values.Select(r => r.Holder).OfType<int>().Distinct().ToList();
        var teamNames = await Context.Participations
            .Where(p => holderIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Team.Name, token);

        var targets = await Context.KoHTargets
            .AsNoTracking()
            .Include(t => t.Container)
            .Where(t => t.GameId == gameId)
            .ToDictionaryAsync(t => t.ChallengeId, token);

        return hills.Select(hill =>
        {
            var result = latest.GetValueOrDefault(hill.Id);
            var target = targets.GetValueOrDefault(hill.Id);
            return new KoHHillStateModel
            {
                ChallengeId = hill.Id,
                Title = hill.Title,
                Round = result?.Round ?? 0,
                HolderTeamName = result?.Holder is { } holder ? teamNames.GetValueOrDefault(holder) : null,
                IsYou = result?.Holder == participationId,
                Status = result?.Status.ToString(),
                CheckedAt = result?.CheckedAt,
                Entry = target?.Container?.Entry,
                LastRefreshRound = target?.LastRefreshRound ?? 0
            };
        }).ToList();
    }

    public Task<KoHScoreboardModel> GetScoreboard(Game game, CancellationToken token = default) =>
        cacheHelper.GetOrCreateAsync(logger, CacheKey.KoHScoreboard(game.Id), entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheLifetime;
            return GenScoreboard(game, token);
        }, token: token);

    public Task<KoHTimelineModel> GetTimeline(Game game, CancellationToken token = default) =>
        cacheHelper.GetOrCreateAsync(logger, CacheKey.KoHTimeline(game.Id), entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheLifetime;
            return GenTimeline(game, token);
        }, token: token);

    public async Task<KoHAdminStateModel> GetAdminState(Game game, CancellationToken token = default)
    {
        var hills = await Context.GameChallenges
            .IgnoreAutoIncludes()
            .Where(c => c.GameId == game.Id && c.Type == ChallengeType.KingOfTheHill)
            .OrderBy(c => c.Category).ThenBy(c => c.Id)
            .Select(c => new { c.Id, c.Title, c.IsEnabled })
            .ToListAsync(token);

        var latest = await LatestResults(game.Id, token);
        var holderIds = latest.Values.Select(r => r.Holder).OfType<int>().Distinct().ToList();
        var teamNames = await Context.Participations
            .Where(p => holderIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Team.Name, token);

        var targets = await Context.KoHTargets
            .AsNoTracking()
            .Include(t => t.Container)
            .Where(t => t.GameId == game.Id)
            .ToDictionaryAsync(t => t.ChallengeId, token);

        var board = await GetScoreboard(game, token);

        return new()
        {
            LatestRound = board.LatestRound,
            RefreshTicks = board.RefreshTicks,
            TickSeconds = board.TickSeconds,
            HoldPointsPerTick = game.KoHHoldPointsPerTick,
            Teams = board.Teams,
            Hills = hills.Select(hill =>
            {
                var result = latest.GetValueOrDefault(hill.Id);
                var target = targets.GetValueOrDefault(hill.Id);
                return new KoHAdminHillModel
                {
                    ChallengeId = hill.Id,
                    Title = hill.Title,
                    IsEnabled = hill.IsEnabled,
                    ContainerIp = target?.Container?.IP,
                    ContainerPort = target?.Container?.Port,
                    LastCheckStatus = result?.Status.ToString(),
                    CurrentHolderTeamName = result?.Holder is { } holder ? teamNames.GetValueOrDefault(holder) : null,
                    LastRefreshRound = target?.LastRefreshRound ?? 0
                };
            }).ToList()
        };
    }

    private async Task<KoHScoreboardModel> GenScoreboard(Game game, CancellationToken token)
    {
        var latestRound = await Context.KoHRounds
            .Where(r => r.GameId == game.Id)
            .OrderByDescending(r => r.Number)
            .Select(r => new { r.Number, r.EndsAt })
            .FirstOrDefaultAsync(token);

        var hills = await EnabledHills(game.Id, token);
        var hillIds = hills.Select(h => h.Id).ToList();
        var teams = await AcceptedTeams(game.Id, token);

        var cells = (await Context.KoHControlResults
                .Where(r => r.GameId == game.Id && r.ControllingParticipationId != null
                                                && hillIds.Contains(r.ChallengeId)
                                                && r.CheckedAt <= game.EndTimeUtc)
                .GroupBy(r => new { Pid = r.ControllingParticipationId!.Value, r.ChallengeId })
                .Select(g => new
                {
                    g.Key.Pid,
                    g.Key.ChallengeId,
                    Earned = g.Sum(r => r.HoldCredit),
                    Penalty = g.Sum(r => r.Penalty),
                    Ticks = g.Count(),
                    Broken = g.Count(r => r.Penalty > 0)
                })
                .ToListAsync(token))
            .ToDictionary(c => (c.Pid, c.ChallengeId));

        var latest = await LatestResults(game.Id, token);
        var lastRefresh = await Context.KoHTargets
            .Where(t => t.GameId == game.Id)
            .ToDictionaryAsync(t => t.ChallengeId, t => t.LastRefreshRound, token);
        var teamNames = teams.ToDictionary(t => t.Id, t => t.Team.Name);

        var rows = teams.Select(team =>
            {
                var scores = hills.Select(hill =>
                {
                    var cell = cells.GetValueOrDefault((team.Id, hill.Id));
                    return new KoHHillScore
                    {
                        ChallengeId = hill.Id,
                        Points = (cell?.Earned ?? 0) - (cell?.Penalty ?? 0),
                        Earned = cell?.Earned ?? 0,
                        Penalty = cell?.Penalty ?? 0,
                        TicksHeld = cell?.Ticks ?? 0,
                        IsCurrentHolder = latest.GetValueOrDefault(hill.Id)?.Holder == team.Id,
                        BrokenTicks = cell?.Broken ?? 0
                    };
                }).ToList();

                return (team.Id, Row: new KoHTeamScoreRow
                {
                    TeamId = team.TeamId,
                    TeamName = team.Team.Name,
                    Division = team.Division?.Name,
                    Total = scores.Sum(s => s.Points),
                    Hills = scores,
                    Avatar = team.Team.AvatarUrl
                });
            })
            .OrderByDescending(r => r.Row.Total)
            .ThenBy(r => r.Id)
            .Select(r => r.Row)
            .ToList();

        for (var i = 0; i < rows.Count; i++)
            rows[i].Rank = i + 1;

        return new()
        {
            LatestRound = latestRound?.Number ?? 0,
            CurrentRoundEndsAt = latestRound?.EndsAt,
            RefreshTicks = Math.Max(1, game.KoHRefreshTicks),
            TickSeconds = game.KoHTickSeconds,
            Hills = hills.Select(hill =>
            {
                var result = latest.GetValueOrDefault(hill.Id);
                return new KoHScoreboardHill
                {
                    ChallengeId = hill.Id,
                    Title = hill.Title,
                    CurrentHolderTeamName = result?.Holder is { } holder
                        ? teamNames.GetValueOrDefault(holder)
                        : null,
                    LastCheckStatus = result?.Status.ToString(),
                    LastRefreshRound = lastRefresh.GetValueOrDefault(hill.Id),
                    Category = hill.Category
                };
            }).ToList(),
            Teams = rows
        };
    }

    private async Task<KoHTimelineModel> GenTimeline(Game game, CancellationToken token)
    {
        var rounds = await Context.KoHRounds
            .Where(r => r.GameId == game.Id && r.StartedAt <= game.EndTimeUtc)
            .OrderBy(r => r.Number)
            .Select(r => new { r.Id, r.Number, r.EndsAt })
            .ToListAsync(token);

        var result = new KoHTimelineModel();
        if (rounds.Count == 0)
            return result;

        var hillIds = (await EnabledHills(game.Id, token)).Select(h => h.Id).ToList();
        var teams = await AcceptedTeams(game.Id, token);

        var deltas = (await Context.KoHControlResults
                .Where(r => r.GameId == game.Id && r.ControllingParticipationId != null
                                                && hillIds.Contains(r.ChallengeId)
                                                && r.CheckedAt <= game.EndTimeUtc)
                .GroupBy(r => new { Pid = r.ControllingParticipationId!.Value, r.RoundId })
                .Select(g => new { g.Key.Pid, g.Key.RoundId, Delta = g.Sum(r => r.HoldCredit - r.Penalty) })
                .ToListAsync(token))
            .ToDictionary(d => (d.Pid, d.RoundId), d => d.Delta);

        var emitEvery = Math.Max(1, (int)Math.Ceiling(rounds.Count / (double)MaxTimelinePoints));

        foreach (var team in teams)
        {
            var timeline = new KoHTeamTimeline
            {
                TeamId = team.TeamId,
                TeamName = team.Team.Name,
                Division = team.Division?.Name
            };

            double score = 0;
            for (var i = 0; i < rounds.Count; i++)
            {
                score += deltas.GetValueOrDefault((team.Id, rounds[i].Id));
                if (i % emitEvery == 0 || i == rounds.Count - 1)
                    timeline.Items.Add(new() { Round = rounds[i].Number, Time = rounds[i].EndsAt, Score = score });
            }

            result.Teams.Add(timeline);
        }

        return result;
    }

    private Task<List<HillBrief>> EnabledHills(int gameId, CancellationToken token) =>
        Context.GameChallenges
            .IgnoreAutoIncludes()
            .Where(c => c.GameId == gameId && c.IsEnabled && c.Type == ChallengeType.KingOfTheHill)
            .OrderBy(c => c.Category).ThenBy(c => c.Id)
            .Select(c => new HillBrief(c.Id, c.Title, c.Category))
            .ToListAsync(token);

    private Task<List<Participation>> AcceptedTeams(int gameId, CancellationToken token) =>
        Context.Participations
            .AsNoTracking()
            .IgnoreAutoIncludes()
            .Include(p => p.Team)
            .Include(p => p.Division)
            .Where(p => p.GameId == gameId && p.Status == ParticipationStatus.Accepted)
            .ToListAsync(token);

    private async Task<Dictionary<int, LatestResult>> LatestResults(int gameId, CancellationToken token)
    {
        var rows = await Context.KoHControlResults
            .Where(r => r.GameId == gameId && !Context.KoHControlResults.Any(newer =>
                newer.ChallengeId == r.ChallengeId && newer.RoundId > r.RoundId))
            .Select(r => new LatestResult(r.ChallengeId, r.Round.Number, r.ControllingParticipationId, r.Status,
                r.CheckedAt))
            .ToListAsync(token);

        return rows.ToDictionary(r => r.ChallengeId);
    }

    private sealed record HillBrief(int Id, string Title, ChallengeCategory Category);

    private sealed record LatestResult(
        int ChallengeId,
        int Round,
        int? Holder,
        KoHCheckStatus Status,
        DateTimeOffset CheckedAt);
}
