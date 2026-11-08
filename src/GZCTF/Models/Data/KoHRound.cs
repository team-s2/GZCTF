using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace GZCTF.Models.Data;

/// <summary>
/// One King of the Hill tick of a game. Control results and control tokens pivot off this row.
/// </summary>
[Index(nameof(GameId), nameof(Number), IsUnique = true)]
public class KoHRound
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int GameId { get; set; }

    public Game Game { get; set; } = null!;

    /// <summary>
    /// 1-indexed round number within the game
    /// </summary>
    [Required]
    public int Number { get; set; }

    [Required]
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// When this tick ends and the next one may start
    /// </summary>
    [Required]
    public DateTimeOffset EndsAt { get; set; }
}
