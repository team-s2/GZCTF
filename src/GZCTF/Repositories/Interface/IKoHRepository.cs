using GZCTF.Models.Request.Game;

namespace GZCTF.Repositories.Interface;

public interface IKoHRepository : IRepository
{
    /// <summary>
    /// Whether the game has at least one King of the Hill challenge
    /// </summary>
    public Task<bool> HasHills(int gameId, CancellationToken token = default);

    /// <summary>
    /// Resolve a team's control token for the current refresh window
    /// </summary>
    public Task<KoHTokenModel> GetToken(Game game, int participationId, CancellationToken token = default);

    /// <summary>
    /// Current state of every enabled hill of the game
    /// </summary>
    public Task<List<KoHHillStateModel>> GetHills(int gameId, int participationId, CancellationToken token = default);

    /// <summary>
    /// The cached scoreboard
    /// </summary>
    public Task<KoHScoreboardModel> GetScoreboard(Game game, CancellationToken token = default);

    /// <summary>
    /// The cached score timeline
    /// </summary>
    public Task<KoHTimelineModel> GetTimeline(Game game, CancellationToken token = default);

    /// <summary>
    /// Admin view of every hill, including disabled ones, and the leaderboard
    /// </summary>
    public Task<KoHAdminStateModel> GetAdminState(Game game, CancellationToken token = default);
}
