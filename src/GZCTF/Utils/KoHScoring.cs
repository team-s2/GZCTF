namespace GZCTF.Utils;

/// <summary>
/// Pure King of the Hill helpers: refresh-window math and the per-tick score delta
/// </summary>
public static class KoHScoring
{
    /// <summary>
    /// Flat penalty for holding a hill whose service is broken
    /// </summary>
    public const double BrokenHillPenalty = 1.0;

    /// <summary>
    /// The first round of the refresh window that <paramref name="round"/> falls in.
    /// With 5 ticks per window: rounds 1-5 map to 1, rounds 6-10 map to 6, and so on.
    /// </summary>
    public static int AnchorRound(int round, int refreshTicks)
    {
        if (round <= 0)
            return round;

        var ticks = Math.Max(1, refreshTicks);
        return (round - 1) / ticks * ticks + 1;
    }

    /// <summary>
    /// Whether <paramref name="round"/> starts a refresh window, which is when tokens are minted
    /// </summary>
    public static bool IsMintBoundary(int round, int refreshTicks) =>
        round > 0 && AnchorRound(round, refreshTicks) == round;

    /// <summary>
    /// Whether the hill has to be reset for <paramref name="round"/>. This compares window
    /// indices rather than testing for the exact boundary round, so a skipped boundary still
    /// fires once. The first window never refreshes: the hill is launched fresh for it.
    /// </summary>
    public static bool IsRefreshDue(int round, int lastRefreshRound, int refreshTicks)
    {
        var ticks = Math.Max(1, refreshTicks);
        return round > ticks && (round - 1) / ticks > (lastRefreshRound - 1) / ticks;
    }

    /// <summary>
    /// Score delta of the tick for whoever holds the marker, as (HoldCredit, Penalty).
    /// A freshly elected king is not punished for damage left by the previous holder, and
    /// a checker or infrastructure fault is never debited to anyone.
    /// </summary>
    public static (double HoldCredit, double Penalty) TickDelta(
        bool hasKing, KoHCheckStatus status, double holdPointsPerTick, bool freshlyElected)
    {
        if (!hasKing)
            return (0, 0);

        return status switch
        {
            KoHCheckStatus.Ok => (holdPointsPerTick, 0),
            KoHCheckStatus.InternalError => (0, 0),
            _ => freshlyElected ? (0, 0) : (0, BrokenHillPenalty)
        };
    }

    /// <summary>
    /// Map a checker exit code to a verdict. The built-in TCP probe can only tell up from down.
    /// </summary>
    public static KoHCheckStatus FromExitCode(long exitCode, bool customChecker)
    {
        if (!customChecker)
            return exitCode == 0 ? KoHCheckStatus.Ok : KoHCheckStatus.Offline;

        return exitCode switch
        {
            0 => KoHCheckStatus.Ok,
            1 => KoHCheckStatus.Mumble,
            2 => KoHCheckStatus.Offline,
            _ => KoHCheckStatus.InternalError
        };
    }
}
