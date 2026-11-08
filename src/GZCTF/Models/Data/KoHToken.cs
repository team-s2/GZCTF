using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace GZCTF.Models.Data;

/// <summary>
/// The control token issued to one team for one refresh window. It is game-wide (valid on
/// every hill) and is written by the team into a hill's <c>/koh/king</c> marker to claim it.
/// </summary>
[Index(nameof(ParticipationId), nameof(RoundNumber), IsUnique = true)]
[Index(nameof(Token), IsUnique = true)]
[Index(nameof(RoundId))]
public class KoHToken
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ParticipationId { get; set; }

    public Participation Participation { get; set; } = null!;

    /// <summary>
    /// The anchor (first) round of the refresh window this token is valid for
    /// </summary>
    [Required]
    public int RoundNumber { get; set; }

    [Required]
    public int RoundId { get; set; }

    public KoHRound Round { get; set; } = null!;

    [Required]
    [MaxLength(Limits.MaxFlagLength)]
    public string Token { get; set; } = string.Empty;

    [Required]
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
}
