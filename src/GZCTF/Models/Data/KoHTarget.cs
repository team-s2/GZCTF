using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace GZCTF.Models.Data;

/// <summary>
/// The single shared container ("hill") of a King of the Hill challenge.
/// Owned by <c>KoHEngine</c>, which launches it and resets it to its base image
/// every <see cref="Game.KoHRefreshTicks"/> ticks.
/// </summary>
[Index(nameof(GameId), nameof(ChallengeId), IsUnique = true)]
public class KoHTarget
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int GameId { get; set; }

    public Game Game { get; set; } = null!;

    [Required]
    public int ChallengeId { get; set; }

    public GameChallenge Challenge { get; set; } = null!;

    /// <summary>
    /// The shared container, null while the hill is down
    /// </summary>
    public Guid? ContainerId { get; set; }

    public Container? Container { get; set; }

    /// <summary>
    /// Round number at which the hill was last reset to its base image
    /// </summary>
    public int LastRefreshRound { get; set; }
}
