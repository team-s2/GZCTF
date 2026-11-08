using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace GZCTF.Models.Data;

/// <summary>
/// Outcome of one tick for one hill: who controlled it, whether it was functional and the
/// resulting score delta. The scoreboard sums HoldCredit - Penalty per controlling team.
/// </summary>
[Index(nameof(ChallengeId), nameof(RoundId), IsUnique = true)]
[Index(nameof(RoundId))]
[Index(nameof(GameId), nameof(ChallengeId))]
public class KoHControlResult
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int GameId { get; set; }

    [Required]
    public int ChallengeId { get; set; }

    public GameChallenge Challenge { get; set; } = null!;

    [Required]
    public int RoundId { get; set; }

    public KoHRound Round { get; set; } = null!;

    /// <summary>
    /// Team controlling the hill this tick, null when there is no valid king
    /// </summary>
    public int? ControllingParticipationId { get; set; }

    public Participation? ControllingParticipation { get; set; }

    [Required]
    public KoHCheckStatus Status { get; set; }

    public double HoldCredit { get; set; }

    public double Penalty { get; set; }

    [MaxLength(4096)]
    public string? ErrorMessage { get; set; }

    [Required]
    public DateTimeOffset CheckedAt { get; set; } = DateTimeOffset.UtcNow;
}
