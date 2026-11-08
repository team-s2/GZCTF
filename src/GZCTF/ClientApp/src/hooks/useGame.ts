import dayjs from 'dayjs'
import { TFunction } from 'i18next'
import { useMemo } from 'react'
import { GameStatus } from '@Components/GameCard'
import { OnceSWRConfig } from '@Hooks/useConfig'
import api, { ChallengeType, ParticipationStatus } from '@Api'

export const useRecentGames = () => {
  const { data, mutate, error } = api.game.useGameRecentGames(
    { limit: 7 },
    {
      refreshInterval: 30 * 60 * 1000,
    }
  )

  return { recentGames: data, error, mutate }
}

export const getGameStatus = (game?: { start?: number; end?: number }) => {
  const startTime = dayjs(game?.start)
  const endTime = dayjs(game?.end)

  const total = endTime.diff(startTime, 'minute')
  const current = dayjs().diff(startTime, 'minute')

  const finished = dayjs().isAfter(endTime)
  const started = dayjs().isAfter(startTime)
  const progress = started ? (finished ? 1 : current / total) : 0
  const status = started ? (finished ? GameStatus.Ended : GameStatus.OnGoing) : GameStatus.Coming

  return {
    startTime,
    endTime,
    finished,
    started,
    progress: progress * 100,
    total,
    status,
  }
}

export const toLimitTag = (t: TFunction, limit?: number) => {
  if (!limit || limit === 0) return t('game.tag.multiplayer')
  if (limit === 1) return t('game.tag.individual')
  return t('game.tag.limited', { count: limit })
}

export const useAdminGame = (numId: number) => {
  const { data: game, mutate, error } = api.edit.useEditGetGame(numId, OnceSWRConfig, numId > 0)

  return { game, error, mutate }
}

export const useAdminDivisions = (numId: number) => {
  const { data: divisions, mutate, error } = api.edit.useEditGetDivisions(numId, OnceSWRConfig, numId > 0)

  return { divisions, error, mutate, hasDivisions: (divisions?.length ?? 0) > 0 }
}

export const useGame = (numId: number) => {
  const { data: game, error, mutate } = api.game.useGameGame(numId, OnceSWRConfig, numId > 0)

  return { game, error, mutate, status: game?.status ?? ParticipationStatus.Unsubmitted }
}

export const useGameScoreboard = (numId: number) => {
  const { game } = useGame(numId)
  const { status } = getGameStatus(game)

  const {
    data: scoreboard,
    error,
    mutate,
  } = api.game.useGameScoreboard(numId, {
    ...OnceSWRConfig,
    refreshInterval: status === GameStatus.OnGoing ? 30 * 1000 : 0,
  })

  // Hills live on their own board, the shared payload only carries them for the challenge cards
  const { jeopardyBoard, hasKoH } = useMemo(() => {
    if (!scoreboard?.challenges) return { jeopardyBoard: scoreboard, hasKoH: false }

    const entries = Object.entries(scoreboard.challenges)
    const isJeopardy = (type: ChallengeType) => type !== ChallengeType.KingOfTheHill
    const challenges = Object.fromEntries(
      entries
        .map(([category, items]) => [category, items.filter((item) => isJeopardy(item.type))] as const)
        .filter(([, items]) => items.length > 0)
    )

    return {
      jeopardyBoard: { ...scoreboard, challenges },
      hasKoH: entries.some(([, items]) => items.some((item) => !isJeopardy(item.type))),
    }
  }, [scoreboard])

  return { scoreboard: jeopardyBoard, hasKoH, error, mutate }
}

export const useKoHScoreboard = (numId: number) => {
  const { data: scoreboard, error } = api.game.useGameKoHScoreboard(numId, {
    ...OnceSWRConfig,
    refreshInterval: 10 * 1000,
  })

  return { scoreboard, error }
}

export const useKoHTimeline = (numId: number) => {
  const { data: timeline, error } = api.game.useGameKoHTimeline(numId, {
    ...OnceSWRConfig,
    refreshInterval: 30 * 1000,
  })

  return { timeline, error }
}

export const useGameTeamInfo = (numId: number) => {
  const { game } = useGame(numId)
  const { status } = getGameStatus(game)

  const {
    data: teamInfo,
    error,
    mutate,
  } = api.game.useGameChallengesWithTeamInfo(numId, {
    ...OnceSWRConfig,
    shouldRetryOnError: false,
    refreshInterval: status === GameStatus.OnGoing ? 10 * 1000 : 0,
  })

  return { teamInfo, game, error, mutate }
}
