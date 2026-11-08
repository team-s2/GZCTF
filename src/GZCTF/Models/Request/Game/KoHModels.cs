using System.ComponentModel.DataAnnotations;
using MemoryPack;

namespace GZCTF.Models.Request.Game;

/// <summary>
/// The caller's control token for the current refresh window
/// </summary>
public class KoHTokenModel
{
    /// <summary>
    /// The anchor round the token belongs to, 0 before the first round
    /// </summary>
    [Required]
    public int Round { get; set; }

    /// <summary>
    /// The exact value to write into /koh/king, null when not available
    /// </summary>
    public string? Token { get; set; }

    /// <summary>
    /// ready, warmup (no round yet) or no-token (the team joined after the window was minted)
    /// </summary>
    [Required]
    public string Status { get; set; } = "warmup";
}

/// <summary>
/// Current state of one hill, as seen by a participating team
/// </summary>
public class KoHHillStateModel
{
    [Required]
    public int ChallengeId { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// The round of the last scored result
    /// </summary>
    [Required]
    public int Round { get; set; }

    public string? HolderTeamName { get; set; }

    /// <summary>
    /// Whether the caller's team is the recorded holder
    /// </summary>
    [Required]
    public bool IsYou { get; set; }

    /// <summary>
    /// Last functional verdict: Ok, Mumble, Offline, InternalError or null
    /// </summary>
    public string? Status { get; set; }

    public DateTimeOffset? CheckedAt { get; set; }

    /// <summary>
    /// How to reach the hill: host:port, or a container id when served by the platform proxy
    /// </summary>
    public string? Entry { get; set; }

    [Required]
    public int LastRefreshRound { get; set; }
}

/// <summary>
/// King of the Hill scoreboard
/// </summary>
[MemoryPackable]
public partial class KoHScoreboardModel
{
    [Required]
    public int LatestRound { get; set; }

    public DateTimeOffset? CurrentRoundEndsAt { get; set; }

    [Required]
    public int RefreshTicks { get; set; }

    [Required]
    public List<KoHScoreboardHill> Hills { get; set; } = [];

    [Required]
    public List<KoHTeamScoreRow> Teams { get; set; } = [];
}

[MemoryPackable]
public partial class KoHScoreboardHill
{
    [Required]
    public int ChallengeId { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    public string? CurrentHolderTeamName { get; set; }

    public string? LastCheckStatus { get; set; }

    [Required]
    public int LastRefreshRound { get; set; }
}

[MemoryPackable]
public partial class KoHTeamScoreRow
{
    [Required]
    public int Rank { get; set; }

    [Required]
    public int TeamId { get; set; }

    [Required]
    public string TeamName { get; set; } = string.Empty;

    public string? Division { get; set; }

    [Required]
    public double Total { get; set; }

    /// <summary>
    /// One entry per hill, in the same order as the board's hills
    /// </summary>
    [Required]
    public List<KoHHillScore> Hills { get; set; } = [];
}

[MemoryPackable]
public partial class KoHHillScore
{
    [Required]
    public int ChallengeId { get; set; }

    /// <summary>
    /// Earned - Penalty
    /// </summary>
    [Required]
    public double Points { get; set; }

    [Required]
    public double Earned { get; set; }

    [Required]
    public double Penalty { get; set; }

    [Required]
    public int TicksHeld { get; set; }

    [Required]
    public bool IsCurrentHolder { get; set; }
}

/// <summary>
/// Cumulative King of the Hill score per team over the rounds
/// </summary>
[MemoryPackable]
public partial class KoHTimelineModel
{
    [Required]
    public List<KoHTeamTimeline> Teams { get; set; } = [];
}

[MemoryPackable]
public partial class KoHTeamTimeline
{
    [Required]
    public int TeamId { get; set; }

    [Required]
    public string TeamName { get; set; } = string.Empty;

    public string? Division { get; set; }

    [Required]
    public List<KoHTimelinePoint> Items { get; set; } = [];
}

[MemoryPackable]
public partial class KoHTimelinePoint
{
    [Required]
    public int Round { get; set; }

    [Required]
    public DateTimeOffset Time { get; set; }

    [Required]
    public double Score { get; set; }
}
