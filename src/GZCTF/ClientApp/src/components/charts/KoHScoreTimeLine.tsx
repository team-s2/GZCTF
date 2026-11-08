import { useMantineColorScheme, useMantineTheme } from '@mantine/core'
import dayjs from 'dayjs'
import type { EChartsOption, SeriesOption } from 'echarts'
import { FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EchartsContainer } from '@Components/charts/EchartsContainer'
import { useGame, useKoHScoreboard, useKoHTimeline } from '@Hooks/useGame'

const MAX_TEAMS = 10

interface KoHScoreTimeLineProps {
  gameId: number
}

export const KoHScoreTimeLine: FC<KoHScoreTimeLineProps> = ({ gameId }) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const { t } = useTranslation()
  const { game } = useGame(gameId)
  const { timeline } = useKoHTimeline(gameId)
  const { scoreboard } = useKoHScoreboard(gameId)

  const option: EChartsOption = useMemo(() => {
    const isDark = colorScheme === 'dark'
    const labelColor = isDark ? theme.colors.light[1] : theme.colors.dark[5]
    const lineColor = isDark ? theme.colors.gray[3] : theme.colors.gray[6]

    const topTeams = new Set(scoreboard?.teams.slice(0, MAX_TEAMS).map((team) => team.teamId))

    const series: SeriesOption[] =
      timeline?.teams
        .filter((team) => topTeams.has(team.teamId))
        .map((team) => ({
          type: 'line',
          step: 'end',
          name: team.teamName,
          data: [[dayjs(game?.start).toDate(), 0], ...team.items.map((point) => [point.time, point.score])],
        })) ?? []

    return {
      backgroundColor: 'transparent',
      xAxis: {
        type: 'time',
        min: dayjs(game?.start).toDate(),
        max: dayjs(game?.end).toDate(),
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: t('game.label.score'),
        nameTextStyle: { color: labelColor, fontWeight: 'normal' },
        axisLabel: { color: labelColor },
        splitLine: { show: true, lineStyle: { color: [lineColor], type: 'dashed' } },
      },
      tooltip: { trigger: 'axis', borderWidth: 0, textStyle: { fontSize: 12 } },
      legend: { orient: 'horizontal', top: 340, textStyle: { fontSize: 12, color: labelColor } },
      grid: { top: 50, left: 70, right: 40, bottom: 60 },
      series,
    }
  }, [timeline, scoreboard, game, colorScheme, theme, t])

  return <EchartsContainer option={option} style={{ width: '100%', height: 400 }} />
}
