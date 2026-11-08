using GZCTF.Models.Data;

namespace GZCTF.Services.KoH;

/// <summary>
/// What a functional check needs to know about a hill
/// </summary>
public sealed record KoHCheckRequest(
    int ChallengeId,
    int Round,
    string TargetIp,
    int TargetPort,
    string? CheckerImage,
    NetworkMode NetworkMode);

public sealed record KoHCheckOutcome(KoHCheckStatus Status, string? ErrorMessage = null);

/// <summary>
/// Container-provider specific operations of the King of the Hill engine
/// </summary>
public interface IKoHRunner
{
    /// <summary>
    /// Whether the container is alive. Returns true when that cannot be determined,
    /// so that only a definitive answer triggers a relaunch.
    /// </summary>
    public Task<bool> IsRunningAsync(string containerId, CancellationToken token);

    /// <summary>
    /// Read the control marker from a hill, null when absent or unreadable
    /// </summary>
    public Task<string?> ReadMarkerAsync(string containerId, CancellationToken token);

    /// <summary>
    /// Run the functional check of a hill
    /// </summary>
    public Task<KoHCheckOutcome> CheckAsync(KoHCheckRequest request, CancellationToken token);
}

internal static class KoHRunnerConstants
{
    public const string MarkerPath = "/koh/king";
    public const int MaxMarkerBytes = 4096;
    public const string ProbeImage = "alpine:3.21";
    public const int MaxErrorLength = 4096;
    public static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(30);

    public static string[] ProbeCommand(string ip, int port) => ["sh", "-c", $"nc -z -w3 {ip} {port}"];

    public static string Truncate(string text) =>
        text.Length > MaxErrorLength ? text[..MaxErrorLength] : text;
}
