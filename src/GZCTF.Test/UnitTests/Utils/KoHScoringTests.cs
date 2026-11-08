using GZCTF.Utils;
using Xunit;

namespace GZCTF.Test.UnitTests.Utils;

public class KoHScoringTests
{
    [Theory]
    [InlineData(1, 5, 1)]
    [InlineData(5, 5, 1)]
    [InlineData(6, 5, 6)]
    [InlineData(11, 5, 11)]
    [InlineData(3, 1, 3)]
    [InlineData(4, 0, 4)]
    [InlineData(0, 5, 0)]
    public void AnchorRound_MapsRoundsToTheirWindowStart(int round, int ticks, int expected) =>
        Assert.Equal(expected, KoHScoring.AnchorRound(round, ticks));

    [Theory]
    [InlineData(1, 5, true)]
    [InlineData(2, 5, false)]
    [InlineData(6, 5, true)]
    [InlineData(0, 5, false)]
    public void IsMintBoundary_OnlyAtWindowStart(int round, int ticks, bool expected) =>
        Assert.Equal(expected, KoHScoring.IsMintBoundary(round, ticks));

    [Theory]
    [InlineData(5, 0, 5, false)] // the first window never refreshes
    [InlineData(6, 0, 5, true)]
    [InlineData(7, 0, 5, true)] // a skipped boundary still fires
    [InlineData(7, 6, 5, false)] // and only once per window
    [InlineData(11, 6, 5, true)]
    public void IsRefreshDue_FiresOncePerWindow(int round, int lastRefresh, int ticks, bool expected) =>
        Assert.Equal(expected, KoHScoring.IsRefreshDue(round, lastRefresh, ticks));

    [Theory]
    [InlineData(false, KoHCheckStatus.Ok, false, 0, 0)]
    [InlineData(true, KoHCheckStatus.Ok, false, 2, 0)]
    [InlineData(true, KoHCheckStatus.Mumble, false, 0, 1)]
    [InlineData(true, KoHCheckStatus.Offline, false, 0, 1)]
    [InlineData(true, KoHCheckStatus.Offline, true, 0, 0)]
    [InlineData(true, KoHCheckStatus.InternalError, false, 0, 0)]
    public void TickDelta_GatesHoldAndPenaltyOnTheVerdict(bool king, KoHCheckStatus status, bool fresh,
        double hold, double penalty)
    {
        var delta = KoHScoring.TickDelta(king, status, 2, fresh);
        Assert.Equal((hold, penalty), delta);
    }

    [Theory]
    [InlineData(0, true, KoHCheckStatus.Ok)]
    [InlineData(1, true, KoHCheckStatus.Mumble)]
    [InlineData(2, true, KoHCheckStatus.Offline)]
    [InlineData(3, true, KoHCheckStatus.InternalError)]
    [InlineData(1, false, KoHCheckStatus.Offline)]
    public void FromExitCode_MapsTheCheckerContract(long code, bool custom, KoHCheckStatus expected) =>
        Assert.Equal(expected, KoHScoring.FromExitCode(code, custom));
}
