using System.Collections.Concurrent;
using System.Security.Cryptography;
using GZCTF.Models;
using GZCTF.Models.Data;
using GZCTF.Models.Internal;
using GZCTF.Services.Cache;
using GZCTF.Services.Container.Manager;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace GZCTF.Services.KoH;

/// <summary>
/// Runs King of the Hill games: advances rounds, mints control tokens, keeps the shared hills
/// alive, resets them every refresh window and scores them each tick.
///
/// Everything for one game happens sequentially in a single pass, in the order score, advance,
/// reconcile. A round is therefore always scored before its hill can be wiped.
/// </summary>
public sealed class KoHEngine(
    IServiceScopeFactory scopeFactory,
    IDistributedCache cache,
    ILogger<KoHEngine> logger) : BackgroundService
{
    private const int GraceSeconds = 3;
    private const double CheckWindowFraction = 0.5;
    private const int TokenRandomBytes = 24;

    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan ReconcileInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan LeaderLease = TimeSpan.FromMinutes(1);

    private readonly string _instanceId = Guid.NewGuid().ToString("N");
    private readonly ConcurrentDictionary<int, DateTimeOffset> _lastReconcile = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await TryLeadAsync(stoppingToken))
                    await RunPassAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogErrorMessage(e, "KoH engine pass failed, will retry");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>
    /// With several app instances only one may drive the games. The check is best effort, the
    /// unique indexes on rounds and results keep a rare overlap harmless.
    /// </summary>
    private async Task<bool> TryLeadAsync(CancellationToken token)
    {
        var leader = await cache.GetStringAsync(CacheKey.KoHEngineLock, token);
        if (leader is not null && leader != _instanceId)
            return false;

        await cache.SetStringAsync(CacheKey.KoHEngineLock, _instanceId,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = LeaderLease }, token);
        return true;
    }

    private async Task RunPassAsync(CancellationToken token)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTimeOffset.UtcNow;

        await TearDownHillsAsync(scope, db, now, token);

        var games = await db.Games
            .Where(g => g.StartTimeUtc <= now && now <= g.EndTimeUtc)
            .Where(g => g.Challenges.Any(c => c.Type == ChallengeType.KingOfTheHill && c.IsEnabled))
            .Select(g => g.Id)
            .ToListAsync(token);

        foreach (var gameId in _lastReconcile.Keys.Except(games))
            _lastReconcile.TryRemove(gameId, out _);

        await Task.WhenAll(games.Select(async gameId =>
        {
            try
            {
                await ProcessGameAsync(gameId, token);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogErrorMessage(e, $"KoH engine failed for game {gameId}");
            }
        }));
    }

    private async Task ProcessGameAsync(int gameId, CancellationToken token)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTimeOffset.UtcNow;

        var game = await db.Games.AsNoTracking()
            .Where(g => g.Id == gameId)
            .Select(g => new GameKnobs(g.Id, g.EndTimeUtc, Math.Max(1, g.KoHTickSeconds),
                Math.Max(1, g.KoHRefreshTicks), g.KoHHoldPointsPerTick))
            .SingleAsync(token);

        var hills = await db.GameChallenges.AsNoTracking().IgnoreAutoIncludes()
            .Where(c => c.GameId == gameId && c.Type == ChallengeType.KingOfTheHill && c.IsEnabled)
            .Select(c => new Hill(c.Id, c.ContainerImage, c.ExposePort, c.CPUCount, c.MemoryLimit, c.StorageLimit,
                c.NetworkMode, c.KoHCheckerImage))
            .ToListAsync(token);

        var latest = await db.KoHRounds.AsNoTracking()
            .Where(r => r.GameId == gameId)
            .OrderByDescending(r => r.Number)
            .FirstOrDefaultAsync(token);

        if (latest is not null)
        {
            var round = latest;
            await Task.WhenAll(hills
                .Where(hill => now >= round.EndsAt || now >= CheckDueAt(hill.Id, round))
                .Select(hill => CheckHillAsync(game, hill, round, token)));
        }

        var advanced = latest is null || latest.EndsAt <= now;
        if (advanced)
            latest = await AdvanceAsync(db, game, token);

        if (advanced || now - _lastReconcile.GetValueOrDefault(gameId) >= ReconcileInterval)
        {
            _lastReconcile[gameId] = now;
            await ReconcileHillsAsync(scope, db, game, hills, latest!.Number, token);
        }
    }

    private async Task<KoHRound> AdvanceAsync(AppDbContext db, GameKnobs game, CancellationToken token)
    {
        var number = await db.KoHRounds.Where(r => r.GameId == game.Id)
            .MaxAsync(r => (int?)r.Number, token) ?? 0;
        number++;

        var now = DateTimeOffset.UtcNow;
        var round = new KoHRound
        {
            GameId = game.Id, Number = number, StartedAt = now, EndsAt = now.AddSeconds(game.TickSeconds)
        };

        // The round and its tokens have to become visible together
        await using var transaction = await db.Database.BeginTransactionAsync(token);
        db.KoHRounds.Add(round);
        await db.SaveChangesAsync(token);

        if (KoHScoring.IsMintBoundary(number, game.RefreshTicks))
        {
            var teams = await db.Participations
                .Where(p => p.GameId == game.Id && p.Status == ParticipationStatus.Accepted)
                .Select(p => p.Id)
                .ToListAsync(token);

            db.KoHTokens.AddRange(teams.Select(participationId => new KoHToken
            {
                ParticipationId = participationId,
                RoundNumber = number,
                RoundId = round.Id,
                Token = MakeToken(),
                IssuedAt = now
            }));

            await db.SaveChangesAsync(token);
        }

        await transaction.CommitAsync(token);
        return round;
    }

    private static string MakeToken() =>
        $"koh_{Convert.ToBase64String(RandomNumberGenerator.GetBytes(TokenRandomBytes))
            .TrimEnd('=').Replace('+', '_').Replace('/', '-')}";

    private async Task ReconcileHillsAsync(AsyncServiceScope scope, AppDbContext db, GameKnobs game,
        List<Hill> hills, int round, CancellationToken token)
    {
        var manager = scope.ServiceProvider.GetRequiredService<IContainerManager>();
        var runner = scope.ServiceProvider.GetRequiredService<IKoHRunner>();

        foreach (var hill in hills)
        {
            var target = await db.KoHTargets
                .Include(t => t.Container)
                .FirstOrDefaultAsync(t => t.GameId == game.Id && t.ChallengeId == hill.Id, token);

            var dead = target?.Container is { ContainerId.Length: > 0 } container
                       && !await runner.IsRunningAsync(container.ContainerId, token);
            var refreshDue = KoHScoring.IsRefreshDue(round, target?.LastRefreshRound ?? 0, game.RefreshTicks);

            if (target?.Container is not null && !dead && !refreshDue)
                continue;

            if (target?.Container is not null)
                await DestroyHillContainerAsync(db, manager, target, token);

            var launched = await LaunchHillAsync(db, manager, game, hill, target, token);

            // Left unchanged when the launch failed, so that the next pass retries the refresh
            if (launched is not null && refreshDue)
            {
                launched.LastRefreshRound = round;
                await db.SaveChangesAsync(token);
            }
        }
    }

    private async Task<KoHTarget?> LaunchHillAsync(AppDbContext db, IContainerManager manager, GameKnobs game,
        Hill hill, KoHTarget? target, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(hill.Image))
        {
            logger.SystemLog($"KoH challenge {hill.Id} has no container image, skipping launch",
                TaskStatus.Failed, LogLevel.Warning);
            return null;
        }

        Models.Data.Container? container = null;
        try
        {
            container = await manager.CreateContainerAsync(new ContainerConfig
            {
                Image = hill.Image,
                TeamId = $"koh-{hill.Id}",
                ChallengeId = hill.Id,
                GameId = game.Id,
                ExposedPort = hill.Port ?? 80,
                CPUCount = hill.CpuCount ?? 1,
                MemoryLimit = hill.MemoryLimit ?? 128,
                StorageLimit = hill.StorageLimit ?? 256,
                NetworkMode = hill.NetworkMode ?? NetworkMode.Open,
                EnableTrafficCapture = false
            }, token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogErrorMessage(e, $"Failed to launch the hill of KoH challenge {hill.Id}");
        }

        if (container is null)
            return null;

        container.ExpectStopAt = game.EndTimeUtc;

        try
        {
            db.Containers.Add(container);
            if (target is null)
            {
                target = new KoHTarget { GameId = game.Id, ChallengeId = hill.Id, Container = container };
                db.KoHTargets.Add(target);
            }
            else
                target.Container = container;

            await db.SaveChangesAsync(token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogErrorMessage(e, $"Failed to record the hill of KoH challenge {hill.Id}, destroying it");
            await manager.DestroyContainerAsync(container, CancellationToken.None);
            throw;
        }

        logger.SystemLog($"KoH hill launched for challenge {hill.Id}: {container.Entry}",
            TaskStatus.Success, LogLevel.Information);
        return target;
    }

    private static async Task DestroyHillContainerAsync(AppDbContext db, IContainerManager manager,
        KoHTarget target, CancellationToken token)
    {
        var container = target.Container!;
        try
        {
            await manager.DestroyContainerAsync(container, token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // Already gone or raced with something else, the row goes away either way
        }

        target.Container = null;
        target.ContainerId = null;
        db.Containers.Remove(container);
        await db.SaveChangesAsync(token);
    }

    private async Task TearDownHillsAsync(AsyncServiceScope scope, AppDbContext db, DateTimeOffset now,
        CancellationToken token)
    {
        var stale = await db.KoHTargets
            .Include(t => t.Container)
            .Where(t => t.ContainerId != null && (t.Game.EndTimeUtc < now || !t.Challenge.IsEnabled))
            .ToListAsync(token);

        if (stale.Count == 0)
            return;

        var manager = scope.ServiceProvider.GetRequiredService<IContainerManager>();
        foreach (var target in stale)
        {
            await DestroyHillContainerAsync(db, manager, target, token);
            logger.SystemLog($"KoH hill destroyed for challenge {target.ChallengeId}",
                TaskStatus.Success, LogLevel.Information);
        }
    }

    /// <summary>
    /// Stable per (hill, round) jitter, so teams cannot time their plants around a fixed check moment
    /// </summary>
    private static DateTimeOffset CheckDueAt(int challengeId, KoHRound round)
    {
        var tick = Math.Max(1.0, (round.EndsAt - round.StartedAt).TotalSeconds);
        var grace = Math.Min(GraceSeconds, tick * 0.5);
        var maxJitter = Math.Max(0.0, tick - grace - PollInterval.TotalSeconds);
        var jitter = Math.Min(CheckWindowFraction * tick, maxJitter);

        uint hash;
        unchecked
        {
            hash = (uint)(challengeId * 49979687) ^ (uint)(round.Id * 67867967);
        }

        return round.StartedAt.AddSeconds(grace + hash % 100000u / 100000.0 * jitter);
    }

    private async Task CheckHillAsync(GameKnobs game, Hill hill, KoHRound round, CancellationToken token)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            if (await db.KoHControlResults.AnyAsync(r => r.ChallengeId == hill.Id && r.RoundId == round.Id, token))
                return;

            var container = await db.KoHTargets.AsNoTracking()
                .Where(t => t.GameId == game.Id && t.ChallengeId == hill.Id)
                .Select(t => t.Container)
                .FirstOrDefaultAsync(token);

            if (container is null || string.IsNullOrEmpty(container.IP))
            {
                await PersistAsync(db, game.Id, hill.Id, round.Id, null, KoHCheckStatus.Offline, 0, 0,
                    "hill not running", token);
                return;
            }

            var runner = scope.ServiceProvider.GetRequiredService<IKoHRunner>();
            var outcome = await runner.CheckAsync(new KoHCheckRequest(hill.Id, round.Number, container.IP,
                container.Port, hill.CheckerImage, hill.NetworkMode ?? NetworkMode.Open), token);

            var marker = (await runner.ReadMarkerAsync(container.ContainerId, token))?.Trim();
            var controller = await MatchTokenAsync(db, game, round.Number, marker, token);

            var freshlyElected = false;
            if (controller is { } king && outcome.Status != KoHCheckStatus.Ok)
            {
                // Looking back two ticks stops a team from re-arming the grace by dropping
                // the marker every other tick
                var recent = await db.KoHControlResults
                    .Where(r => r.ChallengeId == hill.Id
                                && (r.Round.Number == round.Number - 1 || r.Round.Number == round.Number - 2))
                    .Select(r => r.ControllingParticipationId)
                    .ToListAsync(token);
                freshlyElected = recent.All(c => c != king);
            }

            var (hold, penalty) =
                KoHScoring.TickDelta(controller is not null, outcome.Status, game.HoldPointsPerTick, freshlyElected);

            // The audit trail for organizers: the marker cannot prove who wrote it
            logger.SystemLog(
                $"KoH check: round={round.Number} challenge={hill.Id} controller={controller?.ToString() ?? "none"} status={outcome.Status}",
                TaskStatus.Success, LogLevel.Information);

            await PersistAsync(db, game.Id, hill.Id, round.Id, controller, outcome.Status, hold, penalty,
                outcome.ErrorMessage, token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogErrorMessage(e, $"KoH check failed for challenge {hill.Id} in round {round.Number}");
        }
    }

    private static async Task<int?> MatchTokenAsync(AppDbContext db, GameKnobs game, int round, string? marker,
        CancellationToken token)
    {
        if (string.IsNullOrEmpty(marker))
            return null;

        var anchor = KoHScoring.AnchorRound(round, game.RefreshTicks);
        return await db.KoHTokens
            .Where(t => t.RoundNumber == anchor && t.Token == marker && t.Participation.GameId == game.Id)
            .Select(t => (int?)t.ParticipationId)
            .FirstOrDefaultAsync(token);
    }

    private static async Task PersistAsync(AppDbContext db, int gameId, int challengeId, int roundId, int? controller,
        KoHCheckStatus status, double hold, double penalty, string? error, CancellationToken token)
    {
        db.KoHControlResults.Add(new KoHControlResult
        {
            GameId = gameId,
            ChallengeId = challengeId,
            RoundId = roundId,
            ControllingParticipationId = controller,
            Status = status,
            HoldCredit = hold,
            Penalty = penalty,
            ErrorMessage = error,
            CheckedAt = DateTimeOffset.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(token);
        }
        catch (DbUpdateException)
        {
            // Another instance already scored this hill for this round
        }
    }

    private sealed record GameKnobs(
        int Id,
        DateTimeOffset EndTimeUtc,
        int TickSeconds,
        int RefreshTicks,
        double HoldPointsPerTick);

    private sealed record Hill(
        int Id,
        string? Image,
        int? Port,
        int? CpuCount,
        int? MemoryLimit,
        int? StorageLimit,
        NetworkMode? NetworkMode,
        string? CheckerImage);
}
