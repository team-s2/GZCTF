using System.Formats.Tar;
using System.Text;
using Docker.DotNet;
using Docker.DotNet.Models;
using GZCTF.Services.Container.Provider;
using static GZCTF.Services.KoH.KoHRunnerConstants;

namespace GZCTF.Services.KoH;

public sealed class DockerKoHRunner(
    IContainerProvider<DockerClient, DockerMetadata> provider,
    ILogger<DockerKoHRunner> logger) : IKoHRunner
{
    public async Task<bool> IsRunningAsync(string containerId, CancellationToken token)
    {
        try
        {
            var info = await provider.GetProvider().Containers.InspectContainerAsync(containerId, token);
            return info.State?.Running == true;
        }
        catch (DockerContainerNotFoundException)
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
        try
        {
            var response = await provider.GetProvider().Containers.GetArchiveFromContainerAsync(
                containerId, new ContainerPathStatParameters { Path = MarkerPath }, statOnly: false, token);
            return await ReadTarFileAsync(response.Stream, token);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            // The file is absent, or a team left something unparsable behind: no king either way
            logger.LogDebug(e, "KoH: failed to read the marker of {Container}", containerId);
            return null;
        }
    }

    public async Task<KoHCheckOutcome> CheckAsync(KoHCheckRequest request, CancellationToken token)
    {
        var meta = provider.GetMetadata();
        if (!meta.NetworkNames.TryGetValue(request.NetworkMode, out var network))
            return new(KoHCheckStatus.InternalError, $"no network for mode {request.NetworkMode}");

        var custom = !string.IsNullOrWhiteSpace(request.CheckerImage);
        var image = custom ? request.CheckerImage!.Trim() : ProbeImage;
        var client = provider.GetProvider();

        var parameters = new CreateContainerParameters
        {
            Image = image,
            Cmd = custom ? null! : ProbeCommand(request.TargetIp, request.TargetPort),
            Env =
            [
                "GZCTF_ACTION=check",
                $"GZCTF_TARGET_IP={request.TargetIp}",
                $"GZCTF_TARGET_PORT={request.TargetPort}",
                $"GZCTF_ROUND={request.Round}",
                $"GZCTF_CHALLENGE_ID={request.ChallengeId}"
            ],
            Labels = new Dictionary<string, string>
            {
                ["gzctf.role"] = "koh-checker", ["gzctf.challenge"] = request.ChallengeId.ToString()
            },
            HostConfig = new HostConfig
            {
                NetworkMode = network,
                Memory = 256L * 1024 * 1024,
                NanoCPUs = 500_000_000L,
                PidsLimit = 256
            }
        };

        string? containerId = null;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            timeout.CancelAfter(CheckTimeout);

            containerId = (await CreateAsync(client, meta, parameters, image, timeout.Token)).ID;
            if (!await client.Containers.StartContainerAsync(containerId, new ContainerStartParameters(), token))
                return new(KoHCheckStatus.InternalError, "checker failed to start");

            var exit = await client.Containers.WaitContainerAsync(containerId, timeout.Token);
            var status = KoHScoring.FromExitCode(exit.StatusCode, custom);

            return status == KoHCheckStatus.Ok
                ? new(status)
                : new(status, Truncate($"checker exited with {exit.StatusCode}"));
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        {
            return containerId is null
                ? new(KoHCheckStatus.InternalError, "timed out preparing the checker")
                : new(KoHCheckStatus.Offline, $"checker timed out after {CheckTimeout.TotalSeconds:0}s");
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogWarning(e, "KoH: check failed for challenge {Challenge}", request.ChallengeId);
            return new(KoHCheckStatus.InternalError, Truncate($"checker error: {e.Message}"));
        }
        finally
        {
            if (containerId is not null)
                try
                {
                    await client.Containers.RemoveContainerAsync(containerId,
                        new ContainerRemoveParameters { Force = true }, CancellationToken.None);
                }
                catch (Exception e)
                {
                    logger.LogDebug(e, "KoH: failed to remove checker {Container}", containerId);
                }
        }
    }

    private static async Task<CreateContainerResponse> CreateAsync(DockerClient client, DockerMetadata meta,
        CreateContainerParameters parameters, string image, CancellationToken token)
    {
        try
        {
            return await client.Containers.CreateContainerAsync(parameters, token);
        }
        catch (DockerImageNotFoundException)
        {
            await client.Images.CreateImageAsync(new ImagesCreateParameters { FromImage = image },
                meta.AuthConfigs.GetForImage(image) ?? new AuthConfig(), new Progress<JSONMessage>(), token);
            return await client.Containers.CreateContainerAsync(parameters, token);
        }
    }

    /// <summary>
    /// Extract the first regular file of a docker archive. The response is drained into memory
    /// first, because TarReader's small exact reads trip Docker.DotNet's chunked stream.
    /// </summary>
    internal static async Task<string?> ReadTarFileAsync(Stream? tar, CancellationToken token)
    {
        if (tar is null)
            return null;

        using var buffer = new MemoryStream();
        await using (tar)
        {
            // room for the marker plus tar headers, padding and the trailer
            var cap = MaxMarkerBytes + 16 * 1024;
            var chunk = new byte[16 * 1024];
            try
            {
                int read;
                while (buffer.Length < cap &&
                       (read = await tar.ReadAsync(
                           chunk.AsMemory(0, (int)Math.Min(chunk.Length, cap - buffer.Length)), token)) > 0)
                    buffer.Write(chunk, 0, read);
            }
            catch (EndOfStreamException)
            {
                // Docker.DotNet throws at the final chunk, the archive has been buffered by then
            }
        }

        buffer.Position = 0;
        using var reader = new TarReader(buffer);
        while (await reader.GetNextEntryAsync(cancellationToken: token) is { } entry)
        {
            if (entry.EntryType is not (TarEntryType.RegularFile or TarEntryType.V7RegularFile)
                || entry.DataStream is null)
                continue;

            var bytes = new byte[MaxMarkerBytes];
            var length = await entry.DataStream.ReadAtLeastAsync(bytes, bytes.Length, false, token);
            return Encoding.UTF8.GetString(bytes, 0, length);
        }

        return null;
    }
}
