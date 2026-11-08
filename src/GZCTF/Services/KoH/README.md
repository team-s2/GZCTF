# King of the Hill (KoH) design

KoH is a challenge type (`ChallengeType.KingOfTheHill`) where all teams fight over one shared container per challenge, the *hill*. A team holds a hill by writing its secret control token into the file `/koh/king` inside the container, through whatever vulnerability the challenge has. Each tick, the platform reads that file and awards points to the team whose token is there.

This is a standalone port of the KoH mode from [dimasma0305/GZCTF](https://github.com/dimasma0305/GZCTF). Upstream builds KoH on its Attack & Defense engine and WireGuard VPN. Neither exists here, so the round, reconcile and check logic now lives in one small engine, and hills are reached through the normal container entry.

## Game loop

`Services/KoH/KoHEngine.cs` is a hosted service that polls every 5 seconds. Each pass does this, sequentially per game:

1. **Score** the latest round for each hill whose check is due. A round that has expired is always scored first.
2. **Advance** to the next round when the current one has ended, minting tokens if a new refresh window starts.
3. **Reconcile** hills at least every 15 seconds: launch missing or dead ones, and reset them when a refresh is due.

Running these in order on one thread guarantees a round is scored before its hill can be wiped, so no lock is needed between them. Games run in parallel. With several app instances, a best-effort leader lease in the distributed cache (`_KoHEngineLock`) picks one instance, and unique indexes on rounds and results make a rare overlap harmless.

Hills are torn down when the game ends or the challenge is disabled. Scores are kept.

## Rounds, windows and tokens

- A **tick** lasts `Game.KoHTickSeconds` (default 60). Round 1 starts as soon as the game starts.
- A **refresh window** is `Game.KoHRefreshTicks` rounds (default 5): rounds 1-5, 6-10, and so on.
- At each window start, every accepted team gets one random `koh_...` token. It is valid on every hill of the game until the window ends.
- When a new window starts, each hill is destroyed and relaunched from its base image, wiping footholds and the marker. The first window uses the initial launch. A failed relaunch is retried on the next pass.

## Scoring a hill

Each round, at a jittered time inside the tick, the engine runs one check per hill:

1. **Functional check** in a short-lived container or pod on the hill's network. A custom image (`GameChallenge.KoHCheckerImage`) receives `GZCTF_ACTION`, `GZCTF_TARGET_IP`, `GZCTF_TARGET_PORT`, `GZCTF_ROUND` and `GZCTF_CHALLENGE_ID`, and reports through its exit code. Without an image, a built-in `nc -z` TCP probe is used, which can only report Ok or Offline.
2. **Marker read** of `/koh/king`, trimmed and matched against the tokens of the current window. On Docker this uses the archive API, so the image needs no tools. On Kubernetes it execs in the pod, so the image needs `sh`, `head`, `base64` and `tr`.
3. **One `KoHControlResult`** per hill and round:

| King | Verdict | Hold credit | Penalty |
| --- | --- | --- | --- |
| None | any | 0 | 0 |
| Yes | Ok (exit 0) | `Game.KoHHoldPointsPerTick` | 0 |
| Yes | Mumble (exit 1) or Offline (exit 2) | 0 | 1 |
| Yes | InternalError (any other exit, or platform fault) | 0 | 0 |

A king who did not hold the hill in either of the previous two ticks gets no penalty on a broken hill, so nobody pays for damage left by the previous holder. Two ticks rather than one stops a team from re-arming this grace by dropping the marker every other tick.

## Data model

| Entity | Purpose |
| --- | --- |
| `KoHRound` | One tick of a game |
| `KoHTarget` | One hill per game and challenge: its container and last refresh round |
| `KoHToken` | One token per team per refresh window |
| `KoHControlResult` | One outcome per hill per round, the source of all scores |
| `Game.KoHTickSeconds`, `KoHRefreshTicks`, `KoHHoldPointsPerTick` | Per-game settings, editable on the game info page |
| `GameChallenge.KoHCheckerImage` | Optional checker image |

All of it is added by the `AddKoH` migration. Hill containers have no `GameInstance`. They are owned by the engine and excluded from the expired-container reaper.

## API

All routes are under `/api/game/{id}/koh`.

| Route | Access | Returns |
| --- | --- | --- |
| `GET token` | Accepted team member | The team's current token and its status |
| `GET hills` | Accepted team member | Holder, verdict and entry of each hill the team's division may view |
| `GET scoreboard` | Same as the main scoreboard | Per-team, per-hill points |
| `GET timeline` | Same as the main scoreboard | Cumulative score per team |

Scoreboard and timeline use a 10-second cache, which replaces any invalidation since results change once per tick. Per-team containers and flag submission are rejected for hills.

## Frontend

- The challenge modal shows `KoHChallengePanel` (holder, verdict, entry, token) instead of the flag form.
- The challenges page has a King of the Hill guide (`KoHGuideModal`) when the game has hills: the rules, the team's token, a live hill list and copyable commands.
- The scoreboard page has a Jeopardy / King of the Hill switch when the game has hills. Hills are filtered out of the jeopardy board and its Excel export. KoH points are not added to the jeopardy score.
- Admins create hills with the normal challenge form, and get the checker image and KoH game settings in the existing edit pages.

## Authoring a hill

Use any image with the intended vulnerability that exposes the service port and has a `/koh/king` file writable through that vulnerability. No flag is needed.

```dockerfile
FROM alpine:3.21
RUN apk add --no-cache socat && mkdir -p /koh && touch /koh/king
COPY serve.sh /serve.sh
EXPOSE 80
CMD ["socat", "TCP-LISTEN:80,reuseaddr,fork", "EXEC:/serve.sh"]
```

## Known limitations

- **Attribution:** the marker cannot prove who wrote it. A team that reads another team's token from a hill can replay it, which credits the token's owner, not the replayer. Each result is logged for after-the-fact review.
- **Shared access:** a hill has no per-team isolation, so with `PlatformProxy` or a public port every team reaches the same service.
- **Token distribution:** a team accepted mid-window gets its token at the next reset.

## Left out of the port

These upstream parts were dropped to keep the port small:

- The A&D engine, WireGuard VPN and egress isolation.
- The leader cooldown after a reset, which needs the VPN to block the leading team.
- Team API tokens. Scripts authenticate with the normal session cookie.
- The public attack animation and admin operations console.
- Score freezing, because this codebase has no freeze time.
