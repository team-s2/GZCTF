using System.Net.WebSockets;
using System.Text;
using GZCTF.Services.Container.Provider;
using k8s;
using k8s.Autorest;
using k8s.Models;
using static GZCTF.Services.KoH.KoHRunnerConstants;

namespace GZCTF.Services.KoH;

public sealed class KubernetesKoHRunner(
    IContainerProvider<Kubernetes, KubernetesMetadata> provider,
    ILogger<KubernetesKoHRunner> logger) : IKoHRunner
{
    private string Namespace => provider.GetMetadata().Config.Namespace;

    public async Task<bool> IsRunningAsync(string containerId, CancellationToken token)
    {
        try
        {
            var pod = await provider.GetProvider().CoreV1
                .ReadNamespacedPodAsync(containerId, Namespace, cancellationToken: token);
            return pod.Status?.Phase is not ("Failed" or "Succeeded") && pod.Metadata?.DeletionTimestamp is null;
        }
        catch (HttpOperationException e) when (e.Response?.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            return true;
        }
    }

    public async Task<string?> ReadMarkerAsync(string containerId, CancellationToken token)
    {
        string[] command =
        [
            "sh", "-c",
            $"if [ -f \"$1\" ]; then head -c {MaxMarkerBytes} \"$1\" | base64 | tr -d '\\n'; fi",
            "x", MarkerPath
        ];

        try
        {
            var encoded = (await ExecCaptureStdoutAsync(containerId, command, token)).Trim();
            return encoded.Length == 0 ? null : Encoding.UTF8.GetString(Convert.FromBase64String(encoded));
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogDebug(e, "KoH: failed to read the marker of {Container}", containerId);
            return null;
        }
    }

    public async Task<KoHCheckOutcome> CheckAsync(KoHCheckRequest request, CancellationToken token)
    {
        var client = provider.GetProvider();
        var meta = provider.GetMetadata();
        var custom = !string.IsNullOrWhiteSpace(request.CheckerImage);
        var image = custom ? request.CheckerImage!.Trim() : ProbeImage;
        var name = $"koh-checker-{request.ChallengeId}-{request.Round}-{Guid.NewGuid().ToString("N")[..8]}"
            .ToValidRFC1123String("koh-checker");

        V1Pod pod = new()
        {
            Metadata = new()
            {
                Name = name,
                NamespaceProperty = Namespace,
                Labels = new Dictionary<string, string>
                {
                    ["gzctf.gzti.me/ResourceId"] = name,
                    ["gzctf.role"] = "koh-checker",
                    // Lets the checker reach the hill regardless of the hill's own network mode
                    ["gzctf.gzti.me/NetworkMode"] = "open"
                }
            },
            Spec = new()
            {
                Containers =
                [
                    new()
                    {
                        Name = "checker",
                        Image = image,
                        Command = custom ? null : ProbeCommand(request.TargetIp, request.TargetPort),
                        Env =
                        [
                            new() { Name = "GZCTF_ACTION", Value = "check" },
                            new() { Name = "GZCTF_TARGET_IP", Value = request.TargetIp },
                            new() { Name = "GZCTF_TARGET_PORT", Value = request.TargetPort.ToString() },
                            new() { Name = "GZCTF_ROUND", Value = request.Round.ToString() },
                            new() { Name = "GZCTF_CHALLENGE_ID", Value = request.ChallengeId.ToString() }
                        ],
                        Resources = new()
                        {
                            Limits = new Dictionary<string, ResourceQuantity>
                            {
                                ["cpu"] = new("500m"), ["memory"] = new("256Mi")
                            },
                            Requests = new Dictionary<string, ResourceQuantity>
                            {
                                ["cpu"] = new("10m"), ["memory"] = new("32Mi")
                            }
                        }
                    }
                ],
                ImagePullSecrets = meta.AuthSecretNames.GetForImage(image) is { } secret
                    ? new List<V1LocalObjectReference> { new() { Name = secret } }
                    : null,
                RestartPolicy = "Never",
                AutomountServiceAccountToken = false,
                EnableServiceLinks = false
            }
        };

        try
        {
            await client.CreateNamespacedPodAsync(pod, Namespace, cancellationToken: token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogWarning(e, "KoH: failed to create the checker of challenge {Challenge}", request.ChallengeId);
            return new(KoHCheckStatus.InternalError, Truncate($"checker create error: {e.Message}"));
        }

        var phase = "Pending";
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            timeout.CancelAfter(CheckTimeout);

            while (true)
            {
                var current = await client.CoreV1.ReadNamespacedPodAsync(name, Namespace,
                    cancellationToken: timeout.Token);
                phase = current.Status?.Phase ?? phase;

                if (phase is "Succeeded" or "Failed")
                {
                    var exitCode = current.Status?.ContainerStatuses?.FirstOrDefault()?.State?.Terminated?.ExitCode;
                    if (exitCode is null)
                        return new(KoHCheckStatus.InternalError, "checker finished without an exit code");

                    var status = KoHScoring.FromExitCode(exitCode.Value, custom);
                    return status == KoHCheckStatus.Ok
                        ? new(status)
                        : new(status, Truncate($"checker exited with {exitCode}"));
                }

                await Task.Delay(TimeSpan.FromSeconds(2), timeout.Token);
            }
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        {
            // A pod that never left Pending says nothing about the hill, so it must not cost its king
            return phase == "Pending"
                ? new(KoHCheckStatus.InternalError, "checker pod was never scheduled in time")
                : new(KoHCheckStatus.Offline, $"checker timed out after {CheckTimeout.TotalSeconds:0}s");
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogWarning(e, "KoH: check failed for challenge {Challenge}", request.ChallengeId);
            return new(KoHCheckStatus.InternalError, Truncate($"checker error: {e.Message}"));
        }
        finally
        {
            try
            {
                await client.CoreV1.DeleteNamespacedPodAsync(name, Namespace,
                    cancellationToken: CancellationToken.None);
            }
            catch (Exception e)
            {
                logger.LogDebug(e, "KoH: failed to remove checker {Pod}", name);
            }
        }
    }

    /// <summary>
    /// One-shot exec capturing stdout. Output is capped because the hill is attacker-controlled.
    /// </summary>
    private async Task<string> ExecCaptureStdoutAsync(string pod, string[] command, CancellationToken token)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));

        using var socket = await provider.GetProvider().WebSocketNamespacedPodExecAsync(
            pod, Namespace, command, pod, stderr: false, stdin: false, stdout: true, tty: false,
            cancellationToken: timeout.Token);

        var output = new StringBuilder();
        var buffer = new byte[16 * 1024];
        var fragmentChannel = -1;
        var maxChars = MaxMarkerBytes * 2;

        while (socket.State == WebSocketState.Open && output.Length < maxChars)
        {
            var received = await socket.ReceiveAsync(buffer, timeout.Token);
            if (received.MessageType == WebSocketMessageType.Close || received.Count == 0)
                break;

            // the first byte of a message carries the channel number
            var channel = fragmentChannel < 0 ? buffer[0] : fragmentChannel;
            var offset = fragmentChannel < 0 ? 1 : 0;
            fragmentChannel = received.EndOfMessage ? -1 : channel;

            if (channel == 1 && received.Count > offset)
                output.Append(Encoding.UTF8.GetString(buffer, offset, received.Count - offset));
        }

        return output.ToString();
    }
}
