import { useMantineColorScheme, useMantineTheme } from '@mantine/core'
import dayjs from 'dayjs'
import type { EChartsOption, SeriesOption } from 'echarts'
import { FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EchartsContainer } from '@Components/charts/EchartsContainer'
import { normalizeLanguage, useLanguage } from '@Utils/I18n'
import { useKoHScoreboard, useKoHTimeline } from '@Hooks/useGame'

const MAX_TEAMS = 10

const escapeHtml = (value: string) => {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML
}

const shorten = (name: string) => (name.length > 20 ? `${name.slice(0, 17)}...` : name)

interface KoHScoreTimeLineProps {
  gameId: number
}

export const KoHScoreTimeLine: FC<KoHScoreTimeLineProps> = ({ gameId }) => {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const locale = normalizeLanguage(language)
  const { timeline } = useKoHTimeline(gameId)
  const { scoreboard } = useKoHScoreboard(gameId)

  const teams = useMemo(() => {
    const top = new Set(scoreboard?.teams.slice(0, MAX_TEAMS).map((team) => team.teamId))
    return timeline?.teams.filter((team) => top.has(team.teamId) && team.items.length > 0) ?? []
  }, [timeline, scoreboard])

  // Every team shares the same rounds, so the axis follows the rounds that were actually played
  const firstRoundAt = teams[0]?.items[0]?.time
  const lastRoundAt = teams[0]?.items[teams[0].items.length - 1]?.time

  const series: SeriesOption[] = useMemo(
    () =>
      teams.map((team) => ({
        type: 'line',
        step: 'end',
        name: team.teamName,
        data: team.items.map((point) => [point.time, point.score]),
      })),
    [teams]
  )

  const option: EChartsOption = useMemo(() => {
    const isDark = colorScheme === 'dark'
    const labelColor = isDark ? theme.colors.light[1] : theme.colors.dark[5]
    const lineColor = isDark ? theme.colors.gray[3] : theme.colors.gray[6]
    const backgroundColor = isDark ? theme.colors.gray[6] : theme.colors.light[1]

    return {
      animation: true,
      backgroundColor: 'transparent',
      toolbox: { show: true, feature: { dataZoom: {}, restore: {}, saveAsImage: {} } },
      xAxis: {
        type: 'time',
        min: firstRoundAt ? dayjs(firstRoundAt).toDate() : undefined,
        max: lastRoundAt ? dayjs(lastRoundAt).toDate() : undefined,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: t('game.content.koh.hold_points'),
        nameTextStyle: { color: labelColor, fontWeight: 'normal' },
        boundaryGap: [0, '10%'],
        axisLabel: { formatter: t('game.label.score_formatter'), color: labelColor },
        splitLine: { show: true, lineStyle: { color: [lineColor], type: 'dashed' } },
      },
      tooltip: {
        trigger: 'axis',
        borderWidth: 0,
        textStyle: { fontSize: 12, color: labelColor },
        backgroundColor,
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          const rows = [...params]
            .sort((a, b) => (b.value?.[1] ?? 0) - (a.value?.[1] ?? 0))
            .map(
              (item) => `<div style="display:flex;justify-content:space-between;gap:1rem">
                <span>${item.marker} ${escapeHtml(shorten(item.seriesName ?? ''))}</span>
                <span style="font-weight:bold">${Number(item.value?.[1] ?? 0).toFixed(1)}</span>
              </div>`
            )
          return `<div><p>${dayjs(params[0].axisValue).format('YYYY-MM-DD HH:mm')}</p>${rows.join('')}</div>`
        },
        extraCssText: 'max-width: 300px; white-space: normal; word-break: break-all',
      },
      legend: {
        type: 'scroll',
        orient: 'horizontal',
        top: 420,
        textStyle: { fontSize: 12, color: labelColor },
        formatter: shorten,
      },
      grid: { top: 50, left: 70, right: 40, bottom: 110 },
      dataZoom: [
        { type: 'inside', start: 0, end: 100, xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', start: 0, end: 100, xAxisIndex: 0, showDetail: false, bottom: 60, height: 20 },
        { type: 'inside', start: 0, end: 100, yAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', start: 0, end: 100, yAxisIndex: 0, showDetail: false, right: 10, width: 20 },
      ],
    } satisfies EChartsOption
  }, [t, firstRoundAt, lastRoundAt, colorScheme, theme])

  if (teams.length === 0) return null

  return (
    <EchartsContainer
      option={{ ...option, series }}
      opts={{ renderer: 'svg', locale }}
      style={{ width: '100%', height: '460px', display: 'flex' }}
    />
  )
}
